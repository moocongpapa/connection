#!/bin/sh
set -eu
cd "$(dirname "$0")/../android"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
if [ -z "${JAVA_HOME:-}" ] && [ -d '/Applications/Android Studio.app/Contents/jbr/Contents/Home' ]; then
  export JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home'
fi
./gradlew assembleDebug
printf '\nAPK: %s/app/build/outputs/apk/debug/app-debug.apk\n' "$PWD"
