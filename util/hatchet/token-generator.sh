#!/bin/bash
# Token generator script - mounted into hatchet-admin container
set -e

echo "Starting Hatchet token generation..."

# Wait for Hatchet to be ready
echo "Waiting for Hatchet setup to complete..."
while ! test -f /hatchet/config/server.yaml; do
    echo "Config not ready yet, waiting..."
    sleep 2
done

echo "Hatchet config found, waiting a bit more for services to start..."
sleep 10

# Default tenant ID used by Hatchet in quickstart mode
TENANT_ID="707d0855-80ab-4e1f-a156-f1c4546cbf52"

# Generate the token with debugging
echo "Generating Hatchet client token..."
echo "Running command: /hatchet/hatchet-admin token create --config /hatchet/config --tenant-id $TENANT_ID --name klicker-automated"

# Capture both stdout and stderr for debugging
TOKEN_OUTPUT=$(/hatchet/hatchet-admin token create --config /hatchet/config --tenant-id $TENANT_ID --name klicker-automated 2>&1)
echo "Command output: $TOKEN_OUTPUT"

# Extract the JWT token (look for lines starting with 'eyJ' which is the JWT header)
TOKEN=$(echo "$TOKEN_OUTPUT" | grep '^eyJ' | head -n1 | xargs)

if [ -z "$TOKEN" ]; then
    echo "ERROR: Failed to extract JWT token"
    echo "Full command output was: $TOKEN_OUTPUT"
    exit 1
fi

echo "Token generated successfully: $TOKEN"

# Write to shared volume
echo "HATCHET_CLIENT_TOKEN=$TOKEN" > /hatchet/env/token.env
echo "HATCHET_CLIENT_TLS_STRATEGY=none" >> /hatchet/env/token.env

# Also write individual files for flexibility
echo "$TOKEN" > /hatchet/env/token.txt

echo "Token saved to /hatchet/env/token.env and /hatchet/env/token.txt"

# Display for manual copy if needed
echo "================================================"
echo "Generated Hatchet Client Token:"
echo "$TOKEN"
echo "================================================"
