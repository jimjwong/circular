# Commune local email service

listmonk runs as Commune's campaign engine. Commune remains the source of truth for tenants, members, roles, campaign drafts, and recipient snapshots.

## Local setup

1. Copy `.env.listmonk.example` to `.env.listmonk` and choose a strong local admin password.
2. Add the server-only `LISTMONK_*` values from `.env.example` to `.env.local`.
3. Start Supabase, then run `npm run email:up`.
4. Run `npm run email:configure` to create the dedicated API user and point SMTP at Supabase Mailpit.
5. Run `npm run verify:email`.

Commune is at `/email`. Use its **Open listmonk** link so the current browser hostname or Tailscale address is preserved. Locally delivered messages are visible at the Mailpit address shown by `npm run supabase:status`.

## Production boundary

Do not expose listmonk directly to community members. Keep its API token server-only, place the admin UI behind TLS and access controls, and replace Mailpit SMTP with a dedicated delivery provider. Verify the sending domain with SPF, DKIM, and DMARC before enabling real delivery.
