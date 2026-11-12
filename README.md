# Public HTTP snapshot: arvisclinic.ru

Raw response bodies and links are unchanged. `site/` keeps one ordinary path alias, with URL-qualified variants only when a different response body must be preserved. `meta/manifest.jsonl` and `meta/urls.csv` map every captured URL to its published body.

See `meta/stats.json`, `meta/failures.json` and `meta/skipped.txt` for coverage and exclusions. PDF/video/audio were not downloaded. Server files, private backups and private clinical systems were not capture inputs. Full-page JPEG screenshots at widths 390 and 1440 are in `shots/`; `meta/shots.json` maps each final page URL and viewport to its image and report. They were rendered from captured bytes in isolated offline Playwright contexts using the already-installed runtime and Chrome. Cookie notices were not dismissed.

`file-manifest.json` lists raw sizes, SHA-256, Git blob SHA-1 and byte-exact upload encoding; it excludes its own entry.
