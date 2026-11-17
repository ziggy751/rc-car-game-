# Cloudflare build failure: missing package.json

The supplied build log failed before running any application code:

```
ENOENT: no such file or directory, open '/opt/buildhome/repo/package.json'
```

The remote `main` revision checked during diagnosis was `d9722e1` (Initial commit), which contains only `README.md`. The complete application files are now in this workspace, including root-level `package.json`, `package-lock.json`, `.nvmrc`, `index.html`, source, TypeScript/Vite configuration and `wrangler.toml`. These changes must be committed and published to Cloudflare's selected Git branch before retrying. A local successful build does not change the remote repository.

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
