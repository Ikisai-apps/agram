// La entrada de una persona en un eje de los ejemplos (encargo 3b; VG, 9-11, mapa §16 [D] «El árbol mínimo es la
// invitación»): quien ya está la invita (una transacción suya anclada en el 3 de su alta, que le guarda una unidad de
// su R) y la persona nueva acepta (su primera transacción, anclada sobre la invitación y firmada con su clave si la
// tiene: su alta). Datos inventados.

/**
 * `por` invita a `quien` y `quien` acepta. `clave` ({ publica, privada }) es la de quien entra (opcional en un eje de
 * demostración); `privadaDe(id)` da la clave privada de quien invita, si firma. `grupo` es la zona de la atención de
 * `por` que le asigna (0, desconocidos, por omisión). Devuelve { invitacion, alta }.
 */
export async function entrarPorInvitacion(eje, { por, quien, t, clave, privadaDe = () => undefined, grupo = 0, da } = {}) {
  const invitacion = await eje.invitar({ autor: por, invitado: quien, t, clave: clave?.publica, grupo, ...(da ? { da } : {}), privada: privadaDe(por) });
  const alta = await eje.aceptar(invitacion, clave ?? {}, { t });
  return { invitacion, alta };
}
