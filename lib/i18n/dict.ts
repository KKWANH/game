// i18n by Korean-string key: the app is Korean-first, so `ko` is the identity
// and `en` is a lookup. Wrap a UI string in t('한국어') and add its English here.
// A missing key falls back to the Korean text (visible + easy to spot).

export type Locale = 'ko' | 'en'

export const EN: Record<string, string> = {
  // --- Hub ---
  'GAME CENTER': 'GAME CENTER',
  '친구들과 함께 즐기는 실시간 미니게임. 게임을 골라 입장하세요.':
    'Real-time mini-games with friends. Pick a game and jump in.',
  '가상 칩으로 진행됩니다 · 실제 돈이 아닙니다': 'Played with virtual chips · not real money',
  '계정': 'Account',
  '로그아웃': 'Sign out',
  '친구끼리 실시간 블랙잭': 'Real-time blackjack with friends',
  '곧 출시': 'Coming soon',
  'COMING SOON': 'COMING SOON',
  '입장 →': 'Enter →',

  // --- Blackjack lobby ---
  '← 게임 선택': '← Games',
  '친구끼리 즐기는 실시간 블랙잭.': 'Real-time blackjack with friends.',
  '가상 칩으로 베팅하고, 모든 판이 장부에 기록되어 마지막에 자동 정산됩니다.':
    'Bet with virtual chips; every hand is logged and settled automatically at the end.',
  '구글 계정으로 시작하세요': 'Start with your Google account',
  'Google로 로그인': 'Sign in with Google',
  '환영합니다, ': 'Welcome, ',
  'game.kwanho.dev · 실제 돈이 아닌 가상 칩으로 진행됩니다':
    'game.kwanho.dev · played with virtual chips, not real money',

  // --- Create / join room ---
  '새 방 만들기': 'New room',
  '방 이름': 'Room name',
  '딜러': 'Dealer',
  'AI 딜러': 'AI dealer',
  '사람 딜러': 'Human dealer',
  '내 역할': 'My role',
  '플레이어': 'Player',
  '딜러(뱅크)': 'Dealer (bank)',
  '시작 칩': 'Starting chips',
  '최대 인원': 'Max seats',
  '고급 설정': 'Advanced',
  '최소 베팅': 'Min bet',
  '최대 베팅': 'Max bet',
  '덱 수': 'Decks',
  '턴 제한(초)': 'Turn timer (s)',
  '블랙잭 배당': 'Blackjack payout',
  '현실 머니 환율 (코인 단위)': 'Real-money rate (per coin)',
  '코인 =': 'coins =',
  '정산 때 이 환율로 실제 금액이 표시됩니다. 나중에 방에서 바꿀 수 있어요.':
    'Settlement shows real amounts at this rate. You can change it later in the room.',
  '방 만들기': 'Create room',
  '방 생성! 코드 ': 'Room created! Code ',
  '생성 실패': 'Failed to create',
  '코드로 입장': 'Join by code',
  '초대 코드': 'Invite code',
  '입장하기': 'Join',
  '입장 실패': 'Failed to join',

  // --- Room browser ---
  '열린 방': 'Open rooms',
  '↻ 새로고침': '↻ Refresh',
  '불러오는 중…': 'Loading…',
  '열린 방이 없습니다. 위에서 새 방을 만들어 보세요!': 'No open rooms. Create one above!',
  '대기중': 'Waiting',
  '게임중': 'In game',
  '입장': 'Join',
  '돌아가기': 'Return',
  '베팅': 'Bet',

  // --- Table: header / center / waiting ---
  '← 나가기': '← Leave',
  '실시간 연결됨': 'Connected',
  '연결 중...': 'Connecting…',
  '클릭해서 초대 코드 복사': 'Click to copy invite code',
  '초대 코드 복사됨: ': 'Invite code copied: ',
  '소리 켜기': 'Unmute',
  '소리 끄기': 'Mute',
  '뱅크 · ': 'Bank · ',
  '대기 중': 'Waiting',
  '호스트가 게임을 시작하면 베팅이 열립니다': 'Betting opens when the host starts the game',
  '베팅하세요!': 'Place your bet!',
  '베팅 중': 'Betting',
  '칩을 걸거나 패스하세요': 'Bet chips or pass',
  '모두 베팅을 기다리는 중…': 'Waiting for everyone to bet…',
  '카드 분배': 'Dealing',
  '딜링 중…': 'Dealing…',
  '당신의 차례!': 'Your turn!',
  '의 차례': "'s turn",
  '행동을 선택하세요': 'Choose an action',
  '기다리는 중…': 'Waiting…',
  '딜러 차례': 'Dealer turn',
  '딜러가 카드를 받는 중…': 'Dealer is drawing…',
  '라운드 종료': 'Round over',
  '결과 정산 완료': 'Settled',
  '획득 🎉': 'Won 🎉',
  '잃음': 'Lost',
  '무승부': 'Push',

  // --- Action bar / bet controls ---
  '히트': 'Hit',
  '스탠드': 'Stand',
  '더블': 'Double',
  '스플릿': 'Split',
  '서렌더': 'Surrender',
  '인슈어런스': 'Insurance',
  '행동 실패': 'Action failed',
  '상태가 변경됐어요. 다시 시도하세요.': 'State changed — try again.',
  '한도 ': 'Limit ',
  '보유': 'Balance',
  '초기화': 'Clear',
  '패스': 'Pass',
  '베팅 확정': 'Confirm bet',
  ' 베팅': ' bet',
  '이번 판 패스': 'Passed this round',
  '잠시 후 다시 시도해주세요.': 'Please try again shortly.',
  '베팅 실패': 'Bet failed',

  // --- Join / buy-in / host controls ---
  '여기 앉기': 'Sit here',
  '＋ 여기 앉기': '＋ Sit here',
  '빈 자리': 'Empty',
  '앉기': 'Sit',
  '＋ 충전': '＋ Add chips',
  '충전': 'Add chips',
  '보유 ': 'have ',
  '게임 시작': 'Start game',
  '쉬움': 'Easy',
  '보통': 'Normal',
  '어려움': 'Hard',
  'AI 난이도': 'AI difficulty',
  '🤖 AI 추가': '🤖 Add AI',
  'AI 내보내기': 'Remove AI',
  '⚙ 방 설정': '⚙ Settings',
  '호스트': 'Host',

  // --- Account ---
  '계정 설정': 'Account settings',
  '표시 이름': 'Display name',
  '게임에서 보일 이름': 'Name shown in game',
  '새로 앉는 자리부터 이 이름이 표시됩니다.': 'Shown on seats you take from now on.',
  '이름 저장': 'Save name',
  '이름을 저장했습니다.': 'Name saved.',
  '저장 실패': 'Save failed',
  '관리자': 'Admin',

  // --- Result badges ---
  WIN: 'WIN',
  LOSE: 'LOSE',
  PUSH: 'PUSH',
  'BLACKJACK!': 'BLACKJACK!',
  SURRENDER: 'SURRENDER',
  BUSTED: 'BUSTED',
  STAND: 'STAND',

  // --- Table chrome / waiting / join ---
  '실패': 'Failed',
  '✓ 베팅 완료': '✓ Bet placed',
  '대기 중…': 'Waiting…',
  '호스트가 게임을 시작하기를 기다리는 중': 'Waiting for the host to start',
  '다른 플레이어': 'Another player',
  ' 베팅 중 — 곧 차례가 와요': " is betting — you're up soon",
  '카드 분배 중…': 'Dealing…',
  '의 차례를 기다리는 중': "'s turn — waiting",
  '라운드 종료 — 다음 판 준비 중…': 'Round over — next hand soon…',
  '아직 관전 중이에요 — 참가해서 베팅하세요': "You're spectating — join in to bet",
  '착석 완료!': 'Seated!',
  '착석 실패': 'Failed to sit',
  '충전하고 앉기': 'buy in & sit',

  // --- Interim banner ---
  '💰 중간정산 완료': '💰 Interim settlement done',
  '나: ': 'Me: ',
  '에게 보낼 것': ' to pay',
  '에게 받을 것': ' to receive',

  // --- Settlement screen ---
  '최종 정산': 'Final settlement',
  '기준': 'basis',
  '바이인': 'Buy-in',
  '잔액': 'Balance',
  '코인': 'coins',
  '정산 송금': 'Transfers',
  '서로 정산할 차액이 없습니다.': 'No balances to settle.',

  // --- Admin ---
  '← 홈': '← Home',
  '빈 방 정리 완료': 'Empty rooms cleared',
  '빈 방 모두 닫기': 'Close all empty',
  '방': 'Room',
  '상태': 'Status',
  '인원': 'Players',
  '생성': 'Created',
  '관리': 'Manage',
  '방이 없습니다.': 'No rooms.',
  '방 닫음': 'Room closed',
  '방 삭제됨': 'Room deleted',
  '불러오기 실패': 'Failed to load',
  '삭제': 'Delete',

  // --- Host settlement panel ---
  '정산 / 재배분': 'Settle / rebalance',
  '내역 불러오기 실패': 'Failed to load history',
  '현실 머니 — 코인 환율': 'Real money — coin rate',
  '적용': 'Apply',
  '제안 송금': 'Suggested transfers',
  '칩 이체 (재배분)': 'Transfer chips (rebalance)',
  '보내는 사람': 'From',
  '받는 사람': 'To',
  '이체 완료': 'Transferred',
  '이체': 'Send',
  '전원 리밸런스': 'Rebalance everyone',
  '바이인 / 충전 내역': 'Buy-in / top-up history',
  '충전/조정': 'top-up/adj',
  '중간정산 기록 완료 — 모두에게 표시됩니다': 'Interim settlement recorded — shown to everyone',
  '💰 중간정산 확정 (방 유지)': '💰 Record interim (keep room)',
  '최종 정산 완료': 'Final settlement done',
  '최종 정산하고 방 종료': 'Finalize & close room',

  // --- Leave confirm ---
  '정말 나가시겠습니까?': 'Leave the room?',

  // --- Room settings panel ---
  '방 설정': 'Room settings',
  '닫기': 'Close',
  '⏸ 멈춤': '⏸ Paused',
  '▶ 진행 중': '▶ Running',
  '멈추면 다음 판이 시작되지 않아 설정을 바꿀 수 있어요.':
    'While paused, no new round starts so you can change settings.',
  '재개': 'Resume',
  '멈춤': 'Pause',
  '🎩 내가 딜러(뱅크)': "🎩 I'm the dealer (bank)",
  '🙂 플레이어': '🙂 Player',
  '딜러가 되면 뱅크 역할만 맡고 손패는 자동 진행돼요. (다음 판 적용)':
    'As dealer you only hold the bank; the hand auto-plays. (next round)',
  '플레이어로': 'To player',
  '딜러 되기': 'Become dealer',
  '설정 저장 — 다음 판부터 적용': 'Saved — applies next round',
  '설정 저장 (다음 판 적용)': 'Save settings (next round)',
  '현실 머니 환율': 'Real-money rate',
  '현재': 'Now',
  '환율 적용': 'Rate applied',
  '환율 저장': 'Save rate',
  '방을 멈췄습니다': 'Room paused',
  '게임을 재개합니다': 'Resuming',
  '다음 판부터 딜러(뱅크)가 됩니다': "You'll be the dealer (bank) next round",
  '다음 판부터 플레이어로 돌아갑니다': 'Back to player next round',

  // --- Language toggle ---
  '언어': 'Language',
  '한국어': '한국어',
  English: 'English',
}

export function tr(s: string, locale: Locale): string {
  if (locale === 'ko') return s
  return EN[s] ?? s
}
