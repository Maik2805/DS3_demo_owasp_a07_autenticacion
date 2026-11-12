// start.js
// Lanza los dos microservicios (cada uno en su propio proceso) con el MODE indicado.
// Uso: node start.js vulnerable | node start.js secure
// (Se evita "MODE=... node ..." porque no funciona igual en Windows y Linux/Mac.)

const { spawn } = require('child_process');
const path = require('path');
const ui = require('./ui');
const { MODOS, HOST, PUERTO_AUTH, PUERTO_PAGOS } = require('./config');

const modo = process.argv[2];
if (!MODOS.includes(modo)) {
  console.error(ui.rojo('Uso: node start.js <vulnerable|secure>   (o: npm run vuln / npm run secure)'));
  process.exit(1);
}

ui.titulo(`MODO ${modo.toUpperCase()}  -  auth-service (:${PUERTO_AUTH})  +  svc-pagos (:${PUERTO_PAGOS})`);
if (modo === 'vulnerable') {
  console.log(`${ui.VULNERABLE} svc-pagos validará los JWT de forma INSEGURA (solo laboratorio, solo ${HOST}).`);
} else {
  console.log(`${ui.OK} svc-pagos validará firma, algoritmo, iss, aud y exp.`);
}
console.log(ui.tenue('Ctrl+C para detener ambos servicios. En otra terminal: npm run attack\n'));

const servicios = ['auth-service', 'svc-pagos'];
const hijos = servicios.map((nombre) =>
  spawn(process.execPath, [path.join(__dirname, nombre, 'index.js')], {
    env: { ...process.env, MODE: modo },
    stdio: 'inherit',
  })
);

let cerrando = false;
function cerrarTodo(codigo) {
  if (cerrando) return;
  cerrando = true;
  hijos.forEach((h) => h.kill());
  process.exit(codigo);
}

// Si un servicio se cae (p. ej. puerto ocupado), se detiene todo.
hijos.forEach((h) => h.on('exit', (codigo) => cerrarTodo(codigo || 0)));
process.on('SIGINT', () => cerrarTodo(0));
process.on('SIGTERM', () => cerrarTodo(0));
