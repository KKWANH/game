# 🃏 Blackjack — `game.kwanho.dev`

친구끼리 즐기는 실시간 멀티플레이어 블랙잭. 가상 칩으로 베팅하고, 모든 칩 이동이
장부에 기록되며, 방이 끝나면 **누가 누구에게 얼마**를 줄지 자동 정산합니다.

- **실시간 멀티플레이** — Supabase Realtime로 카드 분배·턴이 동기화됩니다.
- **치팅 방지** — 덱과 딜러 홀카드는 서버(`private` 스키마 + service-role)만 봅니다.
- **AI / 사람 딜러** — 사람 딜러도 카지노 고정룰(17까지 히트)을 서버가 자동 플레이하고, 정산에서 뱅크 역할만 합니다.
- **풀 룰** — 히트/스탠드/더블/스플릿/서렌더/인슈어런스, 3:2·6:5 배당, 덱 수·소프트17·턴 타이머·인원수 설정.
- **구글 로그인**, 화려하고 반응형인 UI.

## 스택
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · framer-motion ·
Supabase (Postgres + Realtime + Auth) · Vercel.

---

## 로컬 실행

### 1) 의존성
```bash
npm install
```

### 2) Supabase 프로젝트
1. [supabase.com](https://supabase.com)에서 무료 프로젝트 생성.
2. **SQL Editor**에서 `supabase/migrations/`의 파일을 순서대로 실행:
   `0001_schema.sql` → `0002_rpcs.sql` → `0003_chips.sql`.
   (또는 `supabase db push` / `supabase migration up`.)
3. **Database → Replication**(또는 Realtime)에서 `supabase_realtime` 퍼블리케이션에
   `0001_schema.sql`이 추가한 public 테이블이 포함됐는지 확인. `private` 스키마는 절대 추가하지 마세요.

### 3) 구글 OAuth
1. Google Cloud Console → **OAuth 동의 화면** 구성 → **사용자 인증 정보 → OAuth 클라이언트 ID**(웹) 생성.
2. **승인된 리디렉션 URI**에 추가: `https://<프로젝트>.supabase.co/auth/v1/callback`
3. Supabase 대시보드 → **Authentication → Providers → Google**에 클라이언트 ID/시크릿 입력.
4. **Authentication → URL Configuration**에서 Site URL을 로컬은 `http://localhost:3000`,
   배포는 `https://game.kwanho.dev`로 설정하고 둘 다 redirect 허용 목록에 추가.

### 4) 환경변수
`.env.example`을 `.env.local`로 복사하고 값을 채웁니다 (Supabase → Settings → API):
```bash
cp .env.example .env.local
```

### 5) 개발 서버
```bash
npm run dev      # http://localhost:3000
npm test         # 룰 엔진 단위 테스트 (64개)
npm run build    # 프로덕션 빌드
```

---

## 배포 (Vercel + `game.kwanho.dev`)
1. 이 폴더를 GitHub 레포(`KKWANH/game`)로 푸시.
2. Vercel에서 New Project → 레포 임포트.
3. **Environment Variables**에 `.env.local`의 값을 모두 추가
   (`NEXT_PUBLIC_SITE_URL`은 `https://game.kwanho.dev`, `CRON_SECRET`은 긴 랜덤 문자열).
4. **Settings → Domains**에 `game.kwanho.dev` 추가 → 안내되는 CNAME을 DNS에 등록.
5. (선택) 턴 타임아웃 안전망: Supabase에서 `pg_cron` + `pg_net` 확장을 켜고
   `supabase/migrations/0002_rpcs.sql` 하단 주석의 `cron.schedule(...)`로 15초마다
   `/api/cron/sweep`를 호출 (헤더 `x-cron-secret: <CRON_SECRET>`).
   클라이언트가 접속해 있으면 이것 없이도 타임아웃은 동작합니다.

---

## 구조
```
app/                 라우트 (로비 /, 방 /rooms/[code], auth 콜백, cron sweep)
actions/             서버 액션 (auth / room / game / settlement) — 권한 + service-role 오케스트레이션
lib/blackjack/       순수 룰 엔진 (덱·합계·룰·딜러·페이아웃) + vitest
lib/game/            서버 엔진 (deal/action/settle 패치 계산), 상태 로더, 원자 커밋, 셔플
lib/supabase/        server(SSR) / service(service-role) / browser 클라이언트 + DB 타입
lib/realtime/        Postgres Changes 구독 + 재조정, 턴 타이머
lib/settlement/      min-cash-flow 정산
components/          cards · chips · table · game · settlement · lobby · ui
store/               zustand 클라이언트 상태
supabase/migrations/ 스키마·RLS·GRANT·RPC
```

## 보안 모델 (핵심)
- 클라이언트는 게임 테이블에 **쓰지 못합니다.** RLS는 읽기만 멤버에게 허용하고,
  쓰기 정책이 없어 거부됩니다. 모든 변경은 service-role 서버 액션 → `commit_round_mutation`
  RPC(행 잠금 + 버전 체크)로 원자적으로 적용됩니다.
- 덱/홀카드는 `private.round_secrets`에 있고 `anon`/`authenticated` GRANT가 회수돼 있으며
  Realtime에 publish되지 않습니다. 공개 전 홀카드는 `hand_cards`에 아예 존재하지 않습니다.
