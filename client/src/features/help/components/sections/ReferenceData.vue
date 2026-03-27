<script setup>
import HelpImage from '../HelpImage.vue'
</script>

<template>
  <div class="help-prose">
    <h2>기준정보 관리</h2>
    <p>
      기준정보 관리 메뉴에서는 시스템 운영에 필요한 기초 데이터를 관리합니다.
      장비 정보(Equipment Info), 이메일 템플릿, 이메일 수신자/발신자, 사용자 관리 등
      다양한 기준정보를 조회하고 편집할 수 있습니다.
    </p>

    <!-- ===== Equipment Info ===== -->
    <h3>Equipment Info (장비 정보)</h3>
    <p>
      Equipment Info 페이지에서는 시스템에 등록된 장비(클라이언트) 기준정보를 관리합니다.
      <strong>기준정보 관리 &gt; Equipment Info</strong> 메뉴에서 접근합니다.
    </p>

    <HelpImage name="equipment-info-data" alt="Equipment Info 관리 화면" caption="Equipment Info — Process 필터 적용 후 데이터 표시 (AG Grid 인라인 편집)" />

    <h4>필터바</h4>
    <p>
      상단 필터바에서 조회 조건을 설정합니다.
    </p>
    <ul>
      <li><strong>Process</strong> : 공정 선택 (다중 선택 가능)</li>
      <li><strong>Model</strong> : 장비 모델 선택 (다중 선택 가능)</li>
      <li><strong>IP 검색</strong> : IP 주소 키워드 검색</li>
      <li><strong>EqpId 검색</strong> : 장비 ID 키워드 검색</li>
    </ul>

    <h4>AG Grid 인라인 편집</h4>
    <p>
      검색 결과는 AG Grid 테이블에 표시되며, 셀을 직접 클릭하여 값을 수정할 수 있습니다.
    </p>
    <ul>
      <li>수정된 셀은 색상으로 강조 표시됩니다</li>
      <li>새로 추가된 행은 별도 색상으로 구분됩니다</li>
      <li>삭제 표시된 행은 취소선 스타일로 표시됩니다</li>
      <li>변경 사항은 <strong>Save</strong> 버튼을 클릭해야 서버에 반영됩니다</li>
      <li><strong>Discard</strong> 버튼으로 모든 변경 사항을 취소할 수 있습니다</li>
    </ul>

    <h4>주요 컬럼</h4>
    <table>
      <thead>
        <tr>
          <th>컬럼</th>
          <th>설명</th>
          <th>편집</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>eqpId</td>
          <td>장비 고유 식별자</td>
          <td>신규 행만 편집 가능</td>
        </tr>
        <tr>
          <td>process</td>
          <td>공정명</td>
          <td>드롭다운 선택</td>
        </tr>
        <tr>
          <td>eqpModel</td>
          <td>장비 모델명</td>
          <td>자유 입력</td>
        </tr>
        <tr>
          <td>ip</td>
          <td>장비 IP 주소</td>
          <td>자유 입력</td>
        </tr>
        <tr>
          <td>osVer</td>
          <td>운영체제 버전</td>
          <td>드롭다운 선택 (OS List 기반)</td>
        </tr>
        <tr>
          <td>emailcategory</td>
          <td>이메일 알림 카테고리</td>
          <td>자유 입력 (저장 시 EMAILINFO 자동 확인)</td>
        </tr>
      </tbody>
    </table>

    <h4>CRUD 작업</h4>
    <ul>
      <li><strong>Add</strong> : 빈 행을 추가하여 새 장비를 등록합니다. 건수를 지정하여 다중 추가도 가능합니다.</li>
      <li><strong>Delete</strong> : 선택한 행을 삭제 대상으로 표시합니다 (Save 클릭 시 실제 삭제).</li>
      <li><strong>Save</strong> : 생성/수정/삭제를 일괄 처리합니다. 유효성 검증 실패 시 오류 모달이 표시됩니다.</li>
      <li><strong>Discard</strong> : 모든 미저장 변경사항을 되돌립니다.</li>
    </ul>

    <div class="callout-info">
      <div class="callout-title">Email Category 자동 확인</div>
      <p>
        장비 저장 시 emailcategory에 입력된 값이 EMAILINFO 컬렉션에 존재하지 않으면
        확인 대화상자가 표시되어 자동으로 Email Info 항목을 생성할 수 있습니다.
      </p>
    </div>

    <h4>OS List 관리 (Admin 전용)</h4>
    <p>
      페이지 상단 우측의 <strong>OS List</strong> 버튼(Admin 전용)을 클릭하면 OS Version List 모달이 열립니다.
      여기서 osVer 컬럼의 드롭다운 목록에 표시될 운영체제 버전을 관리합니다.
    </p>

    <h4>붙여넣기 기능</h4>
    <p>
      엑셀이나 스프레드시트에서 복사한 데이터를 AG Grid에 직접 붙여넣을 수 있습니다.
    </p>
    <ul>
      <li><strong>행 붙여넣기</strong> : 빈 영역에 붙여넣으면 새 행이 자동 추가됩니다</li>
      <li><strong>셀 붙여넣기</strong> : 기존 행의 셀에 커서를 두고 붙여넣으면 해당 셀부터 값이 채워집니다</li>
    </ul>

    <!-- ===== Email Template ===== -->
    <h3>Email Template (이메일 템플릿)</h3>
    <p>
      Email Template 페이지에서는 시스템이 발송하는 이메일의 HTML 템플릿을 편집합니다.
      <strong>기준정보 관리 &gt; Email Template</strong> 메뉴에서 접근합니다.
    </p>

    <HelpImage name="email-template-data" alt="Email Template 목록" caption="Email Template — Process 필터 적용 후 템플릿 목록 표시" />

    <h4>Monaco Editor HTML 편집</h4>
    <p>
      템플릿 편집은 Monaco Editor(VS Code 내장 에디터)를 사용하며, HTML 구문 강조, 자동 완성,
      접기/펼치기 등의 기능을 지원합니다.
    </p>
    <ul>
      <li><strong>편집 모드</strong> : HTML 소스 코드를 직접 편집합니다</li>
      <li><strong>미리보기</strong> : 렌더링된 HTML을 실시간으로 확인합니다</li>
      <li><strong>모달 크기</strong> : S(Small) / M(Medium) / L(Large) 크기 프리셋을 선택할 수 있습니다</li>
    </ul>

    <!-- ===== Popup Template ===== -->
    <h3>Popup Template (팝업 템플릿)</h3>
    <p>
      Popup Template은 장비에 표시되는 알림 팝업의 HTML 템플릿을 관리합니다.
      Email Template과 동일한 Monaco Editor 기반의 편집 환경을 제공합니다.
    </p>
    <HelpImage name="popup-template" alt="Popup Template 관리 화면" caption="Popup Template — Email Template과 동일한 구조의 팝업 템플릿 관리" />

    <!-- ===== Email Image ===== -->
    <h3>Email Image (이메일 이미지)</h3>
    <p>
      Email Image 페이지에서는 이메일 템플릿에 삽입할 이미지를 관리합니다.
    </p>
    <HelpImage name="email-image" alt="Email Image 관리 화면" caption="Email Image — 썸네일 그리드, 업로드, 미리보기" />
    <ul>
      <li><strong>이미지 그리드</strong> : 업로드된 이미지를 썸네일 그리드로 표시합니다</li>
      <li><strong>업로드</strong> : 드래그 앤 드롭 또는 파일 선택으로 이미지를 업로드합니다</li>
      <li><strong>미리보기</strong> : 이미지를 클릭하면 원본 크기로 미리보기할 수 있습니다</li>
      <li><strong>삭제</strong> : 더 이상 사용하지 않는 이미지를 삭제합니다</li>
    </ul>

    <!-- ===== Email Info / Recipients ===== -->
    <h3>Email Info / Recipients (수신자 관리)</h3>
    <p>
      이메일 알림의 발신자 정보(Email Info)와 수신자 목록(Email Recipients)을 관리합니다.
    </p>
    <HelpImage name="email-info" alt="Email Info 관리 화면" caption="Email Info — 프로젝트+카테고리별 발신 계정 관리" />
    <HelpImage name="email-recipients" alt="Email Recipients 관리 화면" caption="Email Recipients — 카테고리별 이메일 수신자 목록" />
    <ul>
      <li><strong>Email Info</strong> : 프로젝트 + 카테고리별 발신 계정 및 부서 정보</li>
      <li><strong>Email Recipients</strong> : 카테고리별 이메일 수신자 목록 관리</li>
      <li>Equipment Info에서 설정한 emailcategory와 연동되어, 장비별로 적절한 수신자에게 알림이 발송됩니다</li>
    </ul>

    <!-- ===== User Management ===== -->
    <h3>User Management (사용자 관리)</h3>
    <p>
      User Management 페이지에서는 WebManager 사용자 계정을 관리합니다.
      <strong>기준정보 관리 &gt; User Management</strong> 메뉴에서 접근합니다.
    </p>

    <HelpImage name="user-management-data" alt="사용자 관리 화면" caption="User Management — 사용자 목록 표시 (역할/상태 뱃지, 다중 공정)" />

    <h4>필터바</h4>
    <ul>
      <li><strong>Process</strong> : 공정별 필터링</li>
      <li><strong>Role</strong> : 역할별 필터링</li>
      <li><strong>키워드 검색</strong> : 사용자 ID, 이름 검색</li>
      <li><strong>Load All Users</strong> : 필터 없이 전체 사용자를 로드합니다</li>
    </ul>

    <h4>사용자 CRUD</h4>
    <p>
      Equipment Info와 동일한 AG Grid 인라인 편집 방식을 사용합니다.
    </p>
    <table>
      <thead>
        <tr>
          <th>컬럼</th>
          <th>설명</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>singleid</td>
          <td>사용자 로그인 ID</td>
        </tr>
        <tr>
          <td>name</td>
          <td>사용자 이름</td>
        </tr>
        <tr>
          <td>authorityManager</td>
          <td>역할 (1=Admin, 2=Conductor, 3=Manager, 4=User)</td>
        </tr>
        <tr>
          <td>processes</td>
          <td>담당 공정 (다중 선택 가능)</td>
        </tr>
        <tr>
          <td>scenarioWritePermission</td>
          <td>시나리오 작성 권한 (true/false)</td>
        </tr>
        <tr>
          <td>accountStatus</td>
          <td>계정 상태 (active / pending_approval / disabled)</td>
        </tr>
      </tbody>
    </table>

    <h4>계정 상태 관리</h4>
    <table>
      <thead>
        <tr>
          <th>상태</th>
          <th>의미</th>
          <th>조치</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>active</code></td>
          <td>정상 활성 계정</td>
          <td>정상 로그인 가능</td>
        </tr>
        <tr>
          <td><code>pending_approval</code></td>
          <td>회원가입 승인 대기</td>
          <td>Admin이 Approve 버튼으로 승인</td>
        </tr>
        <tr>
          <td><code>disabled</code></td>
          <td>비활성화된 계정</td>
          <td>로그인 불가, Admin이 active로 변경 가능</td>
        </tr>
        <tr>
          <td><code>password_reset_requested</code></td>
          <td>비밀번호 재설정 요청</td>
          <td>Admin이 Approve 버튼으로 임시 비밀번호 발급</td>
        </tr>
      </tbody>
    </table>

    <h4>비밀번호 초기화</h4>
    <p>
      사용자가 비밀번호 재설정을 요청하면 계정 상태가 <code>password_reset_requested</code>로 변경됩니다.
      Admin은 해당 사용자 행의 Approve 버튼을 클릭하여 임시 비밀번호를 발급합니다.
    </p>
    <ul>
      <li><strong>Standalone 모드</strong> : 임시 비밀번호가 생성되어 화면에 표시됩니다. Admin이 수동으로 전달합니다.</li>
      <li><strong>Integrated 모드</strong> : 이메일 입력(수동) 또는 EARS 검색으로 사용자 이메일을 확인하여 자동 발송할 수 있습니다.</li>
    </ul>
    <p>
      임시 비밀번호 발급 후 모달에 비밀번호가 표시되며, 복사 버튼으로 클립보드에 복사할 수 있습니다.
      사용자는 다음 로그인 시 비밀번호를 변경해야 합니다.
    </p>

    <div class="callout-warning">
      <div class="callout-title">사용자 삭제 주의</div>
      <p>
        사용자를 삭제하면 해당 계정으로 더 이상 로그인할 수 없습니다.
        계정을 임시로 차단하려면 삭제 대신 accountStatus를 "disabled"로 변경하세요.
      </p>
    </div>

    <div class="callout-info">
      <div class="callout-title">권한에 따른 기능 제한</div>
      <p>
        Feature Permission(users)에 따라 조회만 가능하거나, 수정/삭제까지 가능합니다.
        Admin은 Feature Permissions 버튼으로 각 역할의 Read/Write/Delete 권한을 설정할 수 있습니다.
      </p>
    </div>
  </div>
</template>
