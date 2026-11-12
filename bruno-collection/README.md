# Colección de Bruno — demo interactiva A07 / JWT mal validado

> **Nota de formato:** Bruno (el cliente de API [usebruno.com](https://www.usebruno.com/))
> usa su propio lenguaje de texto plano `.bru`, no YAML — es el formato que su
> editor y su CLI entienden de forma nativa (son archivos de texto que se
> versionan bien en git). Por eso esta colección son archivos `.bru`, no
> `.yml`: con `.yml` Bruno no podría abrir las peticiones.

## Cómo abrirla

1. Abre Bruno → **Open Collection** → selecciona esta carpeta
   (`bruno-collection/`).
2. Arriba a la derecha, selecciona el entorno **Local** (ya trae
   `authUrl=http://127.0.0.1:4000` y `pagosUrl=http://127.0.0.1:4001`).
3. En otra terminal, levanta los servicios como ya sabes:
   ```bash
   npm run vuln
   ```
   (o `npm run secure` para la segunda vuelta).

## Las 6 peticiones, en orden, y qué muestra cada una

| # | Petición | Qué hace | Resultado esperado |
|---|----------|----------|---------------------|
| 01 | Login ana (user) | Login real, guarda `tokenAna` | 200, token legítimo |
| 02 | Yo soy (api/me) | Lee los claims del token legítimo | 200, `sub=ana role=user` |
| 03 | Tarjetas con rol user | Control de autorización normal | 403 en **ambos** modos |
| 04 | Login bruno (admin de otro servicio) | Login real, pero `aud=svc-inventario`, guarda `tokenBruno` | 200, token legítimo (para otro servicio) |
| 05 | **ATAQUE** confusión de audiencia | Reusa `tokenBruno` contra `svc-pagos` | vulnerable: **200** / seguro: **401** |
| 06 | **ATAQUE** alg:none + rol admin | El script `pre-request` forja un JWT sin firma, con `role:admin`, **sin usar la clave** | vulnerable: **200** / seguro: **401** |

Ejecútalas en orden (01 → 06) una vez contra `npm run vuln` y luego, tras
reiniciar en `npm run secure`, repite 05 y 06 para comparar.

## Qué mirar en cada ataque (05 y 06)

- **Status code** de la respuesta: `200` (aceptado, mal) vs `401` (rechazado, bien).
- El **body de la respuesta** en modo seguro trae el campo `motivo`, en
  español, explicando *exactamente* cuál validación falló — léelo en voz
  alta para la clase.
- En la petición **06**, abre la pestaña de resultado/consola de Bruno antes
  de enviarla: el script `pre-request` imprime el token forjado completo,
  para mostrar que es legible (Base64, no cifrado) y que su firma es texto
  vacío (termina en un punto `.` sin nada después).

Cada petición tiene su explicación completa en la pestaña **Docs** dentro
de Bruno — no necesitas este README abierto durante la demo.
