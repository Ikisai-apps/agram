// Los gestos de la carta (tabla de VG). Móvil: toque = enfocar (un paso de tamaño), mantener = abrir el aro, doble toque
// = poner como foco lo tocado (#23; sobre el centro, editar 0 o 5), deslizar vertical = recorrer (el scroll de la franja), horizontal = cambiar de PV o hermano, pellizco
// = profundidad, tirar al final = cargar más. Ordenador: clic, clic derecho o mantener, doble clic, rueda y flechas,
// flechas ← → y teclas 0-9 (saltar al PV), rueda con Ctrl, Enter y Esc, clic en «cargar más». Hover solo en ordenador
// (CSS). Interactuar en pantalla o por el aro es lo mismo: aquí solo se traducen los eventos del navegador a las
// llamadas de la app; nada se decide.
//
// Arrastrar al centro = foco (#23, VG 12-11; encargo «el4»): solo en Mapped (en Sequenced no: se confundiría con el
// scroll del hilo). Lo que tiene un registro detrás (data-x) y no es el centro ni un PV entero, soltado sobre el centro
// (data-centro dentro de la carta en matriz), pasa a ser el foco, como con el doble clic.
//
// Un clic y un clic mantenido (VG, 11-11, issues #5, #6, #9), con un solo gestor por delegación para todo lo pulsable:
// un clic entra en profundidad (lo de siempre: una celda, un registro, un PV, una fila); mantener (≈ medio segundo, o el
// clic derecho en el ordenador) sobre cualquier cosa con un registro detrás (data-x) abre el aro alrededor, anclado al
// punto pulsado si la cosa es grande. Dentro del aro, lo mismo: un clic en un sitio lanza su acción por defecto y
// mantenerlo despliega su lista (las demás acciones y los valores que se pueden escribir); un clic en el centro entra en
// el elemento y mantenerlo lo edita. Mantener sobre un campo del anverso abre el aro con la lista de ese campo. El clic
// que llega al soltar tras mantener no cuenta.

const MANTENER_MS = 500;
/** Tras un clic mantenido (o el clic derecho, o el mantener del móvil que el navegador también da como menú), lo que llega en este rato no cuenta. */
const TRAS_MANTENER_MS = 700;
/** Doble clic (o doble toque) = foco (#23): el registro bajo el primer clic vale para el doble clic que llega en este rato. */
const DOBLE_MS = 500;
const UMBRAL_DESLIZAR = 40;
const UMBRAL_PELLIZCO = 30;
/** Arrastrar desde la esquina de un PV (Mapped): cada tanto de esta fracción del lado menor de la escena es un paso. */
const UMBRAL_ASA = 1 / 8;
/** Cuánto hay que mover a una persona del 3 (en píxeles) para que sea arrastrarla y no un clic (encargo pv3). */
const UMBRAL_PERSONA = 12;
/** Arrastrar un elemento al centro (Mapped, #23): lo que hay que moverlo, en píxeles, para que cuente como arrastre. */
const UMBRAL_ARRASTRE = 24;

/**
 * Engancha los gestos en `raiz` y los traduce a los manejadores de la app:
 *   nivel(pv, delta, X)      un paso de tamaño en un PV lateral (toque, Enter, rueda con Ctrl, pellizco)
 *   foco(X, pv)              entrar en un registro (o en un PV como foco)
 *   voltear()                dar la vuelta al centro (0 ↔ 5)
 *   aro(X, pv | null, { desplegar, ancla })  abrir el aro sobre X (y desplegar el sitio pv); `ancla` es la caja del elemento pulsado
 *                            en la ventana ({ x, y, ancho, alto }, getBoundingClientRect al abrirlo): la app lo ancla ahí en Mapped
 *   aroTecla(pv)             con el aro abierto, las teclas 1-4 y 6-9 lanzan la acción por defecto de ese sitio
 *   aroEntrar(X)             un clic en el centro del aro: cerrarlo y entrar en el elemento
 *   editarAro()              mantener el centro del aro: editarlo (el input con la lista del 0 debajo y la del 5 encima)
 *   opcion(X, pv, valor)     un valor de una lista del aro: escribirlo en la posición pv de X (como campo)
 *   lanzar(X, accion, paso, { ejecutar })  abrir el formulario de una acción (o del paso del camino; ejecutar: desde una celda del 4)
 *   denominacion(escala, form)  ejecutar: la escala de la que parte la T que se quema (el formulario sigue con lo escrito)
 *   cerrar()                 cerrar el aro, el formulario o la configuración
 *   enviar(form)             enviar el formulario de una acción
 *   configurar(form | null, parte)  abrir la configuración de una parte (null, '2' mis criterios y preferencias | '9' guía y exterior) o guardarla (el formulario)
 *   campo(X, pv, texto, { nuevo })  escribir un ocupante nuevo en la posición pv de X (nuevo: desde el aro de un hueco: crea el elemento y abre su aro)
 *   aroNuevo(X, pv, { ancla })  mantener sobre un hueco (data-hueco-x, data-hueco-pv; issue #22): el aro con un input nuevo que crea el elemento en X.pv
 *   cargarMas(pv)            una página más de ocupantes del PV
 *   roseton(pv)              un paso en un rosetón de identidad
 *   leido()                  alternar la lente «leído»
 *   englobar()               guardar este rato (englobar el libro local)
 *   guiaExportar() · guiaImportar()  la salida externa del PV9 (carta/externa.js): descargar el contexto, elegir el archivo de propuestas
 *   propuesta(que, id)       aceptar, modificar o rechazar una propuesta importada (el paso de la tercera fuente del camino)
 *   quien(id) · ejemplo(id) · reiniciar() · seguir()
 *   previsualizar(X, accion, paso)  construir y validar un paso del camino sin escribir (encargo «datos3»)
 *   cohorte(valor)  la cohorte con que el cielo del 8 compara (encargo «datos3»)
 *   arranque(que)            la pantalla de arranque: menu, crear, restaurar, ejemplo o cuenta:<alta>
 *   crear(form) · restaurar(form) · copia(form | null) · olvidar()   mi cuenta: crearla, restaurarla de su copia, la copia de seguridad, olvidarla
 *   hermano(delta)           cambiar de PV o de hermano (deslizar horizontal, flechas ← →)
 *   saltar(pv)               las teclas 0-9: ir a ese PV
 *   todos(delta)             Mapped: los puntitos del foco (un paso a todos los PV) y su mando para bajar
 *   preferencia(clave, valor) un interruptor del 5 del 0 de mi alta (sobrio o animado): escribir esa preferencia
 *   pagina(pv, delta)        Mapped: la página siguiente o la anterior de un PV (sin scroll)
 *   celda(pv, X)             Mapped, pantalla completa: entrar en una celda de la rejilla de un PV (un nivel más adentro)
 *   celdaMatriz(X, celda)    la matriz del 4 a pantalla completa: abrir la celda «fila.columna» de X (su lista de movimientos); null la cierra
 *   subir(pv)                volver un nivel de profundidad en la rejilla de un PV (Mapped a pantalla completa, o una fila abierta de Sequenced)
 *   bajar(pv, d)             bajar un nivel por el dígito d de una celda de la rejilla (la dirección crece un dígito: 1 → 1.1)
 *   fila(pv)                 Sequenced: abrir o cerrar la fila de un PV en la tarjeta del foco (las del hilo llevan al pasado o al futuro)
 *   digito(pv)               Sequenced: la fila de dígitos de abajo; ir a la fila de ese PV y abrirla
 *   filtroCaja(caja)         el 3 por tema (encargo pv3): el botón de una caja cicla todos → doy → recibo
 *   sitio(X, lugar, { general })  el interrogante (o el muñeco) de un sitio: abrir la cruceta del propio nodo X.<lugar> (#38); el del 0 de mi alta (general) lleva las opciones de lo que era la barra
 *   lanzarCon(X, accion, valores)  una posición de esa cruceta: el formulario de su acción con los parámetros del sitio
 *   reclasificar(persona, caja)  arrastrar a una persona de una caja del 3 a otra (mantener y arrastrar, en Mapped y en
 *                            Sequenced): reclasificar la conversación (al 5, vetar)
 * En Mapped, nivel(pv, delta, X) llega también de los botoncitos de cada PV (data-tamano) y del arrastre desde su
 * esquina (data-asa: tantos pasos como umbrales recorre en la dirección que va de su esquina al centro); y foco(X, 0),
 * de arrastrar un elemento y soltarlo sobre el centro (#23).
 * Devuelve una función que quita los ganchos.
 */
export function instalar(raiz, m) {
  const quitar = [];
  const on = (tipo, fn, opciones, donde = raiz) => {
    donde.addEventListener(tipo, fn, opciones);
    quitar.push(() => donde.removeEventListener(tipo, fn, opciones));
  };
  const documento = raiz.ownerDocument ?? raiz;
  const pvDe = (el) => el?.closest?.('[data-pv]:not(.ocupante):not(.rejilla-celda):not(.hijo)'); // un ocupante anidado o un hijo de la rejilla también llevan data-pv (su color), pero no son un PV
  const xDe = (el) => el?.closest?.('[data-x]')?.dataset.x ?? null;
  /**
   * La caja (en coordenadas de la ventana, al abrir el aro) del elemento pulsado: el ocupante, el campo, la fila, la cuenta, la estrella,
   * el hijo de la rejilla, la tarjeta central o, si no, lo marcado con data-x. Si es grande (más de un tercio del ancho o un cuarto del
   * alto de la ventana: un hijo que ocupa media pantalla, issue #9) no sirve de ancla (sería un aro gigante): una caja pequeña en el puntero.
   */
  const anclaDe = (objetivo, x, y) => {
    const ventana = documento.defaultView;
    const caja = objetivo?.closest?.('.ocupante, .campo, .fila-cabeza, .centro-flotante, .hijo, [data-x]');
    const r = caja?.getBoundingClientRect?.();
    const vw = ventana?.innerWidth ?? 0;
    const vh = ventana?.innerHeight ?? 0;
    if (r && r.width > 0 && r.height > 0 && r.width <= vw / 3 && r.height <= vh / 4) return { x: r.left, y: r.top, ancho: r.width, alto: r.height };
    return Number.isFinite(x) && Number.isFinite(y) ? { x: x - 60, y: y - 18, ancho: 120, alto: 36 } : null;
  };
  /**
   * El clic mantenido (o el derecho) sobre `t`, en el punto (x, y): dentro del aro, un sitio con lista la despliega y el centro se
   * edita; un campo del anverso abre el aro sobre su registro con la lista de ese campo; cualquier otra cosa con un registro detrás
   * (data-x), el aro sobre él. Devuelve si hizo algo.
   */
  let ultimoMantener = 0;
  const mantenido = (t, x, y) => {
    if (Date.now() - ultimoMantener < TRAS_MANTENER_MS) return true; // el móvil da el mantener y además el menú: una vez
    const dentro = t.closest?.('.aro');
    if (dentro) {
      const sitio = t.closest('.hueco');
      if (sitio && sitio.dataset.conLista !== undefined) { ultimoMantener = Date.now(); m.aro?.(dentro.dataset.x, Number(sitio.dataset.pv), { desplegar: true }); return true; }
      if (t.closest('[data-aro-centro]') && !t.closest('input')) { ultimoMantener = Date.now(); m.editarAro?.(); return true; }
      return false;
    }
    if (t.closest?.('.formulario, .guia, textarea, select, pre')) return false;
    // un campo: su input, su etiqueta (la .campo del anverso) o la cabeza de su fila (Sequenced); lo de dentro de una fila abierta no es el campo
    const campo = t.closest?.('[data-campo]') ?? t.closest?.('.campo, .fila-cabeza')?.closest?.('.campo, .fila')?.querySelector?.('[data-campo]');
    if (campo && campo.dataset.x) { ultimoMantener = Date.now(); m.aro?.(campo.dataset.x, Number(campo.dataset.campo), { desplegar: true, ancla: anclaDe(t, x, y) }); return true; }
    // un hueco (issue #22: un hijo de la rejilla, vacío o no, el espacio libre de un mundo a pantalla completa, un PV vacío):
    // si es lo más cercano, el aro con un input nuevo que crea el elemento en esa posición; lo que tiene un registro detrás, gana
    let el = t.closest?.('[data-x], [data-hueco-x]');
    if (el?.dataset.huecoX && !el.dataset.x) {
      // en la rejilla, la posición es el dígito del hijo pulsado (su data-pv); fuera de todo hijo, la del contenedor si la lleva
      const hijo = t.closest('.rejilla-celda.hijo[data-pv]');
      const pv = hijo && el.contains(hijo) ? Number(hijo.dataset.pv) : el.dataset.huecoPv !== undefined ? Number(el.dataset.huecoPv) : NaN;
      if (Number.isInteger(pv)) {
        ultimoMantener = Date.now();
        // bajado por dígitos dentro del registro (data-hueco-en, encargo «lecturas»): la dirección entera, la base y el dígito
        const en = el.dataset.huecoEn ? el.dataset.huecoEn.split('.').map(Number) : [];
        m.aroNuevo?.(el.dataset.huecoX, pv, { ancla: anclaDe(t, x, y), ...(en.length && hijo && el.contains(hijo) ? { en } : {}) });
        return true;
      }
      el = el.parentElement?.closest('[data-x]'); // sin posición (el contenedor de una rejilla en un bloque): el aro de lo de detrás, como siempre
    }
    if (!el || !el.dataset.x) return false;
    ultimoMantener = Date.now();
    m.aro?.(el.dataset.x, null, { ancla: anclaDe(t, x, y) });
    return true;
  };

  // ---- toques y clics ----
  let ultimoToque = { t: 0, el: null };
  let arrastrado = 0; // tras arrastrar un asa, el clic que sigue no cuenta
  /**
   * El elemento bajo el primer clic de un doble clic (#23): el primero ya entra (y repinta), así que el doble clic se lee
   * con lo que había debajo al empezar. X es el registro de un elemento (data-x) que no es un PV entero; centro, si era el centro.
   */
  let primerClic = { t: 0, X: null, centro: false };
  const elementoDe = (t) => {
    const el = t.closest?.('[data-x]');
    return el && el !== pvDe(t) && el.dataset.x ? el.dataset.x : null;
  };
  on('click', (e) => {
    const t = e.target;
    if (t.closest('input, textarea, select, option, pre')) return;
    if (Date.now() - primerClic.t > DOBLE_MS && !t.closest('.aro, .formulario, .guia')) primerClic = { t: Date.now(), X: elementoDe(t), centro: !!t.closest('[data-centro]') };
    if (Date.now() - arrastrado < 400) { e.preventDefault(); return; }
    if (Date.now() - ultimoMantener < TRAS_MANTENER_MS) { e.preventDefault(); return; } // el clic de soltar tras mantener
    const b = (sel) => t.closest(sel);
    let el;
    if ((el = b('[data-cerrar]')) && (t === el || t.closest('.cerrar'))) { e.preventDefault(); m.cerrar?.(); return; }
    // Dentro del aro: un valor de una lista se escribe; un clic en el centro (sin editarlo) entra en el elemento.
    if ((el = b('.aro [data-opcion]'))) { e.preventDefault(); m.opcion?.(el.dataset.x ?? el.closest('.aro')?.dataset.x, Number(el.dataset.opcion), el.dataset.valor); return; }
    if ((el = b('.aro:not(.editando) [data-aro-centro]'))) { e.preventDefault(); m.aroEntrar?.(el.dataset.x ?? el.closest('.aro')?.dataset.x); return; }
    if (t.closest('.formulario, .aro, .guia') && !t.closest('button')) return; // dentro de un diálogo (o de la guía), nada más que los botones
    if ((el = b('[data-guia-rapida]'))) { e.preventDefault(); m.guiaRapida?.(Number(el.dataset.guiaRapida)); return; }
    if ((el = b('[data-guia-vaciar]'))) { e.preventDefault(); m.guiaVaciar?.(); return; }
    if ((el = b('[data-guia-exportar]'))) { e.preventDefault(); m.guiaExportar?.(); return; }
    if ((el = b('[data-guia-importar]'))) { e.preventDefault(); m.guiaImportar?.(); return; }
    for (const que of ['aceptar', 'modificar', 'rechazar']) {
      if ((el = b(`[data-propuesta-${que}]`))) { e.preventDefault(); m.propuesta?.(que, el.dataset[`propuesta${que[0].toUpperCase()}${que.slice(1)}`]); return; }
    }
    if ((el = b('[data-todos]'))) { e.preventDefault(); m.todos?.(Number(el.dataset.todos)); return; }
    // la cabeza de una fila de Sequenced (un botón): las celdas de la rejilla y los sitios del aro también llevan data-fila (su fila en la cuadrícula), y no son filas
    if ((el = b('button[data-fila]'))) { e.preventDefault(); m.fila?.(Number(el.dataset.fila)); return; }
    if ((el = b('[data-digito]'))) { e.preventDefault(); m.digito?.(Number(el.dataset.digito)); return; }
    if ((el = b('[data-tamano]'))) { e.preventDefault(); m.nivel?.(Number(el.dataset.pv), Number(el.dataset.tamano), el.dataset.x); return; }
    if ((el = b('[data-preferencia]'))) { e.preventDefault(); m.preferencia?.(el.dataset.preferencia, el.dataset.valor); return; }
    if ((el = b('[data-pagina]'))) { e.preventDefault(); m.pagina?.(Number(el.dataset.pagina), Number(el.dataset.delta)); return; }
    if (b('[data-asa]')) { e.preventDefault(); return; }
    // El 3 por tema (encargo pv3): el botón que cicla de una caja, el interrogante de un sitio y una posición de su cruceta.
    if ((el = b('[data-filtro-caja]'))) { e.preventDefault(); m.filtroCaja?.(Number(el.dataset.filtroCaja)); return; }
    if ((el = b('[data-sitio-lanzar]'))) {
      e.preventDefault();
      let valores = {};
      try { valores = JSON.parse(el.dataset.valores || '{}'); } catch { /* sin parámetros del sitio */ }
      m.lanzarCon?.(el.dataset.x ?? xDe(el), el.dataset.sitioLanzar, valores);
      return;
    }
    if ((el = b('[data-sitio]'))) { e.preventDefault(); m.sitio?.(el.dataset.sitioX ?? xDe(el), el.dataset.sitio, { general: el.dataset.sitioGeneral !== undefined }); return; }
    // data-ejecutar (VG 12-11, decisión 7): lanzado desde una celda abierta del 4, el formulario en modo ejecutar.
    if ((el = b('[data-lanzar]'))) { e.preventDefault(); m.lanzar?.(el.dataset.x ?? xDe(el), el.dataset.lanzar, el.dataset.paso !== undefined ? Number(el.dataset.paso) : null, ...(el.dataset.ejecutar !== undefined ? [{ ejecutar: true }] : [])); return; }
    if ((el = b('[data-cargar-mas]'))) { e.preventDefault(); m.cargarMas?.(Number(el.dataset.cargarMas)); return; }
    if ((el = b('[data-seguir]'))) { e.preventDefault(); m.seguir?.(); return; }
    if ((el = b('[data-previsualizar]'))) { e.preventDefault(); m.previsualizar?.(el.dataset.x ?? xDe(el), el.dataset.accion, Number(el.dataset.previsualizar)); return; }
    if ((el = b('[data-cohorte]'))) { e.preventDefault(); m.cohorte?.(el.dataset.cohorte); return; }
    if ((el = b('[data-englobar]'))) { e.preventDefault(); m.englobar?.(); return; }
    if ((el = b('[data-config]'))) { e.preventDefault(); m.configurar?.(null, el.dataset.config === '9' ? '9' : '2'); return; }
    if ((el = b('[data-reiniciar]'))) { e.preventDefault(); m.reiniciar?.(); return; }
    if ((el = b('[data-arranque]'))) { e.preventDefault(); m.arranque?.(el.dataset.arranque); return; }
    if ((el = b('[data-copia]'))) { e.preventDefault(); m.copia?.(null); return; }
    if ((el = b('[data-olvidar]'))) { e.preventDefault(); m.olvidar?.(); return; }
    if ((el = b('[data-leido]'))) { e.preventDefault(); m.leido?.(); return; }
    if ((el = b('[data-girar]'))) {
      // La tarjeta central flotante de la rejilla: girarla entre su cara 0 y su cara 5 es solo cosa de la pantalla (no cambia el estado).
      e.preventDefault();
      const tarjeta = el.closest('.centro-flotante');
      if (tarjeta) {
        const girada = tarjeta.classList.toggle('girada');
        for (const [cara, oculta] of [['.cara-0', girada], ['.cara-5', !girada]]) tarjeta.querySelector(cara)?.setAttribute('aria-hidden', String(oculta));
      }
      return;
    }
    if ((el = b('[data-voltear]'))) { e.preventDefault(); m.voltear?.(); return; }
    // La matriz del 4 (encargo «el4»): pulsar una celda la abre (su lista de movimientos); ✕ o pulsarla otra vez la cierra.
    if ((el = b('[data-celda-matriz-cerrar]'))) { e.preventDefault(); m.celdaMatriz?.(el.closest('[data-rejilla]')?.dataset.huecoX ?? null, null); return; }
    if (!b('.matriz-abierta') && (el = b('[data-celda-matriz]'))) { e.preventDefault(); m.celdaMatriz?.(el.closest('[data-rejilla]')?.dataset.huecoX ?? null, el.dataset.celdaMatriz); return; }
    // Entrar en una celda: la profundidad es la del mundo de la rejilla (data-rejilla), no la del dígito del hijo donde está el ocupante.
    if ((el = b('[data-celda]'))) { e.preventDefault(); const k = Number(el.closest('.rejilla-celda.hijo[data-pv]')?.dataset.pv); m.celda?.(Number(el.closest('[data-rejilla]')?.dataset.rejilla ?? el.dataset.pv), el.dataset.celda, ...(Number.isInteger(k) ? [k] : [])); return; }
    // Bajar por el dígito de una celda (encargo «lecturas»: 1 → 1.1 → 1.1.1), en el mundo de la rejilla.
    if ((el = b('[data-bajar]'))) { e.preventDefault(); m.bajar?.(Number(el.closest('[data-rejilla]')?.dataset.rejilla), Number(el.dataset.bajar)); return; }
    if ((el = b('[data-subir]'))) { e.preventDefault(); m.subir?.(Number(el.dataset.subir)); return; }
    if ((el = b('[data-abrir]'))) { e.preventDefault(); if (el.dataset.abrir) m.foco?.(el.dataset.abrir, 0); return; }
    if ((el = b('[data-foco-pv]'))) { e.preventDefault(); m.foco?.(el.dataset.x ?? xDe(el), Number(el.dataset.focoPv)); return; }
    if ((el = b('[data-roseton]'))) { e.preventDefault(); m.roseton?.(Number(el.dataset.roseton)); return; }
    if ((el = pvDe(t)) && !t.closest('button') && !t.closest('.secuencia')) {
      // Toque sobre un PV lateral: un paso de tamaño; el doble toque sobre el centro, editar. En Sequenced, lo de dentro de
      // una fila abierta o del hilo no cambia nada al tocarlo (la fila se abre y se cierra por su cabeza).
      e.preventDefault();
      m.nivel?.(Number(el.dataset.pv), +1, el.dataset.x);
      return;
    }
    const centro = t.closest('[data-centro]');
    if (centro && !t.closest('button, input, label')) {
      const ahora = Date.now();
      if (ultimoToque.el === centro && ahora - ultimoToque.t < 350) { m.editar?.(centro.dataset.x, Number(centro.dataset.centro)); ultimoToque = { t: 0, el: null }; return; }
      ultimoToque = { t: ahora, el: centro };
    }
  });
  on('dblclick', (e) => {
    const t = e.target;
    // Doble clic (o doble toque) sobre un elemento con un registro detrás: ponerlo como foco, en Mapped y en Sequenced
    // (#23, propuesta de Core). Un clic sigue entrando y mantener sigue abriendo el aro; dentro del aro, de un diálogo o
    // de un texto, nada. Sobre el centro (que ya es el foco), editar, como antes.
    const primero = Date.now() - primerClic.t <= DOBLE_MS ? primerClic : null;
    primerClic = { t: 0, X: null, centro: false };
    if (t.closest('input, textarea, select, pre, .aro, .formulario, .guia')) return;
    if (primero?.X && !primero.centro) { e.preventDefault(); m.foco?.(primero.X, 0); return; }
    const centro = t.closest('[data-centro]');
    if (centro && !t.closest('button')) { e.preventDefault(); m.editar?.(centro.dataset.x, Number(centro.dataset.centro)); return; }
    const X = elementoDe(t);
    if (X) { e.preventDefault(); m.foco?.(X, 0); }
  });

  // ---- mantener (y clic derecho): el aro ----
  let mantener = null;
  const empezarMantener = (e) => {
    const t = e.target;
    if (e.button !== undefined && e.button !== 0) return; // el clic derecho va por contextmenu
    if (t.closest('textarea, select, .formulario, .guia') || (t.closest('input') && !t.closest('[data-campo]'))) return;
    if (!t.closest('.aro') && !t.closest('[data-x], [data-hueco-x]')) return;
    cancelarMantener();
    mantener = { timer: setTimeout(() => { mantener = null; mantenido(t, e.clientX, e.clientY); }, MANTENER_MS), x: e.clientX, y: e.clientY };
  };
  const cancelarMantener = () => {
    if (mantener) clearTimeout(mantener.timer);
    mantener = null;
  };
  on('contextmenu', (e) => {
    // el clic derecho (y el mantener del móvil, que el navegador da también como menú) es mantener; en un texto, el menú de siempre
    if (e.target.closest('input, textarea, pre')) return;
    cancelarMantener();
    if (mantenido(e.target, e.clientX, e.clientY)) e.preventDefault();
  });

  // ---- punteros: deslizar, arrastrar en vertical sobre el centro, pellizco ----
  const punteros = new Map();
  let pellizco = null;
  let asa = null; // el arrastre desde la esquina de un PV (Mapped)
  // Arrastrar a una persona de una caja del 3 a otra (encargo pv3): { persona, caja, x, y, el, activo }.
  let arrastre = null;
  /** La caja del 3 que hay bajo el puntero al soltar (lo que está debajo, si el documento lo dice; si no, donde se soltó). */
  const cajaBajo = (e) => {
    const bajo = documento.elementFromPoint?.(e.clientX, e.clientY) ?? e.target;
    const caja = bajo?.closest?.('[data-caja]');
    return caja ? Number(caja.dataset.caja) : null;
  };
  on('pointerdown', (e) => {
    const persona = e.target.closest?.('[data-persona]');
    if (persona && (e.button === undefined || e.button === 0)) arrastre = { persona: persona.dataset.persona, caja: Number(persona.dataset.caja), x: e.clientX, y: e.clientY, el: persona, activo: false };
    const a = e.target.closest?.('[data-asa]');
    if (a) {
      e.preventDefault();
      const escena = a.closest('.escena') ?? raiz;
      const r = escena.getBoundingClientRect?.() ?? { width: 0, height: 0 };
      asa = { pv: Number(a.dataset.asa), x: e.clientX, y: e.clientY, dx: Number(a.dataset.dx), dy: Number(a.dataset.dy), X: a.dataset.x, umbral: Math.max(24, Math.min(r.width, r.height) * UMBRAL_ASA) };
      a.setPointerCapture?.(e.pointerId);
      return;
    }
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY, t: Date.now(), el: e.target });
    if (punteros.size === 1) empezarMantener(e);
    if (punteros.size === 2) {
      cancelarMantener();
      const [a, b] = [...punteros.values()];
      pellizco = { d0: Math.hypot(a.x - b.x, a.y - b.y), el: pvDe(a.el) ?? pvDe(b.el), hecho: false };
    }
  });
  /** El centro de Mapped bajo el punto (x, y), si lo hay: donde se suelta lo arrastrado (#23). */
  const centroBajo = (x, y, objetivo) => {
    const el = documento.elementFromPoint?.(x, y) ?? objetivo;
    const centro = el?.closest?.('[data-centro]');
    return centro && centro.closest?.('.carta-matriz') ? centro : null;
  };
  /** Lo que se arrastra al centro: un elemento con registro detrás que no es el centro ni está en un diálogo. */
  const arrastrable = (el) => (el?.closest?.('[data-centro], .aro, .formulario, .guia, input, textarea, select') ? null : elementoDe(el));
  let sobreCentro = null;
  const marcarCentro = (c) => {
    if (sobreCentro === c) return;
    sobreCentro?.classList?.remove('soltar-aqui');
    sobreCentro = c;
    sobreCentro?.classList?.add('soltar-aqui');
  };
  on('pointermove', (e) => {
    if (arrastre && !arrastre.activo && Math.hypot(e.clientX - arrastre.x, e.clientY - arrastre.y) > UMBRAL_PERSONA) {
      // Se arrastra: ni mantener (el aro) ni deslizar; la persona va marcada mientras.
      arrastre.activo = true;
      cancelarMantener();
      arrastre.el?.classList?.add('arrastrando');
    }
    if (arrastre?.activo) { e.preventDefault?.(); return; }
    const p = punteros.get(e.pointerId);
    if (!p) return;
    if (mantener && Math.hypot(e.clientX - mantener.x, e.clientY - mantener.y) > 8) cancelarMantener();
    if (punteros.size === 1 && Math.hypot(e.clientX - p.x, e.clientY - p.y) > UMBRAL_ARRASTRE && arrastrable(p.el)) marcarCentro(centroBajo(e.clientX, e.clientY, e.target));
    if (pellizco && punteros.size === 2) {
      punteros.set(e.pointerId, { ...p, x: e.clientX, y: e.clientY });
      const [a, b] = [...punteros.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (!pellizco.hecho && Math.abs(d - pellizco.d0) > UMBRAL_PELLIZCO) {
        pellizco.hecho = true;
        const pv = pellizco.el ? Number(pellizco.el.dataset.pv) : null;
        m.profundidad?.(d > pellizco.d0 ? +1 : -1, pv, pellizco.el?.dataset.x ?? null);
      }
    }
  });
  const soltar = (e) => {
    if (arrastre) {
      const a = arrastre;
      arrastre = null;
      a.el?.classList?.remove('arrastrando');
      if (a.activo) {
        punteros.delete(e.pointerId);
        cancelarMantener();
        arrastrado = Date.now(); // el clic que sigue no entra
        const caja = cajaBajo(e);
        if (Number.isInteger(caja) && caja !== a.caja) m.reclasificar?.(a.persona, caja);
        return;
      }
    }
    if (asa) {
      // Lo recorrido en la dirección en que crece el PV (de su esquina o lado hacia el centro): un paso por umbral.
      const n = Math.hypot(asa.dx, asa.dy) || 1;
      const recorrido = ((e.clientX - asa.x) * asa.dx + (e.clientY - asa.y) * asa.dy) / n;
      const pasos = Math.trunc(recorrido / asa.umbral);
      const { pv, X } = asa;
      asa = null;
      arrastrado = Date.now();
      if (pasos) m.nivel?.(pv, pasos, X);
      return;
    }
    const p = punteros.get(e.pointerId);
    punteros.delete(e.pointerId);
    cancelarMantener();
    marcarCentro(null);
    if (punteros.size === 0) pellizco = null;
    if (!p || pellizco) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    // Arrastrar al centro (#23, solo Mapped): lo soltado sobre el centro pasa a ser el foco; el clic que sigue no cuenta.
    if (Math.hypot(dx, dy) > UMBRAL_ARRASTRE) {
      const X = arrastrable(p.el);
      const centro = X ? centroBajo(e.clientX, e.clientY, e.target) : null;
      if (centro && centro.dataset?.x !== X) { arrastrado = Date.now(); m.foco?.(X, 0); return; }
    }
    if (Date.now() - p.t > 900) return;
    if (Math.abs(dx) > UMBRAL_DESLIZAR && Math.abs(dx) > Math.abs(dy) * 1.5 && !p.el.closest?.('input, .formulario, .aro, .guia')) {
      m.hermano?.(dx < 0 ? +1 : -1, pvDe(p.el) ? Number(pvDe(p.el).dataset.pv) : null);
    } else if (Math.abs(dy) > UMBRAL_DESLIZAR * 1.5 && Math.abs(dy) > Math.abs(dx) * 1.5 && p.el.closest?.('[data-centro]') && !p.el.closest?.('input, pre, ul, ol')) {
      m.voltear?.(); // mantener y arrastrar en vertical sobre el centro: el atajo para dar la vuelta
    }
  };
  on('pointerup', soltar);
  on('pointercancel', (e) => { punteros.delete(e.pointerId); cancelarMantener(); marcarCentro(null); pellizco = null; asa = null; arrastre?.el?.classList?.remove('arrastrando'); arrastre = null; });

  // ---- rueda con Ctrl: profundidad ----
  on('wheel', (e) => {
    if (!e.ctrlKey) return;
    const el = pvDe(e.target);
    e.preventDefault();
    m.profundidad?.(e.deltaY < 0 ? +1 : -1, el ? Number(el.dataset.pv) : null, el?.dataset.x ?? null);
  }, { passive: false });

  // ---- teclado (en el documento: Esc y las teclas valen aunque el foco esté fuera de la carta) ----
  on('keydown', (e) => {
    if (e.target.closest('input, textarea, select')) {
      if (e.key === 'Escape') { e.target.blur(); m.cerrar?.(); }
      return;
    }
    if (e.key === 'Escape') { m.cerrar?.(); return; }
    // con el aro abierto, gana él: 1-4 y 6-9 lanzan la acción por defecto de ese sitio; 0 y 5 no hacen nada (no hay sitio)
    if (/^[0-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey && raiz.querySelector('.aro')) { e.preventDefault(); m.aroTecla?.(Number(e.key)); return; }
    if (/^[0-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); m.saltar?.(Number(e.key)); return; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); m.hermano?.(e.key === 'ArrowRight' ? +1 : -1, null); return; }
    if (e.key === 'Enter') {
      const el = pvDe(e.target);
      if (el) { e.preventDefault(); m.nivel?.(Number(el.dataset.pv), e.shiftKey ? -1 : +1, el.dataset.x); }
      return;
    }
    if (e.key === ' ' && e.target.closest('[data-centro]')) { e.preventDefault(); m.voltear?.(); }
  }, undefined, documento);

  // ---- formularios e inputs ----
  on('submit', (e) => {
    const f = e.target;
    e.preventDefault();
    if (f.matches('[data-formulario]')) m.enviar?.(f);
    else if (f.matches('[data-configuracion]')) m.configurar?.(f);
    else if (f.matches('[data-crear]')) m.crear?.(f);
    else if (f.matches('[data-restaurar]')) m.restaurar?.(f);
    else if (f.matches('[data-copia-form]')) m.copia?.(f);
    else if (f.matches('[data-guia-form]')) m.guiaPreguntar?.(f.querySelector('[data-guia-pregunta]')?.value ?? '');
  });
  on('change', (e) => {
    const t = e.target;
    if (t.matches('[data-otro-de]')) {
      // Un parámetro con valores posibles: el elegido va al input (oculto); «otro…» lo destapa para escribir. Solo pantalla.
      const input = t.ownerDocument?.getElementById?.(t.dataset.otroDe);
      if (!input) return;
      const otro = t.selectedOptions?.[0]?.hasAttribute?.('data-otro') ?? false;
      input.hidden = !otro;
      input.value = otro ? '' : t.value;
      if (otro) input.focus?.();
      return;
    }
    // La escala de la que parte la T que se quema al ejecutar (VG 12-11, decisión 7): la denominación se recalcula.
    if (t.matches('[data-denominacion]')) { m.denominacion?.(t.value, t.form ?? t.closest?.('form') ?? null); return; }
    if (t.matches('[data-quien]')) m.quien?.(t.value);
    else if (t.matches('[data-ejemplo]')) m.ejemplo?.(t.value);
    else if (t.matches('[data-campo]')) {
      const texto = t.value.trim();
      if (texto) m.campo?.(t.dataset.x, Number(t.dataset.campo), texto, { nuevo: t.dataset.nuevo !== undefined });
    }
  });
  on('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches?.('[data-campo]')) { e.preventDefault(); e.target.blur(); }
  });

  // ---- tirar al final: cargar más (el botón entra en pantalla) ----
  let obs = null;
  if ('IntersectionObserver' in globalThis) {
    obs = new IntersectionObserver((entradas) => {
      for (const en of entradas) if (en.isIntersecting && en.target.dataset.cargarMas !== undefined && !en.target.__visto) { en.target.__visto = true; m.cargarMas?.(Number(en.target.dataset.cargarMas)); }
    }, { rootMargin: '0px 0px 40px 0px' });
    quitar.push(() => obs.disconnect());
  }
  /** Observa los botones de «cargar más» del pintado actual: lo llama la app tras cada pintado. */
  const observar = () => {
    if (!obs) return;
    obs.disconnect();
    for (const b of raiz.querySelectorAll('[data-cargar-mas]')) obs.observe(b);
  };

  return Object.assign(() => { for (const q of quitar) q(); }, { observar });
}
