// config.js
// Configuración COMPARTIDA por los dos microservicios (auth-service y svc-pagos).
//
// OJO DIDÁCTICO: el script de ataque (attack.js) NO importa este archivo.
// El atacante nunca conoce JWT_SECRET: todo lo que hace lo logra sin la clave.

// Siempre localhost: esta demo no escucha en ninguna otra interfaz.
const HOST = '127.0.0.1';

const PUERTO_AUTH = 4000;
const PUERTO_PAGOS = 4001;

// Clave simétrica (HS256) compartida entre emisor y verificador.
// Es de laboratorio. En producción: variable de entorno / gestor de secretos,
// o mejor aún RS256/ES256 (el servicio consumidor solo tiene la clave PÚBLICA).
const JWT_SECRET = 'clave-de-laboratorio-deasrrollo-software-univalle';

// Quién emite los tokens y para quién son.
const ISSUER = 'auth-service';
const AUDIENCIA_PAGOS = 'svc-pagos';

// Lista blanca de algoritmos. Nunca incluir "none".
const ALGORITMOS_PERMITIDOS = ['HS256'];

// Modos de la demo (variable de entorno MODE).
const MODOS = ['vulnerable', 'secure'];

module.exports = {
  HOST,
  PUERTO_AUTH,
  PUERTO_PAGOS,
  JWT_SECRET,
  ISSUER,
  AUDIENCIA_PAGOS,
  ALGORITMOS_PERMITIDOS,
  MODOS,
};
