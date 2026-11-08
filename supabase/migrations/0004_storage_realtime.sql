-- FarmLink storage buckets and realtime.
--
-- Buckets (private ones are read through signed URLs):
--   plot-photos       private  {plot_id}/{file}     plot photos and supporting documents
--   milestone-photos  private  {deal_id}/{file}     season updates and harvest photos
--   produce-photos    private  {user_id}/{file}     marketplace listings
--   avatars           public   {user_id}/{file}     profile pictures

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('plot-photos', 'plot-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('milestone-photos', 'milestone-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('produce-photos', 'produce-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- First folder of an object path as a uuid (null if it is not one)
create or replace function public.path_uuid(p_name text) returns uuid
language plpgsql immutable as $$
begin
  return (storage.foldername(p_name))[1]::uuid;
exception when others then
  return null;
end $$;

-- plot-photos: anyone who can see the plot can view; the owner uploads and deletes
create policy "plot-photos: view with plot" on storage.objects for select to authenticated
  using (bucket_id = 'plot-photos' and public.can_view_plot(public.path_uuid(name)));
create policy "plot-photos: owner uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'plot-photos' and exists (select 1 from public.plots p where p.id = public.path_uuid(name) and p.owner_id = auth.uid()));
create policy "plot-photos: owner deletes" on storage.objects for delete to authenticated
  using (bucket_id = 'plot-photos' and exists (select 1 from public.plots p where p.id = public.path_uuid(name) and p.owner_id = auth.uid()));

-- milestone-photos: deal viewers see them; the farmer uploads
create policy "milestone-photos: deal viewers" on storage.objects for select to authenticated
  using (bucket_id = 'milestone-photos' and public.can_view_deal(public.path_uuid(name)));
create policy "milestone-photos: farmer uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'milestone-photos' and exists (select 1 from public.deals d where d.id = public.path_uuid(name) and d.farmer_id = auth.uid()));

-- produce-photos: signed-in users view; sellers manage their own folder
create policy "produce-photos: signed-in view" on storage.objects for select to authenticated using (bucket_id = 'produce-photos');
create policy "produce-photos: own folder upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'produce-photos' and public.path_uuid(name) = auth.uid());
create policy "produce-photos: own folder delete" on storage.objects for delete to authenticated
  using (bucket_id = 'produce-photos' and public.path_uuid(name) = auth.uid());

-- avatars: public bucket; users manage their own folder
create policy "avatars: own folder upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and public.path_uuid(name) = auth.uid());
create policy "avatars: own folder update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and public.path_uuid(name) = auth.uid());
create policy "avatars: own folder delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and public.path_uuid(name) = auth.uid());

-- Realtime for chat and the notification bell. Realtime respects RLS, so users only
-- receive rows they are allowed to select.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
