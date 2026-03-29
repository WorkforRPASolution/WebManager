<script setup>
import HelpImage from '../HelpImage.vue'
</script>

<template>
  <div class="help-prose">
    <h2>AccessLog 설정 (AccessLog.json)</h2>
    <p>
      AccessLog.json은 에이전트가 모니터링할 <strong>로그 수집 소스</strong>를 정의하는 설정 파일입니다.
      각 소스는 클라이언트 장비의 로그 파일 위치, 파일명 패턴, 로그 타입, 수집 방식 등을 지정합니다.
      여기서 정의한 소스는 Trigger.json에서 참조하여 로그 감시 대상으로 사용됩니다.
    </p>

    <div class="callout-info">
      <div class="callout-title">소스 이름과 트리거의 관계</div>
      <p>
        Trigger 용도의 소스는 이름 양쪽에 <code>__</code>가 자동으로 추가됩니다 (예: <code>__LogReadInfo__</code>).
        이 이름은 Trigger.json의 소스 선택과 ARSAgent.json의 AccessLogLists에서 참조됩니다.
      </p>
    </div>

    <!-- ===== 1. 폼 개요 ===== -->
    <h3>1. 폼 개요</h3>
    <HelpImage name="config-accesslog-form-overview" alt="AccessLog 폼 전체" caption="AccessLog Form 뷰 — 소스 카드 목록, 각 카드별 접기/펼치기, 드래그 정렬 가능" />
    <p>
      AccessLog 폼은 <strong>소스 카드</strong> 목록으로 구성됩니다. 각 소스 카드는 하나의 로그 수집 소스를 나타냅니다.
    </p>
    <ul>
      <li><strong>"+ 소스 추가"</strong> 버튼으로 새 소스를 추가합니다</li>
      <li>각 카드의 좌측 <strong>핸들(점 6개)</strong>을 드래그하여 순서를 변경할 수 있습니다</li>
      <li>카드 헤더를 클릭하면 <strong>접기/펼치기</strong>가 전환됩니다</li>
      <li>카드 헤더에는 소스 이름(주황 배지), 용도 배지(Upload), 디렉토리 경로가 표시됩니다</li>
    </ul>

    <!-- ===== 2. 소스 기본 설정 ===== -->
    <h3>2. 소스 기본 설정</h3>
    <HelpImage name="config-accesslog-source-basic" alt="AccessLog 소스 기본 설정" caption="소스 카드 확장 — Purpose, 소스 이름, 디렉토리, 파일 패턴" />

    <h4>2.1 용도 (Purpose)</h4>
    <table>
      <thead>
        <tr><th>용도</th><th>설명</th><th>특이사항</th></tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Log Trigger 용</strong></td>
          <td>트리거가 감시할 로그 소스</td>
          <td>이름에 <code>__</code> 접두/접미사 자동 추가, 라인 그룹핑 필드 사용 가능</td>
        </tr>
        <tr>
          <td><strong>Log Upload 용</strong></td>
          <td>서버로 로그를 업로드하는 소스</td>
          <td>이름 그대로 사용, 배치 설정(batch_count, batch_timeout) 필드 추가</td>
        </tr>
      </tbody>
    </table>

    <h4>2.2 소스 이름</h4>
    <p>
      소스의 고유 식별자입니다. Trigger 용도에서는 입력한 이름 양쪽에 <code>__</code>가 자동 추가되어
      JSON에 저장됩니다 (예: <code>LogReadInfo</code> 입력 &rarr; <code>__LogReadInfo__</code>로 저장).
    </p>

    <h4>2.3 디렉토리 경로</h4>
    <p>
      로그 파일이 위치한 클라이언트 장비의 디렉토리 경로입니다 (예: <code>C:/EARS/TestFile</code>).
      에이전트가 이 경로에서 파일 패턴에 맞는 파일을 찾아 모니터링합니다.
    </p>

    <h4>2.4 파일 패턴 (Prefix + Wildcard + Suffix)</h4>
    <p>
      3개 필드를 조합하여 로그 파일명 패턴을 정의합니다:
    </p>
    <ul>
      <li><strong>접두사 (Prefix)</strong> — 파일명 앞부분 (예: <code>log_</code>)</li>
      <li><strong>와일드카드 (Wildcard)</strong> — 파일명 중간의 가변 부분</li>
      <li><strong>접미사 (Suffix)</strong> — 파일 확장자 (예: <code>.txt</code>, <code>.log</code>)</li>
    </ul>
    <p>
      예: Prefix=<code>app_</code>, Wildcard 비움, Suffix=<code>.log</code> &rarr; <code>app_*.log</code> 패턴으로 매칭
    </p>

    <!-- ===== 3. 3축 로그 타입 ===== -->
    <h3>3. 3축 로그 타입 (Log Type)</h3>
    <HelpImage name="config-accesslog-logtype-axes" alt="3축 로그 타입 선택" caption="3개 드롭다운으로 Log Type을 결정 — Date Axis + Line Axis + Post-Processing" />
    <p>
      로그 타입은 <strong>3개 축의 조합</strong>으로 결정됩니다.
      각 축을 드롭다운에서 선택하면 하단에 합성된 log_type 값이 배지로 표시됩니다.
    </p>

    <h4>Date Axis (날짜 축)</h4>
    <p>로그 파일이 날짜별로 어떻게 관리되는지를 지정합니다.</p>
    <table>
      <thead>
        <tr><th>옵션</th><th>설명</th><th>예시</th></tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>일반</strong></td>
          <td>단일 파일로 계속 기록</td>
          <td><code>app.log</code></td>
        </tr>
        <tr>
          <td><strong>날짜별</strong></td>
          <td>날짜가 바뀌면 새 파일 생성</td>
          <td><code>app_20260327.log</code></td>
        </tr>
        <tr>
          <td><strong>날짜접두사</strong></td>
          <td>파일명 앞에 날짜가 붙음</td>
          <td><code>20260327_app.log</code></td>
        </tr>
        <tr>
          <td><strong>날짜접미사</strong></td>
          <td>파일명 뒤에 날짜가 붙음</td>
          <td><code>app_20260327.log</code></td>
        </tr>
      </tbody>
    </table>

    <h4>Line Axis (라인 축)</h4>
    <table>
      <thead>
        <tr><th>옵션</th><th>설명</th></tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>단일 라인</strong></td>
          <td>각 줄이 하나의 독립된 로그 엔트리</td>
        </tr>
        <tr>
          <td><strong>다중 라인</strong></td>
          <td>여러 줄이 하나의 로그 엔트리 (예: Java 스택 트레이스)</td>
        </tr>
      </tbody>
    </table>

    <h4>Post-Processing (후처리 축)</h4>
    <table>
      <thead>
        <tr><th>옵션</th><th>설명</th></tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>없음</strong></td>
          <td>로그 라인을 그대로 전달</td>
        </tr>
        <tr>
          <td><strong>추출-삽입</strong></td>
          <td>파일 경로에서 데이터를 추출하여 각 로그 라인에 삽입</td>
        </tr>
      </tbody>
    </table>

    <div class="callout-info">
      <div class="callout-title">축 조합과 조건부 필드</div>
      <p>
        선택한 축 조합에 따라 추가 설정 필드가 동적으로 나타납니다.
        예를 들어 "날짜별" 선택 시 날짜 하위 디렉토리 포맷 필드가, "다중 라인" 선택 시
        멀티라인 설정 필드가 표시됩니다.
      </p>
    </div>

    <h4>날짜 하위 디렉토리 (date_subdir_format)</h4>
    <p>
      Date Axis를 "날짜별", "날짜접두사", "날짜접미사"로 선택하면 이 필드가 나타납니다.
      로그 파일이 날짜별 하위 디렉토리에 저장되는 경우 그 디렉토리 포맷을 지정합니다.
    </p>
    <p>
      Java SimpleDateFormat 형식으로 입력합니다. 예: <code>'\\' yyyy '\\' MM '\\' dd</code>
      &rarr; <code>\2026\03\27</code> 형태의 하위 디렉토리
    </p>

    <!-- ===== 4. 조건부 필드 ===== -->
    <h3>4. 조건부 필드</h3>

    <h4>4.1 읽기 설정</h4>
    <table>
      <thead>
        <tr><th>필드</th><th>설명</th><th>기본값</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>문자 인코딩 (Charset)</td>
          <td>로그 파일의 인코딩. 체크박스로 활성화 후 선택 (UTF-8, EUC-KR, MS949, UCS-2 LE BOM, 또는 직접 입력)</td>
          <td>(미지정)</td>
        </tr>
        <tr>
          <td>접근 주기</td>
          <td>로그 파일 확인 간격. 짧을수록 실시간에 가깝지만 부하 증가</td>
          <td>10 seconds</td>
        </tr>
        <tr>
          <td>파일 재열기 (Reopen)</td>
          <td>매 접근 주기마다 파일 핸들을 다시 열기. 로그 로테이션 환경에서 활성화</td>
          <td>사용</td>
        </tr>
        <tr>
          <td>이전 위치부터 읽기 (Back)</td>
          <td>파일 크기 감소 시 처음부터 다시 읽기. 체크박스로 활성화</td>
          <td>(미지정)</td>
        </tr>
        <tr>
          <td>끝부터 읽기 (End)</td>
          <td>최초 접근 시 파일 끝부터 시작. 기존 로그 건너뛰기. 체크박스로 활성화</td>
          <td>(미지정)</td>
        </tr>
        <tr>
          <td>제외 접미사</td>
          <td>모니터링에서 제외할 파일 확장자 목록 (태그 입력, 예: .bak, .tmp)</td>
          <td>(빈 배열)</td>
        </tr>
      </tbody>
    </table>

    <h4>4.2 배치 설정 (Upload 용도만)</h4>
    <p>용도를 "Log Upload 용"으로 설정한 소스에서만 표시됩니다.</p>
    <table>
      <thead>
        <tr><th>필드</th><th>설명</th><th>기본값</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>배치 수 (batch_count)</td>
          <td>한 번에 서버로 보내는 로그 라인 수</td>
          <td>1000</td>
        </tr>
        <tr>
          <td>배치 타임아웃 (batch_timeout)</td>
          <td>배치 수에 도달하지 않아도 전송하는 대기 시간</td>
          <td>30 seconds</td>
        </tr>
      </tbody>
    </table>

    <h4>4.3 로그 시간 필터</h4>
    <p>
      <strong>"+ 로그 시간 필터 추가"</strong> 버튼을 클릭하면 청록색 테두리의 섹션이 나타납니다.
      이미 처리한 시간 이전의 로그 라인을 건너뛰어 중복 처리를 방지합니다.
    </p>
    <table>
      <thead>
        <tr><th>필드</th><th>설명</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>로그 시간 패턴 (log_time_pattern)</td>
          <td>로그 라인에서 시간을 추출하는 정규표현식</td>
        </tr>
        <tr>
          <td>로그 시간 포맷 (log_time_format)</td>
          <td>추출된 시간 문자열의 포맷 (예: <code>yyyy-MM-dd HH:mm:ss</code>)</td>
        </tr>
      </tbody>
    </table>

    <h4>4.4 라인 그룹핑 (Trigger 용도만)</h4>
    <p>
      <strong>"+ 라인 그룹핑 추가"</strong> 버튼을 클릭하면 남색 테두리의 섹션이 나타납니다.
      여러 줄의 로그를 하나로 묶어서 트리거에 전달합니다.
    </p>
    <table>
      <thead>
        <tr><th>필드</th><th>설명</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>그룹 라인 수 (line_group_count)</td>
          <td>이 수만큼 로그 라인을 <code>&lt;&lt;EOL&gt;&gt;</code>로 연결하여 하나의 라인으로 트리거에 전달</td>
        </tr>
        <tr>
          <td>그룹 대상 패턴 (line_group_pattern)</td>
          <td>이 정규식에 매칭되는 라인만 그룹 대상. 비워두면 모든 라인</td>
        </tr>
      </tbody>
    </table>

    <h4>4.5 멀티라인 수집 (다중 라인 선택 시)</h4>
    <p>
      Line Axis를 "다중 라인"으로 선택하면 자주색 테두리의 멀티라인 설정 섹션이 나타납니다.
      여러 줄에 걸친 로그 엔트리(예: Java 스택 트레이스)를 하나의 블록으로 수집합니다.
    </p>
    <table>
      <thead>
        <tr><th>필드</th><th>설명</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>시작 패턴 (start_pattern)</td>
          <td>멀티라인 블록의 시작을 알리는 정규식 (예: <code>.* WARN Alarm Occured.*</code>)</td>
        </tr>
        <tr>
          <td>종료 패턴 (end_pattern)</td>
          <td>블록 수집을 완료하는 정규식 (이 패턴까지 한 라인으로 합침)</td>
        </tr>
        <tr>
          <td>수집 라인 수 (line_count)</td>
          <td>최대 수집 라인 수. 종료 패턴 전이라도 이 수에 도달하면 블록 완료</td>
        </tr>
        <tr>
          <td>우선순위 (priority)</td>
          <td><strong>count</strong>: 라인 수 도달 시 즉시 완료 / <strong>pattern</strong>: 종료 패턴 매칭을 우선</td>
        </tr>
      </tbody>
    </table>

    <h4>4.6 추출-삽입 (Extract & Append)</h4>
    <p>
      Post-Processing을 "추출-삽입"으로 선택하면 주황색 테두리의 섹션이 나타납니다.
      로그 파일의 <strong>절대 경로에서 데이터를 추출</strong>하여 각 로그 라인에 삽입합니다.
    </p>
    <table>
      <thead>
        <tr><th>필드</th><th>설명</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>추출 패턴 (pathPattern)</td>
          <td>파일 절대 경로에서 데이터를 추출하는 정규식. <code>()</code> 그룹으로 캡처 (최대 5개)</td>
        </tr>
        <tr>
          <td>삽입 위치 (appendPos)</td>
          <td>추출한 데이터를 로그 라인에 삽입할 위치. 0은 맨 앞</td>
        </tr>
        <tr>
          <td>삽입 포맷 (appendFormat)</td>
          <td>캡처 그룹을 <code>@1</code>, <code>@2</code>, <code>@3</code> 등으로 참조하여 포맷 지정 (예: <code>@1-@2-@3 </code>)</td>
        </tr>
      </tbody>
    </table>

    <div class="callout-warning">
      <div class="callout-title">추출 패턴 주의사항</div>
      <p>
        정규식 캡처 그룹은 최대 5개까지 지원됩니다 (<code>@1</code>~<code>@5</code>).
        Windows 경로의 백슬래시는 정규식에서 이스케이프가 필요합니다 (예: <code>\\\\</code>).
      </p>
    </div>

    <!-- ===== 5. 테스트 기능 ===== -->
    <h3>5. 테스트 기능</h3>
    <p>
      각 소스 카드 하단에는 <strong>접이식 테스트 패널</strong>이 있습니다.
      설정한 값이 올바르게 동작하는지 저장 전에 미리 확인할 수 있습니다.
      테스트 패널은 소스의 설정에 따라 최대 5가지 테스트를 제공합니다.
    </p>
    <HelpImage name="config-accesslog-test-panels" alt="AccessLog 테스트 패널 목록" caption="소스 카드 하단의 테스트 패널 — 설정에 따라 해당 테스트만 표시됨" />

    <div class="callout-info">
      <div class="callout-title">테스트 조건부 표시</div>
      <p>
        모든 테스트가 항상 표시되는 것은 아닙니다. 소스의 설정에 따라 해당되는 테스트만 나타납니다:
      </p>
      <ul>
        <li><strong>경로 매칭 테스트</strong> — 항상 표시</li>
        <li><strong>로그 시간 필터 테스트</strong> — 로그 시간 필터가 추가된 경우</li>
        <li><strong>라인 그룹핑 테스트</strong> — 라인 그룹핑이 추가된 경우</li>
        <li><strong>멀티라인 블록 추출 테스트</strong> — Line Axis가 "다중 라인"인 경우</li>
        <li><strong>추출-삽입 테스트</strong> — Post-Processing이 "추출-삽입"인 경우</li>
      </ul>
    </div>

    <h4>5.1 경로 매칭 테스트</h4>
    <HelpImage name="config-accesslog-test-path" alt="경로 매칭 테스트 결과" caption="로컬 패턴 검증(상) + 원격 파일 확인(하) — 단계별 매칭 결과 표시" />
    <p>
      설정한 디렉토리, 접두사, 와일드카드, 접미사 패턴이 특정 파일 경로와 매칭되는지 확인합니다.
    </p>

    <h5>로컬 패턴 검증</h5>
    <p>
      파일 경로를 직접 입력하고 <strong>"테스트"</strong> 버튼을 클릭하면,
      디렉토리 매칭 &rarr; 접두사 &rarr; 접미사 &rarr; 와일드카드 &rarr; 제외 접미사 순서로
      단계별 매칭 결과가 표시됩니다. 각 단계마다 통과(<strong>&#10003;</strong>) 또는 실패(<strong>&#10007;</strong>)가 표시됩니다.
    </p>

    <h5>원격 파일 확인</h5>
    <p>
      <strong>"원격 확인"</strong> 버튼을 클릭하면 실제 클라이언트 장비에 접속하여
      디렉토리 내 파일 목록을 조회한 뒤 패턴 매칭 결과를 테이블로 보여줍니다.
      파일명, 크기, 수정일이 표시되며, "전체 N개 중 M개 매칭" 통계도 제공됩니다.
    </p>

    <h4>5.2 멀티라인 블록 추출 테스트</h4>
    <HelpImage name="config-accesslog-test-multiline" alt="멀티라인 블록 추출 테스트" caption="테스트 결과 — 추출된 블록, 건너뛴 라인, 블록 종료 사유 표시" />
    <p>
      Line Axis가 "다중 라인"일 때 사용 가능합니다.
      로그 텍스트를 입력하면 start_pattern/end_pattern/line_count 설정에 따라
      블록이 어떻게 추출되는지 시뮬레이션합니다.
    </p>
    <p>각 블록의 시작 라인, 종료 라인, 블록 종료 사유가 표시됩니다:</p>
    <ul>
      <li><strong>종료 패턴 매칭</strong> — end_pattern에 매칭되어 완료</li>
      <li><strong>라인 수 도달</strong> — line_count에 도달하여 완료</li>
      <li><strong>다음 시작 패턴</strong> — 새로운 블록의 시작 패턴이 감지되어 이전 블록 종료</li>
      <li><strong>파일 끝</strong> — 입력 텍스트가 끝나서 완료</li>
    </ul>

    <h4>5.3 로그 시간 필터 테스트</h4>
    <HelpImage name="config-accesslog-test-logtime" alt="로그 시간 필터 테스트" caption="각 라인별 pass(처리)/skip(건너뜀)/no-match(시간 미추출) 상태 표시" />
    <p>
      로그 시간 필터가 설정된 경우 사용 가능합니다.
      로그 텍스트를 입력하면 각 라인에서 타임스탬프를 추출하고,
      이전에 처리한 시간보다 새로운 라인만 통과(pass)시키는 동작을 시뮬레이션합니다.
    </p>
    <table>
      <thead>
        <tr><th>상태</th><th>의미</th></tr>
      </thead>
      <tbody>
        <tr><td><strong>pass</strong></td><td>현재/새 시간의 라인 — 정상 처리됩니다</td></tr>
        <tr><td><strong>skip</strong></td><td>이전 시간의 라인 — 건너뜁니다 (중복 방지)</td></tr>
        <tr><td><strong>no-match</strong></td><td>시간을 추출할 수 없는 라인 — 그대로 통과합니다</td></tr>
      </tbody>
    </table>

    <h4>5.4 라인 그룹핑 테스트</h4>
    <HelpImage name="config-accesslog-test-linegroup" alt="라인 그룹핑 테스트" caption="N개씩 그룹화된 결과 — 그룹별로 <<EOL>>로 연결된 텍스트 표시" />
    <p>
      라인 그룹핑이 설정된 경우 사용 가능합니다.
      로그 텍스트를 입력하면 line_group_count개씩 라인을 묶어 <code>&lt;&lt;EOL&gt;&gt;</code>로
      연결한 결과를 보여줍니다.
    </p>
    <ul>
      <li>line_group_pattern이 설정되면 패턴에 매칭되는 라인만 그룹 대상입니다</li>
      <li>마지막에 남은 불완전 그룹은 별도로 표시됩니다</li>
      <li>패턴에 매칭되지 않은 라인은 "미그룹" 항목으로 표시됩니다</li>
    </ul>

    <h4>5.5 추출-삽입 테스트</h4>
    <HelpImage name="config-accesslog-test-extract" alt="추출-삽입 테스트" caption="파일 경로에서 캡처된 그룹 + 각 로그 라인에 삽입된 결과 비교" />
    <p>
      Post-Processing이 "추출-삽입"일 때 사용 가능합니다.
      pathPattern, appendFormat, appendPos 설정이 실제로 어떻게 동작하는지 확인합니다.
    </p>
    <ol>
      <li><strong>경로 추출</strong>: pathPattern 정규식으로 파일 경로에서 캡처 그룹 추출</li>
      <li><strong>포맷 치환</strong>: appendFormat의 <code>@1</code>, <code>@2</code> 등을 캡처값으로 치환</li>
      <li><strong>라인 삽입</strong>: 치환된 문자열을 각 로그 라인의 appendPos 위치에 삽입</li>
    </ol>
    <p>
      결과 화면에서 원본 라인과 변환된 라인을 비교할 수 있습니다.
    </p>
  </div>
</template>
