-- FarmLink 0007: hosts can upload their own session cover image.
-- Covers are public (they show on the session cards). Each user uploads into their own folder.
-- Run once after 0006.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('session-covers', 'session-covers', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "session-covers: anyone reads" on storage.objects;
create policy "session-covers: anyone reads" on storage.objects for select to anon, authenticated
  using (bucket_id = 'session-covers');

drop policy if exists "session-covers: hosts upload to own folder" on storage.objects;
create policy "session-covers: hosts upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'session-covers' and public.path_uuid(name) = auth.uid() and public.can_host_sessions());

drop policy if exists "session-covers: owners delete" on storage.objects;
create policy "session-covers: owners delete" on storage.objects for delete to authenticated
  using (bucket_id = 'session-covers' and public.path_uuid(name) = auth.uid());
