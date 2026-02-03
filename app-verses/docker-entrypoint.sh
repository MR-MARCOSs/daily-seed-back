#!/bin/sh
set -e

echo "Iniciando Container..."

echo "Rodando Migrations..."
npm run db:migrate

echo "Rodando Seed..."
npm run db:seed

echo "Iniciando Servidor..."
exec "$@"