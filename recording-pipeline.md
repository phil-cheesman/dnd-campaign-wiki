# Session recording → transcript pipeline

How raw `sources/transcripts/e<num>.txt` files get produced, *before* the ingest steps in this folder's `CLAUDE.md` ("Ingesting a new transcript") take over. Decided 2026-06-12.

## Why this approach

The standing problem (see `CLAUDE.md` step 2 and the campaign memory): one room mic plus Jon remote on speakerphone makes **diarization unreliable**, so attribution falls back to "by character, never guess player names."

**Craig records one separate audio track per Discord user.** If every player is their own Discord user, each track is already single-speaker — diarization is eliminated. We transcribe each track independently and interleave by timestamp. Jon's track (remote, isolated) is the cleanest and carries his high-value opening recap.

## A. Craig bot (recording)

[Craig](https://craig.chat) — multi-track Discord voice recorder.

- **Invite** Craig to the server (optionally also its twin **Giarc** for redundant simultaneous recording).
- **Access:** `/server-settings access-role` restricts who can record; otherwise server managers can.
- **Record:** `/join` to start, `/stop` to end. Craig DMs a download-dashboard link at start; downloadable mid-session.
- **Free limits:** 6 hours/session, audio retained **7 days**, no speaker cap. Download within the week.
- **Download format:** multi-track **FLAC** (dashboard also offers AAC / Audacity project). One file per speaker: `1-Username.flac`, `2-Username.flac`, …

## B. In-room players → per-speaker tracks ("join muted from phones")

Goal: a clean separate track per in-person player without acoustic feedback. Discord distinction matters:
**Mute = mic off** (Craig records nothing) · **Deafen = speaker off**.

- Each in-room player **joins the voice channel on their own phone**, **mic ON**, but **output muted** — wear earbuds, or keep the phone speaker off / deafened. "Muted" = *output*-muted, not mic-muted.
- Route **Jon's remote audio through ONE shared room speaker** (or everyone's earbuds), so 5 phone speakers aren't blasting his voice into 5 live mics (the feedback loop to avoid).
- **Earbuds per player are strongly recommended.** Without them every live phone mic still picks up the whole table, so each "per-speaker" track has heavy bleed and the diarization win erodes. Earbuds + speaking near your own phone keeps each track dominated by its owner's voice.

⚠️ Even done well, in-room mics get some cross-talk; Jon's remote track is cleanest. Budget for manual cleanup on the in-room tracks.

## C. Per-track Whisper → `sources/transcripts/e<num>.txt`

1. **Map track → character** once per session (Discord user → PC), e.g. `john→DM (Jon)`, `phil→Quinton`, `steve→Torgoth`. Keep the mapping with the episode. (Players change characters over time — Steve has run Zook → Evac → Benjamin → Torgoth — so the map is per-episode, not global.)
2. **Transcribe each track** with `faster-whisper` (large-v3), segment/word timestamps, VAD to skip silence. Per-track = single speaker, so no diarization model:
   ```
   faster-whisper 3-phil.flac --model large-v3 --word_timestamps True \
     --vad_filter True --output_format json -o e162/
   ```
3. **Interleave by timestamp:** a merge script tags every segment with its track's character label, then sorts all segments across tracks by `start` → a chronological, speaker-labeled transcript:
   ```
   **DM (Jon)** [00:03:12] Last session, you'd just …
   **Quinton**   [00:03:48] I want to check the door …
   ```
4. **Write** `sources/transcripts/e<num>.txt` (this naming + folder is already gitignored), then run the existing **scrub → attribute → recap** steps in `CLAUDE.md`. Because tracks are pre-labeled, "attribute by character" is near-automatic — only `**Party**` / ambient lines need resolving.

## Future / connector idea

Fits the chezos-style connector pattern noted in the campaign memory: a step that takes Craig's multi-track download, runs per-track Whisper + the interleave merge, and drops a finished transcript into `sources/transcripts/`. Not built yet — this file is the design.

## Status

- Craig features above confirmed from craig.chat (2026-06-12).
- The merge/interleave script is **not written yet**; capture the per-episode track→character map when recording starts so it's ready.
