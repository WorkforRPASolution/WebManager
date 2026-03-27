<script setup>
import HelpImage from '../HelpImage.vue'
</script>

<template>
  <div class="help-prose">
    <h2>Agent Status / Version</h2>

    <div class="callout-info">
      <div class="callout-title">ARSAgent / ResourceAgent란?</div>
      <p>
        <strong>ARSAgent</strong>는 각 장비에서 자동 복구(Recovery), 시나리오 실행 등 핵심 자동화 작업을 수행하는 소프트웨어입니다.
        <strong>ResourceAgent</strong>는 각 장비의 리소스(CPU, 메모리, 디스크 등)를 실시간 모니터링하는 소프트웨어입니다.
      </p>
      <p>
        아래 4개 대시보드 페이지에서 이 에이전트들의 가동 현황과 버전 분포를 확인할 수 있습니다.
      </p>
    </div>

    <p>
      이 섹션에서는 ARSAgent와 ResourceAgent의 가동 현황 및 버전 분포를 모니터링하는
      4개 대시보드 페이지를 안내합니다. 모든 페이지는 Process/Model 기반 필터링, 정렬, CSV 내보내기를 지원합니다.
    </p>

    <!-- ====== ARSAgent Status ====== -->
    <h3>ARSAgent Status</h3>
    <p>
      ARSAgent Status 페이지는 Process별 ARSAgent의 가동 현황을 3가지 상태로 분류하여 보여줍니다.
      도넛 차트, 바 차트, 상세 테이블로 구성됩니다.
    </p>

    <HelpImage name="agent-status" alt="ARSAgent Status 화면" caption="ARSAgent Status - 3상태 분류 도넛 차트 및 바 차트" />

    <h4>3가지 상태 분류</h4>
    <table>
      <thead>
        <tr>
          <th>상태</th>
          <th>색상</th>
          <th>의미</th>
          <th>판단 기준</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Running</strong></td>
          <td>초록색</td>
          <td>현재 정상 가동 중</td>
          <td>에이전트가 현재 정상 가동 중입니다</td>
        </tr>
        <tr>
          <td><strong>Stopped</strong></td>
          <td>노란색</td>
          <td>이전에 가동했으나 현재 중단</td>
          <td>이전에 실행된 적 있으나 현재 중지된 상태입니다</td>
        </tr>
        <tr>
          <td><strong>NeverStarted</strong></td>
          <td>회색</td>
          <td>한 번도 가동한 적 없음</td>
          <td>한 번도 실행된 적 없는 장비입니다 (설치 필요)</td>
        </tr>
      </tbody>
    </table>

    <h4>차트 구성</h4>
    <ul>
      <li><strong>도넛 차트 (좌측 1/3)</strong>: 전체 가동률을 한눈에 확인. 중앙에 Running 비율이 백분율로 표시됩니다.</li>
      <li><strong>바 차트 (우측 2/3)</strong>: Process(또는 Model)별 Running/Stopped/NeverStarted 수를 세로 막대로 비교합니다. 항목이 많을 경우 하단 스크롤 슬라이더로 횡 스크롤이 가능합니다.</li>
    </ul>

    <h4>필터 및 정렬</h4>
    <ul>
      <li><strong>Process 필터</strong>: 특정 공정만 선택하여 조회 (다중 선택 가능)</li>
      <li><strong>Model 필터</strong>: 선택한 Process에 속하는 장비 모델 필터링</li>
      <li><strong>Group by Model</strong>: 체크 시 Process+Model 조합 단위로 그룹핑</li>
      <li><strong>정렬</strong>: 이름순 또는 수량순, 오름차순/내림차순 전환 가능</li>
    </ul>

    <h4>데이터 테이블</h4>
    <p>
      차트 아래의 테이블에서 각 Process(또는 Model)별 Agent 수, Running/Stopped/NeverStarted 건수,
      가동률을 확인할 수 있습니다.
    </p>

    <h4>CSV 내보내기</h4>
    <p>
      테이블 우측 상단의 <code>CSV</code> 버튼을 클릭하면 두 가지 형식으로 내보낼 수 있습니다.
    </p>
    <ul>
      <li><strong>요약</strong>: Process별 집계 데이터 (현재 화면에 보이는 그룹 단위)</li>
      <li><strong>상세</strong>: 개별 Agent 단위 (eqpId, process, eqpModel, 상태 포함)</li>
    </ul>

    <div class="callout-info">
      <div class="callout-title">권한</div>
      <p>
        이 페이지에 접근하려면 <code>dashboardArsMonitor</code> 권한이 필요합니다.
      </p>
    </div>

    <!-- ====== ARSAgent Version ====== -->
    <h3>ARSAgent Version</h3>
    <p>
      ARSAgent Version 페이지는 Process별 ARSAgent 소프트웨어 버전의 분포를 시각화합니다.
      버전 불일치 장비를 신속하게 식별하여 업데이트 계획을 수립하는 데 활용합니다.
    </p>

    <HelpImage name="agent-version" alt="ARSAgent Version 화면" caption="ARSAgent Version - 버전 분포 도넛 차트 및 Grouped 테이블" />

    <h4>화면 구성</h4>
    <ul>
      <li><strong>버전 분포 도넛 차트 (좌측 1/3)</strong>: 전체 Agent 중 각 버전이 차지하는 비율을 표시합니다. 버전별로 고유 색상이 할당됩니다.</li>
      <li><strong>Process별 버전 바 차트 (우측 2/3)</strong>: Process 단위로 각 버전의 Agent 수를 누적 막대 차트(Stacked Bar)로 보여줍니다.</li>
      <li><strong>Grouped 테이블</strong>: Process별로 그룹화된 테이블에서 각 버전의 Agent 수를 열(column)로 확인합니다.</li>
    </ul>

    <h4>Running Only 토글</h4>
    <p>
      필터 바 우측의 <strong>Running Only</strong> 스위치를 켜면 현재 가동 중인(Running) Agent만
      대상으로 버전 분포를 집계합니다. 중단된 장비는 이전 버전일 가능성이 높으므로,
      실제 가동 환경의 버전 현황을 정확히 파악하려면 이 토글을 활성화하는 것을 권장합니다.
    </p>

    <h4>Grouped 테이블 접기/펼치기</h4>
    <p>
      테이블의 각 Process 행 좌측 화살표를 클릭하면 해당 Process에 속하는 개별 Agent(eqpId)별
      버전 정보를 펼쳐볼 수 있습니다. 다시 클릭하면 접힙니다.
    </p>

    <h4>CSV 내보내기</h4>
    <ul>
      <li><strong>요약</strong>: Process별 버전 분포 집계</li>
      <li><strong>상세</strong>: 개별 Agent 단위 버전 정보</li>
    </ul>

    <div class="callout-info">
      <div class="callout-title">권한</div>
      <p>
        이 페이지에 접근하려면 <code>dashboardArsVersion</code> 권한이 필요합니다.
      </p>
    </div>

    <!-- ====== ResourceAgent Status ====== -->
    <h3>ResourceAgent Status</h3>
    <p>
      ResourceAgent Status 페이지는 ResourceAgent의 가동 현황을 5가지 상태로 세분화하여 모니터링합니다.
      ARSAgent Status와 유사한 레이아웃이지만, 상태 분류가 더 상세합니다.
    </p>

    <HelpImage name="resource-agent-status" alt="ResourceAgent Status 화면" caption="ResourceAgent Status - 5상태 분류 도넛/바 차트" />

    <h4>5가지 상태 분류</h4>
    <table>
      <thead>
        <tr>
          <th>상태</th>
          <th>색상</th>
          <th>의미</th>
          <th>판단 기준</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>OK</strong></td>
          <td>초록색</td>
          <td>정상 가동</td>
          <td>리소스 모니터링이 정상 동작 중입니다</td>
        </tr>
        <tr>
          <td><strong>WARN</strong></td>
          <td>노란색</td>
          <td>경고 상태 (리소스 부족 등)</td>
          <td>리소스 사용량이 임계값을 초과했습니다 (주의 필요)</td>
        </tr>
        <tr>
          <td><strong>SHUTDOWN</strong></td>
          <td>주황색</td>
          <td>종료 진행 중 또는 비정상 종료</td>
          <td>에이전트가 정상적으로 종료 신호를 받아 중지되었습니다</td>
        </tr>
        <tr>
          <td><strong>Stopped</strong></td>
          <td>빨간색</td>
          <td>이전에 가동했으나 현재 중단</td>
          <td>비정상적으로 중지되었습니다 (연결 끊김)</td>
        </tr>
        <tr>
          <td><strong>NeverStarted</strong></td>
          <td>회색</td>
          <td>한 번도 가동한 적 없음</td>
          <td>ResourceAgent가 설치되지 않았거나 한 번도 실행되지 않았습니다</td>
        </tr>
      </tbody>
    </table>

    <div class="callout-warning">
      <div class="callout-title">WARN 및 SHUTDOWN 상태 대응</div>
      <p>
        WARN 상태의 Agent는 곧 장애로 전이될 수 있으므로, 해당 장비의 Client Detail 페이지에서
        리소스 현황을 확인하고 조치하세요. SHUTDOWN 상태는 Agent가 종료 절차를 진행 중이거나
        비정상 종료된 것이므로, 재시작 또는 로그 확인이 필요합니다.
      </p>
    </div>

    <h4>차트 및 테이블</h4>
    <p>
      ARSAgent Status와 동일한 레이아웃(도넛 + 바 차트 + 테이블)을 사용합니다.
      도넛 차트 중앙에는 OK 상태 비율이 표시되며, 바 차트에서는 5가지 상태가 색상별로 구분됩니다.
    </p>

    <h4>필터, 정렬, CSV</h4>
    <p>
      ARSAgent Status와 동일한 Process/Model 필터, 정렬 기능, CSV 내보내기(요약/상세)를 지원합니다.
    </p>

    <div class="callout-info">
      <div class="callout-title">권한</div>
      <p>
        이 페이지에 접근하려면 <code>dashboardResStatus</code> 권한이 필요합니다.
      </p>
    </div>

    <!-- ====== ResourceAgent Version ====== -->
    <h3>ResourceAgent Version</h3>
    <p>
      ResourceAgent Version 페이지는 ResourceAgent의 소프트웨어 버전 분포를 모니터링합니다.
      ARSAgent Version과 동일한 UI 패턴(도넛 + 바 차트 + Grouped 테이블)을 사용합니다.
    </p>

    <HelpImage name="resource-agent-version" alt="ResourceAgent Version 화면" caption="ResourceAgent Version - ARSAgent Version과 동일한 패턴의 버전 분포 화면" />

    <h4>Running Only 토글</h4>
    <p>
      ARSAgent Version과 마찬가지로 Running Only 토글을 활성화하면
      현재 가동 중인 ResourceAgent만 대상으로 버전 분포를 집계합니다.
    </p>

    <h4>기능 요약</h4>
    <ul>
      <li>버전 분포 도넛 차트 + Process별 버전 바 차트</li>
      <li>Grouped 테이블 (접기/펼치기로 개별 Agent 확인)</li>
      <li>Process/Model 필터, 정렬, CSV 내보내기(요약/상세)</li>
    </ul>

    <div class="callout-info">
      <div class="callout-title">권한</div>
      <p>
        이 페이지에 접근하려면 <code>dashboardResVersion</code> 권한이 필요합니다.
      </p>
    </div>

    <!-- ====== 공통 안내 ====== -->
    <h3>공통 참고사항</h3>

    <div class="callout-warning">
      <div class="callout-title">서버 연결 필수</div>
      <p>
        Agent Status/Version 4개 페이지 모두 서버의 실시간 데이터에 의존합니다.
        서버 연결이 불가능한 경우 테이블 상단에 경고 메시지가 표시되며,
        가동 상태를 정확히 판단할 수 없습니다.
      </p>
    </div>

    <div class="callout-info">
      <div class="callout-title">데이터 갱신 주기</div>
      <p>
        Agent 상태는 거의 실시간으로 반영됩니다.
        페이지를 새로고침하거나 필터 조건을 변경하여 조회 버튼을 누르면 최신 데이터를 받아옵니다.
        자동 새로고침 기능은 제공하지 않으므로 필요 시 수동으로 조회하세요.
      </p>
    </div>
  </div>
</template>
