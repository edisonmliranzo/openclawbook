#!/usr/bin/env bash

# OpenClaw Deployment - Verification Checklist
# Run this script to verify all components are properly set up

echo "╔════════════════════════════════════════════════╗"
echo "║  OpenClaw Deployment Verification             ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

ERRORS=0
WARNINGS=0
SUCCESS=0

# Function to check file exists
check_file() {
  local name=$1
  local path=$2
  if [ -f "$path" ]; then
    echo "✅ $name"
    ((SUCCESS++))
  else
    echo "❌ $name (missing: $path)"
    ((ERRORS++))
  fi
}

# Function to check directory exists
check_dir() {
  local name=$1
  local path=$2
  if [ -d "$path" ]; then
    echo "✅ $name"
    ((SUCCESS++))
  else
    echo "❌ $name (missing: $path)"
    ((ERRORS++))
  fi
}

# Function to check npm script exists
check_script() {
  local name=$1
  local script=$2
  if grep -q "\"$script\"" package.json; then
    echo "✅ npm $script"
    ((SUCCESS++))
  else
    echo "❌ npm $script (not found in package.json)"
    ((WARNINGS++))
  fi
}

echo "📁 Checking directories..."
check_dir "src/" "src"
check_dir "server/" "server"
check_dir "examples/" "examples"
echo ""

echo "📝 Checking core files..."
check_file "server/index.js" "server/index.js"
check_file "server/package.json" "server/package.json"
check_file "package.json" "package.json"
echo ""

echo "🔧 Checking setup scripts..."
check_file "setup_human.js" "examples/setup_human.js"
check_file "agent_runner.cjs" "examples/agent_runner.cjs"
check_file "agent_client_cli.js" "examples/agent_client_cli.js"
check_file "quickstart.js" "examples/quickstart.js"
echo ""

echo "📚 Checking documentation..."
check_file "QUICKSTART.md" "QUICKSTART.md"
check_file "DEPLOYMENT_GUIDE.md" "DEPLOYMENT_GUIDE.md"
check_file "DEPLOYMENT_SUMMARY.md" "DEPLOYMENT_SUMMARY.md"
check_file "examples/README.md" "examples/README.md"
echo ""

echo "📦 Checking npm scripts..."
check_script "dev:server" "dev:server"
check_script "setup-human" "setup-human"
check_script "setup-agent" "setup-agent"
check_script "agent-cli" "agent-cli"
check_script "quickstart" "quickstart"
echo ""

echo "🔍 Checking npm dependencies..."
if grep -q "nodemailer" package.json; then
  echo "⚠️  nodemailer in root package.json (should be in server/package.json)"
  ((WARNINGS++))
elif grep -q "nodemailer" server/package.json; then
  echo "✅ nodemailer in server/package.json"
  ((SUCCESS++))
else
  echo "❌ nodemailer not found (run: cd server && npm install nodemailer)"
  ((ERRORS++))
fi
echo ""

echo "🏗️  Checking API endpoints..."
if grep -q "/api/agents/claim-invite" server/index.js; then
  echo "✅ POST /api/agents/claim-invite"
  ((SUCCESS++))
else
  echo "❌ Missing /api/agents/claim-invite endpoint"
  ((ERRORS++))
fi

if grep -q "/api/agents/me" server/index.js; then
  echo "✅ GET /api/agents/me"
  ((SUCCESS++))
else
  echo "❌ Missing /api/agents/me endpoint"
  ((ERRORS++))
fi

if grep -q "/api/posts" server/index.js; then
  echo "✅ POST /api/posts"
  ((SUCCESS++))
else
  echo "❌ Missing /api/posts endpoint"
  ((ERRORS++))
fi

if grep -q "/api/users" server/index.js; then
  echo "✅ GET /api/users"
  ((SUCCESS++))
else
  echo "❌ Missing /api/users endpoint"
  ((ERRORS++))
fi
echo ""

echo "╔════════════════════════════════════════════════╗"
echo "║  Verification Summary                         ║"
echo "╚════════════════════════════════════════════════╝"
echo "✅ Success:  $SUCCESS"
echo "⚠️  Warnings: $WARNINGS"
echo "❌ Errors:   $ERRORS"
echo ""

if [ $ERRORS -eq 0 ]; then
  echo "🎉 All checks passed! Ready to deploy."
  echo ""
  echo "Next steps:"
  echo "1. npm run dev:server      # Start backend"
  echo "2. npm run dev             # Start frontend"
  echo "3. npm run quickstart      # Run setup wizard"
  exit 0
else
  echo "⚠️  Please fix the above errors before deploying."
  exit 1
fi
