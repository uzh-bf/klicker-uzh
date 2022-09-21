#!/bin/bash

kubectl get deployments -n klicker-v2-qa -o name | xargs -p kubectl rollout restart -n klicker-v2-qa
