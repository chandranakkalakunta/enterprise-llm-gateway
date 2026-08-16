# @ellmgw/gateway

Phase 1 Foundation. Authenticated `POST /v1/chat/completions` calls the **Grok** adapter (non-streaming). Streaming, DLP, and other providers are later.

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

curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/v1/me
# 401
```

Copy `apps/gateway/.env.example` to `apps/gateway/.env` and fill OIDC values (never commit `.env`). Export them before `dev`/`start`, e.g.:

```bash
set -a && source apps/gateway/.env && set +a
pnpm --filter @ellmgw/gateway dev
```

Then open `http://localhost:8080/auth/login` in a browser (Google OAuth client must allow `http://localhost:8080/auth/callback`).

## Environment

| Variable             | Default                               | Notes                                          |
| -------------------- | ------------------------------------- | ---------------------------------------------- |
| `NODE_ENV`           | `development`                         | `development` \| `test` \| `production`        |
| `PORT`               | `8080`                                | TCP port                                       |
| `OIDC_ISSUER`        | `https://accounts.google.com`         | Google accounts issuer                         |
| `OIDC_CLIENT_ID`     | _(empty)_                             | OAuth client ID; required for `/auth/login`    |
| `OIDC_CLIENT_SECRET` | _(empty)_                             | Never commit; required for `/auth/callback`    |
| `OIDC_AUDIENCE`      | client ID if unset                    | JWT `aud` for ID-token validation              |
| `OIDC_REDIRECT_URI`  | `http://localhost:8080/auth/callback` | Must match the Google client                   |
| `ADMIN_EMAILS`       | `admin@chandraailabs.com`             | Comma-separated; those emails get role `admin` |
| `GROK_API_KEY`       | _(empty)_                             | xAI API key; never commit. Missing → 503       |
| `GROK_BASE_URL`      | `https://api.x.ai/v1`                 | OpenAI-compatible Grok base URL                |
| `GROK_DEFAULT_MODEL` | `grok-4.5`                            | Used when the request omits `model`            |
| `GROK_TIMEOUT_MS`    | `60000`                               | Upstream timeout                               |

Browser session: httpOnly cookie `ellmgw_id_token` (Google **ID token**). Local HTTP sets `Secure=false`; production (`NODE_ENV=production`) sets `Secure`. Cookie is not a refresh-token store — when the ID token expires, sign in again. API clients should send `Authorization: Bearer <id_token>`.

## Routes

| Method | Path                   | Auth                                                            |
| ------ | ---------------------- | --------------------------------------------------------------- |
| GET    | `/health`              | Public                                                          |
| GET    | `/v1/me`               | Required (Bearer or session cookie)                             |
| GET    | `/auth/login`          | Starts Google authorization-code flow                           |
| GET    | `/auth/callback`       | Exchanges `code`; sets session cookie                           |
| GET    | `/auth/logout`         | Clears cookies                                                  |
| POST   | `/v1/chat/completions` | Required; Grok completion (non-streaming). `stream:true` → 400. |

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
