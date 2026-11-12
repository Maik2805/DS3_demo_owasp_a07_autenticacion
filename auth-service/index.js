// auth-service/index.js  (puerto 4000)
// Microservicio 1: emite JWT tras un "login" simulado.
//
// Este servicio es CORRECTO en ambos modos: firma bien los tokens con HS256.
// El fallo de la demo está en cómo svc-pagos los VALIDA (ver svc-pagos/index.js).

const express = require('express');
const jwt = require('jsonwebtoken');
const ui = require('../ui');
const {
  HOST,
  PUERTO_AUTH,
  JWT_SECRET,
  ISSUER,
  AUDIENCIA_PAGOS,
} = require('../config');

// Usuarios de EJEMPLO, hardcodeados y en texto plano (solo para el laboratorio).
// En un sistema real: base de datos, contraseñas con hash lento (argon2/bcrypt) y MFA.
const USUARIOS = {
  ana: { password: 'ana123', role: 'user' },
  // "bruno" es administrador del servicio de inventario (otro microservicio del
  // ecosistema). Sirve para el ataque 3: reutilizar un token emitido para OTRA audiencia.
  bruno: { password: 'bruno123', role: 'admin' },
};

// Servicios para los que este emisor puede generar tokens (claim "aud").
const AUDIENCIAS_VALIDAS = [AUDIENCIA_PAGOS, 'svc-inventario'];

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ servicio: 'auth-service', estado: 'ok' });
});

// POST /login  { "username": "ana", "password": "ana123", "audience": "svc-pagos" (opcional) }
app.post('/login', (req, res) => {
  const { username, password, audience = AUDIENCIA_PAGOS } = req.body || {};
  const usuario = USUARIOS[username];

  if (!usuario || usuario.password !== password) {
    console.log(`${ui.AVISO} [auth-service] login fallido para "${username}"`);
    return res.status(401).json({ error: 'credenciales_invalidas' });
  }
  if (!AUDIENCIAS_VALIDAS.includes(audience)) {
    return res.status(400).json({ error: 'audiencia_no_soportada', audiencias: AUDIENCIAS_VALIDAS });
  }

  // Claims del token: sub, role, aud, iss, exp (+ iat que añade la librería).
  const token = jwt.sign({ role: usuario.role }, JWT_SECRET, {
    algorithm: 'HS256', // firma real con la clave del emisor
    subject: username, // sub
    audience, // aud -> para qué servicio es este token
    issuer: ISSUER, // iss
    expiresIn: '15m', // exp
  });

  console.log(
    `${ui.OK} [auth-service] token emitido: sub=${username} role=${usuario.role} aud=${audience}`
  );
  res.json({ token, tipo: 'Bearer', expira_en: '15m' });
});

const servidor = app.listen(PUERTO_AUTH, HOST, () => {
  console.log(
    ui.cian(`[auth-service] escuchando en http://${HOST}:${PUERTO_AUTH}  (usuarios de ejemplo: ana/ana123, bruno/bruno123)`)
  );
});

servidor.on('error', (err) => {
  console.error(ui.rojo(`[auth-service] no pudo arrancar: ${err.message}`));
  process.exit(1);
});
