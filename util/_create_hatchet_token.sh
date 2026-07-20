#!/bin/sh
TOKEN=$(docker compose exec -T hatchet /hatchet-admin token create --config /config --tenant-id 707d0855-80ab-4e1f-a156-f1c4546cbf52 | xargs)
for d in apps/backend-docker apps/hatchet-worker-general apps/hatchet-worker-response-processor apps/response-api; do sed "s|__HATCHET_CLIENT_TOKEN__|$TOKEN|g" "$d/.env.example" > "$d/.env"; done
