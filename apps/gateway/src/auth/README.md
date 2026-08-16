# Auth — Google OIDC (sub-phase 1.3)

- **Bearer:** `Authorization: Bearer <Google ID token>` validated with `jose` against Google JWKS.
- **Browser:** `GET /auth/login` → Google → `GET /auth/callback` stores the ID token in an httpOnly cookie (`ellmgw_id_token`).
- **CSRF:** `state` (and `nonce`) set on login; callback requires a matching `ellmgw_oidc_state` cookie.
- **Roles:** email in `ADMIN_EMAILS` → `admin`; otherwise `user`.
- **Fail-closed:** missing/invalid credentials → 401 on `/v1/me`.

Not in this sub-phase: Admin Console UI, Grok adapter, `/v1/chat/completions`.
