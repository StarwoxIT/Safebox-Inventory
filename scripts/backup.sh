#!/bin/bash
set -e

echo "Backing up database..."
docker exec safebox-backend \
  cp /data/database.db "/data/backup-$(date +%F).db"
echo "Backup complete."
