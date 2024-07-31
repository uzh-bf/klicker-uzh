#!/bin/sh

# start postgres, redis, and reverse proxy
docker compose up postgres redis_exec redis_cache reverse_proxy_wsl
