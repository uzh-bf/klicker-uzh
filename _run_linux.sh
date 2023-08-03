#!/bin/sh
podman-compose up -d postgres redis_exec redis_cache reverse_proxy
sudo socat tcp-listen:80,reuseaddr,fork tcp:localhost:8088
podman-compose stop
