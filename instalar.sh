#!/usr/bin/env bash
# Atajo para quien parte del repo del frontend: trae el backend junto a este
# repo (misma rama) y ejecuta el instalador único, que despliega los dos.
#
#   git clone https://github.com/camilovivasr-source/periferia_reto_frontend.git
#   PROJECT_ID=mi-proyecto bash periferia_reto_frontend/instalar.sh
set -uo pipefail
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAMA="${RAMA:-$(git -C "$AQUI" branch --show-current 2>/dev/null)}"; RAMA="${RAMA:-main}"
OWNER="${OWNER:-$(git -C "$AQUI" remote get-url origin 2>/dev/null | sed -nE 's#.*github\.com[:/]([^/]+)/.*#\1#p')}"
OWNER="${OWNER:-camilovivasr-source}"
BACK="${BACKEND_DIR:-$(dirname "$AQUI")/periferia_reto_backend}"
if [ ! -f "$BACK/instalar.sh" ]; then
  git clone -q -b "$RAMA" "https://github.com/${OWNER}/periferia_reto_backend.git" "$BACK" 2>/dev/null \
    || { command -v gh >/dev/null && gh repo clone "${OWNER}/periferia_reto_backend" "$BACK" -- -q -b "$RAMA"; } \
    || { echo "No pude clonar el backend en $BACK (repo privado: gh auth login, o clónalo a mano)." >&2; exit 1; }
fi
FRONTEND_DIR="$AQUI" exec bash "$BACK/instalar.sh" "$@"
