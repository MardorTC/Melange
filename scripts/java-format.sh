#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${JAVA_FORMAT_JAR:?Define JAVA_FORMAT_JAR con google-java-format 1.24.0 all-deps.jar}"
case "${1:-check}" in
  check) find app/src -name '*.java' -print0 | xargs -0 java -jar "$JAVA_FORMAT_JAR" --dry-run --set-exit-if-changed ;;
  write) find app/src -name '*.java' -print0 | xargs -0 java -jar "$JAVA_FORMAT_JAR" --replace ;;
  *) exit 2 ;;
esac
