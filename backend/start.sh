#!/bin/bash

# ── AeroVision Delhi — EC2 Startup Script ──
cd /home/ec2-user/air-quality-forecast/backend

# Activate virtual environment
source venv/bin/activate

# Export environment variables from .env file
export $(grep -v '^#' .env | xargs)

echo "========================================"
echo "  Starting AeroVision Delhi Backend"
echo "========================================"

# Start Flask with gunicorn
# 1 worker keeps memory low on t2.micro (1GB RAM)
# --timeout 120 handles slow model loading at startup
gunicorn app:app \
  --workers 1 \
  --timeout 120 \
  --bind 0.0.0.0:5000 \
  --log-level info \
  --access-logfile logs/access.log \
  --error-logfile logs/error.log \
  --daemon

echo "✓ Gunicorn started"

# Start data collection service in background
nohup python data_collection_service.py > logs/data_collection.log 2>&1 &
echo "✓ Data collection service started (PID: $!)"

echo "========================================"
echo "  All services running"
echo "========================================"