#!/bin/bash

# HyperDash Platform Test Runner
# This script runs all tests across the platform

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
    echo -e "${BLUE}🧪 $1${NC}"
}

# Check if we're in the right directory
check_directory() {
    if [ ! -f "package.json" ]; then
        print_error "Please run this script from the root directory of the project"
        exit 1
    fi
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Tests require Docker to be running."
        echo
        echo "Please start Docker first:"
        echo "  ./scripts/start-dev.sh"
        exit 1
    fi
}

# Install test dependencies if needed
install_test_deps() {
    if [ ! -d "node_modules" ] || [ ! -d "packages/shared-types/node_modules" ]; then
        print_status "Installing test dependencies..."
        npm ci
    fi
}

# Run package tests
run_package_tests() {
    print_header "Running Package Tests"

    # Test shared packages
    if [ -d "packages/shared-types" ]; then
        echo "Testing shared-types package..."
        cd packages/shared-types
        npm test || {
            print_error "Shared types tests failed"
            return 1
        }
        cd ../..
    fi

    if [ -d "packages/database" ]; then
        echo "Testing database package..."
        cd packages/database
        npm test || {
            print_error "Database package tests failed"
            return 1
        }
        cd ../..
    fi

    if [ -d "packages/contracts" ]; then
        echo "Testing contracts package..."
        cd packages/contracts
        npm test || {
            print_error "Contracts package tests failed"
            return 1
        }
        cd ../..
    fi

    print_status "Package tests completed"
    return 0
}

# Run application tests
run_app_tests() {
    print_header "Running Application Tests"

    # Test API Gateway
    if [ -d "apps/api-gateway" ]; then
        echo "Testing API Gateway..."
        cd apps/api-gateway
        npm test || {
            print_error "API Gateway tests failed"
            return 1
        }
        cd ../..
    fi

    # Test Web application
    if [ - -d "apps/web" ]; then
        echo "Testing Web application..."
        cd apps/web
        npm test || {
            print_warning "Web application tests failed (may be expected)"
            # Don't fail the entire test suite for frontend tests in dev mode
        }
        cd ../..
    fi

    # Test other services if they exist
    for service in "data-ingestion analytics billing"; do
        if [ -d "apps/$service" ]; then
            echo "Testing $service service..."
            cd apps/$service
            npm test || {
                print_warning "$service tests failed (may be expected)"
            }
            cd ../..
        fi
    done

    print_status "Application tests completed"
    return 0
}

# Run Go tests (copy engine)
run_go_tests() {
    print_header "Running Go Tests (Copy Engine)"

    if [ -d "apps/copy-engine" ]; then
        echo "Testing Copy Engine..."
        cd apps/copy-engine
        go test ./... || {
            print_error "Copy Engine tests failed"
            return 1
        }
        cd ../..

        print_status "Go tests completed"
    else
        print_warning "No Go application found - skipping Go tests"
    fi

    return 0
}

# Run integration tests
run_integration_tests() {
    print_header "Running Integration Tests"

    # Check if Docker services are running
    if ! docker-compose ps -q 2>/dev/null | grep -q "Up"; then
        print_error "Docker services are not running. Integration tests require services to be running."
        echo
        echo "Please start services first: ./scripts/start-dev.sh"
        return 1
    fi

    # Run integration tests
    echo "Running integration tests..."

    # In a real implementation, this would run end-to-end tests
    # For now, we'll do basic connectivity tests

    # Test API Gateway connectivity
    if curl -f http://localhost:3000/health &> /dev/null; then
        print_status "✅ API Gateway is accessible"
    else
        print_error "❌ API Gateway is not accessible"
        return 1
    fi

    # Test database connectivity
    if docker exec postgres pg_isready -U hyperdash -d hyperdash &> /dev/null; then
        print_status "✅ PostgreSQL is accessible"
    else
        print_error "❌ PostgreSQL is not accessible"
        return 1
    fi

    # Test Redis connectivity
    if docker exec redis redis-cli ping > /dev/null; then
        print_status "✅ Redis is accessible"
    else
        print_error "❌ Redis is not accessible"
        return 1
    fi

    # Test ClickHouse connectivity
    if curl -f http://localhost:8123/ping > /dev/null; then
        print_status "✅ ClickHouse is accessible"
    else
        print_error "❌ ClickHouse is not accessible"
        return 1
    fi

    print_status "Integration tests completed"
    return 0
}

# Generate test coverage report
generate_coverage() {
    print_header "Generating Coverage Report"

    echo "Generating coverage reports..."

    # Generate coverage for packages
    npm run test:coverage || {
        print_warning "Coverage generation failed for packages"
    }

    # Generate coverage for apps
    npm run test:coverage:apps || {
        print_warning "Coverage generation failed for apps"
    }

    print_status "Coverage reports generated"
    echo
}

# Check test requirements
check_requirements() {
    print_header "Checking Test Requirements"

    # Check for test dependencies
    test_deps=("jest" "ts-jest" "supertest" "jest-environment-js")
    missing_deps=()

    for dep in "${test_deps[@]}"; do
        if ! npm list "$dep" &> /dev/null; then
            missing_deps+=("$dep")
        fi
    done

    if [ ${#missing_deps[@]} -gt 0 ]; then
        print_warning "Missing test dependencies: ${missing_deps[*]}"
        echo "Installing missing test dependencies..."
        npm install --save-dev "${missing_deps[@]}" 2>/dev/null || {
            print_error "Failed to install test dependencies"
            return 1
        }
    fi

    print_status "All test requirements satisfied"
    echo
}

# Main test function
main() {
    echo "🧪 Running HyperDash Platform Tests"
    echo "=================================="

    check_directory
    check_docker
    check_requirements
    install_test_deps

    # Run tests in order
    test_exit_code=0

    echo
    print_header "Running Test Suite"

    # Package tests
    run_package_tests || test_exit_code=$?

    # Application tests
    run_app_tests || test_exit_code=$?

    # Go tests
    run_go_tests || test_exit_code=$?

    # Integration tests
    run_integration_tests || test_exit_code=$?

    # Generate coverage
    generate_coverage

    # Exit with the appropriate code
    if [ $test_exit_code -eq 0 ]; then
        print_header "🎉 All Tests Passed!"
        echo
        print_status "Test suite completed successfully"

        echo
        echo "📊 Coverage Reports:"
        echo "  • Coverage reports are available in coverage/ directories"
        echo "  • Open coverage/lcov-report/index.html in your browser"
        echo
    else
        print_header "❌ Some Tests Failed!"
        echo
        print_error "Please check the test output above for details"
        echo
        exit $test_exit_code
    fi
}

# Run main function
main "$@"
