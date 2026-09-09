#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
case "${1:-release}" in
  debug) exec ./gradlew :app:assembleDebug ;;
  release) exec ./gradlew :app:assembleRelease ;;
  *) echo 'Uso: ./build.sh [debug|release]' >&2; exit 2 ;;
esac
