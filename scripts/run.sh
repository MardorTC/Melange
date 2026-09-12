#!/bin/sh
set -eu
MELANGE_ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
. "$MELANGE_ROOT/scripts/dev-env.sh"
cd "$MELANGE_ROOT"
if [ "$#" -eq 0 ]; then
    echo 'Uso: sh scripts/run.sh <comando> [argumentos...]' >&2
    exit 2
fi
exec "$@"
