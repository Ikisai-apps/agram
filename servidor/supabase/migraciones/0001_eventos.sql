-- El libro compartido (etapa 3 del roadmap, mapa §17): dos tablas de SOLO AÑADIR.
--
-- El servidor no valida reglas: guarda, ordena por llegada (orden) y da la hora
-- (recibido, su reloj). Lo que valida la función de borde (funciones/eventos)
-- es la forma: el id es el hash del cuerpo canónico y la firma verifica con la
-- clave del alta del autor dentro del eje. Todo lo demás lo valida cada
-- cliente con el núcleo (src/eje.js).
--
-- Privacidad: el eje es privado con clave de lectura. Aquí se guarda SOLO el
-- hash SHA-256 (hex) de esa clave; la clave la ve una vez quien crea el eje.
-- Nadie lee estas tablas con la clave anónima: RLS activo sin políticas para
-- anon/authenticated (todo pasa por la función, que usa el rol de servicio), y
-- un disparador impide UPDATE y DELETE a cualquier rol, el de servicio incluido.

create table if not exists public.ejes (
  eje text primary key,
  clave_lectura_hash text not null,
  creado timestamptz not null default now(),
  constraint ejes_nombre check (eje ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  constraint ejes_hash check (clave_lectura_hash ~ '^[0-9a-f]{64}$')
);

create table if not exists public.eventos (
  eje text not null references public.ejes (eje),
  id text not null,
  orden bigserial not null,
  recibido timestamptz not null default now(),
  autor text not null,
  firma text not null,
  cuerpo jsonb not null,
  primary key (eje, id),
  constraint eventos_id check (id ~ '^[0-9a-f]{64}$'),
  constraint eventos_orden unique (orden)
);

create index if not exists eventos_por_llegada on public.eventos (eje, orden);

-- La clave de un autor se busca en su alta: el primer evento del eje que la
-- declara en contexto.claves.<autor>. Un índice GIN sobre el cuerpo cubre la
-- consulta por contención (cuerpo @> '{"contexto":{"claves":{"<autor>":{}}}}').
create index if not exists eventos_cuerpo on public.eventos using gin (cuerpo jsonb_path_ops);

-- Solo añadir: nadie corrige ni borra; corregir es añadir (docs/FUNDAMENTOS.md).
create or replace function public.solo_anadir() returns trigger
language plpgsql as $$
begin
  raise exception 'la tabla % es de solo añadir: no hay % ', tg_table_name, tg_op;
end;
$$;

drop trigger if exists eventos_solo_anadir on public.eventos;
create trigger eventos_solo_anadir
  before update or delete or truncate on public.eventos
  for each statement execute function public.solo_anadir();

drop trigger if exists ejes_solo_anadir on public.ejes;
create trigger ejes_solo_anadir
  before update or delete or truncate on public.ejes
  for each statement execute function public.solo_anadir();

-- RLS: activo y sin políticas para los roles públicos. La función de borde
-- escribe y lee con el rol de servicio, que no pasa por RLS. Una política de
-- select para anon dejaría leer el eje entero a quien tenga la clave anónima
-- (que es pública) y saltaría la clave de lectura: por eso no hay ninguna.
alter table public.ejes enable row level security;
alter table public.eventos enable row level security;

revoke all on table public.ejes from anon, authenticated;
revoke all on table public.eventos from anon, authenticated;
revoke all on sequence public.eventos_orden_seq from anon, authenticated;

grant select, insert on table public.ejes to service_role;
grant select, insert on table public.eventos to service_role;
grant usage, select on sequence public.eventos_orden_seq to service_role;
