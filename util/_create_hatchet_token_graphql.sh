#!/bin/sh

CONTAINER_NAME=$(docker ps -a --filter "ancestor=ghcr.io/hatchet-dev/hatchet/hatchet-lite:latest" --format "{{.Names}}" | head -n1)
TOKEN=$(docker exec $CONTAINER_NAME /hatchet-admin token create --config /config --tenant-id 707d0855-80ab-4e1f-a156-f1c4546cbf52 | xargs)
for d in packages/graphql; do sed "s|__HATCHET_CLIENT_TOKEN__|$TOKEN|g" "$d/.env.example" > "$d/.env"; done
for d in apps/hatchet-worker-general apps/hatchet-worker-response-processor apps/response-api; do sed "s|__HATCHET_CLIENT_TOKEN__|$TOKEN|g" "$d/.env.example" > "$d/.env"; done
