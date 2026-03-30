<script setup>
import HelpImage from '../HelpImage.vue'
</script>

<template>
  <div class="help-prose">
    <h2>User Activity</h2>
    <p>
      User Activity 대시보드는 사용자 활동 현황을 3가지 관점(Tool Usage, Scenario, WebManager)에서 분석합니다.
      상단 탭으로 전환하며, 각 탭은 독립적인 필터와 차트를 제공합니다.
    </p>

    <HelpImage name="user-activity" alt="User Activity 화면" caption="User Activity - 3탭 구조 (Tool Usage / Scenario / WebManager)" />

    <!-- ====== Tool Usage 탭 ====== -->
    <h3>Tool Usage 탭</h3>
    <p>
      ScenarioEditor(SE) 도구의 사용 현황을 공정별, 사용자별로 분석합니다.
      ARS_USER_INFO 컬렉션의 <code>accessnum</code>(누적 실행 횟수)과
      <code>latestExecution</code>(최근 SE 실행 시각) 필드를 기반으로 집계합니다.
    </p>

    <h4>기간 선택</h4>
    <table>
      <thead>
        <tr>
          <th>프리셋</th>
          <th>기간</th>
          <th>설명</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>전체</td>
          <td>전 기간</td>
          <td>기간 제한 없이 전체 사용자 대상</td>
        </tr>
        <tr>
          <td>최근 24시간</td>
          <td>현재 - 24시간</td>
          <td>당일 활성 사용자 파악</td>
        </tr>
        <tr>
          <td>7일 / 30일 / 1년</td>
          <td>최근 N일</td>
          <td>단기~장기 활동 추이 분석</td>
        </tr>
        <tr>
          <td>시작일 지정</td>
          <td>시작일 ~ 현재</td>
          <td>종료일은 항상 현재 (최대 2년)</td>
        </tr>
      </tbody>
    </table>

    <div class="callout-info">
      <div class="callout-title">종료일이 항상 현재인 이유</div>
      <p>
        Tool Usage는 <code>latestExecution</code> 스냅샷 필드를 기반으로 합니다.
        이 값은 "가장 최근 SE 실행 시각"이므로, 특정 과거 구간의 활동을 추출하는 것이 아니라
        "시작일 이후 SE를 실행한 적이 있는 사용자"를 필터링하는 방식입니다.
        따라서 종료일은 항상 현재 시점이 됩니다.
      </p>
    </div>

    <h4>KPI 카드 3장</h4>
    <ul>
      <li><strong>전체 사용자</strong>: 등록된 전체 사용자 수 (기간과 무관하게 고정)</li>
      <li><strong>SE 사용자</strong>: 선택 기간 내 SE를 실행한 적 있는 사용자 수 (기간에 반응)</li>
      <li><strong>사용률</strong>: SE 사용자 / 전체 사용자 (백분율, 기간에 반응)</li>
    </ul>

    <h4>공정별 사용 현황 (Stacked Bar)</h4>
    <p>
      2/3 영역에 공정별 전체 사용자 수와 Active 사용자 수를 Stacked Bar로 표시합니다.
      항목이 25개를 초과하면 하단 dataZoom 슬라이더로 횡 스크롤이 가능합니다.
    </p>

    <div class="callout-info">
      <div class="callout-title">다중 공정 사용자</div>
      <p>
        한 사용자가 여러 공정에 소속된 경우, 각 공정에 중복으로 집계됩니다.
        차트 제목 옆에 "다중 공정 사용자 중복 포함" 안내가 표시됩니다.
      </p>
    </div>

    <h4>공정별 Active 분포 (도넛)</h4>
    <p>
      1/3 영역에 공정별 Active 사용자 수를 도넛 차트로 표시합니다.
      상위 10개 공정이 개별 표시되고, 나머지는 "기타"로 합산됩니다.
      범례는 스크롤 가능합니다.
    </p>

    <h4>Top 10 누적 실행 횟수 (Vertical Bar)</h4>
    <p>
      <code>accessnum</code> 기준으로 SE를 가장 많이 실행한 상위 10명을 세로 막대 차트로 표시합니다.
    </p>

    <h4>최근 실행 사용자 (테이블)</h4>
    <p>
      최근 SE를 실행한 사용자 30명을 테이블로 표시합니다 (고정 높이, 스크롤).
      사용자 ID, 이름, 공정, 최근 실행 시각, 누적 실행 횟수를 확인할 수 있습니다.
      CSV 버튼으로 전체 목록(제한 없이)을 내보낼 수 있습니다.
    </p>

    <h4>토글 버튼 2개</h4>
    <table>
      <thead>
        <tr>
          <th>토글</th>
          <th>기본값</th>
          <th>동작</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>사용자미등록 공정포함</strong></td>
          <td>OFF</td>
          <td>활성화 시 EQP_INFO에 등록되어 있지만 사용자가 없는 공정도 차트에 표시 (프론트엔드에서 처리, 서버 재요청 없음)</td>
        </tr>
        <tr>
          <td><strong>관리자 포함</strong></td>
          <td>OFF</td>
          <td>활성화 시 관리자(authorityManager=1) 사용자도 집계에 포함 (서버에 재요청)</td>
        </tr>
      </tbody>
    </table>

    <!-- ====== Scenario 탭 ====== -->
    <h3>Scenario 탭</h3>
    <HelpImage name="user-activity-scenario" alt="User Activity Scenario 탭" caption="Scenario 탭 — KPI 5장 + 공정별 시나리오 현황 + 성과 입력률" />
    <p>
      시나리오(Recovery 자동복구 시나리오) 작성 현황을 공정별로 분석합니다.
      시나리오의 활성/비활성 분포, 성과 입력률(Loss 필드 기준), 최근 수정 이력을 확인합니다.
    </p>

    <h4>KPI 카드 5장</h4>
    <ul>
      <li><strong>전체 시나리오</strong>: 등록된 총 시나리오 수</li>
      <li><strong>Active 시나리오</strong>: 현재 활성 상태인 시나리오 수</li>
      <li><strong>Inactive 시나리오</strong>: 비활성 시나리오 수</li>
      <li><strong>성과 입력률</strong>: Loss 필드가 채워진 시나리오 비율</li>
      <li><strong>작성자 수</strong>: 기간 내 시나리오를 수정한 고유 사용자 수</li>
    </ul>

    <h4>공정별 시나리오 현황 (Stacked Bar)</h4>
    <p>
      공정별 Active/Inactive 시나리오 수를 Stacked Bar로 비교합니다.
      CSV 내보내기는 요약(공정별)과 상세(시나리오별) 두 가지를 지원합니다.
    </p>

    <h4>공정별 성과 입력률 (Bar)</h4>
    <p>
      공정별 Loss 필드 입력 비율을 막대 차트로 비교합니다.
      성과 입력률이 낮은 공정은 시나리오 품질 개선이 필요할 수 있습니다.
    </p>

    <h4>Top 10 작성자 + 최근 수정 이력</h4>
    <p>
      기간 내 시나리오 수정 횟수가 가장 많은 상위 10명을 세로 막대로 표시하고,
      최근 수정된 시나리오 이력을 테이블로 보여줍니다.
    </p>

    <h4>토글: 사용자미등록 공정포함</h4>
    <p>
      Tool Usage 탭과 동일하게, EQP_INFO에 등록되었지만 시나리오가 없는 공정을 차트에 포함합니다.
    </p>

    <!-- ====== WebManager 탭 ====== -->
    <h3>WebManager 탭</h3>
    <HelpImage name="user-activity-webmanager" alt="User Activity WebManager 탭" caption="WebManager 탭 — KPI 4장 + 페이지별 방문 + 일별 추이" />
    <p>
      WebManager 자체의 사용 통계를 분석합니다.
      WEBMANAGER_LOG (category='access')에 기록된 페이지 접근 로그를 기반으로
      방문 현황, 체류 시간, 사용 패턴을 시각화합니다.
    </p>

    <h4>기간 선택</h4>
    <p>
      Access 로그의 TTL이 90일이므로, WebManager 탭의 최대 조회 기간은 90일입니다.
    </p>
    <table>
      <thead>
        <tr>
          <th>프리셋</th>
          <th>기간</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>최근 24시간</td>
          <td>현재 - 24시간</td>
        </tr>
        <tr>
          <td>최근 7일</td>
          <td>현재 - 7일</td>
        </tr>
        <tr>
          <td>최근 30일</td>
          <td>현재 - 30일</td>
        </tr>
        <tr>
          <td>최근 90일</td>
          <td>최대 기간 (TTL 제한)</td>
        </tr>
        <tr>
          <td>시작일 지정</td>
          <td>시작일 ~ 종료일 직접 지정 (최대 90일)</td>
        </tr>
      </tbody>
    </table>

    <h4>KPI 카드 4장</h4>
    <ul>
      <li><strong>활성 사용자 (DAU)</strong>: 선택 기간 내 WebManager에 접속한 고유 사용자 수</li>
      <li><strong>총 방문</strong>: 전체 페이지 방문 횟수</li>
      <li><strong>페이지 도달률</strong>: 전체 22개 페이지 중 1회 이상 방문된 페이지 비율</li>
      <li><strong>평균 체류 시간</strong>: 페이지당 평균 체류 시간 (30분 캡 적용, 0초 제외)</li>
    </ul>

    <h4>일별 방문 현황 (Line + Bar)</h4>
    <p>
      DAU(Line)와 총 방문 수(Bar)를 일별/주별로 오버레이합니다.
      90일 기간에서는 주별 롤업으로 자동 전환됩니다.
      우측에는 페이지별 방문 비율 도넛이 표시됩니다.
    </p>

    <h4>공정별 활성 사용자 추이 + 공정별 도넛</h4>
    <p>
      Multi-Line 차트로 공정별 활성 사용자 수의 일별 추이를 보여주고,
      도넛 차트로 공정별 활성 사용자 현황을 표시합니다.
      다중 공정 소속 사용자는 중복 포함됩니다.
    </p>

    <h4>동시접속 추이</h4>
    <p>
      시간대별 동시접속자 수의 변화를 보여줍니다.
      KPI 카드에도 피크 동시접속 수가 뱃지로 표시됩니다.
    </p>

    <h4>페이지별 평균 체류시간 추이</h4>
    <p>
      주요 페이지의 일별 평균 체류 시간 변화를 Multi-Line으로 추적합니다.
      체류 시간은 30분 캡이 적용되고, 0초 기록은 제외됩니다.
    </p>

    <h4>시간대별 사용 패턴 (히트맵)</h4>
    <p>
      요일(행) x 시간대(열) 히트맵으로 WebManager 사용이 집중되는 시간대를 파악합니다.
      색상이 진할수록 방문이 많은 시간대입니다.
    </p>

    <h4>메뉴 그룹별 방문 추이</h4>
    <p>
      Dashboard, Clients, 기준정보 관리, System 등 메뉴 그룹별 방문 수 추이를
      Stacked Area 차트로 보여줍니다.
    </p>

    <h4>Top 10 활성 사용자 + 최근 접속 이력</h4>
    <p>
      방문 횟수 기준 상위 10명을 세로 막대로 표시하고,
      최근 접속 이력을 테이블로 보여줍니다.
      최근 접속 이력은 <strong>상세</strong>와 <strong>사용자별</strong> 두 가지 모드를 전환할 수 있습니다.
    </p>
    <ul>
      <li><strong>상세 모드</strong>: 개별 페이지 방문 단위로 시간, 사용자, 페이지명, 체류시간 표시</li>
      <li><strong>사용자별 모드</strong>: 사용자 단위로 마지막 접속 시각, 총 방문 수 요약 표시</li>
    </ul>

    <h4>CSV 내보내기</h4>
    <p>
      각 차트/테이블 우측의 CSV 버튼으로 개별 데이터를 내보낼 수 있습니다.
    </p>
    <ul>
      <li>페이지 요약 CSV (pageSummary)</li>
      <li>공정별 추이 CSV (processTrend)</li>
      <li>Top 사용자 CSV (topUsers)</li>
      <li>최근 접속 CSV (recentVisits - 전체 데이터, 화면 30행 제한 없이 내보내기)</li>
    </ul>

    <h4>토글: 관리자 포함</h4>
    <p>
      기본적으로 관리자(authorityManager=1) 사용자는 통계에서 제외됩니다.
      <strong>"관리자 포함"</strong> 토글을 활성화하면 관리자 활동도 포함하여 집계합니다.
      서버에 재요청이 발생합니다.
    </p>

    <div class="callout-warning">
      <div class="callout-title">Access 로그 TTL 제한</div>
      <p>
        WebManager의 Access 로그는 90일 TTL이 적용되어 있습니다.
        따라서 90일 이전의 사용 통계는 조회할 수 없습니다.
        장기 통계가 필요한 경우 정기적으로 CSV를 내보내어 별도 보관하세요.
      </p>
    </div>

    <div class="callout-info">
      <div class="callout-title">체류 시간 보정</div>
      <p>
        체류 시간(durationMs)은 품질 보정이 적용됩니다.
        30분을 초과하는 체류 시간은 30분으로 캡 처리되고, 0초 기록은 계산에서 제외됩니다.
        이는 브라우저 탭을 열어두고 자리를 비운 경우 등 비정상적인 값을 보정하기 위함입니다.
      </p>
    </div>

    <!-- ====== 공통 참고사항 ====== -->
    <h3>공통 참고사항</h3>

    <div class="callout-info">
      <div class="callout-title">Process 필터와 사용자 권한</div>
      <p>
        Tool Usage와 Scenario 탭에서 Process 필터를 선택하지 않으면,
        현재 로그인한 사용자의 권한에 따라 접근 가능한 공정만 자동으로 필터링됩니다.
        WebManager 탭은 공정 필터 없이 전체 사용자 대상으로 집계합니다.
      </p>
    </div>

    <div class="callout-info">
      <div class="callout-title">동적 경로 정규화</div>
      <p>
        WebManager 탭에서 <code>/clients/ABC-001</code>과 같은 동적 경로는
        <code>/clients/:id</code>로 자동 정규화되어 집계됩니다.
        따라서 개별 클라이언트 상세 페이지 방문은 "Client Detail" 하나의 페이지로 통합됩니다.
      </p>
    </div>

  </div>
</template>
