# Demo educativa — OWASP A07:2025 "Authentication Failures": JWT mal validado

Demo **mínima, didáctica y 100% local** para una presentación académica de la
Universidad del Valle. Simula dos microservicios y muestra, en vivo, cómo un
JWT mal validado permite escalar privilegios — y cómo se corrige.

## 1. Qué vulnerabilidad demuestra

**OWASP Top 10:2025 — A07: Authentication Failures** (antes "Identification and
Authentication Failures"). Dentro de esta categoría, el caso concreto es:

> **JWT mal validado en un microservicio consumidor**: el servicio confía en
> los *claims* de un token sin verificar su firma ni sus condiciones de uso.

CWE relacionados:

- **CWE-287 — Improper Authentication**: `svc-pagos` "autentica" a quien
  presenta cualquier JWT con forma válida, sin comprobar que lo haya emitido
  realmente `auth-service`.
- **CWE-347 — Improper Verification of Cryptographic Signature**: se usa
  `jwt.decode()` (solo decodifica Base64) en vez de `jwt.verify()` (verifica
  la firma HMAC/RSA). Es la causa raíz técnica del fallo.
- **CWE-290 — Authentication Bypass by Spoofing**: al no fijar una lista
  blanca de algoritmos, un atacante puede enviar un token con cabecera
  `"alg":"none"` — una familia de JWT sin firma que algunas librerías aceptan
  si no se restringe explícitamente el algoritmo — y el payload se acepta
  como si estuviera firmado.
- Relacionado también con **CWE-863 — Incorrect Authorization**: al no
  validar el claim `aud` (audiencia), un token legítimo emitido para *otro*
  servicio del mismo ecosistema puede reutilizarse contra `svc-pagos`.

Idea central para la clase: **un JWT no está cifrado, solo codificado en
Base64 y (si todo va bien) firmado**. La firma es lo único que impide que
alguien modifique el payload. Si el verificador no comprueba la firma, el
algoritmo permitido y para quién es el token (`aud`), el JWT no protege nada.

## 2. Requisitos e instalación

- Node.js **18 o superior** (probado con Node 20).
- Sin base de datos, sin frontend, sin red externa.

```bash
npm install
```

Dependencias (deliberadamente mínimas): `express` (servidores HTTP) y
`jsonwebtoken` (firmar/verificar/decodificar JWT). El script de ataque usa
`fetch`, incluido en Node 18+, sin librerías adicionales.

## 3. Aviso ético — leer antes de ejecutar

- Este proyecto es un **laboratorio educativo autocontenido**. Los dos
  servicios escuchan **únicamente en `127.0.0.1`** (nunca en `0.0.0.0`).
- Los usuarios (`ana`, `bruno`), contraseñas, claves JWT y datos de tarjetas
  son **100% ficticios** y existen solo en memoria del proceso.
- El script de ataque (`attack.js`) solo apunta a `http://127.0.0.1:4001`.
  **No la modifiques para apuntar a otro host.**
- **Nunca** ejecutes estas técnicas (tokens `alg:none`, forjado de claims,
  reutilización de audiencia) contra sistemas que no sean de tu propiedad o
  para los que no tengas autorización explícita de pruebas de seguridad.
  Úsalo solo para aprender el mecanismo en este entorno controlado.

## 4. Estructura del proyecto

```
config.js            Configuración compartida (puertos, clave JWT, issuer/audiencia, MODOS)
ui.js                 Colores y etiquetas de consola ([OK], [VULNERABLE], [BLOQUEADO]...)
auth-service/
  index.js            Microservicio 1 (puerto 4000): login simulado, emite JWT firmado
svc-pagos/
  index.js            Microservicio 2 (puerto 4001): GET /api/me y GET /api/cards
                      Contiene AMBAS rutas de validación (vulnerable y segura)
start.js              Lanza auth-service + svc-pagos juntos según MODE
attack.js             Script de ataque: NO conoce la clave JWT, todo lo hace sin ella
demo.js               Imprime el guion de presentación (no arranca nada)
package.json          Scripts: vuln, secure, attack, demo
```

`svc-pagos/index.js` define dos funciones de validación una junto a la otra
para poder compararlas línea por línea:

```js
// ❌ VULNERABLE — jwt.decode(): solo lee el Base64, no verifica NADA
function validarTokenVulnerable(token) {
  const decodificado = jwt.decode(token, { complete: true }); // <-- LÍNEA VULNERABLE
  return decodificado.payload;
}

// ✅ SEGURO — jwt.verify(): firma + lista blanca de algoritmos + iss + aud + exp
function validarTokenSeguro(token) {
  return jwt.verify(token, JWT_SECRET, {
    algorithms: ALGORITMOS_PERMITIDOS, // nunca "none"
    issuer: ISSUER,
    audience: AUDIENCIA_PAGOS,
  });
}
```

La variable de entorno `MODE` (`vulnerable` | `secure`) decide cuál de las
dos se usa. `start.js` la pasa a ambos procesos sin necesidad de sintaxis de
shell distinta entre Windows y Linux/Mac.

## 5. Paso a paso para presentar en clase (~2 minutos)

**Paso 0 — antes de clase:**
```bash
npm install
```
Abre **dos terminales** en esta carpeta (Terminal 1 para los servidores,
Terminal 2 para el ataque). Opcional: `npm run demo` muestra este mismo guion
en pantalla como recordatorio.

**Paso 1 — Terminal 1: arrancar en modo vulnerable**
```bash
npm run vuln
```
Verás que `auth-service` (:4000) y `svc-pagos` (:4001) quedan escuchando en
`127.0.0.1`, con la etiqueta `[VULNERABLE]`. *Qué decir:* "Estos dos procesos
simulan dos microservicios de un banco: uno emite la identidad (JWT), el
otro expone datos de tarjetas y confía en esa identidad."

**Paso 2 — Terminal 2: ejecutar el ataque**
```bash
npm run attack
```
El script primero hace login normal como `ana` (rol `user`) y muestra que
`GET /api/cards` le da `403` — correcto, un usuario normal no debería ver
tarjetas. Luego **forja** un token con cabecera `"alg":"none"` y
`"role":"admin"`, sin conocer la clave secreta, y lo envía. *Qué decir, y
leer en voz alta la línea señalada en consola:*
> "`jwt.decode()` solo decodifica el Base64 — **no verifica la firma**. Por
> eso un token sin firma (`alg:none`) con el rol que yo quiera es aceptado."

Resultado esperado: `[VULNERABLE] GET /api/cards -> 200` con las tarjetas
ficticias impresas.

**Paso 3 — Terminal 1: detener y arrancar en modo seguro**

`Ctrl+C` en la Terminal 1, luego:
```bash
npm run secure
```
Mismo código de ataque, mismo puerto — ahora contra el servicio corregido.

**Paso 4 — Terminal 2: repetir el ataque**
```bash
npm run attack
```
Resultado esperado: `[BLOQUEADO] GET /api/cards -> 401`, con el motivo
explicado en texto (algoritmo fuera de la lista blanca, o audiencia
incorrecta). *Qué decir, señalando la corrección en `svc-pagos/index.js`:*
> "`jwt.verify()` comprueba la firma con la clave real, exige que el
> algoritmo esté en una lista blanca (nunca `none`), y valida `iss`, `aud` y
> `exp`. Cualquiera de esas cuatro comprobaciones que falle, por sí sola,
> ya bloquea el ataque."

**Cierre:**
> "La lección de A07 no es 'no usar JWT', es **validar el JWT completo en
> cada microservicio que lo recibe**: firma, algoritmo permitido, emisor,
> audiencia y expiración — nunca confiar en un payload solo porque 'se ve
> bien formado'."

## 6. Plan B — si falla la red o el entorno

Si en el momento de la presentación algo no arranca (puerto ocupado, Node no
disponible, etc.), aquí está la salida real capturada previamente de cada
comando para poder narrarla sin ejecutar nada.

<details>
<summary><code>npm run vuln</code> (arranque en modo vulnerable)</summary>

```
==================================================================
  MODO VULNERABLE  -  auth-service (:4000)  +  svc-pagos (:4001)
==================================================================
[VULNERABLE] svc-pagos validará los JWT de forma INSEGURA (solo laboratorio, solo 127.0.0.1).
Ctrl+C para detener ambos servicios. En otra terminal: npm run attack

[auth-service] escuchando en http://127.0.0.1:4000  (usuarios de ejemplo: ana/ana123, bruno/bruno123)
[svc-pagos] escuchando en http://127.0.0.1:4001  modo: [VULNERABLE] VULNERABLE
```
</details>

<details>
<summary><code>npm run attack</code> contra <b>MODE=vulnerable</b> (ataque exitoso)</summary>

```
============================================================
  ATAQUE A svc-pagos  -  OWASP A07:2025 (JWT mal validado)
============================================================
Objetivo: http://127.0.0.1:4001   Modo detectado: [VULNERABLE] VULNERABLE

[1/3] Login normal como "ana" (rol user)
  [OK]  Token legítimo emitido por auth-service (firmado, HS256)
     claims: {"role":"user","iat":...,"exp":...,"aud":"svc-pagos","iss":"auth-service","sub":"ana"}
  [OK]  GET /api/me    -> 200  soy "ana" con rol "user"
  [OK]  GET /api/cards -> 403  Se requiere rol "admin" y el token trae rol "user".
     (correcto: un usuario normal NO debe ver las tarjetas)

[2/3] Forjando token  alg:none + role:"admin"  (sin conocer la clave)
     Un JWT NO está cifrado: es Base64 legible. Copiamos nuestros claims y cambiamos el rol.
     header : {"alg":"none","typ":"JWT"}
     payload: {"role":"admin","iat":...,"exp":...,"aud":"svc-pagos","iss":"auth-service","sub":"ana"}
     token  : eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJy...  (sin firma)
  [VULNERABLE]  GET /api/cards -> 200  ¡el token forjado fue ACEPTADO!
     Datos sensibles expuestos (ficticios):
       - Cliente Ficticio Uno   4111 1111 1111 1111  vence 12/29  saldo $8.450.000
       - Cliente Ficticio Dos   5555 5555 5555 4444  vence 07/28  saldo $1.230.500
       - Cliente Ficticio Tres  3782 822463 10005    vence 03/30  saldo $42.000.000

[3/3] Reutilizando un token legítimo emitido para OTRO servicio (aud distinta)
     "bruno" es admin de svc-inventario. Su token está bien firmado, pero NO es para svc-pagos.
  [OK]  Token legítimo (firma válida) con aud="svc-inventario" role="admin"
  [VULNERABLE]  GET /api/cards -> 200  ¡el token forjado fue ACEPTADO!
     Datos sensibles expuestos (ficticios): (las mismas 3 tarjetas)

============================================================
  RESUMEN
============================================================
[VULNERABLE] 2 de 2 ataques tuvieron éxito. svc-pagos confía en tokens que NO verificó.
  Causa: jwt.decode() en lugar de jwt.verify() (sin firma, sin algorithms, sin aud/iss/exp).
```
</details>

<details>
<summary><code>npm run secure</code> (arranque en modo seguro)</summary>

```
==============================================================
  MODO SECURE  -  auth-service (:4000)  +  svc-pagos (:4001)
==============================================================
[OK] svc-pagos validará firma, algoritmo, iss, aud y exp.
Ctrl+C para detener ambos servicios. En otra terminal: npm run attack

[svc-pagos] escuchando en http://127.0.0.1:4001  modo: [OK] SECURE
[auth-service] escuchando en http://127.0.0.1:4000  (usuarios de ejemplo: ana/ana123, bruno/bruno123)
```
</details>

<details>
<summary><code>npm run attack</code> contra <b>MODE=secure</b> (ataque bloqueado)</summary>

```
============================================================
  ATAQUE A svc-pagos  -  OWASP A07:2025 (JWT mal validado)
============================================================
Objetivo: http://127.0.0.1:4001   Modo detectado: [OK] SECURE

[1/3] Login normal como "ana" (rol user)
  [OK]  Token legítimo emitido por auth-service (firmado, HS256)
  [OK]  GET /api/me    -> 200  soy "ana" con rol "user"
  [OK]  GET /api/cards -> 403  Se requiere rol "admin" y el token trae rol "user".

[2/3] Forjando token  alg:none + role:"admin"  (sin conocer la clave)
     header : {"alg":"none","typ":"JWT"}
     token  : eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJy...  (sin firma)
  [BLOQUEADO]  GET /api/cards -> 401  el servidor rechazó el token
     Motivo: El algoritmo "none" no está en la lista blanca (HS256). Un token alg:none
             no lleva firma y no puede ser de confianza.

[3/3] Reutilizando un token legítimo emitido para OTRO servicio (aud distinta)
  [OK]  Token legítimo (firma válida) con aud="svc-inventario" role="admin"
  [BLOQUEADO]  GET /api/cards -> 401  el servidor rechazó el token
     Motivo: La audiencia (aud) del token es "svc-inventario", pero este servicio
             exige "svc-pagos". El token fue emitido para otro servicio.

============================================================
  RESUMEN
============================================================
[BLOQUEADO] 0 de 2 ataques tuvieron éxito. svc-pagos validó firma, algoritmo, aud, iss y exp.
  Corrección: jwt.verify(token, clave, { algorithms, issuer, audience }).
```
</details>

## 7. Antes vs. después

| Aspecto                          | `MODE=vulnerable`                              | `MODE=secure`                                      |
|-----------------------------------|-------------------------------------------------|-----------------------------------------------------|
| Función usada                    | `jwt.decode()` (no verifica nada)              | `jwt.verify()` (verifica firma y claims)             |
| Firma del token                  | No se comprueba                                | Se verifica con la clave correcta                    |
| Algoritmo (`alg`)                | Cualquiera, incluido `none`                    | Lista blanca (`HS256`); `none` se rechaza           |
| Audiencia (`aud`)                | No se valida                                   | Debe ser exactamente `svc-pagos`                     |
| Emisor (`iss`) / expiración (`exp`) | No se validan                               | Se validan ambos                                     |
| Token forjado `alg:none` + rol admin | **Aceptado (200)** — tarjetas expuestas    | **Rechazado (401)** — motivo explicado               |
| Token legítimo de otra audiencia | **Aceptado (200)** — tarjetas expuestas        | **Rechazado (401)** — "token emitido para otro servicio" |
| Usuario legítimo sin rol admin   | `403` (correcto en ambos modos)                | `403` (correcto en ambos modos)                      |

---

*Material de laboratorio para fines académicos — Universidad del Valle.*
