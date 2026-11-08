-- FarmLink 0009: group chat like WhatsApp: @mentions, unread counts, and notifications.
-- Each member gets one "new messages" notification per group until they open the chat, and
-- a separate notification whenever someone @mentions them. Run once after 0008.

alter table public.group_members add column if not exists last_read_at timestamptz not null default now();
alter table public.messages add column if not exists mentions uuid[] not null default '{}';

-- Mentions must be members of the group (and not the sender); one-to-one chats have none
create or replace function public.messages_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then new.sender_id := auth.uid(); end if;
  new.read_at := null;
  if new.is_notice and not (public.is_group_leader(new.group_id) or public.is_admin()) then
    new.pinned := false;   -- members can post notices, only leaders pin them
  end if;
  if new.group_id is null then
    new.mentions := '{}';
  else
    new.mentions := coalesce((select array_agg(distinct m) from unnest(new.mentions) m
                              where m <> new.sender_id
                                and exists (select 1 from group_members g where g.group_id = new.group_id and g.user_id = m)), '{}');
  end if;
  return new;
end $$;

create or replace function public.messages_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare a public.applications; owner uuid; recipient uuid; gname text; sender_name text; v_link text;
begin
  sender_name := (select coalesce(group_name, full_name) from profiles where id = new.sender_id);

  -- one-to-one chat (application / deal)
  if new.application_id is not null then
    select * into a from applications where id = new.application_id;
    select owner_id into owner from plots where id = a.plot_id;
    recipient := case when new.sender_id = a.farmer_id then owner else a.farmer_id end;
    if not exists (select 1 from notifications where user_id = recipient and type = 'message' and read_at is null
                     and link = '/messages/' || new.application_id) then
      perform public.notify(recipient, 'message', 'New message', sender_name || ': ' || left(new.body, 80), '/messages/' || new.application_id);
    end if;
    return new;
  end if;

  -- group chat and notice board
  select name into gname from groups where id = new.group_id;
  v_link := '/groups/' || new.group_id;
  update group_members set last_read_at = now() where group_id = new.group_id and user_id = new.sender_id;

  -- @mentions: always their own notification
  insert into notifications (user_id, type, title, body, link)
  select m, 'mention', sender_name || ' mentioned you in ' || gname, left(new.body, 120), v_link
  from unnest(new.mentions) m;

  -- everyone else: one unread "new messages" notification per group at a time
  insert into notifications (user_id, type, title, body, link)
  select g.user_id, 'group_message',
         case when new.is_notice then 'New notice in ' || gname else 'New messages in ' || gname end,
         sender_name || ': ' || left(coalesce(new.notice_title || ' · ', '') || new.body, 100), v_link
  from group_members g
  where g.group_id = new.group_id and g.user_id <> new.sender_id and not (g.user_id = any (new.mentions))
    and not exists (select 1 from notifications n where n.user_id = g.user_id and n.type = 'group_message'
                      and n.link = v_link and n.read_at is null);
  return new;
end $$;

-- Opening the group chat marks it read (and clears its notifications)
create or replace function public.mark_group_read(p_group uuid)
returns void language sql security definer set search_path = public as $$
  update group_members set last_read_at = now() where group_id = p_group and user_id = auth.uid();
  update notifications set read_at = now()
  where user_id = auth.uid() and type in ('group_message', 'mention') and link = '/groups/' || p_group and read_at is null;
$$;

-- Unread messages per group for the signed-in member
create or replace function public.group_unread_counts()
returns table (group_id uuid, unread int) language sql stable security definer set search_path = public as $$
  select g.group_id, count(m.id)::int
  from group_members g
  left join messages m on m.group_id = g.group_id and m.created_at > g.last_read_at and m.sender_id <> g.user_id
  where g.user_id = auth.uid()
  group by g.group_id
$$;

-- Read markers are only changed through mark_group_read() and the message trigger, so members
-- cannot edit other group_members fields (such as making themselves leader).
