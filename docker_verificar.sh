#!/bin/sh
# Verificacion del despliegue en Docker (ejecutar en una maquina con Docker)
set -e
docker build -t tramoya . 2>&1 | tail -15
docker run -d --rm --name tramoya -p 3300:3000 -e JWT_SECRET=clave-de-prueba-distinta tramoya
sleep 3
echo "--- GET /api/health"; curl -s -i http://localhost:3300/api/health | head -12
echo "--- GET / (frontend)"; curl -s -o /dev/null -w "HTTP %{http_code}, %{size_download} bytes\n" http://localhost:3300/
echo "--- usuario del proceso"; docker exec tramoya id
docker images tramoya --format "imagen: {{.Repository}}:{{.Tag}} tamano: {{.Size}}"
docker stop tramoya
