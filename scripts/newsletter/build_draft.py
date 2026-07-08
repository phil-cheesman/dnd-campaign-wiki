#!/usr/bin/env python3
"""
draft-newsletter harness — build "The Alambor Chronicle" recap email for a PUBLISHED
episode and APPEND it to Gmail Drafts over IMAP. Generalized from the E162 prototype
(newsletter-mockups/build_draft.py); the SKILL authors the per-episode content JSON,
this script does the deterministic, hard-won delivery work.

HARD DELIVERY DECISIONS (do not relitigate — see docs/specs/draft-newsletter-skill.md §3):
  * NO Gmail MCP create_draft  -> it strips every <img> and background fill.
  * NO inline CID images       -> Gmail scrambles them into wrong slots on SEND.
  * HOT-LINK images from the live site -> nothing to scramble; runs AFTER push.
  * Create the draft via IMAP APPEND ([Gmail]/Drafts, \\Draft flag) -> faithful MIME.

Idempotency: APPEND-ONLY by design (per Phil). Never deletes a draft. Before appending
it counts existing "Alambor E<N>" drafts and reports the total so duplicates can be
removed by hand. NEVER auto-sends.

Inputs (all resolved relative to repo root):
  scripts/newsletter/content/e<N>.json   per-episode content (authored by the skill)
  scripts/newsletter/template.html.j2     locked Illuminated design
  config/newsletter-recipients.json       distribution list (gitignored; real emails)
  config/newsletter-poll.json             reusable Google Form (form_base + entry ids)
  config/newsletter-crit-tally.json       season nat-20 tally -> the bar chart
  .env                                     GMAIL_ADDRESS + GMAIL_APP_PASSWORD

Usage:
  ./.venv/bin/python build_draft.py 162 --dry-run   # write e162-draft.eml, touch nothing
  ./.venv/bin/python build_draft.py 162             # append a draft addressed to Phil only
  ./.venv/bin/python build_draft.py 162 --to-all    # append a draft to the full party list
"""
import argparse, base64, imaplib, json, re, sys, time
import urllib.parse, urllib.request
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from html import unescape
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SITE = "https://alambor.vercel.app"

# canonical PC order for the season bar chart (matches the dashboard / E162 prototype)
PC_ORDER = ["Berrian", "Cruucar", "Noctis", "Quinton", "Torgoth", "Vane"]
# the DM is tracked in the same chart so the party can see how badly Jon out-rolls them
DM_NAME = "DM (Jon)"

# self-contained share copy: inline the committed site images as base64 data-URIs
PUBLIC = ROOT / "site" / "public"
_MIME = {"webp": "image/webp", "png": "image/png", "jpg": "image/jpeg",
         "jpeg": "image/jpeg", "gif": "image/gif", "svg": "image/svg+xml"}


def data_uri(bare_path: str) -> str:
    """A committed site image (/art/...) -> a base64 data: URI, for the offline share copy."""
    p = PUBLIC / bare_path.lstrip("/")
    mime = _MIME.get(p.suffix.lower().lstrip("."), "application/octet-stream")
    return f"data:{mime};base64," + base64.b64encode(p.read_bytes()).decode()


def load_env() -> dict:
    env = {}
    envfile = ROOT / ".env"
    if envfile.exists():
        for line in envfile.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def load_json(path: Path) -> dict:
    if not path.exists():
        sys.exit(f"Missing required file: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def abs_url(path: str) -> str:
    """A content image value may be a bare site path (/art/...) or a full URL."""
    if path.startswith("http://") or path.startswith("https://"):
        return path
    return SITE + ("" if path.startswith("/") else "/") + path


def _plain(s: str) -> str:
    """HTML -> plain text (strip tags, decode entities) for URL params / counts."""
    return unescape(re.sub(r"<[^>]+>", "", s or "")).strip()


def poll_links(poll: dict, episode: int, poll_cfg: dict) -> dict:
    """Per-option vote links. Prefer the one-click web app; fall back to the Google Form."""
    webapp = poll_cfg.get("webapp_base")
    out = dict(poll)
    opts = []
    for o in poll["options"]:
        key = o["key"]
        if webapp:  # one-click: logs the vote on click, no Form/Submit
            label = urllib.parse.quote(_plain(o.get("label", "")))
            url = f"{webapp}?ep={episode}&vote={key}&l={label}"
        else:       # fallback: prefilled Google Form (still needs a Submit click)
            url = (f"{poll_cfg['form_base']}?usp=pp_url"
                   f"&{poll_cfg['episode_entry']}=E{episode}&{poll_cfg['vote_entry']}={key}")
        opts.append({**o, "url": url})
    out["options"] = opts
    return out


def last_week_results(poll_cfg: dict, episode: int):
    """Fetch the prior episode's tallies from the web app and join them to that episode's
    option labels. Returns a render-ready list or None (graceful: any failure -> omit)."""
    webapp = poll_cfg.get("webapp_base")
    prev = episode - 1
    if not webapp:
        return None
    try:
        url = f"{webapp}?mode=results&ep={prev}"
        with urllib.request.urlopen(url, timeout=8) as r:
            counts = json.loads(r.read().decode("utf-8"))
    except Exception:
        return None
    if not counts or not any(counts.values()):
        return None
    prev_path = HERE / "content" / f"e{prev}.json"
    labels = {}
    if prev_path.exists():
        for o in load_json(prev_path).get("poll", {}).get("options", []):
            labels[o["key"]] = _plain(o.get("label", ""))
    total = sum(int(v) for v in counts.values())
    rows = []
    for key in sorted(counts):
        n = int(counts[key])
        rows.append({"key": key, "label": labels.get(key, f"Option {key}"),
                     "count": n, "pct": int(round(n / total * 100)) if total else 0})
    return {"episode": prev, "total": total,
            "rows": sorted(rows, key=lambda r: -r["count"])}


def season_bars(tally: dict, upto: int) -> list:
    """Cumulative nat-20 totals per PC (and the DM) across episodes <= upto -> bar rows."""
    totals = {pc: 0 for pc in PC_ORDER}
    totals[DM_NAME] = 0
    for ep_str, rec in tally.get("episodes", {}).items():
        try:
            if int(ep_str) > upto:
                continue
        except ValueError:
            continue
        for who, n in (rec.get("nat20") or {}).items():
            totals[who] = totals.get(who, 0) + int(n)
    mx = max(totals.values()) if totals else 0
    order = PC_ORDER + [DM_NAME]
    rows = sorted(totals.items(), key=lambda kv: (-kv[1], order.index(kv[0]) if kv[0] in order else 99))
    bars = []
    for name, count in rows:
        pct = int(round(count / mx * 100)) if mx else 0
        bars.append({"name": name, "count": count, "pct": pct})
    return bars


def build_context(content: dict, episode: int, poll_cfg: dict, tally: dict,
                  inline_images: bool = False) -> dict:
    # token -> image src for every image referenced in the content JSON.
    # email: hot-link the live URL (runs after push); share copy: inline base64 data-URI.
    raw = dict(content.get("images", {}))
    raw.setdefault("logo", "/icon-512.png")
    if inline_images:
        img = {}
        for tok, p in raw.items():
            try:
                img[tok] = data_uri(p)
            except FileNotFoundError:
                img[tok] = abs_url(p)  # fall back to live URL if not on disk
    else:
        img = {tok: abs_url(p) for tok, p in raw.items()}

    ctx = dict(content)
    ctx["IMG"] = img
    ctx["site"] = SITE
    ctx["poll"] = poll_links(content["poll"], episode, poll_cfg)
    ctx["last_results"] = last_week_results(poll_cfg, episode)
    ctx["season_bars"] = season_bars(tally, episode)
    ctx.setdefault("preview_text", content.get("dek_html", ""))
    ctx.setdefault("tagline", "Last Time in Alambor &middot; a true accounting of recent deeds")
    return ctx


def render_html(ctx: dict) -> str:
    env = Environment(
        loader=FileSystemLoader(str(HERE)),
        autoescape=select_autoescape(["html", "j2"]),
    )
    html = env.get_template("template.html.j2").render(**ctx)
    leftover = sorted(set(re.findall(r'src="(cid:[^"]+)"', html)))
    if leftover:
        sys.exit(f"Unresolved cid refs in rendered HTML: {leftover}")
    if "{{" in html or "{%" in html:
        sys.exit("Unrendered Jinja tokens remain in HTML — check the content JSON keys.")
    return html


def plain_text(content: dict) -> str:
    """Plain-text alternative built from the content (no hand-maintained copy)."""
    def strip(s: str) -> str:
        return unescape(re.sub(r"<[^>]+>", "", s or "")).strip()
    title = content.get("title", "")
    dropcap = content.get("previously_dropcap", "")
    prev = (dropcap + strip(content.get("previously_html", ""))).strip()
    url = content.get("recap_url", "")
    return (
        f"Last time in Alambor — E{content['episode']}, {title}.\n\n"
        f"{prev}\n\n"
        f"Read the full recap: {url}\n\n"
        "(Your client is showing the plain-text version — open the HTML view for the full issue.)"
    )


def build_message(content: dict, html: str, from_addr: str, to_addrs: list) -> MIMEMultipart:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = content["subject"]
    msg["From"] = from_addr
    msg["To"] = ", ".join(to_addrs)
    msg.attach(MIMEText(plain_text(content), "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))
    return msg


def drafts_folder(imap: imaplib.IMAP4_SSL) -> str:
    typ, data = imap.list()
    if typ == "OK":
        for raw in data:
            line = raw.decode(errors="replace")
            if "\\Drafts" in line:
                return line.split(' "/" ')[-1].strip().strip('"')
    return "[Gmail]/Drafts"


def count_existing(imap: imaplib.IMAP4_SSL, folder: str, episode: int) -> int:
    """Count existing 'Alambor E<N>' drafts (report-only — we never delete)."""
    try:
        imap.select(folder, readonly=True)
        typ, data = imap.search(None, "SUBJECT", f'"Alambor E{episode}"')
        if typ == "OK" and data and data[0]:
            return len(data[0].split())
    except Exception as e:  # search is best-effort reporting
        print(f"  (could not search existing drafts: {e})")
    return 0


def append_draft(msg: MIMEMultipart, addr: str, pw: str, episode: int):
    imap = imaplib.IMAP4_SSL("imap.gmail.com")
    imap.login(addr, pw)
    folder = drafts_folder(imap)
    existing = count_existing(imap, folder, episode)
    print(f"  appending to folder: {folder}")
    r = imap.append(folder, "\\Draft", imaplib.Time2Internaldate(time.time()), msg.as_bytes())
    print(f"  IMAP append: {r[0]}")
    imap.logout()
    total = existing + 1
    if existing:
        print(f"  ⚠ {total} drafts named 'Alambor E{episode} …' now exist "
              f"({existing} pre-existing). APPEND-ONLY — delete the stale ones in Gmail by hand.")
    else:
        print(f"  1 draft named 'Alambor E{episode} …' now exists.")


def main():
    ap = argparse.ArgumentParser(description="Build the Alambor Chronicle recap-email draft.")
    ap.add_argument("episode", type=int, help="episode number, e.g. 162")
    ap.add_argument("--to-all", action="store_true",
                    help="address the full party list (config/newsletter-recipients.json); default = Phil only")
    ap.add_argument("--dry-run", action="store_true",
                    help="write scripts/newsletter/e<N>-draft.eml instead of touching Gmail")
    args = ap.parse_args()
    ep = args.episode

    content = load_json(HERE / "content" / f"e{ep}.json")
    if int(content.get("episode", ep)) != ep:
        sys.exit(f"content/e{ep}.json says episode={content.get('episode')} — mismatch.")
    poll_cfg = load_json(ROOT / "config" / "newsletter-poll.json")
    tally = load_json(ROOT / "config" / "newsletter-crit-tally.json")
    recips = load_json(ROOT / "config" / "newsletter-recipients.json")
    env = load_env()

    from_addr = recips.get("from") or env.get("GMAIL_ADDRESS", "")
    to_addrs = [r["email"] for r in recips["recipients"]] if args.to_all else [from_addr]

    print(f"Building '{content['subject']}'")
    print(f"  from: {from_addr}")
    print(f"  to:   {', '.join(to_addrs)}")

    ctx = build_context(content, ep, poll_cfg, tally)
    html = render_html(ctx)
    print(f"  hot-linked {len(ctx['IMG'])} images from {SITE}")
    msg = build_message(content, html, from_addr, to_addrs)

    # Always emit a self-contained spot-check copy (gitignored) — images inlined as
    # base64 so Phil can text it over iMessage to proof a draft before it goes out.
    share_ctx = build_context(content, ep, poll_cfg, tally, inline_images=True)
    share_out = HERE / f"e{ep}-share.html"
    share_out.write_text(render_html(share_ctx), encoding="utf-8")
    print(f"  share copy: {share_out.name} ({share_out.stat().st_size // 1024} KB, images inlined)")

    if args.dry_run:
        out = HERE / f"e{ep}-draft.eml"
        out.write_bytes(msg.as_bytes())
        print(f"\nDRY RUN — wrote {out} ({out.stat().st_size // 1024} KB). No Gmail touched.")
        return

    addr = env.get("GMAIL_ADDRESS") or from_addr
    pw = env.get("GMAIL_APP_PASSWORD", "").replace(" ", "")
    if not addr or not pw:
        sys.exit("Missing GMAIL_ADDRESS / GMAIL_APP_PASSWORD in .env — add them and retry "
                 "(or run with --dry-run).")
    append_draft(msg, addr, pw, ep)
    print("\nDone. Open Gmail → Drafts to review. NOTHING was sent.")


if __name__ == "__main__":
    main()
