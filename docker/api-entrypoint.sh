#!/bin/sh
set -e

if [ ! -d node_modules/express ]; then
  echo "instalando dependências no volume..."
  npm install --no-audit --no-fund
fi

exec npm run dev