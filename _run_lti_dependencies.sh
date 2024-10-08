#!/bin/sh

# start postgres, redis, and reverse proxy
docker compose up postgres_lti

# start a tunnel with cloudflared
cloudflared tunnel --url localhost:4000
