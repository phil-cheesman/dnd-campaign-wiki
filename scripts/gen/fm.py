"""Frontmatter art-block read/write via controlled text surgery.

We deliberately do NOT round-trip the whole YAML (PyYAML reflows everything;
ruamel still normalizes styles) — that would produce noisy diffs across ~90 canon
files. Instead we only touch the `art:` block: parse its scalar subkeys, and
replace/insert a canonically-formatted block, leaving every other line untouched.
"""
import re
import textwrap
from pathlib import Path

_FM = re.compile(r"^(---\n)(.*?)(\n---\n?)(.*)$", re.S)


def split(path):
    """-> (open, fm_body, close, body). fm_body has no leading/trailing fence newline."""
    t = Path(path).read_text()
    m = _FM.match(t)
    if not m:
        raise ValueError(f"no frontmatter in {path}")
    return m.group(1), m.group(2), m.group(3), m.group(4)


def parse_art_scalars(fm_body):
    """Top-level art.* scalar subkeys present (status, image, has_visual_source, …)."""
    out, in_art = {}, False
    for ln in fm_body.split("\n"):
        if re.match(r"^art:\s*$", ln):
            in_art = True
            continue
        if in_art:
            if ln and not ln[0].isspace():
                break
            m = re.match(r"^  (\w+):\s*(.*)$", ln)
            if m and m.group(2) != "":
                out[m.group(1)] = m.group(2).strip()
    return out


def _wrap(text):
    return textwrap.wrap(" ".join(text.split()), width=92) or [""]


def _yq(s):
    """YAML double-quoted scalar (safe for colons, apostrophes, quotes)."""
    return '"' + str(s).replace("\\", "\\\\").replace('"', '\\"') + '"'


def build_art_block(f):
    """Render the canonical art block (no trailing newline). f = dict of fields."""
    L = ["art:", f"  type: {f['type']}", f"  eligibility: {f['eligibility']}",
         f"  has_visual_source: {str(bool(f.get('has_visual_source'))).lower()}"]
    refs = f.get("ref_images") or []
    if refs:
        L.append("  ref_images: [" + ", ".join(refs) + "]")
    L.append("  visual: |")
    L += ["    " + w for w in _wrap(f["visual"])]
    for k in ("model", "style_version", "prompt_hash", "seed", "status"):
        if f.get(k) is not None:
            L.append(f"  {k}: {f[k]}")
    if f.get("generated_at"):
        L.append(f'  generated_at: "{f["generated_at"]}"')
    if f.get("scene_title"):
        L.append(f"  scene_title: {_yq(f['scene_title'])}")
    if f.get("key_entities"):
        L.append("  key_entities: [" + ", ".join(_yq(e) for e in f["key_entities"]) + "]")
    L.append(f"  image: {f['image'] if f.get('image') else 'null'}")
    return "\n".join(L)


def write_art_block(path, fields):
    """Replace an existing art: block (if any) or append one; rewrite the file."""
    o, fm_body, c, body = split(path)
    lines, out, i, n = fm_body.split("\n"), [], 0, None
    src = fm_body.split("\n")
    n = len(src)
    while i < n:
        if re.match(r"^art:\s*$", src[i]):
            i += 1
            while i < n and (src[i] == "" or src[i][0].isspace()):
                i += 1
            continue
        out.append(src[i])
        i += 1
    while out and out[-1] == "":
        out.pop()
    new_fm = "\n".join(out) + "\n" + build_art_block(fields)
    Path(path).write_text(o + new_fm + c + body)
