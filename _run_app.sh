#!/bin/sh

# start postgres, redis, and reverse proxy
docker compose up --build auth frontend_pwa frontend_manage frontend_control backend
