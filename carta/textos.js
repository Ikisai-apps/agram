// Los textos propios de la carta (los botones, «soy», «configuración», «guardar este rato», «leído»…): lo que no viene
// de la época ni del eje sino de la propia interfaz. Están en un solo sitio para poder traducirlos luego por el mismo
// idioma de la configuración (epoch.9.3, «language»); hoy solo hay español. Todo lo que sí viene de la época (los
// nombres de las acciones, las etiquetas, las ayudas, los motivos, los niveles) pasa por contrato.texto() y
// contrato.legible(), nunca por aquí. Un hueco {nombre} se rellena con t(clave, partes).

export const TEXTOS = Object.freeze({
  es: Object.freeze({
    // la barra
    soy: 'soy',
    cosa: '(cosa)',
    ejemplo: 'ejemplo',
    hoy: 'hoy: {segundos} s',
    tiempoLocalTitulo: 'T de {serie} gastado hoy en este navegador (libro local), y lo gastado hoy en el eje',
    englobar: 'guardar este rato',
    englobarTitulo: 'englobar las {cuantas} interacciones de este rato en un minuto y asentarlo en el eje',
    configuracion: 'configuración',
    configuracionTitulo: 'sobrio o animado, paso, tamaños, modelo, idioma: un registro de mi alta',
    reiniciar: 'reiniciar',
    reiniciarTitulo: 'borra lo guardado en este navegador y vuelve al ejemplo',
    sinRegistro: 'sin registro',
    noHayFoco: 'no hay registro en foco',
    // el centro
    voltear: 'dar la vuelta',
    voltearAnverso: 'ver cómo encaja',
    voltearReverso: 'ver la representación',
    leido: 'leído',
    leidoVer: 'ver el registro como texto, una línea por posición',
    leidoOcultar: 'ocultar el registro como texto, una línea por posición',
    madurezTitulo: 'madurez: nivel {nivel} de {de}',
    plantilla: 'plantilla',
    sinPlantilla: 'sin plantilla',
    sobre: 'sobre',
    laRaiz: 'la raíz',
    en: 'en',
    volverAl0: 'volver al 0',
    // los puntos de vista
    entrar: 'entrar',
    entrarEn: 'entrar en {que}',
    cargarMas: 'cargar más · {cuantos} más',
    transaccion: 'transacción',
    transacciones: 'transacciones',
    nada: '∅',
    deMiAlta: '{que} de mi alta',
    miFoco: 'mi foco',
    // el camino
    hecho: 'hecho',
    esperaA: 'espera a {quien}',
    paraUbicarse: 'para ubicarse:',
    seguir: 'seguir',
    nadaQueHacerAqui: 'nada que hacer aquí',
    camino: 'camino',
    // el aro
    aroDe: 'aro de {que}',
    cerrar: 'cerrar',
    nadaQueHacer: 'nada que hacer',
    lasDemasAcciones: 'las demás acciones de {que}',
    // el formulario
    requerido: 'requerido',
    verEnBtml: 'ver en BTML',
    noSeOfrece: 'esta acción no se ofrece ahora sobre este registro; se puede intentar igual',
    leer: 'leer',
    darElPaso: 'dar el paso',
    lanzar: 'lanzar',
    // la configuración
    miConfiguracion: 'mi configuración',
    configuracionAyuda: 'es un registro de mi alta (plantilla «{plantilla}»): se escribe como cualquier otro',
    guardar: 'guardar',
    // los mensajes de la app
    guardadoEnNavegador: 'guardado en este navegador · {cuantos} registros',
    sinAlmacenamiento: 'sin almacenamiento: nada se guarda al recargar',
    cargadoDelNavegador: 'cargado del navegador · {cuantos} registros',
    ejeApartado: 'El eje guardado en este navegador no se ha podido abrir (formato anterior o claves de otra sesión). Queda apartado en «{clave}» y se empieza con el ejemplo.',
    noSePinta: 'la carta no se ha podido pintar: {motivo}',
    noSeLee: 'no se puede leer: {motivo}',
    sinLottie: 'lottie-web no se ha podido cargar: las piezas animadas quedan como su forma sobria',
    registrado: '{accion}: registrado {id}',
    firmado: '· firmado',
    pasosMios: '{cuantos} pasos míos',
    elPaso: 'el paso: {que}',
    sinAlta: 'sin alta: nadie a quien configurar',
    configuracionGuardada: 'configuración guardada como un registro de mi alta',
    escrito: 'escrito {id} en {pv} sobre {X}',
    unRatoEnLaCarta: 'un rato en la carta',
    esteRatoEnElEje: 'este rato queda en el eje como un minuto: {id}',
    nadaQueEnglobar: 'nada que englobar',
    hechos: 'hechos: {cuales}',
    ningunPasoDado: 'ningún paso dado',
    paradoEn: '· parado en «{que}»: {motivos}',
    noArranca: 'La carta no ha podido arrancar: {motivo}',
  }),
});

/** El idioma de la interfaz propia: el de la configuración si hay textos en él; si no, el primero que haya. */
export function idiomaDeInterfaz(idioma) {
  return idioma && TEXTOS[idioma] ? idioma : Object.keys(TEXTOS)[0];
}

/** Un texto de la carta por su clave, con los huecos {nombre} rellenos; si falta la clave, la clave misma. */
export function t(clave, partes = {}, idioma) {
  const plantilla = TEXTOS[idiomaDeInterfaz(idioma)][clave] ?? clave;
  return plantilla.replace(/\{([^{}]+)\}/g, (_, k) => (partes[k] === undefined || partes[k] === null ? '' : String(partes[k])));
}
