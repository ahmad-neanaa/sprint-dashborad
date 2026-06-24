#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
PID_FILE="$ROOT_DIR/.sprint-dash.pids"

command_exists() {
  command -v "$1" &> /dev/null
}

check_deps() {
  if ! command_exists node; then
    echo "Error: node is not installed" >&2
    exit 1
  fi
}

start_app() {
  check_deps

  if [ -f "$PID_FILE" ]; then
    echo "Application appears to already be running. Run 'stop' first or remove $PID_FILE" >&2
    exit 1
  fi

  echo "Starting Sprint Dashboard..."

  echo "  Installing backend dependencies..."
  npm install --silent --prefix "$BACKEND_DIR"

  echo "  Installing frontend dependencies..."
  npm install --silent --prefix "$FRONTEND_DIR"

  echo "  Starting backend (port 3001)..."
  npm run dev --prefix "$BACKEND_DIR" &
  BACKEND_PID=$!

  echo "  Starting frontend (port 5173)..."
  npm run dev --prefix "$FRONTEND_DIR" &
  FRONTEND_PID=$!

  echo "$BACKEND_PID" > "$PID_FILE"
  echo "$FRONTEND_PID" >> "$PID_FILE"

  echo ""
  echo "  Backend:  http://localhost:3001"
  echo "  Frontend: http://localhost:5173"
  echo ""
  echo "  Run 'stop' to shut down."
}

stop_app() {
  if [ ! -f "$PID_FILE" ]; then
    echo "No running instance found (no PID file)." >&2
    exit 0
  fi

  echo "Stopping Sprint Dashboard..."

  while read -r pid; do
    if kill -0 "$pid" 2> /dev/null; then
      kill "$pid" 2> /dev/null && echo "  Stopped PID $pid" || true
    fi
  done < "$PID_FILE"

  rm -f "$PID_FILE"
  echo "Done."
}

status_app() {
  if [ ! -f "$PID_FILE" ]; then
    echo "Sprint Dashboard is not running."
    return
  fi

  echo "Sprint Dashboard PIDs:"
  while read -r pid; do
    if kill -0 "$pid" 2> /dev/null; then
      ps -p "$pid" -o pid,command --no-headers 2> /dev/null || echo "  PID $pid (running)"
    else
      echo "  PID $pid (stale)"
    fi
  done < "$PID_FILE"
}

usage() {
  echo "Usage: $0 {start|stop|status|restart}" >&2
  exit 1
}

case "${1:-}" in
  start)   start_app ;;
  stop)    stop_app ;;
  restart) stop_app; start_app ;;
  status)  status_app ;;
  *)       usage ;;
esac
