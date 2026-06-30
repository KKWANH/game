# 어디를 고치면 되나 (Code map)

빠르게 "이걸 바꾸려면 어느 파일?"을 찾는 지도입니다.

## 화면 / UI
| 바꾸고 싶은 것 | 파일 |
|---|---|
| 색·테마·골드/펠트 색감, 애니메이션 유틸 | [app/globals.css](app/globals.css) |
| 로비(타이틀/로그인/방 만들기·입장 폼) | [app/page.tsx](app/page.tsx), [components/lobby/](components/lobby/) |
| 방 만들기 옵션(딜러·배당·덱·인원·타이머·시작칩) | [components/lobby/CreateRoomForm.tsx](components/lobby/CreateRoomForm.tsx) |
| 테이블 전체 레이아웃(헤더·딜러·중앙·좌석·하단독) | [app/rooms/[code]/table-client.tsx](app/rooms/%5Bcode%5D/table-client.tsx) |
| 가운데 단계/턴/타이머 링 | [components/game/CenterStage.tsx](components/game/CenterStage.tsx) |
| 좌석 칸(플레이어/빈자리/앉기) | [components/table/SeatPod.tsx](components/table/SeatPod.tsx) |
| 딜러 영역 | [components/table/DealerArea.tsx](components/table/DealerArea.tsx) |
| 카드 모양·딜 애니메이션 | [components/cards/PlayingCard.tsx](components/cards/PlayingCard.tsx) |
| 손패 표시(합계·결과 뱃지·승리 글로우) | [components/cards/Hand.tsx](components/cards/Hand.tsx) |
| 베팅 컨트롤(칩 버튼/확정) | [components/game/BetControls.tsx](components/game/BetControls.tsx) |
| 액션 버튼(히트/스탠드/더블/스플릿/서렌더/인슈어런스) | [components/game/ActionBar.tsx](components/game/ActionBar.tsx) |
| 정산/재배분 모달 | [components/game/HostSettlementPanel.tsx](components/game/HostSettlementPanel.tsx) |
| 최종 정산 화면 | [components/settlement/SettlementScreen.tsx](components/settlement/SettlementScreen.tsx) |
| 배경 떠다니는 무늬 / 승리 버스트 | [components/effects/](components/effects/) |
| 버튼/인풋 공통 스타일 | [components/ui/](components/ui/) |

## 게임 규칙 / 서버 로직
| 바꾸고 싶은 것 | 파일 |
|---|---|
| 블랙잭 규칙(합계·딜러 자동·페이아웃·합법수) — 순수 로직 | [lib/blackjack/](lib/blackjack/) (+ `__tests__`) |
| 딜/플레이어 액션/딜러 정산의 서버 패치 계산 | [lib/game/engine.ts](lib/game/engine.ts) |
| 방·좌석·바이인 액션 | [actions/room-actions.ts](actions/room-actions.ts) |
| 라운드 시작/베팅/딜/플레이어 액션/타임아웃 | [actions/game-actions.ts](actions/game-actions.ts) |
| 중간정산·칩 이체·리밸런스·최종정산 | [actions/settlement-actions.ts](actions/settlement-actions.ts) |
| 정산 알고리즘(누가 누구에게) | [lib/settlement/min-cash-flow.ts](lib/settlement/min-cash-flow.ts) |
| 원자적 DB 커밋(버전·락) / 안전 셔플 | [lib/game/commit.ts](lib/game/commit.ts) |
| 라운드 상태 로딩(비밀 덱 포함) | [lib/game/load.ts](lib/game/load.ts) |

## DB (Supabase)
| 바꾸고 싶은 것 | 파일 |
|---|---|
| 테이블·RLS·GRANT | [supabase/migrations/0001_schema.sql](supabase/migrations/0001_schema.sql) |
| 권한 RPC(commit_round_mutation 등) | [supabase/migrations/0002_rpcs.sql](supabase/migrations/0002_rpcs.sql) |
| 칩 이동 RPC | 0003 / 0005 |
| 비밀 덱 접근 RPC | [supabase/migrations/0004_secret_access.sql](supabase/migrations/0004_secret_access.sql) |
| DB 타입(클라 타입세이프) | [lib/supabase/types.ts](lib/supabase/types.ts) |

## 실시간 / 인증
| 바꾸고 싶은 것 | 파일 |
|---|---|
| 실시간 구독·재조정(Postgres Changes + 폴링) | [lib/realtime/use-room-realtime.ts](lib/realtime/use-room-realtime.ts) |
| 방 상태 가져오기(정제된 읽기) | [lib/realtime/fetch-room.ts](lib/realtime/fetch-room.ts) |
| 턴 타이머/타임아웃 발사 | [lib/realtime/use-turn-timer.ts](lib/realtime/use-turn-timer.ts) |
| 클라 상태 저장소(zustand) | [store/room-store.ts](store/room-store.ts) |
| 구글 로그인/로그아웃 | [actions/auth-actions.ts](actions/auth-actions.ts), [app/auth/callback/route.ts](app/auth/callback/route.ts) |
| Supabase 클라이언트(서버/서비스/브라우저) | [lib/supabase/](lib/supabase/) |
| 세션 갱신 미들웨어 | [proxy.ts](proxy.ts) |

## 자주 만지는 값
- **기본 규칙 값**(덱·소프트17·배당 등 기본): [lib/blackjack/types.ts](lib/blackjack/types.ts) `DEFAULT_RULES` + 방 생성 폼 기본값.
- **턴 제한시간**: 방 설정 `turn_timer_seconds` (CenterStage 타이머 링이 이 값을 따라감).
- **시작 칩/충전 단위**: CreateRoomForm, table-client의 `buyIn(…, 1000)`.

흐름·보안 구조는 [README.md](README.md), 테스트는 `npm test` + [scripts/qa/](scripts/qa/).
