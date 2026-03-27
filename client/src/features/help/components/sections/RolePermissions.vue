<script setup>
import HelpImage from '../HelpImage.vue'
</script>

<template>
  <div class="help-prose">
    <h2>역할별 기능 요약</h2>
    <p>
      WebManager는 4단계 역할 기반 접근 제어(RBAC)를 사용합니다.
      각 역할은 접근 가능한 메뉴와 기능이 다르며, Admin이 <strong>System &gt; Permissions</strong> 페이지에서
      세부 권한을 조정할 수 있습니다.
    </p>

    <HelpImage name="permissions" alt="Menu Permissions 매트릭스" caption="Permissions 페이지 — Menu Permissions 탭 (역할별 메뉴 접근 권한)" />
    <HelpImage name="permissions-feature" alt="Feature Permissions 매트릭스" caption="Permissions 페이지 — Feature Permissions 탭 (R/W/D 세분화)" />

    <!-- ===== 역할 개요 ===== -->
    <h3>역할 개요</h3>
    <table>
      <thead>
        <tr>
          <th>역할</th>
          <th>레벨</th>
          <th>설명</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Admin</strong></td>
          <td>1</td>
          <td>시스템 전체 관리자. 모든 기능에 접근 가능하며, 권한 설정 및 시스템 관리 기능을 독점합니다.</td>
        </tr>
        <tr>
          <td><strong>Conductor</strong></td>
          <td>2</td>
          <td>운영 관리자. Dashboard, Clients, 기준정보 관리 등 대부분의 운영 기능에 접근할 수 있습니다.</td>
        </tr>
        <tr>
          <td><strong>Manager</strong></td>
          <td>3</td>
          <td>중간 관리자. Conductor와 유사하나 일부 기능이 제한될 수 있습니다.</td>
        </tr>
        <tr>
          <td><strong>User</strong></td>
          <td>4</td>
          <td>일반 사용자. 기본 조회 기능과 Feature Permission에 따른 제한된 기능을 사용합니다.</td>
        </tr>
      </tbody>
    </table>

    <!-- ===== 메뉴 접근 권한 매트릭스 ===== -->
    <h3>메뉴 접근 권한</h3>
    <p>
      아래 표는 각 역할이 접근할 수 있는 메뉴를 나타냅니다.
      Menu Permissions에서 Admin이 조정할 수 있는 항목은 <strong>설정에 따라</strong> 표시되어 있습니다.
    </p>

    <table>
      <thead>
        <tr>
          <th>메뉴 그룹</th>
          <th>메뉴 항목</th>
          <th>Admin</th>
          <th>Conductor</th>
          <th>Manager</th>
          <th>User</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td rowspan="9"><strong>Dashboard</strong></td>
          <td>Overview</td>
          <td>&#x2705;</td>
          <td>&#x2705;</td>
          <td>&#x2705;</td>
          <td>&#x2705;</td>
        </tr>
        <tr>
          <td>ARSAgent Status</td>
          <td>&#x2705;</td>
          <td>&#x2705;</td>
          <td>&#x2705;</td>
          <td>&#x2705;</td>
        </tr>
        <tr>
          <td>ARSAgent Version</td>
          <td>&#x2705;</td>
          <td>&#x2705;</td>
          <td>&#x2705;</td>
          <td>&#x2705;</td>
        </tr>
        <tr>
          <td>ResourceAgent Status</td>
          <td>&#x2705;</td>
          <td>&#x2705;</td>
          <td>&#x2705;</td>
          <td>&#x2705;</td>
        </tr>
        <tr>
          <td>ResourceAgent Version</td>
          <td>&#x2705;</td>
          <td>&#x2705;</td>
          <td>&#x2705;</td>
          <td>&#x2705;</td>
        </tr>
        <tr>
          <td>Recovery Overview</td>
          <td>&#x2705;</td>
          <td>&#x2705;</td>
          <td>&#x2705;</td>
          <td>&#x2705;</td>
        </tr>
        <tr>
          <td>Recovery by Process</td>
          <td>&#x2705;</td>
          <td>&#x2705;</td>
          <td>&#x2705;</td>
          <td>&#x2705;</td>
        </tr>
        <tr>
          <td>Recovery Analysis</td>
          <td>&#x2705;</td>
          <td>&#x2705;</td>
          <td>&#x2705;</td>
          <td>&#x2705;</td>
        </tr>
        <tr>
          <td>User Activity</td>
          <td>&#x2705;</td>
          <td>&#x2705;</td>
          <td>&#x2705;</td>
          <td>&#x2705;</td>
        </tr>
        <tr>
          <td rowspan="2"><strong>Clients</strong></td>
          <td>ARS Agent</td>
          <td>&#x2705;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
        </tr>
        <tr>
          <td>Resource Agent</td>
          <td>&#x2705;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
        </tr>
        <tr>
          <td rowspan="5"><strong>기준정보 관리</strong></td>
          <td>Equipment Info</td>
          <td>&#x2705;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
        </tr>
        <tr>
          <td>Email Template</td>
          <td>&#x2705;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
        </tr>
        <tr>
          <td>Popup Template</td>
          <td>&#x2705;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
        </tr>
        <tr>
          <td>Email Info/Recipients</td>
          <td>&#x2705;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
        </tr>
        <tr>
          <td>User Management</td>
          <td>&#x2705;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
        </tr>
        <tr>
          <td rowspan="4"><strong>System</strong></td>
          <td>Settings</td>
          <td>&#x2705;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
        </tr>
        <tr>
          <td>Permissions</td>
          <td>&#x2705;</td>
          <td>&#x274C;</td>
          <td>&#x274C;</td>
          <td>&#x274C;</td>
        </tr>
        <tr>
          <td>System Logs</td>
          <td>&#x2705;</td>
          <td>&#x274C;</td>
          <td>&#x274C;</td>
          <td>&#x274C;</td>
        </tr>
        <tr>
          <td>Alerts History</td>
          <td>&#x2705;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
        </tr>
      </tbody>
    </table>

    <p>
      <strong>범례:</strong>
      &#x2705; 항상 접근 가능 &nbsp;|&nbsp;
      &#x274C; 접근 불가 (Admin 독점) &nbsp;|&nbsp;
      &#x2699;&#xFE0F; 설정에 따라 (Menu Permissions에서 조정 가능)
    </p>

    <!-- ===== Feature Permissions ===== -->
    <h3>Feature Permissions (기능 권한)</h3>
    <p>
      메뉴 접근과 별개로, 각 기능 내에서의 세부 권한을 Feature Permissions로 관리합니다.
      각 기능은 <strong>Read</strong>(조회), <strong>Write</strong>(생성/수정), <strong>Delete</strong>(삭제) 3단계 권한으로 나뉩니다.
    </p>

    <table>
      <thead>
        <tr>
          <th>기능 그룹</th>
          <th>기능 (Feature)</th>
          <th>Admin</th>
          <th>Conductor</th>
          <th>Manager</th>
          <th>User</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td rowspan="3"><strong>Client 관리</strong></td>
          <td>clientControl - Read</td>
          <td>&#x2705;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
        </tr>
        <tr>
          <td>clientControl - Write</td>
          <td>&#x2705;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
        </tr>
        <tr>
          <td>clientControl - Delete</td>
          <td>&#x2705;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
        </tr>
        <tr>
          <td rowspan="3"><strong>Equipment Info</strong></td>
          <td>equipmentInfo - Read</td>
          <td>&#x2705;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
        </tr>
        <tr>
          <td>equipmentInfo - Write</td>
          <td>&#x2705;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
        </tr>
        <tr>
          <td>equipmentInfo - Delete</td>
          <td>&#x2705;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
        </tr>
        <tr>
          <td rowspan="3"><strong>User Management</strong></td>
          <td>users - Read</td>
          <td>&#x2705;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
        </tr>
        <tr>
          <td>users - Write</td>
          <td>&#x2705;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
        </tr>
        <tr>
          <td>users - Delete</td>
          <td>&#x2705;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
          <td>&#x2699;&#xFE0F;</td>
        </tr>
      </tbody>
    </table>

    <p>
      <strong>범례:</strong>
      &#x2705; 항상 허용 (Admin 고정) &nbsp;|&nbsp;
      &#x2699;&#xFE0F; Admin이 Permissions 페이지에서 역할별로 설정 가능
    </p>

    <div class="callout-info">
      <div class="callout-title">Feature Permission의 효과</div>
      <p>
        Feature Permission은 UI 버튼 활성화/비활성화뿐만 아니라, 서버 API에서도 검증됩니다.
        예를 들어 Write 권한이 없는 역할은 서비스 시작/중지 API 호출이 차단됩니다.
      </p>
    </div>

    <!-- ===== Admin 독점 기능 ===== -->
    <h3>Admin 독점 기능</h3>
    <p>
      다음 기능은 Admin(역할=1)만 사용할 수 있으며, 다른 역할에게 위임할 수 없습니다.
    </p>
    <table>
      <thead>
        <tr>
          <th>기능</th>
          <th>설명</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Permissions 페이지</strong></td>
          <td>Menu Permissions 및 Feature Permissions를 관리하는 전체 권한 설정 페이지</td>
        </tr>
        <tr>
          <td><strong>System Logs</strong></td>
          <td>Audit 로그, Batch 실행 로그 등 시스템 전체 로그 조회</td>
        </tr>
        <tr>
          <td><strong>Batch History</strong></td>
          <td>Recovery Summary 배치 실행 이력 및 히트맵 조회</td>
        </tr>
        <tr>
          <td><strong>OS List 관리</strong></td>
          <td>Equipment Info의 OS Version 드롭다운 목록 관리</td>
        </tr>
        <tr>
          <td><strong>Config/Log/Update Settings</strong></td>
          <td>클라이언트 Config, Log, Update 관련 설정 모달</td>
        </tr>
        <tr>
          <td><strong>Feature Permissions 버튼</strong></td>
          <td>각 페이지의 Feature Permissions 설정 대화상자</td>
        </tr>
        <tr>
          <td><strong>회원가입 승인</strong></td>
          <td>pending_approval 상태 사용자의 계정 승인</td>
        </tr>
        <tr>
          <td><strong>비밀번호 재설정 승인</strong></td>
          <td>password_reset_requested 상태 사용자의 임시 비밀번호 발급</td>
        </tr>
      </tbody>
    </table>

    <!-- ===== Permissions 페이지 ===== -->
    <h3>Permissions 페이지 사용법</h3>
    <p>
      <strong>System &gt; Permissions</strong> 메뉴에서 접근합니다 (Admin 전용).
      2개 탭으로 구성됩니다.
    </p>

    <h4>Menu Permissions 탭</h4>
    <p>
      역할별 메뉴 접근 권한을 매트릭스 형태로 관리합니다.
    </p>
    <ul>
      <li>6개 메뉴 그룹(Dashboard, Clients, 기준정보 등)의 20개 항목을 매트릭스로 표시합니다</li>
      <li>각 항목의 체크박스를 토글하여 역할별 접근을 허용/차단합니다</li>
      <li>그룹 헤더를 클릭하면 해당 그룹을 접거나 펼 수 있습니다</li>
      <li>그룹 헤더의 "All" 토글로 해당 그룹 전체를 일괄 허용/차단합니다</li>
      <li><strong>Admin 열은 비활성화</strong>되어 있으며 항상 모든 항목에 접근 가능합니다</li>
      <li>변경된 셀은 amber(주황) 색상으로 강조됩니다</li>
    </ul>

    <h4>Feature Permissions 탭</h4>
    <p>
      기능별 Read/Write/Delete 권한을 역할 매트릭스로 관리합니다.
    </p>
    <ul>
      <li>2개 기능 그룹(Client 관리, 기준정보)의 8개 기능 항목이 표시됩니다</li>
      <li>각 기능에 대해 R(Read), W(Write), D(Delete) 3개 체크박스가 역할별로 표시됩니다</li>
      <li>Admin 열은 비활성화(항상 전체 권한)이며, 나머지 역할의 권한을 조정합니다</li>
    </ul>

    <h4>저장/취소</h4>
    <ul>
      <li><strong>Save</strong> : 변경 사항을 서버에 저장합니다. 저장 즉시 모든 사용자의 메뉴/기능 접근에 반영됩니다.</li>
      <li><strong>Discard</strong> : 저장하지 않은 변경 사항을 모두 되돌립니다.</li>
    </ul>

    <div class="callout-warning">
      <div class="callout-title">권한 변경 즉시 반영</div>
      <p>
        Permissions 변경을 저장하면 현재 로그인된 모든 사용자의 메뉴와 기능 접근에 즉시 반영됩니다.
        중요한 메뉴를 실수로 차단하지 않도록 주의하세요.
      </p>
    </div>

    <div class="callout-info">
      <div class="callout-title">각 페이지의 Feature Permissions 버튼</div>
      <p>
        Permissions 페이지 외에도, 각 관리 페이지(Clients, Equipment Info, Users 등)의 상단에
        "Feature Permissions" 버튼이 있습니다(Admin 전용).
        이 버튼을 클릭하면 해당 기능의 R/W/D 권한만 빠르게 조정할 수 있는 다이얼로그가 열립니다.
      </p>
    </div>

    <!-- ===== 공정 기반 필터링 ===== -->
    <h3>공정(Process) 기반 데이터 필터링</h3>
    <p>
      역할 권한과 별개로, 각 사용자에게 할당된 <strong>담당 공정(processes)</strong>에 따라
      조회할 수 있는 데이터가 자동으로 필터링됩니다.
    </p>
    <ul>
      <li>사용자에게 "ETCH", "PHOTO" 공정이 할당되어 있으면, 클라이언트/장비 조회 시 해당 공정의 데이터만 표시됩니다</li>
      <li>Admin은 공정 제한 없이 전체 데이터를 조회할 수 있습니다</li>
      <li>담당 공정은 User Management 페이지에서 설정합니다</li>
    </ul>
  </div>
</template>
