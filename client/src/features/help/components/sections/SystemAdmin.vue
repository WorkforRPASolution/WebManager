<script setup>
import HelpImage from '../HelpImage.vue'
</script>

<template>
  <div class="help-prose">
    <h2>System 관리</h2>
    <p>System 메뉴는 애플리케이션 설정, 역할별 권한 관리, 시스템 로그 조회 기능을 제공합니다. Permissions와 System Logs는 Admin 전용 메뉴로, 일반 사용자에게는 표시되지 않습니다.</p>

    <!-- ───────────────────────────────── -->
    <!-- 1. Settings -->
    <!-- ───────────────────────────────── -->
    <h3>1. Settings (환경 설정)</h3>
    <p>Settings 페이지에서는 개인 환경 설정을 관리할 수 있습니다. 설정은 브라우저 단위로 저장되며, 다른 사용자에게 영향을 주지 않습니다.</p>

    <HelpImage name="settings" alt="Settings 페이지" caption="Settings 페이지 - 테마, 알림, 자동 새로고침 설정" />

    <h4>테마 전환 (Theme)</h4>
    <p>라이트 모드와 다크 모드를 전환합니다. 토글 스위치를 클릭하면 즉시 적용되며, 모든 페이지에 일괄 반영됩니다. 선택한 테마는 브라우저에 저장되어 다음 접속 시에도 유지됩니다.</p>

    <h4>알림 (Notifications)</h4>
    <p>시스템 알림 수신 여부를 설정합니다. 활성화하면 서비스 상태 변경, 배포 완료 등의 알림을 받을 수 있습니다.</p>

    <h4>자동 새로고침 (Auto Refresh)</h4>
    <p>활성화하면 Dashboard 등 실시간 데이터가 표시되는 페이지에서 30초 간격으로 자동 갱신됩니다. 비활성화 상태에서는 수동으로 새로고침해야 합니다.</p>

    <div class="callout-info">
      <div class="callout-title">참고</div>
      <p>Settings 변경은 즉시 적용되며 별도의 저장 버튼이 없습니다. 테마 설정은 <code>localStorage</code>에 저장되므로, 브라우저 데이터를 초기화하면 기본값으로 돌아갑니다.</p>
    </div>

    <!-- ───────────────────────────────── -->
    <!-- 2. Permissions -->
    <!-- ───────────────────────────────── -->
    <h3>2. Permissions (권한 관리) - Admin 전용</h3>
    <p>Permissions 페이지는 역할(Role)별로 메뉴 접근 권한과 기능 권한을 세밀하게 설정할 수 있는 관리 도구입니다. Admin 계정으로만 접근할 수 있으며, 변경사항은 모든 사용자에게 즉시 반영됩니다.</p>

    <HelpImage name="permissions" alt="Permissions 페이지" caption="Permissions 페이지 - Menu Permissions 탭과 역할별 권한 매트릭스" />

    <h4>2탭 구조</h4>
    <p>Permissions 페이지는 두 개의 탭으로 구성됩니다:</p>
    <ul>
      <li><strong>Menu Permissions</strong> - 메뉴 접근 권한 (페이지 표시 여부)</li>
      <li><strong>Feature Permissions</strong> - 기능 수행 권한 (조회/수정/삭제 가능 여부)</li>
    </ul>

    <h4>Menu Permissions 탭</h4>
    <HelpImage name="permissions" alt="Menu Permissions 탭" caption="Menu Permissions — 6그룹 20항목 역할별 체크박스 매트릭스" />
    <p>6개 그룹, 총 20개 항목으로 구성된 메뉴 접근 권한 매트릭스입니다:</p>
    <table>
      <thead>
        <tr>
          <th>그룹</th>
          <th>항목</th>
          <th>설명</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Dashboard</td>
          <td>Overview, ARSAgent Status/Version, ResourceAgent Status/Version</td>
          <td>대시보드 서브메뉴 접근</td>
        </tr>
        <tr>
          <td>Dashboard - Recovery</td>
          <td>Recovery Overview, By Process, Analysis</td>
          <td>Recovery 대시보드 접근</td>
        </tr>
        <tr>
          <td>Dashboard - User Activity</td>
          <td>User Activity</td>
          <td>사용자 활동 대시보드 접근</td>
        </tr>
        <tr>
          <td>Clients</td>
          <td>ARS Agent, Resource Agent</td>
          <td>클라이언트 관리 접근</td>
        </tr>
        <tr>
          <td>기준정보 관리</td>
          <td>Equipment Info, Email/Popup Template, Email Recipients/Info/Image, User Management</td>
          <td>기준정보 메뉴 접근 (7항목)</td>
        </tr>
        <tr>
          <td>System</td>
          <td>Alerts, Settings</td>
          <td>시스템 메뉴 접근</td>
        </tr>
      </tbody>
    </table>

    <h4>역할별 컬럼</h4>
    <p>각 항목은 4개 역할(Admin, Conductor, Manager, User)에 대해 개별적으로 ON/OFF 설정할 수 있습니다. Admin 역할은 항상 전체 권한이 부여되어 있으며 수정할 수 없습니다(비활성 상태로 표시).</p>

    <h4>Feature Permissions 탭</h4>
    <HelpImage name="permissions-feature" alt="Feature Permissions 탭" caption="Feature Permissions — R/W/D 토글 매트릭스 (Clients + 기준정보)" />
    <p>2개 그룹으로 구성된 기능 수행 권한 매트릭스입니다:</p>
    <ul>
      <li><strong>Clients</strong> - Client Control: Monitoring(조회) / Operations(제어) / Deploy(배포) 3단계</li>
      <li><strong>기준정보 관리</strong> - 각 기준정보(Equipment Info, Email Template 등 7항목): Read / Write / Delete 3단계</li>
    </ul>
    <p>예를 들어, User 역할에 Equipment Info의 Read만 허용하고 Write/Delete를 차단하면, 해당 역할의 사용자는 장비 정보를 조회만 할 수 있고 수정이나 삭제는 할 수 없습니다.</p>

    <h4>편의 기능</h4>
    <ul>
      <li><strong>그룹 접기/펼치기</strong> - 그룹 헤더를 클릭하면 해당 그룹의 항목을 접거나 펼칠 수 있습니다</li>
      <li><strong>All 토글</strong> - 그룹 헤더 행의 토글은 해당 그룹 전체를 일괄 ON/OFF합니다</li>
      <li><strong>변경 감지 (amber 강조)</strong> - 원래 값에서 변경된 셀은 amber(주황) 배경으로 강조 표시됩니다</li>
      <li><strong>Save Changes</strong> - 변경사항을 서버에 저장합니다 (변경 없으면 비활성)</li>
      <li><strong>Discard</strong> - 변경사항을 취소하고 저장된 상태로 되돌립니다</li>
    </ul>

    <div class="callout-danger">
      <div class="callout-title">경고: 권한 차단 주의</div>
      <p>Menu Permissions에서 특정 메뉴의 모든 역할을 OFF하면, Admin을 제외한 모든 사용자가 해당 메뉴에 접근할 수 없게 됩니다. 특히 Settings 메뉴를 차단하면 일반 사용자가 테마 설정 등을 변경할 수 없으므로 신중하게 설정하세요.</p>
    </div>

    <div class="callout-warning">
      <div class="callout-title">복구 방법</div>
      <p>권한을 잘못 설정하여 사용자들이 접근 차단된 경우, Admin 계정으로 로그인하여 Permissions 페이지에서 원래 설정으로 복구하세요. Admin 역할은 항상 모든 메뉴와 기능에 접근할 수 있으므로, Admin 계정이 차단되는 일은 발생하지 않습니다.</p>
    </div>

    <!-- ───────────────────────────────── -->
    <!-- 3. System Logs -->
    <!-- ───────────────────────────────── -->
    <h3>3. System Logs (시스템 로그) - Admin 전용</h3>
    <p>System Logs 페이지는 WebManager에서 발생하는 모든 시스템 이벤트를 조회하고 분석할 수 있는 관리 도구입니다. Logs 탭에서 개별 로그를 검색하고, Statistics 탭에서 전체 현황을 차트로 확인할 수 있습니다.</p>

    <HelpImage name="system-logs" alt="System Logs 페이지" caption="System Logs 페이지 - Logs 탭의 필터바와 로그 테이블" />

    <h4>Logs 탭</h4>
    <p>필터바를 사용하여 원하는 조건의 로그를 검색하고, 테이블에서 결과를 확인합니다.</p>

    <p><strong>필터 조건:</strong></p>
    <ul>
      <li><strong>Category</strong> - 로그 유형 선택 (All, audit, error, auth, batch, access, eqp-redis)</li>
      <li><strong>Period</strong> - 조회 기간 (Today, 7d, 30d, 90d, Custom)</li>
      <li><strong>User ID</strong> - 특정 사용자의 로그만 필터 (드롭다운 검색 지원)</li>
      <li><strong>Action</strong> - 특정 액션의 로그만 필터 (드롭다운 검색 지원)</li>
      <li><strong>Search</strong> - 자유 텍스트 검색 (로그 내용에서 키워드 검색)</li>
    </ul>

    <p><strong>로그 테이블:</strong></p>
    <p>검색 결과는 시간 역순(최신순)으로 정렬됩니다. 행을 클릭하면 상세 모달이 열리며, 해당 로그의 전체 정보를 확인할 수 있습니다. 상세 모달에는 변경 전/후 데이터, 요청 정보, 에러 상세 등이 포함됩니다.</p>
    <HelpImage name="system-logs-detail-modal" alt="로그 상세 모달" caption="Log Detail 모달 — 로그 행 클릭 시 카테고리, 사용자, 액션 등 상세 정보 표시" />

    <h4>카테고리별 의미</h4>
    <table>
      <thead>
        <tr>
          <th>카테고리</th>
          <th>설명</th>
          <th>보존 기간</th>
          <th>기록 내용 예시</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>audit</code></td>
          <td>데이터 변경 감사 로그</td>
          <td>2년</td>
          <td>장비 정보 수정, 사용자 생성/삭제, 권한 변경, Config 저장/배포</td>
        </tr>
        <tr>
          <td><code>auth</code></td>
          <td>인증 관련 로그</td>
          <td>1년</td>
          <td>로그인 성공/실패, 비밀번호 변경, 계정 잠금</td>
        </tr>
        <tr>
          <td><code>error</code></td>
          <td>시스템 오류 로그</td>
          <td>90일</td>
          <td>API 에러, FTP 연결 실패, RPC 타임아웃</td>
        </tr>
        <tr>
          <td><code>batch</code></td>
          <td>배치 작업 로그</td>
          <td>1년</td>
          <td>Recovery 집계 실행/완료, Cron 스케줄 결과</td>
        </tr>
        <tr>
          <td><code>access</code></td>
          <td>페이지 접근 로그</td>
          <td>90일</td>
          <td>사용자별 페이지 방문 기록 (User Activity 통계 원본)</td>
        </tr>
        <tr>
          <td><code>eqp-redis</code></td>
          <td>장비 Redis 동기화 로그</td>
          <td>90일</td>
          <td>Redis 키 변경, 장비 상태 동기화</td>
        </tr>
      </tbody>
    </table>

    <h4>Statistics 탭</h4>
    <HelpImage name="system-logs-statistics" alt="System Logs Statistics 탭" caption="Statistics 탭 — KPI 카드 + 카테고리 도넛 + 트렌드 차트" />
    <p>Statistics 탭은 시스템 로그를 시각적으로 분석할 수 있는 대시보드입니다. 기간을 선택하면 해당 기간의 통계가 표시됩니다.</p>
    <ul>
      <li><strong>KPI 카드</strong> - 총 로그 건수, 카테고리별 건수 등 핵심 지표</li>
      <li><strong>Category Trend</strong> - 시간대별(시간/일/주) 카테고리 분포 추이 (Stacked Bar)</li>
      <li><strong>Category 분포</strong> - 전체 카테고리 비율 (Donut 차트)</li>
      <li><strong>Top Errors</strong> - 가장 빈번한 에러 목록</li>
      <li><strong>Security</strong> - 인증 관련 이벤트 분석 (로그인 성공/실패 등)</li>
      <li><strong>Auth Breakdown</strong> - 인증 액션별 상세 분류</li>
      <li><strong>Batch Health</strong> - 배치 작업 성공/실패 현황</li>
      <li><strong>Top Users</strong> - 활동량 상위 사용자 (Vertical Bar)</li>
      <li><strong>Recent Audits</strong> - 최근 감사 로그 테이블</li>
    </ul>

    <div class="callout-info">
      <div class="callout-title">기간별 데이터 정밀도</div>
      <p>Category Trend 차트는 조회 기간에 따라 자동으로 단위가 변경됩니다: 최근 24시간은 시간별(hourly), 7~30일은 일별(daily), 90일은 주별(weekly)로 표시됩니다.</p>
    </div>

    <div class="callout-info">
      <div class="callout-title">보존 기간과 TTL</div>
      <p>각 카테고리별로 보존 기간이 다르며, MongoDB의 <code>expireAt</code> TTL 인덱스에 의해 자동 삭제됩니다. 보존 기간이 지난 로그는 조회되지 않으며, Custom 기간을 보존 기간 이상으로 설정해도 해당 기간의 데이터는 표시되지 않습니다.</p>
    </div>
  </div>
</template>
