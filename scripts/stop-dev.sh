#!/bin/bash

# =============================================================================
# HyperDash Platform Development Stop Script
# =============================================================================
# This script stops all development services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}🛑 Stopping HyperDash Platform Development Environment${NC}"
    echo "=================================="
}

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_step() {
    echo -e "${BLUE}🔧 $1${NC}"
}

main() {
    print_header

    print_step "Stopping all services..."
    docker-compose down

    print_step "Stopping monitoring tools..."
    docker-compose --profile monitoring down 2>/dev/null || true

    # Remove containers if requested
    if [ "$1" = "--remove" ]; then
        print_step "Removing containers..."
        docker-compose down --remove-orphans
    fi

    # Clean up volumes if requested
    if [ "$1" = "--clean" ]; then
        print_step "Cleaning up volumes..."
        docker-compose down --volumes --remove-orphans
        docker system prune -f
    fi

    print_status "All services stopped successfully"
}

main "$@"
