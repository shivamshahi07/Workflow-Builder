#!/usr/bin/env bash
# Tail backend logs. Uses journalctl if systemd service is active, else server/logs/backend.log
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOGFILE="$ROOT/server/logs/backend.log"

if systemctl is-active --quiet workflow-backend 2>/dev/null; then
	exec sudo journalctl -u workflow-backend -f --no-pager
fi

if [ ! -f "$LOGFILE" ]; then
	echo "No log file at $LOGFILE. Start the backend with ./scripts/restart.sh"
	exit 1
fi
exec tail -f "$LOGFILE"
