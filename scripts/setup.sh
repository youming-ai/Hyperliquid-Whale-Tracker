#!/bin/bash

# HyperDash Platform Setup Script
# This script sets up the development environment for the HyperDash platform

set -e

echo "🚀 Setting up HyperDash Platform..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
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
    echo -e "${BLUE}🔧 $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"

    # Check Docker
    if command -v docker &> /dev/null; then
        print_status "Docker is installed"
    else
        print_error "Docker is required but not installed. Please install Docker first."
        exit 1
    fi

    # Check Docker Compose
    if command -v docker-compose &> /dev/null; then
        print_status "Docker Compose is installed"
    else
        print_error "Docker Compose is required but not installed. Please install Docker Compose first."
        exit 1
    fi

    # Check Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_status "Node.js is installed (version: $NODE_VERSION)"

        # Check if Node.js version is 18 or higher
        NODE_MAJOR=$(echo $NODE_VERSION | sed 's/v//' | cut -d'.' -f1)
        if [ "$NODE_MAJOR" -lt 18 ]; then
            print_warning "Node.js version 18+ is recommended. Current version: $NODE_VERSION"
        fi
    else
        print_error "Node.js is required but not installed. Please install Node.js 18+ first."
        exit 1
    fi

    # Check Go
    if command -v go &> /dev/null; then
        GO_VERSION=$(go version | awk '{print $3}')
        print_status "Go is installed (version: $GO_VERSION)"

        # Check if Go version is 1.21 or higher
        GO_MAJOR=$(echo $GO_VERSION | sed 's/go//' | cut -d'.' -f1)
        GO_MINOR=$(echo $GO_VERSION | sed 's/go//' | cut -d'.' -f2)
        if [ "$GO_MAJOR" -lt 1 ] || ([ "$GO_MAJOR" -eq 1 ] && [ "$GO_MINOR" -lt 21 ]); then
            print_warning "Go version 1.21+ is recommended for the copy trading engine. Current version: $GO_VERSION"
        fi
    else
        print_warning "Go is recommended for the copy trading engine but not installed."
    fi

    echo
}

# Create necessary directories
create_directories() {
    print_header "Creating Directories"

    directories=(
        "infrastructure/docker/postgres"
        "infrastructure/docker/clickhouse"
        "infrastructure/docker/api-gateway"
        "infrastructure/docker/data-ingestion"
        "infrastructure/docker/analytics"
        "infrastructure/docker/billing"
        "infrastructure/docker/copy-engine"
        "infrastructure/grafana/provisioning"
        "infrastructure/prometheus"
        "logs"
    )

    for dir in "${directories[@]}"; do
        if [ ! -d "$dir" ]; then
            echo "Creating directory: $dir"
            mkdir -p "$dir"
        fi
    done

    print_status "Created all necessary directories"
    echo
}

# Create environment file
create_env_file() {
    print_header "Setting up Environment Configuration"

    if [ ! -f .env ]; then
        print_status "Creating .env file from template"
        cp .env.example .env
        echo
        print_warning "Please edit .env file with your configuration:"
        echo "  • HYPERLIQUID_API_KEY"
        echo "  • HYPERLIQUID_SECRET_KEY"
        echo "  • JWT_SECRET"
        echo "  • ENCRYPTION_KEY"
        echo "  • Database passwords (if changing defaults)"
        echo
    else
        print_warning ".env file already exists"
    fi
}

# Install dependencies
install_dependencies() {
    print_header "Installing Dependencies"

    print_status "Installing root dependencies"
    npm install --legacy-peer-deps

    print_status "Installing workspace dependencies"
    npm install --workspaces --legacy-peer-deps

    echo
}

# Install Go dependencies for copy engine
install_go_dependencies() {
    print_header "Installing Go Dependencies"

    if command -v go &> /dev/null; then
        print_status "Installing Go modules for copy engine"
        cd apps/copy-engine
        go mod download
        go mod tidy
        cd ../..
        echo
    fi
}

# Build Go application
build_go_app() {
    print_header "Building Go Application"

    if command -v go &> /dev/null; then
        print_status "Building copy engine"
        cd apps/copy-engine
        go build -o cmd/server/main cmd/server/main.go
        cd ../..
        echo
    fi
}

# Run database migrations
run_migrations() {
    print_header "Running Database Migrations"

    print_status "Running PostgreSQL migrations"
    npm run db:migrate || echo "Migration failed - please check database configuration"
    echo
}

# Create logs directory structure
setup_logs() {
    print_header "Setting up Logging"

    logs_dir="logs"
    if [ ! -d "$logs_dir" ]; then
        mkdir -p "$logs_dir"
    fi

    # Create log subdirectories
    subdirs=("api-gateway" "data-ingestion" "analytics" "copy-engine" "billing")
    for subdir in "${subdirs[@]}"; do
        if [ ! -d "$logs_dir/$subdir" ]; then
            mkdir -p "$logs_dir/$subdir"
        fi
    done

    print_status "Created logging directory structure"
    echo
}

# Create Docker volumes
create_volumes() {
    print_header "Creating Docker Volumes"

    # Create volume directories
    volumes=(
        "volumes/postgres_data"
        "volumes/clickhouse_data"
        "volumes/redis_data"
        "volumes/redpanda_data"
        "volumes/prometheus_data"
        "volumes/grafana_data"
    )

    for volume in "${volumes[@]}"; do
        if [ ! -d "$volume" ]; then
            mkdir -p "$volume"
        fi
    done

    print_status "Created Docker volumes"
    echo
}

# Check if Docker is running and services are available
check_docker() {
    print_header "Checking Docker Status"

    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi

    print_status "Docker is running"

    # Check if Docker Compose is available
    if ! docker-compose ps > /dev/null 2>&1; then
        print_warning "Docker services are not running. Use './start-dev.sh' to start them."
    else
        print_status "Docker Compose services are running"
        docker-compose ps
    fi
    echo
}

# Main setup flow
main() {
    echo "🚀 HyperDash Platform Setup"
    echo "================================"

    check_prerequisites
    create_directories
    create_env_file
    install_dependencies
    install_go_dependencies
    build_go_app
    setup_logs
    create_volumes
    run_migrations

    print_header "Setup Complete!"
    echo
    print_status "HyperDash platform is ready for development!"
    echo
    echo "Next steps:"
    echo "  1. Review and update .env file with your configuration"
    echo " 2. Start development environment: ./start-dev.sh"
    echo " 3. Access the application at: http://localhost:3001"
    echo " 4. View Grafana dashboards at: http://localhost:3002"
    echo
    echo "For more information, see the README.md file."
}

# Run main function
main "$@"
