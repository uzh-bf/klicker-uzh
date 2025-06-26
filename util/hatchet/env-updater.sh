#!/bin/bash
# Environment updater script - mounted into alpine container
set -e

echo "Starting environment file update..."

# Wait for token to be generated
echo "Waiting for token generation..."
while ! test -f /hatchet/env/token.txt; do
    sleep 2
done

TOKEN=$(cat /hatchet/env/token.txt)
echo "Token found: $TOKEN"

# Update backend-docker .env if it exists
if [ -f /apps/backend-docker/.env ]; then
    echo "Updating backend-docker .env..."
    # Remove existing HATCHET_CLIENT_TOKEN line if present
    sed -i '/^HATCHET_CLIENT_TOKEN=/d' /apps/backend-docker/.env
    # Add new token
    echo "HATCHET_CLIENT_TOKEN=$TOKEN" >> /apps/backend-docker/.env
    echo "✓ Updated backend-docker .env"
else
    echo "⚠️  backend-docker .env not found, skipping..."
fi

# Update hatchet app .env if it exists
if [ -f /apps/hatchet/.env ]; then
    echo "Updating hatchet app .env..."
    # Remove existing HATCHET_CLIENT_TOKEN line if present
    sed -i '/^HATCHET_CLIENT_TOKEN=/d' /apps/hatchet/.env
    # Add new token
    echo "HATCHET_CLIENT_TOKEN=$TOKEN" >> /apps/hatchet/.env
    echo "✓ Updated hatchet app .env"
else
    echo "⚠️  hatchet app .env not found, skipping..."
fi

echo "Environment files updated successfully!"
