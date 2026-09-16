# School Student Tracking

A private web portal that lets school staff document students with photos, videos and
notes, and lets each parent follow only their own children.

Built for an elementary school. Works on phones, tablets and desktops. This is a web
application, not a native mobile app.

---

## Contents

- [What it does](#what-it-does)
- [Stack](#stack)
- [Architecture](#architecture)
- [Database](#database)
- [Roles and permissions](#roles-and-permissions)
- [Security model](#security-model)
- [Local development](#local-development)
- [Environment variables](#environment-variables)
- [Supabase setup](#supabase-setup)
- [Storage](#storage)
- [Testing](#testing)
- [Deployment](#deployment)
- [Moving to the school's own domain](#moving-to-the-schools-own-domain)
- [Admin guide](#admin-guide)
- [Known limitations](#known-limitations)

---

## What it does

| Role | Can do |
| --- | --- |
| **Admin** | Manage students, classes, teachers and parents. Assign teachers to classes, link parents to children. See all content. Search and filter everything. |
| **Teacher** | See their assigned classes and those students only. Add photos, videos and notes to a student's timeline. |
| **Parent** | See only their own children, read-only: profile, photos, videos and notes. |

The workflow the product is tuned for is the teacher's: **sign in → pick a class → pick a
student → take or choose a photo → optionally add a note → save.**

---

## Stack

- **Next.js 16** (App Router, Server Components, Server Actions)
- **React 19**, **TypeScript**
- **Supabase** — PostgreSQL, Auth, Storage
- **Tailwind CSS 4**
- **Zod** for server-side validation

No separate backend service and no ORM. The app talks to Supabase directly; Postgres
Row Level Security is the authorization boundary.

---

## Architecture

```
Browser
   │
   ▼
Next.js (Hostinger, Node.js runtime)
   │  Server Components, Server Actions, proxy session refresh
   │
   ├── Supabase Auth       — sessions, password sign-in
   ├── Supabase PostgreSQL — all data, protected by RLS
   └── Supabase Storage    — private bucket, short-lived signed URLs
```

Directory layout:

```
app/              routes: login, admin, teacher, parent
components/       UI primitives and feature components
lib/
  auth/           session + role gates
  permissions/    centralized authorization helpers
  supabase/       server / browser / service-role clients
  storage/        upload rules, signed URLs
  validation/     Zod schemas
  data/           read queries
supabase/
  migrations/     schema, RLS policies, storage setup
scripts/seed.mjs  fictional demo data
tests/            authorization + RLS test suite
```

---

## Database

Six tables, defined in `supabase/migrations/`.

| Table | Purpose |
| --- | --- |
| `profiles` | One row per auth user. `id` equals `auth.users.id`. Holds name, role, phone, active flag. |
| `classes` | Class name, grade, academic year. |
| `students` | Student record, optional class, optional photo path. |
| `teacher_classes` | Many-to-many. **The sole basis of teacher authorization.** |
| `parent_students` | Many-to-many with a relationship label. **The sole basis of parent authorization.** |
| `student_content` | One unified timeline table for `image`, `video` and `note`. |

Notes on the design:

- `student_content` is deliberately one table rather than three. A timeline is a single
  ordered list, and constraints enforce the difference: media rows must carry a
  `storage_path` and `mime_type`, note rows must carry text and no path.
- A teacher is **not** stored on the student row. Authorization always runs
  `teacher_classes → classes → students`, so reassigning a class moves access with it.
- Indexes cover the real access paths: student by class, student/profile name (trigram,
  for search), both relationship tables in both directions, and
  `student_content (student_id, created_at desc)` for the timeline.

---

## Roles and permissions

Roles are a Postgres enum: `admin`, `teacher`, `parent`.

After signing in, each role lands on its own area:

| Role | Home |
| --- | --- |
| admin | `/admin` |
| teacher | `/teacher` |
| parent | `/parent` |

Reaching another role's area redirects you to your own. Deactivating a profile
(`is_active = false`) revokes all access immediately — the RLS helper `auth_role()`
returns null for an inactive profile, so every policy fails closed.

---

## Security model

Authorization is enforced in three independent places. The database is the one that counts.

1. **Row Level Security** — every table has RLS enabled. Teacher reach derives only from
   `teacher_classes`; parent reach only from `parent_students`. Policy logic lives in
   `SECURITY DEFINER` helper functions (`is_admin()`, `teacher_has_student()`,
   `parent_has_student()`, `can_view_student()`), which both avoids policy recursion and
   keeps each policy short enough to audit.
2. **Server-side checks** — `lib/permissions` re-checks through the session-bound client
   before any mutation. Unauthorized and non-existent both produce a plain 404, so a
   hand-edited UUID in the URL reveals nothing about who exists.
3. **UI** — hides what you cannot use. This is convenience only and is never relied on.

Additional measures:

- `created_by` on content is pinned to `auth.uid()` by policy, so authorship cannot be spoofed.
- Role and `is_active` are pinned in the self-update policy, so a teacher cannot promote
  themselves to admin.
- The service-role key is used in exactly one action (provisioning teacher/parent auth
  users) and is guarded by `server-only`, which turns an accidental client import into a
  build error.
- Every page sends `X-Robots-Tag: noindex, nofollow`, plus `nosniff`, `X-Frame-Options:
  DENY` and a strict `Referrer-Policy`.
- Sign-out is POST-only, so a third-party image tag cannot log a user out.
- Login failures are deliberately vague — a wrong password, an unknown address and a
  deactivated account give the same message, so the form cannot be used to discover
  whether a family has an account.

---

## Local development

Requires Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local     # then fill in the values
npm run dev
```

Then apply the migrations and seed demo data — see [Supabase setup](#supabase-setup).

Useful scripts:

```bash
npm run dev            # development server
npm run build          # production build
npm run typecheck      # tsc --noEmit
npm run seed           # fictional demo data
npm run test:security  # authorization + RLS suite
```

---

## Environment variables

Copy `.env.example` to `.env.local`. Never commit a filled-in copy.

| Name | Reaches browser | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Publishable key. Safe to expose — RLS is what protects the data. |
| `SUPABASE_SERVICE_ROLE_KEY` | **no** | Bypasses RLS. Server-side only. Never prefix with `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_SITE_URL` | yes | Canonical origin, no trailing slash. The only place the domain is written down. |

---

## Supabase setup

1. Create a Supabase project.
2. Apply the migrations in `supabase/migrations/`, in filename order. Either paste each
   file into the SQL editor, or use the CLI:

   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```

   This creates the tables, the RLS policies and the private `student-media` bucket.
3. Under **Authentication → URL Configuration**, set the Site URL to your
   `NEXT_PUBLIC_SITE_URL` and add it to the redirect allowlist.
4. Seed fictional demo data and create the first accounts:

   ```bash
   npm run seed
   ```

   This creates one admin, two teachers, two parents, three classes and six students, all
   invented. **Change or remove these accounts before the school uses the system.**

To create a real first administrator instead, add the user in the Supabase Auth dashboard,
then insert their profile:

```sql
insert into public.profiles (id, full_name, role)
values ('<the-new-auth-user-uuid>', 'Head Teacher Name', 'admin');
```

Teacher and parent accounts are created from inside the app, by an admin.

---

## Storage

One private bucket, `student-media`:

```
students/{student_id}/images/{uuid}.{ext}
students/{student_id}/videos/{uuid}.{ext}
```

- The bucket is **not public**, and no permanent public URL is ever issued. Media is shown
  through signed URLs that expire after 10 minutes, minted only after the storage policy
  has checked the caller against the student in the path.
- The database stores the storage **path**, never a URL.
- Uploads: images up to 10 MB (JPEG, PNG, WebP, HEIC), videos up to 100 MB (MP4, MOV,
  WebM). Three checks must agree — declared MIME type on the allowlist, extension mapping
  to that same type, and size — and the bucket re-enforces type and size server-side.
- The filename from the client is discarded. Objects are named with a fresh UUID plus an
  extension from our own allowlist, which makes path traversal and collisions structurally
  impossible rather than something to filter for.
- After upload, size and MIME type are read back **from storage** before the row is
  written, so the database records what was actually stored, not what the browser claimed.

---

## Testing

```bash
npm run seed
npm run test:security
```

`tests/security.test.mjs` signs in as real seeded users with the same publishable key the
browser holds, then asks the database directly for other people's rows. Nothing in it goes
through application code, so no assertion can be satisfied by a UI that merely hides a
button. It covers sign-in and sign-out, anonymous access, teacher reach, parent reach,
privilege escalation, storage isolation and admin access.

---

## Deployment

Hostinger, Node.js runtime, default Next.js build output started with `next start`.

| Setting | Value |
| --- | --- |
| App type | `next` |
| Node version | 22 |
| Build command | `npm run build` |
| Package manager | npm |
| Root directory | `.` (public_html) |

`output: 'standalone'` is deliberately **not** used: Hostinger starts the app with
`next start`, which refuses to run against a standalone build.

Environment variables are set in the Hostinger Node.js app configuration, not in a file.

> **Important:** Next.js bakes `NEXT_PUBLIC_*` values into the build. After changing any
> environment variable, start a **new build** — restarting the process is not enough.

---

## Moving to the school's own domain

Nothing in the application code knows the domain. Migration is configuration only —
the full checklist is in [`docs/domain-migration.md`](docs/domain-migration.md).

---

## Admin guide

**Add a class** — Classes → fill in name, grade and academic year (`2026-2027`) → Add class.

**Add a teacher** — Teachers → name, email, a temporary password of at least 10
characters → Create. Give them the password in person or by phone, never by email. Then
open the class and assign them. *A teacher sees nothing until they are assigned a class.*

**Add a student** — Students → Add student. The student code is the school's own reference
and must be unique.

**Add a parent** — Parents → create the account, then use *Link to student* under that
parent to connect each child. *A parent sees nothing until a child is linked.* Linking is
the single action that grants sight of a child's photos, so review the list under each
parent regularly.

**Remove someone's access** — Deactivate the account, or remove the specific link. Both
take effect immediately.

**Deactivating vs deleting** — There is no delete. Deactivating a student hides them from
teachers and parents while preserving their timeline, which is usually what a school
record needs.

---

## Known limitations

- **Video is stored and played as uploaded.** There is no transcoding, compression or
  thumbnail generation. A 100 MB phone video is served as a 100 MB file, so playback over
  a slow connection depends on the viewer's bandwidth. Adding a transcoding pipeline was
  deliberately left out of this version as disproportionate to the need.
- **Upload validation checks type, extension and size, not file contents.** Media is
  uploaded straight from the browser to Supabase Storage so that a large video never
  passes through the application server. That means the server does not see the bytes and
  cannot inspect magic numbers. The exposure is bounded: only authenticated staff can
  upload, the bucket enforces its own MIME allowlist, the bucket is private, and media is
  only ever served to already-authorized viewers.
- **Upload progress is indeterminate.** The Supabase JS client does not report progress
  for storage uploads, so long video uploads show an activity message rather than a
  percentage.
- **No password reset flow.** Admins issue and re-issue passwords. Self-service reset needs
  email delivery to be configured, which is out of scope for this version.
- **Signed URLs last 10 minutes.** A page left open longer than that will show broken media
  until it is reloaded.
- **Database types are hand-maintained** in `lib/types/database.ts`. Regenerate with
  `npx supabase gen types typescript --project-id <ref>` after any schema change.
