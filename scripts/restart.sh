#!/usr/bin/env bash
# Restart Workflow Builder API. Uses systemd if enabled, else stop + start in background.
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if systemctl is-enabled workflow-backend 2>/dev/null; then
	echo "Restarting backend (systemd)..."
	sudo systemctl restart workflow-backend
	echo "Done. View logs: ./scripts/logs.sh"
	exit 0
fi

if pgrep -f "uvicorn main:app" >/dev/null; then
	pkill -f "uvicorn main:app" || true
	sleep 2
fi
cd "$ROOT/server"
source .venv/bin/activate
LOGDIR="$ROOT/server/logs"
mkdir -p "$LOGDIR"
nohup uvicorn main:app --host 0.0.0.0 --port 8080 >> "$LOGDIR/backend.log" 2>&1 &
echo "Backend started. View logs: ./scripts/logs.sh"
