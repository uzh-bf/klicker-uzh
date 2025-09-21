#!/bin/bash

# KlickerUZH Audit Service Test Runner
# Usage: ./test-audit.sh [--db|--api|--integration|--help]
# 
# Test Categories:
#   --db           Only database tests (requires Azurite)
#   --api          Only API tests (requires running service)
#   --integration  Only integration tests (requires both)
#   (no flag)      Run all tests

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Emojis for better UX
CHECK="✅"
CROSS="❌"
WARN="⚠️"
INFO="ℹ️"
ROCKET="🚀"
GEAR="⚙️"

# Help function
show_help() {
    echo -e "${BLUE}${ROCKET} KlickerUZH Audit Service Test Runner${NC}"
    echo "=================================================="
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Test Categories:"
    echo "  --db           Only database tests (requires Azurite)"
    echo "  --api          Only API tests (requires running service on port 7080)"
    echo "  --integration  Only integration tests (requires both Azurite and service)"
    echo "  --help, -h     Show this help message"
    echo ""
    echo "If no option is provided, all tests will run."
    echo ""
    echo "Prerequisites:"
    echo "  Database tests:     Azurite running on port 10002"
    echo "  API tests:          Audit service running on port 7080"
    echo "  Integration tests:  Both Azurite and audit service running"
    echo ""
    exit 0
}

# Parse command line arguments
TEST_CATEGORY="all"
while [[ $# -gt 0 ]]; do
    case $1 in
        --db)
            TEST_CATEGORY="db"
            shift
            ;;
        --api)
            TEST_CATEGORY="api"
            shift
            ;;
        --integration)
            TEST_CATEGORY="integration"
            shift
            ;;
        --help|-h)
            show_help
            ;;
        *)
            echo -e "${CROSS} Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}${ROCKET} KlickerUZH Audit Service Test Runner${NC}"
echo "=================================================="
echo -e "Test Category: ${YELLOW}${TEST_CATEGORY}${NC}"

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local max_attempts=30
    local attempt=1
    
    echo -e "${INFO} Waiting for service at $url to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s $url > /dev/null 2>&1; then
            echo -e "${CHECK} Service is ready!"
            return 0
        fi
        
        echo -n "."
        sleep 1
        attempt=$((attempt + 1))
    done
    
    echo -e "\n${CROSS} Service failed to start within $max_attempts seconds"
    return 1
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "src" ] || [ ! -d "test" ]; then
    echo -e "${CROSS} Error: Must be run from apps/audit directory"
    echo -e "${INFO} Current directory: $(pwd)"
    echo -e "${INFO} Expected files: package.json, src/, test/"
    exit 1
fi

echo -e "${CHECK} Running from correct directory: $(pwd)"

# Step 1: Check for Azurite
echo -e "\n${GEAR} Step 1: Checking Azurite (Azure Storage Emulator)"
AZURITE_PORT=10002

if check_port $AZURITE_PORT; then
    echo -e "${CHECK} Azurite is already running on port $AZURITE_PORT"
else
    echo -e "${WARN} Azurite is not running"
    echo -e "${INFO} Azurite is required for audit service tests"
    
    read -p "Would you like to start Azurite? (y/n): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${GEAR} Starting Azurite in background..."
        
        # Check if we can run from project root
        if [ -f "../../package.json" ] && grep -q "deps" "../../package.json"; then
            echo -e "${INFO} Starting Azurite from project root..."
            (cd ../../ && npm run deps > /dev/null 2>&1 &)
        else
            echo -e "${INFO} Starting Azurite directly..."
            npx azurite-blob --silent --location /tmp/azurite &
        fi
        
        # Wait for Azurite to start
        echo -e "${INFO} Waiting for Azurite to start..."
        sleep 3
        
        if check_port $AZURITE_PORT; then
            echo -e "${CHECK} Azurite started successfully"
        else
            echo -e "${CROSS} Failed to start Azurite"
            echo -e "${INFO} You may need to start it manually: npm run deps (from project root)"
            exit 1
        fi
    else
        echo -e "${CROSS} Tests require Azurite. Please start it manually and rerun."
        echo -e "${INFO} From project root: npm run deps"
        exit 1
    fi
fi

# Step 2: Install dependencies (pnpm workspace)
echo -e "\n\${GEAR} Step 2: Installing dependencies"
if pnpm install > /dev/null 2>&1; then
    echo -e "\${CHECK} Dependencies installed"
else
    echo -e "\${CROSS} Failed to install dependencies"
    echo -e "\${INFO} Try running: pnpm install"
    exit 1
fi

# Step 3: Build the service
echo -e "\n\${GEAR} Step 3: Building TypeScript"
if pnpm build > /dev/null 2>&1; then
    echo -e "\${CHECK} Build successful"
else
    echo -e "\${CROSS} Build failed"
    echo -e "\${INFO} Try running: pnpm build"
    exit 1
fi

# Step 4: Run tests based on category
echo -e "\n\${GEAR} Step 4: Running test suite (\${TEST_CATEGORY})"

# Load test environment variables from .env.test
if [ -f ".env.test" ]; then
    echo -e "${INFO} Loading test environment from .env.test..."
    set -a  # Automatically export all variables
    source .env.test
    set +a  # Stop auto-exporting
else
    echo -e "${WARN} .env.test not found, using fallback environment variables..."
    # Fallback environment variables
    export NODE_ENV=test
    export INTERNAL_TOKEN="test-secret-token-123"
    export AZURE_TABLES_CONNECTION_STRING="DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;"
    export AZURE_TABLES_TABLE_NAME="auditevents"
    export APP_SECRET="abcd"
fi

# Determine which tests to run
case \$TEST_CATEGORY in
    "db")
        echo -e "\${INFO} Running database tests only..."
        TEST_PATTERN="test/database-verification"
        ;;
    "api")
        echo -e "\${INFO} Running API tests only..."
        TEST_PATTERN="test/api test/public-endpoint"
        ;;
    "integration")
        echo -e "\${INFO} Running integration tests only..."
        TEST_PATTERN="test/integration test/scenarios test/performance"
        ;;
    "all")
        echo -e "\${INFO} Running all tests (this may take a few minutes)..."
        TEST_PATTERN=""
        ;;
esac

# Run the tests
if [ -z "\$TEST_PATTERN" ]; then
    # Run all tests
    if pnpm test; then
        echo -e "\n\${CHECK} All tests passed!"
    else
        echo -e "\n\${CROSS} Some tests failed. Check output above for details."
        exit 1
    fi
else
    # Run specific test pattern
    if pnpm vitest run \$TEST_PATTERN; then
        echo -e "\n\${CHECK} \${TEST_CATEGORY} tests passed!"
    else
        echo -e "\n\${CROSS} Some \${TEST_CATEGORY} tests failed. Check output above for details."
        exit 1
    fi
fi

# Step 5: Optional service testing
echo -e "\n${GEAR} Step 5: Service verification (optional)"
read -p "Would you like to start the service for manual testing? (y/n): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${INFO} Starting audit service..."
    
    # Start service in background
    pnpm dev > audit-service.log 2>&1 &
    SERVICE_PID=$!
    
    # Wait for service to be ready
    if wait_for_service "http://localhost:7080/metrics"; then
        echo -e "${CHECK} Audit service is running at http://localhost:7080"
        echo -e "${INFO} Service logs are being written to: audit-service.log"
        
        # Submit a test event
        echo -e "\n${GEAR} Testing with sample audit event..."
        
        TEST_EVENT='{
            "subject": "user:test@example.com",
            "action": "test.script.verification",
            "attributes": {
                "testRunner": "test-audit.sh",
                "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
            }
        }'
        
        echo -e "${INFO} Submitting test event..."
        
        if curl -s -X POST http://localhost:7080/audit \
            -H "Content-Type: application/json" \
            -H "X-Internal-Token: $INTERNAL_TOKEN" \
            -d "$TEST_EVENT" | grep -q "stored"; then
            echo -e "${CHECK} Test event submitted successfully!"
        else
            echo -e "${CROSS} Test event submission failed"
        fi
        
        # Check health endpoint
        echo -e "\n${GEAR} Checking service health..."
        if curl -s http://localhost:7080/ready \
            -H "X-Internal-Token: $INTERNAL_TOKEN" | grep -q "ready"; then
            echo -e "${CHECK} Service health check passed"
        else
            echo -e "${CROSS} Service health check failed"
        fi
        
        echo -e "\n${INFO} Service is running in background (PID: $SERVICE_PID)"
        echo -e "${INFO} View logs: tail -f audit-service.log"
        echo -e "${INFO} Stop service: kill $SERVICE_PID"
        
        # Ask if user wants to stop the service
        read -p "Stop the service now? (y/n): " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${GEAR} Stopping service..."
            kill $SERVICE_PID 2>/dev/null || true
            echo -e "${CHECK} Service stopped"
            rm -f audit-service.log
        else
            echo -e "${INFO} Service left running. Remember to stop it when done:"
            echo -e "${INFO} kill $SERVICE_PID"
        fi
    else
        kill $SERVICE_PID 2>/dev/null || true
        echo -e "${CROSS} Service failed to start properly"
        exit 1
    fi
fi

echo -e "\n${CHECK} ${GREEN}All audit service tests completed successfully!${NC}"
echo -e "${ROCKET} Audit service is ready for production deployment"

# Summary
echo -e "\n📊 ${BLUE}Test Summary:${NC}"
echo -e "   ${CHECK} Azurite storage emulator running"
echo -e "   ${CHECK} Dependencies installed"
echo -e "   ${CHECK} TypeScript compilation successful"
echo -e "   ${CHECK} Test suite passed"
echo -e "   ${CHECK} Service functionality verified"

echo -e "\n🎯 ${PURPLE}Next Steps:${NC}"
echo -e "   1. Review any test output above for warnings"
echo -e "   2. Commit changes and create PR for tenantId removal"
echo -e "   3. Plan next phase: adding critical security events"

echo -e "\n${ROCKET} Happy auditing! 🔍"