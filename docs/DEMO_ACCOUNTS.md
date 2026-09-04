# Local demo accounts

All demo accounts use the password `Demo123!` and are intended only for the local Supabase environment.

| Role | Email | Demonstrates |
| --- | --- | --- |
| Platform super admin | `superadmin@circular.demo` | Platform console and subscriber administration |
| Workspace owner | `owner@circular.demo` | Full workspace, team, spaces, events, and content authority |
| Workspace admin | `admin@circular.demo` | Day-to-day team, event, space, and content administration |
| Moderator | `moderator@circular.demo` | Community moderation without owner billing authority |
| Member | `member@circular.demo` | Publishing, commenting, reactions, event registration, and course access |
| Student | `student@circular.demo` | Member experience with seeded course progress |

The shared workspace is **Creator Collective Demo**. It includes public discussion and chat spaces, a private leadership space, a course space, realistic posts and replies, reactions, notifications, one upcoming event, two courses, five lessons, and student progress.

Recreate or refresh the demo data with:

```bash
npm run seed:demo
```
