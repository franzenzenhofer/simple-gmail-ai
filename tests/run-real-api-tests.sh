#!/bin/bash

# Script to run real Gemini API tests
# These tests make actual API calls to verify everything works

echo "🧪 Running Real Gemini API Tests"
echo "================================"

# Check if API key is provided
if [ -z "$GEMINI_API_KEY" ]; then
    echo "⚠️  No GEMINI_API_KEY environment variable found"
    echo "📝 Using test API key from codebase"
    export GEMINI_API_KEY="AIzaSyBDeR8FBytoqxJ16aJV_2ryF__ChsUPCDE"
fi

echo "🔑 API Key: ${GEMINI_API_KEY:0:10}..."
echo ""

# Build the project first
echo "🔨 Building project..."
npm run build

# Run only the real API tests
echo ""
echo "🚀 Running real API tests..."
npx jest tests/src/modules/ai-real-api.test.ts --verbose --runInBand

# Capture exit code
TEST_EXIT_CODE=$?

echo ""
echo "================================"
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ All real API tests passed!"
else
    echo "❌ Some tests failed. Exit code: $TEST_EXIT_CODE"
fi

exit $TEST_EXIT_CODE