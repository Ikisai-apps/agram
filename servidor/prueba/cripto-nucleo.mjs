// La comprobación del servidor hecha con el núcleo: la misma `comprobar` que
// servidor/supabase/funciones/eventos/verificar.js, pero el hash, la copia
// normalizada y la firma los pone src/evento.js y src/autoridad.js. Es lo que
// usa el servidor de prueba; test/paridad-funcion.test.js comprueba que las
// dos dan lo mismo caso a caso. Las comprobaciones de estructura (qué campos
// y de qué forma) se comparten tal cual: son puro JSON.

import { normalizarEvento, verificarId } from '../../src/evento.js';
import { verificar } from '../../src/autoridad.js';
import { errores, esGenesis, esClavePublica, claveDeclarada } from '../supabase/funciones/eventos/verificar.js';

export async function comprobar(crudo, { vacio, claveDelAutor }) {
  let ev;
  try {
    ev = normalizarEvento(crudo);
  } catch (e) {
    return { ok: false, estado: 400, error: 'el evento no cabe en JSON: ' + e.message };
  }
  const e = errores(ev);
  if (e.length) return { ok: false, estado: 400, error: 'evento mal formado: ' + e.join('; ') };
  if (!(await verificarId(ev))) return { ok: false, estado: 400, error: 'el id no corresponde al cuerpo' };
  let clave;
  if (vacio) {
    if (!esGenesis(ev)) return { ok: false, estado: 400, error: 'el eje está vacío: solo se admite su génesis' };
    clave = claveDeclarada(ev, ev.autor);
    if (!esClavePublica(clave)) return { ok: false, estado: 400, error: 'el génesis debe declarar la clave de su autor (contexto.claves) y firmarse con ella' };
  } else {
    if (esGenesis(ev)) return { ok: false, estado: 400, error: 'el eje ya tiene génesis' };
    clave = await claveDelAutor(ev.autor);
    if (!esClavePublica(clave)) return { ok: false, estado: 403, error: 'el autor no tiene alta con clave en este eje: ' + ev.autor };
  }
  if (!(await verificar(ev, clave))) return { ok: false, estado: 400, error: 'firma inválida de ' + ev.autor };
  return { ok: true, evento: ev };
}
