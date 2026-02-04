#!/usr/bin/env bash
# Restart Workflow Builder. Prefers Docker (prod); else systemd; else run uvicorn in background.
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -f "$ROOT/.env.prod" ] && docker compose -f "$ROOT/docker-compose.prod.yml" --env-file "$ROOT/.env.prod" config >/dev/null 2>&1; then
	echo "Restarting app (Docker)..."
	docker compose -f "$ROOT/docker-compose.prod.yml" --env-file "$ROOT/.env.prod" restart app
	echo "Done. View logs: ./scripts/logs.sh"
	exit 0
fi

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
