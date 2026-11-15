#!/bin/sh
set -e

# O volume pode existir sem as devDependencies (ex.: semeado com deps de
# produção). Em dev precisamos do nodemon, então garantimos a instalação
# completa quando ele estiver ausente.
if [ ! -d node_modules/nodemon ]; then
  echo "instalando dependências (inclui dev) no volume..."
  npm install --include=dev --no-audit --no-fund
fi

exec npm run dev