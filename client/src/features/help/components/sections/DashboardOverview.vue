<script setup>
import HelpImage from '../HelpImage.vue'
</script>

<template>
  <div class="help-prose">
    <h2>Dashboard Overview</h2>
    <p>
      Dashboard Overview는 시스템의 전반적인 상태를 한눈에 파악할 수 있는 시작 페이지입니다.
      4장의 KPI(핵심 성과 지표) 카드가 실시간으로 시스템 현황을 요약하여 보여줍니다.
    </p>

    <HelpImage name="dashboard-overview" alt="Dashboard Overview 화면" caption="Dashboard Overview - KPI 카드 4장이 시스템 현황을 요약합니다" />

    <h3>KPI 카드 구성</h3>
    <p>
      화면 상단에 가로 4열로 배치된 카드는 각각 다음 정보를 표시합니다.
    </p>

    <table>
      <thead>
        <tr>
          <th>카드</th>
          <th>색상</th>
          <th>표시 값</th>
          <th>보조 지표</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>ACTIVE CLIENTS</strong></td>
          <td>파란색</td>
          <td>현재 가동 중인 클라이언트 수</td>
          <td>가동률(%) - 전체 대비 활성 비율</td>
        </tr>
        <tr>
          <td><strong>SYSTEM UPTIME</strong></td>
          <td>초록색</td>
          <td>시스템 가동 시간</td>
          <td>가동 시간 변동률(%)</td>
        </tr>
        <tr>
          <td><strong>ERRORS</strong></td>
          <td>빨간색</td>
          <td>현재 발생한 오류 건수</td>
          <td>오류 변동 수 (0이면 정상)</td>
        </tr>
        <tr>
          <td><strong>TOTAL CLIENTS</strong></td>
          <td>보라색</td>
          <td>등록된 전체 클라이언트 수</td>
          <td>오프라인 클라이언트 수</td>
        </tr>
      </tbody>
    </table>

    <h3>수치 해석 방법</h3>

    <h4>ACTIVE CLIENTS</h4>
    <p>
      현재 가동 중인 클라이언트의 총 수입니다.
      보조 지표의 백분율은 전체 등록 클라이언트 대비 활성 클라이언트의 비율을 나타냅니다.
      이 값이 낮다면 다수의 클라이언트가 중단 상태이므로 ARSAgent Status 페이지에서 상세 원인을 확인하세요.
    </p>

    <h4>SYSTEM UPTIME</h4>
    <p>
      시스템의 연속 가동 시간을 표시합니다. 변동률이 음수로 전환되면
      최근에 재시작이 발생했음을 의미하며, 이 경우 시스템 로그를 점검하는 것이 좋습니다.
    </p>

    <h4>ERRORS</h4>
    <p>
      현재 감지된 오류 건수입니다. 이상적인 상태에서는 <code>0</code>으로 표시됩니다.
      오류가 발생하면 빨간색 카드에 강조 표시되므로, 숫자가 0이 아닌 경우 즉시 Client Detail 또는
      Log Viewer에서 해당 오류의 원인을 추적해야 합니다.
    </p>

    <h4>TOTAL CLIENTS</h4>
    <p>
      시스템에 등록된 전체 클라이언트(장비) 수입니다.
      보조 지표로 표시되는 <code>N offline</code> 값은 현재 비활성 상태인 클라이언트 수를 의미합니다.
      이 값이 지속적으로 높다면 네트워크 또는 Agent 배포 문제를 의심할 수 있습니다.
    </p>

    <h3>카드 변동 지표 읽기</h3>
    <p>
      각 카드 하단에는 변동 방향을 나타내는 화살표 아이콘과 텍스트가 있습니다.
    </p>
    <ul>
      <li><strong>초록색 위 화살표</strong>: 양의 변동 (Active Clients, Uptime, Total Clients에서는 긍정적)</li>
      <li><strong>빨간색 아래 화살표</strong>: 음의 변동 (Errors 카드에서는 오류 감소를 의미하므로 긍정적)</li>
    </ul>

    <div class="callout-info">
      <div class="callout-title">참고</div>
      <p>
        Dashboard Overview에 접근하려면 <code>dashboardOverview</code> 권한이 필요합니다.
        권한이 없는 경우 해당 메뉴가 사이드바에 표시되지 않습니다.
        권한 설정은 System > Permissions 페이지에서 관리할 수 있습니다.
      </p>
    </div>

    <div class="callout-warning">
      <div class="callout-title">수치가 실제와 다르게 보일 때</div>
      <p>
        시스템 연결 상태에 따라 수치가 실제와 다를 수 있습니다.
        Agent Status 페이지에서 상세 현황을 확인하세요.
      </p>
    </div>

    <h3>이 페이지를 보고 무엇을 해야 하나요?</h3>
    <p>
      Dashboard Overview의 수치를 통해 다음과 같은 조치를 판단할 수 있습니다.
    </p>
    <table>
      <thead>
        <tr>
          <th>상황</th>
          <th>권장 조치</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Active Clients</strong>가 전체의 80% 미만</td>
          <td>ARSAgent Status 페이지에서 어떤 장비가 꺼져 있는지 확인하세요.</td>
        </tr>
        <tr>
          <td><strong>Errors</strong>가 0이 아님</td>
          <td>Admin이라면 System Logs에서 최근 오류를 확인하세요. Admin이 아니라면 담당자에게 보고하세요.</td>
        </tr>
        <tr>
          <td><strong>System Uptime</strong>이 예상보다 낮음</td>
          <td>최근 시스템 재시작이 있었는지 확인하세요. 의도하지 않은 재시작이라면 로그를 점검하세요.</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
