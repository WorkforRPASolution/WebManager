<script setup>
import HelpImage from '../HelpImage.vue'
</script>

<template>
  <div class="help-prose">
    <h2>소프트웨어 업데이트</h2>
    <p>
      소프트웨어 업데이트 기능은 원격 클라이언트에 Agent 바이너리, 설정 파일, 스크립트 등을 배포하고
      원격 명령을 실행할 수 있는 기능입니다.
      클라이언트 목록에서 대상을 선택한 후 툴바의 <strong>Update</strong> 버튼을 클릭하면
      Update 모달이 열립니다.
    </p>

    <!-- ===== Update 모달 ===== -->
    <h3>Update 모달</h3>
    <HelpImage name="update-modal" alt="Software Update 모달" caption="Update 모달 — Target Clients + Profile 선택 + Task 목록(copy/exec) + Deploy 버튼" />
    <p>
      Update 모달에서는 프로필 선택, 태스크 선택, 배포 실행, 진행 상황 확인을 수행합니다.
    </p>

    <h4>대상 클라이언트</h4>
    <p>
      모달 상단에 선택한 클라이언트 목록이 태그로 표시됩니다.
      각 클라이언트의 <code>eqpId</code>가 표시되어 배포 대상을 확인할 수 있습니다.
    </p>

    <h4>프로필 선택</h4>
    <p>
      드롭다운에서 배포 프로필을 선택합니다. 프로필은 Update Settings에서 미리 정의한 배포 구성입니다.
    </p>
    <ul>
      <li>프로필 이름, OS 버전, 소프트웨어 버전이 드롭다운에 표시됩니다</li>
      <li><strong>OS 자동 필터링</strong> : 선택한 클라이언트의 OS 버전에 맞는 프로필만 표시됩니다.
        "All OS" 프로필은 항상 표시됩니다.</li>
      <li>매칭되는 프로필이 없으면 경고 메시지가 표시됩니다</li>
    </ul>

    <h4>태스크 선택</h4>
    <p>
      프로필을 선택하면 해당 프로필에 정의된 태스크 목록이 표시됩니다.
      체크박스로 실행할 태스크를 선택합니다.
    </p>
    <table>
      <thead>
        <tr>
          <th>태스크 유형</th>
          <th>아이콘 색상</th>
          <th>설명</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>copy</code></td>
          <td>파란색</td>
          <td>소스 경로에서 클라이언트 대상 경로로 파일을 복사(업로드)합니다</td>
        </tr>
        <tr>
          <td><code>exec</code></td>
          <td>보라색</td>
          <td>클라이언트에서 원격 명령을 실행합니다 (예: 서비스 중지/시작 스크립트)</td>
        </tr>
      </tbody>
    </table>
    <p>
      각 태스크에는 <code>stop-on-fail</code> 배지가 표시될 수 있습니다.
      이 옵션이 활성화된 태스크가 실패하면 해당 클라이언트의 이후 태스크 실행이 중단됩니다.
    </p>

    <h4>배포 실행</h4>
    <p>
      프로필과 태스크를 선택한 뒤 <strong>Deploy</strong> 버튼을 클릭하면 배포가 시작됩니다.
    </p>
    <ul>
      <li>각 클라이언트별, 태스크별 진행 상황이 실시간으로 표시됩니다</li>
      <li>각 항목은 상태에 따라 색상이 구분됩니다:
        <strong>성공</strong>(녹색), <strong>실패</strong>(빨간색), <strong>스킵</strong>(회색), <strong>진행 중</strong>(파란색)
      </li>
      <li>배포 중에는 모달을 닫을 수 없으며, <strong>Cancel Deploy</strong> 버튼으로 중단할 수 있습니다</li>
      <li>배포 완료 후 전체 결과 요약이 표시됩니다 (성공/실패/전체 건수)</li>
    </ul>

    <div class="callout-warning">
      <div class="callout-title">배포 중 모달 닫기 불가</div>
      <p>
        배포 진행 중에는 백드롭 클릭이나 닫기 버튼이 비활성화됩니다.
        배포를 중단하려면 반드시 "Cancel Deploy" 버튼을 사용하세요.
      </p>
    </div>

    <div class="callout-info">
      <div class="callout-title">eqpId별 순차 실행</div>
      <p>
        동일 클라이언트의 태스크는 정의된 순서대로 순차 실행됩니다.
        서로 다른 클라이언트의 태스크는 동시성 풀(concurrency pool)을 통해 병렬로 처리되어 배포 시간이 단축됩니다.
      </p>
    </div>

    <!-- ===== Update Settings ===== -->
    <h3>Update Settings (Admin 전용)</h3>
    <HelpImage name="update-settings-modal" alt="Update Settings 모달" caption="Update Settings — 2패널 (좌: 프로필 목록, 우: Task 편집)" />
    <p>
      클라이언트 페이지 상단 우측의 <strong>Update</strong> 설정 버튼(Admin 전용)을 클릭하면
      Update Settings 모달이 열립니다. 이 모달에서 배포 프로필과 태스크를 관리합니다.
    </p>

    <h4>2패널 레이아웃</h4>
    <p>
      Update Settings 모달은 좌/우 2패널 구조입니다.
    </p>
    <ul>
      <li><strong>좌측 패널 (Profile List)</strong> : 프로필 목록, Add/Delete 버튼</li>
      <li><strong>우측 패널 (Profile Detail)</strong> : 선택한 프로필의 상세 설정</li>
    </ul>

    <h4>프로필 설정</h4>
    <table>
      <thead>
        <tr>
          <th>필드</th>
          <th>설명</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Name</td>
          <td>프로필 이름 (예: "Windows v2.0", "Linux ARM")</td>
        </tr>
        <tr>
          <td>OS Version</td>
          <td>대상 OS 버전 ("All OS" 선택 시 모든 OS에 적용)</td>
        </tr>
        <tr>
          <td>Version</td>
          <td>소프트웨어 버전 정보 (선택 사항)</td>
        </tr>
      </tbody>
    </table>

    <h4>소스 유형 (Source Type)</h4>
    <p>
      배포 파일의 저장 위치를 정의합니다. 프로필은 전역 소스 설정을 사용합니다.
    </p>
    <table>
      <thead>
        <tr>
          <th>소스 유형</th>
          <th>설명</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Local</td>
          <td>WebManager 서버의 로컬 파일 시스템</td>
        </tr>
        <tr>
          <td>원격 파일 서버</td>
          <td>외부 원격 파일 서버 (호스트/포트/인증 정보 설정)</td>
        </tr>
        <tr>
          <td>MinIO</td>
          <td>MinIO(S3 호환) 오브젝트 스토리지</td>
        </tr>
      </tbody>
    </table>

    <h4>Deploy Tasks</h4>
    <p>
      각 프로필에는 하나 이상의 배포 태스크를 정의합니다.
      태스크는 위에서 아래로 순서대로 실행됩니다.
    </p>

    <h4>Copy 태스크</h4>
    <table>
      <thead>
        <tr>
          <th>필드</th>
          <th>설명</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Name</td>
          <td>태스크 이름 (예: "Agent Binary")</td>
        </tr>
        <tr>
          <td>Source Path</td>
          <td>소스 저장소에서의 파일 경로 (Browse 버튼으로 탐색 가능)</td>
        </tr>
        <tr>
          <td>Target Path</td>
          <td>클라이언트에서의 대상 경로 (상대 경로 시 basePath 기준 해석)</td>
        </tr>
        <tr>
          <td>Stop on Fail</td>
          <td>이 태스크 실패 시 해당 클라이언트의 이후 태스크를 건너뛸지 여부</td>
        </tr>
      </tbody>
    </table>

    <h4>Exec 태스크</h4>
    <table>
      <thead>
        <tr>
          <th>필드</th>
          <th>설명</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Name</td>
          <td>태스크 이름 (예: "Stop Agent")</td>
        </tr>
        <tr>
          <td>Command</td>
          <td>실행할 명령어 (예: <code>net stop resourceagent</code>)</td>
        </tr>
        <tr>
          <td>Args</td>
          <td>명령어 인수 (공백 구분, 선택 사항)</td>
        </tr>
        <tr>
          <td>Timeout (sec)</td>
          <td>명령 실행 제한 시간 (기본값: 30초)</td>
        </tr>
        <tr>
          <td>Stop on Fail</td>
          <td>명령 실패 시 이후 태스크 건너뛰기 여부</td>
        </tr>
      </tbody>
    </table>

    <h4>태스크 순서 관리</h4>
    <p>
      각 태스크 우측의 화살표 버튼으로 순서를 변경할 수 있습니다.
    </p>
    <ul>
      <li>맨 위로 이동 / 한 칸 위로 이동</li>
      <li>한 칸 아래로 이동 / 맨 아래로 이동</li>
      <li>휴지통 아이콘으로 태스크 삭제</li>
    </ul>

    <div class="callout-info">
      <div class="callout-title">일반적인 배포 태스크 순서 예시</div>
      <p>
        1) Stop Agent (exec) &rarr; 2) Upload Binary (copy) &rarr; 3) Upload Config (copy) &rarr; 4) Start Agent (exec).
        Stop Agent에 "Stop on Fail"을 설정하면, Agent 중지에 실패한 클라이언트는 이후 태스크를 건너뜁니다.
      </p>
    </div>

    <h4>설정 저장</h4>
    <p>
      변경 사항이 있으면 하단의 <strong>Save</strong> 버튼이 활성화됩니다.
      저장하지 않고 모달을 닫으면 변경 내용이 유실되므로, 반드시 Save를 클릭하여 저장하세요.
      Agent 그룹(ARS Agent / Resource Agent)별로 별도의 설정이 관리됩니다.
    </p>

    <div class="callout-warning">
      <div class="callout-title">소스 브라우저</div>
      <p>
        Copy 태스크의 Source Path 입력 필드 옆 돋보기 아이콘을 클릭하면 소스 파일 브라우저가 열립니다.
        소스 유형에 따라 Local 파일 시스템, 원격 파일 서버, MinIO 버킷의 파일을 탐색하여 경로를 선택할 수 있습니다.
      </p>
    </div>
  </div>
</template>
