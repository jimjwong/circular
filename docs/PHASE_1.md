# Phase 1: identity, tenancy, and access control

Phase 1 is implemented against the local Supabase stack.

## Account hierarchy

- Platform staff is stored in `platform_staff` and is deliberately separate from organization memberships.
- Each authenticated person has one `profiles` record.
- A person may belong to multiple organizations through `tenant_memberships`.
- Organization roles are `owner`, `admin`, `moderator`, and `member`.
- Platform roles are `super_admin`, `support_admin`, and `billing_admin`.

## Implemented workflows

- Email/password registration, sign-in, recovery, password update, and sign-out
- Cookie-based Supabase SSR sessions with claims verification in Next.js Proxy
- Protected application routes and server-side authorization checks
- Atomic organization creation and initial owner membership
- Multiple-organization switching using an HTTP-only active-tenant cookie
- Seven-day organization invitations with SHA-256 token storage
- Invitation acceptance restricted to the invited email address
- Role changes, suspension, member removal, and ownership transfer
- Organization statuses: trial, active, past due, suspended, and cancelled
- Separate local platform-owner account
- Immutable audit events for membership, invitation, organization, and ownership changes
- Postgres RLS and explicit grants with pgTAP isolation tests

## Local commands

```bash
pnpm supabase:start
pnpm supabase:reset
pnpm seed:local
pnpm test:db
pnpm verify:phase1
pnpm dev
```

Supabase Studio runs at `http://127.0.0.1:54523`. The local application is configured for `http://localhost:3001` because port 3000 is already used on this workstation.

## Local platform owner

- Email: `owner@circular.local`
- Password: `Circular123!`

These credentials are local development fixtures only and must never be used in a deployed environment.

## Security boundary

- UI visibility is not treated as authorization.
- Every Server Action re-verifies the current user and required organization role.
- RLS remains the final tenant-data boundary.
- The Supabase secret key exists only in `.env.local` and server-only modules.
- Invitation tokens are shown once to the inviter while only their hashes are stored.
- Super-admin console functionality is intentionally deferred to Phase 2; Phase 1 creates and verifies the platform role model and seeded owner account.
