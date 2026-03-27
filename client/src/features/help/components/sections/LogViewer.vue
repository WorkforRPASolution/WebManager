<script setup>
import HelpImage from '../HelpImage.vue'
</script>

<template>
  <div class="help-prose">
    <h2>Log Viewer</h2>
    <p>
      Log Viewer는 원격 클라이언트의 로그 파일을 조회하고 실시간으로 모니터링할 수 있는 기능입니다.
      클라이언트 목록에서 하나 이상의 클라이언트를 선택한 뒤 툴바의 <strong>Log</strong> 버튼을 클릭하면
      Log Viewer 모달이 열립니다.
    </p>
    <HelpImage name="log-viewer-modal" alt="Log Viewer 모달" caption="Log Viewer — 소스 선택 + 파일 목록 + 콘텐츠 영역" />

    <!-- ===== 모달 구조 ===== -->
    <h3>모달 구성</h3>
    <p>
      Log Viewer 모달은 드래그/리사이즈/최대화가 가능한 전체 기능 모달입니다.
      여러 클라이언트를 선택한 경우(멀티 모드), 좌측에 클라이언트 사이드바가 표시됩니다.
    </p>
    <ul>
      <li><strong>헤더</strong> : 현재 클라이언트 이름 표시, 최대화/닫기 버튼</li>
      <li><strong>클라이언트 사이드바</strong> (멀티 모드) : 선택한 클라이언트 목록, 상태 표시등(loaded/loading/error), 클릭으로 전환</li>
      <li><strong>소스 선택기</strong> : Log Settings에 정의된 로그 소스 중 하나를 선택</li>
      <li><strong>파일 목록</strong> : 선택한 소스 경로의 파일 목록 (상단 영역)</li>
      <li><strong>파일 내용</strong> : 선택한 파일의 내용 (하단 영역, 코드 뷰어)</li>
      <li><strong>검색 패널</strong> : 크로스 검색 기능 (하단)</li>
    </ul>

    <!-- ===== 파일 목록 ===== -->
    <h3>파일 목록</h3>
    <p>
      소스를 선택하면 원격으로 해당 경로의 파일 목록을 조회합니다.
      파일 목록은 이름, 크기, 수정일자 등의 정보를 표시합니다.
    </p>
    <ul>
      <li>파일을 클릭하면 하단 Content 영역에 파일 내용이 표시됩니다</li>
      <li>체크박스로 다중 파일을 선택하여 배치 작업(다운로드/삭제/Tailing)을 수행할 수 있습니다</li>
      <li>Refresh 버튼으로 파일 목록을 다시 로드합니다</li>
    </ul>

    <h4>파일 조작 버튼</h4>
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
          <td>Download</td>
          <td>파일 다운로드</td>
          <td>선택한 파일을 로컬 PC로 다운로드합니다</td>
        </tr>
        <tr>
          <td>Delete</td>
          <td>파일 삭제</td>
          <td>선택한 파일을 원격 서버에서 삭제합니다 (확인 필요, Delete 권한 필요)</td>
        </tr>
        <tr>
          <td>Tail</td>
          <td>실시간 Tailing</td>
          <td>선택한 파일을 실시간으로 모니터링합니다</td>
        </tr>
      </tbody>
    </table>

    <div class="callout-warning">
      <div class="callout-title">파일 삭제 주의</div>
      <p>
        파일 삭제는 원격 서버에서 실제로 파일을 제거합니다.
        삭제된 파일은 복구할 수 없으므로 신중하게 사용하세요.
        Delete 권한(Feature Permission)이 없으면 삭제 버튼이 비활성화됩니다.
      </p>
    </div>

    <!-- ===== 파일 내용 조회 ===== -->
    <h3>파일 내용 조회</h3>
    <p>
      파일을 클릭하면 Content 영역에 코드 뷰어(읽기 전용)로 파일 내용이 표시됩니다.
      열린 파일은 탭으로 관리되며, 여러 파일을 동시에 열어 탭을 전환할 수 있습니다.
    </p>
    <ul>
      <li>탭에 파일명이 표시되고, 탭의 <code>&times;</code> 버튼으로 닫을 수 있습니다</li>
      <li>멀티 모드에서는 탭에 <code>eqpId &gt; 파일명</code> 형식으로 표시되어 어느 클라이언트의 파일인지 구분됩니다</li>
      <li>Content 영역의 좌측 화살표를 클릭하면 영역을 접기/펼칠 수 있습니다</li>
      <li>Reload 버튼으로 현재 활성 탭의 파일 내용을 다시 읽어올 수 있습니다</li>
      <li>탭이 많아 화면을 초과하면 좌/우 스크롤 버튼이 나타납니다</li>
    </ul>

    <!-- ===== 실시간 Tailing ===== -->
    <h3>실시간 Tailing</h3>
    <p>
      실시간 Tailing은 로그 파일에 새로운 내용이 추가될 때마다 자동으로 수신하여 화면에 표시하는 기능입니다.
      실시간 스트리밍 방식으로 동작하며, 원격 파일의 변경 사항을 실시간으로 전달받습니다.
    </p>

    <h4>Tailing 시작 방법</h4>
    <ol>
      <li>파일 목록에서 모니터링할 파일을 체크박스로 선택합니다</li>
      <li><strong>Tail</strong> 버튼을 클릭합니다</li>
      <li>Tail 탭이 자동으로 생성되고, 녹색 펄스 아이콘이 실시간 수신 중임을 표시합니다</li>
    </ol>

    <h4>Tailing 제어</h4>
    <table>
      <thead>
        <tr>
          <th>기능</th>
          <th>설명</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>자동 스크롤</td>
          <td>새로운 로그가 추가되면 자동으로 하단으로 스크롤됩니다. 위로 스크롤하면 자동 스크롤이 일시 중지되고, 하단 버튼을 클릭하면 다시 활성화됩니다.</td>
        </tr>
        <tr>
          <td>Clear</td>
          <td>현재까지 수신된 로그 버퍼를 비웁니다. 수신은 계속 진행됩니다.</td>
        </tr>
        <tr>
          <td>Stop</td>
          <td>Tailing을 중지하고 실시간 스트리밍 연결을 종료합니다. 탭은 유지됩니다.</td>
        </tr>
        <tr>
          <td>탭 닫기</td>
          <td>Tail 탭의 <code>&times;</code> 버튼으로 Tailing을 중지하고 탭을 제거합니다.</td>
        </tr>
      </tbody>
    </table>

    <div class="callout-info">
      <div class="callout-title">버퍼 한계</div>
      <p>
        실시간 Tailing 시 메모리 보호를 위해 일정 줄 수(기본 10,000줄)를 초과하면
        오래된 줄이 자동으로 잘립니다. 화면 상단에 truncated 경고가 표시됩니다.
      </p>
    </div>

    <div class="callout-info">
      <div class="callout-title">에러 표시</div>
      <p>
        Tailing 중 연결 오류가 발생하면 Tail 탭에 에러 메시지가 표시됩니다.
        파일이 존재하지 않거나, 원격 연결 장애 등의 상황에서 발생할 수 있습니다.
      </p>
    </div>

    <!-- ===== 크로스 검색 ===== -->
    <h3>크로스 검색 (Cross Search)</h3>
    <p>
      모달 하단의 Search 패널에서 크로스 검색을 수행할 수 있습니다.
      크로스 검색은 현재 열린 모든 파일 탭의 내용에서 키워드를 검색하여 결과를 보여줍니다.
    </p>
    <ul>
      <li>검색어를 입력하고 Enter 또는 검색 버튼을 클릭합니다</li>
      <li>각 파일별로 매칭된 줄 수와 내용이 표시됩니다</li>
      <li>결과를 클릭하면 해당 파일 탭의 해당 위치로 이동합니다</li>
      <li>Search 패널은 접기/펼치기가 가능하며, 하단 구분선을 드래그하여 높이를 조절할 수 있습니다</li>
    </ul>

    <!-- ===== 멀티 클라이언트 모드 ===== -->
    <h3>멀티 클라이언트 모드</h3>
    <HelpImage name="log-viewer-multi" alt="Log Viewer 멀티 클라이언트 모드" caption="멀티 클라이언트 — 좌측 클라이언트 사이드바 + 상태 표시" />
    <p>
      두 개 이상의 클라이언트를 선택하여 Log Viewer를 열면 멀티 클라이언트 모드가 활성화됩니다.
    </p>
    <ul>
      <li>좌측 사이드바에 선택한 클라이언트 목록이 표시됩니다</li>
      <li>각 클라이언트 옆에 상태 표시등이 있어 로딩/완료/에러 상태를 확인할 수 있습니다</li>
      <li>클라이언트를 클릭하면 해당 클라이언트의 파일 목록으로 전환됩니다</li>
      <li>서로 다른 클라이언트의 파일을 동시에 열어 탭으로 비교할 수 있습니다</li>
      <li>여러 클라이언트의 로그를 동시에 Tailing하여 문제를 추적할 수 있습니다</li>
    </ul>

    <!-- ===== Log Settings ===== -->
    <h3>Log Settings (Admin 전용)</h3>
    <p>
      클라이언트 페이지 상단 우측의 <strong>Log</strong> 설정 버튼(Admin 전용)을 클릭하면
      Log Settings 모달이 열립니다. 여기서 로그 소스를 정의합니다.
    </p>
    <ul>
      <li><strong>소스 이름</strong> : Log Viewer에서 표시될 이름 (예: "Application Log", "Error Log")</li>
      <li><strong>경로</strong> : 로그 파일이 위치한 디렉토리 경로</li>
      <li><strong>파일 패턴</strong> : 파일 목록 조회 시 필터링할 패턴 (예: <code>*.log</code>)</li>
    </ul>
    <p>
      Agent 그룹(ARS Agent / Resource Agent)별로 별도의 로그 소스 설정이 관리됩니다.
    </p>

    <div class="callout-info">
      <div class="callout-title">에이전트 설치 경로 자동 감지</div>
      <p>
        클라이언트의 에이전트 설치 경로가 설정되어 있으면 로그 소스 경로가 자동으로 해석됩니다.
        설치 경로는 Client Detail 페이지에서 자동 감지하거나 수동으로 설정할 수 있습니다.
      </p>
    </div>
  </div>
</template>
