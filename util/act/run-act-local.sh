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

# Create act.secrets if it doesn't exist
if [ ! -f "act.secrets" ]; then
    if [ -f "act.secrets.template" ]; then
        cp act.secrets.template act.secrets
        echo "📋 Created act.secrets from template"
    else
        echo "❌ act.secrets.template not found. Please create it first."
        exit 1
    fi
fi

# Update GITHUB_TOKEN in act.secrets
if grep -q "^GITHUB_TOKEN=" act.secrets; then
    # Update existing token (use different delimiter to avoid issues with token content)
    sed -i '' "s|^GITHUB_TOKEN=.*|GITHUB_TOKEN=$GITHUB_TOKEN|" act.secrets
else
    # Add token if not present
    echo "GITHUB_TOKEN=$GITHUB_TOKEN" >> act.secrets
fi

echo "✅ GitHub token configured from gh CLI"

# Run act with single matrix container
# This avoids port conflicts while still testing the actual service configuration
echo "🎬 Running GitHub Actions workflow with act (single container)..."
act pull_request \
  --workflows ../../.github/workflows/cypress-testing.yml \
  --job cypress-run-parallel-draft \
  --secret-file act.secrets \
  --matrix containers:1 \
  --eventpath ../../.github/events/pull_request_draft.json

echo "✅ Workflow execution completed!"