# Reto 3 · Agente de órdenes de compra SAP — Frontend

Chat en HTML/JS sin dependencias de build, servido por un proxy mínimo de Node que reenvía al backend (`periferia_reto_backend`) con la identidad IAM del servicio. Muestra:

- cada **llamada a herramienta** (nombre, argumentos, resultado resumido y detalle desplegable), en vivo por SSE;
- un **banner de confirmación resaltado** cuando el agente pide confirmar excepciones, con botones "Confirmo" / "No, cancelar" (envían un mensaje inequívoco al chat);
- respuestas con tablas y listas (render de Markdown seguro: nunca inserta HTML del modelo);
- el modo del backend (modelo real o "modo práctica sin LLM").

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
