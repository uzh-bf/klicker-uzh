#!/bin/sh

COMMAND=${1:-install}

cd src

docker run --rm --interactive --tty \
  --volume $PWD:/app \
  composer $COMMAND
