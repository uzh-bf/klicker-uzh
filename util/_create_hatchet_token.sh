#!/bin/sh
TOKEN=$(docker compose exec -T hatchet cat /config/authdisabled-token | tr -d '[:space:]')
for d in apps/backend-docker apps/hatchet-worker-general apps/hatchet-worker-response-processor apps/response-api; do sed "s|__HATCHET_CLIENT_TOKEN__|$TOKEN|g" "$d/.env.example" > "$d/.env"; done
