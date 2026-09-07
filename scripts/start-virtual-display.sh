#!/usr/bin/env bash
set -euo pipefail

DISPLAY_NUM="${DISPLAY_NUM:-99}"
RESOLUTION="${RESOLUTION:-2560x1440x24}"
VNC_PORT="${VNC_PORT:-5900}"
NOVNC_PORT="${NOVNC_PORT:-6080}"

export DISPLAY=":${DISPLAY_NUM}"

echo "Starting virtual display on :${DISPLAY_NUM} (${RESOLUTION})..."
if ! pgrep -f "Xvfb :${DISPLAY_NUM}" > /dev/null 2>&1; then
  Xvfb ":${DISPLAY_NUM}" -screen 0 "${RESOLUTION}" &
  sleep 1
fi

if command -v fluxbox > /dev/null 2>&1 && ! pgrep -x fluxbox > /dev/null 2>&1; then
  echo "Starting fluxbox window manager..."
  fluxbox &
fi

if command -v x11vnc > /dev/null 2>&1 && ! pgrep -x x11vnc > /dev/null 2>&1; then
  echo "Starting x11vnc on port ${VNC_PORT}..."
  x11vnc -display ":${DISPLAY_NUM}" -forever -shared -nopw -rfbport "${VNC_PORT}" -bg
fi

if command -v websockify > /dev/null 2>&1 && [ -d "/usr/share/novnc" ] && ! pgrep -f "websockify.*${NOVNC_PORT}" > /dev/null 2>&1; then
  echo "Starting noVNC web listener on port ${NOVNC_PORT} (bridging to VNC ${VNC_PORT})..."
  websockify --web /usr/share/novnc "${NOVNC_PORT}" "localhost:${VNC_PORT}" &
fi

echo "Virtual display environment ready."
echo "Connect via browser at http://localhost:${NOVNC_PORT}/vnc.html or via VNC client on port ${VNC_PORT}."
