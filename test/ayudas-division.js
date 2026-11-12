// Ayudas para las pruebas que cambian una fila de epoch.8.7 en una copia de los datos de la época (VG 13-11, #77: sin huecos
// ni rellenos, claves y valores). La fila es [[pv], [profundidad], [nota], [claves], [valores]]: el 3 son las claves de lo que
// la fila dice y el 4 sus valores, en paralelo.

/** La fila de epoch.8.7 de un PV en una copia de los datos de la época. */
export const filaDe = (e, pv) => e[8][7][1].find((f) => f[0][0] === pv);

/** Los atributos de una fila como { <clave>: [valores] }, en orden. */
export function atributos(fila) {
  const dicen = {};
  fila[3].forEach((k, i) => (dicen[k] ??= []).push(fila[4][i]));
  return dicen;
}

/** Cambia lo que la fila dice de `clave`: sus valores nuevos (varios repiten la clave) o ninguno (la quita, sin dejar hueco). */
export function poner(fila, clave, valores = []) {
  const claves = [];
  const dados = [];
  fila[3].forEach((k, i) => {
    if (k === clave) return;
    claves.push(k);
    dados.push(fila[4][i]);
  });
  for (const v of valores) {
    claves.push(clave);
    dados.push(v);
  }
  fila[3] = claves;
  fila[4] = dados;
  return fila;
}

/** Quita todas las claves que empiezan por `prefijo` (los «link <n>», los «<modo> form»). */
export function quitarPrefijo(fila, prefijo) {
  const claves = [];
  const dados = [];
  fila[3].forEach((k, i) => {
    if (k.startsWith(prefijo)) return;
    claves.push(k);
    dados.push(fila[4][i]);
  });
  fila[3] = claves;
  fila[4] = dados;
  return fila;
}

/** Los enlaces de la fila, { <n>: valor }, por su clave «link <n>». */
export function enlaces(fila) {
  return Object.fromEntries(fila[3].map((k, i) => [k, fila[4][i]]).filter(([k]) => /^link \d+$/.test(k)).map(([k, v]) => [Number(k.slice(5)), v]));
}

/** Pone los enlaces de la fila: { <n>: valor } (los que no estén, no se dicen). */
export function ponerEnlaces(fila, porNumero) {
  quitarPrefijo(fila, 'link ');
  for (const [n, v] of Object.entries(porNumero)) {
    fila[3].push('link ' + n);
    fila[4].push(v);
  }
  return fila;
}

/** Pone la forma de un modo (la clave «<modo> form»); `undefined` la quita (el modo hereda del anterior). */
export function ponerForma(fila, modo, forma) {
  return poner(fila, modo + ' form', forma === undefined ? [] : [forma]);
}

/** Los ejes de la matriz del 4 de la fila: { oficios: [nombre], ejecuciones: [[nombre, ...criterios]] }. */
export function ejes(fila) {
  const oficios = [];
  const ejecuciones = [];
  fila[3].forEach((k, i) => {
    if (k === 'office') oficios.push(fila[4][i]);
    else if (k === 'execution') ejecuciones.push([fila[4][i]]);
    else if (k === 'criterion') ejecuciones.at(-1).push(fila[4][i]);
  });
  return { oficios, ejecuciones };
}

/** Reescribe los ejes de la matriz del 4 de la fila. */
export function ponerEjes(fila, { oficios, ejecuciones }) {
  const claves = [];
  const dados = [];
  fila[3].forEach((k, i) => {
    if (k === 'office' || k === 'execution' || k === 'criterion') return;
    claves.push(k);
    dados.push(fila[4][i]);
  });
  for (const o of oficios) { claves.push('office'); dados.push(o); }
  for (const [nombre, ...criterios] of ejecuciones) {
    claves.push('execution'); dados.push(nombre);
    for (const c of criterios) { claves.push('criterion'); dados.push(c); }
  }
  fila[3] = claves;
  fila[4] = dados;
  return fila;
}

/** Deja la misma forma en todos los modos: solo la de Pointed, de la que heredan los demás. */
export function ponerFormaUnica(fila, forma) {
  const claves = [];
  const dados = [];
  fila[3].forEach((k, i) => {
    if (k.endsWith(' form')) return;
    claves.push(k);
    dados.push(fila[4][i]);
  });
  claves.push('pointed form');
  dados.push(forma);
  fila[3] = claves;
  fila[4] = dados;
  return fila;
}
