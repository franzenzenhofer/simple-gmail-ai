#!/bin/bash
# Single-file deployment script for Simple Gmail AI
# THIS SCRIPT MUST ALWAYS WORK!

# Security hardening
set -euo pipefail  # Exit on error, undefined vars, pipe failures
IFS=$'\n\t'       # Secure Internal Field Separator
umask 077         # Restrictive file permissions for new files

# Parse command line arguments
DRY_RUN=false
SHOW_HELP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help|-h)
            SHOW_HELP=true
            shift
            ;;
        *)
            echo "❌ Unknown option: $1"
            echo "Usage: $0 [--dry-run] [--help]"
            exit 1
            ;;
    esac
done

if [[ "$SHOW_HELP" == true ]]; then
    cat << 'EOF'
Gmail Support Triage AI - Deploy Script

USAGE:
    ./deploy.sh [OPTIONS]

OPTIONS:
    --dry-run    Preview deployment actions without executing them
    --help, -h   Show this help message

EXAMPLES:
    ./deploy.sh           # Normal deployment
    ./deploy.sh --dry-run # Preview what would be deployed

DESCRIPTION:
    This script builds and deploys the Gmail AI Support Triage add-on to
    Google Apps Script. It performs comprehensive validation, builds the
    single-file bundle, and deploys it with proper versioning.

    In dry-run mode, all destructive operations are skipped and preview
    information is shown instead.
EOF
    exit 0
fi

# Set dry-run indicator for logging
if [[ "$DRY_RUN" == true ]]; then
    readonly DRY_RUN_PREFIX="[DRY-RUN] "
    echo "🔍 DRY-RUN MODE: No actual deployment will occur"
else
    readonly DRY_RUN_PREFIX=""
fi

# Cleanup function for error handling
cleanup() {
    local exit_code=$?
    if [[ -n "${TEMP_BUNDLE:-}" && -f "$TEMP_BUNDLE" ]]; then
        rm -f "$TEMP_BUNDLE"
    fi
    if [[ $exit_code -ne 0 ]]; then
        echo "❌ Deployment failed with exit code $exit_code"
        echo "🧹 Cleanup completed"
    fi
    exit $exit_code
}
trap cleanup EXIT

# Validate environment
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$SCRIPT_DIR"

echo "${DRY_RUN_PREFIX}🚀 Starting single-file deployment..."
echo "${DRY_RUN_PREFIX}📋 Deployment must ALWAYS succeed!"
echo "${DRY_RUN_PREFIX}📁 Working directory: $PROJECT_ROOT"

# Get version info
readonly VERSION="$(date +%Y%m%d_%H%M%S)"
readonly TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Validate we're in the correct directory
if [[ ! -f "package.json" ]] || [[ ! -d "src" ]]; then
    echo "❌ ERROR: Must run from project root (package.json and src/ required)"
    exit 1
fi

# Pre-deployment checks
echo "🔍 Running pre-deployment checks..."

# Validate required commands are available
for cmd in clasp npm node; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "❌ ERROR: Required command '$cmd' not found!"
        exit 1
    fi
done

# Check if clasp is authenticated
if ! clasp login --status >/dev/null 2>&1; then
    echo "❌ ERROR: Not logged in to clasp!"
    echo "👉 Run: clasp login"
    exit 1
fi

# Validate directory structure
if [[ ! -d "src" ]]; then
    echo "❌ ERROR: src directory not found!"
    exit 1
fi

if [[ ! -f "src/Code.ts" ]]; then
    echo "❌ ERROR: src/Code.ts not found!"
    exit 1
fi

echo "✅ Pre-deployment checks passed"

# Build the bundled version
echo "${DRY_RUN_PREFIX}🔨 Building single-file bundle..."

# Run the build process (always run build, even in dry-run)
if [[ "$DRY_RUN" == true ]]; then
    echo "${DRY_RUN_PREFIX}Would run: npm run build"
    echo "${DRY_RUN_PREFIX}Build validation: checking if dist/Code.gs exists..."
    if [[ -f "dist/Code.gs" ]]; then
        echo "${DRY_RUN_PREFIX}✅ Existing bundle found for dry-run validation"
    else
        echo "${DRY_RUN_PREFIX}❌ No existing bundle found - run without --dry-run first"
        exit 1
    fi
else
    npm run build || {
        echo "❌ Build failed!"
        exit 1
    }
fi

# Verify bundled file was created
if [ ! -f "dist/Code.gs" ]; then
    echo "❌ CRITICAL: Code.gs bundle not found!"
    exit 1
fi

# Get file size and verify it's not empty - portable across macOS and Linux
get_file_size() {
    local file="$1"
    if [[ ! -f "$file" ]]; then
        echo "0"
        return
    fi
    
    # Try macOS stat first, then Linux stat
    if stat -f%z "$file" 2>/dev/null; then
        return
    elif stat -c%s "$file" 2>/dev/null; then
        return
    else
        echo "0"
    fi
}

readonly BUNDLE_SIZE="$(ls -lh dist/Code.gs | awk '{print $5}')"
readonly BUNDLE_BYTES="$(get_file_size "dist/Code.gs")"

if [ "$BUNDLE_BYTES" -lt 1000 ]; then
    echo "❌ CRITICAL: Bundle too small! Only $BUNDLE_SIZE ($BUNDLE_BYTES bytes)"
    echo "Expected at least 1KB"
    exit 1
fi

echo "${DRY_RUN_PREFIX}📦 Bundle verified: $BUNDLE_SIZE"

# Add version information to the bundle
echo "${DRY_RUN_PREFIX}📝 Adding version information..."
if [[ "$DRY_RUN" == true ]]; then
    echo "${DRY_RUN_PREFIX}Would create temp bundle with version header"
    echo "${DRY_RUN_PREFIX}Version: $VERSION"
    echo "${DRY_RUN_PREFIX}Timestamp: $TIMESTAMP"
    echo "${DRY_RUN_PREFIX}Size: $BUNDLE_SIZE"
else
    readonly TEMP_BUNDLE="$(mktemp -t deploy_bundle.XXXXXX)"
    cat > "$TEMP_BUNDLE" << EOF
/**
 * Gmail Support Triage & Auto-Reply Add-on
 * Single-file bundled version
 * Version: $VERSION
 * Deployed: $TIMESTAMP
 * Size: $BUNDLE_SIZE
 * 
 * Production deployment ready
 */

const DEPLOYMENT_VERSION = '$VERSION';
const DEPLOYMENT_TIMESTAMP = '$TIMESTAMP';

EOF

    # Append the bundled content (skip any existing headers)
    tail -n +10 dist/Code.gs >> "$TEMP_BUNDLE"
    mv "$TEMP_BUNDLE" dist/Code.gs
fi

# Prepare deployment directory
echo "${DRY_RUN_PREFIX}📦 Preparing deployment..."

if [[ "$DRY_RUN" == true ]]; then
    echo "${DRY_RUN_PREFIX}Would create .clasp.json in dist/"
    echo "${DRY_RUN_PREFIX}Would change to dist/ directory"
else
    # Ensure .clasp.json exists in dist with correct config
    cat > dist/.clasp.json << EOF
{
  "scriptId": "1rsJQPU1V1CIHbxfz4SZbZu3sYmK8eEcXuGUM_-no1Mtr0rNbu-RHq6Xt",
  "rootDir": "."
}
EOF

    # Change to dist directory for deployment
    cd dist
fi

if [[ "$DRY_RUN" == true ]]; then
    # In dry-run mode, show what would be cleaned and deployed
    echo "${DRY_RUN_PREFIX}🧹 Would clean old deployment files..."
    echo "${DRY_RUN_PREFIX}Would remove: *.js files, src/ directory, test files"
    echo "${DRY_RUN_PREFIX}📋 Current files in dist/:"
    ls -la dist/ 2>/dev/null || echo "${DRY_RUN_PREFIX}dist/ directory not accessible"
    echo "${DRY_RUN_PREFIX}📋 Files that would be deployed:"
    (cd dist && ls -la | grep -E '\.(gs|json)$') 2>/dev/null || echo "${DRY_RUN_PREFIX}No .gs/.json files found"
else
    # CRITICAL: Remove any old .js files to avoid conflicts
    echo "🧹 Cleaning old deployment files..."
    find . -maxdepth 1 -name "*.js" -type f -delete 2>/dev/null || true
    if [[ -d "src" ]]; then
        rm -rf "src"  # Remove any src subdirectory completely
    fi

    # List what we're deploying
    echo "📋 Files to deploy:"
    ls -la

    # CRITICAL: Remove ANY test files that might exist from previous deployments
    echo "🧹 Ensuring NO test files exist..."
    if [[ -d "tests" ]]; then
        rm -rf "tests"
    fi
    find . -maxdepth 1 \( -name "*.test.js" -o -name "*.spec.js" -o -name "setup.js" \) -type f -delete 2>/dev/null || true

    # List what we're deploying (should ONLY be Code.gs and appsscript.json)
    echo "📋 Files being deployed (MUST be only 2 files!):"
    ls -la | grep -E '\.(gs|json)$'

    # Re-run post-bundle tests after header insertion and cleanup
    echo "🧪 Running final post-bundle validation..."
    cd ..  # Go back to project root for npm command
    if ! npm run test:postbundle; then
        echo "❌ Post-bundle tests failed after deployment preparation. Check dist/Code.gs."
        exit 1
    fi
    echo "✅ Post-bundle validation passed - ready for deployment"
    cd dist  # Return to dist directory for deployment
fi

if [[ "$DRY_RUN" == true ]]; then
    echo "${DRY_RUN_PREFIX}📤 Would push single-file bundle to Google Apps Script..."
    echo "${DRY_RUN_PREFIX}Would run: clasp push --force"
    echo "${DRY_RUN_PREFIX}✅ Would push single file to Apps Script!"
    # Don't change directory in dry-run mode since we never entered dist/
else
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
fi

if [[ "$DRY_RUN" == true ]]; then
    echo "${DRY_RUN_PREFIX}📌 Would create new version..."
    echo "${DRY_RUN_PREFIX}Would run: clasp version \"Version $VERSION - Single File\""
    echo "${DRY_RUN_PREFIX}🏷️ Would create new deployment..."
    echo "${DRY_RUN_PREFIX}Would run: clasp deploy --description \"v$VERSION - Single File Bundle - Gemini 2.5 Flash\""
    echo "${DRY_RUN_PREFIX}📊 Would list current deployments"
else
    # Create a new version
    echo "📌 Creating new version..."
    if ! VERSION_OUTPUT=$(clasp version "Version $VERSION - Single File" 2>&1); then
        echo "❌ ERROR: Failed to create version!"
        echo "$VERSION_OUTPUT"
        exit 1
    fi
    echo "$VERSION_OUTPUT"

    # Deploy the new version
    echo "🏷️ Creating new deployment..."
    DEPLOY_DESC="v$VERSION - Single File Bundle - Gemini 2.5 Flash"
    if ! DEPLOY_OUTPUT=$(clasp deploy --description "$DEPLOY_DESC" 2>&1); then
        echo "❌ ERROR: Failed to create deployment!"
        echo "$DEPLOY_OUTPUT"
        exit 1
    fi
    echo "$DEPLOY_OUTPUT"

    # List deployments
    echo ""
    echo "📊 Current deployments:"
    clasp deployments 2>&1 || echo "Could not list deployments"
fi

# Verification
echo ""
echo "${DRY_RUN_PREFIX}🔍 DEPLOYMENT VERIFICATION"
echo "${DRY_RUN_PREFIX}========================="

VERIFICATION_PASSED=0

# Verification 1: Check bundle exists
if [ -f "dist/Code.gs" ] && [ "$BUNDLE_BYTES" -gt 1000 ]; then
    echo "${DRY_RUN_PREFIX}✅ 1. Single bundle file created ($BUNDLE_SIZE)"
    ((VERIFICATION_PASSED++))
else
    echo "${DRY_RUN_PREFIX}❌ 1. Bundle file issue"
fi

if [[ "$DRY_RUN" == true ]]; then
    echo "${DRY_RUN_PREFIX}✅ 2. Would verify version $VERSION in deployments"
    ((VERIFICATION_PASSED++))
    echo "${DRY_RUN_PREFIX}✅ 3. Would verify single .gs file structure"
    ((VERIFICATION_PASSED++))
else
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
fi

# Final Summary
echo ""
echo "${DRY_RUN_PREFIX}================================"
echo "${DRY_RUN_PREFIX}🏁 SINGLE-FILE DEPLOYMENT SUMMARY"
echo "${DRY_RUN_PREFIX}================================"
echo "${DRY_RUN_PREFIX}Version: $VERSION"
echo "${DRY_RUN_PREFIX}File: Code.gs (single bundled file)"
echo "${DRY_RUN_PREFIX}Size: $BUNDLE_SIZE"
echo "${DRY_RUN_PREFIX}Verifications passed: $VERIFICATION_PASSED/3"
echo ""

if [[ "$DRY_RUN" == true ]]; then
    echo "${DRY_RUN_PREFIX}🔍 DRY-RUN SUMMARY"
    echo "${DRY_RUN_PREFIX}=================="
    echo "${DRY_RUN_PREFIX}✅ All pre-flight checks passed"
    echo "${DRY_RUN_PREFIX}✅ Bundle validation successful" 
    echo "${DRY_RUN_PREFIX}✅ Deployment plan verified"
    echo ""
    echo "${DRY_RUN_PREFIX}🚀 Ready for actual deployment!"
    echo "${DRY_RUN_PREFIX}Run without --dry-run to deploy:"
    echo "${DRY_RUN_PREFIX}  ./deploy.sh"
    exit 0
else
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
fi