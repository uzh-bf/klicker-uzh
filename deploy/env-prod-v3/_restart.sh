#!/bin/sh
kubectl rollout restart -n klicker-v2-prod deployment klicker-v2-prod-klicker-uzh-v2-backend-graphql
kubectl rollout restart -n klicker-v2-prod deployment klicker-v2-prod-klicker-uzh-v2-frontend-manage
kubectl rollout restart -n klicker-v2-prod deployment klicker-v2-prod-klicker-uzh-v2-frontend-pwa
kubectl get pods -n klicker-v2-prod
