#!/bin/sh

podman-compose down postgres redis_exec redis_cache reverse_proxy
