<script setup>
import HelpImage from '../HelpImage.vue'
</script>

<template>
  <div class="help-prose">
    <h2>클라이언트 관리</h2>
    <p>
      클라이언트 관리 페이지는 시스템에 등록된 모든 Agent(ARS Agent / Resource Agent)를 조회하고,
      서비스 상태 확인 및 제어(시작/중지/재시작) 작업을 수행하는 핵심 운영 화면입니다.
      왼쪽 사이드바에서 <strong>Clients &gt; Client List</strong> 메뉴를 선택하면 접근할 수 있습니다.
    </p>

    <HelpImage name="clients-list-data" alt="클라이언트 목록 화면" caption="클라이언트 목록 — Process 필터 적용 후 데이터 표시" />

    <!-- ===== 페이지 진입 ===== -->
    <h3>ARS Agent vs Resource Agent</h3>
    <p>
      시스템은 두 가지 Agent 그룹을 관리합니다. 사이드바에서 어떤 메뉴를 선택하느냐에 따라
      보이는 데이터와 제어 대상이 달라집니다.
    </p>
    <table>
      <thead>
        <tr>
          <th>구분</th>
          <th>ARS Agent</th>
          <th>Resource Agent</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>역할</td>
          <td>장비 Recovery 시나리오 실행 Agent</td>
          <td>장비 리소스 모니터링 Agent</td>
        </tr>
        <tr>
          <td>메뉴 위치</td>
          <td>Clients &gt; ARS Agent</td>
          <td>Clients &gt; Resource Agent</td>
        </tr>
        <tr>
          <td>서비스 제어</td>
          <td>Start / Stop / Restart / Kill</td>
          <td>Start / Stop / Restart / Kill</td>
        </tr>
        <tr>
          <td>Config 파일</td>
          <td>Agent별 Config 파일 4종</td>
          <td>Agent별 Config 파일 (설정에 따라 다름)</td>
        </tr>
        <tr>
          <td>버전 표시</td>
          <td>arsAgent 버전</td>
          <td>resourceAgent 버전</td>
        </tr>
      </tbody>
    </table>

    <HelpImage name="resource-clients-list" alt="ResourceAgent 클라이언트 목록" caption="ResourceAgent 클라이언트 목록 — Clients > ResourceAgent 메뉴" />

    <!-- ===== 필터바 ===== -->
    <h3>필터바 (Filter Bar)</h3>
    <p>
      페이지 상단의 필터바를 사용하여 조회 조건을 설정합니다.
      필터 없이는 데이터가 로드되지 않으므로, 반드시 필터 조건을 선택한 뒤 <strong>Search</strong> 버튼을 클릭해야 합니다.
    </p>
    <ul>
      <li><strong>Process</strong> : 공정(Process) 선택 (다중 선택 가능)</li>
      <li><strong>Model</strong> : 장비 모델(EqpModel) 선택 (다중 선택 가능, Process 선택 시 해당 모델만 표시)</li>
      <li><strong>Search</strong> : 선택한 필터로 클라이언트 목록 조회</li>
      <li><strong>Clear</strong> : 필터 초기화 및 데이터 제거</li>
    </ul>
    <p>
      필터바 좌측의 화살표 버튼을 클릭하면 필터바를 접거나 펼 수 있어 화면 공간을 효율적으로 활용할 수 있습니다.
    </p>

    <!-- ===== AG Grid ===== -->
    <h3>클라이언트 목록 (AG Grid)</h3>
    <p>
      검색 결과는 AG Grid 기반의 테이블에 표시됩니다. 주요 컬럼은 다음과 같습니다.
    </p>
    <table>
      <thead>
        <tr>
          <th>컬럼</th>
          <th>설명</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>체크박스</td>
          <td>행 선택 (다중 선택 가능, 배치 작업에 사용)</td>
        </tr>
        <tr>
          <td>EqpId</td>
          <td>장비 고유 식별자</td>
        </tr>
        <tr>
          <td>Process / Model</td>
          <td>공정명 / 장비 모델명</td>
        </tr>
        <tr>
          <td>IP</td>
          <td>장비 IP 주소</td>
        </tr>
        <tr>
          <td>Status</td>
          <td>서비스 상태 아이콘 (Running / Stopped / Unreachable / Not Installed)</td>
        </tr>
        <tr>
          <td>Uptime</td>
          <td>서비스 가동 시간</td>
        </tr>
        <tr>
          <td>Version</td>
          <td>Agent 버전 (Alive 상태 조회 시 표시)</td>
        </tr>
      </tbody>
    </table>

    <h4>상태 아이콘 의미</h4>
    <table>
      <thead>
        <tr>
          <th>상태</th>
          <th>의미</th>
          <th>설명</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Running</td>
          <td>정상 가동 중</td>
          <td>Agent 프로세스가 실행되고 있으며 응답 가능</td>
        </tr>
        <tr>
          <td>Stopped</td>
          <td>중지됨</td>
          <td>Agent 프로세스가 중지된 상태 (ManagerAgent는 통신 가능)</td>
        </tr>
        <tr>
          <td>Unreachable</td>
          <td>통신 불가</td>
          <td>ManagerAgent와 통신할 수 없는 상태</td>
        </tr>
        <tr>
          <td>Not Installed</td>
          <td>미설치</td>
          <td>해당 장비에 Agent가 설치되지 않은 상태</td>
        </tr>
      </tbody>
    </table>

    <p>행을 클릭하면 해당 클라이언트의 <strong>상세 페이지(Client Detail)</strong>로 이동합니다.</p>

    <!-- ===== 툴바 ===== -->
    <h3>툴바 (Toolbar)</h3>
    <p>
      검색 후 표시되는 툴바에서 다양한 작업을 수행할 수 있습니다.
      일부 버튼은 클라이언트를 선택해야 활성화됩니다.
    </p>

    <h4>상태별 선택 (Select by Status)</h4>
    <p>
      툴바 좌측의 드롭다운을 사용하면 Running, Stopped, Unreachable, Not Installed 상태별로
      클라이언트를 일괄 선택할 수 있습니다. 각 상태별 건수가 표시되어 빠르게 파악할 수 있습니다.
    </p>

    <h4>서비스 제어 버튼</h4>
    <p>
      그리드에서 하나 이상의 클라이언트를 선택한 후, 툴바의 제어 버튼을 클릭합니다.
    </p>
    <table>
      <thead>
        <tr>
          <th>버튼</th>
          <th>기능</th>
          <th>설명</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Status</td>
          <td>상태 조회</td>
          <td>선택한 클라이언트의 최신 서비스 상태를 RPC로 조회합니다</td>
        </tr>
        <tr>
          <td>Start</td>
          <td>서비스 시작</td>
          <td>중지된 Agent를 시작합니다</td>
        </tr>
        <tr>
          <td>Stop</td>
          <td>서비스 중지</td>
          <td>실행 중인 Agent를 정상 종료합니다</td>
        </tr>
        <tr>
          <td>Restart</td>
          <td>서비스 재시작</td>
          <td>Agent를 중지 후 다시 시작합니다</td>
        </tr>
        <tr>
          <td>Kill</td>
          <td>강제 종료</td>
          <td>Agent 프로세스를 강제 종료합니다 (확인 대화상자 표시)</td>
        </tr>
      </tbody>
    </table>

    <div class="callout-warning">
      <div class="callout-title">주의: Kill 명령</div>
      <p>
        Kill은 프로세스를 강제 종료하므로 데이터 손실이 발생할 수 있습니다.
        정상적인 Stop이 동작하지 않을 때에만 사용하세요.
      </p>
    </div>

    <!-- ===== 배치 작업 ===== -->
    <h3>배치 제어 (Batch Control)</h3>
    <HelpImage name="clients-selected" alt="클라이언트 다중 선택 상태" caption="클라이언트 다중 선택 — 체크박스로 선택 후 배치 제어 버튼 활성화" />
    <p>
      여러 클라이언트를 동시에 선택하여 배치로 서비스 제어를 수행할 수 있습니다.
      배치 작업은 SSE(Server-Sent Events) 스트림을 통해 각 클라이언트의 결과를 실시간으로 수신합니다.
    </p>
    <ol>
      <li>그리드에서 여러 클라이언트를 체크박스로 선택합니다</li>
      <li>툴바에서 원하는 제어 버튼(Start / Stop / Restart)을 클릭합니다</li>
      <li>각 클라이언트별로 결과가 순차적으로 반영되며, 성공/실패 건수가 Toast로 표시됩니다</li>
    </ol>

    <div class="callout-info">
      <div class="callout-title">배치 작업 중 취소</div>
      <p>
        배치 제어 진행 중에 페이지를 떠나면 진행 중인 스트림이 자동으로 취소됩니다.
        이미 처리된 건은 롤백되지 않습니다.
      </p>
    </div>

    <!-- ===== 추가 기능 버튼 ===== -->
    <h3>추가 기능</h3>
    <p>
      툴바에는 서비스 제어 외에도 다음과 같은 추가 기능 버튼이 있습니다.
    </p>
    <table>
      <thead>
        <tr>
          <th>버튼</th>
          <th>기능</th>
          <th>설명</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Config</td>
          <td>Config 관리</td>
          <td>선택한 클라이언트의 Config 파일을 조회/편집/횡전개합니다</td>
        </tr>
        <tr>
          <td>Compare</td>
          <td>Config 비교</td>
          <td>2~25개 클라이언트의 Config를 N-way 비교합니다</td>
        </tr>
        <tr>
          <td>Log</td>
          <td>Log Viewer</td>
          <td>선택한 클라이언트의 로그 파일을 조회/Tailing합니다</td>
        </tr>
        <tr>
          <td>Update</td>
          <td>소프트웨어 배포</td>
          <td>선택한 클라이언트에 소프트웨어를 배포합니다</td>
        </tr>
        <tr>
          <td>Refresh</td>
          <td>새로고침</td>
          <td>클라이언트 목록을 다시 조회하고 상태를 갱신합니다</td>
        </tr>
      </tbody>
    </table>

    <!-- ===== 헤더 버튼 (Admin) ===== -->
    <h3>관리 설정 (Admin 전용)</h3>
    <p>
      Admin 역할의 사용자는 페이지 상단 우측에 추가 설정 버튼이 표시됩니다.
    </p>
    <ul>
      <li><strong>Update Settings</strong> : 소프트웨어 업데이트 프로필 및 태스크 관리</li>
      <li><strong>Config Settings</strong> : Config 파일 경로 및 설정 관리</li>
      <li><strong>Log Settings</strong> : 로그 소스 경로 및 설정 관리</li>
      <li><strong>Feature Permissions</strong> : 클라이언트 제어 기능의 역할별 Read/Write/Delete 권한 설정</li>
    </ul>

    <div class="callout-info">
      <div class="callout-title">권한에 따른 UI 제한</div>
      <p>
        사용자의 Feature Permission(clientControl)에 따라 서비스 제어 버튼의 활성화 여부가 달라집니다.
        Read 권한만 있는 사용자는 상태 조회만 가능하며, Write 권한이 있어야 Start/Stop/Restart를 사용할 수 있습니다.
      </p>
    </div>

    <!-- ===== 페이지네이션 ===== -->
    <h3>페이지네이션</h3>
    <p>
      클라이언트 수가 많은 경우 페이지네이션이 적용됩니다.
      툴바 우측에서 페이지 크기(100/200/500/1000)를 변경하거나, 페이지 번호로 이동할 수 있습니다.
      전체 레코드 수가 좌측에 표시됩니다.
    </p>

    <!-- ===== 클라이언트 상세 ===== -->
    <h3>클라이언트 상세 (Client Detail)</h3>
    <p>
      그리드에서 행을 클릭하면 해당 클라이언트의 상세 페이지(<code>/clients/:id</code>)로 이동합니다.
      상세 페이지에서는 개별 클라이언트의 상태, 리소스 정보, 로그, 서비스 제어를 수행할 수 있습니다.
    </p>
  </div>
</template>
