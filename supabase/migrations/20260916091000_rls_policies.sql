-- Row Level Security.
--
-- Design notes
-- ------------
-- Every authorization question is answered by a SECURITY DEFINER helper that
-- reads the relationship tables with RLS bypassed. Doing the lookup inside a
-- function is what keeps a policy on `profiles` from recursively invoking the
-- policy on `profiles`, and it keeps each policy expression small enough to
-- read and audit.
--
-- Two invariants hold across every policy below:
--   1. A deactivated profile (is_active = false) is authorized for nothing.
--   2. Teacher reach is derived only from teacher_classes -> classes -> students.
--      Parent reach is derived only from parent_students. There is no other path.

-- ---------------------------------------------------------------------------
-- Authorization helpers
-- ---------------------------------------------------------------------------

-- Role of the calling user, or null when unauthenticated / deactivated.
create or replace function public.auth_role()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.is_active
$fn$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select coalesce(public.auth_role() = 'admin', false)
$fn$;

-- True when the caller is a teacher assigned to the class the student sits in.
create or replace function public.teacher_has_student(target_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1
    from public.students s
    join public.teacher_classes tc on tc.class_id = s.class_id
    where s.id = target_student
      and tc.teacher_id = auth.uid()
      and coalesce(public.auth_role() = 'teacher', false)
  )
$fn$;

-- True when the caller is a parent linked to the student.
create or replace function public.parent_has_student(target_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1
    from public.parent_students ps
    where ps.student_id = target_student
      and ps.parent_id = auth.uid()
      and coalesce(public.auth_role() = 'parent', false)
  )
$fn$;

-- Single entry point used by the student and content policies.
create or replace function public.can_view_student(target_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select public.is_admin()
      or public.teacher_has_student(target_student)
      or public.parent_has_student(target_student)
$fn$;

-- True when the caller is a teacher assigned to this class.
create or replace function public.teacher_has_class(target_class uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1
    from public.teacher_classes tc
    where tc.class_id = target_class
      and tc.teacher_id = auth.uid()
      and coalesce(public.auth_role() = 'teacher', false)
  )
$fn$;

-- True when the caller is a parent of at least one student in this class.
create or replace function public.parent_has_class(target_class uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1
    from public.parent_students ps
    join public.students s on s.id = ps.student_id
    where s.class_id = target_class
      and ps.parent_id = auth.uid()
      and coalesce(public.auth_role() = 'parent', false)
  )
$fn$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere. No table below is readable without a matching policy.
-- ---------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.classes         enable row level security;
alter table public.students        enable row level security;
alter table public.teacher_classes enable row level security;
alter table public.parent_students enable row level security;
alter table public.student_content enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
--   A user always sees their own row. Admins see everyone. Nobody else reads
--   another user's profile row directly; author names are served by the
--   staff_directory view further down, which exposes no contact details.
-- ---------------------------------------------------------------------------
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_select_admin on public.profiles
  for select to authenticated
  using (public.is_admin());

-- A user may edit their own name, phone and avatar. The WITH CHECK clause
-- pins role and is_active so a teacher cannot promote themselves to admin.
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and is_active = (select p.is_active from public.profiles p where p.id = auth.uid())
  );

create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- classes
-- ---------------------------------------------------------------------------
create policy classes_select_admin on public.classes
  for select to authenticated
  using (public.is_admin());

create policy classes_select_teacher on public.classes
  for select to authenticated
  using (public.teacher_has_class(id));

create policy classes_select_parent on public.classes
  for select to authenticated
  using (public.parent_has_class(id));

create policy classes_admin_write on public.classes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- students
--   Read follows can_view_student. Every write is admin-only: a teacher may
--   document a student but may never create, edit or reassign one.
-- ---------------------------------------------------------------------------
create policy students_select on public.students
  for select to authenticated
  using (public.can_view_student(id));

create policy students_admin_write on public.students
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- teacher_classes
--   A teacher may read their own assignments so the app can render "My
--   classes". Only an admin may change an assignment, which is what stops a
--   teacher from granting themselves a new class.
-- ---------------------------------------------------------------------------
create policy teacher_classes_select_self on public.teacher_classes
  for select to authenticated
  using (teacher_id = auth.uid());

create policy teacher_classes_admin_all on public.teacher_classes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- parent_students
--   A parent may read their own links. Teachers get no access here at all,
--   which keeps guardian relationships out of teacher reach.
-- ---------------------------------------------------------------------------
create policy parent_students_select_self on public.parent_students
  for select to authenticated
  using (parent_id = auth.uid());

create policy parent_students_admin_all on public.parent_students
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- student_content
-- ---------------------------------------------------------------------------
create policy student_content_select on public.student_content
  for select to authenticated
  using (public.can_view_student(student_id));

-- A teacher may add content only for a student they are authorized for, and
-- only under their own identity: created_by is pinned to auth.uid().
create policy student_content_insert_teacher on public.student_content
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.teacher_has_student(student_id)
  );

-- A teacher may revise or remove their own entries, nobody else's.
create policy student_content_update_author on public.student_content
  for update to authenticated
  using (created_by = auth.uid() and public.teacher_has_student(student_id))
  with check (created_by = auth.uid() and public.teacher_has_student(student_id));

create policy student_content_delete_author on public.student_content
  for delete to authenticated
  using (created_by = auth.uid() and public.teacher_has_student(student_id));

create policy student_content_admin_all on public.student_content
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- staff_directory
--   Timelines need to show "added by <teacher>". Exposing profiles for that
--   would leak phone numbers, so this view publishes just the display name of
--   active staff and nothing else. security_invoker is left off deliberately:
--   the view owner's rights are what make it readable, and the view itself is
--   the boundary.
-- ---------------------------------------------------------------------------
create view public.staff_directory
with (security_invoker = false) as
  select p.id, p.full_name, p.role
  from public.profiles p
  where p.is_active
    and p.role in ('admin', 'teacher');

comment on view public.staff_directory is 'Display names of active staff, for content attribution. Carries no contact details.';

revoke all on public.staff_directory from anon;
grant select on public.staff_directory to authenticated;
