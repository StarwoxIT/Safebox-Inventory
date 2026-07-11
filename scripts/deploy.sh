#!/bin/bash
set -e

# Configure via environment variables or a local .env.deploy file (not committed):
#   EC2_USER   - SSH user on the remote server (default: ubuntu)
#   EC2_HOST   - EC2 public IP or hostname (required)
#   EC2_PATH   - path to the repo on the remote server (default: ~/quotegeneratorsystem)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

if [ -f "$ROOT_DIR/.env.deploy" ]; then
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env.deploy"
fi

EC2_USER="${EC2_USER:-ubuntu}"
EC2_PATH="${EC2_PATH:-~/quotegeneratorsystem}"

if [ -z "$EC2_HOST" ]; then
  echo "Error: EC2_HOST is not set. Export it or add it to a .env.deploy file at the project root."
  exit 1
fi

echo "Deploying to production server ($EC2_HOST)..."
ssh "$EC2_USER@$EC2_HOST" "cd $EC2_PATH && git pull origin main && docker-compose down && docker-compose up -d --build"
echo "Deployment complete."
