#!/bin/sh
set -eu
if [ "$#" -ne 2 ]; then
  echo 'Usage: install-ios.sh DEVELOPMENT_TEAM IPHONE_UDID' >&2
  echo 'Select a Personal Team in Xcode first. Find the device with: xcrun devicectl list devices' >&2
  exit 1
fi
cd "$(dirname "$0")/../ios"
build_path="${TMPDIR:-/tmp}/connection-ios-device"
xcodebuild -project Connection.xcodeproj -scheme Connection -configuration Debug \
  -destination "generic/platform=iOS" -derivedDataPath "$build_path" \
  DEVELOPMENT_TEAM="$1" -allowProvisioningUpdates -allowProvisioningDeviceRegistration build
xcrun devicectl device install app --device "$2" "$build_path/Build/Products/Debug-iphoneos/Connection.app"
