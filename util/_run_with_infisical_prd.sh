#!/bin/bash
infisical login --domain https://inf.prd.df-app.ch
PROJECT_ID=6ae965bb-3cf8-4d44-9658-9cd4d58f754c

cd ../packages/prisma
infisical run --env=prd --projectId=$PROJECT_ID -- pnpm run prisma:deploy:raw

cd ../prisma-data
infisical run --env=prd --projectId=$PROJECT_ID -- sh -c 'DATABASE_URL="$DIRECT_DATABASE_URL" pnpm run seed:raw'