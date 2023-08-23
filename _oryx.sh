#!/bin/bash
docker run --volume $(pwd):/repo \
  'mcr.microsoft.com/oryx/build:full-debian-bullseye' \
  oryx build /repo/apps/frontend-manage --output /repo/apps/frontend-manage/.next
