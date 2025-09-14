#!/bin/sh
kubectl rollout restart -n klicker-v2-qa deployment klicker-v2-qa-klicker-uzh-v2-backend-graphql
kubectl rollout restart -n klicker-v2-qa deployment klicker-v2-qa-klicker-uzh-v2-backend-assessment
kubectl rollout restart -n klicker-v2-qa deployment klicker-v2-qa-klicker-uzh-v2-frontend-manage
kubectl rollout restart -n klicker-v2-qa deployment klicker-v2-qa-klicker-uzh-v2-frontend-pwa
kubectl rollout restart -n klicker-v2-qa deployment klicker-v2-qa-klicker-uzh-v2-frontend-control
kubectl rollout restart -n klicker-v2-qa deployment klicker-v2-qa-klicker-uzh-v2-auth
kubectl rollout restart -n klicker-v2-qa deployment klicker-v2-qa-klicker-uzh-v2-lti
kubectl rollout restart -n klicker-v2-qa deployment klicker-v2-qa-klicker-uzh-v2-olat-api
kubectl rollout restart -n klicker-v2-qa deployment klicker-v2-qa-klicker-uzh-v2-hatchet-worker-general
kubectl rollout restart -n klicker-v2-qa deployment klicker-v2-qa-klicker-uzh-v2-hatchet-worker-response-processor
kubectl rollout restart -n klicker-v2-qa deployment klicker-v2-qa-klicker-uzh-v2-response-api
kubectl rollout restart -n klicker-v2-qa deployment klicker-v2-qa-klicker-uzh-v2-response-api-assessment
kubectl get pods -n klicker-v2-qa
