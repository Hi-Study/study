# 배포 가이드 — 안드로이드 APK(무료) + 아이폰 웹(무료)

내부 인원에게 **무료**로 배포하는 방법입니다.
- **안드로이드** → APK 파일을 만들어 링크/파일로 공유 → 설치 (진짜 앱)
- **아이폰** → 웹(PWA)으로 배포 → Safari에서 "홈 화면에 추가" (앱처럼 사용)

> 사전 준비물: [expo.dev](https://expo.dev) 무료 계정 하나 (안드로이드 빌드용).
> 모든 명령은 `study-app` 폴더에서 실행합니다.

---

## 1. 안드로이드 APK (무료, EAS Build)

### 최초 1회
```powershell
npm install -g eas-cli      # EAS CLI 설치 (한 번만)
eas login                   # expo.dev 계정으로 로그인
```

### 빌드
```powershell
eas build -p android --profile preview
```
- 처음 실행하면 몇 가지 물어봐요 → **전부 기본값(Enter/Yes)** 으로 진행하면 됩니다.
  - "Generate a new Android Keystore?" → **Yes** (EAS가 서명키를 알아서 관리)
  - 프로젝트를 expo.dev에 연결할지 → **Yes**
- Expo 클라우드에서 빌드가 돌아갑니다(무료 큐라 몇 분~십몇 분 대기 가능).
- 끝나면 터미널과 [expo.dev](https://expo.dev) 대시보드에 **APK 다운로드 링크**가 나와요.

### 배포
- 그 **다운로드 링크를 안드로이드 멤버에게 공유** → 눌러서 APK 다운 → 설치.
- 설치 시 "출처를 알 수 없는 앱" 허용 한 번 눌러주면 됩니다.
- Supabase 연결값은 `eas.json`에 이미 넣어놔서 빌드된 APK가 바로 서버에 붙습니다.

> 앱을 수정하면 다시 `eas build -p android --profile preview` → 새 링크 공유.

---

## 2. 아이폰 웹 (무료, PWA)

### 웹 빌드
```powershell
npx expo export --platform web
```
→ `dist/` 폴더에 정적 웹사이트가 생성됩니다.

### 무료 호스팅 (가장 쉬운 방법: Netlify Drop)
1. 브라우저에서 **https://app.netlify.com/drop** 접속
2. 방금 생긴 **`dist` 폴더를 통째로 드래그&드롭**
3. 즉시 **URL**이 생깁니다 (예: `https://random-name.netlify.app`)
   - 계정 없이도 임시 URL이 나오고, 무료 가입하면 URL을 고정/이름변경 가능.

> 다른 무료 호스팅도 가능: Vercel, Cloudflare Pages, GitHub Pages 등. `dist` 폴더를 올리면 됩니다.

### 아이폰에서 앱처럼 쓰기
1. 멤버에게 그 **URL 공유**
2. 아이폰 **Safari**로 URL 열기
3. 하단 **공유 버튼(⬆️)** → **"홈 화면에 추가"**
4. 홈 화면 아이콘으로 앱처럼 실행 (전체화면)

> 안드로이드도 같은 URL을 크롬에서 열어 "홈 화면에 추가" 하면 됩니다(APK 대신 웹으로 쓰고 싶을 때).

### 웹 제한사항 (정직하게)
- **앱 내 알림 목록은 정상 작동**(DB 기반)합니다.
- 단, 폰 잠금화면에 뜨는 **네이티브 푸시 알림은 웹에선 제한**됩니다(아이폰 웹 정책). 알림은 앱을 열어 확인하는 방식.
- 앱을 수정하면 다시 `npx expo export --platform web` → `dist`를 다시 올리면 갱신.

---

## 참고
- `eas.json`의 Supabase anon key는 **공개돼도 안전한 값**입니다(RLS로 각 사용자 데이터만 접근 허용 + 앱 번들에 어차피 포함되는 값).
- 아이폰에 **진짜 앱(App Store/TestFlight)** 으로 올리려면 애플 개발자 계정(연 $99)이 필요합니다. 그때는 `eas build -p ios` + `eas submit` 로 진행합니다.
- 앱 아이콘을 넣고 싶으면 `assets/icon.png`(1024×1024) 추가 후 `app.json`에 `"icon": "./assets/icon.png"` 지정 → 재빌드.
