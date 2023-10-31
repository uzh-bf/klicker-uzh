#!/bin/sh

# start postgres, redis, and reverse proxy
podman-compose up --build auth frontend_pwa frontend_manage frontend_control backend
