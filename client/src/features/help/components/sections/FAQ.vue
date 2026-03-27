<script setup>
import { ref } from 'vue'
import HelpImage from '../HelpImage.vue'

const openItems = ref({})
function toggle(id) {
  openItems.value[id] = !openItems.value[id]
}
</script>

<template>
  <div class="help-prose">
    <h2>자주 묻는 질문 (FAQ)</h2>
    <p>WebManager 사용 중 자주 발생하는 질문과 해결 방법을 정리했습니다. 카테고리별로 분류되어 있으며, 질문을 클릭하면 답변이 표시됩니다.</p>

    <!-- ───────────────────────────────── -->
    <!-- 1. 로그인 / 계정 -->
    <!-- ───────────────────────────────── -->
    <h3>1. 로그인 / 계정</h3>

    <!-- Q1-1 -->
    <div class="faq-item" @click="toggle('q1-1')">
      <div class="faq-question">
        <svg class="faq-arrow" :class="{ 'faq-arrow-open': openItems['q1-1'] }" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        <span>비밀번호를 설정한 적이 없는데 로그인이 안 됩니다.</span>
      </div>
    </div>
    <div v-show="openItems['q1-1']" class="faq-answer">
      <p>회원가입 후 Admin이 계정을 승인하는 과정에서 임시 비밀번호가 이메일로 발송됩니다. 이메일을 확인해 보세요. 만약 이메일을 받지 못했거나 분실한 경우, 로그인 화면에서 <strong>"비밀번호 재설정"</strong>을 클릭하세요.</p>
      <p>Integrated 모드(EARS 연동)에서는 EARS에 등록된 이메일로 인증 코드가 발송됩니다. Standalone 모드에서는 Admin에게 직접 비밀번호 재설정을 요청해야 합니다.</p>
    </div>

    <!-- Q1-2 -->
    <div class="faq-item" @click="toggle('q1-2')">
      <div class="faq-question">
        <svg class="faq-arrow" :class="{ 'faq-arrow-open': openItems['q1-2'] }" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        <span>인증 코드를 입력했는데 만료되었다고 합니다.</span>
      </div>
    </div>
    <div v-show="openItems['q1-2']" class="faq-answer">
      <p>인증 코드는 발송 후 <strong>5분간</strong>만 유효합니다. 5분이 지나면 자동으로 만료되며, 재발송 쿨다운(60초) 이후 새 코드를 요청할 수 있습니다.</p>
      <p>또한 인증 코드를 <strong>5회 이상 틀리면</strong> 해당 코드가 즉시 무효화됩니다. 이 경우에도 새 코드를 재발송 받아야 합니다.</p>
      <div class="callout-info">
        <div class="callout-title">팁</div>
        <p>인증 코드 이메일이 스팸함에 들어가는 경우가 있습니다. 받은 편지함에 없다면 스팸함을 확인해 보세요.</p>
      </div>
    </div>

    <!-- Q1-3 -->
    <div class="faq-item" @click="toggle('q1-3')">
      <div class="faq-question">
        <svg class="faq-arrow" :class="{ 'faq-arrow-open': openItems['q1-3'] }" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        <span>로그인 후 빈 화면이 나오거나 다른 페이지로 이동이 안 됩니다.</span>
      </div>
    </div>
    <div v-show="openItems['q1-3']" class="faq-answer">
      <p>사용자에게 할당된 역할(Role)의 Menu Permissions에서 해당 메뉴가 비활성화되어 있을 수 있습니다. Admin에게 문의하여 권한 설정을 확인해 주세요.</p>
      <p>특히 Dashboard Overview가 비활성화된 경우 로그인 직후 기본 페이지를 표시할 수 없어 빈 화면처럼 보일 수 있습니다. 이 경우 URL을 직접 입력하여 권한이 있는 다른 페이지로 이동해 보세요.</p>
    </div>

    <!-- Q1-4 -->
    <div class="faq-item" @click="toggle('q1-4')">
      <div class="faq-question">
        <svg class="faq-arrow" :class="{ 'faq-arrow-open': openItems['q1-4'] }" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        <span>회원가입을 완료했는데 로그인할 수 없습니다.</span>
      </div>
    </div>
    <div v-show="openItems['q1-4']" class="faq-answer">
      <p>회원가입 후 관리자(Admin)가 계정을 <strong>승인</strong>해야 로그인이 가능합니다. 계정이 승인 대기 상태인 동안에는 로그인할 수 없습니다.</p>
      <p>Admin이 승인 시 임시 비밀번호가 이메일로 발송됩니다. 승인 완료 후에도 로그인이 안 된다면, 비밀번호 재설정을 시도하거나 Admin에게 계정 상태를 확인 요청하세요.</p>
    </div>

    <!-- ───────────────────────────────── -->
    <!-- 2. Dashboard -->
    <!-- ───────────────────────────────── -->
    <h3>2. Dashboard</h3>

    <!-- Q2-1 -->
    <div class="faq-item" @click="toggle('q2-1')">
      <div class="faq-question">
        <svg class="faq-arrow" :class="{ 'faq-arrow-open': openItems['q2-1'] }" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        <span>Recovery Dashboard가 실시간 데이터가 아닌 이유는 무엇인가요?</span>
      </div>
    </div>
    <div v-show="openItems['q2-1']" class="faq-answer">
      <p>Recovery Dashboard는 대량의 이력 데이터를 집계하여 표시하므로, <strong>배치 집계(Cron)</strong> 방식을 사용합니다. 시간별 집계는 매시 5분(:05)에, 일별 집계는 매일 새벽(KST 기준)에 실행됩니다.</p>
      <p>따라서 Dashboard에 표시되는 데이터는 마지막 배치 실행 시점까지의 누적 결과입니다. "마지막 업데이트" 시각이 페이지 상단에 표시되며, 이 시각을 기준으로 데이터가 얼마나 최신인지 판단할 수 있습니다.</p>
    </div>

    <!-- Q2-2 -->
    <div class="faq-item" @click="toggle('q2-2')">
      <div class="faq-question">
        <svg class="faq-arrow" :class="{ 'faq-arrow-open': openItems['q2-2'] }" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        <span>"데이터 신선도 경고"가 표시됩니다. 문제가 있는 건가요?</span>
      </div>
    </div>
    <div v-show="openItems['q2-2']" class="faq-answer">
      <p>마지막 배치 집계로부터 <strong>2시간 이상</strong> 경과하면 데이터 신선도 경고가 표시됩니다. 이는 배치 작업이 지연되거나 실패했을 가능성을 나타냅니다.</p>
      <p>일시적인 서버 부하로 배치가 지연된 경우 다음 스케줄에서 자동으로 복구됩니다. 경고가 지속된다면 관리자(Admin)에게 '배치 집계 상태를 확인해 주세요'라고 요청하세요.</p>
    </div>

    <!-- Q2-3 -->
    <div class="faq-item" @click="toggle('q2-3')">
      <div class="faq-question">
        <svg class="faq-arrow" :class="{ 'faq-arrow-open': openItems['q2-3'] }" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        <span>Agent 상태에서 NeverStarted와 Stopped의 차이는 무엇인가요?</span>
      </div>
    </div>
    <div v-show="openItems['q2-3']" class="faq-answer">
      <p>두 상태는 모두 현재 실행 중이 아니지만, 원인이 다릅니다:</p>
      <ul>
        <li><strong>Stopped</strong> - 과거에 한 번이라도 실행된 적이 있으나 현재 중지된 상태입니다. 시스템에 실행 이력이 남아 있습니다.</li>
        <li><strong>NeverStarted</strong> - 장비 정보에 등록되어 있으나 한 번도 실행된 적이 없는 상태입니다. 시스템에 해당 장비의 실행 이력이 전혀 없습니다.</li>
      </ul>
      <p>NeverStarted 장비가 많다면 신규 등록 후 아직 Agent가 배포/실행되지 않은 장비이거나, 장비 정보가 잘못 등록된 것일 수 있습니다.</p>
    </div>

    <!-- Q2-4 -->
    <div class="faq-item" @click="toggle('q2-4')">
      <div class="faq-question">
        <svg class="faq-arrow" :class="{ 'faq-arrow-open': openItems['q2-4'] }" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        <span>Recovery Analysis에서 이력 조회가 최대 7일로 제한되는 이유는?</span>
      </div>
    </div>
    <div v-show="openItems['q2-4']" class="faq-answer">
      <p>이력 조회 모달은 집계된 Summary가 아닌 <strong>원본 데이터(EQP_AUTO_RECOVERY)</strong>를 직접 조회합니다. 원본 데이터는 건수가 매우 많을 수 있으므로, 성능을 보장하기 위해 최대 7일로 제한됩니다.</p>
      <p>더 넓은 기간의 추이를 보려면 Recovery Overview나 Recovery by Process 페이지의 기간 설정(최대 2년)을 활용하세요. 이 페이지들은 사전 집계된 Summary 데이터를 사용하므로 장기간 조회가 가능합니다.</p>
    </div>

    <!-- ───────────────────────────────── -->
    <!-- 3. Config 관리 -->
    <!-- ───────────────────────────────── -->
    <h3>3. Config 관리</h3>

    <!-- Q3-1 -->
    <div class="faq-item" @click="toggle('q3-1')">
      <div class="faq-question">
        <svg class="faq-arrow" :class="{ 'faq-arrow-open': openItems['q3-1'] }" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        <span>Config를 저장하면 즉시 반영되나요?</span>
      </div>
    </div>
    <div v-show="openItems['q3-1']" class="faq-answer">
      <p>Config 파일을 저장하면 원격으로 대상 장비의 파일이 즉시 업데이트됩니다. 그러나 <strong>실행 중인 Agent는 Config 변경을 자동으로 감지하지 않습니다.</strong></p>
      <p>변경된 Config를 적용하려면 해당 Agent를 <strong>재시작</strong>해야 합니다. Client Detail 페이지에서 서비스 재시작을 수행하세요.</p>
      <div class="callout-warning">
        <div class="callout-title">주의</div>
        <p>Config를 잘못 수정하면 Agent가 정상적으로 시작되지 않을 수 있습니다. 저장 전에 반드시 내용을 검토하고, 필요 시 백업에서 복원할 수 있음을 확인하세요.</p>
      </div>
    </div>

    <!-- Q3-2 -->
    <div class="faq-item" @click="toggle('q3-2')">
      <div class="faq-question">
        <svg class="faq-arrow" :class="{ 'faq-arrow-open': openItems['q3-2'] }" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        <span>횡전개(Deploy)에서 일부 장비만 실패했습니다.</span>
      </div>
    </div>
    <div v-show="openItems['q3-2']" class="faq-answer">
      <p>횡전개는 실시간 스트리밍을 통해 진행률을 표시하며, 개별 장비의 성공/실패 결과를 알려줍니다. 일부 장비만 실패하는 주요 원인:</p>
      <ul>
        <li><strong>원격 파일 서버 연결 불가</strong> - 해당 장비의 파일 서버가 중지되었거나 네트워크 문제</li>
        <li><strong>파일 경로 오류</strong> - 에이전트 설치 경로가 잘못 설정된 경우</li>
        <li><strong>권한 부족</strong> - 파일 서버 계정에 쓰기 권한이 없는 경우</li>
      </ul>
      <p>실패한 장비만 선택하여 재배포하거나, 해당 장비의 파일 서버 연결 상태를 확인 후 재시도하세요. 성공한 장비에는 이미 Config가 반영되어 있으므로 다시 배포할 필요 없습니다.</p>
    </div>

    <!-- Q3-3 -->
    <div class="faq-item" @click="toggle('q3-3')">
      <div class="faq-question">
        <svg class="faq-arrow" :class="{ 'faq-arrow-open': openItems['q3-3'] }" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        <span>이전 버전의 Config로 복원할 수 있나요?</span>
      </div>
    </div>
    <div v-show="openItems['q3-3']" class="faq-answer">
      <p>네, 가능합니다. Config를 저장하거나 횡전개할 때마다 <strong>자동으로 백업</strong>이 생성됩니다. Client Detail 페이지의 Config 탭에서 백업 목록을 조회하고, 원하는 버전을 선택하여 복원할 수 있습니다.</p>
      <p>백업 파일명에는 생성 시각이 포함되어 있어 언제 시점의 Config인지 확인할 수 있습니다.</p>
    </div>

    <!-- Q3-4 -->
    <div class="faq-item" @click="toggle('q3-4')">
      <div class="faq-question">
        <svg class="faq-arrow" :class="{ 'faq-arrow-open': openItems['q3-4'] }" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        <span>Config를 수정하지 않고 바로 횡전개(Deploy)하면 어떻게 되나요?</span>
      </div>
    </div>
    <div v-show="openItems['q3-4']" class="faq-answer">
      <p>횡전개는 현재 선택한 소스 장비의 Config 파일을 대상 장비들에 복사하는 기능입니다. 별도로 수정하지 않아도, 소스 장비에 저장된 현재 Config 내용이 그대로 대상 장비들에 배포됩니다.</p>
      <p>이는 특정 장비의 "표준 Config"를 다른 장비들에 일괄 적용할 때 유용합니다. 단, 배포 전에 <strong>Config Compare</strong> 기능으로 소스와 대상 장비의 Config 차이를 확인하는 것을 권장합니다.</p>
    </div>

    <!-- ───────────────────────────────── -->
    <!-- 4. Log Viewer -->
    <!-- ───────────────────────────────── -->
    <h3>4. Log Viewer</h3>

    <!-- Q4-1 -->
    <div class="faq-item" @click="toggle('q4-1')">
      <div class="faq-question">
        <svg class="faq-arrow" :class="{ 'faq-arrow-open': openItems['q4-1'] }" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        <span>Tailing을 시작했는데 로그가 올라오지 않습니다.</span>
      </div>
    </div>
    <div v-show="openItems['q4-1']" class="faq-answer">
      <p>실시간 Tailing은 Agent가 실행 중이고 해당 로그 파일에 새로운 내용이 기록될 때만 표시됩니다. 로그가 올라오지 않는 주요 원인:</p>
      <ul>
        <li><strong>Agent가 중지 상태</strong> - Agent가 실행 중인지 확인하세요</li>
        <li><strong>로그 발생이 없음</strong> - 해당 시점에 로그를 생성하는 이벤트가 없을 수 있습니다. 잠시 기다리세요.</li>
        <li><strong>잘못된 로그 파일 선택</strong> - 현재 활성 로그 파일인지 확인하세요. 날짜가 지난 로그 파일은 더 이상 기록되지 않습니다.</li>
        <li><strong>서버 연결 문제</strong> - 관리 서버 에이전트와의 연결이 끊어진 경우. 페이지를 새로고침하고 다시 시도하세요.</li>
      </ul>
    </div>

    <!-- Q4-2 -->
    <div class="faq-item" @click="toggle('q4-2')">
      <div class="faq-question">
        <svg class="faq-arrow" :class="{ 'faq-arrow-open': openItems['q4-2'] }" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        <span>로그에 "[Previous lines omitted]" 메시지가 표시됩니다.</span>
      </div>
    </div>
    <div v-show="openItems['q4-2']" class="faq-answer">
      <p>이 메시지는 로그 파일의 마지막 부분부터 Tailing을 시작했음을 나타냅니다. Tailing은 파일의 현재 끝 위치(offset)부터 새로 추가되는 내용만 표시하므로, 이전에 기록된 로그는 생략됩니다.</p>
      <p>이전 로그를 확인하려면 Tailing을 중지하고, 파일 목록에서 해당 파일을 선택하여 <strong>전체 내용 조회</strong>를 사용하세요.</p>
    </div>

    <!-- Q4-3 -->
    <div class="faq-item" @click="toggle('q4-3')">
      <div class="faq-question">
        <svg class="faq-arrow" :class="{ 'faq-arrow-open': openItems['q4-3'] }" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        <span>로그 파일 목록이 표시되지 않습니다.</span>
      </div>
    </div>
    <div v-show="openItems['q4-3']" class="faq-answer">
      <p>로그 파일 목록은 원격 파일 접근을 통해 장비에서 조회합니다. 목록이 표시되지 않는 원인:</p>
      <ul>
        <li><strong>에이전트 설치 경로 미설정</strong> - 해당 클라이언트의 에이전트 설치 경로가 설정되지 않았거나 잘못된 경우. Client Detail에서 설치 경로를 확인하세요.</li>
        <li><strong>Log Settings 미구성</strong> - 해당 Agent 그룹의 로그 소스 설정이 구성되지 않은 경우. 관리자(Admin)에게 Log Settings 확인을 요청하세요.</li>
        <li><strong>원격 파일 서버 연결 실패</strong> - 장비의 파일 서버 상태 또는 네트워크 연결을 확인하세요.</li>
        <li><strong>로그 디렉토리 부재</strong> - 설정된 경로에 실제 로그 디렉토리가 존재하지 않는 경우</li>
      </ul>
    </div>

    <!-- ───────────────────────────────── -->
    <!-- 5. 권한 / Admin -->
    <!-- ───────────────────────────────── -->
    <h3>5. 권한 / Admin</h3>

    <!-- Q5-1 -->
    <div class="faq-item" @click="toggle('q5-1')">
      <div class="faq-question">
        <svg class="faq-arrow" :class="{ 'faq-arrow-open': openItems['q5-1'] }" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        <span>실수로 모든 역할의 메뉴 권한을 차단했습니다. 어떻게 복구하나요?</span>
      </div>
    </div>
    <div v-show="openItems['q5-1']" class="faq-answer">
      <p><strong>Admin 역할은 항상 모든 권한이 유지됩니다.</strong> Admin 열의 토글은 비활성 상태이며 OFF할 수 없으므로, Admin 계정이 차단되는 일은 발생하지 않습니다.</p>
      <p>복구 절차:</p>
      <ol>
        <li>Admin 계정으로 로그인합니다</li>
        <li>System > Permissions 페이지로 이동합니다</li>
        <li>잘못 차단된 항목을 찾아 토글을 다시 ON합니다</li>
        <li><strong>Save Changes</strong>를 클릭하여 저장합니다</li>
      </ol>
      <p>변경 즉시 다른 사용자들의 접근이 복구됩니다. 새로고침 또는 재로그인 없이 즉시 반영됩니다.</p>
    </div>

    <!-- Q5-2 -->
    <div class="faq-item" @click="toggle('q5-2')">
      <div class="faq-question">
        <svg class="faq-arrow" :class="{ 'faq-arrow-open': openItems['q5-2'] }" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        <span>Feature Permissions 탭이 보이지 않습니다.</span>
      </div>
    </div>
    <div v-show="openItems['q5-2']" class="faq-answer">
      <p>Feature Permissions 탭은 Permissions 페이지 내의 두 번째 탭입니다. Permissions 페이지 자체가 <strong>Admin 전용</strong>이므로, Admin 역할이 아닌 사용자에게는 System 메뉴에 Permissions 항목 자체가 표시되지 않습니다.</p>
      <p>Admin 계정으로 로그인하면 System > Permissions에서 상단의 <strong>"Feature Permissions"</strong> 탭을 클릭하여 접근할 수 있습니다.</p>
    </div>

    <!-- Q5-3 -->
    <div class="faq-item" @click="toggle('q5-3')">
      <div class="faq-question">
        <svg class="faq-arrow" :class="{ 'faq-arrow-open': openItems['q5-3'] }" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        <span>"Unauthorized" 화면이 나옵니다.</span>
      </div>
    </div>
    <div v-show="openItems['q5-3']" class="faq-answer">
      <p>현재 로그인한 계정의 역할(Role)에 해당 페이지 접근 권한이 없을 때 표시됩니다. 이는 정상적인 권한 제어 동작입니다.</p>
      <p>해결 방법:</p>
      <ul>
        <li><strong>URL 직접 입력한 경우</strong> - 사이드바 메뉴에서 접근 가능한 페이지로 이동하세요</li>
        <li><strong>이전에 접근 가능했던 페이지인 경우</strong> - Admin이 권한 설정을 변경했을 수 있습니다. Admin에게 문의하세요.</li>
        <li><strong>북마크를 통해 접근한 경우</strong> - 권한 변경 이후 북마크가 유효하지 않을 수 있습니다</li>
      </ul>
    </div>

    <!-- Q5-4 -->
    <div class="faq-item" @click="toggle('q5-4')">
      <div class="faq-question">
        <svg class="faq-arrow" :class="{ 'faq-arrow-open': openItems['q5-4'] }" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        <span>System Logs 메뉴가 보이지 않습니다.</span>
      </div>
    </div>
    <div v-show="openItems['q5-4']" class="faq-answer">
      <p>System Logs는 <strong>Admin 전용</strong> 메뉴입니다. Admin 역할이 아닌 사용자(Conductor, Manager, User)에게는 사이드바에 표시되지 않으며, URL을 직접 입력해도 접근할 수 없습니다.</p>
      <p>시스템 로그 확인이 필요한 경우 Admin에게 요청하세요. Admin은 System Logs에서 관련 로그를 필터링하여 필요한 정보를 공유할 수 있습니다.</p>
    </div>
  </div>
</template>

<style scoped>
.faq-item {
  @apply cursor-pointer select-none border border-gray-200 dark:border-dark-border rounded-lg px-4 py-3 mb-2 transition-colors;
  @apply hover:bg-gray-50 dark:hover:bg-dark-border/50;
}

.faq-question {
  @apply flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200;
}

.faq-arrow {
  @apply w-4 h-4 flex-shrink-0 text-gray-400 dark:text-gray-500 transition-transform duration-200;
}

.faq-arrow-open {
  @apply rotate-90;
}

.faq-answer {
  @apply pl-10 pr-4 pb-4 -mt-1 mb-2;
}
</style>
