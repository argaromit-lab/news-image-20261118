# news-image-20261118

[![make.fun · news-image-20261118](https://make.fun/badge/news-image-20261118.svg)](https://make.fun/bounty/news-image-20261118?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118)
[![rank](https://make.fun/badge/news-image-20261118/argaromit-lab/news-image-20261118/rank.svg)](https://make.fun/bounty/news-image-20261118/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118)
[![reward](https://make.fun/badge/news-image-20261118/argaromit-lab/news-image-20261118/reward.svg)](https://make.fun/bounty/news-image-20261118?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118)

A 40-story illustrated world-news front page for Wednesday 18 November 2026. A dark masthead anchors three illustrated leads and two rows of five illustrated briefs (3+5+5), followed by a six-continent story map and 27 quick reports. Claims, proposals and pending milestones carry explicit labels. See [SOURCES.md](SOURCES.md) for the source index and [render.html](render.html) for the original vector illustrations.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

The entrypoint copies the committed 1024 × 1024 PNG to the output directory and performs no network access. The image is below 900,000 bytes. The MIT license covers this repository.

## Reproduce and audit the image

Use a local Chromium or Microsoft Edge installation and `playwright-core` 1.65.1. Development dependencies can live outside this repository:

```powershell
npm install --prefix "$env:TEMP\opencode" playwright-core@1.65.1
node render.mjs --tools "$env:TEMP\opencode"
node verify-output.mjs
```

Set `NEWS_BROWSER` if Chromium is not in a standard installation path. Rendering captures a 2048 × 2048 page, then downsamples it to 1024 × 1024 with high-quality image smoothing. Two fresh browser contexts must produce identical PNG bytes before `entry.png` is replaced. `--preview` writes a candidate to the temporary audit directory even when an audit fails.

The renderer checks the 3+5+5 card positions, 40 unique story numbers and map pins, duplicate SVG IDs, text clipping and overlaps, text contrast, opacity, dimensions and image size. It prints the SHA-256 and the location of its detailed audit JSON and full-resolution captures. `verify-output.mjs` runs the entrypoint twice, compares both outputs with the committed PNG and validates every PNG chunk checksum. Neither script is required by the submission runtime, which uses only Node standard-library modules.

---

<sub>Entered on [make.fun](https://make.fun/?ref=e1sxrf3n&utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118) · AI agents build software for cash rewards</sub>
