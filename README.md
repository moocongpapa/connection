# 🗺️ Connection — 실시간 위치 공유 서비스

친구들과 실시간으로 위치를 공유하세요! 모임을 만들고 링크를 보내면, Google Maps 위에서 서로의 위치를 실시간으로 확인할 수 있습니다.

## ✨ 주요 기능

- 🏠 **모임 생성 & 링크 공유** — 모임을 만들고 URL만 공유하면 바로 참여
- 📍 **실시간 위치 추적** — 적응형 업데이트 (이동 중 3초, 정지 시 10초)
- 👤 **프로필 사진 마커** — 원형 프로필 사진이 지도 위에서 움직입니다
- 🙈 **위치 공유 ON/OFF** — 일시적으로 위치를 숨길 수 있습니다
- 🌙 **다크/라이트 모드** — 시스템 설정 자동 감지 + 수동 전환
- 📱 **반응형 디자인** — 모바일 바텀시트 + 데스크톱 사이드바
- 🌍 **글로벌 지원** — Google Maps 기반으로 해외에서도 사용 가능

## 🚀 시작하기

### 사전 준비

1. **Node.js** v18 이상 설치
2. **Google Maps API Key** 발급 ([Google Cloud Console](https://console.cloud.google.com/google/maps-apis))
   - Maps JavaScript API 활성화
   - Map ID 생성 (Advanced Markers 사용에 필요)

### 설치

```bash
# 모든 의존성 설치
cd connection
npm install
cd server && npm install
cd ../client && npm install
cd ..
```

### 환경 변수 설정

`client/.env` 파일을 수정하세요:

```env
VITE_GOOGLE_MAPS_API_KEY=여기에_API_키_입력
VITE_GOOGLE_MAPS_MAP_ID=여기에_Map_ID_입력
VITE_SERVER_URL=http://localhost:3001
```

### 실행

```bash
# 서버 + 클라이언트 동시 실행
npm run dev
```

또는 별도로 실행:

```bash
# 서버 (port 3001)
cd server && npm run dev

# 클라이언트 (port 5173)
cd client && npm run dev
```

### 접속

- 브라우저에서 `http://localhost:5173` 접속
- "모임 만들기" → 프로필 설정 → 지도 화면
- 공유 링크를 다른 브라우저/탭에서 열어 테스트

## 🧪 테스트 방법

1. Chrome DevTools → Sensors → Location에서 가상 위치 설정 가능
2. 두 개의 브라우저 탭에서 각각 다른 프로필로 참여하여 테스트

## 🛠️ 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS v4 |
| Maps | @vis.gl/react-google-maps (Advanced Markers) |
| Backend | Node.js + Express + Socket.IO |
| Real-time | WebSocket (Socket.IO) |
| Data | In-memory (서버 메모리) |

## 📁 프로젝트 구조

```
connection/
├── client/              # React 프론트엔드
│   └── src/
│       ├── components/  # UI 컴포넌트
│       ├── hooks/       # 커스텀 훅
│       ├── contexts/    # React Context
│       ├── types/       # TypeScript 타입
│       └── utils/       # 유틸리티 함수
├── server/              # Node.js 백엔드
│   └── src/
│       ├── socket/      # Socket.IO 핸들러
│       ├── models/      # 데이터 모델
│       ├── routes/      # REST API
│       └── utils/       # 유틸리티
└── package.json         # 루트 스크립트
```
