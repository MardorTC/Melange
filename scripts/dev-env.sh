#!/bin/sh
# Sourced by run.sh and gradlew. MELANGE_ROOT is the absolute project directory.
: "${MELANGE_ROOT:?Falta la ruta del proyecto}"

if [ -z "${JAVA_HOME:-}" ] && [ -x "$MELANGE_ROOT/.tools/jdk/bin/java" ]; then
    JAVA_HOME="$MELANGE_ROOT/.tools/jdk"
    export JAVA_HOME
fi
if [ -z "${ANDROID_HOME:-}" ]; then
    if [ -n "${ANDROID_SDK_ROOT:-}" ]; then
        ANDROID_HOME="$ANDROID_SDK_ROOT"
    elif [ -d "$MELANGE_ROOT/.tools/android" ]; then
        ANDROID_HOME="$MELANGE_ROOT/.tools/android"
    fi
fi
if [ -n "${ANDROID_HOME:-}" ]; then
    ANDROID_SDK_ROOT="$ANDROID_HOME"
    export ANDROID_HOME ANDROID_SDK_ROOT
    PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
fi
if [ -n "${JAVA_HOME:-}" ]; then
    PATH="$JAVA_HOME/bin:$PATH"
fi
export PATH

# Preserve the caches managed by GitHub Actions; isolate local development caches.
if [ -z "${CI:-}" ]; then
    : "${GRADLE_USER_HOME:=$MELANGE_ROOT/.tools/gradle-home}"
    : "${PLAYWRIGHT_BROWSERS_PATH:=$MELANGE_ROOT/.tools/browsers}"
    export GRADLE_USER_HOME PLAYWRIGHT_BROWSERS_PATH
fi
if [ -z "${JAVA_FORMAT_JAR:-}" ] && [ -f "$MELANGE_ROOT/.tools/google-java-format.jar" ]; then
    JAVA_FORMAT_JAR="$MELANGE_ROOT/.tools/google-java-format.jar"
    export JAVA_FORMAT_JAR
fi
