-- Private storage for student media.
--
-- Layout: students/{student_id}/images/{filename}
--         students/{student_id}/videos/{filename}
--
-- The student id is embedded in the object path, so the same helpers that
-- guard the tables also guard the bytes. Nothing in this bucket is public and
-- no permanent public URL is ever issued: the app serves media through
-- short-lived signed URLs minted only after an authorization check.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-media',
  'student-media',
  false,
  104857600, -- 100 MB ceiling; per-type limits are enforced in app validation
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Pull the student id out of an object path, returning null rather than
-- raising when the path does not match the expected layout. A malformed path
-- therefore authorizes nobody instead of erroring the whole query.
create or replace function public.student_id_from_storage_path(object_name text)
returns uuid
language plpgsql
immutable
as $fn$
declare
  parts text[];
begin
  parts := storage.foldername(object_name);
  if array_length(parts, 1) is null or array_length(parts, 1) < 2 then
    return null;
  end if;
  if parts[1] <> 'students' then
    return null;
  end if;
  return parts[2]::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Object policies. Each mirrors the corresponding table policy.
-- ---------------------------------------------------------------------------

create policy student_media_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'student-media'
    and public.can_view_student(public.student_id_from_storage_path(name))
  );

create policy student_media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'student-media'
    and (
      public.is_admin()
      or public.teacher_has_student(public.student_id_from_storage_path(name))
    )
  );

create policy student_media_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'student-media'
    and (
      public.is_admin()
      or public.teacher_has_student(public.student_id_from_storage_path(name))
    )
  );

create policy student_media_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'student-media'
    and (
      public.is_admin()
      or public.teacher_has_student(public.student_id_from_storage_path(name))
    )
  );
