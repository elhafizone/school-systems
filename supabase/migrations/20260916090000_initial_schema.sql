-- School Student Tracking System - core schema
-- Roles, classes, students, relationships and unified student content.

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'teacher', 'parent');
create type public.content_type as enum ('image', 'video', 'note');
create type public.student_gender as enum ('male', 'female');

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- profiles : one row per authenticated user
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text        not null check (length(btrim(full_name)) between 2 and 120),
  role        public.user_role not null,
  phone       text        check (phone is null or length(btrim(phone)) between 5 and 30),
  avatar_url  text,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.profiles is 'Application profile for an authenticated Supabase user. id always equals auth.users.id.';

create index profiles_role_idx on public.profiles (role) where is_active;
create index profiles_name_trgm_idx on public.profiles using gin (full_name gin_trgm_ops);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- classes
-- ---------------------------------------------------------------------------
create table public.classes (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(btrim(name)) between 1 and 80),
  grade         text not null check (length(btrim(grade)) between 1 and 40),
  academic_year text not null check (academic_year ~ '^[0-9]{4}-[0-9]{4}$'),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint classes_unique_per_year unique (name, academic_year)
);
comment on column public.classes.academic_year is 'Format YYYY-YYYY, e.g. 2026-2027.';

create index classes_active_idx on public.classes (academic_year, grade) where is_active;

create trigger classes_set_updated_at
  before update on public.classes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------------
create table public.students (
  id            uuid primary key default gen_random_uuid(),
  student_code  text not null unique check (student_code ~ '^[A-Za-z0-9_-]{3,32}$'),
  full_name     text not null check (length(btrim(full_name)) between 2 and 120),
  -- Bounds only. current_date is not immutable and Postgres will not accept a
  -- non-immutable expression in a CHECK constraint; "not in the future" is
  -- enforced by the Zod schema on the way in.
  date_of_birth date check (date_of_birth is null or date_of_birth between '1990-01-01' and '2100-01-01'),
  gender        public.student_gender,
  class_id      uuid references public.classes (id) on delete set null,
  photo_url     text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on column public.students.photo_url is 'Storage path of the profile photo inside the private student-media bucket, never a permanent public URL.';

create index students_class_idx on public.students (class_id) where is_active;
create index students_name_trgm_idx on public.students using gin (full_name gin_trgm_ops);

create trigger students_set_updated_at
  before update on public.students
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- teacher_classes : many-to-many, the basis of teacher authorization
-- ---------------------------------------------------------------------------
create table public.teacher_classes (
  id         uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  class_id   uuid not null references public.classes (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint teacher_classes_unique unique (teacher_id, class_id)
);
comment on table public.teacher_classes is 'Authoritative teacher to class assignment. All teacher access derives from this table.';

create index teacher_classes_teacher_idx on public.teacher_classes (teacher_id);
create index teacher_classes_class_idx on public.teacher_classes (class_id);

-- ---------------------------------------------------------------------------
-- parent_students : many-to-many, the basis of parent authorization
-- ---------------------------------------------------------------------------
create table public.parent_students (
  id           uuid primary key default gen_random_uuid(),
  parent_id    uuid not null references public.profiles (id) on delete cascade,
  student_id   uuid not null references public.students (id) on delete cascade,
  relationship text not null default 'guardian' check (length(btrim(relationship)) between 2 and 40),
  created_at   timestamptz not null default now(),
  constraint parent_students_unique unique (parent_id, student_id)
);
comment on table public.parent_students is 'Authoritative parent to student link. All parent access derives from this table.';

create index parent_students_parent_idx on public.parent_students (parent_id);
create index parent_students_student_idx on public.parent_students (student_id);

-- ---------------------------------------------------------------------------
-- student_content : unified timeline of photos, videos and notes
-- ---------------------------------------------------------------------------
create table public.student_content (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.students (id) on delete cascade,
  created_by     uuid not null references public.profiles (id) on delete restrict,
  content_type   public.content_type not null,
  title          text check (title is null or length(btrim(title)) between 1 and 160),
  description    text check (description is null or length(description) <= 4000),
  storage_path   text,
  thumbnail_path text,
  file_size      bigint check (file_size is null or file_size > 0),
  mime_type      text,
  created_at     timestamptz not null default now(),

  -- Media must carry a storage path; a note carries text and no path.
  constraint student_content_media_requires_path check (
    (content_type in ('image', 'video') and storage_path is not null and mime_type is not null)
    or (content_type = 'note' and storage_path is null and thumbnail_path is null)
  ),
  constraint student_content_note_requires_body check (
    content_type <> 'note' or length(btrim(coalesce(description, ''))) > 0
  )
);
comment on table public.student_content is 'Single timeline table for image, video and note content attached to a student.';

-- Primary access pattern: one student timeline, newest first.
create index student_content_student_created_idx
  on public.student_content (student_id, created_at desc);
-- Admin content browser filters by author, by type and by date.
create index student_content_created_by_idx on public.student_content (created_by, created_at desc);
create index student_content_type_created_idx on public.student_content (content_type, created_at desc);
