-- FarmLink 0006: Help & support. Any user opens a ticket; administrators reply in a thread.
-- Run once after 0005.

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in ('account', 'plot', 'deal', 'verification', 'session', 'marketplace', 'bug', 'other')),
  subject text not null check (char_length(subject) between 3 and 160),
  related_link text,                                   -- in-app page the problem is about, e.g. /deals/<id>
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists support_tickets_user_idx on public.support_tickets (user_id, last_message_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets (status, last_message_at desc);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  is_staff boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists support_messages_ticket_idx on public.support_messages (ticket_id, created_at);

-- New tickets always start open and belong to the person creating them
create or replace function public.support_tickets_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then new.user_id := auth.uid(); end if;
  new.status := 'open';
  new.last_message_at := now();
  return new;
end $$;
drop trigger if exists support_tickets_before_insert on public.support_tickets;
create trigger support_tickets_before_insert before insert on public.support_tickets for each row execute function public.support_tickets_before_insert();

-- Messages: who sent it decides is_staff; the ticket status follows the conversation
create or replace function public.support_messages_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare t public.support_tickets;
begin
  select * into t from support_tickets where id = new.ticket_id;
  if auth.uid() is not null then new.sender_id := auth.uid(); end if;
  -- a reply from an admin (who did not open the ticket) counts as staff; the after-insert trigger
  -- then marks the ticket answered, and a user reply (even on a closed ticket) reopens it
  new.is_staff := public.is_admin() and new.sender_id <> t.user_id;
  return new;
end $$;
drop trigger if exists support_messages_before_insert on public.support_messages;
create trigger support_messages_before_insert before insert on public.support_messages for each row execute function public.support_messages_before_insert();

create or replace function public.support_messages_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare t public.support_tickets; first boolean;
begin
  select * into t from support_tickets where id = new.ticket_id;
  first := not exists (select 1 from support_messages where ticket_id = t.id and id <> new.id);
  update support_tickets set last_message_at = now(),
         status = case when new.is_staff then 'answered' else 'open' end
  where id = t.id;
  if new.is_staff then
    perform public.notify(t.user_id, 'support_reply', 'Support replied', t.subject, '/help/' || t.id);
  else
    perform public.notify_admins('support_ticket', case when first then 'New support request' else 'Support request updated' end,
      (select full_name from profiles where id = t.user_id) || ': ' || t.subject, '/admin/support/' || t.id);
  end if;
  return new;
end $$;
drop trigger if exists support_messages_after_insert on public.support_messages;
create trigger support_messages_after_insert after insert on public.support_messages for each row execute function public.support_messages_after_insert();

-- Close or reopen: the person who opened it, or an admin
create or replace function public.set_ticket_status(p_ticket uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare t public.support_tickets;
begin
  select * into t from support_tickets where id = p_ticket;
  if not found then raise exception 'Ticket not found'; end if;
  if t.user_id <> auth.uid() and not public.is_admin() then raise exception 'Not your ticket'; end if;
  if p_status not in ('open', 'closed') then raise exception 'Status must be open or closed'; end if;
  update support_tickets set status = p_status where id = p_ticket;
  if p_status = 'closed' and public.is_admin() and t.user_id <> auth.uid() then
    perform public.notify(t.user_id, 'support_closed', 'Support request closed', t.subject, '/help/' || t.id);
  end if;
end $$;

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

create policy "tickets: own or admin read" on public.support_tickets for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "tickets: users open their own" on public.support_tickets for insert to authenticated
  with check (user_id = auth.uid());

create policy "support messages: ticket owner or admin read" on public.support_messages for select to authenticated
  using (public.is_admin() or exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid()));
create policy "support messages: ticket owner or admin write" on public.support_messages for insert to authenticated
  with check (sender_id = auth.uid() and (public.is_admin()
    or exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid())));

alter publication supabase_realtime add table public.support_messages;

-- Admin overview number
create or replace function public.open_support_count() returns int
language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then (select count(*)::int from support_tickets where status = 'open') else 0 end
$$;
