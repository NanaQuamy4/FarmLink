-- Removes the data created by the automated end-to-end browser checks.
-- Safe to run more than once. Run in the Supabase SQL editor.
-- (The two small test photos in storage can be deleted from Storage → plot-photos / milestone-photos.)

do $$
declare p uuid; d uuid; a uuid;
begin
  select id into p from plots where title = 'E2E test plot';
  if p is not null then
    select id, application_id into d, a from deals where plot_id = p;
    delete from notifications where link like '%' || coalesce(d::text, '-') || '%'
                                 or link like '%' || coalesce(a::text, '-') || '%'
                                 or link like '%' || p::text || '%';
    delete from deals where plot_id = p;                 -- agreements, milestones, harvest, ratings, disputes cascade
    delete from messages where application_id in (select id from applications where plot_id = p);
    delete from applications where plot_id = p;
    delete from plots where id = p;                      -- photos and verifications cascade
  end if;
  delete from messages where body in ('Automated check message', 'Realtime check, please ignore');
  delete from offers where message is null and quantity = 1 and price_per_unit = 10 and status = 'withdrawn';
end $$;
