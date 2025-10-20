#!/bin/bash

# HyperDash Platform Cleanup Script
# This script cleans up development artifacts and containers

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_header() {
    echo -e "${BLUE}🧹 $1${NC}"
}

# Stop all running containers
stop_containers() {
    print_header "Stopping All Services"

    if docker-compose ps -q 2>/dev/null | grep -q "Up"; then
        print_status "Stopping all Docker containers..."
        docker-compose down
        print_status "All containers stopped"
    else
        print_status "No containers are currently running"
    fi
    echo
}

# Clean up Docker artifacts
clean_docker() {
    print_header "Cleaning Docker Artifacts"

    print_status "Removing stopped containers..."
    docker-compose down --remove-orphans 2>/dev/null || true

    print_status "Removing unused images..."
    docker image prune -f 2>/dev/null || true

    print_status "Removing build cache..."
    docker builder prune -f 2>/dev/null || true

    print_status "Docker cleanup completed"
    echo
}

# Clean up Node.js artifacts
clean_nodejs() {
    print_header "Cleaning Node.js Artifacts"

    print_status "Cleaning node_modules..."
    npm run clean 2>/dev/null || true

    # Clean workspace node_modules
    find . -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true

    # Clean build artifacts
    find . -name "dist" -type d -exec rm -rf {} + 2>/dev/null || true
    find . -name ".next" -type d -exec rm -rf {} + 2>/dev/null || true

    print_status "Node.js cleanup completed"
    echo
}

# Clean up logs
clean_logs() {
    print_header "Cleaning Log Files"

    if [ -d "logs" ]; then
        print_status "Removing log files..."
        rm -rf logs/*
        print_status "Log files removed"
    else
        print_status "No log directory found"
    fi
    echo
}

# Clean up Go build artifacts
clean_go() {
    print_header "Cleaning Go Build Artifacts"

    if [ -d "apps/copy-engine" ]; then
        print_status "Cleaning Go build artifacts..."
        cd apps/copy-engine

        # Remove compiled binaries
        rm -f main cmd/server/main 2>/dev/null || true

        # Clean Go module cache
        go clean -modcache 2>/dev/null || true

        cd ../..
        print_status "Go cleanup completed"
    else
        print_status "No Go application directory found"
    fi
    echo
}

# Clean up Docker volumes
clean_volumes() {
    print_warning "⚠️  Cleaning Docker Volumes (this will delete all data!)"

    read -p "Are you sure you want to delete all Docker volumes? This will permanently delete all data. [y/N]: " confirm
    case $confirm in
        [Yy]* )
            echo
            print_status "Removing Docker volumes..."

            volumes=(
                "volumes/postgres_data"
                "volumes/clickhouse_data"
                "volumes/redis_data"
                "volumes/redpanda_data"
                "volumes/prometheus_data"
                "volumes/grafana_data"
            )

            for volume in "${volumes[@]}"; do
                if [ -d "$volume" ]; then
                    echo "Removing volume: $volume"
                    rm -rf "$volume"
                fi
            done

            print_status "Docker volumes removed"
            ;;
        [Nn]* )
            echo
            print_status "Docker volumes preserved"
            ;;
    esac
    echo
}

# Reset to clean state
reset_state() {
    print_header "Resetting to Clean State"

    clean_docker
    clean_nodejs
    clean_logs
    clean_go

    # Remove any remaining temporary files
    print_status "Removing temporary files..."
    find . -name "*.tmp" -delete 2>/dev/null || true
    find . -name "*.log" -delete 2>/dev/null || true
    find . -name ".DS_Store" -delete 2>/dev/null || true
    find . -name "Thumbs.db" -delete 2>/dev/null || true

    print_status "Reset to clean state completed"
    echo
}

# Display cleanup summary
show_summary() {
    print_header "Cleanup Summary"

    echo "✅ Cleanup completed successfully!"
    echo
    echo "To start fresh:"
    echo "  1. Run: ./scripts/setup.sh"
    echo " 2. Start: ./scripts/start-dev.sh"
    echo
    echo "To remove Docker volumes (deletes all data):"
    echo "  ./scripts/clean.sh --volumes"
    echo
}

# Main cleanup function
main() {
    case "${1:-}" in
        "")
            # Default cleanup (preserves data)
            stop_containers
            clean_docker
            clean_nodejs
            clean_logs
            clean_go
            show_summary
            ;;
        "--volumes"|"volumes")
            # Full cleanup including volumes
            stop_containers
            clean_docker
            clean_nodejs
            clean_logs
            clean_go
            clean_volumes
            show_summary
            ;;
        "--reset"|"reset")
            # Complete reset
            reset_state
            show_summary
            ;;
        "--help"|"-h")
            echo "Usage: $0 [OPTION]"
            echo
            echo "Options:"
            echo "  (no args)    Clean containers, build artifacts, and logs (preserves data)"
            echo "  --volumes   Clean Docker volumes (deletes all data)"
            echo "  --reset     Complete reset to clean state"
            echo "  --help       Show this help message"
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for available options."
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
