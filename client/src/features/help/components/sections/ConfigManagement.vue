<script setup>
import HelpImage from '../HelpImage.vue'
</script>

<template>
  <div class="help-prose">
    <h2>Config 관리</h2>
    <p>
      Config 관리 기능은 클라이언트(ARSAgent/ResourceAgent)의 설정 파일을 원격으로 조회, 편집, 배포, 비교할 수 있는 통합 도구입니다.
      모든 Config 파일은 원격으로 클라이언트 서버에서 직접 읽고 쓰며, 저장 시 자동으로 백업이 생성됩니다.
    </p>

    <div class="callout-info">
      <div class="callout-title">필수 권한</div>
      <p>
        Config 관리 기능은 <strong>clientControl</strong> Feature Permission에 의해 제어됩니다.
        읽기(Read) 권한이 있으면 Config 조회가 가능하고, 쓰기(Write) 권한이 있어야 편집/저장/배포가 가능합니다.
        Config Settings(Admin 전용)에서 Config 파일 경로와 이름이 사전 설정되어 있어야 합니다.
      </p>
    </div>

    <!-- ============================================================ -->
    <!-- 1. Config Manager 모달 -->
    <!-- ============================================================ -->
    <h3>1. Config Manager 모달</h3>
    <HelpImage name="config-manager-modal" alt="Config Manager 모달" caption="Config Manager — 헤더(클라이언트명) + 툴바(Diff/Format/Discard/Backup/Save/Deploy) + 에디터 영역" />
    <p>
      Config Manager는 클라이언트의 설정 파일을 직접 열어 확인하고 편집할 수 있는 모달 창입니다.
      원격으로 클라이언트 서버의 실제 파일을 읽어오며, 수정 후 저장하면 다시 업로드됩니다.
    </p>

    <h4>1.1 Config Manager 열기</h4>
    <ol>
      <li>클라이언트 목록 페이지(<strong>Clients &gt; Client List</strong> 또는 <strong>Clients &gt; Resource Agent</strong>)에서 필터를 설정하고 <strong>Search</strong>를 클릭합니다.</li>
      <li>그리드에서 Config를 확인할 클라이언트를 <strong>1개 이상 선택</strong>합니다 (체크박스).</li>
      <li>툴바의 <strong>Config</strong> 버튼을 클릭합니다.</li>
      <li>원격으로 Config 파일을 로딩한 후 Config Manager 모달이 열립니다.</li>
    </ol>

    <HelpImage name="clients-list-data" alt="클라이언트 목록" caption="Figure 1: 클라이언트 목록에서 선택 후 Config 버튼 클릭" />

    <div class="callout-info">
      <div class="callout-title">멀티 클라이언트 모드</div>
      <p>
        2개 이상의 클라이언트를 선택하고 Config를 열면 <strong>멀티 클라이언트 모드</strong>로 동작합니다.
        모달 좌측에 클라이언트 목록 사이드바가 표시되며, 클라이언트를 클릭하여 전환할 수 있습니다.
        각 클라이언트의 로딩 상태(초록: 완료, 파랑 점멸: 로딩 중, 빨강: 오류)와
        변경 여부(주황 점)가 사이드바에 표시됩니다.
      </p>
    </div>

    <h4>1.2 Config 파일 탭</h4>
    <p>
      Config Manager 상단에는 Config 파일별 탭이 표시됩니다. Admin이 Config Settings에서 설정한 파일 목록에 따라 달라지며,
      일반적으로 다음과 같은 4개 탭이 제공됩니다:
    </p>
    <table>
      <thead>
        <tr>
          <th>탭 이름</th>
          <th>설명</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>ARSAgent</strong></td>
          <td>ARSAgent 핵심 설정 (서버 연결, CronTab, 트리거/소스 활성화 등) — 상세: <strong>Config: ARSAgent 폼</strong> 섹션</td>
        </tr>
        <tr>
          <td><strong>Monitor</strong></td>
          <td>ResourceAgent 시스템 모니터링 Collector 설정 — 상세: <strong>Config: Monitor 폼</strong> 섹션</td>
        </tr>
        <tr>
          <td><strong>AccessLog</strong></td>
          <td>로그 수집 소스 정의 + 5가지 테스트 — 상세: <strong>Config: AccessLog 폼 / 테스트</strong> 섹션</td>
        </tr>
        <tr>
          <td><strong>Trigger</strong></td>
          <td>로그 패턴 기반 이벤트 감지 규칙 + 패턴 매칭 테스트 — 상세: <strong>Config: Trigger 폼 / 테스트</strong> 섹션</td>
        </tr>
      </tbody>
    </table>
    <p>
      탭 이름 우측에 표시되는 아이콘은 파일 상태를 나타냅니다:
    </p>
    <ul>
      <li><strong>주황 점</strong> - 편집되었지만 아직 저장하지 않은 변경사항이 있음</li>
      <li><strong>빨간 점</strong> - 파일 로딩 중 오류 발생 (원격 연결 실패 등)</li>
      <li><strong>주황 경고 아이콘</strong> - 서버에 파일이 존재하지 않음 (새 파일로 생성 가능)</li>
    </ul>

    <h4>1.3 Form 뷰 vs Raw JSON 뷰</h4>
    <p>
      Config Manager는 두 가지 편집 모드를 제공합니다. 탭 우측의 <strong>Form / JSON</strong> 토글 버튼으로 전환할 수 있습니다.
    </p>

    <h5>Form 뷰</h5>
    <ul>
      <li>JSON 키-값을 구조화된 입력 폼으로 표시합니다.</li>
      <li>각 필드에 대한 라벨, 설명, 유효성 검사가 제공됩니다.</li>
      <li>JSON 문법을 몰라도 직관적으로 설정을 변경할 수 있습니다.</li>
      <li>우측에 <strong>JSON Preview</strong> 패널이 함께 표시되어 실시간으로 JSON 결과를 확인할 수 있습니다. Preview 패널은 구분선 드래그로 크기 조절이 가능하며, X 버튼으로 숨기거나 코드 아이콘 버튼으로 다시 표시할 수 있습니다.</li>
      <li>Form 뷰에서는 Diff 뷰를 사용할 수 없습니다.</li>
    </ul>

    <h5>Raw JSON 뷰</h5>
    <ul>
      <li>코드 에디터 (VS Code와 동일한 편집기)로 JSON 파일을 직접 편집합니다.</li>
      <li>구문 강조, 자동 완성, 오류 표시가 지원됩니다.</li>
      <li>하단 상태 바에서 JSON 유효성 상태를 확인할 수 있습니다 (초록 체크: 정상, 빨간 X: 오류 위치 표시).</li>
      <li><strong>Format</strong> 버튼으로 JSON을 자동 정렬(prettify)할 수 있습니다.</li>
      <li><strong>Diff</strong> 버튼으로 변경 전/후를 나란히 비교하는 Diff 뷰로 전환할 수 있습니다.</li>
    </ul>

    <div class="callout-info">
      <div class="callout-title">Form 뷰 지원 범위</div>
      <p>
        Form 뷰는 시스템이 인식하는 Config 파일 유형에서만 사용 가능합니다.
        인식되지 않는 파일의 경우 Form/JSON 토글 버튼이 표시되지 않으며, Raw JSON 뷰만 사용할 수 있습니다.
      </p>
    </div>

    <h4>1.4 변경 감지</h4>
    <p>
      Config Manager는 파일별로 변경 사항을 실시간 추적합니다:
    </p>
    <ul>
      <li>변경된 파일의 탭에 <strong>주황색 점(amber dot)</strong>이 표시됩니다.</li>
      <li>하단 상태 바에 <strong>Modified</strong> (수정됨) 또는 <strong>Saved</strong> (저장됨) 상태가 표시됩니다.</li>
      <li>변경사항이 있는 상태에서 모달을 닫으려 하면 저장하지 않은 변경사항 유실에 대한 경고가 표시됩니다.</li>
      <li>멀티 클라이언트 모드에서는 각 클라이언트 사이드바 항목에도 주황 점이 표시되어, 어느 클라이언트에 미저장 변경이 있는지 한눈에 파악할 수 있습니다.</li>
    </ul>

    <h4>1.5 Config 저장</h4>
    <p>
      Config 파일을 편집한 후 저장하는 방법:
    </p>
    <ol>
      <li>파일 내용을 수정합니다 (Form 뷰 또는 JSON 뷰).</li>
      <li>JSON 형식이 올바른지 확인합니다 (하단 상태 바의 JSON 유효성 표시 확인).</li>
      <li>툴바의 <strong>Save</strong> 버튼을 클릭합니다.</li>
      <li>원격으로 클라이언트 서버에 파일이 업로드됩니다.</li>
      <li>저장 전 기존 파일은 <strong>자동으로 백업</strong>이 생성됩니다.</li>
    </ol>

    <div class="callout-warning">
      <div class="callout-title">JSON 유효성 검사</div>
      <p>
        JSON 형식이 올바르지 않으면(구문 오류) Save 버튼이 비활성화됩니다.
        하단 상태 바에 오류 위치(줄 번호, 열 번호)가 표시되므로, 해당 위치를 확인하여 수정하세요.
      </p>
    </div>

    <h4>1.6 변경 취소 (Discard)</h4>
    <p>
      편집한 내용을 취소하고 마지막 저장된 버전으로 되돌리려면:
    </p>
    <ol>
      <li>툴바의 <strong>Discard</strong> 버튼을 클릭합니다.</li>
      <li>현재 탭의 편집 내용이 마지막 저장된(또는 최초 로딩된) 내용으로 즉시 복원됩니다.</li>
    </ol>

    <h4>1.7 Diff 뷰</h4>
    <p>
      Raw JSON 모드에서 <strong>Diff</strong> 버튼을 클릭하면 변경 전(좌측)과 변경 후(우측)를 나란히 비교하는 뷰가 표시됩니다.
      코드 에디터의 비교 기능을 사용하여 추가/삭제/변경된 줄이 색상으로 구분됩니다.
      Diff 뷰 상태에서도 우측(Modified) 패널에서 직접 편집이 가능합니다(Write 권한이 있는 경우).
    </p>

    <!-- ============================================================ -->
    <!-- 2. Config 횡전개 (Deploy) -->
    <!-- ============================================================ -->
    <h3>2. Config 횡전개 (Deploy)</h3>
    <p>
      Config 횡전개는 하나의 클라이언트(Source)의 Config를 동일 모델의 다른 클라이언트들(Target)에 일괄 배포하는 기능입니다.
      동일한 EqpModel을 가진 클라이언트들에게만 배포할 수 있습니다.
    </p>

    <div class="callout-danger">
      <div class="callout-title">핵심 주의사항: 배포 대상은 마지막 저장 버전</div>
      <p>
        배포는 현재 편집 중인 내용이 아닌 <strong>마지막으로 저장된 버전</strong>으로 실행됩니다.
        편집 중인 내용을 배포하려면 반드시 <strong>먼저 Save를 클릭하여 저장</strong>한 후 배포를 실행하세요.
        미저장 변경이 있는 상태에서 Deploy 패널을 열면 상단에 주황색 경고 메시지가 표시됩니다.
      </p>
    </div>

    <h4>2.1 Deploy 패널 열기</h4>
    <ol>
      <li>Config Manager 모달에서 배포할 Config 파일 탭을 선택합니다.</li>
      <li>툴바의 보라색 <strong>Deploy</strong> 버튼을 클릭합니다.</li>
      <li>모달 우측에 Deploy Config 패널이 슬라이드로 표시됩니다.</li>
    </ol>

    <h4>2.2 Deploy 패널 구성</h4>
    <p>Deploy 패널은 다음 항목으로 구성됩니다:</p>

    <h5>Source (소스 클라이언트)</h5>
    <p>
      현재 Config Manager에서 활성화된 클라이언트의 eqpId와 Config 파일명이 표시됩니다.
      이 클라이언트의 마지막 저장 버전이 배포의 원본이 됩니다.
    </p>

    <h5>Deploy Mode (배포 모드)</h5>
    <p>두 가지 배포 모드를 선택할 수 있습니다:</p>
    <table>
      <thead>
        <tr>
          <th>모드</th>
          <th>설명</th>
          <th>사용 시점</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Full file</strong></td>
          <td>소스 파일 전체를 대상 클라이언트에 덮어씁니다.</td>
          <td>전체 Config를 동일하게 맞추고 싶을 때</td>
        </tr>
        <tr>
          <td><strong>Selected keys only</strong></td>
          <td>JSON에서 선택한 키만 대상 클라이언트의 기존 Config에 병합(merge)합니다.</td>
          <td>특정 설정값만 일괄 변경하고 나머지는 유지하고 싶을 때</td>
        </tr>
      </tbody>
    </table>

    <h5>JSON 키 트리 선택 (Selected keys only 모드)</h5>
    <p>
      Selected keys only 모드를 선택하면 JSON 키 트리가 표시됩니다.
      배포할 키를 체크박스로 선택합니다. 부모 키를 선택하면 하위 키도 모두 포함됩니다.
      최소 1개 이상의 키를 선택해야 배포를 실행할 수 있습니다.
    </p>

    <h5>Targets (배포 대상)</h5>
    <p>
      소스 클라이언트와 동일한 EqpModel을 가진 다른 클라이언트 목록이 자동으로 로딩됩니다.
      각 클라이언트의 eqpId와 IP 주소가 표시됩니다.
    </p>
    <ul>
      <li><strong>Select All</strong> 체크박스로 전체 선택/해제가 가능합니다.</li>
      <li>개별 클라이언트를 체크박스로 선택/해제할 수 있습니다.</li>
      <li>멀티 클라이언트 모드에서는 Config Manager에서 함께 선택된 클라이언트들이 자동으로 사전 선택됩니다.</li>
      <li><strong>Refresh</strong> 링크를 클릭하면 대상 목록을 다시 로딩합니다.</li>
    </ul>

    <h4>2.3 횡전개 실행 절차</h4>
    <ol>
      <li>배포할 Config 파일 탭이 선택되어 있는지 확인합니다.</li>
      <li>배포 모드를 선택합니다 (<strong>Full file</strong> 또는 <strong>Selected keys only</strong>).</li>
      <li>Selected keys only인 경우, 배포할 키를 트리에서 선택합니다.</li>
      <li>배포 대상 클라이언트를 선택합니다.</li>
      <li>패널 하단의 <strong>Execute Deploy</strong> 버튼을 클릭합니다.</li>
      <li>실시간으로 진행률이 표시됩니다.</li>
    </ol>

    <h4>2.4 배포 진행률 및 결과</h4>
    <p>
      배포가 시작되면 Deploy 패널 하단에 진행 상황이 실시간으로 표시됩니다:
    </p>
    <ul>
      <li><strong>프로그레스 바</strong> - 전체 진행률 (완료/전체 건수)</li>
      <li><strong>개별 결과</strong> - 각 클라이언트별 성공(OK, 초록)/실패(빨강) 상태</li>
      <li><strong>최종 요약</strong> - 배포 완료 후 성공/실패 건수 표시</li>
    </ul>
    <p>
      배포 중에는 Execute Deploy 버튼이 비활성화되며 "Deploying..." 상태가 표시됩니다.
      각 대상 클라이언트에 배포 전 자동으로 백업이 생성되므로, 문제 발생 시 해당 클라이언트의 Config Manager에서 백업 복원이 가능합니다.
    </p>

    <div class="callout-warning">
      <div class="callout-title">배포 실패 시</div>
      <p>
        원격 연결 오류, 파일 쓰기 권한 부족 등으로 일부 클라이언트에 배포가 실패할 수 있습니다.
        실패한 클라이언트는 개별 결과에 빨간색으로 오류 메시지가 표시됩니다.
        성공한 클라이언트는 정상 적용되었으므로, 실패한 클라이언트만 별도로 확인하세요.
      </p>
    </div>

    <!-- ============================================================ -->
    <!-- 3. Config 비교 (Compare) -->
    <!-- ============================================================ -->
    <h3>3. Config 비교 (Compare)</h3>
    <HelpImage name="config-compare-modal" alt="Config Compare 매트릭스 뷰" caption="Config Compare — N-way 매트릭스 뷰 (Baseline 설정 + Diff Only + Search keys)" />
    <p>
      Config 비교는 여러 클라이언트의 Config 파일을 N-way 매트릭스 형태로 나란히 비교하는 기능입니다.
      최소 2개, 최대 25개 클라이언트를 동시에 비교할 수 있습니다.
    </p>

    <h4>3.1 Config Compare 열기</h4>
    <ol>
      <li>클라이언트 목록에서 비교할 클라이언트를 <strong>2개 이상</strong> 선택합니다.</li>
      <li>툴바의 <strong>Compare</strong> 버튼을 클릭합니다.</li>
      <li>각 클라이언트의 Config를 병렬로 로딩합니다. 로딩 화면에서 각 클라이언트별 로딩 상태를 실시간으로 확인할 수 있습니다.</li>
      <li>로딩이 완료되면 매트릭스 비교 뷰가 표시됩니다.</li>
    </ol>

    <div class="callout-info">
      <div class="callout-title">비교 대상 제한</div>
      <p>
        클라이언트를 1개만 선택하면 Compare 버튼이 비활성화됩니다. 반드시 2개 이상을 선택하세요.
        25개를 초과하여 선택하면 경고 메시지가 표시되며, 비교가 실행되지 않습니다.
      </p>
    </div>

    <h4>3.2 매트릭스 뷰 구성</h4>
    <p>
      Config Compare 모달은 테이블 형태의 매트릭스 뷰로 구성됩니다:
    </p>
    <ul>
      <li><strong>행(Row)</strong> - JSON의 각 키 경로 (계층 구조로 들여쓰기 표시)</li>
      <li><strong>열(Column)</strong> - 각 클라이언트의 eqpId (헤더에 표시)</li>
      <li><strong>셀(Cell)</strong> - 해당 클라이언트의 해당 키 값</li>
    </ul>

    <h5>파일 탭</h5>
    <p>
      모달 상단에 Config 파일별 탭이 표시됩니다. 탭을 클릭하여 비교할 파일을 전환할 수 있습니다.
    </p>

    <h4>3.3 Baseline 설정</h4>
    <p>
      툴바의 <strong>Baseline</strong> 드롭다운에서 기준 클라이언트를 선택합니다.
      Baseline으로 설정된 클라이언트의 열 헤더에 별표 마크가 표시되며, 해당 열은 강조색으로 표시됩니다.
      다른 클라이언트의 값은 Baseline과 비교하여 차이점이 색상으로 표시됩니다.
    </p>

    <h4>3.4 Diff 색상 규칙</h4>
    <table>
      <thead>
        <tr>
          <th>색상</th>
          <th>의미</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>주황 배경 (amber)</strong></td>
          <td>Baseline과 값이 다름 (값이 존재하지만 내용이 다른 경우)</td>
        </tr>
        <tr>
          <td><strong>빨강 배경 (red)</strong></td>
          <td>해당 클라이언트에 키가 존재하지 않음 (<code>(missing)</code>으로 표시)</td>
        </tr>
        <tr>
          <td><strong>색상 없음</strong></td>
          <td>Baseline과 값이 동일함</td>
        </tr>
      </tbody>
    </table>

    <h4>3.5 필터링 및 탐색 도구</h4>
    <p>
      비교 결과가 많을 경우 다음 도구를 활용하여 원하는 정보를 빠르게 찾을 수 있습니다:
    </p>

    <h5>Diff Only 토글</h5>
    <p>
      <strong>Diff Only</strong> 체크박스를 활성화하면 Baseline과 다른 키만 필터링하여 표시합니다.
      모든 클라이언트에서 값이 동일한 키는 숨겨지므로, 차이점만 빠르게 파악할 수 있습니다.
      차이가 없으면 "No differences found" 메시지가 표시됩니다.
    </p>

    <h5>키 검색</h5>
    <p>
      툴바의 <strong>Search keys...</strong> 입력란에 키 이름을 입력하면 해당 키만 필터링됩니다.
      검색은 입력 후 300ms 디바운스로 적용되며, 부분 일치도 지원됩니다.
    </p>

    <h5>섹션 접기/펼치기</h5>
    <ul>
      <li>JSON 객체(중괄호) 또는 배열(대괄호)에 해당하는 행 좌측의 <strong>화살표</strong>를 클릭하면 하위 키를 접거나 펼칩니다.</li>
      <li>접힌 상태에서는 객체는 <code>&#123;...&#125;</code>, 배열은 <code>[N]</code>으로 표시됩니다.</li>
      <li>툴바의 <strong>Expand All</strong> / <strong>Collapse All</strong> 버튼으로 전체를 일괄 펼치거나 접을 수 있습니다.</li>
    </ul>

    <h4>3.6 로딩 실패 클라이언트</h4>
    <p>
      원격 연결 오류 등으로 일부 클라이언트의 Config 로딩이 실패할 경우,
      매트릭스 상단에 빨간색 배너로 실패한 클라이언트 ID가 표시됩니다.
      성공적으로 로딩된 클라이언트들만 매트릭스에 포함됩니다.
    </p>

    <h4>3.7 모달 조작</h4>
    <ul>
      <li><strong>드래그</strong> - 모달 헤더를 드래그하여 위치를 이동할 수 있습니다.</li>
      <li><strong>리사이즈</strong> - 모달 우하단 모서리를 드래그하여 크기를 조절할 수 있습니다.</li>
      <li><strong>최대화/복원</strong> - 헤더 우측의 최대화 버튼을 클릭하거나, 헤더를 더블클릭하여 전환합니다.</li>
    </ul>

    <!-- ============================================================ -->
    <!-- 4. Config 백업 -->
    <!-- ============================================================ -->
    <h3>4. Config 백업</h3>
    <p>
      Config 백업 시스템은 설정 파일의 변경 이력을 자동으로 보관하여, 문제 발생 시 이전 버전으로 복원할 수 있게 합니다.
    </p>

    <h4>4.1 자동 백업 생성 시점</h4>
    <p>백업은 다음 상황에서 <strong>자동으로</strong> 생성됩니다:</p>
    <ul>
      <li><strong>Config 저장 시</strong> - Config Manager에서 Save 버튼으로 파일을 저장할 때, 저장 직전의 기존 파일이 백업됩니다.</li>
      <li><strong>횡전개 배포 시</strong> - Deploy로 대상 클라이언트에 Config를 배포할 때, 각 대상 클라이언트의 기존 파일이 백업됩니다.</li>
    </ul>
    <p>
      백업 파일은 클라이언트 서버에 타임스탬프 형식(<code>YYYYMMDD_HHmmss</code>)의 이름으로 저장됩니다.
      사용자가 별도로 백업을 생성할 필요 없이, 저장/배포 시 자동으로 처리됩니다.
    </p>

    <h4>4.2 백업 목록 조회</h4>
    <ol>
      <li>Config Manager 모달에서 백업을 확인할 Config 파일 탭을 선택합니다.</li>
      <li>툴바의 <strong>Backup</strong> 버튼 (시계 아이콘)을 클릭합니다.</li>
      <li>드롭다운에 백업 목록이 표시됩니다. 각 항목에는 백업 날짜/시간과 파일 크기가 표시됩니다.</li>
    </ol>

    <h4>4.3 백업 복원</h4>
    <ol>
      <li>Backup 드롭다운에서 복원할 백업을 클릭합니다.</li>
      <li>선택한 백업의 내용이 현재 에디터에 로딩됩니다.</li>
      <li>내용을 확인한 후 <strong>Save</strong> 버튼을 클릭하여 저장합니다.</li>
    </ol>

    <div class="callout-warning">
      <div class="callout-title">백업 복원은 즉시 반영되지 않음</div>
      <p>
        백업을 선택하면 에디터에 해당 내용이 로딩될 뿐, 서버에 자동으로 저장되지는 않습니다.
        반드시 <strong>Save</strong> 버튼을 눌러야 실제 Config 파일에 반영됩니다.
        이때도 저장 전 현재 파일의 백업이 자동 생성되므로, 복원 전 상태로도 다시 돌아갈 수 있습니다.
      </p>
    </div>

    <!-- ============================================================ -->
    <!-- 전체 워크플로우 요약 -->
    <!-- ============================================================ -->
    <h3>5. 일반적인 Config 관리 워크플로우</h3>

    <h4>5.1 단일 클라이언트 설정 변경</h4>
    <ol>
      <li>클라이언트 목록에서 대상 클라이언트 1개 선택</li>
      <li><strong>Config</strong> 버튼 클릭하여 Config Manager 열기</li>
      <li>변경할 Config 파일 탭 선택</li>
      <li>Form 뷰 또는 JSON 뷰에서 내용 수정</li>
      <li>(선택) Diff 뷰로 변경사항 확인</li>
      <li><strong>Save</strong> 클릭하여 저장 (자동 백업 생성)</li>
    </ol>

    <h4>5.2 동일 모델 클라이언트 일괄 설정 배포</h4>
    <ol>
      <li>클라이언트 목록에서 소스 클라이언트 1개 선택</li>
      <li><strong>Config</strong> 버튼 클릭하여 Config Manager 열기</li>
      <li>배포할 Config 파일 탭 선택 및 내용 수정</li>
      <li><strong>Save</strong> 클릭하여 먼저 저장</li>
      <li><strong>Deploy</strong> 버튼 클릭하여 Deploy 패널 열기</li>
      <li>배포 모드 선택 (Full file / Selected keys only)</li>
      <li>대상 클라이언트 선택</li>
      <li><strong>Execute Deploy</strong> 클릭하여 배포 실행</li>
      <li>실시간 진행률 확인</li>
    </ol>

    <h4>5.3 클라이언트 간 Config 차이 확인</h4>
    <ol>
      <li>클라이언트 목록에서 비교할 클라이언트 2개 이상 선택</li>
      <li><strong>Compare</strong> 버튼 클릭</li>
      <li>Baseline 설정하여 기준 클라이언트 지정</li>
      <li><strong>Diff Only</strong> 활성화하여 차이점만 표시</li>
      <li>필요시 키 검색으로 특정 설정 확인</li>
    </ol>

    <h4>5.4 잘못된 변경 복원</h4>
    <ol>
      <li>해당 클라이언트의 Config Manager 열기</li>
      <li>복원할 Config 파일 탭 선택</li>
      <li><strong>Backup</strong> 버튼 클릭하여 백업 목록 열기</li>
      <li>복원할 시점의 백업 선택</li>
      <li>내용 확인 후 <strong>Save</strong> 클릭하여 저장</li>
    </ol>

    <div class="callout-info">
      <div class="callout-title">Config Settings (Admin 전용)</div>
      <p>
        Config 파일의 이름, 경로, 활성화 여부는 Admin이 클라이언트 목록 페이지 우상단의
        <strong>Config</strong> 설정 버튼(톱니바퀴 아이콘)을 통해 관리합니다.
        Agent Group(ARSAgent/ResourceAgent)별로 별도의 Config 설정을 구성할 수 있습니다.
        Config Settings가 설정되어 있지 않으면 Config Manager를 열 때 경고가 표시됩니다.
      </p>
    </div>
  </div>
</template>
