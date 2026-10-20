# Despliegue

El frontend se despliega junto con el backend. Las instrucciones y los scripts (`instalar.sh`) están en el repositorio **periferia_reto_backend**, en `INSTRUCTIVO_CLOUD_RUN.md`.

Si solo necesitas redesplegar el frontend:

```bash
export PROJECT_ID='TU_PROYECTO' REGION='us-central1'
BACKEND_URL=$(gcloud run services describe periferia-backend --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')
gcloud run deploy periferia-frontend --project "$PROJECT_ID" --region "$REGION" --source . \
  --service-account "periferia-frontend@$PROJECT_ID.iam.gserviceaccount.com" \
  --build-service-account "projects/$PROJECT_ID/serviceAccounts/periferia-builder@$PROJECT_ID.iam.gserviceaccount.com" \
  --allow-unauthenticated --set-env-vars "BACKEND_URL=$BACKEND_URL,BACKEND_AUTH=iam"
```
