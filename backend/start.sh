#!/bin/bash
# Start the FastAPI backend server

cd "$(dirname "$0")"

# Activate virtual environment
source venv/bin/activate

# Start uvicorn server
echo "Starting FastAPI server on http://localhost:8000"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
