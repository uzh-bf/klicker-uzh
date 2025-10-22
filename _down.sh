#!/bin/sh

echo "Stopping docker compose stack (down)"
docker compose down -v postgres redis_exec redis_assessment redis_cache hatchet azurite
