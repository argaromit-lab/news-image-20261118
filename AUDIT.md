# Layout and output audit · 19 November 2026

The resumed upgrade uses a dark masthead and 13 illustrated reports arranged as **3+5+5**, followed by 27 quick reports. The source index and map use the same story numbers, 1–40.

| Check | Result |
|---|---|
| Final PNG | 1024 × 1024 pixels; **472,078 bytes** (472.1 KB / 461.0 KiB) |
| Render source | 2048 × 2048 Chromium capture, downsampled with high-quality smoothing |
| DOM audit | PASS; 318 text fragments; zero clipping or text overlaps |
| Card layout | PASS; 3 lead cards, then two rows of 5 |
| Numbering | PASS; 40 unique story IDs and 40 map pins; no duplicate SVG IDs |
| HTML text contrast | PASS; 192 text elements checked; minimum 4.52:1 |
| Pixel check | PASS; all 1,048,576 pixels opaque; luminance range 0–255 |
| Masthead sample | RGB 15, 23, 42 (`#0f172a`) |
| Render determinism | PASS; two fresh browser contexts produce byte-identical PNGs |
| Windows entrypoint | PASS; two executions produce the same PNG |
| Linux entrypoint | PASS; Node 22.23.5, two executions in Docker with 1 vCPU / 1024 MB, no network and a read-only repository |
| PNG structure | PASS; signature, dimensions, final IEND and every chunk checksum checked |
| Pre-submit file checks | PASS for competition window, snapshot caps, MIT license and root entrypoint |

Both rendered outputs and all entrypoint outputs have SHA-256:

```text
d3e1007bb53ae89442f4ec982fbf581dea062b022f95187953e9596f8463ccd4
```

The DOM audit checks visible text geometry, including SVG text bounds, rather than treating `overflow:hidden` or line clamping as a fix. It also checks source/status labels, story order, map-pin count and card positions. HTML contrast is computed from the declared foreground and opaque ancestor background; the figure labels also received a visual review. These checks do not certify the factual accuracy of the reports.

## Anti-slop detector

**Verdict: PASS after fixes.** Severity 0; zero gating findings; one advisory; no external stylesheets.

| Guard | Initial hits | Action | Why it matters |
|---|---:|---|---|
| `redundant-border` | 7 | Deterministic fixer removed redundant filled-surface borders | Avoids unnecessary visual framing |
| `wide-body-tracking` | 4 | Deterministic fixer normalized tracking | Keeps small labels readable |
| `tight-line-height` | 3 | Deterministic fixer increased leading; grid heights were then adjusted | Prevents lines colliding in dense cards |
| `tiny-body-text` | 5 | Deterministic fixer increased small text; metadata spacing was adjusted | Improves label legibility |
| `cream-default-wash` | 1 advisory | Retained the existing editorial background and serif headlines | A genre/style advisory; the requested dark masthead remains the focal point |

## Competitive comparison and grading limits

The public development leaderboard inspected during this continuation showed the first three entries at approximately 99.15%, 99.13% and 99.11%, with images of 224,428, 381,537 and 447,924 bytes. The second and third described 52-story editions. This requested 40-story revision prioritizes the 3+5+5 layout and larger, unclipped labels. It is larger than those three image files while remaining well below the requested 900 KB cap.

There is **no public local judge or scorer** in this competition's kit (`RULES.txt`, “Before you submit”, step 2). The official `grade-local` command confirms that it needs the house's unpublished competition directory. Docker output checks therefore establish runtime compatibility and determinism, not a jury win rate or a claim to have beaten first place.

The pre-submit check was run without a transcript bundle, as bundling belongs to the submission wrapper. Its only reported failure was the expected `transcripts_present`; transcript checks still need the recorded sessions when submitting. This continuation does not submit an entry.

## Re-run

```powershell
node render.mjs --tools "$env:TEMP\opencode"
node verify-output.mjs
docker run --rm --cpus="1.0" --memory="1024m" --network=none --pids-limit=64 --read-only --tmpfs /tmp:rw,size=16m -v "G:\bounties\news-image-20261118:/bot:ro" -w /bot node:22-slim node verify-output.mjs
```

`render.mjs` prints the temporary audit directory containing its JSON report and both full-resolution captures. See the README for the development-only browser dependency.
