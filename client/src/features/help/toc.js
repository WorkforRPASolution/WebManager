/**
 * User Manual Table of Contents
 *
 * 단일 소스 오브 트루스: TOC 구조, 검색 인덱스, 섹션 컴포넌트 lazy import
 * - id: URL hash 식별자 (#getting-started)
 * - label: 표시 라벨
 * - component: 섹션 SFC lazy import
 * - searchText: 검색용 평문 (한국어 + 영어)
 * - keywords: 검색 가중치 키워드
 */

export const TOC = [
  {
    id: 'getting-started',
    label: '시작하기',
    icon: 'play',
    sections: [
      {
        id: 'getting-started',
        label: '매뉴얼 사용법 / 브라우저 요구사항',
        component: () => import('./components/sections/GettingStarted.vue'),
        searchText: '매뉴얼 사용법 검색 목차 네비게이션 브라우저 Chrome Edge 해상도 시작',
        keywords: ['매뉴얼', '시작', '브라우저', 'Chrome']
      }
    ]
  },
  {
    id: 'account',
    label: '계정 관리',
    icon: 'key',
    sections: [
      {
        id: 'account-management',
        label: '로그인 / 회원가입 / 비밀번호',
        component: () => import('./components/sections/AccountManagement.vue'),
        searchText: '로그인 회원가입 비밀번호 재설정 인증코드 EARS integrated standalone 임시비밀번호 위저드 signup login password',
        keywords: ['로그인', '회원가입', '비밀번호', '인증', 'login', 'signup']
      }
    ]
  },
  {
    id: 'layout',
    label: '화면 레이아웃',
    icon: 'grid_view',
    sections: [
      {
        id: 'layout-guide',
        label: '메가 메뉴 / 사이드바 / 탭 바',
        component: () => import('./components/sections/LayoutGuide.vue'),
        searchText: '메가메뉴 사이드바 탭바 헤더 테마 다크모드 라이트모드 레이아웃 필터바 토스트 페이지네이션',
        keywords: ['레이아웃', '메뉴', '사이드바', '탭', '테마', '다크모드']
      }
    ]
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'dashboard',
    sections: [
      {
        id: 'dashboard-overview',
        label: 'Overview',
        component: () => import('./components/sections/DashboardOverview.vue'),
        searchText: '대시보드 KPI 카드 활성 클라이언트 가동률 오류 overview summary',
        keywords: ['대시보드', 'KPI', 'overview']
      },
      {
        id: 'agent-monitor',
        label: 'Agent Status / Version',
        component: () => import('./components/sections/AgentMonitor.vue'),
        searchText: 'ARSAgent ResourceAgent 상태 버전 Running Stopped NeverStarted OK WARN SHUTDOWN 도넛 바차트 CSV 내보내기 필터 공정 모델 agent status version',
        keywords: ['ARSAgent', 'ResourceAgent', '상태', '버전', 'agent', 'status']
      },
      {
        id: 'recovery-dashboard',
        label: 'Recovery Dashboard',
        component: () => import('./components/sections/RecoveryDashboard.vue'),
        searchText: 'Recovery 복구 Overview 공정별 Analysis 시나리오 장비 트리거 KPI 트렌드 도넛 성공률 실패율 기간 배치 집계 신선도 Batch History 히트맵 Category 카테고리 Model 모델 by-category by-model by-process 단계별필터 캐스케이드 verify 교차검증 CSV 내보내기 recovery overview analysis',
        keywords: ['Recovery', '복구', '분석', '카테고리', '모델', 'recovery', 'analysis', 'category', 'model']
      },
      {
        id: 'user-activity',
        label: 'User Activity',
        component: () => import('./components/sections/UserActivity.vue'),
        searchText: 'User Activity 사용자 활동 Tool Usage SE 사용 Scenario WebManager 접속 통계 KPI 기간 공정별 Top10 CSV user activity tool usage',
        keywords: ['사용자', '활동', 'User Activity', 'Tool Usage']
      }
    ]
  },
  {
    id: 'clients',
    label: 'Clients',
    icon: 'devices',
    sections: [
      {
        id: 'client-management',
        label: '클라이언트 목록 / 서비스 제어',
        component: () => import('./components/sections/ClientManagement.vue'),
        searchText: '클라이언트 목록 필터 검색 서비스 제어 시작 중지 재시작 배치 액션 RPC client list filter service control start stop restart',
        keywords: ['클라이언트', '서비스', '제어', 'client', 'control']
      },
      {
        id: 'config-management',
        label: 'Config 관리 / 횡전개 / 비교',
        component: () => import('./components/sections/ConfigManagement.vue'),
        searchText: 'Config 설정 관리 편집 저장 횡전개 배포 Deploy Rollout 비교 Compare N-way Matrix Baseline diff 백업 복원 FTP ARSAgent Monitor AccessLog Trigger config deploy compare backup',
        keywords: ['Config', '설정', '횡전개', '배포', '비교', 'config', 'deploy']
      },
      {
        id: 'config-arsagent',
        label: 'Config: ARSAgent 폼',
        component: () => import('./components/sections/ConfigARSAgent.vue'),
        searchText: 'ARSAgent 에이전트 설정 ErrorTrigger AccessLogLists CronTab 크론탭 예약작업 VirtualAddressList AliveSignalInterval 서버연결 스냅샷 CPU메모리 마우스 라우터 선택항목',
        keywords: ['ARSAgent', 'CronTab', '에이전트', '설정', '폼']
      },
      {
        id: 'config-accesslog',
        label: 'Config: AccessLog 폼 / 테스트',
        component: () => import('./components/sections/ConfigAccessLog.vue'),
        searchText: 'AccessLog 로그수집 소스 파일패턴 prefix suffix wildcard log_type 3축 날짜 멀티라인 추출삽입 경로매칭 시간필터 라인그룹 테스트 trigger upload',
        keywords: ['AccessLog', '로그', '소스', '테스트', '패턴']
      },
      {
        id: 'config-trigger',
        label: 'Config: Trigger 폼 / 테스트',
        component: () => import('./components/sections/ConfigTrigger.vue'),
        searchText: 'Trigger 트리거 레시피 스텝 정규식 regex 패턴매칭 변수추출 params 조건 duration times limitation recovery script notify popup suspend resume 테스트 시뮬레이션 MULTI',
        keywords: ['Trigger', '트리거', '패턴', '레시피', '테스트']
      },
      {
        id: 'config-monitor',
        label: 'Config: Monitor 폼',
        component: () => import('./components/sections/ConfigMonitor.vue'),
        searchText: 'Monitor 모니터 Collector CPU Memory Disk Network Temperature Fan GPU Voltage MotherboardTemp StorageSmart CPUProcess MemoryProcess ProcessWatch Uptime ResourceAgent 수집주기',
        keywords: ['Monitor', 'Collector', 'ResourceAgent', '모니터']
      },
      {
        id: 'log-viewer',
        label: 'Log Viewer / Tailing',
        component: () => import('./components/sections/LogViewer.vue'),
        searchText: '로그 뷰어 파일 조회 실시간 Tailing 자동스크롤 다운로드 삭제 크로스검색 FTP log viewer tail download',
        keywords: ['로그', 'Log', 'Tailing', '뷰어']
      },
      {
        id: 'software-update',
        label: 'Software Update',
        component: () => import('./components/sections/SoftwareUpdate.vue'),
        searchText: '소프트웨어 업데이트 배포 프로필 OS별 버전별 SSE 진행률 FTP MinIO Local exec 명령 Copy Paste 복사 붙여넣기 클립보드 clipboard 프로필복사 태스크복사 software update deploy profile',
        keywords: ['업데이트', 'Software', 'Update', '배포', '복사', 'Copy', 'Paste']
      }
    ]
  },
  {
    id: 'masterdata',
    label: '기준정보 관리',
    icon: 'database',
    sections: [
      {
        id: 'reference-data',
        label: 'Equipment / Template / Email / User',
        component: () => import('./components/sections/ReferenceData.vue'),
        searchText: 'Equipment Info 장비 기준정보 AGENT_INFO 동기화 Email Template Popup Template Email Image Email Recipients Email Info Group User Management 사용자 관리 역할 권한 Authority SE Auth EARS 검색 계정상태 비밀번호 AG Grid 편집 Monaco Editor',
        keywords: ['기준정보', 'Equipment', 'Template', 'Email', '사용자', 'EARS', 'Authority']
      }
    ]
  },
  {
    id: 'system',
    label: 'System',
    icon: 'settings',
    sections: [
      {
        id: 'system-admin',
        label: 'Settings / Permissions / System Logs',
        component: () => import('./components/sections/SystemAdmin.vue'),
        searchText: 'Settings Permissions System Logs 설정 권한 시스템 로그 Role Menu Feature 매트릭스 Admin Conductor Manager User audit auth error batch access 카테고리 통계 MultiSelect 다중선택',
        keywords: ['Settings', 'Permissions', '권한', 'System Logs', '로그', 'MultiSelect']
      }
    ]
  },
  {
    id: 'reference',
    label: '참고',
    icon: 'bookmark',
    sections: [
      {
        id: 'role-summary',
        label: '역할별 기능 요약',
        component: () => import('./components/sections/RolePermissions.vue'),
        searchText: '역할 권한 기능 요약 Admin Conductor Manager User 접근 가능 메뉴 매트릭스 role permission summary',
        keywords: ['역할', '권한', '요약', 'role', 'permission']
      },
      {
        id: 'faq',
        label: '자주 묻는 질문 (FAQ)',
        component: () => import('./components/sections/FAQ.vue'),
        searchText: 'FAQ 자주 묻는 질문 비밀번호 비밀번호없이 메뉴 안보임 Config 적용 로그 조회 권한 차단 Uncategorized Group 필수 문제 해결 troubleshooting',
        keywords: ['FAQ', '질문', '문제', '해결', 'Uncategorized']
      }
    ]
  }
]

/**
 * 플랫 배열 — 검색/네비게이션용
 */
export const SECTION_INDEX = TOC.flatMap(chapter =>
  chapter.sections.map(section => ({
    ...section,
    chapterId: chapter.id,
    chapterLabel: chapter.label
  }))
)

/**
 * 섹션 ID로 검색
 */
export function findSection(sectionId) {
  return SECTION_INDEX.find(s => s.id === sectionId)
}

/**
 * 이전/다음 섹션
 */
export function getAdjacentSections(sectionId) {
  const index = SECTION_INDEX.findIndex(s => s.id === sectionId)
  return {
    prev: index > 0 ? SECTION_INDEX[index - 1] : null,
    next: index < SECTION_INDEX.length - 1 ? SECTION_INDEX[index + 1] : null
  }
}
