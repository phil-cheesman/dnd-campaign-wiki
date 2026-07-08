# One-click poll — deploy guide

Replaces the clunky Google Form (generic A/B/C/D, extra option, two clicks) with a
**one-click** vote: each newsletter button is a direct link that logs the vote and shows
a themed thank-you page. Also powers the **"Last week's results"** section.

## Deploy (one-time, ~5 min — Phil does this)

1. Go to <https://sheets.new>, name it **"Alambor Poll Votes"**. From its URL, copy the
   **Sheet ID** — the long string between `/d/` and `/edit`.
2. **Extensions → Apps Script.** Delete the stub, paste all of `Code.gs`, then **paste your
   Sheet ID into the `SHEET_ID = ''` line at the top** (between the quotes). Save.
   *(This is required — a published web app can't reliably use `getActiveSpreadsheet()`,
   which is why a fresh deploy returns a bare "Error" page.)*
3. **Deploy → New deployment → ⚙ → Web app.**
   - Description: `alambor poll`
   - **Execute as:** Me
   - **Who has access:** **Anyone** (not "Anyone with Google account")
4. **Deploy**, authorize when prompted, and **copy the Web app URL** (ends in `/exec`).
5. Send me that URL (or paste it into `config/newsletter-poll.json` → `"webapp_base"`).
   Votes land on the `votes` tab of that Sheet.

### If you already deployed and got an "Error" page
That's the empty-`SHEET_ID` bug. Fix it: paste your Sheet ID into the `SHEET_ID` line,
save, then **Deploy → Manage deployments → ✏️ edit → Version: New version → Deploy**
(reuses the same `/exec` URL). Test by opening `<your /exec URL>?mode=results&ep=162` in a
browser — it should show `{}` (empty), not an error.

When you change the answers each week, **nothing to redeploy** — the harness builds the
links from the episode's content JSON. One deployment serves every episode.

## What the links look like

```
<webapp_base>?ep=163&vote=A&l=Inside%20the%2030-foot%20snake
<webapp_base>?mode=results&ep=162      -> {"A":3,"B":1,"C":0}
```

## After you send me the URL

I'll wire the harness to:
- build one-click vote links (instead of the Google Form prefill), and
- fetch the prior episode's tally to auto-write the **"Last week's results"** section.

Until then the harness falls back to the existing Google Form link, so newsletters keep
working.
