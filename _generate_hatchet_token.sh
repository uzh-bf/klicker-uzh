#!/bin/bash
# Convenience wrapper for Hatchet token generation
# Calls the actual script in util/hatchet/

exec ./util/hatchet/_generate_hatchet_token.sh "$@"
