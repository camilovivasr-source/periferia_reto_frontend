# Reto 3 · Agente de órdenes de compra SAP — Frontend

Chat en HTML/JS sin dependencias de build, servido por un proxy mínimo de Node que reenvía al backend (`periferia_reto_backend`) con la identidad IAM del servicio. Muestra:

- cada **llamada a herramienta** (nombre, argumentos, resultado resumido y detalle desplegable), en vivo por SSE;
- un **banner de confirmación resaltado** cuando el agente pide confirmar excepciones, con botones "Confirmo" / "No, cancelar" (envían un mensaje inequívoco al chat);
- **tarjetas estructuradas** generadas a partir de los resultados de las herramientas: controles RC (✓/!/✕ con su motivo), la OC como quedaría en SAP (proveedor, posiciones, base/IVA/total, excepciones), resultado de la creación con el número de OC y descargas de evidencia (PDF/TXT) y trazabilidad;
- **subir la carpeta de una solicitud** (arrastrar o elegir; queda registrada y aparece en la lista) y, como alternativa, un formulario (botón «+ Formulario»): formulario con solicitud, cotización, aprobación y factura opcionales; al guardar, el agente la procesa;
- barra lateral con el **estado de cada solicitud** según los controles y contadores;
- **respuestas rápidas** según el estado de la conversación;
- una segunda pestaña, **Análisis**, con cinco herramientas de solo lectura: panel de control (KPIs, bitácora, exportación de carga masiva SAP), desvío de proceso (retroactivas y línea de tiempo), conciliación documental, simulador de controles («¿qué pasaría si…?») y autoridad de aprobación;
- respuestas con tablas y listas (render de Markdown seguro: nunca inserta HTML del modelo);
- el modo del backend (modelo real o "modo práctica sin LLM").

## Estructura (`public/`)

| Módulo | Responsabilidad |
|---|---|
| `app.js` | Composición: eventos, turno de chat, arranque |
| `api.js` | Cliente del backend (SSE del turno, casos, historial) |
| `sesion.js` | Identificador de sesión |
| `vista-chat.js` | Mensajes: usuario, agente (pasos, tarjetas, texto) |
| `vista-casos.js` | Barra lateral de solicitudes |
| `nueva-solicitud.js` | Diálogo de registro de una solicitud nueva |
| `avisos.js` | Banner de confirmación y respuestas rápidas |
| `cards.js` | Tarjetas de controles, OC, resultado, casos y control |
| `analisis/` | Pestaña Análisis: `index` (navegación), `panel`, `desvio`, `conciliacion`, `simulador`, `autoridad` y `graficos` (barras, línea de tiempo SVG, tablas; sin librerías) |
| `markdown.js`, `dom.js` | Render seguro de Markdown y utilidades DOM (nunca `innerHTML`) |

## Local
```bash
npm ci
npm test
# backend en :8080 (otro terminal): npm run dev   |   luego:
cp .env.example .env && npm start     # http://localhost:3000
```
`npm run smoke:split` levanta el backend compilado en modo práctica y recorre el flujo completo (`BACKEND_DIR=../periferia_reto_backend`).

## Variables
| Variable | Defecto | Descripción |
|---|---|---|
| `PORT` | `3000` (`8080` en Cloud Run) | Puerto. |
| `BACKEND_URL` | `http://127.0.0.1:8080` | Origen del backend. |
| `BACKEND_AUTH` | `iam` | `iam` (ID token de la identidad de servicio) o `none` (solo local). En Cloud Run debe ser `iam`. |

El proxy solo expone `/api/chat`, `/api/casos`, `/api/sessions/:id` y la salud; limita tamaño (16 KB) y frecuencia (90/min por IP) y rechaza orígenes cruzados. Despliegue: ver `INSTRUCTIVO_CLOUD_RUN.md`.

## Despliegue automático

`.github/workflows/deploy.yml`: cada push a `main` o a `claude/blissful-mendel-88agwr` corre las pruebas y ejecuta `infra/deploy-frontend.sh` (Cloud Run, vía Workload Identity, sin claves). Las variables del repo las crea `instalar.sh`/`infra/cicd.sh` del backend; mientras no existan, el paso de despliegue se omite con un aviso.
