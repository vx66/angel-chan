#!/bin/sh
set -eu

# Los volúmenes existentes pueden haber sido creados como root. Ajustamos sus
# permisos antes de iniciar y ejecutamos la aplicación con el usuario sin privilegios.
mkdir -p /app/data/uploads /app/data/logs
chown -R node:node /app/data

exec su-exec node "$@"
