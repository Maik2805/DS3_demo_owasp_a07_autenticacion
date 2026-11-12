// ui.js
// Utilidades de salida por consola: colores ANSI y etiquetas legibles en proyector.
// Sin dependencias. Define NO_COLOR=1 para desactivar los colores.

const activo = !process.env.NO_COLOR;
const envolver = (codigo) => (texto) =>
  activo ? `\x1b[${codigo}m${texto}\x1b[0m` : String(texto);

const negrita = envolver('1');
const tenue = envolver('2');
const rojo = envolver('31');
const verde = envolver('32');
const amarillo = envolver('33');
const cian = envolver('36');

// Etiquetas con fondo de color (se leen bien a distancia).
const etiqueta = (texto, codigo) => envolver(codigo)(` ${texto} `);

const OK = etiqueta('OK', '1;30;42'); // negro sobre verde
const VULNERABLE = etiqueta('VULNERABLE', '1;97;41'); // blanco sobre rojo
const BLOQUEADO = etiqueta('BLOQUEADO', '1;30;42'); // negro sobre verde
const INFO = etiqueta('INFO', '1;30;46'); // negro sobre cian
const AVISO = etiqueta('AVISO', '1;30;43'); // negro sobre amarillo

function titulo(texto) {
  const linea = '='.repeat(Math.max(60, texto.length + 4));
  console.log('\n' + cian(linea));
  console.log(cian('  ') + negrita(texto));
  console.log(cian(linea));
}

function subtitulo(texto) {
  console.log('\n' + negrita(amarillo(texto)));
}

module.exports = {
  negrita,
  tenue,
  rojo,
  verde,
  amarillo,
  cian,
  OK,
  VULNERABLE,
  BLOQUEADO,
  INFO,
  AVISO,
  titulo,
  subtitulo,
};
