#!/bin/sh
kubectl rollout restart -n klicker-v2-prod deployment klicker-v2-prod-klicker-uzh-v2-backend-graphql
kubectl rollout restart -n klicker-v2-prod deployment klicker-v2-prod-klicker-uzh-v2-frontend-manage
kubectl rollout restart -n klicker-v2-prod deployment klicker-v2-prod-klicker-uzh-v2-frontend-pwa
kubectl rollout restart -n klicker-v2-prod deployment klicker-v2-prod-klicker-uzh-v2-frontend-control
kubectl rollout restart -n klicker-v2-prod deployment klicker-v2-prod-klicker-uzh-v2-auth
kubectl rollout restart -n klicker-v2-prod deployment klicker-v2-prod-klicker-uzh-v2-lti
kubectl rollout restart -n klicker-v2-prod deployment klicker-v2-prod-klicker-uzh-v2-olat-api
kubectl rollout restart -n klicker-v2-prod deployment klicker-v2-prod-klicker-uzh-v2-hatchet-worker-general
kubectl rollout restart -n klicker-v2-prod deployment klicker-v2-prod-klicker-uzh-v2-hatchet-worker-response
kubectl rollout restart -n klicker-v2-prod deployment klicker-v2-prod-klicker-uzh-v2-response-api
kubectl get pods -n klicker-v2-prod
