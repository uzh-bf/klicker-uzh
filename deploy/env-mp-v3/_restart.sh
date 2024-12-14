#!/bin/sh
kubectl rollout restart -n klicker-v2-mp deployment klicker-v2-mp-klicker-uzh-v2-backend-graphql
kubectl rollout restart -n klicker-v2-mp deployment klicker-v2-mp-klicker-uzh-v2-frontend-manage
kubectl rollout restart -n klicker-v2-mp deployment klicker-v2-mp-klicker-uzh-v2-frontend-pwa
kubectl rollout restart -n klicker-v2-mp deployment klicker-v2-mp-klicker-uzh-v2-auth
kubectl get pods -n klicker-v2-mp
