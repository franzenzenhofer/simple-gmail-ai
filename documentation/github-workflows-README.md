# GitHub Actions Workflows

This directory contains the CI/CD pipelines for the Gmail Support Triage AI project.

## Workflows

### CI (ci.yml)
- **Trigger**: Push to main/develop branches, pull requests
- **Purpose**: Run tests, linting, and build verification
- **Matrix**: Tests on Node.js 18.x and 20.x
- **Artifacts**: Test results saved for 30 days

### Deploy (deploy.yml)
- **Trigger**: Git tags matching `v*` pattern or manual dispatch
- **Purpose**: Deploy to Google Apps Script
- **Requirements**: 
  - `CLASP_CREDENTIALS` secret must be set in repository
  - Uses clasp CLI for deployment
- **Creates**: GitHub release with deployment info

## Setting up Deployment

1. Run `clasp login` locally
2. Copy contents of `~/.clasprc.json`
3. Add as `CLASP_CREDENTIALS` secret in GitHub repository settings
4. Tag releases with `v*` pattern (e.g., `v1.10.0`)

## Badge URLs

The README displays real-time status badges:
- CI: Shows test status for main branch
- Deploy: Shows latest deployment status
- License: MIT license badge