#!/bin/sh
set -eu
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20+ is required. Install it from https://nodejs.org and re-run."
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "Installing dependencies (first run)..."
  npm install
fi
echo "Starting SW-OpenC64 at http://127.0.0.1:8082/"
npm run start
