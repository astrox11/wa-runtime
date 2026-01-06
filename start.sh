#!/bin/bash

echo "Starting Whatsaly Server..."
echo ""
echo "Make sure you have:"
echo "- Go installed (go version 1.21+)"
echo "- Bun installed (bun --version)"
echo ""

# Check for Go
if ! command -v go &> /dev/null; then
    echo "Error: Go is not installed"
    exit 1
fi

# Check for Bun
if ! command -v bun &> /dev/null; then
    echo "Error: Bun is not installed"
    exit 1
fi

echo "Running Go server on port 8000..."
go run cmd/server/main.go
