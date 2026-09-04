# Circular

Circular is a local-first, multi-tenant community SaaS prototype inspired by the product breadth of Circle. It combines community, courses, events, live experiences, CRM, email, workflows, AI agents, a website builder, payments, and analytics in one responsive Next.js application.

## Run locally

```bash
pnpm install
pnpm dev
```

For the complete local authenticated environment:

```bash
pnpm supabase:start
pnpm supabase:reset
pnpm seed:local
pnpm dev
```

Open `http://localhost:3001` on this workstation. Supabase Studio is available at `http://127.0.0.1:54523`. No cloud account is required.

## Supabase setup

1. Copy `.env.example` to `.env.local` and add the URL and anonymous key from a Supabase project.
2. Install the Supabase CLI if needed, then run the migration in `supabase/migrations/0001_initial_schema.sql` against your local or hosted project.
3. Enable your preferred Supabase Auth providers. Phase 1 currently implements email/password authentication and password recovery.

The schema uses `tenant_id` on domain tables, membership-based helper functions, and row-level-security policies. Do not bypass RLS from client code. Sensitive integrations such as Stripe, email delivery, webhooks, and AI calls should run from server routes or Supabase Edge Functions using idempotency keys and audit logs.

## Architecture

- Next.js 16 App Router and React 19
- Tailwind CSS 4
- Supabase Auth, Postgres, RLS, Storage, and Realtime-ready schema
- Local demo state so product work is not blocked on credentials
- Tenant-aware foundation for owner, admin, moderator, and member roles

See `docs/PRODUCT_MAP.md` for the researched feature inventory and implementation boundary.

See `docs/PHASE_1.md` for the implemented account hierarchy, security model, local platform-owner fixture, commands, and verification coverage.

See `docs/PHASE_2.md` for the platform-owner console, cross-tenant operations, and the next subscriber-management increment.

See `docs/PHASE_3.md` for the database-backed community spaces, posts, comments, reactions, and permission model.
