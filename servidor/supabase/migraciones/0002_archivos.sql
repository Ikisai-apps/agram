-- Los archivos adjuntos (issues #21, #22; función funciones/archivos): un bucket PRIVADO de Supabase Storage.
--
-- Cada archivo vive en `agram-archivos/<eje>/<sha256>`; el registro del eje guarda solo la referencia como texto
-- `archivo:<sha256>` (docs/CONTRATO.md §2.1). Nadie lee ni escribe el bucket con la clave anónima: no hay políticas
-- para anon ni authenticated en storage.objects sobre este bucket (RLS de Storage lo deja cerrado), y la función
-- `archivos` entra con el rol de servicio tras comprobar la clave de lectura del eje (la tabla `ejes` de 0001).
-- El tope (2 MB) y los tipos admitidos se repiten aquí para que el propio Storage los imponga también.
--
-- Idempotente: se puede pasar otra vez sin efecto. Si se prefiere el panel: Storage → New bucket → nombre
-- `agram-archivos`, Public desactivado, límite 2 MB, tipos los de abajo (servidor/LEEME.md).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'agram-archivos',
  'agram-archivos',
  false,
  2097152,
  array['text/html', 'image/png', 'image/jpeg', 'image/svg+xml', 'application/json']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
