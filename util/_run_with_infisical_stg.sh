#!/bin/bash
infisical login --domain https://inf.stg.df-app.ch
PROJECT_ID=4766eb9c-c0a2-413c-9673-6cffc42b541c

cd ../packages/prisma
infisical run --env=stg --projectId=$PROJECT_ID -- pnpm run prisma:deploy:raw

cd ../prisma-data
infisical run --env=stg --projectId=$PROJECT_ID -- sh -c 'DATABASE_URL="$DIRECT_DATABASE_URL" pnpm run seed:raw'