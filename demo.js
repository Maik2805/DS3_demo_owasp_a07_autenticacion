// demo.js  ->  npm run demo
// Solo imprime el orden recomendado de la presentación (no arranca nada).

const ui = require('./ui');

ui.titulo('DEMO OWASP A07:2025 - JWT mal validado  (guion de ~2 minutos)');

console.log(`
${ui.negrita('Necesitas DOS terminales abiertas en esta carpeta.')}

${ui.amarillo('Paso 1  [Terminal 1]')}  npm run vuln
         Arranca auth-service (:4000) y svc-pagos (:4001) en modo VULNERABLE.

${ui.amarillo('Paso 2  [Terminal 2]')}  npm run attack
         Login normal de ana (rol user) y luego un token FORJADO sin la clave.
         Resultado esperado: ${ui.VULNERABLE} el token forjado es aceptado.

${ui.amarillo('Paso 3  [Terminal 1]')}  Ctrl+C  y luego  npm run secure
         Mismo código de ataque, ahora contra el servicio corregido.

${ui.amarillo('Paso 4  [Terminal 2]')}  npm run attack
         Resultado esperado: ${ui.BLOQUEADO} 401 con la razón del rechazo.

${ui.tenue('Todo corre solo en 127.0.0.1 con datos ficticios. Detalle en README.md.')}
`);
