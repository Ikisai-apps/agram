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
# VG: las acepta admitiendo a «core» en el proyecto (aro, PV3: «admitir a alguien», le da R suya)
node be.mjs pendientes                                   # lo que aún no ha aceptado, por registro
```

## Admitir es darle R (encargo equipo, VG 11-11 noche)

Precisión de VG: admitir a una identidad en lo mío no es escribir su nombre en el 2.3; es un intercambio de R (la comunicación: el 3) y de T (el trabajo: el 4 y el 1) entre el dueño y ella, y lo que cada PV vea de ella lo han de dar las lecturas de esos movimientos, no un ancla puesta a mano.

- **Entra hoy** (dato): la plantilla «admit someone» (PV3 de un registro mío): `whom` con las identidades del eje como opciones, `amount` de R mía (acuña antes la que falte) y `minutes` de T (0 por defecto; la regla «T only goes to things» solo deja darlo a una cosa mía). Ancla en el 3 de X como «give own R», y la regla de elegibles (R8) ya admite a quien el dueño nombra en el 3 de un registro sin lista en su 2.3. Prueba: `test/be.test.js` («admitir es darle R»), con Core sobre el menú de VG.
- **Aceptar un escrito suelto** dándole R por él: «give own R» sobre el escrito ya se ofrece y mueve R del dueño al autor, pero la regla no lo lee (el escrito sigue pendiente).

## Para decidir VG

- **La regla de elegibles por la R** (hoy `src/elegibles.js` mira nombres: el 2.3, el 3, `cualquiera`). Cambio mínimo propuesto, como dato: una lectura de la época «eligible» (como «attention group») que el núcleo evalúe en vez del código fijo, con dos cláusulas nuevas: (a) un escrito W sobre X es elegible si el dueño de X ancló sobre W un registro suyo que mueve R suya al autor de W (aceptar **un** escrito = darle R por él); (b) ¿es elegible en todo lo del dueño quien tiene R suya (`saldo R:<dueño> > 0`), o solo en el registro donde se la dio? Lo segundo es lo que hay hoy con «admit someone».
- **La preaceptación heredada**: `elegibles` no mira a los padres. Propuesta: que admitido en un registro valga para los de debajo del mismo dueño (subir por `sobre` hasta su alta). Sin decidir no se ha hecho.
- **Dejar de admitir**: no hay inversa. Corregir solo añade, y la R dada no vuelve si no la devuelve quien la tiene («return R») o la perdona. Opciones: que la admisión se lea por la R en mano (devolverla des-admite), o vetar (zona 5).
- **Colocar por lo que se mueve** (1.3 y 1.3.4 «con quién», laboral; 1.4 y 4 sus trabajos; 3.4 el grupo «equipo»): hoy un PV pinta lo anclado o escrito en él (`contrato.ocupantes`) y el grupo «equipo» solo lee nombres anclados en el 3.4.3 del alta o el grupo de una invitación. Cambio mínimo propuesto, como dato: una lectura de la época por posición (como «stage» en `X.4.8`) que `contrato.ocupantes` añada a lo anclado: `A.1.3` las identidades con quien he movido R o T, `A.1.3.4` aquellas a las que he dado T (laboral), `X.1.4` y `X.4` lo escrito sobre X por quien admití que quema T, y una cláusula en «attention group» que ponga en la zona 4 a quien tiene R mía dada al admitirlo. La prueba lo deja escrito: hoy no sale en ninguno.
- **Lo de la plantilla**: PV3 en el orden 7; ancla en el 3 de X (el de «give own R»); `minutes` 0 por defecto; las opciones de `whom` son todas las identidades (también quien mira; la validación lo rechaza).
- **Doble clic = foco** (#23): VG decide al verlo.
- Los 60 minutos por defecto del alta de una cosa y el ancla en el 1.4 del alta (datos de la plantilla).
