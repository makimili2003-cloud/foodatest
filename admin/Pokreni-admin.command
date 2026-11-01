#!/bin/bash
# Mac/Linux: dupli klik (Mac) ili ./Pokreni-admin.command
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then echo "Node.js nije instaliran. Preuzmi ga sa https://nodejs.org (LTS verzija)"; read -r; exit 1; fi
[ -d node_modules ] || { echo "Instaliram pakete, samo prvi put..."; npm install --no-audit --no-fund; }
if [ ! -f .env ]; then cp .env.example .env; echo "Napravljen je fajl .env - otvori ga, upiši GITHUB_TOKEN i ADMIN_PIN, pa pokreni ponovo."; open -e .env 2>/dev/null; read -r; exit 0; fi
node server.js
