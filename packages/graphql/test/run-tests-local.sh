#!/bin/bash

# The legacy helper deleted shared Compose volumes without proving ownership.
# Use the self-contained devcontainer with its marked disposable test database.
echo 'Legacy test service management is disabled; use the guarded devcontainer test workflow.' >&2
exit 1
