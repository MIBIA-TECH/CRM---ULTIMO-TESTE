#!/bin/bash
set -e

BACKUP_DIR="/home/deploy/mibiadigital/backend/backups"
APP_DIR="/home/deploy/mibiadigital/backend"
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="backup_$DATE"
TMP_DIR="/tmp/$BACKUP_NAME"

mkdir -p "$BACKUP_DIR"
mkdir -p "$TMP_DIR"

# Extract DB connection info from .env
DB_HOST=$(grep -E "^DB_HOST=" "$APP_DIR/.env" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
DB_PORT=$(grep -E "^DB_PORT=" "$APP_DIR/.env" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
DB_USER=$(grep -E "^DB_USER=" "$APP_DIR/.env" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
DB_PASS=$(grep -E "^DB_PASS=" "$APP_DIR/.env" | cut -d '=' -f2 | tr -d '"' | tr -d "'")
DB_NAME=$(grep -E "^DB_NAME=" "$APP_DIR/.env" | cut -d '=' -f2 | tr -d '"' | tr -d "'")

# Provide password to pg_dump
export PGPASSWORD="$DB_PASS"

echo "Starting database backup..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -F p -f "$TMP_DIR/database.sql"

echo "Copying .env file..."
cp "$APP_DIR/.env" "$TMP_DIR/.env"

echo "Compressing backup files..."
tar -czvf "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" -C "/tmp" "$BACKUP_NAME"

echo "Cleaning up temporary files..."
rm -rf "$TMP_DIR"

echo "Removing old backups (keeping only the current one)..."
find "$BACKUP_DIR" -type f -name "backup_*.tar.gz" ! -name "${BACKUP_NAME}.tar.gz" -exec rm -f {} \;

echo "Backup successfully created: $BACKUP_DIR/${BACKUP_NAME}.tar.gz"
