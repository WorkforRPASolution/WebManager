<script setup>
import HelpImage from '../HelpImage.vue'
</script>

<template>
  <div class="help-prose">
    <h2>계정 관리</h2>
    <p>
      WebManager에 접속하기 위한 로그인, 회원가입, 비밀번호 재설정, 최초 로그인 시 비밀번호 변경에 대해 안내합니다.
      이 문서는 시스템을 처음 사용하는 사용자부터 비밀번호 분실 시 복구 절차까지 모든 계정 관련 작업을 다룹니다.
    </p>

    <!-- ============================================================ -->
    <!-- 1. 로그인 -->
    <!-- ============================================================ -->
    <h3 id="login">1. 로그인</h3>
    <p>
      WebManager에 접속하면 가장 먼저 EARS 시네마틱 인트로 화면이 표시됩니다.
      인트로 애니메이션이 끝나면 자동으로 로그인 폼이 나타나며, 애니메이션 도중에 스킵하여 곧바로 로그인할 수도 있습니다.
    </p>

    <h4>1-1. EARS 인트로 애니메이션</h4>
    <p>
      첫 접속 시 <strong>Equipment Automation And Recovery System</strong>의 약자인 EARS를 소개하는
      시네마틱 애니메이션이 재생됩니다. 각 단어가 순차적으로 나타나며, 브랜드 아이덴티티를 강조합니다.
    </p>
    <ul>
      <li><strong>스킵 방법</strong>: 화면 아무 곳이나 클릭하거나, <code>Enter</code> 또는 <code>Esc</code> 키를 누르면 즉시 로그인 폼으로 전환됩니다.</li>
      <li><strong>재방문 시 축약</strong>: 같은 브라우저 세션(탭)에서 이미 인트로를 본 경우, 재접속 시 축약된 형태로 빠르게 전환됩니다.</li>
    </ul>

    <HelpImage name="login" alt="EARS 인트로 + 로그인 화면" caption="Figure 1: EARS 시네마틱 인트로와 스플릿 레이아웃 로그인 화면" />

    <h4>1-2. 로그인 폼</h4>
    <p>
      인트로가 완료되면 화면 오른쪽에 로그인 폼이 표시됩니다. 스플릿 레이아웃으로 왼쪽에는 EARS 로고와 소개 문구,
      오른쪽에는 로그인 입력 영역이 배치됩니다.
    </p>

    <HelpImage name="login-form" alt="로그인 폼" caption="Figure 2: 로그인 폼 상세" />

    <h4>로그인 절차</h4>
    <ol>
      <li><strong>Username</strong> 필드에 사용자 ID를 입력합니다.</li>
      <li><strong>Password</strong> 필드에 비밀번호를 입력합니다. 오른쪽 눈 아이콘을 클릭하면 비밀번호를 확인할 수 있습니다.</li>
      <li><strong>Sign In</strong> 버튼을 클릭하거나 <code>Enter</code> 키를 눌러 로그인합니다.</li>
    </ol>

    <h4>로그인 성공 후 첫 화면</h4>
    <p>
      로그인 성공 시 사용자의 역할(Role)에 따라 접근 가능한 첫 번째 페이지로 자동 이동합니다.
      시스템은 다음 우선순위로 랜딩 페이지를 결정합니다:
    </p>
    <ol>
      <li><strong>Dashboard Overview</strong> (접근 권한이 있는 경우)</li>
      <li><strong>클라이언트 목록</strong></li>
      <li><strong>장비 정보</strong></li>
      <li>위 페이지에 모두 권한이 없으면, 기본 레이아웃에서 접근 가능한 아무 페이지</li>
    </ol>

    <div class="callout-info">
      <div class="callout-title">참고: 비밀번호 미설정 안내</div>
      <p>
        관리자가 비밀번호를 초기화했거나 아직 비밀번호가 설정되지 않은 계정으로 로그인을 시도하면,
        "비밀번호가 설정되지 않았습니다" 안내 메시지가 노란색 배경으로 표시되며, "비밀번호 초기화 요청하기" 링크가 함께 나타납니다.
        이 링크를 클릭하면 비밀번호 재설정 페이지로 이동합니다.
      </p>
    </div>

    <h4>로그인 실패 시 대처</h4>
    <table>
      <thead>
        <tr>
          <th>상황</th>
          <th>표시 메시지</th>
          <th>대처 방법</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>ID 또는 비밀번호 오류</td>
          <td>빨간색 오류 메시지</td>
          <td>ID와 비밀번호를 다시 확인 후 재시도</td>
        </tr>
        <tr>
          <td>비밀번호 미설정</td>
          <td>노란색 안내 + 링크</td>
          <td>"비밀번호 초기화 요청하기" 클릭</td>
        </tr>
        <tr>
          <td>계정 비활성(승인 대기 등)</td>
          <td>오류 메시지</td>
          <td>관리자에게 계정 승인 요청</td>
        </tr>
      </tbody>
    </table>

    <p>
      로그인 화면 하단에는 두 개의 링크가 제공됩니다:
    </p>
    <ul>
      <li><strong>Forgot password?</strong> &mdash; 비밀번호 재설정 페이지로 이동</li>
      <li><strong>Sign Up</strong> &mdash; 회원가입 페이지로 이동</li>
    </ul>

    <!-- ============================================================ -->
    <!-- 2. 회원가입 -->
    <!-- ============================================================ -->
    <h3 id="signup">2. 회원가입</h3>
    <p>
      아직 WebManager 계정이 없는 사용자는 회원가입을 통해 새 계정을 생성할 수 있습니다.
      회원가입 화면은 <strong>2단 레이아웃</strong>으로 구성되어 있으며, 왼쪽에는 계정 정보, 오른쪽에는 업무 정보를 입력합니다.
    </p>

    <HelpImage name="signup" alt="회원가입 화면" caption="Figure 3: 2단 레이아웃 회원가입 폼 (좌: 계정정보, 우: 업무정보)" />

    <h4>2-1. 좌측: 계정 정보</h4>
    <p>계정 생성에 필요한 기본 인증 정보를 입력하는 영역입니다.</p>

    <table>
      <thead>
        <tr>
          <th>필드</th>
          <th>필수</th>
          <th>설명</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Name</strong></td>
          <td>필수</td>
          <td>실명 (2자 이상). Integrated 모드에서는 검색으로 선택</td>
        </tr>
        <tr>
          <td><strong>User ID</strong></td>
          <td>필수</td>
          <td>SingleID. 중복확인 필수</td>
        </tr>
        <tr>
          <td><strong>Password</strong></td>
          <td>필수</td>
          <td>8자 이상, 영문 + 숫자 포함 필수</td>
        </tr>
        <tr>
          <td><strong>Confirm</strong></td>
          <td>필수</td>
          <td>비밀번호 재입력 (일치 확인)</td>
        </tr>
        <tr>
          <td><strong>Department</strong></td>
          <td>선택</td>
          <td>소속 부서. Integrated 모드에서는 검색 정보로 자동 입력</td>
        </tr>
      </tbody>
    </table>

    <h4>ID 중복확인</h4>
    <p>
      User ID 필드 옆의 <strong>중복확인</strong> 버튼을 반드시 클릭해야 합니다.
      중복확인을 통과해야만 Sign Up 버튼이 활성화됩니다.
    </p>
    <ul>
      <li>ID가 사용 가능하면 입력 필드 테두리가 <strong>초록색</strong>으로 바뀌고, 버튼이 "사용 가능"으로 표시됩니다.</li>
      <li>이미 사용 중인 ID면 빨간색 오류 메시지가 표시됩니다.</li>
      <li>ID를 수정하면 중복확인 상태가 자동으로 초기화되므로 다시 확인해야 합니다.</li>
    </ul>

    <div class="callout-warning">
      <div class="callout-title">중복확인 필수</div>
      <p>
        중복확인을 거치지 않으면 Sign Up 버튼이 비활성화 상태로 유지됩니다.
        ID를 입력한 후 반드시 "중복확인" 버튼을 클릭하세요.
      </p>
    </div>

    <h4>2-2. 우측: 업무 정보</h4>
    <p>사용자의 업무 역할과 담당 공정 정보를 입력하는 영역입니다.</p>

    <h4>Process 찾기 도우미</h4>
    <p>
      우측 상단에 <strong>Process 찾기</strong> 검색 도우미가 제공됩니다.
      담당 클라이언트의 IP 주소 또는 장비 ID로 검색하면, 해당 클라이언트가 속한 Process 목록을 확인할 수 있습니다.
    </p>
    <ol>
      <li>검색 필드에 IP 또는 장비 ID의 일부를 입력합니다 (예: <code>10.0.1</code>).</li>
      <li><strong>검색</strong> 버튼을 클릭하면 매칭되는 클라이언트 목록과 해당 Process가 표시됩니다.</li>
      <li>표시된 Process 이름 옆의 <strong>+</strong> 버튼을 클릭하면 해당 Process가 선택 목록에 추가됩니다.</li>
      <li>여러 Process가 있으면 <strong>모두 추가</strong> 버튼으로 일괄 추가할 수 있습니다.</li>
    </ol>

    <div class="callout-info">
      <div class="callout-title">최대 50건</div>
      <p>검색 결과는 최대 50건까지 표시됩니다. 더 정확한 결과를 원하면 검색어를 구체적으로 입력하세요.</p>
    </div>

    <table>
      <thead>
        <tr>
          <th>필드</th>
          <th>필수</th>
          <th>설명</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Process</strong></td>
          <td>필수</td>
          <td>담당 공정 (복수 선택 가능). "선택" 모드에서 드롭다운 선택, "직접 입력" 모드에서 세미콜론(<code>;</code>)으로 구분하여 입력. 대문자 자동 변환 (A-Z, 0-9, _ 허용)</td>
        </tr>
        <tr>
          <td><strong>Line</strong></td>
          <td>필수</td>
          <td>소속 라인 (예: P1, M1). 한글 입력 불가</td>
        </tr>
        <tr>
          <td><strong>사용자 권한</strong></td>
          <td>필수</td>
          <td>역할 선택 (Admin 역할은 선택 불가, 관리자 승인 시 변경될 수 있음)</td>
        </tr>
        <tr>
          <td><strong>시나리오 작성권한</strong></td>
          <td>선택</td>
          <td>Scenario Editor 작성 권한 수준</td>
        </tr>
        <tr>
          <td><strong>Note</strong></td>
          <td>선택</td>
          <td>관리자에게 전달할 추가 메모</td>
        </tr>
      </tbody>
    </table>

    <h4>2-3. Integrated 모드: 사용자 검색</h4>
    <p>
      시스템이 <strong>Integrated 모드</strong>로 운영되는 경우, 이름 입력 필드에서 사용자를 검색하여
      자동으로 정보를 채울 수 있습니다.
    </p>
    <ol>
      <li><strong>Name</strong> 필드에 이름을 입력한 후, 옆의 <strong>검색</strong> 버튼을 클릭합니다.</li>
      <li>검색 결과 테이블에 이름, 부서, 이메일이 표시됩니다.</li>
      <li>본인에 해당하는 행을 클릭하면 다음 필드가 자동으로 채워집니다:
        <ul>
          <li><strong>Name</strong> &mdash; 검색된 이름</li>
          <li><strong>User ID</strong> &mdash; 이메일 주소의 <code>@</code> 앞부분 (자동 중복확인)</li>
          <li><strong>Department</strong> &mdash; 검색된 부서 정보</li>
        </ul>
      </li>
      <li>자동 입력된 User ID와 Department 필드는 <strong>읽기 전용</strong>이 됩니다.</li>
      <li>선택을 해제하려면 녹색 선택 표시 옆의 <strong>해제</strong> 버튼을 클릭합니다.</li>
    </ol>

    <div class="callout-info">
      <div class="callout-title">Integrated 모드 필수 사항</div>
      <p>
        Integrated 모드에서는 사용자 검색이 필수입니다.
        사용자 검색 후 선택하지 않으면 Sign Up 버튼이 활성화되지 않습니다.
      </p>
    </div>

    <h4>2-4. 가입 완료 및 승인 대기</h4>
    <p>
      모든 필드를 올바르게 입력하고 <strong>Sign Up</strong> 버튼을 클릭하면 계정이 생성됩니다.
      가입이 완료되면 성공 메시지가 표시됩니다.
    </p>

    <div class="callout-warning">
      <div class="callout-title">관리자 승인 필요</div>
      <p>
        신규 계정은 생성 즉시 사용할 수 없습니다.
        관리자가 계정을 승인(활성 상태로 변경)한 후에야 로그인이 가능합니다.
        승인 전까지는 승인 대기 상태로 유지됩니다.
        또한 관리자의 판단에 따라 가입 시 요청한 역할 및 권한이 변경될 수 있습니다.
      </p>
    </div>

    <!-- ============================================================ -->
    <!-- 3. 비밀번호 재설정 -->
    <!-- ============================================================ -->
    <h3 id="password-reset">3. 비밀번호 재설정</h3>
    <p>
      비밀번호를 분실하거나 재설정이 필요한 경우, 로그인 화면의 <strong>Forgot password?</strong> 링크를 통해
      비밀번호 재설정을 요청할 수 있습니다. 운영 모드에 따라 절차가 다릅니다.
    </p>

    <HelpImage name="password-reset" alt="비밀번호 재설정 화면" caption="Figure 4: 비밀번호 재설정 화면 (Standalone / Integrated)" />

    <h4>3-1. Standalone 모드</h4>
    <p>
      Standalone 모드에서는 관리자를 통해 비밀번호를 초기화합니다.
    </p>
    <ol>
      <li>비밀번호 재설정 페이지에서 <strong>User ID</strong>를 입력합니다.</li>
      <li><strong>Request Reset</strong> 버튼을 클릭합니다.</li>
      <li>요청이 접수되면 성공 메시지가 표시됩니다.</li>
      <li>관리자가 요청을 승인하면 임시 비밀번호가 이메일로 발송됩니다.</li>
      <li>임시 비밀번호로 로그인하면 즉시 새 비밀번호 설정 화면으로 이동합니다 (아래 "최초 로그인 비밀번호 변경" 참조).</li>
    </ol>

    <div class="callout-info">
      <div class="callout-title">Standalone 모드 안내</div>
      <p>
        Standalone 모드에서는 비밀번호 재설정 요청 후 관리자의 승인이 필요합니다.
        승인 후 이메일로 임시 비밀번호가 발송되며, 해당 비밀번호로 첫 로그인 시 새 비밀번호를 설정해야 합니다.
      </p>
    </div>

    <h4>3-2. Integrated 모드: 4단계 위저드</h4>
    <p>
      Integrated 모드에서는 시스템과 연동하여 관리자 승인 없이 직접 비밀번호를 재설정할 수 있습니다.
      5단계 스텝 인디케이터가 상단에 표시되며, 현재 진행 상태를 확인할 수 있습니다.
    </p>

    <h4>Step 1: 이름 검색</h4>
    <HelpImage name="password-reset-step1" alt="Step 1: 이름 검색" caption="Step 1 — 사용자 이름 검색 결과 (이름, 부서, 이메일 표시)" />
    <ol>
      <li>사용자 검색 컴포넌트에서 본인의 이름을 검색합니다.</li>
      <li>검색 결과에서 본인을 선택합니다.</li>
    </ol>

    <h4>Step 2: 선택 확인</h4>
    <HelpImage name="password-reset-step2" alt="Step 2: 선택 확인" caption="Step 2 — 사용자 정보 확인 카드 (이름/부서/이메일)" />
    <p>
      선택한 사용자의 정보(이름, 부서, 이메일)가 카드 형태로 표시됩니다.
    </p>
    <ul>
      <li>정보가 맞으면 <strong>"예, 인증 코드 발송"</strong> 버튼을 클릭합니다.</li>
      <li>다른 사람이면 <strong>"아니오, 다시 검색"</strong> 버튼을 클릭하여 Step 1로 돌아갑니다.</li>
    </ul>

    <h4>Step 3: 인증 코드 입력</h4>
    <HelpImage name="password-reset-step3" alt="Step 3: 인증 코드" caption="Step 3 — 6자리 인증 코드 입력 (남은 시간 표시, 재발송 버튼)" />
    <p>
      확인 버튼을 클릭하면 선택된 사용자의 등록 이메일로 6자리 인증 코드가 발송됩니다.
    </p>
    <ol>
      <li>이메일에서 수신한 6자리 인증 코드를 입력합니다.</li>
      <li><strong>다음</strong> 버튼을 클릭하여 인증을 완료합니다.</li>
    </ol>

    <div class="callout-danger">
      <div class="callout-title">인증 코드 제한 사항</div>
      <p>
        인증 코드는 <strong>5분간 유효</strong>합니다. 남은 시간이 화면 상단에 카운트다운으로 표시됩니다.
        시간이 만료되면 코드가 무효화되며, "재발송" 버튼을 클릭하여 새 코드를 받아야 합니다.
      </p>
    </div>

    <div class="callout-danger">
      <div class="callout-title">5회 실패 시 코드 무효화</div>
      <p>
        인증 코드를 5회 이상 틀리면 해당 코드가 즉시 무효화됩니다.
        "재발송" 버튼을 클릭하여 새로운 인증 코드를 발급받아야 합니다.
      </p>
    </div>

    <div class="callout-info">
      <div class="callout-title">재발송 쿨다운</div>
      <p>
        인증 코드 재발송은 60초 쿨다운이 적용됩니다.
        버튼에 남은 초가 표시되며, 쿨다운이 끝나야 다시 발송할 수 있습니다.
      </p>
    </div>

    <h4>Step 4: 새 비밀번호 설정</h4>
    <HelpImage name="password-reset-step4" alt="Step 4: 새 비밀번호" caption="Step 4 — 새 비밀번호 입력 + 비밀번호 규칙 안내" />
    <p>
      인증이 완료되면 새 비밀번호를 직접 설정합니다.
    </p>
    <ol>
      <li><strong>새 비밀번호</strong>를 입력합니다.</li>
      <li><strong>비밀번호 확인</strong> 필드에 동일한 비밀번호를 재입력합니다.</li>
      <li><strong>비밀번호 설정</strong> 버튼을 클릭합니다.</li>
    </ol>

    <table>
      <thead>
        <tr>
          <th>비밀번호 규칙</th>
          <th>설명</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>최소 길이</td>
          <td>8자 이상</td>
        </tr>
        <tr>
          <td>문자 조합</td>
          <td>영문(대소문자 무관) + 숫자 반드시 포함</td>
        </tr>
        <tr>
          <td>비밀번호 확인</td>
          <td>두 입력이 정확히 일치해야 함</td>
        </tr>
      </tbody>
    </table>

    <h4>Step 5: 완료</h4>
    <HelpImage name="password-reset-step5" alt="Step 5: 완료" caption="Step 5 — 비밀번호 변경 완료 + 로그인 이동 버튼" />
    <p>
      비밀번호가 성공적으로 변경되면 완료 화면이 표시됩니다.
      <strong>"로그인으로 이동"</strong> 버튼을 클릭하여 새 비밀번호로 로그인하세요.
    </p>

    <!-- ============================================================ -->
    <!-- 4. 최초 로그인 비밀번호 변경 -->
    <!-- ============================================================ -->
    <h3 id="first-login-password">4. 최초 로그인 비밀번호 변경</h3>
    <p>
      다음과 같은 상황에서는 로그인 성공 후 자동으로 비밀번호 변경 화면으로 이동합니다:
    </p>
    <ul>
      <li>관리자가 비밀번호를 초기화(임시 비밀번호 발급)한 경우</li>
      <li>계정에 "비밀번호 변경 필요" 설정이 활성화된 경우</li>
    </ul>

    <div class="callout-warning">
      <div class="callout-title">비밀번호 변경 필수</div>
      <p>
        이 화면은 건너뛸 수 없습니다. 새 비밀번호를 설정해야만 WebManager의 다른 기능을 사용할 수 있습니다.
        하단의 "Logout and use a different account" 링크를 클릭하면 로그아웃하여 다른 계정으로 전환할 수는 있습니다.
      </p>
    </div>

    <HelpImage name="set-new-password" alt="비밀번호 변경 화면" caption="최초 로그인 시 비밀번호 변경 화면 (/set-new-password)" />

    <h4>비밀번호 변경 절차</h4>
    <ol>
      <li>화면 상단에 관리자가 비밀번호를 초기화했다는 안내 메시지가 노란색 배경으로 표시됩니다.</li>
      <li><strong>New Password</strong> 필드에 새 비밀번호를 입력합니다 (8자 이상, 영문 + 숫자 포함).</li>
      <li><strong>Confirm Password</strong> 필드에 동일한 비밀번호를 재입력합니다.</li>
      <li>두 필드 옆의 눈 아이콘을 클릭하면 입력한 비밀번호를 확인할 수 있습니다.</li>
      <li><strong>Set Password</strong> 버튼을 클릭하면 비밀번호가 설정되고, 자동으로 Dashboard로 이동합니다.</li>
    </ol>

    <p>
      비밀번호 규칙은 회원가입 및 비밀번호 재설정과 동일합니다:
    </p>
    <ul>
      <li>8자 이상</li>
      <li>영문(대소문자 무관)과 숫자를 모두 포함</li>
      <li>비밀번호와 확인 값이 정확히 일치</li>
    </ul>

    <div class="callout-info">
      <div class="callout-title">실시간 유효성 검사</div>
      <p>
        비밀번호 입력 중 규칙에 맞지 않으면 필드 아래에 빨간색 오류 메시지가 즉시 표시됩니다.
        모든 조건을 충족해야 Set Password 버튼이 활성화됩니다.
      </p>
    </div>

    <!-- ============================================================ -->
    <!-- 5. 자주 하는 실수 & 문제 해결 -->
    <!-- ============================================================ -->
    <h3 id="troubleshooting">5. 자주 하는 실수 및 문제 해결</h3>

    <table>
      <thead>
        <tr>
          <th>문제</th>
          <th>원인</th>
          <th>해결 방법</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Sign Up 버튼이 비활성화</td>
          <td>ID 중복확인 미완료, 필수 필드 미입력, 또는 Integrated 모드에서 검색 후 사용자 미선택</td>
          <td>중복확인 버튼 클릭, 모든 필수(<span style="color: red">*</span>) 필드 확인</td>
        </tr>
        <tr>
          <td>ID 수정 후 Sign Up 불가</td>
          <td>ID를 수정하면 중복확인이 초기화됨</td>
          <td>"중복확인" 버튼을 다시 클릭</td>
        </tr>
        <tr>
          <td>인증 코드를 받지 못함</td>
          <td>이메일 수신 지연 또는 스팸함</td>
          <td>스팸함 확인 후, 60초 후 "재발송" 클릭</td>
        </tr>
        <tr>
          <td>인증 코드 입력란이 비활성화</td>
          <td>5분 만료 시간 초과</td>
          <td>"재발송" 버튼으로 새 코드 발급</td>
        </tr>
        <tr>
          <td>인증 실패 반복</td>
          <td>5회 이상 틀린 코드 입력</td>
          <td>"재발송" 버튼으로 새 코드 발급</td>
        </tr>
        <tr>
          <td>가입 후 로그인 불가</td>
          <td>계정이 승인 대기 상태</td>
          <td>관리자에게 승인 요청</td>
        </tr>
        <tr>
          <td>로그인 시 비밀번호 변경 화면 전환</td>
          <td>"비밀번호 변경 필요" 설정이 활성화됨</td>
          <td>새 비밀번호를 설정하면 정상 사용 가능</td>
        </tr>
        <tr>
          <td>Process 직접 입력 시 소문자 불가</td>
          <td>자동 대문자 변환 적용</td>
          <td>정상 동작이며, 입력값이 자동으로 대문자로 변환됨</td>
        </tr>
      </tbody>
    </table>

    <div class="callout-info">
      <div class="callout-title">운영 모드 확인</div>
      <p>
        운영 모드(standalone/integrated)는 시스템 설정에 따라 결정됩니다. 어떤 모드인지 모르시면 관리자에게 문의하세요.
        사용자가 직접 선택할 수 없으며, 접속 시 서버에서 현재 모드를 자동으로 감지합니다.
      </p>
    </div>
  </div>
</template>
