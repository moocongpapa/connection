# Connection 개인용 모바일 앱

운영 주소: https://connection-gray-sigma.vercel.app

이 디렉터리는 iOS의 WKWebView + Core Location, Android의 WebView + 위치 Foreground Service로 구성된 시험용 앱입니다. 기존 HTTPS 화면을 그대로 사용하므로 Google Maps 키를 추가하거나 웹 코드를 앱에 복제하지 않습니다. 화면은 인터넷 연결이 필요하고, 웹 업데이트는 Vercel 배포 후 다음 실행/새로고침에 반영됩니다. 네이티브 코드가 변경되면 앱을 다시 설치해야 합니다.

## 사용 방법

1. 설치한 **Connection 앱**을 열고 모임을 만들거나, 앱 상단의 **초대 링크 열기**로 받은 링크를 입력합니다. 일반 브라우저/PWA에서 열린 링크에는 백그라운드 기능이 없습니다.
2. 위치 공유를 켜고 위치 권한을 허용합니다. iPhone은 **앱을 사용하는 동안 허용**을 선택합니다. Android의 알림 권한도 허용하면 알림에서 공유를 중지할 수 있습니다.
3. 화면을 잠그거나 다른 앱으로 이동해도 네이티브 위치 서비스가 동작합니다. iOS의 위치 사용 표시와 Android의 지속 알림이 나타납니다.
4. 웹 화면의 스위치, 앱 상단 **공유 중지**, Android 알림의 **공유 중지**로 종료합니다. 서버 업로드 권한도 취소되며 마지막 좌표가 지워집니다.

업로드는 첫 유효한 위치 이후 **최소 2분 간격**이며, 위치 요청은 약 50m 이동 기준입니다. OS가 위치를 제공하는 시점에 전송하므로 정확히 2분마다 갱신되지는 않습니다. 정지 상태·신호 부족·절전 설정에 따라 더 늦어질 수 있습니다. 네이티브 세션은 **최대 8시간**이며 이후 다시 공유를 켜야 합니다. 위치 시각은 센서가 제공한 값을 그대로 사용하고, 지연된 위치를 최신 위치처럼 보내지 않습니다.

앱 강제 종료, OS의 프로세스 종료, 재부팅 후 자동 추적은 구현하지 않습니다. 앱을 다시 열고 공유를 켜세요. 화면을 잠그는 것과 앱 전환은 강제 종료와 다릅니다. 인터넷이 끊긴 동안의 위치는 저장·재전송하지 않습니다. 오프라인에서 중지한 경우 기기 수집은 즉시 중지되지만 서버의 마지막 위치 삭제는 인터넷 복구 후 웹 재접속이 필요할 수 있습니다. 수신자에게는 마지막 측정 시각이 표시됩니다.

## iPhone: 무료 Apple 계정

- Mac의 Xcode에서 `ios/Connection.xcodeproj`를 엽니다.
- Connection 타깃 → Signing & Capabilities → Automatically manage signing을 켜고 본인의 **Personal Team**을 선택합니다.
- 아이폰을 연결하고 컴퓨터 신뢰, 필요한 경우 아이폰 **설정 → 개인정보 보호 및 보안 → 개발자 모드**를 사용자가 직접 켭니다.
- 실행 대상으로 자신의 아이폰을 선택하고 Run을 누릅니다. 요청되는 개발자 앱 신뢰 설정은 기기에서 직접 진행합니다.
- 무료 프로비저닝은 **7일** 뒤 만료됩니다. 같은 프로젝트·계정·Bundle ID로 다시 빌드·설치하세요. 기존 앱을 삭제할 필요가 없습니다.
- 무료 계정은 등록 기기 수에도 제한이 있습니다(Apple 안내 기준 3대). 전체 3~4명 중 iPhone이 몇 대인지 확인하세요. 이 절차는 개인 기기 개발·시험용이며 TestFlight/App Store 배포가 아닙니다.
- Apple 계정 비밀번호, 인증서 개인키, 기기 식별자와 개인 서명 설정은 저장소에 올리지 않습니다.

Xcode에서 처음 서명을 설정한 뒤에는 다음 스크립트도 사용할 수 있습니다.

```sh
xcrun devicectl list devices
native/scripts/install-ios.sh YOUR_PERSONAL_TEAM_ID YOUR_IPHONE_UDID
```

위치 백그라운드 모드는 Info.plist의 `UIBackgroundModes=location`으로 설정하고, 사용자가 화면에서 공유를 켠 동안 When In Use 권한과 위치 사용 표시를 이용합니다. 푸시 알림, Associated Domains 등 유료 멤버십 전용 기능은 사용하지 않습니다.

## Android: APK 설치

Android Studio와 Android SDK 36, JDK 17 이상을 준비합니다. Gradle 9.3.1 래퍼가 포함되어 있습니다.

```sh
npm run build:android
```

결과: `native/android/app/build/outputs/apk/debug/app-debug.apk`

시험 기기에 APK를 전달해 설치합니다. 설치 경로의 ‘이 출처의 앱 설치 허용’은 소유자가 직접 승인해야 합니다. APK는 Mac의 개발용 키로 서명됩니다. 업데이트를 같은 앱 위에 설치하려면 해당 키를 유지하세요. 키는 Git에 넣지 않습니다. 이 버전은 개인 시험용 Debug 빌드입니다.

Android 13 이상에서는 알림 권한을 요청합니다. 위치 권한은 앱 화면에서 받은 뒤 위치용 Foreground Service를 시작하므로 `ACCESS_BACKGROUND_LOCATION`은 요청하지 않습니다. 기기 제조사의 강한 절전 제한이 있는 경우 위치 갱신이 늦거나 중단될 수 있습니다.

## 구현 및 보안

- 네이티브 브리지는 `https://connection-gray-sigma.vercel.app`의 **주 프레임만** 허용합니다. 다른 사이트는 외부 브라우저로 열며 위치 API 접근을 제공하지 않습니다.
- 웹 화면의 공유 동의 후, 인증된 모임 Socket.IO 세션에서 `native:start`를 요청합니다.
- 서버는 모임·참여자에 한정되고 8시간 내 만료되는 256비트 업로드 토큰을 발급합니다. Redis에는 해시만 저장하고 토큰은 다른 참여자에게 노출하지 않습니다.
- 네이티브는 `/api/native/location`으로 HTTPS 전송합니다. 소켓 연결 없이도 동작하며, 서버가 저장 후 현재 연결된 참여자에게 방송합니다.
- 토큰 재발급·공유 OFF·탈퇴·만료는 이전 업로드 권한을 취소합니다. 네이티브 토큰과 위치는 기기의 디스크에 저장하지 않습니다.
- 네이티브 공유의 마지막 위치는 5분까지 최근 측정으로 표시합니다. 웹소켓 온라인 상태와 백그라운드 전송 상태를 구분합니다.

## 실제 기기 점검

빌드·자동 테스트 통과만으로 잠금 상태에서의 동작을 보장할 수 없습니다. 각 플랫폼의 실제 기기에서 다음을 확인하세요.

- 공유 OFF 상태에서 권한 요청·좌표 전송이 발생하지 않는지
- 공유 ON 후 다른 참여자가 첫 좌표와 측정 시각을 받는지
- 5분 이상 화면을 잠그고 이동했을 때 새 측정 시각이 반영되는지
- 공유 중지 후 센서 사용 표시/알림이 사라지고 상대 지도에서 위치가 삭제되는지
- 권한 거부·네트워크 단절·8시간 만료·앱 강제 종료 후 상태가 올바른지

공식 참고: [Apple 무료 계정](https://developer.apple.com/help/account/basics/about-your-developer-account), [iOS 백그라운드 위치](https://developer.apple.com/documentation/corelocation/handling-location-updates-in-the-background), [Android 위치 Foreground Service](https://developer.android.com/develop/background-work/services/fgs/service-types#location).
