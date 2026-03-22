#!/bin/bash
echo "Stopping all services..."
pkill -f gunicorn
pkill -f data_collection_service.py
echo "✓ All services stopped"