#!/bin/sh
kubectl rollout restart -n klicker-v2-prod deployment klicker-v2-prod-klicker-uzh-v2-backend-graphql
kubectl rollout restart -n klicker-v2-prod deployment klicker-v2-prod-klicker-uzh-v2-backend-assessment
kubectl rollout restart -n klicker-v2-prod deployment klicker-v2-prod-klicker-uzh-v2-frontend-assessment
kubectl rollout restart -n klicker-v2-prod deployment klicker-v2-prod-klicker-uzh-v2-frontend-manage
kubectl rollout restart -n klicker-v2-prod deployment klicker-v2-prod-klicker-uzh-v2-frontend-pwa
kubectl rollout restart -n klicker-v2-prod deployment klicker-v2-prod-klicker-uzh-v2-frontend-control
kubectl rollout restart -n klicker-v2-prod deployment klicker-v2-prod-klicker-uzh-v2-auth
kubectl rollout restart -n klicker-v2-prod deployment klicker-v2-prod-klicker-uzh-v2-lti
kubectl rollout restart -n klicker-v2-prod deployment klicker-v2-prod-klicker-uzh-v2-olat-api
kubectl rollout restart -n klicker-v2-prod deployment klicker-v2-prod-klicker-uzh-v2-hatchet-worker-general
kubectl rollout restart -n klicker-v2-prod deployment klicker-v2-prod-klicker-uzh-v2-hatchet-worker-response-processor
kubectl rollout restart -n klicker-v2-prod deployment klicker-v2-prod-klicker-uzh-v2-hatchet-worker-response-processor-assessment
kubectl rollout restart -n klicker-v2-prod deployment klicker-v2-prod-klicker-uzh-v2-response-api
kubectl rollout restart -n klicker-v2-prod deployment klicker-v2-prod-klicker-uzh-v2-response-api-assessment

kubectl rollout restart -n klicker-v2-prod deployment controllers
kubectl rollout restart -n klicker-v2-prod deployment hatchet-grpc
kubectl rollout restart -n klicker-v2-prod deployment hatchet-prod-api
kubectl rollout restart -n klicker-v2-prod deployment hatchet-prod-caddy
kubectl rollout restart -n klicker-v2-prod deployment hatchet-prod-frontend
kubectl rollout restart -n klicker-v2-prod deployment scheduler

kubectl get pods -n klicker-v2-prod
