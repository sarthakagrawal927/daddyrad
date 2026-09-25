# DaddyRad agent instructions

DaddyRad is the umbrella site for the daddy series of native macOS utilities.
`site/` is a small Cloudflare Worker (`daddyrad`) that serves a static landing
on `daddyrad.com` and redirects `www.daddyrad.com` and `context.daddyrad.com`.

Boundaries:

- The apex is the series landing only; each app owns its own subdomain and
  repository (`performance.`, `browser.`, `storage.` on daddyrad.com).
- `context.daddyrad.com` is a redirect to `daddyrad.com#contextdaddy` until
  ContextDaddy ships a public site — do not build a fake landing for it.
- Keep copy honest: no download links for apps without public releases.
- Deploy with `npm run deploy` from `site/` (wrangler). Do not commit, push,
  or release without explicit owner approval.
