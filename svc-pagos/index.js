// svc-pagos/index.js  (puerto 4001)
// Microservicio 2: expone datos sensibles (tarjetas FICTICIAS).
//
//   GET /api/me     -> cualquier token válido (muestra quién eres)
//   GET /api/cards  -> SOLO tokens válidos con rol "admin"
//
// MODE=vulnerable  -> valida el JWT de forma insegura (OWASP A07)
// MODE=secure      -> valida el JWT correctamente

const express = require('express');
const jwt = require('jsonwebtoken');
const ui = require('../ui');
const {
  HOST,
  PUERTO_PAGOS,
  JWT_SECRET,
  ISSUER,
  AUDIENCIA_PAGOS,
  ALGORITMOS_PERMITIDOS,
  MODOS,
} = require('../config');

const MODE = process.env.MODE || 'secure';
if (!MODOS.includes(MODE)) {
  console.error(ui.rojo(`[svc-pagos] MODE inválido: "${MODE}". Usa "vulnerable" o "secure".`));
  process.exit(1);
}

// Datos FICTICIOS (números de prueba públicos de pasarelas de pago).
const TARJETAS = [
  { id: 1, titular: 'Cliente Ficticio Uno', numero: '4111 1111 1111 1111', vence: '12/29', saldo: 8_450_000 },
  { id: 2, titular: 'Cliente Ficticio Dos', numero: '5555 5555 5555 4444', vence: '07/28', saldo: 1_230_500 },
  { id: 3, titular: 'Cliente Ficticio Tres', numero: '3782 822463 10005', vence: '03/30', saldo: 42_000_000 },
];

// ===========================================================================
//  VALIDACIÓN DEL TOKEN — AQUÍ ESTÁ LA VULNERABILIDAD Y SU CORRECCIÓN
// ===========================================================================

// ---------- ❌ MODO VULNERABLE ----------
function validarTokenVulnerable(token) {
  // >>> FALLO (CWE-347 / CWE-290 / CWE-287) <<<
  // jwt.decode() SOLO decodifica el Base64: NO comprueba la firma, NO mira "alg",
  // NO valida "aud", NO valida "iss" y NO valida "exp".
  // Un JWT no está cifrado: cualquiera puede escribir el payload que quiera.
  const decodificado = jwt.decode(token, { complete: true }); // <-- LÍNEA VULNERABLE

  if (!decodificado) throw new Error('token ilegible');

  console.log(
    `${ui.VULNERABLE} [svc-pagos] aceptó el token SIN verificar firma: ` +
      `alg=${decodificado.header.alg} sub=${decodificado.payload.sub} role=${decodificado.payload.role} aud=${decodificado.payload.aud}`
  );
  return decodificado.payload; // claims en los que se confía a ciegas
}

// ---------- ✅ MODO SEGURO ----------
function validarTokenSeguro(token) {
  // >>> CORRECCIÓN <<<
  // jwt.verify() comprueba, todo en una sola llamada:
  //   1) la FIRMA con la clave correcta (JWT_SECRET)
  //   2) algorithms: lista blanca -> rechaza "none" y cualquier otro algoritmo
  //   3) issuer:     el token lo emitió auth-service
  //   4) audience:   el token es PARA ESTE servicio (svc-pagos)
  //   5) exp:        no ha expirado (se valida siempre por defecto)
  return jwt.verify(token, JWT_SECRET, {
    algorithms: ALGORITMOS_PERMITIDOS, // <-- CORRECCIÓN 1: lista blanca, nunca "none"
    issuer: ISSUER, //                        <-- CORRECCIÓN 2: iss
    audience: AUDIENCIA_PAGOS, //             <-- CORRECCIÓN 3: aud
  });
}

// Traduce el error técnico de jsonwebtoken a una explicación en español.
// (Solo con fines didácticos: en producción NO se detalla el motivo al cliente.)
function explicarRechazo(err, token) {
  const parcial = jwt.decode(token, { complete: true });
  const alg = parcial && parcial.header && parcial.header.alg;
  const aud = parcial && parcial.payload && parcial.payload.aud;

  if (alg && !ALGORITMOS_PERMITIDOS.includes(alg)) {
    return `El algoritmo "${alg}" no está en la lista blanca (${ALGORITMOS_PERMITIDOS.join(', ')}). Un token alg:none no lleva firma y no puede ser de confianza.`;
  }
  if (err.name === 'TokenExpiredError') {
    return 'El token ha expirado (claim exp).';
  }
  if (/audience/i.test(err.message)) {
    return `La audiencia (aud) del token es "${aud}", pero este servicio exige "${AUDIENCIA_PAGOS}". El token fue emitido para otro servicio.`;
  }
  if (/issuer/i.test(err.message)) {
    return `El emisor (iss) no es el esperado ("${ISSUER}").`;
  }
  if (/signature/i.test(err.message)) {
    return 'La firma del token no es válida: el contenido fue modificado o se firmó con otra clave.';
  }
  return `Token inválido: ${err.message}`;
}

// Middleware de autenticación: aplica la validación según el modo.
function autenticar(req, res, next) {
  const cabecera = req.headers.authorization || '';
  const [esquema, token] = cabecera.split(' ');

  if (esquema !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'falta_token', motivo: 'Se requiere cabecera Authorization: Bearer <token>', modo: MODE });
  }

  try {
    req.claims = MODE === 'vulnerable' ? validarTokenVulnerable(token) : validarTokenSeguro(token);
    next();
  } catch (err) {
    const motivo = explicarRechazo(err, token);
    console.log(`${ui.BLOQUEADO} [svc-pagos] token rechazado (401): ${motivo}`);
    res.status(401).json({ error: 'token_invalido', motivo, modo: MODE });
  }
}

// Autorización por rol (se aplica DESPUÉS de autenticar).
// En modo vulnerable es inútil: el atacante escribe "role":"admin" en su propio token.
function requerirRol(rol) {
  return (req, res, next) => {
    if (req.claims.role !== rol) {
      console.log(`${ui.AVISO} [svc-pagos] 403: sub=${req.claims.sub} tiene rol "${req.claims.role}", se requiere "${rol}"`);
      return res.status(403).json({
        error: 'rol_insuficiente',
        motivo: `Se requiere rol "${rol}" y el token trae rol "${req.claims.role}".`,
        modo: MODE,
      });
    }
    next();
  };
}

// ===========================================================================
//  RUTAS
// ===========================================================================
const app = express();

app.get('/health', (req, res) => {
  res.json({ servicio: 'svc-pagos', estado: 'ok', modo: MODE });
});

app.get('/api/me', autenticar, (req, res) => {
  const { sub, role, aud, iss } = req.claims;
  res.json({ sub, role, aud, iss });
});

app.get('/api/cards', autenticar, requerirRol('admin'), (req, res) => {
  console.log(`${ui.OK} [svc-pagos] /api/cards entregado a sub=${req.claims.sub} (role=${req.claims.role})`);
  res.json({ aviso: 'DATOS FICTICIOS', tarjetas: TARJETAS });
});

const servidor = app.listen(PUERTO_PAGOS, HOST, () => {
  const etiquetaModo = MODE === 'vulnerable' ? ui.VULNERABLE : ui.OK;
  console.log(ui.cian(`[svc-pagos] escuchando en http://${HOST}:${PUERTO_PAGOS}`) + `  modo: ${etiquetaModo} ${MODE.toUpperCase()}`);
});

servidor.on('error', (err) => {
  console.error(ui.rojo(`[svc-pagos] no pudo arrancar: ${err.message}`));
  process.exit(1);
});
