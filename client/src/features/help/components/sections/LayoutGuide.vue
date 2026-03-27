<script setup>
import HelpImage from '../HelpImage.vue'
</script>

<template>
  <div class="help-prose">
    <h2>화면 레이아웃</h2>
    <p>
      WebManager는 상단 헤더, 좌측 사이드바, 메인 콘텐츠, 하단 탭 바의
      4개 영역으로 구성된 레이아웃을 사용합니다.
      이 섹션에서는 각 영역의 역할과 사용 방법을 안내합니다.
    </p>

    <!-- 1. 전체 화면 구성 -->
    <h3>전체 화면 구성</h3>
    <HelpImage name="layout-full" alt="WebManager 전체 레이아웃" caption="전체 화면 구성 — 상단 헤더 + 좌측 사이드바 + 메인 콘텐츠 + 하단 탭 바" />
    <p>
      WebManager에 로그인하면 아래와 같은 구조의 화면이 표시됩니다.
    </p>

    <pre><code>┌──────────────────────────────────────────────────┐
│                  상단 헤더 (h-14)                  │
│  [로고]  [Dashboard] [Clients] [기준정보] [System] │  ... [테마] [알림] [?] [사용자]
├──────────┬───────────────────────────────────────┤
│          │                                       │
│  사이드바  │            메인 콘텐츠 영역             │
│  (w-64)  │         (선택한 페이지 표시)              │
│          │                                       │
│  - 메뉴1  │                                       │
│  - 메뉴2  │                                       │
│  - 메뉴3  │                                       │
│          │                                       │
├──────────┴───────────────────────────────────────┤
│              하단 탭 바 (h-10)                     │
│  [ Overview ] [ Client List ] [ Equipment Info ]  │
└──────────────────────────────────────────────────┘</code></pre>

    <table>
      <thead>
        <tr>
          <th>영역</th>
          <th>크기</th>
          <th>역할</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>상단 헤더</td>
          <td>높이 56px</td>
          <td>로고, 메가 메뉴, 테마 토글, 알림, 도움말, 사용자 메뉴</td>
        </tr>
        <tr>
          <td>좌측 사이드바</td>
          <td>펼침 256px / 접힘 64px</td>
          <td>현재 선택된 MainMenu의 서브메뉴 목록</td>
        </tr>
        <tr>
          <td>메인 콘텐츠</td>
          <td>나머지 전체 영역</td>
          <td>선택한 페이지의 실제 내용 표시</td>
        </tr>
        <tr>
          <td>하단 탭 바</td>
          <td>높이 40px</td>
          <td>열린 페이지들을 탭 형태로 관리</td>
        </tr>
      </tbody>
    </table>

    <HelpImage name="dashboard-overview" alt="WebManager 전체 레이아웃" caption="로그인 후 기본 화면 (Dashboard Overview)" />

    <!-- 2. 상단 헤더 -->
    <h3>상단 헤더</h3>
    <p>
      화면 최상단의 파란색 헤더 바에는 다음 요소들이 배치되어 있습니다.
    </p>

    <h4>좌측 영역</h4>
    <ul>
      <li><strong>로고</strong> — WebManager 로고와 애플리케이션 이름이 표시됩니다.</li>
      <li><strong>메가 메뉴 (상단 드롭다운 내비게이션)</strong> — Dashboard, Clients, 기준정보 관리, System, Help 등 최상위 메뉴 버튼이 나열됩니다. 클릭하거나 마우스를 올리면 하위 메뉴가 드롭다운으로 표시됩니다.</li>
    </ul>

    <h4>우측 영역</h4>
    <ul>
      <li>
        <strong>테마 토글</strong> — 해/달 아이콘 버튼을 클릭하면 라이트 모드와 다크 모드를 전환합니다.
      </li>
      <li>
        <strong>알림 버튼</strong> — 종 모양 아이콘 버튼입니다. 읽지 않은 알림이 있으면 빨간 점이 표시됩니다.
      </li>
      <li>
        <strong>도움말 버튼</strong> — <strong>?</strong> 아이콘을 클릭하면 현재 보고 계신 이 도움말 페이지로 이동합니다.
      </li>
      <li>
        <strong>사용자 메뉴</strong> — 이니셜이 표시된 원형 버튼입니다. 마우스를 올리면 이름, 역할 배지(Admin/Conductor/Manager/User), 마지막 로그인 시각, 로그아웃 버튼이 드롭다운으로 나타납니다.
      </li>
    </ul>

    <!-- 3. 메가 메뉴 -->
    <h3>메가 메뉴</h3>
    <HelpImage name="layout-megamenu-open" alt="메가 메뉴 드롭다운" caption="메가 메뉴 — Dashboard 호버 시 서브메뉴 드롭다운 표시" />
    <p>
      헤더의 메인 메뉴 버튼에 마우스를 올리면 해당 카테고리의 서브메뉴가 드롭다운으로 표시됩니다.
      각 서브메뉴 항목에는 아이콘과 라벨이 함께 표시되어 기능을 직관적으로 파악할 수 있습니다.
    </p>

    <h4>메뉴 구조</h4>
    <table>
      <thead>
        <tr>
          <th>MainMenu</th>
          <th>서브메뉴</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Dashboard</strong></td>
          <td>Overview, ARSAgent Status, ARSAgent Version, ResourceAgent Status, ResourceAgent Version, Recovery Overview, Recovery by Process, Recovery Analysis, User Activity</td>
        </tr>
        <tr>
          <td><strong>Clients</strong></td>
          <td>Client List (+ 동적 Client Detail)</td>
        </tr>
        <tr>
          <td><strong>기준정보 관리</strong></td>
          <td>Equipment Info, Email Template, User Management</td>
        </tr>
        <tr>
          <td><strong>System</strong></td>
          <td>Settings, Permissions (Admin 전용), Alerts History</td>
        </tr>
        <tr>
          <td><strong>Help</strong></td>
          <td>User Manual (이 페이지)</td>
        </tr>
      </tbody>
    </table>

    <div class="callout-info">
      <div class="callout-title">권한에 따른 메뉴 표시</div>
      <p>
        사용자의 역할과 권한 설정에 따라 메가 메뉴에 표시되는 항목이 달라집니다.
        예를 들어 Permissions 메뉴는 Admin 역할에게만 표시됩니다.
        접근 권한이 없는 서브메뉴는 메가 메뉴와 사이드바 모두에서 숨겨집니다.
      </p>
    </div>

    <!-- 4. 좌측 사이드바 -->
    <h3>좌측 사이드바</h3>
    <HelpImage name="layout-sidebar-collapsed" alt="사이드바 접힌 상태" caption="사이드바 접힌 상태 — 아이콘만 표시, 콘텐츠 영역 확장" />
    <p>
      좌측 사이드바는 현재 선택된 MainMenu의 서브메뉴 목록을 표시합니다.
      예를 들어 헤더에서 <em>Dashboard</em>를 선택하면 사이드바에
      Overview, ARSAgent Status, Recovery Overview 등의 서브메뉴가 나열됩니다.
    </p>

    <h4>접기 / 펼치기</h4>
    <ul>
      <li>사이드바 상단의 <strong>화살표 버튼</strong>(<code>&lt;</code>)을 클릭하면 사이드바가 접힙니다 (256px → 64px).</li>
      <li>접힌 상태에서는 아이콘만 표시되며, 아이콘에 마우스를 올리면 메뉴 이름이 툴팁으로 표시됩니다.</li>
      <li>다시 화살표 버튼을 클릭하면 원래 크기로 펼쳐집니다.</li>
      <li>좁은 모니터를 사용할 때 사이드바를 접으면 메인 콘텐츠 영역을 더 넓게 활용할 수 있습니다.</li>
    </ul>

    <h4>활성 메뉴 표시</h4>
    <p>
      현재 보고 있는 페이지에 해당하는 서브메뉴 항목은 파란색 배경으로 강조 표시됩니다.
      다른 서브메뉴를 클릭하면 해당 페이지로 이동하며, 하단 탭 바에 새 탭이 추가됩니다.
    </p>

    <h4>메뉴 타이틀</h4>
    <p>
      사이드바 상단에는 현재 선택된 MainMenu의 이름이 작은 대문자 라벨로 표시됩니다
      (예: <code>DASHBOARD</code>, <code>CLIENTS</code>).
      사이드바를 접으면 이 라벨은 숨겨집니다.
    </p>

    <!-- 5. 하단 탭 바 -->
    <h3>하단 탭 바</h3>
    <p>
      화면 하단의 탭 바는 현재 열려 있는 페이지들을 탭 형태로 관리합니다.
      웹 브라우저의 탭과 유사한 방식으로 여러 페이지를 동시에 열어두고 전환할 수 있습니다.
    </p>

    <h4>기본 동작</h4>
    <ul>
      <li><strong>탭 생성</strong> — 사이드바나 메가 메뉴에서 메뉴를 클릭하면 하단에 새 탭이 추가됩니다.</li>
      <li><strong>탭 전환</strong> — 탭을 클릭하면 해당 페이지로 즉시 전환됩니다. 사이드바의 활성 메뉴도 자동으로 변경됩니다.</li>
      <li><strong>탭 닫기</strong> — 탭의 <strong>X</strong> 버튼을 클릭하면 해당 탭이 닫힙니다. 활성 탭을 닫으면 인접한 다른 탭이 자동 활성화됩니다.</li>
      <li><strong>중복 방지</strong> — 이미 열려 있는 페이지를 다시 선택하면 새 탭이 생기지 않고 기존 탭이 활성화됩니다.</li>
    </ul>

    <h4>탭 표시</h4>
    <ul>
      <li>활성 탭은 흰색 배경(라이트 모드) 또는 어두운 배경(다크 모드)으로 강조되며, 파란색 텍스트가 적용됩니다.</li>
      <li>비활성 탭은 회색 텍스트로 표시됩니다.</li>
      <li>탭이 많아져 영역을 초과하면 수평 스크롤이 가능합니다.</li>
    </ul>

    <div class="callout-info">
      <div class="callout-title">탭 없는 상태</div>
      <p>
        모든 탭을 닫으면 메인 콘텐츠 영역에 "사이드바에서 메뉴를 선택하세요" 안내 메시지가 표시됩니다.
        사이드바나 메가 메뉴에서 원하는 페이지를 선택하면 다시 탭이 생성됩니다.
      </p>
    </div>

    <!-- 6. 다크/라이트 모드 -->
    <h3>다크 / 라이트 모드</h3>
    <p>
      WebManager는 라이트 모드와 다크 모드를 모두 지원합니다.
      사용자의 눈 피로도와 작업 환경에 맞게 선택하세요.
    </p>

    <h4>전환 방법</h4>
    <ol>
      <li>상단 헤더 우측의 <strong>해/달 아이콘</strong> 버튼을 클릭합니다.</li>
      <li>현재 라이트 모드면 달 아이콘(다크 전환), 다크 모드면 해 아이콘(라이트 전환)이 표시됩니다.</li>
      <li>클릭 즉시 전체 UI가 선택한 테마로 전환됩니다.</li>
    </ol>

    <h4>특징</h4>
    <ul>
      <li><strong>설정 유지</strong> — 선택한 테마는 브라우저에 자동 저장되어, 새로고침하거나 재접속해도 유지됩니다.</li>
      <li><strong>전체 UI 적용</strong> — 헤더, 사이드바, 탭 바, 메인 콘텐츠, 모달, 차트, 데이터 테이블 등 모든 UI 요소에 테마가 일괄 적용됩니다.</li>
      <li><strong>차트 색상 자동 조정</strong> — Dashboard의 차트도 테마에 맞게 배경, 텍스트, 그리드 색상이 자동 변경됩니다.</li>
    </ul>

    <!-- 7. 공통 UI 요소 -->
    <h3>공통 UI 요소</h3>
    <p>
      WebManager의 여러 페이지에서 반복적으로 사용되는 공통 UI 패턴을 소개합니다.
    </p>

    <h4>필터 바</h4>
    <p>
      목록 페이지 상단에 표시되는 필터 영역으로, 조건을 지정하여 데이터를 검색할 수 있습니다.
    </p>
    <ul>
      <li><strong>접기/펼치기</strong> — 필터 바 우측의 토글 버튼으로 필터 영역을 접거나 펼칠 수 있습니다. 접으면 콘텐츠 영역이 넓어집니다.</li>
      <li><strong>초기화</strong> — 필터 조건을 기본값으로 되돌리는 버튼이 제공됩니다.</li>
      <li><strong>기간 선택</strong> — Dashboard 페이지에서는 프리셋 기간(오늘/7일/30일/90일/1년) 또는 커스텀 기간을 선택할 수 있으며, 좌우 화살표로 기간을 이동할 수 있습니다.</li>
    </ul>

    <h4>데이터 테이블 도구모음</h4>
    <p>
      데이터 목록 페이지(Equipment Info, User Management 등)의 상단에 표시되는 도구모음입니다.
    </p>
    <ul>
      <li><strong>추가</strong> — 새로운 행을 추가합니다.</li>
      <li><strong>삭제</strong> — 선택한 행을 삭제합니다 (체크박스로 선택).</li>
      <li><strong>저장</strong> — 변경된 내용을 서버에 저장합니다. 변경사항이 있을 때만 활성화됩니다.</li>
      <li><strong>취소</strong> — 저장하지 않은 변경사항을 되돌립니다.</li>
      <li>일부 페이지에서는 <strong>CSV 내보내기</strong>, <strong>정렬</strong> 등 추가 버튼이 제공됩니다.</li>
    </ul>

    <h4>페이지네이션</h4>
    <p>
      데이터가 많은 목록에서는 페이지네이션이 적용됩니다.
      하단에 표시되는 페이지 번호를 클릭하거나, 이전/다음 버튼으로 페이지를 이동합니다.
      페이지당 표시 건수를 변경할 수 있는 페이지도 있습니다.
    </p>

    <h4>Toast 알림</h4>
    <p>
      작업 결과를 화면 우측 상단에 잠깐 나타나는 토스트 메시지로 알려줍니다.
    </p>
    <table>
      <thead>
        <tr>
          <th>종류</th>
          <th>색상</th>
          <th>사용 예시</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>성공 (Success)</td>
          <td>초록색</td>
          <td>저장 완료, 삭제 완료</td>
        </tr>
        <tr>
          <td>오류 (Error)</td>
          <td>빨간색</td>
          <td>저장 실패, 네트워크 오류</td>
        </tr>
        <tr>
          <td>경고 (Warning)</td>
          <td>노란색</td>
          <td>유효성 검사 실패, 권한 부족</td>
        </tr>
        <tr>
          <td>정보 (Info)</td>
          <td>파란색</td>
          <td>작업 진행 중, 참고 안내</td>
        </tr>
      </tbody>
    </table>

    <h4>모달 (팝업)</h4>
    <p>
      상세 정보 확인, 편집, 확인 대화 상자 등에 모달이 사용됩니다.
    </p>
    <ul>
      <li><strong>드래그</strong> — 모달 상단 타이틀 바를 드래그하여 위치를 이동할 수 있습니다.</li>
      <li><strong>리사이즈</strong> — 모달 테두리를 드래그하여 크기를 조절할 수 있습니다.</li>
      <li><strong>최대화</strong> — 모달 우측 상단의 최대화 버튼을 클릭하면 전체 화면으로 확장됩니다. 다시 클릭하면 원래 크기로 복원됩니다.</li>
      <li><strong>닫기</strong> — X 버튼 또는 <code>ESC</code> 키로 모달을 닫을 수 있습니다.</li>
      <li>저장하지 않은 변경사항이 있을 때 닫기를 시도하면 확인 대화 상자가 표시됩니다.</li>
    </ul>

    <div class="callout-warning">
      <div class="callout-title">모달에서의 변경사항</div>
      <p>
        Config 편집, 템플릿 편집 등 모달에서 수정한 내용은 반드시 저장 버튼을 눌러야 서버에 반영됩니다.
        모달을 닫거나 페이지를 이동하면 저장하지 않은 변경사항은 사라집니다.
      </p>
    </div>
  </div>
</template>
