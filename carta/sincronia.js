// El libro compartido en la carta (etapa 3; docs/CONTRATO.md §15, «En la carta»): lo que carta/app.js hace con la
// sincronía de una cuenta, sin DOM, para probarlo con el servidor de prueba (test/carta-sincronia.test.js).
//
// Solo las CUENTAS sincronizan, y solo con las tres cosas: `sync url` y `sync ledger` en su configuración (un
// registro «preferences» de su alta: sincronia.destino) y la clave de lectura en este navegador
// (cuentas.claveLectura: agram.sync.<alta>, nunca en el eje). Los ejemplos no tienen cuenta ni clave: nunca
// sincronizan. El estado de la sincronía (Sincronia#serializar: la cola, los órdenes del servidor, lo rechazado; sin
// la clave) va junto al eje, por cuenta, en agram.sync.estado.<alta> (cuentas.guardarEstadoSincronia).
//
//   abrir({ alta, eje, yo })          → la sincronía de la cuenta (restaurada o nueva) o null si no sincroniza
//   pasar(S, eje, alta)               → sincroniza una vez y guarda su estado; el informe de src/sincronia.js
//   ejeDelServidor({ cuenta, … })     → un dispositivo sin eje local: el eje nace del génesis del servidor
//   enSerie(fn)                       → las llamadas de una en una: la que llega con otra en marcha, se repite al acabar
//   lineaDeEstado(S, informe)         → lo que enseña la línea de estado (carta/dom.js htmlSincronia)

import { sincronia } from '../src/index.js';
import * as cuentas from './cuentas.js';
import { t } from './textos.js';

const { Sincronia } = sincronia;

/** Cada cuánto se sincroniza con la pestaña visible (además de tras escribir y al volver la red), en milisegundos. */
export const CADA = 30 * 1000;

const fetchDeLaPlataforma = () => globalThis.fetch?.bind(globalThis);

/** ¿Lo guardado es de este destino? Otra url u otro eje: sus órdenes no valen aquí y se empieza de cero. */
const mismoDestino = (datos, d) => datos && datos.url === d.url && datos.eje === d.eje;

/**
 * La sincronía de una cuenta, o null si no sincroniza (sin `sync url` o `sync ledger` en la configuración de `yo`,
 * o sin clave de lectura en este navegador). Restaura la guardada en agram.sync.estado.<alta> si es del mismo
 * destino; si no, una nueva. Marca en el eje el reloj de los demás con lo ya recibido.
 */
export function abrir({ alta, eje, yo, fetch = fetchDeLaPlataforma(), ahora } = {}) {
  if (!alta || !eje) return null;
  const d = sincronia.destino(eje, yo);
  if (!d) return null;
  const claveLectura = cuentas.claveLectura(alta);
  if (!claveLectura) return null;
  const opciones = { claveLectura, fetch, ...(ahora ? { ahora } : {}) };
  let S = null;
  const datos = cuentas.estadoSincronia(alta);
  if (mismoDestino(datos, d)) {
    try {
      S = Sincronia.restaurar(datos, opciones);
    } catch {
      S = null; // ilegible: se empieza de cero (el servidor es idempotente: lo ya subido no se duplica)
    }
  }
  S ??= new Sincronia({ url: d.url, eje: d.eje, ...opciones });
  S.marcarReloj(eje);
  return S;
}

/** ¿Sigue la cuenta en este navegador? (Si se olvidó mientras se sincronizaba, no se vuelve a escribir nada suyo.) */
const sigue = (alta) => cuentas.cuentas().some((c) => c.alta === alta);

/**
 * Sincroniza una vez: S.sincronizar(eje) (baja, valida, reordena si hace falta, sube lo pendiente; nunca lanza por
 * la red) y guarda el estado de la sincronía y, si el eje cambió (reordenado o con algo añadido), el eje de la
 * cuenta. → el informe de src/sincronia.js.
 */
export async function pasar(S, eje, alta) {
  const informe = await S.sincronizar(eje);
  if (sigue(alta)) {
    cuentas.guardarEstadoSincronia(alta, S.serializar());
    if (informe.reordenado || informe.anadidos.length) cuentas.guardarEje({ alta }, eje);
  }
  return informe;
}

/**
 * Un dispositivo sin el eje de la cuenta (una copia restaurada, o el eje local perdido): S.sincronizar(null) lo crea
 * desde el génesis del servidor, y solo vale si es el de esta cuenta (su alta, con su clave pública) y, si hay una
 * foto (el eje de la copia), el mismo génesis. Lo de la foto que el servidor aún no tiene se añade detrás (queda
 * pendiente de subir). → { eje, sincronia, informe } o { motivo, sincronia, informe } si no se pudo.
 */
export async function ejeDelServidor({ cuenta, url, eje: nombre, claveLectura, foto = null, fetch = fetchDeLaPlataforma(), ahora } = {}) {
  const S = new Sincronia({ url, eje: nombre, claveLectura, fetch, ...(ahora ? { ahora } : {}) });
  // Como el de crearCuenta (Eje.genesis sin exigirFirmas), o como la foto; en el servidor todo va firmado igual.
  const informe = await S.sincronizar(null, { exigirFirmas: foto?.exigirFirmas ?? false });
  const eje = informe.eje;
  if (!eje) {
    const motivo = informe.errores.length ? informe.errores.join(' · ') : informe.sinRed ? t('sinRed') : t('servidorVacio');
    return { motivo, sincronia: S, informe };
  }
  const propio = eje.alta(cuenta.identidad)?.id === cuenta.alta && cuentas.mismaClave(eje.clave(cuenta.identidad), cuenta.publica);
  if (!propio || (foto && foto.genesisId !== eje.genesisId)) return { motivo: t('servidorDeOtraCuenta', { eje: nombre }), sincronia: S, informe };
  if (informe.errores.length) return { motivo: informe.errores.join(' · '), sincronia: S, informe };
  if (foto) {
    for (const id of foto.orden) {
      if (eje.eventos.has(id)) continue;
      try {
        await eje.anadir(foto.obtener(id));
      } catch {
        /* en el orden del servidor ya no pasa las reglas: se queda fuera, como un rechazo del reorden */
      }
    }
  }
  return { eje, sincronia: S, informe };
}

/**
 * Las llamadas de una en una: si llega otra mientras corre, se marca y se repite UNA vez al acabar (las que lleguen
 * mientras tanto se juntan en esa). Devuelve la función que se llama; su promesa acaba cuando no queda nada marcado.
 * `alFallar(e)`: lo que hacer si una vuelta lanza (no corta la serie).
 */
export function enSerie(fn, { alFallar = () => {} } = {}) {
  let corriendo = null;
  let otra = false;
  return function llamar() {
    if (corriendo) {
      otra = true;
      return corriendo;
    }
    corriendo = (async () => {
      try {
        do {
          otra = false;
          try {
            await fn();
          } catch (e) {
            alFallar(e);
          }
        } while (otra);
      } finally {
        corriendo = null;
      }
    })();
    return corriendo;
  };
}

/** Qué quiere decir el `de` de un rechazo, en los textos de la carta. */
const DE = Object.freeze({ reglas: 'rechazadoReglas', reorden: 'rechazadoReorden', servidor: 'rechazadoServidor' });

/**
 * Lo que enseña la línea de estado tras una sincronización (§4 de carta/sincronia-ui.md):
 * { partes: [«n por subir», «sin red: se subirá al volver», «el orden cambió al sincronizar» | «al día…»],
 *   titulo: «n registros no entraron», rechazados: [{ id (8), motivo, de, deTexto }], errores: [texto tal cual] }.
 * Los rechazados son los de la sincronía (se recuerdan entre llamadas), menos los que el servidor rechazó y luego
 * aceptó.
 */
export function lineaDeEstado(S, informe) {
  const partes = [];
  const n = informe.pendientes.length;
  if (n) partes.push(t('porSubir', { cuantos: n }));
  if (informe.sinRed) partes.push(t(n ? 'sinRedSeSubira' : 'sinRed'));
  if (informe.reordenado) partes.push(t('ordenCambio'));
  const rechazados = S.rechazados
    .filter((r) => !(r.de === 'servidor' && S.orden(r.id) !== undefined))
    .map((r) => ({ id: String(r.id).slice(0, 8), motivo: r.motivo, de: r.de, deTexto: DE[r.de] ? t(DE[r.de]) : String(r.de ?? '') }));
  const errores = [...informe.errores];
  if (!partes.length && !rechazados.length && !errores.length) partes.push(t('alDia'));
  return { partes, titulo: rechazados.length ? t('noEntraron', { cuantos: rechazados.length }) : '', rechazados, errores };
}
