#!/usr/bin/env bash
# Despliega el frontend en Cloud Run (publico; habla con el backend privado con su identidad IAM).
# Lo usan instalar.sh (repo del backend) y GitHub Actions.
#   Requiere: PROJECT_ID.  Opcionales: REGION BACKEND_URL (si no, se lee del servicio) FRONTEND_SERVICE BACKEND_SERVICE USE_COMPUTE_BUILDER=1
set -euo pipefail
: "${PROJECT_ID:?Falta PROJECT_ID}"
REGION="${REGION:-us-central1}"
SERVICE="${FRONTEND_SERVICE:-periferia-frontend}"
BACKEND_SERVICE="${BACKEND_SERVICE:-periferia-backend}"
cd "$(dirname "${BASH_SOURCE[0]}")/.."

BACKEND_URL="${BACKEND_URL:-$(gcloud run services describe "$BACKEND_SERVICE" --project="$PROJECT_ID" --region="$REGION" --format='value(status.url)' 2>/dev/null || true)}"
[ -n "$BACKEND_URL" ] || { echo "No encuentro el backend (${BACKEND_SERVICE}). Despliegalo primero." >&2; exit 1; }

BUILD=()
if [ "${USE_COMPUTE_BUILDER:-0}" != "1" ]; then
  BUILD=(--build-service-account="projects/${PROJECT_ID}/serviceAccounts/periferia-builder@${PROJECT_ID}.iam.gserviceaccount.com")
fi

gcloud run deploy "$SERVICE" --source=. --project="$PROJECT_ID" --region="$REGION" "${BUILD[@]}" \
  --service-account="periferia-frontend@${PROJECT_ID}.iam.gserviceaccount.com" \
  --port=8080 --memory=256Mi --cpu=1 --min-instances=0 --max-instances=2 --concurrency=20 --timeout=120 \
  --allow-unauthenticated \
  --set-env-vars="BACKEND_URL=${BACKEND_URL},BACKEND_AUTH=iam" \
  --quiet
