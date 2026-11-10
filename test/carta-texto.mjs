// La carta de texto vive en carta/texto.js (la guía del PV9 la usa para mandar a la IA lo que hay en pantalla); aquí se
// reexporta para las pruebas de siempre (test/contrato.test.js lee carta/texto.js para comprobar que solo importa el contrato).
export { pintar, pintarPara } from '../carta/texto.js';
