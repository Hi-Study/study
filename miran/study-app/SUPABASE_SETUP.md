# Supabase 설정 가이드 (비개발자용, 순서대로 따라 하기)

앱의 "서버·데이터베이스"를 만드는 단계입니다. **전부 무료 · 카드 등록 불필요.**
아래를 위에서부터 순서대로 하면 됩니다. 총 6단계, 약 10~15분.

---

## 0단계 — 준비물
- **GitHub 계정** (없으면 https://github.com 에서 무료 가입) — Supabase 로그인에 씁니다.

---

## 1단계 — Supabase 프로젝트 만들기
1. https://supabase.com 접속 → 오른쪽 위 **Start your project** 클릭.
2. **Continue with GitHub** 로 로그인.
3. **New project** 클릭.
4. 입력:
   - **Name**: `gihoek-study` (아무 이름이나 OK)
   - **Database Password**: 아무 강한 비밀번호 입력 → **어딘가에 메모**(안 써도 앱은 되지만 나중에 필요할 수 있음).
   - **Region**: `Northeast Asia (Seoul)` 선택 (한국이라 제일 빠름).
5. **Create new project** 클릭 → 1~2분 기다리면 준비 완료.

---

## 2단계 — 표(테이블) 만들기 : SQL 붙여넣기
1. 왼쪽 메뉴에서 **SQL Editor** (아이콘: `</>`) 클릭.
2. **+ New query** (또는 빈 편집창) 클릭.
3. 이 저장소의 **`supabase/setup_all.sql`** 파일을 열어 **전체 복사**.
   - (VS Code에서 파일 열고 `Ctrl+A` → `Ctrl+C`)
4. SQL Editor 빈칸에 **붙여넣기**(`Ctrl+V`) → 오른쪽 아래 **Run** (또는 `Ctrl+Enter`).
5. 아래쪽에 **Success. No rows returned** 비슷한 초록 메시지가 뜨면 성공. ✅
   - 빨간 에러가 나면 그 메시지를 저(클로드)에게 그대로 붙여주세요.

> 확인(선택): 왼쪽 **Table Editor** 에 `users, studies, study_members, shares,
> discussions, comments, likes, notifications` 8개 표가 보이면 잘 된 거예요.

---

## 3단계 — 익명 로그인 켜기 (중요!)
앱은 로그인 화면이 없어서 "익명 로그인"으로 사용자를 자동 생성합니다.
1. 왼쪽 메뉴 **Authentication** → **Sign In / Providers** (또는 **Providers**) 클릭.
2. 목록에서 **Anonymous** 를 찾아 **Enable(켜기)** → **Save**.
   - 이걸 안 켜면 앱에서 "연결 오류"가 납니다.

---

## 4단계 — 연결 키 2개 복사해서 .env 에 넣기
> ⚠️ URL과 키가 **서로 다른 페이지**에 있어요(최근 UI 변경).
1. **Project URL** 복사: Project Settings → **Data API** → Overview 의 **Project URL**
   (`https://xxxxx.supabase.co` 형태)
2. **anon 키** 복사: Project Settings → **API Keys** 페이지 →
   - **`anon` `public`** (`eyJ...`로 시작하는 긴 문자열) — 이게 가장 확실 ✅
   - 새 UI라 안 보이면 **`Publishable key`**(`sb_publishable_...`)를 써도 됩니다.
3. 이 저장소의 **`.env`** 파일을 열고 아래처럼 채웁니다(따옴표 없이 그대로):
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ....(긴 문자열 전체)
   ```
4. 저장(`Ctrl+S`).

> ⚠️ `anon public` 키만 쓰세요. `service_role` 키(비밀 키)는 앱에 절대 넣지 마세요.

---

## 5단계 — 이미지 업로드용 저장소 만들기 (선택, 나중에 해도 됨)
직접 작성 글에 사진을 첨부하려면 필요합니다. 지금 안 해도 앱은 켜져요.
1. 왼쪽 **Storage** → **New bucket**.
2. Name: `share-images`, **Public bucket** 체크 → **Create**.

---

## 6단계 — 다 됐으면 알려주세요
`.env` 까지 채웠으면 저에게 **"env 채웠어"** 라고 말해주세요.
제가 다음을 진행합니다:
- 앱을 실행해 **폰(Expo Go)** 에서 첫 화면 확인
- 스터디 생성·글 공유 등이 실제로 되는지 함께 점검
- 문제 있으면 수정 → 재확인

---

### 자주 나는 문제
- **"연결 오류" 화면**: `.env` 값이 비었거나 3단계(익명 로그인)를 안 켠 경우.
- **SQL 빨간 에러**: 이미 한 번 실행해서 표가 있는 경우일 수 있어요. 메시지를 저에게 보여주세요.
- **키를 어디서 복사하는지 모르겠음**: Project Settings > Data API 화면을 캡처해서 보여주셔도 됩니다.
