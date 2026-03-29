<script setup>
import HelpImage from '../HelpImage.vue'
</script>

<template>
  <div class="help-prose">
    <h2>ARSAgent 설정 (ARSAgent.json)</h2>
    <p>
      ARSAgent.json은 ARSAgent의 핵심 동작을 제어하는 설정 파일입니다.
      서버 연결 정보, 예약 작업(CronTab), 트리거/로그소스 활성화, 스냅샷, 모니터링 주기 등
      에이전트의 전반적인 동작 방식을 정의합니다.
    </p>
    <p>
      Config Manager에서 ARSAgent 탭을 선택하고 <strong>Form / JSON</strong> 토글을 Form으로 전환하면
      아래와 같은 구조화된 입력 폼이 표시됩니다.
    </p>

    <div class="callout-info">
      <div class="callout-title">다른 Config 파일과의 연동</div>
      <p>
        ARSAgent.json의 폼은 <strong>Trigger.json</strong>과 <strong>AccessLog.json</strong>의 내용을
        자동으로 참조합니다. 트리거 이름과 로그 소스 이름이 해당 파일에서 추출되어 체크박스 목록으로
        표시되므로, Trigger.json과 AccessLog.json을 먼저 설정하는 것을 권장합니다.
      </p>
    </div>

    <!-- ===== 1. 폼 개요 ===== -->
    <h3>1. 폼 개요</h3>
    <HelpImage name="config-arsagent-form-overview" alt="ARSAgent 폼 전체" caption="ARSAgent Form 뷰 — 상단부터 활성 트리거, CronTab, 필수 설정, 선택 항목 순으로 배치" />
    <p>
      ARSAgent 폼은 위에서 아래로 다음 순서의 섹션으로 구성됩니다:
    </p>
    <ol>
      <li><strong>활성 트리거 & 로그 소스</strong> — 사용할 트리거와 로그 소스 선택</li>
      <li><strong>CronTab (예약 작업)</strong> — 주기적으로 실행할 작업 등록</li>
      <li><strong>필수 설정 필드</strong> — 네트워크, 시스템 통신 등 8개 그룹</li>
      <li><strong>선택 항목</strong> — 필요 시 추가하는 옵션 필드</li>
    </ol>
    <p>
      폼 우측에는 <strong>JSON Preview</strong> 패널이 표시되어, 폼에서 변경한 내용이
      실시간으로 JSON에 어떻게 반영되는지 확인할 수 있습니다.
    </p>

    <!-- ===== 2. 활성 트리거 & 로그 소스 ===== -->
    <h3>2. 활성 트리거 & 로그 소스</h3>
    <HelpImage name="config-arsagent-trigger-source" alt="활성 트리거 & 로그 소스" caption="좌측: ErrorTrigger 체크박스, 우측: AccessLogLists 체크박스 — 트리거 선택 시 로그 소스 자동 연결" />
    <p>
      폼 상단에 2열 레이아웃으로 표시되는 이 섹션에서는 에이전트가 사용할 트리거와 로그 소스를 선택합니다.
    </p>

    <h4>2.1 ErrorTrigger (트리거 선택)</h4>
    <p>
      좌측 패널에는 <strong>Trigger.json</strong>에서 정의된 트리거 이름이 체크박스 목록으로 표시됩니다.
      활성화할 트리거를 선택하면 에이전트가 해당 트리거 규칙으로 로그를 감시합니다.
    </p>
    <div class="callout-info">
      <div class="callout-title">자동 소스 연결</div>
      <p>
        트리거를 선택하면, 해당 트리거가 참조하는 AccessLog 소스가 <strong>우측 로그 소스 목록에 자동으로 선택</strong>됩니다.
        반대로 트리거를 해제하면, 다른 트리거가 사용하지 않는 소스만 자동으로 해제됩니다.
      </p>
    </div>
    <p>
      Trigger.json에 트리거가 아직 정의되지 않았으면 "trigger.json에서 먼저 트리거를 추가해주세요" 안내가 표시됩니다.
    </p>

    <h4>2.2 AccessLogLists (로그 소스 선택)</h4>
    <p>
      우측 패널에는 <strong>AccessLog.json</strong>에서 정의된 로그 소스 이름이 체크박스 목록으로 표시됩니다.
      에이전트가 모니터링할 로그 소스를 선택합니다.
      트리거 선택으로 자동 연결된 소스 외에 수동으로 추가 선택할 수도 있습니다.
    </p>

    <!-- ===== 3. CronTab ===== -->
    <h3>3. CronTab (예약 작업)</h3>
    <HelpImage name="config-arsagent-crontab" alt="CronTab 예약 작업" caption="CronTab — 접기/펼치기 카드 형태, SA 타입 선택 시 Suspend 에디터 표시" />
    <p>
      CronTab은 에이전트가 주기적으로 실행할 예약 작업을 정의하는 섹션입니다.
      하단의 <strong>"+ CronTab 추가"</strong> 버튼으로 새 항목을 추가하고,
      각 항목의 화살표를 클릭하여 펼치거나 접을 수 있습니다.
    </p>

    <h4>3.1 Action Type (작업 유형)</h4>
    <p>각 CronTab 항목의 핵심 필드는 <strong>Action 타입</strong>이며, 6가지 유형이 있습니다:</p>
    <table>
      <thead>
        <tr>
          <th>타입</th>
          <th>이름</th>
          <th>설명</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>AR</code></td>
          <td>시나리오 실행</td>
          <td>지정된 시나리오를 주기적으로 실행합니다</td>
        </tr>
        <tr>
          <td><code>SR</code></td>
          <td>코드 시나리오</td>
          <td>코드 기반(Scala) 시나리오를 실행합니다</td>
        </tr>
        <tr>
          <td><code>EN</code></td>
          <td>이메일 발송</td>
          <td>지정된 수신자에게 이메일 알림을 발송합니다</td>
        </tr>
        <tr>
          <td><code>PU</code></td>
          <td>팝업 실행</td>
          <td>클라이언트 화면에 팝업을 표시합니다</td>
        </tr>
        <tr>
          <td><code>SA</code></td>
          <td>트리거 실행 제한</td>
          <td>지정된 트리거의 발동을 일시적으로 차단합니다 (Suspend)</td>
        </tr>
        <tr>
          <td><code>RA</code></td>
          <td>트리거 실행 제한 해제</td>
          <td>차단된 트리거의 발동을 다시 허용합니다 (Resume)</td>
        </tr>
      </tbody>
    </table>

    <h4>3.2 CronTab 필드</h4>
    <table>
      <thead>
        <tr>
          <th>필드</th>
          <th>설명</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Action 이름</td>
          <td>실행할 시나리오 또는 작업의 이름 (필수)</td>
        </tr>
        <tr>
          <td>Action 타입</td>
          <td>위 표의 6가지 유형 중 선택 (필수)</td>
        </tr>
        <tr>
          <td>인자 (Arguments)</td>
          <td>작업에 전달할 인자, 세미콜론(;)으로 구분</td>
        </tr>
        <tr>
          <td>이메일 비발송 조건</td>
          <td>이메일을 보내지 않을 결과값 (success/fail 체크박스)</td>
        </tr>
        <tr>
          <td>실행 키</td>
          <td>동일 키의 작업은 동시 실행 방지 (숫자)</td>
        </tr>
        <tr>
          <td>타임아웃</td>
          <td>작업 최대 대기 시간 (예: <code>30 seconds</code>)</td>
        </tr>
        <tr>
          <td>재시도 간격</td>
          <td>실패 시 재시도 대기 시간 (예: <code>3 minutes</code>)</td>
        </tr>
      </tbody>
    </table>

    <h4>3.3 Suspend/Resume 에디터</h4>
    <p>
      Action 타입을 <code>SA</code>(Suspend)로 선택하면 하단에 <strong>Suspend 에디터</strong>가 나타납니다.
      제한할 트리거 이름을 드롭다운에서 선택하고, 제한 기간(duration)을 입력합니다.
      <code>RA</code>(Resume) 타입은 해제할 트리거만 선택하면 됩니다 (기간 불필요).
    </p>
    <div class="callout-info">
      <div class="callout-title">유효하지 않은 트리거 자동 제거</div>
      <p>
        Trigger.json에서 삭제된 트리거명은 Suspend/Resume 목록에서 자동으로 제거됩니다.
      </p>
    </div>

    <!-- ===== 4. 필수 설정 필드 ===== -->
    <h3>4. 필수 설정 필드</h3>
    <p>
      필수 설정 필드는 8개 그룹으로 분류되어 2열 그리드로 표시됩니다.
      각 필드에는 라벨과 설명이 제공되며, 기본값이 미리 채워져 있습니다.
    </p>

    <h4>4.1 네트워크</h4>
    <table>
      <thead>
        <tr><th>필드</th><th>설명</th><th>기본값</th></tr>
      </thead>
      <tbody>
        <tr><td>가상 주소 목록</td><td>Akka 서버의 가상 주소, 콤마(,) 구분</td><td>(빈 값)</td></tr>
        <tr><td>RPC 포트</td><td>에이전트가 서버 요청을 수신하는 포트</td><td>50100</td></tr>
      </tbody>
    </table>

    <h4>4.2 시스템 통신</h4>
    <table>
      <thead>
        <tr><th>필드</th><th>설명</th><th>기본값</th></tr>
      </thead>
      <tbody>
        <tr><td>Alive 신호 주기</td><td>서버에 생존 신호를 보내는 주기</td><td>5 minutes</td></tr>
        <tr><td>Redis Ping 주기</td><td>Redis 서버에 Ping을 보내는 주기</td><td>5 minutes</td></tr>
        <tr><td>Redis 상태 전송</td><td>에이전트 상태를 Redis에 전송할지 여부</td><td>미사용</td></tr>
        <tr><td>서버 주소 갱신 주기</td><td>Akka 서버 주소 목록을 갱신하는 주기</td><td>100 minutes</td></tr>
      </tbody>
    </table>

    <h4>4.3 시나리오/이벤트</h4>
    <table>
      <thead>
        <tr><th>필드</th><th>설명</th><th>기본값</th></tr>
      </thead>
      <tbody>
        <tr><td>시나리오 체크 주기</td><td>대기 중인 시나리오 실행 요청 확인 주기</td><td>1 seconds</td></tr>
        <tr><td>이벤트 무시 간격</td><td>동일 이벤트 연속 발생 시 무시하는 최소 간격</td><td>300 milliseconds</td></tr>
      </tbody>
    </table>

    <h4>4.4 스냅샷</h4>
    <table>
      <thead>
        <tr><th>필드</th><th>설명</th><th>기본값</th></tr>
      </thead>
      <tbody>
        <tr><td>스냅샷 녹화</td><td>화면 스냅샷 녹화 사용 여부</td><td>사용</td></tr>
        <tr><td>복구 중 스냅샷 녹화</td><td>복구 시나리오 실행 중 녹화 여부</td><td>미사용</td></tr>
        <tr><td>스냅샷 포맷</td><td>이미지 형식 (png, jpg)</td><td>png</td></tr>
        <tr><td>이미지 전송 주기</td><td>스냅샷을 서버로 전송하는 주기</td><td>5 seconds</td></tr>
      </tbody>
    </table>

    <h4>4.5 UI/마우스</h4>
    <table>
      <thead>
        <tr><th>필드</th><th>설명</th><th>기본값</th></tr>
      </thead>
      <tbody>
        <tr><td>마우스 이벤트 지연</td><td>클릭 처리 지연 시간 (ms)</td><td>300</td></tr>
        <tr><td>더블클릭 지연</td><td>더블클릭 판정 최대 간격 (ms)</td><td>50</td></tr>
        <tr><td>알림 대화상자 크기</td><td>에이전트 알림 팝업 크기 (너비:높이)</td><td>800:280</td></tr>
      </tbody>
    </table>

    <h4>4.6 CPU/메모리</h4>
    <table>
      <thead>
        <tr><th>필드</th><th>설명</th><th>기본값</th></tr>
      </thead>
      <tbody>
        <tr><td>CPU 모니터링 주기</td><td>CPU 사용률 측정 주기</td><td>2 minutes</td></tr>
        <tr><td>메모리 모니터링 주기</td><td>메모리 사용률 측정 주기</td><td>10 minutes</td></tr>
        <tr><td>전체 CPU 제한 (%)</td><td>이 값 초과 시 경고</td><td>90</td></tr>
        <tr><td>에이전트 CPU 제한 (%)</td><td>에이전트 프로세스 CPU 초과 시 경고</td><td>20</td></tr>
      </tbody>
    </table>

    <h4>4.7 파일/데이터</h4>
    <table>
      <thead>
        <tr><th>필드</th><th>설명</th><th>기본값</th></tr>
      </thead>
      <tbody>
        <tr><td>파일 변경 감지 주기</td><td>모니터링 대상 파일 변경 확인 주기</td><td>10 seconds</td></tr>
        <tr><td>로그 업로드 사용</td><td>에이전트 로그를 서버로 업로드할지 여부</td><td>사용</td></tr>
        <tr><td>리소스 모니터 주기</td><td>시스템 리소스 모니터링 주기</td><td>2 minutes</td></tr>
        <tr><td>데이터 백업 사용</td><td>에이전트 데이터 자동 백업 여부</td><td>미사용</td></tr>
      </tbody>
    </table>

    <h4>4.8 라우터/통신</h4>
    <table>
      <thead>
        <tr><th>필드</th><th>설명</th><th>기본값</th></tr>
      </thead>
      <tbody>
        <tr><td>라우터 사용</td><td>내부 네트워크 라우터를 통한 서버 접속 여부</td><td>미사용</td></tr>
        <tr><td>사설 IP 패턴</td><td>라우터 사용 시 사설 IP 대역 식별 정규식</td><td>(빈 값)</td></tr>
        <tr><td>팝업 로컬 모드</td><td>팝업 리소스를 로컬에서 로드할지 여부</td><td>미사용</td></tr>
      </tbody>
    </table>

    <!-- ===== 5. 선택 항목 ===== -->
    <h3>5. 선택 항목 (Optional Fields)</h3>
    <p>
      선택 항목은 기본적으로 JSON에 포함되지 않으며, 각 필드 좌측의 <strong>체크박스를 활성화</strong>해야
      JSON에 추가됩니다. 비활성화하면 해당 키가 JSON에서 제거됩니다.
    </p>
    <table>
      <thead>
        <tr>
          <th>필드</th>
          <th>설명</th>
          <th>기본값</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>ScreenProtector 포트</td>
          <td>ScreenProtector 서비스가 사용하는 포트</td>
          <td>32126</td>
        </tr>
        <tr>
          <td>독립 실행 모드</td>
          <td>서버 연결 없이 에이전트를 단독 실행</td>
          <td>미사용</td>
        </tr>
        <tr>
          <td>장비 로그 표시</td>
          <td>에이전트 UI에 장비 로그를 표시</td>
          <td>미사용</td>
        </tr>
        <tr>
          <td>Vision 타입</td>
          <td>화면 인식 엔진 통신 프로토콜 (thrift / grpc / http)</td>
          <td>thrift</td>
        </tr>
        <tr>
          <td>Command 타입</td>
          <td>명령 실행 엔진 통신 프로토콜 (http / grpc)</td>
          <td>http</td>
        </tr>
      </tbody>
    </table>

    <div class="callout-warning">
      <div class="callout-title">시간 값 입력 형식</div>
      <p>
        시간 관련 필드에는 <code>5 minutes</code>, <code>30 seconds</code>, <code>300 milliseconds</code>와 같이
        "숫자 + 단위" 형식으로 입력합니다. 사용 가능한 단위: seconds, minutes, hours, milliseconds.
      </p>
    </div>
  </div>
</template>
