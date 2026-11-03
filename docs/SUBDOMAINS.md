# Subdomains

Updated: 2026-11-03 (Asia/Dhaka, UTC+6).

Each surface is its own Worker. Origins live in `@airexpay/config` and can be overridden with `ORIGIN_MARKETING`, `ORIGIN_APP`, `ORIGIN_PAY`, `ORIGIN_API`, `ORIGIN_AUTH`, `ORIGIN_DOCS`, and `ORIGIN_ADMIN`.

This change does not create DNS records and does not deploy. The owner approves that separately. Every `wrangler.toml` keeps `workers_dev = false`, has no `account_id`, and leaves `[[routes]]` commented out. `deploy` scripts exit before contacting Cloudflare.

## Production

| Host                 | Worker               | What it serves                                                                                   |
| -------------------- | -------------------- | ------------------------------------------------------------------------------------------------ |
| `airexpay.com`       | `airexpay-marketing` | Marketing, pricing, waitlist. No dashboard or checkout code.                                     |
| `www.airexpay.com`   | same Worker          | Redirects to the apex.                                                                           |
| `app.airexpay.com`   | `airexpay-app`       | Merchant dashboard and onboarding. Validates the session server-side.                            |
| `pay.airexpay.com`   | `airexpay-pay`       | Hosted checkout and payment links. Public. Strips and ignores auth cookies.                      |
| `api.airexpay.com`   | `airexpay-api`       | Merchant REST API (API keys) and the NOWPayments IPN. Session checks are separate from API keys. |
| `auth.airexpay.com`  | `airexpay-auth`      | Login, signup, magic link, OAuth callback, logout, session refresh.                              |
| `docs.airexpay.com`  | `airexpay-docs`      | Static API docs.                                                                                 |
| `admin.airexpay.com` | `airexpay-admin`     | Scaffold only. Cloudflare Access plus an admin role. Access is not configured here.              |

## Staging

Staging never accepts the production cookie. Hosts use a `-staging` label, except marketing, which stays on the existing staging apex.

| Host                         | Worker                       |
| ---------------------------- | ---------------------------- |
| `staging.airexpay.com`       | `airexpay-marketing-staging` |
| `app-staging.airexpay.com`   | `airexpay-app-staging`       |
| `pay-staging.airexpay.com`   | `airexpay-pay-staging`       |
| `api-staging.airexpay.com`   | `airexpay-api-staging`       |
| `auth-staging.airexpay.com`  | `airexpay-auth-staging`      |
| `docs-staging.airexpay.com`  | `airexpay-docs-staging`      |
| `admin-staging.airexpay.com` | `airexpay-admin-staging`     |

Hosted checkout on staging moves from `https://staging.airexpay.com` to `https://pay-staging.airexpay.com`. `staging.airexpay.com` is the marketing host.

## DNS to add after approval

Do not create these records in this change. When the owner approves, attach Cloudflare Worker routes in the `airexpay.com` zone (proxied). Do not point the hosts at an origin IP.

| Name            | Route pattern                  | Worker                       |
| --------------- | ------------------------------ | ---------------------------- |
| `airexpay.com`  | `airexpay.com/*`               | `airexpay-marketing`         |
| `www`           | `www.airexpay.com/*`           | `airexpay-marketing`         |
| `app`           | `app.airexpay.com/*`           | `airexpay-app`               |
| `pay`           | `pay.airexpay.com/*`           | `airexpay-pay`               |
| `api`           | `api.airexpay.com/*`           | `airexpay-api`               |
| `auth`          | `auth.airexpay.com/*`          | `airexpay-auth`              |
| `docs`          | `docs.airexpay.com/*`          | `airexpay-docs`              |
| `admin`         | `admin.airexpay.com/*`         | `airexpay-admin`             |
| `staging`       | `staging.airexpay.com/*`       | `airexpay-marketing-staging` |
| `app-staging`   | `app-staging.airexpay.com/*`   | `airexpay-app-staging`       |
| `pay-staging`   | `pay-staging.airexpay.com/*`   | `airexpay-pay-staging`       |
| `api-staging`   | `api-staging.airexpay.com/*`   | `airexpay-api-staging`       |
| `auth-staging`  | `auth-staging.airexpay.com/*`  | `airexpay-auth-staging`      |
| `docs-staging`  | `docs-staging.airexpay.com/*`  | `airexpay-docs-staging`      |
| `admin-staging` | `admin-staging.airexpay.com/*` | `airexpay-admin-staging`     |

`admin.airexpay.com` also needs a Cloudflare Access application before anyone uses it. That application is not created here.

## Cookies

| Environment | Session cookie | CSRF cookie   | Domain                |
| ----------- | -------------- | ------------- | --------------------- |
| Production  | `ax_sess`      | `ax_csrf`     | `.airexpay.com`       |
| Staging     | `ax_sess_stg`  | `ax_csrf_stg` | `.airexpay.com`       |
| Dev         | `ax_sess_dev`  | `ax_csrf_dev` | host-only, not Secure |

Both session cookies are `HttpOnly`, `Secure` (except dev), and `SameSite=Lax`. The `__Host-` prefix is not used because that prefix forbids a Domain attribute.

`app-staging.airexpay.com` and `auth-staging.airexpay.com` have no parent narrower than `.airexpay.com`, so the staging cookie uses the same Domain and a different name. Production code ignores `ax_sess_stg`. Staging code ignores `ax_sess`. `pay.*` removes both before the handler runs and does not copy them onto the response.

The cookie holds the refresh token. Access tokens last 15 minutes and rotate with the refresh token. A reused refresh token revokes the session. Logout clears the cookies and revokes the server session.

State-changing browser requests need an allowlisted `Origin` and a matching `x-airexpay-csrf` header. Login redirects accept only the origins configured for that environment.

Live Supabase Auth is not called. The auth Worker uses an in-process simulation provider until the owner approves a hosted project.
