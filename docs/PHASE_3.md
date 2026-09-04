# Phase 3: community core

Phase 3 starts the first fully database-backed product vertical at `/community`.

## Implemented

- Tenant-scoped discussion and chat spaces
- Automatic General space for every new and existing organization
- Plan-entitlement enforcement when administrators create spaces
- Published posts stored as structured JSON content
- Member comments and post reactions
- Author and moderator post deletion
- Cross-table tenant integrity constraints for spaces, posts, comments, and reactions
- RLS policies for member participation, author ownership, and moderator authority
- Atomic reaction toggling and audited space creation
- Live member entitlement, space, post, comment, and reaction data in the UI
- Dashboard navigation from Spaces and Posts into the real community application
- Private spaces with explicit grants for existing organization members
- Dedicated administrator settings for space identity, type, and visibility
- Post editing for authors and organization administrators
- Post pinning for owners, administrators, and moderators
- Comment removal for authors and moderators
- Ten-post feed pagination with pinned content ordered first
- Private tenant-scoped media attachments backed by Supabase Storage
- Signed attachment links with author and moderator deletion controls
- Nested replies with parent-comment integrity enforced in the database
- In-app notifications for comments, replies, and reactions
- Tenant-filtered realtime refresh for community activity

## Verification

```bash
pnpm verify:phase3
pnpm lint
pnpm build
```

The verifier proves that an administrator can create a space, a regular member cannot administer spaces, private content is denied until access is granted, and members can publish, edit, comment, and react. It also verifies moderator pinning, comment removal, nested replies, private signed media, and activity notifications.

## Next increment

Start the events vertical: event authoring, tenant-aware registration, capacity controls, attendee management, and an upcoming-events member view.
