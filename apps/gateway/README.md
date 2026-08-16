# @ellmgw/gateway

Phase 1 Foundation skeleton. OpenAI-compatible surface (1.4), Google OIDC (1.3), and the Grok adapter (1.5) are **not** in this package yet.

## Prerequisites

- Node.js 22 (see repo-root `.nvmrc`)
- [pnpm](https://pnpm.io/) 10+

## Local development

From the **repository root**:

```bash
pnpm install
pnpm --filter @ellmgw/gateway dev
```

Default listen address: `http://127.0.0.1:8080`.

```bash
curl -sS http://127.0.0.1:8080/health
# {"status":"ok","service":"gateway"}
```

Optional env (copy `apps/gateway/.env.example`):

| Variable   | Default       | Notes                                   |
| ---------- | ------------- | --------------------------------------- |
| `NODE_ENV` | `development` | `development` \| `test` \| `production` |
| `PORT`     | `8080`        | TCP port                                |

Do not put secrets in `.env`. None are required for 1.1.

## Scripts

From repo root (or `cd apps/gateway`):

| Script              | Command          |
| ------------------- | ---------------- |
| Dev (reload)        | `pnpm dev`       |
| Tests               | `pnpm test`      |
| Lint                | `pnpm lint`      |
| Typecheck           | `pnpm typecheck` |
| Build               | `pnpm build`     |
| Start (needs build) | `pnpm start`     |
