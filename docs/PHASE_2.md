# Phase 2: platform operations

Phase 2 begins with the platform-owner control plane at `/platform`.

## Implemented in this increment

- Dedicated platform staff authorization in the server-side data access layer
- Automatic platform-owner routing after sign-in
- Cross-tenant organization and active-membership metrics
- Organization lifecycle visibility for trial, active, past due, suspended, and cancelled states
- Super-admin-only lifecycle updates with a required reason for restrictions
- Atomic lifecycle changes through a security-definer database function
- Audit events for every organization status change
- RLS policies that give active platform staff read access without granting tenant mutation access
- Local Starter, Professional, and Business plan catalog
- Versionable plan entitlements for members, spaces, administrators, storage, workflows, and AI agents
- One authoritative subscription record per organization with local billing-provider placeholders
- Automatic subscription creation for new organizations and synchronization with tenant lifecycle state
- Super-admin and billing-admin subscription controls for plan and status changes
- Monthly usage counters with automatic active-member metering
- Tenant-safe entitlement lookup through a database function
- Plan pricing, member-limit utilization, subscription status, and projected local MRR in the owner console

## Local verification

```bash
pnpm verify:phase1
pnpm verify:phase2
pnpm lint
pnpm build
```

Use the local platform owner credentials documented in `PHASE_1.md`, then open `http://localhost:3001/platform`.

## Next increment

Build the first real community vertical: space groups, spaces, posts, comments, and reactions backed by Supabase instead of demo arrays. Entitlements should be checked when creating spaces, and all content operations must retain tenant-scoped RLS.
