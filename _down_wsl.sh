#!/bin/sh

docker compose down \
    postgres \
    hatchet_postgres \
    hatchet_rabbitmq \
    hatchet_migration \
    hatchet_setup_config \
    hatchet_engine \
    hatchet_dashboard \
    redis_exec \
    redis_cache \
    reverse_proxy_wsl
