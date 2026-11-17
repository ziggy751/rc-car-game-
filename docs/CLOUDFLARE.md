# Cloudflare build failure: missing package.json

The supplied build log failed before running any application code:

```
ENOENT: no such file or directory, open '/opt/buildhome/repo/package.json'
```

The original remote `main` was `d9722e1` (Initial commit), containing only `README.md`. The complete game was subsequently pushed to `main` as `7fc586d3a6f476732ce40f62cb222c57d9679630`. Its root contains `package.json`, `package-lock.json`, `.nvmrc`, `index.html`, source and build configuration. A fresh clone of that remote revision passed `npm ci` and `npm run build`.

The reported failed deployment cloned at 04:43:31 UTC on 17 November 2026. The main-branch update was pushed at 04:44:17 UTC, after that clone. That log therefore predates the main update. Check the deployment commit before retrying: select `7fc586d` or a later descendant, not the old initial commit. Retrying an old deployment can continue building its original revision.

## Cloudflare Pages (Git integration)

- Production branch: the branch containing the complete game files.
- Root directory: repository root (leave blank; do not use `src` or `dist`).
- Build command: `npm run build`.
- Build output directory: `dist`.
- Node version: `.nvmrc` selects Node 24. Node 22.12+ is also supported.

Cloudflare should detect the package manifest and install npm dependencies using the lockfile. If dependency installation was explicitly disabled in your project settings, enable it or use `npm ci && npm run build` as the build command.

## Workers Builds

The same root/build settings apply. `wrangler.toml` supplies `[assets] directory = "./dist"` for a static-assets Worker. The deployment command is `npx wrangler deploy`, with authentication provided securely by Cloudflare. This environment does not contain a Cloudflare deployment token and has not published the site.

## Before retrying

In GitHub's selected branch, confirm that `package.json`, `package-lock.json`, `src/main.ts` and `index.html` are visible at the root. Then retry the latest deployment. Retrying the old README-only commit produces the same failure, regardless of build-command changes.
