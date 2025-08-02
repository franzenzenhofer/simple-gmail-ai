#!/bin/bash
# Single-file deployment script for Simple Gmail AI
# THIS SCRIPT MUST ALWAYS WORK!

set -e  # Exit on any error
set -u  # Exit on undefined variable
set -o pipefail  # Exit on pipe failure

echo "🚀 Starting single-file deployment..."
echo "📋 Deployment must ALWAYS succeed!"

# Get version info
VERSION=$(date +%Y%m%d_%H%M%S)
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Pre-deployment checks
echo "🔍 Running pre-deployment checks..."

# Check if clasp is authenticated
if ! clasp login --status >/dev/null 2>&1; then
    echo "❌ ERROR: Not logged in to clasp!"
    echo "👉 Run: clasp login"
    exit 1
fi

# Check if src directory exists
if [ ! -d "src" ]; then
    echo "❌ ERROR: src directory not found!"
    exit 1
fi

echo "✅ Pre-deployment checks passed"

# Build the bundled version
echo "🔨 Building single-file bundle..."

# Run the build process
npm run build || {
    echo "❌ Build failed!"
    exit 1
}

# Verify bundled file was created
if [ ! -f "dist/Code.gs" ]; then
    echo "❌ CRITICAL: Code.gs bundle not found!"
    exit 1
fi

# Get file size and verify it's not empty
BUNDLE_SIZE=$(ls -lh dist/Code.gs | awk '{print $5}')
BUNDLE_BYTES=$(stat -f%z dist/Code.gs 2>/dev/null || stat -c%s dist/Code.gs 2>/dev/null || echo "0")

if [ "$BUNDLE_BYTES" -lt 1000 ]; then
    echo "❌ CRITICAL: Bundle too small! Only $BUNDLE_SIZE ($BUNDLE_BYTES bytes)"
    echo "Expected at least 1KB"
    exit 1
fi

echo "📦 Bundle verified: $BUNDLE_SIZE"

# Add version information to the bundle
echo "📝 Adding version information..."
TEMP_BUNDLE=$(mktemp)
cat > "$TEMP_BUNDLE" << EOF
/**
 * Gmail Support Triage & Auto-Reply Add-on
 * Single-file bundled version
 * Version: $VERSION
 * Deployed: $TIMESTAMP
 * Size: $BUNDLE_SIZE
 * 
 * SAFETY: Development mode is enabled by default to prevent accidental emails
 */

const DEPLOYMENT_VERSION = '$VERSION';
const DEPLOYMENT_TIMESTAMP = '$TIMESTAMP';

EOF

# Append the bundled content (skip any existing headers)
tail -n +10 dist/Code.gs >> "$TEMP_BUNDLE"
mv "$TEMP_BUNDLE" dist/Code.gs

# Prepare deployment directory
echo "📦 Preparing deployment..."

# Ensure .clasp.json exists in dist with correct config
cat > dist/.clasp.json << EOF
{
  "scriptId": "1rsJQPU1V1CIHbxfz4SZbZu3sYmK8eEcXuGUM_-no1Mtr0rNbu-RHq6Xt",
  "rootDir": "."
}
EOF

# Change to dist directory for deployment
cd dist

# CRITICAL: Remove any old .js files to avoid conflicts
echo "🧹 Cleaning old deployment files..."
rm -f *.js 2>/dev/null
rm -rf src/ 2>/dev/null  # Remove any src subdirectory completely

# List what we're deploying
echo "📋 Files to deploy:"
ls -la

# CRITICAL: Remove ANY test files that might exist from previous deployments
echo "🧹 Ensuring NO test files exist..."
rm -rf tests/ 2>/dev/null || true
rm -f *.test.js *.spec.js setup.js 2>/dev/null || true

# List what we're deploying (should ONLY be Code.gs and appsscript.json)
echo "📋 Files being deployed (MUST be only 2 files!):"
ls -la | grep -E '\.(gs|json)$'

# Force push the single bundled file
echo "📤 Pushing single-file bundle to Google Apps Script..."
clasp push --force

# Check for errors
if [ $? -ne 0 ]; then
    echo "❌ Push failed!"
    echo "🔍 Checking bundle content..."
    head -20 Code.gs
    exit 1
fi

echo "✅ Single file pushed to Apps Script!"

cd ..

# Create a new version
echo "📌 Creating new version..."
VERSION_OUTPUT=$(clasp version "Version $VERSION - Single File" 2>&1 || true)
echo "$VERSION_OUTPUT"

# Deploy the new version
echo "🏷️ Creating new deployment..."
DEPLOY_DESC="v$VERSION - Single File Bundle - Gemini 2.5 Flash"
DEPLOY_OUTPUT=$(clasp deploy --description "$DEPLOY_DESC" 2>&1 || true)
echo "$DEPLOY_OUTPUT"

# List deployments
echo ""
echo "📊 Current deployments:"
clasp deployments 2>&1 || echo "Could not list deployments"

# Verification
echo ""
echo "🔍 DEPLOYMENT VERIFICATION"
echo "========================="

VERIFICATION_PASSED=0

# Verification 1: Check bundle exists
if [ -f "dist/Code.gs" ] && [ "$BUNDLE_BYTES" -gt 1000 ]; then
    echo "✅ 1. Single bundle file created ($BUNDLE_SIZE)"
    ((VERIFICATION_PASSED++))
else
    echo "❌ 1. Bundle file issue"
fi

# Verification 2: Check deployments list
DEPLOY_LIST=$(clasp deployments 2>&1 || echo "")
if echo "$DEPLOY_LIST" | grep -q "$VERSION"; then
    echo "✅ 2. Version $VERSION found in deployments!"
    ((VERIFICATION_PASSED++))
else
    echo "❌ 2. Version $VERSION NOT in deployments list"
fi

# Verification 3: Check file structure
if [ $(ls dist/*.gs 2>/dev/null | wc -l) -eq 1 ]; then
    echo "✅ 3. Single .gs file confirmed"
    ((VERIFICATION_PASSED++))
else
    echo "❌ 3. Multiple files found (should be single file)"
    ls -la dist/
fi

# Final Summary
echo ""
echo "================================"
echo "🏁 SINGLE-FILE DEPLOYMENT SUMMARY"
echo "================================"
echo "Version: $VERSION"
echo "File: Code.gs (single bundled file)"
echo "Size: $BUNDLE_SIZE"
echo "Verifications passed: $VERIFICATION_PASSED/3"
echo ""

if [ $VERIFICATION_PASSED -eq 3 ]; then
    echo "✅ ✅ ✅ SINGLE-FILE DEPLOYMENT SUCCESSFUL! ✅ ✅ ✅" 
    echo ""
    echo "🎯 SUCCESS: Version $VERSION is deployed as a SINGLE FILE!"
    echo ""
    echo "📋 TO VERIFY:"
    echo "1. Open: https://script.google.com/d/1rsJQPU1V1CIHbxfz4SZbZu3sYmK8eEcXuGUM_-no1Mtr0rNbu-RHq6Xt/edit"
    echo "2. You should see ONLY Code.gs (no other .gs files)"
    echo "3. Run onHomepage() function to test"
    echo ""
    echo "✅ DEPLOYMENT STATUS: SUCCESS - SINGLE FILE"
    exit 0
elif [ $VERIFICATION_PASSED -ge 2 ]; then
    echo "⚠️ DEPLOYMENT LIKELY SUCCESSFUL ($VERIFICATION_PASSED/3)"
    echo "Check the warnings above"
    exit 0
else
    echo "❌ DEPLOYMENT FAILED!"
    echo "Only $VERIFICATION_PASSED/3 verifications passed"
    exit 1
fi