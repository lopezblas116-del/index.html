-- Run once in the SQL editor of a dedicated Supabase project.
create table if not exists public.islands_control (
  island_id text primary key,
  name text not null unique,
  faction text not null check (faction in ('Marina', 'Tirano', 'Tripulación')),
  owner_id uuid,
  owner_name text,
  taxes integer not null default 0 check (taxes between 0 and 100),
  chaos integer not null default 0 check (chaos between 0 and 100)
);
create table if not exists public.global_events (
  event_id text primary key,
  type text not null,
  text text not null,
  location text,
  created_at timestamptz not null default now()
);
create table if not exists public.bounties_leaderboard (
  captain_id text primary key,
  owner_id uuid not null,
  name text not null,
  bounty bigint not null check (bounty between 0 and 1000000000000),
  yonkou boolean not null default false
);
create table if not exists public.fallen_captains (
  captain_id text primary key,
  owner_id uuid not null,
  name text not null,
  island text,
  cause text,
  maps jsonb not null default '[]'::jsonb,
  notes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.bosses (
  name text primary key,
  status text not null check (status in ('active', 'imprisoned', 'fugitive')),
  island_id text references public.islands_control(island_id)
);
create table if not exists public.world_action_receipts (
  event_id text primary key,
  owner_id uuid not null,
  created_at timestamptz not null default now()
);
create table if not exists public.boss_secret_locations (
  name text primary key references public.bosses(name),
  x integer not null,
  y integer not null
);

alter table public.islands_control enable row level security;
alter table public.global_events enable row level security;
alter table public.bounties_leaderboard enable row level security;
alter table public.fallen_captains enable row level security;
alter table public.bosses enable row level security;
alter table public.world_action_receipts enable row level security;
alter table public.boss_secret_locations enable row level security;

grant select on public.islands_control, public.global_events, public.bounties_leaderboard, public.fallen_captains, public.bosses to authenticated;
revoke all on public.world_action_receipts, public.boss_secret_locations from anon, authenticated;

create policy "read islands" on public.islands_control for select to authenticated using (true);
create policy "read events" on public.global_events for select to authenticated using (true);
create policy "read bounties" on public.bounties_leaderboard for select to authenticated using (true);
create policy "read fallen" on public.fallen_captains for select to authenticated using (true);
create policy "read bosses" on public.bosses for select to authenticated using (true);

insert into public.islands_control (island_id, name, faction) values
('dawn','Isla Dawn','Marina'),('shells','Shells Town','Marina'),
('orange','Orange Town','Tirano'),('syrup','Villa Syrup','Marina'),
('baratie','Baratie','Marina'),('arlong','Arlong Park','Tirano'),
('loguetown','Loguetown','Marina'),('ohara','Isla Ohara','Marina'),
('kano','Isla Kano','Tirano'),('flevance','Isla Flevance','Marina'),
('minion','Isla Minion','Tirano'),('swallow','Isla Swallow','Marina'),
('torino','Isla Torino','Marina'),('baterilla','Baterilla','Marina'),
('karate','Isla Karate','Tirano'),('reverse','Reverse Mountain','Marina'),
('whiskey','Whiskey Peak','Tirano'),('water7','Water 7','Marina'),
('ennies','Enies Lobby','Marina'),('sabaody','Archipiélago Sabaody','Marina'),
('wano','Wano','Tirano'),('onyigashima','Onigashima','Tirano'),
('paradise','Paraíso','Marina'),('new-world','Nuevo Mundo','Tirano')
on conflict (island_id) do nothing;
insert into public.bosses (name, status, island_id) values ('Arlong', 'active', 'arlong') on conflict do nothing;

create or replace function public.apply_world_action(action jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  v_event_id text := action->>'event_id';
  kind text := action->>'type';
  data jsonb := action->'data';
  captain text := left(action->'actor'->>'name', 24);
  island public.islands_control%rowtype;
  message text;
  money bigint;
begin
  if uid is null then raise exception 'authentication required'; end if;
  if v_event_id is null or length(v_event_id) > 80 or captain is null or length(captain) = 0
    or kind not in ('mission','battle','contract','whisper','bounty','death','boss_defeated')
    or jsonb_typeof(data) <> 'object' or length(action::text) > 12000 then
    raise exception 'invalid action';
  end if;
  insert into public.world_action_receipts values (v_event_id, uid, now()) on conflict do nothing;
  if not found then return; end if;

  if kind = 'mission' then
    select * into island from public.islands_control where name = data->>'island' for update;
    if not found or data->>'faction' not in ('Pirata', 'Marine', 'Aventurero', 'Revolucionario') then raise exception 'invalid island or faction'; end if;
    update public.islands_control set
      faction = case when data->>'faction' = 'Marine' then 'Marina' else 'Tripulación' end,
      owner_id = case when data->>'faction' = 'Marine' then null else uid end,
      owner_name = case when data->>'faction' = 'Marine' then null else captain end,
      chaos = case when data->>'faction' = 'Marine' then 0 else least(100, chaos + 35) end
      where island_id = island.island_id returning * into island;
    message := format('⚓ %s completa una misión en %s.', captain, island.name);
    if island.chaos >= 70 then
      update public.islands_control set faction = 'Marina', owner_id = null, owner_name = null, chaos = 0 where island_id = island.island_id;
      message := format('⚓ Buster Call: la Marina recupera %s.', island.name);
    end if;
    if island.island_id = 'arlong' then
      update public.bosses set status = 'imprisoned' where name = 'Arlong' and status = 'active';
      if found then message := '⚓ Arlong ha sido encarcelado.'; end if;
    end if;
  elsif kind = 'bounty' then
    if data->>'captain_id' is null or length(data->>'captain_id') > 80 or data->>'bounty' !~ '^[0-9]{1,13}$' then raise exception 'invalid bounty'; end if;
    money := (data->>'bounty')::bigint;
    if money > 1000000000000 then raise exception 'invalid bounty'; end if;
    insert into public.bounties_leaderboard (captain_id, owner_id, name, bounty)
      values (data->>'captain_id', uid, captain, money)
      on conflict (captain_id) do update set name = excluded.name, bounty = excluded.bounty
      where public.bounties_leaderboard.owner_id = uid;
    if not found then raise exception 'captain belongs to another account'; end if;
    if money > 1000000000 and (select count(*) from public.islands_control where owner_id = uid) >= 2 then
      update public.bounties_leaderboard set yonkou = true where captain_id = data->>'captain_id' and not yonkou;
      if found then message := format('👑 %s es declarado YONKOU por el Gobierno.', captain); end if;
    end if;
  elsif kind = 'death' then
    if data->>'captain_id' is null or length(data->>'captain_id') > 80 or jsonb_typeof(data->'maps') <> 'array' or jsonb_typeof(data->'notes') <> 'array' then raise exception 'invalid legacy'; end if;
    if exists (select 1 from public.bounties_leaderboard where captain_id = data->>'captain_id' and owner_id <> uid) then raise exception 'captain belongs to another account'; end if;
    insert into public.fallen_captains (captain_id, owner_id, name, island, cause, maps, notes)
      values (data->>'captain_id', uid, captain, left(data->>'island', 80), left(data->>'cause', 120), data->'maps', data->'notes')
      on conflict (captain_id) do nothing;
    message := format('☠ %s ha caído. Su legado permanece en el Panteón.', captain);
  elsif kind = 'boss_defeated' then
    if data->>'boss' <> 'Arlong' or data->>'x' !~ '^[0-9]{1,4}$' or data->>'y' !~ '^[0-9]{1,3}$' then raise exception 'invalid boss encounter'; end if;
    update public.bosses set status = 'imprisoned'
      where name = data->>'boss' and status = 'fugitive'
      and exists (select 1 from public.boss_secret_locations where name = data->>'boss'
        and (x - (data->>'x')::integer)^2 + (y - (data->>'y')::integer)^2 <= 2500);
    if found then
      delete from public.boss_secret_locations where name = data->>'boss';
      message := format('⚓ %s vuelve a presidio tras enfrentarse a %s.', data->>'boss', captain);
    end if;
  elsif kind = 'battle' then message := format('⚔ %s protagoniza un combate.', captain);
  elsif kind = 'contract' then message := format('📜 %s %s un contrato.', captain, case when data->>'completed' = 'true' then 'completa' else 'acepta' end);
  elsif kind = 'whisper' then message := format('🗣️ %s escucha un susurro.', captain);
  end if;
  if message is not null then
    insert into public.global_events (event_id, type, text, location)
      values (v_event_id, kind, message, left(data->>'island', 80));
  end if;
end $$;
revoke all on function public.apply_world_action(jsonb) from public, anon;
grant execute on function public.apply_world_action(jsonb) to authenticated;

create or replace function public.scout_fugitive(p_x integer, p_y integer)
returns text language sql security definer set search_path = public, pg_temp as $$
  select b.name from public.bosses b join public.boss_secret_locations s on s.name = b.name
  where auth.uid() is not null and p_x between 0 and 1200 and p_y between 0 and 760
    and b.status = 'fugitive' and (s.x - p_x)^2 + (s.y - p_y)^2 <= 2500 limit 1
$$;
revoke all on function public.scout_fugitive(integer, integer) from public, anon;
grant execute on function public.scout_fugitive(integer, integer) to authenticated;

-- Schedule this as the database owner with pg_cron; it is not callable by players.
create or replace function public.advance_world_cycle()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare boss record;
begin
  for boss in select * from public.bosses where status = 'imprisoned' for update loop
    if random() < 0.02 then
      update public.bosses set status = 'fugitive', island_id = null where name = boss.name;
      insert into public.boss_secret_locations (name, x, y)
        values (boss.name, floor(random() * 1200)::integer, floor(random() * 760)::integer)
        on conflict (name) do update set x = excluded.x, y = excluded.y;
      insert into public.global_events (event_id, type, text)
        values ('escape-' || gen_random_uuid(), 'escape', format('🚨 Edición especial: %s escapó de prisión y opera en paradero desconocido.', boss.name));
    end if;
  end loop;
end $$;
revoke all on function public.advance_world_cycle() from public, anon, authenticated;
