# Phase 4: events

Phase 4 adds a complete tenant-scoped Events vertical at `/events`.

## Implemented

- Upcoming and past event views
- Administrator event creation, draft publishing, editing, cancellation, completion, and deletion
- Optional space association with cross-table tenant integrity
- Virtual, live-room, and in-person locations
- Event capacity and atomic member registration
- Member registration cancellation
- Administrator attendee lists and attendee removal
- Draft visibility restricted to owners and administrators
- Event audit logging and tenant-filtered realtime refresh
- Dashboard navigation into the real Events module

## Verification

```bash
npm run verify:phase4
npm run lint
npm run build
```

The verifier proves event administration authorization, member restrictions, draft privacy, registration, atomic capacity enforcement, attendee removal, and audit logging.

## Next increment

Build Courses with sections, lessons, enrollment, progress tracking, completion, and role-based authoring.
