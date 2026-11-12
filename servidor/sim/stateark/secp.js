// secp256k1 mínima, sin dependencias, solo para lo que la sim necesita: subir una x a un punto (lift_x de
// BIP-340), sumar puntos y multiplicar por un escalar, para calcular el TapTweak de BIP-341. NO firma ni
// guarda secretos, y no es de tiempo constante: no la uses con claves privadas. Comprobada contra
// rust-miniscript 12.3.7 (la clave de salida del candado, test/vectores/miniscript.json).

const P = 2n ** 256n - 2n ** 32n - 977n;
export const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const G = {
  x: 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n,
  y: 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n,
};

const mod = (a, m = P) => ((a % m) + m) % m;
function potencia(b, e, m = P) {
  let r = 1n;
  let x = mod(b, m);
  let k = e;
  while (k > 0n) {
    if (k & 1n) r = (r * x) % m;
    x = (x * x) % m;
    k >>= 1n;
  }
  return r;
}
const inv = (a) => potencia(a, P - 2n);

/** Punto de x (BIP-340 lift_x): el de y par. Lanza si x no está en la curva. */
export function liftX(xHex) {
  const x = BigInt('0x' + xHex);
  if (x >= P) throw new RangeError('x fuera del cuerpo');
  const c = mod(x ** 3n + 7n);
  const y = potencia(c, (P + 1n) / 4n);
  if ((y * y) % P !== c) throw new RangeError('x no está en la curva');
  return { x, y: y % 2n === 0n ? y : P - y };
}

export function sumar(a, b) {
  if (a === null) return b;
  if (b === null) return a;
  if (a.x === b.x && mod(a.y + b.y) === 0n) return null;
  const l = a.x === b.x ? mod(3n * a.x * a.x * inv(2n * a.y)) : mod((b.y - a.y) * inv(b.x - a.x));
  const x = mod(l * l - a.x - b.x);
  return { x, y: mod(l * (a.x - x) - a.y) };
}

export function multiplicar(k, punto = G) {
  let r = null;
  let q = punto;
  let e = mod(k, N);
  while (e > 0n) {
    if (e & 1n) r = sumar(r, q);
    q = sumar(q, q);
    e >>= 1n;
  }
  return r;
}

/** Q = lift_x(P) + t·G, con t como entero de 32 bytes en hex. Devuelve la x de Q (64 hex) y su paridad. */
export function ajustar(internaHex, tHex) {
  const t = BigInt('0x' + tHex);
  if (t >= N) throw new RangeError('el ajuste no es un escalar válido');
  const q = sumar(liftX(internaHex), multiplicar(t));
  if (q === null) throw new RangeError('el ajuste da el punto del infinito');
  return { clave: q.x.toString(16).padStart(64, '0'), paridad: Number(q.y & 1n) };
}
