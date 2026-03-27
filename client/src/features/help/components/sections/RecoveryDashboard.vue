<script setup>
import HelpImage from '../HelpImage.vue'
</script>

<template>
  <div class="help-prose">
    <h2>Recovery Dashboard</h2>

    <div class="callout-info">
      <div class="callout-title">Recovery(자동 복구)란?</div>
      <p>
        Recovery(자동 복구)는 장비에 알람이나 이상이 발생했을 때, 미리 정의된 시나리오에 따라
        자동으로 복구 작업을 수행하는 기능입니다. 예를 들어 특정 알람이 발생하면 장비를 초기화하고
        재시작하는 시나리오가 자동 실행됩니다. Recovery Dashboard는 이러한 자동 복구의 실행 이력과
        성공/실패 현황을 분석하는 페이지입니다.
      </p>
    </div>

    <p>
      Recovery Dashboard는 자동 복구(Recovery) 실행 이력을 종합적으로 분석하는 대시보드입니다.
      3개의 서브 페이지(Overview, By Process, Analysis)로 구성되며,
      집계 데이터를 기반으로 다양한 기간별 트렌드와 분포를 시각화합니다.
    </p>

    <div class="callout-warning">
      <div class="callout-title">배치 집계 기반 - 실시간 아님</div>
      <p>
        Recovery Dashboard의 데이터는 매시 자동 집계(매 시간 5분에 실행)에 의해 집계됩니다.
        따라서 가장 최근 데이터와 실제 현황 사이에 최대 약 1시간의 지연이 있을 수 있습니다.
        마지막 집계 시각이 2시간 이상 경과한 경우 필터 바 우측에 경고 아이콘이 표시됩니다.
        이 경우 배치 서비스가 정상 동작하는지 확인하세요.
      </p>
    </div>

    <!-- ====== Recovery Overview ====== -->
    <h3>Recovery Overview</h3>
    <p>
      Recovery 실행 현황을 종합적으로 보여주는 메인 대시보드입니다.
      KPI 카드, 시계열 트렌드, 상태 분포, Top 10 실패 항목, Trigger 분포를 한 화면에서 확인합니다.
    </p>

    <HelpImage name="recovery-overview" alt="Recovery Overview 화면" caption="Recovery Overview - KPI, 트렌드, 도넛, Top 10, Trigger 분포" />

    <h4>기간 선택</h4>
    <p>
      필터 바에서 조회 기간을 선택할 수 있습니다. 선택 가능한 프리셋은 다음과 같습니다.
    </p>
    <table>
      <thead>
        <tr>
          <th>프리셋</th>
          <th>기간</th>
          <th>트렌드 단위</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>오늘</td>
          <td>당일 0시 ~ 현재</td>
          <td>시간별 (hourly)</td>
        </tr>
        <tr>
          <td>7일</td>
          <td>최근 7일</td>
          <td>일별 (daily)</td>
        </tr>
        <tr>
          <td>30일</td>
          <td>최근 30일</td>
          <td>일별 (daily)</td>
        </tr>
        <tr>
          <td>90일</td>
          <td>최근 90일</td>
          <td>주별 (weekly)</td>
        </tr>
        <tr>
          <td>1년</td>
          <td>최근 1년</td>
          <td>월별 (monthly)</td>
        </tr>
        <tr>
          <td>커스텀</td>
          <td>시작일~종료일 직접 지정 (최대 2년)</td>
          <td>기간 길이에 따라 자동 결정</td>
        </tr>
      </tbody>
    </table>

    <h4>기간 이동 버튼</h4>
    <p>
      필터 바의 좌/우 화살표 버튼(<strong>◀ ▶</strong>)을 사용하여 선택한 프리셋 기간 단위로
      과거/미래로 이동할 수 있습니다. 현재 조회 기간의 시작일과 종료일이 함께 표시됩니다.
      미래 날짜로는 이동할 수 없으며, 2년 이전으로도 이동이 제한됩니다.
    </p>

    <h4>KPI 카드</h4>
    <p>
      상단에 4장의 KPI 카드가 배치됩니다.
    </p>
    <ul>
      <li><strong>전체 실행 건수</strong>: 선택 기간 내 Recovery가 실행된 총 횟수</li>
      <li><strong>성공률</strong>: 성공 건수 / 전체 건수 (백분율)</li>
      <li><strong>성공 건수</strong>: Recovery가 성공적으로 완료된 횟수</li>
      <li><strong>실패 건수</strong>: Recovery 실행이 실패한 횟수</li>
    </ul>

    <h4>트렌드 차트 (누적 막대 차트 + 라인)</h4>
    <p>
      기간별 실행 건수를 상태별(성공/실패/중단/Skip) 누적 막대 차트(Stacked Bar)로 표시하고,
      총 건수와 시나리오 수를 라인으로 오버레이합니다.
      트렌드 단위(시간별/일별/주별/월별)는 선택한 기간에 따라 자동 전환됩니다.
    </p>

    <h4>상태 분포 도넛</h4>
    <p>
      선택 기간 내 Recovery 결과의 상태별 분포를 도넛 차트로 보여줍니다.
      중앙에는 전체 성공률이 표시됩니다.
    </p>

    <h4>Top 10 실패 시나리오 / 실패 장비</h4>
    <p>
      실패가 가장 많이 발생한 시나리오와 장비를 각각 상위 10개까지 세로 막대 차트로 표시합니다.
      이를 통해 반복적으로 실패하는 항목을 빠르게 식별하고 우선 조치할 수 있습니다.
    </p>

    <h4>Trigger 분포</h4>
    <p>
      Recovery를 발생시킨 Trigger 유형(Auto, Manual, Schedule 등)의 분포를 도넛 차트로 보여줍니다.
      상위 5개 Trigger가 개별 표시되고, 나머지는 "기타"로 합산됩니다.
    </p>

    <h4>데이터 신선도 표시</h4>
    <p>
      필터 바 우측에 마지막 배치 집계 시각이 표시됩니다.
      새로고침 아이콘을 클릭하면 최신 집계 시각을 다시 조회합니다.
    </p>

    <h4>Admin 전용: Batch History 모달</h4>
    <HelpImage name="recovery-batch-history-modal" alt="Batch History 모달" caption="Batch History — 히트맵 + 배치 실행 결과 테이블 (Admin 전용)" />
    <p>
      Admin 사용자에게만 표시되는 클립보드 아이콘을 클릭하면 Batch History 모달이 열립니다.
    </p>
    <ul>
      <li><strong>GitHub 스타일 히트맵</strong>: 최근 30/60/90일간 배치 실행 빈도를 색상으로 표시</li>
      <li><strong>필터</strong>: 배치 유형(hourly/daily/backfill) 및 상태(success/fail/skip)별 필터링</li>
      <li><strong>테이블</strong>: 실행 시각, 유형, 상태, 처리 건수, 소요 시간을 페이지네이션 테이블로 조회</li>
    </ul>

    <div class="callout-info">
      <div class="callout-title">Admin 전용: Backfill 관리</div>
      <p>
        톱니바퀴 아이콘은 Backfill 관리 모달을 엽니다. 과거 데이터의 재집계가 필요할 때 사용합니다.
        일반 사용자에게는 이 기능이 표시되지 않습니다.
      </p>
    </div>

    <h4>CSV 내보내기</h4>
    <p>
      필터 바 우측의 CSV 버튼으로 KPI 및 트렌드 데이터를 CSV 파일로 내보낼 수 있습니다.
    </p>

    <div class="callout-info">
      <div class="callout-title">권한</div>
      <p>
        Recovery Overview 페이지에 접근하려면 <code>dashboardRecoveryOverview</code> 권한이 필요합니다.
      </p>
    </div>

    <!-- ====== Recovery by Process ====== -->
    <h3>Recovery by Process</h3>
    <p>
      공정(Process)별 Recovery 성공률을 비교 분석하는 페이지입니다.
      어떤 공정에서 실패가 집중되는지 파악하고, 드릴다운을 통해 상세 원인을 추적합니다.
    </p>

    <HelpImage name="recovery-by-process" alt="Recovery by Process 화면" caption="Recovery by Process - 100% 스택바 성공률 비교 및 요약 테이블" />

    <h4>공정별 성공률 비교 (100% 누적 막대 차트)</h4>
    <p>
      각 공정의 성공/실패/중단/Skip 비율을 100% 기준 누적 막대 차트(Stacked Bar)로 표시합니다.
      모든 공정이 동일한 높이의 막대로 표시되므로 비율 비교가 직관적입니다.
    </p>

    <h4>공정별 실행 건수 (누적 막대 차트)</h4>
    <p>
      절대 건수 기준의 누적 막대 차트(Stacked Bar)로, 어떤 공정에서 Recovery가 가장 많이 발생하는지 확인합니다.
    </p>

    <h4>공정별 성공률 추이 (Multi-Line)</h4>
    <p>
      시간에 따른 각 공정의 성공률 변화를 Multi-Line 차트로 추적합니다.
      트렌드 단위(시간별/일별/주별/월별)는 선택한 기간에 따라 자동 결정됩니다.
    </p>

    <h4>미실행 공정 표시 토글</h4>
    <p>
      우측 상단의 <strong>"미실행 공정 표시"</strong> 토글을 활성화하면,
      EQP_INFO에 등록되어 있지만 선택 기간 내 Recovery 실행 건수가 0인 공정도 함께 표시됩니다.
      이 공정들은 성공률이 <code>&#8709;</code>(빈 값)으로 표시됩니다.
    </p>

    <h4>공정별 요약 테이블</h4>
    <p>
      모든 공정의 전체 건수, 성공/실패/중단/Skip 건수, 성공률을 테이블로 정리합니다.
      CSV 내보내기 버튼으로 이 데이터를 파일로 저장할 수 있습니다.
    </p>

    <h4>드릴다운</h4>
    <p>
      요약 테이블에서 특정 공정 행을 클릭하면 해당 공정의 상위 실패 시나리오, 장비, Trigger 정보가
      아래에 펼쳐집니다. 다시 클릭하면 닫힙니다.
    </p>

    <div class="callout-info">
      <div class="callout-title">권한</div>
      <p>
        Recovery by Process 페이지에 접근하려면 <code>dashboardRecoveryByProcess</code> 권한이 필요합니다.
      </p>
    </div>

    <!-- ====== Recovery Analysis ====== -->
    <h3>Recovery Analysis</h3>
    <p>
      Recovery 이력을 Scenario, Equipment, Trigger 3가지 관점에서 심층 분석하는 페이지입니다.
      탭을 전환하며 각 관점의 상위 항목을 확인하고, 차트 클릭으로 트렌드를 연동하며,
      원본 이력을 모달로 조회할 수 있습니다.
    </p>

    <HelpImage name="recovery-analysis" alt="Recovery Analysis Scenario 탭" caption="Recovery Analysis — Scenario 탭 (기본)" />
    <HelpImage name="recovery-analysis-equipment" alt="Recovery Analysis Equipment 탭" caption="Recovery Analysis — Equipment 탭 (장비별 분석)" />
    <HelpImage name="recovery-analysis-trigger" alt="Recovery Analysis Trigger 탭" caption="Recovery Analysis — Trigger 탭 전환 시" />

    <h4>필터 구성</h4>
    <p>
      Analysis 페이지는 다른 Recovery 페이지와 달리 <strong>단일 선택 모드</strong>로 동작합니다.
    </p>
    <ul>
      <li><strong>Process</strong>: 반드시 하나의 공정을 선택해야 합니다 (단일 선택)</li>
      <li><strong>Model</strong>: 선택한 Process에 속하는 모델 중 하나를 선택 (단일 선택)</li>
      <li><strong>기간</strong>: Overview와 동일한 프리셋 기간 선택</li>
    </ul>
    <p>
      필터의 Process/Model 목록은 실제 데이터가 존재하는 항목만 표시됩니다.
      기간을 변경하면 해당 기간에 데이터가 있는 Process/Model로 목록이 갱신됩니다.
    </p>

    <h4>3개 분석 탭</h4>
    <table>
      <thead>
        <tr>
          <th>탭</th>
          <th>분석 대상</th>
          <th>상위 차트</th>
          <th>이력 조회 기준</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Scenario</strong></td>
          <td>시나리오(시나리오 코드)별 실행/성공/실패 건수</td>
          <td>상위 항목 막대 차트 + 선택 항목 시계열 트렌드</td>
          <td>시나리오 코드 기준</td>
        </tr>
        <tr>
          <td><strong>Equipment</strong></td>
          <td>장비(eqpId)별 실행/성공/실패 건수</td>
          <td>상위 항목 막대 차트 + 선택 항목 시계열 트렌드</td>
          <td>eqpId 기준</td>
        </tr>
        <tr>
          <td><strong>Trigger</strong></td>
          <td>트리거 유형별 실행/성공/실패 건수</td>
          <td>상위 항목 막대 차트 + 선택 항목 시계열 트렌드</td>
          <td>eqpId 기준</td>
        </tr>
      </tbody>
    </table>

    <h4>차트 클릭 연동 (트렌드)</h4>
    <p>
      상위 항목 막대 차트에서 특정 항목을 클릭하면, 해당 항목의 시계열 트렌드 차트가
      아래에 표시됩니다. 기간에 따라 시간별/일별/주별/월별로 자동 전환됩니다.
    </p>

    <h4>이력 조회 모달</h4>
    <p>
      차트의 항목을 클릭하거나 테이블 행의 이력 조회 버튼을 통해
      해당 시나리오 또는 장비의 원본 Recovery 실행 이력을 모달로 조회합니다.
    </p>

    <div class="callout-danger">
      <div class="callout-title">이력 조회 제한: 최대 7일</div>
      <p>
        원본 이력 조회는 성능 보호를 위해 최대 7일 범위로 제한됩니다.
        이 제한은 집계 데이터가 아닌 원본 실행 이력을 직접 조회하기 때문입니다.
        7일을 초과하는 기간의 상세 이력이 필요한 경우 시스템 관리자에게 문의하세요.
      </p>
    </div>

    <div class="callout-info">
      <div class="callout-title">LIVE 배지</div>
      <p>
        이력 조회 모달에서 조회 기간이 현재 시점을 포함하는 경우,
        모달 제목 옆에 <strong>LIVE</strong> 배지가 표시됩니다. 이는 해당 데이터가
        아직 배치 집계에 포함되지 않은 최신 원본 데이터임을 의미합니다.
      </p>
    </div>

    <div class="callout-info">
      <div class="callout-title">권한</div>
      <p>
        Recovery Analysis 페이지에 접근하려면 <code>dashboardRecoveryAnalysis</code> 권한이 필요합니다.
      </p>
    </div>

    <!-- ====== 공통 참고사항 ====== -->
    <h3>공통 참고사항</h3>

    <h4>데이터 집계 방식</h4>
    <p>
      Recovery 데이터는 매시 자동으로 집계됩니다. 최근 데이터가 반영되기까지 최대 1시간의 지연이 있을 수 있습니다.
    </p>
    <ul>
      <li><strong>시간별 집계</strong>: 매 시간 5분에 실행되어 직전 1시간의 Recovery 실행 이력을 집계합니다</li>
      <li><strong>일별 집계</strong>: 데이터 확정 대기 시간(기본 10시간) 경과 후 전일 데이터를 확정 집계합니다</li>
      <li><strong>집계 대상</strong>: Recovery 실행 이력을 시나리오별, 장비별, 트리거별 집계 테이블로 정리합니다</li>
    </ul>

    <h4>조회 시 참고사항</h4>
    <p>
      조회에 시간이 걸릴 수 있습니다. 데이터가 많은 기간을 조회할 경우 잠시 기다려 주세요.
    </p>

    <div class="callout-info">
      <div class="callout-title">데이터 초기화</div>
      <p>
        데이터 초기화가 필요한 경우 시스템 관리자에게 문의하세요.
      </p>
    </div>
  </div>
</template>
