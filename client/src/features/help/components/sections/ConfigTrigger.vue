<script setup>
import HelpImage from '../HelpImage.vue'
</script>

<template>
  <div class="help-prose">
    <h2>Trigger 설정 (Trigger.json)</h2>
    <p>
      Trigger.json은 로그 패턴 기반의 <strong>이벤트 감지 규칙</strong>을 정의하는 설정 파일입니다.
      에이전트가 AccessLog 소스를 감시하다가 지정된 정규식 패턴에 매칭되면,
      시나리오 실행, 이메일 발송, 팝업 표시 등의 동작을 자동으로 수행합니다.
    </p>
    <p>
      하나의 트리거는 여러 <strong>레시피 스텝</strong>으로 구성되어 순차적인 체인 매칭이 가능합니다.
      예를 들어 "ERROR가 3회 발생한 후 5분 이내에 FATAL이 나타나면 시나리오 실행"과 같은
      복합 조건을 정의할 수 있습니다.
    </p>

    <div class="callout-info">
      <div class="callout-title">AccessLog 소스와의 관계</div>
      <p>
        트리거는 AccessLog.json에서 정의한 로그 소스를 참조합니다.
        트리거의 "로그 소스" 필드에서 감시할 소스를 선택하며,
        선택한 소스 이름은 ARSAgent.json의 ErrorTrigger/AccessLogLists에도 자동 반영됩니다.
      </p>
    </div>

    <!-- ===== 1. 폼 개요 ===== -->
    <h3>1. 폼 개요</h3>
    <HelpImage name="config-trigger-form-overview" alt="Trigger 폼 전체" caption="Trigger Form 뷰 — 트리거 카드 목록, 각 카드별 접기/펼치기, 드래그 정렬" />
    <p>
      Trigger 폼은 <strong>트리거 카드</strong> 목록으로 구성됩니다. 각 카드가 하나의 트리거 규칙을 나타냅니다.
    </p>
    <ul>
      <li><strong>"+ 트리거 추가"</strong> 버튼으로 새 트리거를 추가합니다</li>
      <li>카드 좌측 핸들을 드래그하여 순서를 변경할 수 있습니다</li>
      <li>카드 헤더에는 트리거 이름과 참조 소스(배지)가 표시됩니다</li>
      <li>카드 헤더를 클릭하면 접기/펼치기가 전환됩니다</li>
    </ul>

    <!-- ===== 2. 기본 설정 ===== -->
    <h3>2. 트리거 기본 설정</h3>

    <h4>2.1 트리거 이름</h4>
    <p>
      트리거의 고유 식별자입니다. ARSAgent.json의 ErrorTrigger에서 이 이름으로 참조되므로
      고유하고 의미 있는 이름을 사용하세요.
    </p>

    <h4>2.2 로그 소스 선택</h4>
    <p>
      이 트리거가 감시할 로그 소스를 선택합니다.
      AccessLog.json에서 정의된 소스 목록이 체크박스로 표시되며, <strong>복수 선택</strong>이 가능합니다.
      선택된 소스는 콤마로 구분되어 JSON에 저장됩니다.
    </p>

    <h4>2.3 트리거 클래스</h4>
    <p>
      트리거 카드 하단의 <strong>"+ Class 추가"</strong> 버튼을 클릭하면 보라색 섹션이 나타납니다.
    </p>
    <table>
      <thead>
        <tr><th>클래스</th><th>설명</th></tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>none (기본)</strong></td>
          <td>하나의 체인으로 동작. 스텝 1이 매칭되면 스텝 2를 기다리고, 순차적으로 진행</td>
        </tr>
        <tr>
          <td><strong>MULTI</strong></td>
          <td>첫 번째 스텝에서 추출한 값별로 <strong>독립적인 체인 인스턴스</strong>를 생성.
            예: 장비 ID별로 별도의 트리거 체인을 추적하여 장비별 독립 감지 가능</td>
        </tr>
      </tbody>
    </table>

    <!-- ===== 3. 레시피 스텝 ===== -->
    <h3>3. 레시피 스텝 (Recipe Steps)</h3>
    <HelpImage name="config-trigger-recipe-steps" alt="레시피 스텝" caption="순차적 스텝 체인 — 각 스텝의 패턴 매칭 조건 + 다음 동작 지정" />
    <p>
      각 트리거는 하나 이상의 <strong>레시피 스텝</strong>으로 구성됩니다.
      스텝은 번호순으로 체인처럼 연결되며, 이전 스텝이 발동해야 다음 스텝의 감시가 시작됩니다.
      <strong>"+ 스텝 추가"</strong> 버튼으로 스텝을 추가합니다.
    </p>

    <h4>3.1 스텝 기본 필드</h4>
    <table>
      <thead>
        <tr><th>필드</th><th>설명</th></tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>스텝 이름</strong></td>
          <td>고유 식별자. 다른 스텝의 next 필드에서 참조 가능</td>
        </tr>
        <tr>
          <td><strong>매칭 타입</strong></td>
          <td><code>regex</code>: 정규식 패턴 매칭 / <code>delay</code>: 조건 매칭 시 체인 리셋(취소) 스텝</td>
        </tr>
        <tr>
          <td><strong>감시 기간 (Duration)</strong></td>
          <td>이전 스텝 발동 후 이 스텝이 발동되어야 하는 시간 제한.
            예: <code>10 minutes</code>. 비워두면 무제한 대기</td>
        </tr>
        <tr>
          <td><strong>감지 횟수 (Times)</strong></td>
          <td>이 스텝이 발동하기 위해 필요한 패턴 매칭 횟수 (기본 1)</td>
        </tr>
        <tr>
          <td><strong>다음 동작 (Next)</strong></td>
          <td>스텝 발동 후 실행할 동작 선택 (아래 3.5 참조)</td>
        </tr>
      </tbody>
    </table>

    <h4>3.2 트리거 패턴</h4>
    <p>
      태그 입력 형태로 정규식 패턴을 등록합니다. Enter로 추가하고, 태그를 더블클릭하여 수정할 수 있습니다.
      등록된 패턴 중 <strong>하나라도 매칭</strong>되면 해당 스텝이 카운트됩니다.
    </p>
    <p>예시 패턴:</p>
    <ul>
      <li><code>.*ERROR.*</code> — 라인에 "ERROR" 문자열이 포함되면 매칭</li>
      <li><code>.*S3F216.*Reply.*</code> — SECS 프로토콜 응답 메시지 감지</li>
      <li><code>.*temperature=&lt;&lt;temp&gt;&gt;.*</code> — 변수 추출 포함 패턴</li>
    </ul>

    <h4>3.3 변수 추출 문법</h4>
    <p>
      정규식 패턴 내에서 <strong>특수 문법</strong>을 사용하여 로그 라인에서 값을 추출할 수 있습니다.
      추출된 값은 Params 조건에서 비교 대상으로 활용됩니다.
    </p>
    <table>
      <thead>
        <tr><th>문법</th><th>설명</th><th>예시</th></tr>
      </thead>
      <tbody>
        <tr>
          <td><code>(&lt;&lt;변수명&gt;&gt;패턴)</code></td>
          <td>커스텀 추출 — 지정된 패턴으로 캡처</td>
          <td><code>(&lt;&lt;code&gt;&gt;[A-Z]{3})</code> &rarr; 대문자 3자 추출</td>
        </tr>
      </tbody>
    </table>

    <h4>3.4 Params 조건 (파라미터 비교)</h4>
    <HelpImage name="config-trigger-params-editor" alt="Params 조건 에디터" caption="패턴 태그 클릭 → Params 에디터 — 추출 변수에 대한 비교 조건 설정" />
    <p>
      변수 추출 문법이 포함된 패턴 태그를 클릭하면 <strong>Params 조건 에디터</strong>가 펼쳐집니다.
      <strong>"+ 조건 추가"</strong> 버튼으로 비교 조건을 등록합니다.
    </p>
    <p>
      패턴이 매칭되더라도 Params 조건이 모두 충족되지 않으면 해당 매칭은 <strong>거부</strong>되어 카운트에 포함되지 않습니다.
    </p>
    <table>
      <thead>
        <tr><th>요소</th><th>설명</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>추출 변수</td>
          <td>비교할 변수 선택 (패턴에서 추출된 변수 목록)</td>
        </tr>
        <tr>
          <td>연산자</td>
          <td><code>EQ</code>(같음), <code>NEQ</code>(다름), <code>GT</code>(초과), <code>GTE</code>(이상), <code>LT</code>(미만), <code>LTE</code>(이하)</td>
        </tr>
        <tr>
          <td>비교값</td>
          <td>추출 변수와 비교할 기준값</td>
        </tr>
      </tbody>
    </table>
    <p>
      <strong>예시</strong>: 패턴 <code>temp=&lt;&lt;value&gt;&gt;</code>에서 추출한 value가 95.0 초과인 경우만 매칭
      &rarr; 변수: value, 연산자: GT, 비교값: 95.0
    </p>

    <h4>3.5 Next Action (다음 동작)</h4>
    <p>스텝이 발동된 후 실행할 동작을 선택합니다:</p>
    <table>
      <thead>
        <tr><th>동작</th><th>설명</th></tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>다음 스텝명</strong></td>
          <td>지정된 스텝으로 체인을 이어갑니다</td>
        </tr>
        <tr>
          <td><code>@recovery</code></td>
          <td>Recovery 시나리오를 실행합니다. 인자에 시나리오 이름 지정</td>
        </tr>
        <tr>
          <td><code>@script</code></td>
          <td>코드 기반(Scala) 스크립트를 실행합니다 (아래 3.6 참조)</td>
        </tr>
        <tr>
          <td><code>@notify</code></td>
          <td>이메일 알림을 발송합니다</td>
        </tr>
        <tr>
          <td><code>@popup</code></td>
          <td>클라이언트 화면에 팝업을 표시합니다</td>
        </tr>
        <tr>
          <td><code>@suspend</code></td>
          <td>지정된 트리거의 발동을 일시 차단합니다 (아래 3.7 참조)</td>
        </tr>
        <tr>
          <td><code>@resume</code></td>
          <td>차단된 트리거의 발동을 다시 허용합니다</td>
        </tr>
      </tbody>
    </table>

    <h4>3.6 스크립트 설정 (@script)</h4>
    <p>
      Next Action으로 <code>@script</code>를 선택하면 앰버(황갈색) 배경의 스크립트 설정 섹션이 나타납니다.
    </p>
    <table>
      <thead>
        <tr><th>필드</th><th>설명</th></tr>
      </thead>
      <tbody>
        <tr><td>스크립트 파일명</td><td>에이전트의 스크립트 디렉토리에 위치한 파일 (예: <code>Test.scala</code>)</td></tr>
        <tr><td>인자 (Arguments)</td><td>세미콜론(;)으로 구분된 스크립트 인자</td></tr>
        <tr><td>이메일 비발송 조건</td><td>이메일을 보내지 않을 결과값 (success/fail 체크박스)</td></tr>
        <tr><td>키 (Key)</td><td>동일 키의 스크립트는 동시 실행 방지</td></tr>
        <tr><td>타임아웃</td><td>실행 최대 대기 시간 (예: <code>30 seconds</code>)</td></tr>
        <tr><td>재시도 간격</td><td>실패 시 재시도 대기 시간 (예: <code>3 minutes</code>)</td></tr>
      </tbody>
    </table>

    <h4>3.7 Suspend/Resume 설정</h4>
    <p>
      <code>@suspend</code> 선택 시 차단할 트리거 목록과 차단 기간을,
      <code>@resume</code> 선택 시 해제할 트리거 목록을 설정합니다.
      드롭다운에서 트리거 이름을 선택하고 항목을 추가합니다.
    </p>

    <!-- ===== 4. Limitation ===== -->
    <h3>4. Limitation (발동 제한)</h3>
    <p>
      트리거 카드 하단의 <strong>"+ Limitation 추가"</strong> 버튼을 클릭하면 녹색 배경의 섹션이 나타납니다.
      알림 폭주를 방지하기 위해 일정 시간 내 최대 발동 횟수를 제한합니다.
    </p>
    <table>
      <thead>
        <tr><th>필드</th><th>설명</th><th>기본값</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>최대 트리거 횟수 (times)</td>
          <td>제한 기간 내 허용되는 최대 발동 횟수</td>
          <td>1</td>
        </tr>
        <tr>
          <td>제한 기간 (duration)</td>
          <td>횟수 제한이 적용되는 시간 범위</td>
          <td>1 minutes</td>
        </tr>
      </tbody>
    </table>
    <div class="callout-warning">
      <div class="callout-title">Limitation 설정 권장</div>
      <p>
        Limitation이 없으면 동일 조건의 로그가 반복될 때마다 매번 시나리오가 실행되어
        시스템에 과부하가 발생할 수 있습니다. 특히 <code>@recovery</code> 또는 <code>@script</code>
        동작을 사용하는 트리거에는 반드시 Limitation을 설정하세요.
      </p>
    </div>

    <!-- ===== 5. 테스트 기능 ===== -->
    <h3>5. 테스트 기능</h3>
    <HelpImage name="config-trigger-test-panel" alt="Trigger 테스트 패널" caption="패턴 매칭 테스트 — 텍스트 입력 / 파일 시뮬레이션 2가지 모드" />
    <p>
      각 트리거 카드 하단에 <strong>패턴 매칭 테스트</strong> 패널이 있습니다.
      설정한 레시피가 실제 로그에서 어떻게 동작하는지 <strong>저장 전에 시뮬레이션</strong>할 수 있습니다.
      테스트는 로컬에서만 실행되며 실제 에이전트에 명령을 보내지 않습니다.
    </p>

    <h4>5.1 텍스트 입력 모드</h4>
    <HelpImage name="config-trigger-test-text-result" alt="텍스트 모드 테스트 결과" caption="스텝별 매칭 결과 — 매칭된 라인, 추출 변수, Duration/Times 충족 여부" />
    <p>
      로그 텍스트를 직접 입력하고 <strong>"테스트"</strong> 버튼을 클릭합니다.
      각 라인이 레시피 스텝의 패턴과 매칭되는 과정이 순서대로 표시됩니다.
    </p>

    <h4>5.2 파일 시뮬레이션 모드</h4>
    <p>
      <strong>"파일 시뮬레이션"</strong> 탭으로 전환하면 로그 파일을 드래그&amp;드롭 또는 클릭으로 업로드할 수 있습니다.
      여러 파일을 동시에 업로드할 수 있으며, <strong>"시뮬레이션 실행"</strong> 버튼을 클릭하면
      모든 파일의 라인을 순차 처리하여 결과를 보여줍니다.
    </p>
    <p>
      지원 파일 형식: <code>.log</code>, <code>.txt</code>, <code>.csv</code>
    </p>

    <h4>5.3 Timestamp Format</h4>
    <p>
      Duration 체크를 위해 로그 라인의 타임스탬프 형식을 지정합니다.
      프리셋 목록에서 선택하거나 "Custom"을 선택하여 직접 입력할 수 있습니다.
    </p>
    <ul>
      <li><code>yyyy-MM-dd HH:mm:ss</code> (가장 일반적)</li>
      <li><code>yyyy-MM-dd HH:mm:ss.SSS</code> (밀리초 포함)</li>
      <li><code>yyyy/MM/dd HH:mm:ss</code></li>
      <li>Custom — 직접 입력</li>
    </ul>

    <h4>5.4 테스트 결과 해석</h4>
    <p>테스트 실행 후 다음 정보가 표시됩니다:</p>

    <h5>스텝별 매칭 결과</h5>
    <p>
      각 스텝마다 카드 형태로 결과가 표시됩니다:
    </p>
    <ul>
      <li><strong>매칭 횟수</strong> — 필요한 횟수(Times) 대비 실제 매칭된 횟수</li>
      <li><strong>매칭된 라인</strong> — 파일명:라인번호, 매칭된 텍스트, 사용된 패턴</li>
      <li><strong>추출 변수</strong> — 인디고(남색) 배지로 변수명=값 표시</li>
      <li><strong>Params 조건 결과</strong> — 각 조건의 통과(&#10003;)/실패(&#10007;) 여부</li>
      <li><strong>Duration 체크</strong> — 이전 스텝 발동 후 경과 시간이 제한 내인지 표시</li>
      <li><strong>거부된 매칭</strong> — 정규식은 매칭되었으나 Params 조건 미충족으로 거부된 라인 (빨간색)</li>
    </ul>

    <h5>최종 결과</h5>
    <p>
      모든 스텝 결과 아래에 최종 발동 여부가 표시됩니다:
    </p>
    <ul>
      <li><strong>녹색 배경 "발동됨"</strong> — 모든 스텝 조건이 충족되어 트리거가 발동</li>
      <li><strong>노란색 배경 "발동 대기"</strong> — 일부 스텝이 아직 미충족</li>
    </ul>

    <h5>MULTI 모드 결과</h5>
    <p>
      트리거 클래스가 MULTI인 경우, 인스턴스별 카드로 결과가 표시됩니다.
      각 인스턴스는 첫 스텝에서 추출된 값으로 구분되며, 독립적인 발동/취소/미완료 상태를 갖습니다.
    </p>

    <h5>Limitation 적용 결과</h5>
    <p>
      Limitation이 설정된 경우, 테스트 결과 하단에 발동 제한 통계가 표시됩니다:
    </p>
    <ul>
      <li>시간 범위 내 감지된 발동 수 vs 허용된 발동 수</li>
      <li>각 발동마다 "발동" 또는 "억제(제한 초과)" 상태 표시</li>
      <li>억제된 발동이 있으면 실제로는 동작이 실행되지 않습니다</li>
    </ul>

    <div class="callout-info">
      <div class="callout-title">테스트 시 주의사항</div>
      <p>
        테스트는 순수한 패턴 매칭 시뮬레이션입니다. 실제 에이전트와 통신하지 않으며,
        시나리오 실행이나 이메일 발송 등의 동작은 수행되지 않습니다.
        Duration 체크를 정확히 수행하려면 올바른 Timestamp Format을 설정해야 합니다.
      </p>
    </div>
  </div>
</template>
