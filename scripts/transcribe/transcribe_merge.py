#!/usr/bin/env python3
"""Craig multi-track -> single speaker-labeled transcript.

Implements step C of recording-pipeline.md: transcribe each per-Discord-user
FLAC track independently (single speaker => no diarization), then interleave all
segments by timestamp into sources/transcripts/e<num>.txt.

Run with the arm64 venv:
    scripts/transcribe/.venv/bin/python scripts/transcribe/transcribe_merge.py \
        scripts/transcribe/tracks.e162.json

Idempotent: per-track Whisper output is cached under scripts/transcribe/cache/<ep>/.
Delete a track's cache json to force re-transcription.
"""
import argparse
import json
import os
import sys
import time

import mlx_whisper

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))


def fmt_ts(seconds: float) -> str:
    s = int(round(seconds))
    return f"{s // 3600:02d}:{(s % 3600) // 60:02d}:{s % 60:02d}"


def collapse_repeats(text: str) -> str:
    """Collapse Whisper repetition loops ("new new new new ..." / repeated phrases).

    Reduces any n-gram (n=1..4) repeated 3+ times in a row to a single copy.
    The model sometimes does this with high confidence, so logprob filtering
    alone won't catch it.
    """
    words = text.split()
    for n in (1, 2, 3, 4):
        out = []
        i = 0
        while i < len(words):
            gram = words[i:i + n]
            reps = 1
            while words[i + reps * n: i + (reps + 1) * n] == gram:
                reps += 1
            out.extend(gram)
            i += reps * n if reps >= 3 else n
        words = out
    return " ".join(words)


def degenerate(text: str) -> bool:
    """True if a (post-collapse) line is dominated by one repeated token."""
    w = text.split()
    if len(w) >= 12:
        most = max((w.count(x) for x in set(w)), default=0)
        if most / len(w) > 0.5:
            return True
    return False


def is_hallucination(seg: dict) -> bool:
    """Drop segments that are almost certainly Whisper filling silence.

    Conservative so we never lose real speech: only kill a segment when the
    model itself is unconfident (high no_speech_prob + low avg_logprob) or the
    text is degenerate repetition (high compression_ratio). Matters most for the
    mostly-silent remote tracks.
    """
    text = (seg.get("text") or "").strip()
    if not text:
        return True
    no_speech = seg.get("no_speech_prob", 0.0)
    avg_lp = seg.get("avg_logprob", 0.0)
    comp = seg.get("compression_ratio", 0.0)
    if no_speech > 0.6 and avg_lp < -0.5:
        return True
    if comp > 2.4 and avg_lp < -0.4:
        return True
    return False


def transcribe_track(audio_path: str, model: str, cache_path: str) -> dict:
    if os.path.exists(cache_path):
        print(f"  cache hit -> {os.path.relpath(cache_path, REPO)}", flush=True)
        with open(cache_path) as fh:
            return json.load(fh)
    print(f"  transcribing {os.path.basename(audio_path)} (model={model}) ...", flush=True)
    t0 = time.time()
    result = mlx_whisper.transcribe(
        audio_path,
        path_or_hf_repo=model,
        language="en",
        verbose=False,
        condition_on_previous_text=False,  # stops runaway repetition across silence
    )
    elapsed = time.time() - t0
    segs = result.get("segments", [])
    slim = [
        {
            "start": s["start"],
            "end": s["end"],
            "text": (s.get("text") or "").strip(),
            "no_speech_prob": s.get("no_speech_prob", 0.0),
            "avg_logprob": s.get("avg_logprob", 0.0),
            "compression_ratio": s.get("compression_ratio", 0.0),
        }
        for s in segs
    ]
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    with open(cache_path, "w") as fh:
        json.dump({"segments": slim}, fh)
    print(f"  done in {elapsed/60:.1f} min, {len(slim)} segments", flush=True)
    return {"segments": slim}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("config", help="path to tracks.<ep>.json")
    args = ap.parse_args()

    with open(args.config) as fh:
        cfg = json.load(fh)

    cfg_dir = os.path.dirname(os.path.abspath(args.config))
    audio_dir = os.path.abspath(os.path.join(cfg_dir, cfg["dir"]))
    episode = cfg["episode"]
    model = cfg.get("model", "mlx-community/whisper-large-v3-turbo")
    cache_dir = os.path.join(HERE, "cache", episode)

    merged = []  # (start, end, label, text)
    for track in cfg["tracks"]:
        audio_path = os.path.join(audio_dir, track["file"])
        label = track["label"]
        if not os.path.exists(audio_path):
            print(f"!! missing audio: {audio_path}", file=sys.stderr)
            return 2
        print(f"[{label}] {track['file']}", flush=True)
        cache_path = os.path.join(cache_dir, track["file"] + ".json")
        data = transcribe_track(audio_path, model, cache_path)
        kept = dropped = 0
        for seg in data["segments"]:
            if is_hallucination(seg):
                dropped += 1
                continue
            text = collapse_repeats(seg["text"])
            if degenerate(text):
                dropped += 1
                continue
            merged.append((seg["start"], seg["end"], label, text))
            kept += 1
        print(f"  kept {kept}, dropped {dropped} (silence/halluc.)", flush=True)

    merged.sort(key=lambda r: r[0])

    out_dir = os.path.join(REPO, "sources", "transcripts")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"{episode}.txt")
    with open(out_path, "w") as fh:
        fh.write(f"# {episode} — Craig multi-track transcript ({model})\n")
        fh.write("# tracks: " + ", ".join(f"{t['label']}={t['file']}" for t in cfg["tracks"]) + "\n\n")
        for start, _end, label, text in merged:
            fh.write(f"**{label}** [{fmt_ts(start)}] {text}\n")

    print(f"\nWROTE {os.path.relpath(out_path, REPO)} — {len(merged)} lines", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
