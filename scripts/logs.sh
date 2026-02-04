#!/usr/bin/env bash
# Tail app logs. Prefers Docker app container; else systemd; else server/logs/backend.log
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOGFILE="$ROOT/server/logs/backend.log"

if [ -f "$ROOT/.env.prod" ]; then
	DOCKER_CMD="docker compose -f $ROOT/docker-compose.prod.yml --env-file $ROOT/.env.prod"
	if $DOCKER_CMD ps app 2>/dev/null | grep -q Up; then
		exec $DOCKER_CMD logs -f app
	fi
	if sudo $DOCKER_CMD ps app 2>/dev/null | grep -q Up; then
		exec sudo $DOCKER_CMD logs -f app
	fi
fi

if systemctl is-active --quiet workflow-backend 2>/dev/null; then
	exec sudo journalctl -u workflow-backend -f --no-pager
fi

if [ ! -f "$LOGFILE" ]; then
	echo "No log file at $LOGFILE. Start the backend with ./scripts/restart.sh or deploy with ./scripts/deploy.sh"
	exit 1
fi
exec tail -f "$LOGFILE"
