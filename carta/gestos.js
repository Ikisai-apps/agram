// Los gestos de la carta (tabla de VG). Móvil: toque = enfocar (un paso de tamaño), mantener = abrir el aro, doble toque
// = editar (0 o 5), deslizar vertical = recorrer (el scroll de la franja), horizontal = cambiar de PV o hermano, pellizco
// = profundidad, tirar al final = cargar más. Ordenador: clic, clic derecho o mantener, doble clic, rueda y flechas,
// flechas ← → y teclas 0-9 (saltar al PV), rueda con Ctrl, Enter y Esc, clic en «cargar más». Hover solo en ordenador
// (CSS). Interactuar en pantalla o por el aro es lo mismo: aquí solo se traducen los eventos del navegador a las
// llamadas de la app; nada se decide.

const MANTENER_MS = 450;
const UMBRAL_DESLIZAR = 40;
const UMBRAL_PELLIZCO = 30;
/** Arrastrar desde la esquina de un PV (Mapped): cada tanto de esta fracción del lado menor de la escena es un paso. */
const UMBRAL_ASA = 1 / 8;

/**
 * Engancha los gestos en `raiz` y los traduce a los manejadores de la app:
 *   nivel(pv, delta, X)      un paso de tamaño en un PV lateral (toque, Enter, rueda con Ctrl, pellizco)
 *   foco(X, pv)              entrar en un registro (o en un PV como foco)
 *   voltear()                dar la vuelta al centro (0 ↔ 5)
 *   aro(X, pv | null)        abrir el aro sobre X (y desplegar el hueco pv); null cierra
 *   lanzar(X, accion, paso)  abrir el formulario de una acción (o del paso del camino)
 *   cerrar()                 cerrar el aro, el formulario o la configuración
 *   enviar(form)             enviar el formulario de una acción
 *   configurar(form | null)  abrir la configuración (null) o guardarla (el formulario)
 *   campo(X, pv, texto)      escribir un ocupante nuevo en la posición pv de X
 *   cargarMas(pv)            una página más de ocupantes del PV
 *   roseton(pv)              un paso en un rosetón de identidad
 *   leido()                  alternar la lente «leído»
 *   englobar()               guardar este rato (englobar el libro local)
 *   guiaExportar() · guiaImportar()  la salida externa del PV9 (carta/externa.js): descargar el contexto, elegir el archivo de propuestas
 *   propuesta(que, id)       aceptar, modificar o rechazar una propuesta importada (el paso de la tercera fuente del camino)
 *   quien(id) · ejemplo(id) · reiniciar() · seguir()
 *   arranque(que)            la pantalla de arranque: menu, crear, restaurar, ejemplo o cuenta:<alta>
 *   crear(form) · restaurar(form) · copia(form | null) · olvidar()   mi cuenta: crearla, restaurarla de su copia, la copia de seguridad, olvidarla
 *   hermano(delta)           cambiar de PV o de hermano (deslizar horizontal, flechas ← →)
 *   saltar(pv)               las teclas 0-9: ir a ese PV
 *   todos(delta)             Mapped: los puntitos del foco (un paso a todos los PV) y su mando para bajar
 *   preferencia(clave, valor) un interruptor de la barra (sobrio o animado): escribir esa preferencia
 *   pagina(pv, delta)        Mapped: la página siguiente o la anterior de un PV (sin scroll)
 * En Mapped, nivel(pv, delta, X) llega también de los botoncitos de cada PV (data-tamano) y del arrastre desde su
 * esquina (data-asa: tantos pasos como umbrales recorre en la dirección que va de su esquina al centro).
 * Devuelve una función que quita los ganchos.
 */
export function instalar(raiz, m) {
  const quitar = [];
  const on = (tipo, fn, opciones, donde = raiz) => {
    donde.addEventListener(tipo, fn, opciones);
    quitar.push(() => donde.removeEventListener(tipo, fn, opciones));
  };
  const documento = raiz.ownerDocument ?? raiz;
  const pvDe = (el) => el?.closest?.('[data-pv]:not(.ocupante)'); // un ocupante anidado también lleva data-pv (su color), pero no es un PV
  const xDe = (el) => el?.closest?.('[data-x]')?.dataset.x ?? null;

  // ---- toques y clics ----
  let ultimoToque = { t: 0, el: null };
  let arrastrado = 0; // tras arrastrar un asa, el clic que sigue no cuenta
  on('click', (e) => {
    const t = e.target;
    if (t.closest('input, textarea, select, option, pre')) return;
    if (Date.now() - arrastrado < 400) { e.preventDefault(); return; }
    const b = (sel) => t.closest(sel);
    let el;
    if ((el = b('[data-cerrar]')) && (t === el || t.closest('.cerrar'))) { e.preventDefault(); m.cerrar?.(); return; }
    if (t.closest('.formulario, .aro, .guia') && !t.closest('button')) return; // dentro de un diálogo (o de la guía), nada más que los botones
    if ((el = b('[data-guia-rapida]'))) { e.preventDefault(); m.guiaRapida?.(Number(el.dataset.guiaRapida)); return; }
    if ((el = b('[data-guia-vaciar]'))) { e.preventDefault(); m.guiaVaciar?.(); return; }
    if ((el = b('[data-guia-exportar]'))) { e.preventDefault(); m.guiaExportar?.(); return; }
    if ((el = b('[data-guia-importar]'))) { e.preventDefault(); m.guiaImportar?.(); return; }
    for (const que of ['aceptar', 'modificar', 'rechazar']) {
      if ((el = b(`[data-propuesta-${que}]`))) { e.preventDefault(); m.propuesta?.(que, el.dataset[`propuesta${que[0].toUpperCase()}${que.slice(1)}`]); return; }
    }
    if ((el = b('[data-todos]'))) { e.preventDefault(); m.todos?.(Number(el.dataset.todos)); return; }
    if ((el = b('[data-tamano]'))) { e.preventDefault(); m.nivel?.(Number(el.dataset.pv), Number(el.dataset.tamano), el.dataset.x); return; }
    if ((el = b('[data-preferencia]'))) { e.preventDefault(); m.preferencia?.(el.dataset.preferencia, el.dataset.valor); return; }
    if ((el = b('[data-pagina]'))) { e.preventDefault(); m.pagina?.(Number(el.dataset.pagina), Number(el.dataset.delta)); return; }
    if (b('[data-asa]')) { e.preventDefault(); return; }
    if ((el = b('[data-lanzar]'))) { e.preventDefault(); m.lanzar?.(el.dataset.x ?? xDe(el), el.dataset.lanzar, el.dataset.paso !== undefined ? Number(el.dataset.paso) : null); return; }
    if ((el = b('[data-aro-hueco]'))) { e.preventDefault(); m.aro?.(xDe(el) ?? el.closest('.aro')?.dataset.x, Number(el.dataset.aroHueco), { desplegar: true }); return; }
    if ((el = b('[data-cargar-mas]'))) { e.preventDefault(); m.cargarMas?.(Number(el.dataset.cargarMas)); return; }
    if ((el = b('[data-seguir]'))) { e.preventDefault(); m.seguir?.(); return; }
    if ((el = b('[data-englobar]'))) { e.preventDefault(); m.englobar?.(); return; }
    if ((el = b('[data-config]'))) { e.preventDefault(); m.configurar?.(null); return; }
    if ((el = b('[data-reiniciar]'))) { e.preventDefault(); m.reiniciar?.(); return; }
    if ((el = b('[data-arranque]'))) { e.preventDefault(); m.arranque?.(el.dataset.arranque); return; }
    if ((el = b('[data-copia]'))) { e.preventDefault(); m.copia?.(null); return; }
    if ((el = b('[data-olvidar]'))) { e.preventDefault(); m.olvidar?.(); return; }
    if ((el = b('[data-leido]'))) { e.preventDefault(); m.leido?.(); return; }
    if ((el = b('[data-voltear]'))) { e.preventDefault(); m.voltear?.(); return; }
    if ((el = b('[data-abrir]'))) { e.preventDefault(); if (el.dataset.abrir) m.foco?.(el.dataset.abrir, 0); return; }
    if ((el = b('[data-foco-pv]'))) { e.preventDefault(); m.foco?.(el.dataset.x ?? xDe(el), Number(el.dataset.focoPv)); return; }
    if ((el = b('[data-roseton]'))) { e.preventDefault(); m.roseton?.(Number(el.dataset.roseton)); return; }
    if ((el = pvDe(t)) && !t.closest('button')) {
      // Toque sobre un PV lateral: un paso de tamaño; el doble toque sobre el centro, editar.
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
    const centro = e.target.closest('[data-centro]');
    if (centro && !e.target.closest('button, input')) { e.preventDefault(); m.editar?.(centro.dataset.x, Number(centro.dataset.centro)); }
  });

  // ---- mantener (y clic derecho): el aro ----
  let mantener = null;
  const empezarMantener = (e) => {
    const el = e.target.closest('[data-x]');
    if (!el || e.target.closest('input, textarea, select, .aro, .formulario, .guia')) return;
    cancelarMantener();
    mantener = { timer: setTimeout(() => { mantener = null; m.aro?.(el.dataset.x, null); }, MANTENER_MS), x: e.clientX, y: e.clientY };
  };
  const cancelarMantener = () => {
    if (mantener) clearTimeout(mantener.timer);
    mantener = null;
  };
  on('contextmenu', (e) => {
    const el = e.target.closest('[data-x]');
    if (!el || e.target.closest('input, textarea, pre')) return;
    e.preventDefault();
    cancelarMantener();
    m.aro?.(el.dataset.x, null);
  });

  // ---- punteros: deslizar, arrastrar en vertical sobre el centro, pellizco ----
  const punteros = new Map();
  let pellizco = null;
  let asa = null; // el arrastre desde la esquina de un PV (Mapped)
  on('pointerdown', (e) => {
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
  on('pointermove', (e) => {
    const p = punteros.get(e.pointerId);
    if (!p) return;
    if (mantener && Math.hypot(e.clientX - mantener.x, e.clientY - mantener.y) > 8) cancelarMantener();
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
    if (punteros.size === 0) pellizco = null;
    if (!p || pellizco) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (Date.now() - p.t > 900) return;
    if (Math.abs(dx) > UMBRAL_DESLIZAR && Math.abs(dx) > Math.abs(dy) * 1.5 && !p.el.closest?.('input, .formulario, .aro, .guia')) {
      m.hermano?.(dx < 0 ? +1 : -1, pvDe(p.el) ? Number(pvDe(p.el).dataset.pv) : null);
    } else if (Math.abs(dy) > UMBRAL_DESLIZAR * 1.5 && Math.abs(dy) > Math.abs(dx) * 1.5 && p.el.closest?.('[data-centro]') && !p.el.closest?.('input, pre, ul')) {
      m.voltear?.(); // mantener y arrastrar en vertical sobre el centro: el atajo para dar la vuelta
    }
  };
  on('pointerup', soltar);
  on('pointercancel', (e) => { punteros.delete(e.pointerId); cancelarMantener(); pellizco = null; asa = null; });

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
    if (t.matches('[data-quien]')) m.quien?.(t.value);
    else if (t.matches('[data-ejemplo]')) m.ejemplo?.(t.value);
    else if (t.matches('[data-campo]')) {
      const texto = t.value.trim();
      if (texto) m.campo?.(t.dataset.x, Number(t.dataset.campo), texto);
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
