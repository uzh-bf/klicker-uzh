#!/bin/bash
# Script to automatically generate and configure Hatchet client token
# Note: Run this after _run_app_dependencies_macos.sh when services are already running

echo "🚀 Generating Hatchet client token..."

# Get the project root directory (where this script is located relative to util/hatchet/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Use docker compose (v2) if available, otherwise fall back to docker-compose
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

# Check if required Hatchet services are running (from project root)
echo "🔍 Checking if Hatchet services are running..."
cd "$PROJECT_ROOT"
REQUIRED_SERVICES=("hatchet_postgres" "hatchet_engine")
MISSING_SERVICES=()

for service in "${REQUIRED_SERVICES[@]}"; do
    if ! $COMPOSE_CMD ps --services --filter "status=running" | grep -q "^${service}$"; then
        MISSING_SERVICES+=("$service")
    fi
done

if [ ${#MISSING_SERVICES[@]} -ne 0 ]; then
    echo "❌ ERROR: Required Hatchet services are not running:"
    for service in "${MISSING_SERVICES[@]}"; do
        echo "   - $service"
    done
    echo ""
    echo "Please start the services first by running:"
    echo "   ./_run_app_dependencies_macos.sh"
    echo ""
    exit 1
fi

echo "✅ All required Hatchet services are running"

# Run the token generation from the hatchet directory (so relative paths work)
echo "🔑 Generating Hatchet client token..."
cd "$SCRIPT_DIR"
$COMPOSE_CMD -f docker-compose.hatchet-token.yml run --rm hatchet_token_generator

# Update the .env files
echo "📝 Updating .env files..."
$COMPOSE_CMD -f docker-compose.hatchet-token.yml run --rm hatchet_env_updater

echo "✨ Token generation complete!"
echo ""
echo "The token has been automatically added to:"
echo "  - apps/backend-docker/.env"
echo "  - apps/hatchet/.env"
echo ""
echo "You can now run your applications with the generated token."
