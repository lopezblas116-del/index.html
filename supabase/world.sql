-- Apply in a dedicated Supabase project; safe to re-run for schema updates.
create table if not exists public.islands_control (
  island_id text primary key,
  name text not null unique,
  faction text not null check (faction in ('Marina', 'Tirano', 'Tripulación')),
  owner_id uuid,
  owner_name text,
  taxes integer not null default 0 check (taxes between 0 and 100),
  chaos integer not null default 0 check (chaos between 0 and 100),
  affiliated boolean not null default false
);
alter table public.islands_control add column if not exists affiliated boolean not null default false;
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
create table if not exists public.devil_fruits (
  id text primary key,
  name text not null,
  type text not null,
  technique text not null,
  bonus integer not null check (bonus between 0 and 100),
  x integer not null check (x between 0 and 1200),
  y integer not null check (y between 0 and 760),
  state text not null default 'wild' check (state in ('wild', 'owned', 'reincarnating')),
  owner_id uuid,
  captain_id text,
  rebirth_cycle integer
);
create table if not exists public.world_cycles (
  id boolean primary key default true check (id),
  cycle integer not null default 0
);
insert into public.world_cycles (id, cycle) values (true, 0) on conflict (id) do nothing;

alter table public.islands_control enable row level security;
alter table public.global_events enable row level security;
alter table public.bounties_leaderboard enable row level security;
alter table public.fallen_captains enable row level security;
alter table public.bosses enable row level security;
alter table public.world_action_receipts enable row level security;
alter table public.boss_secret_locations enable row level security;
alter table public.devil_fruits enable row level security;
alter table public.world_cycles enable row level security;

grant select on public.islands_control, public.global_events, public.bounties_leaderboard, public.fallen_captains, public.bosses to authenticated;
grant select (id, name, type, technique, bonus, x, y, state) on public.devil_fruits to authenticated;
revoke all on public.world_action_receipts, public.boss_secret_locations, public.world_cycles from anon, authenticated;

drop policy if exists "read islands" on public.islands_control;
drop policy if exists "read events" on public.global_events;
drop policy if exists "read bounties" on public.bounties_leaderboard;
drop policy if exists "read fallen" on public.fallen_captains;
drop policy if exists "read bosses" on public.bosses;
drop policy if exists "read devil fruit states" on public.devil_fruits;
create policy "read islands" on public.islands_control for select to authenticated using (true);
create policy "read events" on public.global_events for select to authenticated using (true);
create policy "read bounties" on public.bounties_leaderboard for select to authenticated using (true);
create policy "read fallen" on public.fallen_captains for select to authenticated using (true);
create policy "read bosses" on public.bosses for select to authenticated using (true);
create policy "read devil fruit states" on public.devil_fruits for select to authenticated using (true);

insert into public.devil_fruits (id,name,type,technique,bonus,x,y) values
('bara-bara','Bara Bara no Mi','Paramecia','Bara Bara Festival',9,410,145),
('mera-mera','Mera Mera no Mi','Logia','Hiken',12,440,90),
('tori-tori-phoenix','Tori Tori no Mi, modelo Fénix','Zoan mitológica','Regeneración del Fénix',10,1060,190),
('hito-hito-daibutsu','Hito Hito no Mi, modelo Daibutsu','Zoan mitológica','Impacto Daibutsu',13,840,650),
('noro-noro','Noro Noro no Mi','Paramecia','Rayo Noroma',8,70,210),
('suna-suna','Suna Suna no Mi','Logia','Desierto Spada',11,1035,570)
on conflict (id) do nothing;

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
update public.islands_control set affiliated = true where island_id in ('shells','loguetown','sabaody');
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
    or kind not in ('mission','battle','contract','whisper','bounty','death','boss_defeated','tribute_theft','port_sabotage','noble_attack')
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
    if data->>'fruit_id' is not null then
      update public.devil_fruits set state = 'reincarnating', owner_id = null, rebirth_cycle = (select cycle + 1 from public.world_cycles), captain_id = null
        where id = data->>'fruit_id' and state = 'owned' and owner_id = uid and captain_id = data->>'captain_id';
    end if;
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
  elsif kind = 'tribute_theft' then
    update public.islands_control set faction = 'Tripulación', owner_id = uid, owner_name = captain, chaos = 100
      where name = data->>'island' and affiliated;
    if not found then raise exception 'invalid tribute port'; end if;
    message := format('🏴‍☠️ %s saquea el tributo en %s; la Marina retira sus tropas y el puerto cae en anarquía.', captain, data->>'island');
  elsif kind = 'port_sabotage' then
    if data->>'alignment' is null or data->>'alignment' not in ('Libertad','Caos') then raise exception 'revolutionary alignment required'; end if;
    update public.islands_control set chaos = least(100, chaos + 70)
      where name = data->>'island' and faction = 'Tirano';
    if not found then raise exception 'invalid tyrant port'; end if;
    message := format('🕊 La resistencia clandestina abre un refugio en %s.', data->>'island');
  elsif kind = 'noble_attack' then
    update public.islands_control set faction = 'Marina', owner_id = null, owner_name = null, chaos = 0
      where name = data->>'island';
    if not found then raise exception 'invalid noble incident location'; end if;
    message := format('🚨 ALERTA ROJA GLOBAL: %s atacó a la comitiva noble; un Almirante y un Buster Call fueron movilizados.', captain);
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

create or replace function public.claim_devil_fruit(p_fruit_id text, p_captain_id text, p_x integer, p_y integer)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare fruit public.devil_fruits%rowtype;
begin
  if auth.uid() is null or p_captain_id is null or length(p_captain_id) > 80
    or p_x not between 0 and 1200 or p_y not between 0 and 760 then
    raise exception 'invalid fruit claim';
  end if;
  update public.devil_fruits set state = 'owned', owner_id = auth.uid(), captain_id = p_captain_id, rebirth_cycle = null
    where id = p_fruit_id and state = 'wild' and (x - p_x)^2 + (y - p_y)^2 <= 6400
    returning * into fruit;
  if not found then return null; end if;
  return jsonb_build_object('id',fruit.id,'name',fruit.name,'type',fruit.type,'technique',fruit.technique,'bonus',fruit.bonus);
end $$;
revoke all on function public.claim_devil_fruit(text, text, integer, integer) from public, anon;
grant execute on function public.claim_devil_fruit(text, text, integer, integer) to authenticated;

create or replace function public.release_devil_fruit(p_fruit_id text, p_captain_id text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  update public.devil_fruits set state = 'reincarnating', owner_id = null, captain_id = null,
    rebirth_cycle = (select cycle + 1 from public.world_cycles)
    where id = p_fruit_id and state = 'owned' and owner_id = auth.uid() and captain_id = p_captain_id;
  return found;
end $$;
revoke all on function public.release_devil_fruit(text, text) from public, anon;
grant execute on function public.release_devil_fruit(text, text) to authenticated;

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
  update public.world_cycles set cycle = cycle + 1 where id = true;
  update public.devil_fruits set state = 'wild', rebirth_cycle = null,
    x = floor(random() * 1200)::integer, y = floor(random() * 760)::integer
    where state = 'reincarnating' and rebirth_cycle <= (select cycle from public.world_cycles where id = true);
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
