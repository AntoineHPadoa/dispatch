---
name: deploy
description: Publish Dispatch to GitHub Pages and check the live site. Use when asked to deploy, release or publish, when a deploy failed, or to confirm what is online at https://antoinehpadoa.github.io/dispatch/.
---

# Deploy

## How it works

- `.github/workflows/deploy.yml` runs on every push to `main` (and by hand: `workflow_dispatch`).
- Job `build` (Node 22, in `web/`): `npm ci` → `npm test` → `npm run build` (typecheck + Vite) → uploads `web/dist`. A failing test or type error stops the deploy.
- Job `deploy`: publishes the artifact to GitHub Pages.
- The site lives under `/dispatch/` (Vite `base` in `web/vite.config.ts`, the repo name). Renaming the repo means changing `base`.
- One-time repo setting: Settings → Pages → Source = "GitHub Actions" (check: `gh api repos/AntoineHPadoa/dispatch/pages --jq .build_type` prints `workflow`).

## Before pushing

From `web/`, the same steps as CI:

```bash
npm ci && npm test && npm run build
```

Push only when asked (the user decides when to publish).

## After pushing

```bash
gh run list --workflow deploy.yml --limit 3        # latest runs and their status
gh run watch <run-id> --exit-status                # follow one run, non-zero exit if it fails
gh run view <run-id> --log-failed                  # logs of the failed steps
curl -s -o /dev/null -w '%{http_code}\n' https://antoinehpadoa.github.io/dispatch/   # 200 expected
```

Then look at the live site with the `run-app` capture script, using the public URL:

```bash
.claude/skills/run-app/capture.sh "https://antoinehpadoa.github.io/dispatch/#/" 1280 /tmp/live-home.png
```

Pages can serve the previous version for a minute or two after the run ends.
