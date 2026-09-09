#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
OSP_SDK="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
: "${OSP_SDK:?Define ANDROID_SDK_ROOT con la ruta del SDK Android}"
OSP_BT="$OSP_SDK/build-tools/35.0.0"
OSP_ANDROID="$OSP_SDK/platforms/android-35/android.jar"
OSP_KEYS="${OSP_SIGNING_DIR:-$PWD/signing}"
mkdir -p build/compiled build/generated build/classes build/dex
rm -f build/compiled/* build/dex/*
"$OSP_BT/aapt2" compile --dir app/src/main/res -o build/compiled
"$OSP_BT/aapt2" link -o build/base.apk --manifest app/src/main/AndroidManifest.xml -I "$OSP_ANDROID" --java build/generated -A app/src/main/assets build/compiled/*
find app/src/main/java build/generated -name '*.java' > build/sources.txt
javac -encoding UTF-8 -source 8 -target 8 -classpath "$OSP_ANDROID" -d build/classes @build/sources.txt
jar cf build/classes.jar -C build/classes .
"$OSP_BT/d8" --lib "$OSP_ANDROID" --min-api 26 --output build/dex build/classes.jar
cp build/base.apk build/unsigned.apk
(cd build/dex && zip -q ../unsigned.apk classes.dex)
"$OSP_BT/zipalign" -f -p 4 build/unsigned.apk build/aligned.apk
if [[ ! -f "$OSP_KEYS/projectosp.jks" ]]; then
  echo 'Falta la clave original de firma. No se generará otra automáticamente.' >&2
  exit 1
fi
"$OSP_BT/apksigner" sign --ks "$OSP_KEYS/projectosp.jks" --ks-key-alias projectosp --ks-pass "file:$OSP_KEYS/password.txt" --out build/Melange-7.1.0.apk build/aligned.apk
"$OSP_BT/apksigner" verify --verbose build/Melange-7.1.0.apk
