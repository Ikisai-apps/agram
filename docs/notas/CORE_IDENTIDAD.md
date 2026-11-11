# Core como identidad que escribe (encargo core-escribe, issue #28)

Decisión de VG (11-11 noche): Core escribe en el eje compartido de VG con su propia identidad, no como VG. Precisión de VG: Core no tiene nada especial; lo que escribe sobre lo ajeno sigue la regla de cualquier identidad. Detalle: `docs/CONTRATO.md` §17.4.

## Cómo nace

- Core es una **cosa** de VG: su alta la escribe VG (B1), con la plantilla de transacción **«register a thing»** (PV1 de su alta, ancla en el 1.4 de su alta): le da T de minuto y declara la clave de Core con la prueba de posesión («a key is declared at its alta», «a declared key comes with its proof»).
- La prueba la firma Core sobre el id de ese registro exacto, así que el alta va en dos pasos: `be.mjs identidad --crear` genera el par (en la configuración de Be, fuera del repo, nunca impreso) y deja la **petición**, una propuesta del formato de la guía con su instante; VG la importa en la carta (guía → importar propuestas) y la acepta en el camino de su alta.

## Qué escribe y cuándo cuenta

- `be.mjs escribir` (una acción del aro o un payload BTML) y `be.mjs proponer` («propose» en la fábrica del proyecto de VG), firmados con la clave de Core, validados con las reglas y subidos al servidor.
- Sobre un registro ajeno, lo escrito **ocupa pero no entra** en lo del dueño hasta que su criterio admite al autor (R8, `src/elegibles.js`): VG nombra a `core` en el 2.3 del registro («con quién») o en su 3. `be.mjs identidad` dice de cada escrito si está aceptado o pendiente.

## Primer uso (lo hace Core a mano)

```sh
export AGRAM_BE_CONFIG=~/.agram/be/vg-config.json       # { sync_url, eje, clave_lectura }
node be.mjs identidad --crear                            # deja ~/.agram/be/peticion-alta-core.json
# VG: guía → importar propuestas → ese archivo → aceptar («dar de alta una cosa», en el camino de su alta)
node be.mjs identidad                                    # alta, T de minuto: 60
node be.mjs proponer "AGRAM" --valores '{"content":"el sistema: núcleo, época y carta"}'
node be.mjs proponer "Ikisai" --valores '{"content":"el ecosistema de apps"}'
node be.mjs proponer "Mueling Sovereignty" --valores '{"content":"el proyecto"}'
# VG: las acepta admitiendo a «core» en el 2.3 del proyecto; Core lo ve con «node be.mjs identidad»
```

## Para decidir VG

- Aceptar **una** escritura suelta: hoy no existe; se admite al autor en todo el registro (preaceptación por registro, la corrección del dueño en su 2.3).
- Una acción del aro para anclar un nombre en el 2.3 de un registro propio (hoy, con el formulario de la posición).
- La preaceptación heredada por los registros de debajo: encajaría en el criterio del dueño (su PV2) o como delegación de P; no se ha inventado.
- Los 60 minutos por defecto del alta de una cosa y el ancla en el 1.4 del alta (datos de la plantilla).
- Core en el grupo «equipo» (3.4) de la atención de VG: no lo coloca el núcleo solo; VG lo ancla en el 3.4.3 de su alta si quiere.
