<script setup>
import HelpImage from '../HelpImage.vue'
</script>

<template>
  <div class="help-prose">
    <h2>시작하기</h2>
    <p>
      이 매뉴얼은 WebManager의 주요 기능과 사용 방법을 안내합니다.
      처음 사용하시는 분부터 관리자까지, 역할에 맞는 내용을 빠르게 찾아보실 수 있습니다.
    </p>

    <!-- 1. 이 매뉴얼에 대하여 -->
    <h3>이 매뉴얼에 대하여</h3>
    <p>
      <strong>WebManager</strong>는 반도체/디스플레이 공장의 장비(Equipment)에 설치된
      자동화 소프트웨어(Agent)를 원격으로 모니터링하고 관리하는 웹 애플리케이션입니다.
      장비 상태 확인, 설정 파일 관리, 소프트웨어 배포, 로그 조회, 자동 복구(Recovery) 분석 등
      운영에 필요한 기능을 한 곳에서 제공합니다.
    </p>

    <div class="callout-info">
      <div class="callout-title">용어 안내</div>
      <p>이 매뉴얼에서 자주 사용되는 용어를 먼저 안내합니다.</p>
      <ul>
        <li><strong>Agent (에이전트)</strong>: 각 장비에 설치되어 자동화 작업을 수행하는 소프트웨어. ARSAgent(자동 복구)와 ResourceAgent(리소스 모니터링) 두 종류가 있습니다.</li>
        <li><strong>EARS</strong>: Equipment Automation &amp; Recovery System의 약자. WebManager가 연결하는 전체 자동화 시스템의 이름입니다.</li>
        <li><strong>Process (공정)</strong>: 공정 단위 (예: CVD, PHOTO). 장비와 사용자는 공정별로 그룹화됩니다.</li>
        <li><strong>Model (장비 모델)</strong>: 공정 내에서 장비 유형을 구분하는 단위. 동일 모델의 장비들은 대체적으로 같은 UI, Agent Config 설정을 공유하며, 횡전개 시 배포 범위의 기준이 됩니다.</li>
        <li><strong>Config (설정 파일)</strong>: Agent의 동작을 제어하는 JSON 형식 설정 파일.</li>
        <li><strong>Recovery (자동 조작)</strong>: 장비에 자동 조작 트리거가 발생했을 때 미리 정의된 시나리오에 따라 자동으로 장비를 조작하는 기능.</li>
        <li><strong>횡전개 (Deploy)</strong>: 하나의 장비 설정을 동일 모델의 다른 장비들에 일괄 배포하는 것.</li>
      </ul>
    </div>

    <h4>주요 기능 요약</h4>
    <table>
      <thead>
        <tr>
          <th>영역</th>
          <th>설명</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Dashboard</strong></td>
          <td>시스템 전체 현황, Agent 상태/버전, Recovery 분석, 사용자 활동 통계</td>
        </tr>
        <tr>
          <td><strong>Clients</strong></td>
          <td>클라이언트 목록 조회, 서비스 제어, Config 편집/횡전개/비교, 로그 조회/Tailing, 소프트웨어 업데이트</td>
        </tr>
        <tr>
          <td><strong>기준정보 관리</strong></td>
          <td>장비 정보, Email/Popup 템플릿, 이메일 수신자, 사용자 관리 등</td>
        </tr>
        <tr>
          <td><strong>System</strong></td>
          <td>시스템 설정, 역할별 권한 관리, 시스템 로그 조회</td>
        </tr>
      </tbody>
    </table>

    <h4>사용자 역할</h4>
    <p>
      WebManager에는 <strong>Admin</strong>, <strong>Conductor</strong>, <strong>Manager</strong>, <strong>User</strong> 4개의 역할이 존재하며,
      역할에 따른 메뉴 접근 권한은 관리자가 설정합니다.
    </p>

    <div class="callout-info">
      <div class="callout-title">역할별 메뉴 접근</div>
      <p>
        본인의 역할로 접근할 수 없는 메뉴는 사이드바와 메가 메뉴에서 자동으로 숨겨집니다.
        보이지 않는 메뉴가 있다면 관리자에게 역할 변경을 요청하세요.
      </p>
    </div>

    <!-- 2. 브라우저 요구사항 -->
    <h3>브라우저 요구사항</h3>
    <p>
      WebManager는 최신 웹 표준을 사용합니다. 원활한 사용을 위해 아래 환경을 권장합니다.
    </p>

    <h4>지원 브라우저</h4>
    <table>
      <thead>
        <tr>
          <th>브라우저</th>
          <th>최소 버전</th>
          <th>권장 버전</th>
          <th>비고</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Google Chrome</td>
          <td>90+</td>
          <td>최신 버전</td>
          <td>가장 권장하는 브라우저</td>
        </tr>
        <tr>
          <td>Microsoft Edge</td>
          <td>90+</td>
          <td>최신 버전</td>
          <td>Chromium 기반, Chrome과 동일 수준 지원</td>
        </tr>
        <tr>
          <td>Mozilla Firefox</td>
          <td>90+</td>
          <td>최신 버전</td>
          <td>대부분의 기능 지원</td>
        </tr>
      </tbody>
    </table>

    <h4>화면 해상도</h4>
    <ul>
      <li><strong>최소 해상도</strong>: 1280 x 720 (HD)</li>
      <li><strong>권장 해상도</strong>: 1920 x 1080 (Full HD) 이상</li>
      <li>사이드바 접기/펼치기를 활용하면 좁은 화면에서도 콘텐츠 영역을 넓게 사용할 수 있습니다.</li>
    </ul>

    <div class="callout-warning">
      <div class="callout-title">Internet Explorer 미지원</div>
      <p>
        Internet Explorer(IE)는 지원하지 않습니다. IE에서 접속하면 레이아웃이 정상적으로 표시되지 않을 수 있습니다.
        반드시 위 목록의 브라우저를 사용해 주세요.
      </p>
    </div>

    <!-- 3. 접속 방법 -->
    <h3>접속 방법</h3>
    <p>
      관리자로부터 안내받은 WebManager URL을 브라우저 주소창에 입력하면 접속할 수 있습니다.
    </p>

    <ol class="step-list">
      <li>
        <span class="step-number">1</span>
        <span>
          브라우저 주소창에 WebManager URL을 입력합니다
          (예: <code>http://서버주소:포트</code>).
        </span>
      </li>
      <li>
        <span class="step-number">2</span>
        <span>
          <strong>EARS 인트로 애니메이션</strong>이 재생됩니다.
          화면을 클릭하거나 애니메이션이 끝나면 로그인 화면으로 전환됩니다.
          이전에 방문한 적이 있으면 인트로가 축약되어 빠르게 넘어갑니다.
        </span>
      </li>
      <li>
        <span class="step-number">3</span>
        <span>
          <strong>로그인 화면</strong>에서 User ID와 비밀번호를 입력하고 로그인합니다.
          계정이 없는 경우 하단의 <em>Sign Up</em> 링크에서 회원가입을 진행합니다.
        </span>
      </li>
      <li>
        <span class="step-number">4</span>
        <span>
          로그인에 성공하면 Dashboard Overview 화면으로 이동합니다.
          관리자가 계정을 승인하지 않은 상태라면 권한이 제한된 화면이 표시될 수 있습니다.
        </span>
      </li>
    </ol>

    <div class="callout-info">
      <div class="callout-title">비밀번호를 잊으셨나요?</div>
      <p>
        로그인 화면의 <em>비밀번호 찾기</em> 링크를 통해 재설정할 수 있습니다.
        관리자에게 문의하거나 이메일 인증으로 재설정할 수 있습니다.
        자세한 내용은 <em>계정 관리</em> 섹션을 참고하세요.
      </p>
    </div>

    <!-- 4. 매뉴얼 사용법 -->
    <h3>매뉴얼 사용법</h3>
    <HelpImage name="help-manual" alt="User Manual 페이지" caption="User Manual — 좌측 TOC + 검색 + 우측 콘텐츠 2단 레이아웃" />
    <p>
      이 매뉴얼은 WebManager 내에 내장된 도움말 페이지로, 다음과 같은 방법으로 탐색할 수 있습니다.
    </p>

    <h4>좌측 목차(TOC) 탐색</h4>
    <p>
      화면 좌측에 챕터별로 정리된 목차가 표시됩니다.
      챕터를 클릭하면 하위 섹션이 펼쳐지며, 원하는 섹션을 선택하면 해당 내용으로 이동합니다.
      현재 읽고 있는 섹션은 파란색으로 강조 표시됩니다.
    </p>

    <h4>검색 기능</h4>
    <p>
      목차 상단의 검색창에 키워드를 입력하면 관련 섹션을 즉시 찾을 수 있습니다.
      한국어와 영어 키워드 모두 검색 가능합니다
      (예: "Recovery", "비밀번호", "Config", "로그").
    </p>

    <h4>이전/다음 버튼</h4>
    <p>
      각 섹션 하단에 <em>이전</em>/<em>다음</em> 내비게이션 버튼이 있습니다.
      순서대로 읽고 싶을 때 버튼을 클릭하면 인접 섹션으로 이동합니다.
    </p>

    <h4>이미지 확대</h4>
    <p>
      매뉴얼 내 스크린샷 이미지를 클릭하면 원본 크기로 확대됩니다.
      다시 클릭하면 축소됩니다.
      다크 모드/라이트 모드에 따라 해당 테마에 맞는 스크린샷이 자동으로 표시됩니다.
    </p>

    <h4>도움말 페이지 접근</h4>
    <p>
      언제든 상단 헤더 우측의 <strong>?</strong> 버튼을 클릭하면 이 도움말 페이지로 이동할 수 있습니다.
      또는 상단 메가 메뉴에서 <em>Help</em>를 선택해도 동일합니다.
    </p>

    <div class="callout-info">
      <div class="callout-title">매뉴얼 표기 안내</div>
      <p>
        이 매뉴얼에서 사용하는 안내 상자의 의미는 다음과 같습니다.
        파란색 상자는 참고 정보, 노란색 상자는 주의사항, 빨간색 상자는 위험/제한 사항을 나타냅니다.
      </p>
    </div>
  </div>
</template>
