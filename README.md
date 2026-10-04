# Connection — 모바일 위치 공유

모임을 만들고 초대 링크를 보내면 지도에서 서로의 위치와 만날 장소를 확인할 수 있습니다. 위치는 사용자가 공유를 켜고 브라우저 권한을 허용한 경우에만 전송합니다.

## 모바일에서 사용하기

1. Safari 또는 Chrome으로 초대 링크를 엽니다. 메신저 내장 브라우저에서 위치가 안 잡히면 외부 브라우저로 다시 엽니다.
2. 닉네임과 사진을 설정하고 모임에 참여합니다. 이 단계에서는 위치가 공유되지 않습니다.
3. 하단의 위치 공유 스위치를 켜고 위치 권한을 허용합니다. 정확도와 실제 측정 시각은 참여자 목록에서 확인합니다.
4. 모임을 만든 사람은 목록 · 모임 설정에서 장소 이름을 입력하고 지도 또는 자신의 새 위치로 만날 장소를 지정합니다. 길찾기는 Google Maps에서 열립니다.
5. 홈 화면에 설치하면 앱처럼 다시 열 수 있습니다. 최근 모임은 이 브라우저에 최대 5개 저장됩니다. 공유 중 화면 켜두기는 지원 기기에서 선택할 수 있습니다.

이동할 때는 약 3초, 정지할 때는 약 10초 간격으로 새 센서 값을 요청하고 전송합니다. 정확도 우선 / 절전 우선 모드를 선택할 수 있습니다. 측정이 30초 이상 지연되거나 참여자가 연결되지 않은 경우 마지막 위치로 표시합니다. 연결 확인용 메시지는 위치 시각을 갱신하지 않습니다.

화면을 잠그거나 다른 앱으로 전환하면 웹/PWA의 위치 갱신이 중단될 수 있습니다. 화면에 돌아오면 재연결하고 새 위치를 측정합니다. **잠금 상태에서도 지속적으로 추적해야 한다면 iOS/Android 네이티브 앱과 별도 백그라운드 위치 권한이 필요합니다.** PWA 설치나 화면 유지 기능으로 이 제한이 없어지지는 않습니다.

공유를 끄면 센서 감시와 전송을 중단하고 서버의 위치를 지웁니다. 오프라인에서는 기기 전송부터 중단하며, 서버에서 숨기기는 다시 연결된 뒤 반영됩니다. 초대 링크를 아는 사람이 모임에 참여할 수 있으므로 신뢰하는 사람에게 공유하세요. 참여자 식별용 토큰은 이 브라우저에 저장되며 서버에서는 해시만 보관합니다. 로그인 계정 기반 서비스는 아닙니다.

## 로컬 실행

Node.js 24 LTS와 npm을 권장합니다.

```bash
npm ci
npm ci --prefix server
npm ci --prefix client
cp client/.env.example client/.env.local
cp server/.env.example server/.env.local
npm run dev
```

기존 `client/.env`가 있다면 `.env.local` 값이 우선합니다. `VITE_SERVER_URL`은 비워 두세요. 개발 서버가 `/api`와 `/socket.io`를 포트 3001로 전달합니다. 브라우저에서 `http://localhost:5173`을 엽니다. 휴대폰에서 다른 컴퓨터의 LAN 주소로 접근할 때는 위치 API 사용을 위해 HTTPS가 필요합니다.

Google Cloud에서 Maps JavaScript API를 활성화하고 지도용 Map ID와 키를 발급해 `client/.env.local`에 넣습니다. 키가 없으면 설정 안내 화면이 표시되며 모임과 공유 제어는 사용할 수 있습니다.

```env
VITE_GOOGLE_MAPS_API_KEY=발급한_브라우저용_키
VITE_GOOGLE_MAPS_MAP_ID=발급한_Map_ID
VITE_SERVER_URL=
```

Redis 없이 개발하면 서버의 `.data/rooms.json`에 모임을 저장합니다. 이 방식은 로컬 단일 프로세스용입니다. 모임은 마지막 활동 후 24시간에 만료됩니다. 운영 환경에서는 Redis의 TTL로 저장 데이터도 자동 삭제합니다. 로컬 파일은 다음 쓰기 때 만료된 모임을 제거합니다.

## Vercel 배포

**Vercel에 배포할 수 있습니다.** 2026년 10월 4일 확인 기준 WebSocket과 Services는 베타이며 Socket.IO의 WebSocket 전용 연결을 지원합니다. 이 저장소의 `vercel.json`은 `client`를 웹 서비스, `server`를 API 서비스로 설정합니다. 웹과 실시간 통신을 같은 도메인으로 제공하므로 휴대폰에서 별도 서버 주소를 입력할 필요가 없습니다. [Vercel WebSocket 문서](https://vercel.com/docs/functions/websockets), [Services 설정](https://vercel.com/docs/services/config-reference)

### 1. 운영 Redis 준비

네이티브 Redis TCP/TLS 연결과 PUB/SUB을 지원하는 관리형 Redis를 만듭니다. 서버와 가까운 리전을 선택하고 TLS 연결 주소를 준비하세요. Socket.IO Redis adapter는 서버 간 이벤트를 전달하고, 별도 RoomRepository가 모임 정보를 저장합니다. adapter만 연결하면 모임 저장이 해결되지 않으므로 둘 모두 사용합니다. [Socket.IO Redis adapter 문서](https://socket.io/docs/v4/redis-adapter/)

`REDIS_URL`은 `rediss://사용자:비밀번호@호스트:포트` 형태입니다. **REST API 주소나 REST 토큰은 사용할 수 없습니다.** 공급자가 제공하는 TLS 주소를 그대로 사용하고 인증정보를 Git에 넣지 마세요. Redis 재시작에도 데이터를 유지하려면 공급자의 영속 저장 설정을 사용합니다.

### 2. Vercel 프로젝트 가져오기

1. 변경한 코드를 GitHub에 커밋하고 푸시합니다.
2. Vercel의 Add New → Project에서 이 저장소를 가져옵니다.
3. **Root Directory는 저장소 루트**로 둡니다. `client`만 선택하면 Socket.IO 서버가 함께 배포되지 않습니다.
4. 빌드·설치·출력 경로는 `vercel.json`의 서비스별 설정을 사용합니다. 상위 프로젝트에 별도 Build Command나 Output Directory를 덮어쓰지 않습니다.
5. Node.js는 24.x, **Fluid Compute는 활성화**합니다. Services/WebSocket 베타의 팀 사용 가능 여부도 확인합니다. [지원 Node.js 버전](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)

서버는 HTTP 서버를 기본 export하며 Vercel에서는 직접 `listen()`하지 않습니다. 클라이언트와 서버 모두 WebSocket transport만 사용합니다. `/socket.io/*`와 `/api/*`는 API 서비스로, 나머지는 웹 서비스로 전달합니다. `/room/모임ID`를 새로고침해도 웹 서비스의 `index.html`로 연결합니다. [서비스 라우팅](https://vercel.com/docs/services/routing)

API 서비스의 `outputDirectory`는 `.`으로 유지합니다. Services 빌더가 `dist`를 함수 루트로 재배치하면 ES 모듈의 `package.json` 경계를 잃을 수 있으므로, `src/index.ts`를 기준으로 서버와 의존성을 패키징합니다.

WebSocket rewrite의 `destination.path`는 `/socket.io/connect`로 고정합니다. Services의 함수 선택 단계에서 `/socket.io/`가 디렉터리 경로로 처리되는 404를 피하기 위한 설정입니다. 서버에는 원래 요청 경로가 전달되므로 Socket.IO 클라이언트의 기본 경로는 그대로 사용합니다.

### 3. 환경 변수 입력

Vercel 프로젝트의 Environment Variables에 다음 값을 입력하고 배포합니다.

| 이름 | 용도와 값 |
| --- | --- |
| `VITE_GOOGLE_MAPS_API_KEY` | Maps JavaScript API용 브라우저 키 |
| `VITE_GOOGLE_MAPS_MAP_ID` | Google 지도 Map ID |
| `REDIS_URL` | 서버 전용 TLS Redis 연결 주소 |
| `REDIS_NAMESPACE` | Production: `connection:production`; Preview: `connection:preview` |
| `VITE_SERVER_URL` | 생략하거나 비워 두기 — 같은 도메인 사용 |
| `ALLOWED_ORIGINS` | 별도 프런트 도메인 운영 시에만 허용 주소를 쉼표로 입력 |

Production과 Preview는 Redis를 따로 사용하거나 적어도 namespace를 구분하세요. 같은 Preview namespace를 쓰는 배포들은 모임 데이터를 공유하므로, 배포별 격리가 필요하면 브랜치별 환경 변수로 namespace도 다르게 지정합니다. 서버 전용 비밀번호에 `VITE_` 접두사를 붙이지 마세요. 프런트 환경 변수는 빌드에 포함되므로 변경 후 재배포해야 합니다.

Google Maps 키는 브라우저에서 보이는 값입니다. Google Cloud에서 **Website HTTP referrer 제한**으로 실제 운영 도메인과 필요한 Preview 도메인만 허용하고, API 제한은 Maps JavaScript API로 지정합니다. 사용량과 예산 알림도 설정하세요. [Google API 키 제한](https://developers.google.com/maps/documentation/javascript/get-api-key#restrict_key)

### 4. 배포 후 확인

- `https://배포도메인/api/health`가 `{"ok":true,"storage":"redis"}`를 반환하는지 확인합니다.
- 서로 다른 브라우저나 휴대폰 2대로 모임 생성 → 링크 참여 → 공유 켜기 → 서로 위치 확인 → 공유 끄기를 확인합니다. 같은 브라우저의 탭들은 동일 참여자 ID를 사용하므로 두 사람 테스트에는 적합하지 않습니다.
- 초대 링크 직접 열기와 새로고침, 지도 표시, 만날 장소 설정 및 길찾기를 확인합니다.
- 위치 권한 거부·다시 허용, 대략적 위치 권한, 비행기 모드 해제, Wi-Fi/LTE 전환, 화면 잠금 후 복귀를 확인합니다.
- iPhone Safari / 홈 화면 설치, Android Chrome / 홈 화면 설치, 메신저 내장 브라우저에서 확인합니다.
- 최소 6분간 모임을 열어 두고 함수 연결 종료 후 자동 재연결을 확인합니다. 이 설정의 최대 연결 시간은 300초이며 재연결 중 짧은 갱신 공백이 생길 수 있습니다. 다른 인스턴스로 연결되어도 Redis에서 참여 상태를 복구합니다.
- 지도 오류는 키·API 활성화·결제·허용 referrer·Map ID를, 실시간 연결 오류는 Fluid Compute·`REDIS_URL`·라우팅·로그를 확인합니다. 공유 링크를 다른 사용자에게 제공하려면 Vercel Deployment Protection의 접근 설정도 확인합니다.

Vercel과 Redis의 실행 시간·연결·메모리 사용량, Google Maps의 지도 요청량에 따른 비용을 확인하고 예산 알림을 설정하세요. 운영 Redis가 없으면 배포 서버는 시작을 거부합니다. 운영 환경의 임시 파일에 모임을 저장하지 않습니다.

## 검증 명령

```bash
npm test
npm run build
# Redis를 사용할 수 있다면 실제 다중 서버 테스트도 실행
TEST_REDIS_URL=redis://127.0.0.1:6379 npm test --prefix server
```

테스트는 공유 OFF의 위치 비노출, 오래된 좌표 차단, 재접속, 토큰 소유권, 장소 변경 권한, 모임 만료·저장, 센서 정리·측정 시각·배터리 모드, 끊어진 연결에서 전송 보류 방지를 확인합니다. Redis 테스트는 실제 서로 다른 서버 간 전파와 인스턴스 재시작을 확인하며 `TEST_REDIS_URL`이 없으면 해당 테스트만 건너뜁니다.

PWA는 앱 화면의 정적 파일만 캐시합니다. 위치 응답, 실시간 메시지, Google 지도 타일은 캐시하지 않습니다. 오프라인에서 모임 생성·참여·위치 공유는 사용할 수 없습니다. 새 버전은 홈 화면에서 업데이트하며 진행 중인 위치 공유를 먼저 끄도록 안내합니다.

## 구조

- `client/src/hooks`: 위치 센서, 재접속, 화면 복귀, 화면 유지
- `client/src/contexts/RoomContext.tsx`: 공유 동의와 모임 상태
- `client/src/components`: 모바일 패널, 참여자, 지도, 만날 장소, 설치 안내
- `server/src/models`: TTL과 원자적 모임 저장
- `server/src/socket/handlers.ts`: 인증·공유 상태 검사와 실시간 이벤트
- `vercel.json`: 한 도메인으로 웹/API 서비스 배포

## 개인용 iPhone·Android 시험 앱

화면 잠금·다른 앱 사용 중 위치 공유를 위한 네이티브 앱과 설치 절차는 [native/README.md](native/README.md)에 있습니다. PWA의 백그라운드 제한은 그대로이며, 네이티브 앱을 별도로 설치해야 합니다. 무료 Apple 계정은 7일마다 재설치가 필요하고 Android APK는 `npm run build:android`로 만듭니다.
