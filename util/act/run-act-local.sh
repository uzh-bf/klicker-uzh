#!/bin/bash
set -e

echo "🚀 Starting local GitHub Actions execution with act..."

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo "   Please install it with:"
    echo "   brew install gh"
    echo ""
    echo "   This is required because act has a bug that requires authentication"
    echo "   even for public GitHub Actions repositories."
    exit 1
fi

# Check if gh is authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ GitHub CLI is not authenticated."
    echo "   Please authenticate with:"
    echo "   gh auth login"
    echo ""
    echo "   This provides the token that act needs to clone GitHub Actions."
    exit 1
fi

# Get token from gh CLI
echo "🔑 Getting GitHub token from gh CLI..."
GITHUB_TOKEN=$(gh auth token)

if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ Failed to get GitHub token from gh CLI."
    echo "   Try re-authenticating with: gh auth login"
    exit 1
fi

# Store current directory and get absolute paths
SCRIPT_DIR=$(pwd)
ACT_SECRETS_PATH="$SCRIPT_DIR/act.secrets"
ACT_SECRETS_TEMPLATE_PATH="$SCRIPT_DIR/act.secrets.template"
WORKFLOWS_PATH="$SCRIPT_DIR/../../.github/workflows/cypress-testing.yml"
EVENT_PATH="$SCRIPT_DIR/../../.github/events/pull_request_draft.json"

# Create act.secrets if it doesn't exist
if [ ! -f "$ACT_SECRETS_PATH" ]; then
    if [ -f "$ACT_SECRETS_TEMPLATE_PATH" ]; then
        cp "$ACT_SECRETS_TEMPLATE_PATH" "$ACT_SECRETS_PATH"
        echo "📋 Created act.secrets from template"
    else
        echo "❌ act.secrets.template not found. Please create it first."
        exit 1
    fi
fi

# Update GITHUB_TOKEN in act.secrets
if grep -q "^GITHUB_TOKEN=" "$ACT_SECRETS_PATH"; then
    # Update existing token (use different delimiter to avoid issues with token content)
    sed -i '' "s|^GITHUB_TOKEN=.*|GITHUB_TOKEN=$GITHUB_TOKEN|" "$ACT_SECRETS_PATH"
else
    # Add token if not present
    echo "GITHUB_TOKEN=$GITHUB_TOKEN" >> "$ACT_SECRETS_PATH"
fi

echo "✅ GitHub token configured from gh CLI"

# Change to project root directory so act uses it as the workspace
echo "🔄 Changing to project root directory..."
cd ../..

# Run act with single matrix container from project root
# This avoids port conflicts while still testing the actual service configuration
echo "🎬 Running GitHub Actions workflow with act (single container)..."
act pull_request \
  --workflows "$WORKFLOWS_PATH" \
  --job cypress-run-parallel-draft \
  --secret-file "$ACT_SECRETS_PATH" \
  --matrix containers:1 \
  --eventpath "$EVENT_PATH" \
  -P ubuntu-24.04=catthehacker/ubuntu:act-24.04 \
  -P ubuntu-latest=catthehacker/ubuntu:act-24.04 \
  --container-daemon-socket /var/run/docker.sock \
  --use-gitignore=false \
  --no-cache-server \
  --network host \
  -v

# Return to original directory
cd "$SCRIPT_DIR"

echo "✅ Workflow execution completed!"