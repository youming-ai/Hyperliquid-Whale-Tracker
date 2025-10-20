#!/bin/bash

# =============================================================================
# HyperDash Platform Development Startup Script
# =============================================================================
# This script starts all services in development mode using Docker Compose

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_header() {
    echo -e "${BLUE}🚀 HyperDash Platform Development Environment${NC}"
    echo "================================"
}

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_step() {
    echo -e "${BLUE}🔧 $1${NC}"
}

# Check if Docker is running
check_docker() {
    print_step "Checking Docker status..."

    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker Desktop or Docker daemon."
        exit 1
    fi

    print_status "Docker is running"
}

# Check if required files exist
check_prerequisites() {
    print_step "Checking prerequisites..."

    # Check docker-compose.yml
    if [ ! -f "docker-compose.yml" ]; then
        print_error "docker-compose.yml not found. Please run setup first."
        exit 1
    fi

    # Check .env file
    if [ ! -f ".env" ]; then
        print_warning ".env file not found. Creating from template..."
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_status "Created .env from template"
            print_warning "Please edit .env file with your configuration before continuing."
        else
            print_error ".env.example not found. Please create .env file manually."
            exit 1
        fi
    fi

    print_status "Prerequisites check completed"
}

# Build Docker images if needed
build_images() {
    print_step "Building Docker images..."

    # Only build if images don't exist or if --build flag is passed
    if [ "$1" = "--build" ]; then
        docker-compose build --no-cache
        print_status "Docker images built successfully"
    else
        # Check if images exist
        if ! docker-compose ps -q | xargs -I {} docker inspect {} > /dev/null 2>&1; then
            print_status "Building missing Docker images..."
            docker-compose build
            print_status "Docker images built successfully"
        else
            print_status "Docker images already exist"
        fi
    fi
}

# Start infrastructure services first
start_infrastructure() {
    print_step "Starting infrastructure services..."

    # Start databases and message queue
    docker-compose up -d postgres clickhouse redis kafka zookeeper

    # Wait for services to be ready
    print_step "Waiting for infrastructure services to be ready..."

    # Wait for PostgreSQL
    echo "Waiting for PostgreSQL..."
    timeout 60 bash -c 'until docker-compose exec -T postgres pg_isready -U postgres; do sleep 2; done'

    # Wait for ClickHouse
    echo "Waiting for ClickHouse..."
    timeout 60 bash -c 'until docker-compose exec -T clickhouse wget --no-verbose --tries=1 --spider http://localhost:8123/ping; do sleep 2; done'

    # Wait for Redis
    echo "Waiting for Redis..."
    timeout 30 bash -c 'until docker-compose exec -T redis redis-cli ping; do sleep 1; done'

    # Wait for Kafka
    echo "Waiting for Kafka..."
    timeout 60 bash -c 'until docker-compose exec -T kafka kafka-broker-api-versions --bootstrap-server localhost:9092; do sleep 2; done'

    print_status "Infrastructure services are ready"
}

# Run database migrations
run_migrations() {
    print_step "Running database migrations..."

    # Run PostgreSQL migrations
    if docker-compose exec -T postgres psql -U postgres -d hyperdash -c "SELECT 1;" > /dev/null 2>&1; then
        print_status "PostgreSQL database is ready"
    else
        print_warning "PostgreSQL database not initialized, creating..."
        docker-compose exec -T postgres createdb -U postgres hyperdash || true
    fi

    # Check ClickHouse tables
    if docker-compose exec -T clickhouse clickhouse-client --query "SHOW TABLES FROM hyperdash" > /dev/null 2>&1; then
        print_status "ClickHouse database is ready"
    else
        print_warning "ClickHouse database not initialized, creating..."
        docker-compose exec -T clickhouse clickhouse-client --query "CREATE DATABASE IF NOT EXISTS hyperdash" || true
    fi

    print_status "Database migrations completed"
}

# Start application services
start_applications() {
    print_step "Starting application services..."

    # Start API Gateway
    docker-compose up -d api-gateway

    # Wait for API Gateway to be ready
    echo "Waiting for API Gateway..."
    timeout 30 bash -c 'until curl -f http://localhost:3000/health > /dev/null 2>&1; do sleep 2; done'

    # Start other application services
    docker-compose up -d web data-ingestion analytics billing copy-engine

    # Wait for web application
    echo "Waiting for Web application..."
    timeout 30 bash -c 'until curl -f http://localhost:3001 > /dev/null 2>&1; do sleep 2; done'

    print_status "Application services are ready"
}

# Start development tools (optional)
start_dev_tools() {
    print_step "Starting development tools..."

    # Start monitoring tools if profiles exist
    if docker-compose config | grep -q "prometheus:"; then
        docker-compose --profile monitoring up -d prometheus grafana
        print_status "Monitoring tools started"
    fi

    # Start database management tools
    if docker-compose config | grep -q "pgadmin:"; then
        docker-compose up -d pgadmin redis-commander kafka-ui
        print_status "Database management tools started"
    fi
}

# Show service status
show_status() {
    print_step "Service Status"
    echo "==============="

    docker-compose ps

    echo ""
    print_step "Service URLs"
    echo "==============="
    echo "🌐 Web Application:      http://localhost:3001"
    echo "🔌 API Gateway:         http://localhost:3000"
    echo "🐘 PgAdmin:             http://localhost:8080 (admin/admin)"
    echo "📊 Redis Commander:     http://localhost:8081"
    echo "📈 Kafka UI:            http://localhost:8082"
    echo "📊 Grafana:             http://localhost:3002 (admin/admin)"
    echo "📊 Prometheus:          http://localhost:9090"
    echo ""
    print_step "Development Commands"
    echo "======================"
    echo "📝 View logs:            docker-compose logs -f [service-name]"
    echo "🛑 Stop services:        ./scripts/stop-dev.sh"
    echo "🧹 Clean environment:    ./scripts/clean.sh"
    echo "🔧 Run tests:           ./scripts/test.sh"
    echo ""
    print_status "HyperDash development environment is ready! 🎉"
}

# Handle script arguments
HANDLE_BUILD=false
for arg in "$@"; do
    case $arg in
        --build)
            HANDLE_BUILD=true
            shift
            ;;
        --help)
            echo "Usage: $0 [--build]"
            echo ""
            echo "Options:"
            echo "  --build    Force rebuild of Docker images"
            echo "  --help     Show this help message"
            exit 0
            ;;
        *)
            # Unknown option
            ;;
    esac
done

# Main execution
main() {
    print_header

    check_docker
    check_prerequisites
    build_images $HANDLE_BUILD
    start_infrastructure
    run_migrations
    start_applications
    start_dev_tools
    show_status
}

# Run main function
main "$@"
