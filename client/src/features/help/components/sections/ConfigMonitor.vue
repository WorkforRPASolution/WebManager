<script setup>
import HelpImage from '../HelpImage.vue'
</script>

<template>
  <div class="help-prose">
    <h2>Monitor 설정 (Monitor.json)</h2>
    <p>
      Monitor.json은 <strong>ResourceAgent</strong>의 시스템 자원 모니터링 설정 파일입니다.
      14개의 Collector가 각각 CPU, 메모리, 디스크, 네트워크, 온도 등의 시스템 정보를 주기적으로 수집하며,
      이 파일에서 각 Collector의 활성화 여부, 수집 주기, 대상 장치 등을 설정합니다.
    </p>

    <div class="callout-info">
      <div class="callout-title">ResourceAgent 전용</div>
      <p>
        이 Config는 ResourceAgent에서만 사용됩니다. 클라이언트 목록의
        <strong>Resource Agent</strong> 페이지에서 Config Manager를 열면 Monitor 탭이 표시됩니다.
      </p>
    </div>

    <!-- ===== 1. 폼 개요 ===== -->
    <h3>1. 폼 개요</h3>
    <HelpImage name="config-monitor-form-overview" alt="Monitor 폼 전체" caption="Monitor Form 뷰 — 전체 활성화/비활성화 버튼 + 6개 그룹별 Collector 카드" />
    <p>
      Monitor 폼은 다음 구조로 되어 있습니다:
    </p>
    <ul>
      <li><strong>전체 활성화 / 비활성화</strong> 버튼 — 모든 Collector를 한 번에 켜거나 끕니다</li>
      <li><strong>6개 그룹</strong> — 각 그룹은 접기/펼치기가 가능하며, 그룹 헤더에 활성화된 Collector 수가 표시됩니다
        (예: "기본 시스템 2/3")</li>
      <li>각 Collector마다 <strong>활성화 체크박스</strong>, <strong>수집 주기(Interval)</strong>,
        그리고 Collector에 따라 추가 필드가 있습니다</li>
    </ul>

    <!-- ===== 2. 공통 설정 ===== -->
    <h3>2. Collector 공통 설정</h3>

    <h4>Enabled (활성화)</h4>
    <p>
      각 Collector 좌측의 체크박스로 활성화/비활성화합니다.
      비활성화된 Collector는 주기와 추가 필드가 회색 처리되어 수정할 수 없습니다.
    </p>

    <h4>Interval (수집 주기)</h4>
    <p>
      시스템 정보를 수집하는 간격을 설정합니다.
      <strong>Go duration 형식</strong>으로 입력합니다:
    </p>
    <ul>
      <li><code>30s</code> — 30초</li>
      <li><code>60s</code> 또는 <code>1m</code> — 1분</li>
      <li><code>300s</code> 또는 <code>5m</code> — 5분</li>
      <li><code>1h</code> — 1시간</li>
    </ul>

    <!-- ===== 3. 그룹별 상세 ===== -->
    <h3>3. Collector 그룹별 상세</h3>

    <h4>3.1 기본 시스템</h4>
    <table>
      <thead>
        <tr><th>Collector</th><th>설명</th><th>기본 주기</th></tr>
      </thead>
      <tbody>
        <tr><td><strong>CPU</strong></td><td>CPU 사용률을 수집합니다</td><td>30s</td></tr>
        <tr><td><strong>Memory</strong></td><td>메모리 사용량/사용률을 수집합니다</td><td>30s</td></tr>
        <tr><td><strong>Uptime</strong></td><td>시스템 가동 시간을 수집합니다</td><td>300s</td></tr>
      </tbody>
    </table>
    <p>이 그룹의 Collector에는 추가 설정 필드가 없습니다.</p>

    <h4>3.2 디스크</h4>
    <table>
      <thead>
        <tr><th>Collector</th><th>설명</th><th>기본 주기</th><th>추가 필드</th></tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Disk</strong></td>
          <td>디스크 사용량/사용률을 수집합니다</td>
          <td>60s</td>
          <td><strong>대상 디스크</strong> — 모니터링할 드라이브 (예: C:, D:). 비워두면 전체 디스크</td>
        </tr>
        <tr>
          <td><strong>StorageSmart</strong></td>
          <td>디스크 S.M.A.R.T. 건강 상태를 수집합니다</td>
          <td>300s</td>
          <td><strong>대상 디스크</strong> — S.M.A.R.T. 확인 대상 디스크</td>
        </tr>
      </tbody>
    </table>

    <h4>3.3 네트워크</h4>
    <table>
      <thead>
        <tr><th>Collector</th><th>설명</th><th>기본 주기</th><th>추가 필드</th></tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Network</strong></td>
          <td>네트워크 인터페이스별 트래픽을 수집합니다</td>
          <td>30s</td>
          <td><strong>대상 인터페이스</strong> — 모니터링할 네트워크 인터페이스명. 비워두면 전체</td>
        </tr>
      </tbody>
    </table>

    <h4>3.4 하드웨어 센서</h4>
    <table>
      <thead>
        <tr><th>Collector</th><th>설명</th><th>기본 주기</th><th>추가 필드</th></tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Temperature</strong></td>
          <td>CPU/시스템 온도를 수집합니다</td>
          <td>60s</td>
          <td rowspan="5"><strong>대상 Zone</strong> — 모니터링할 센서 영역명. 비워두면 전체</td>
        </tr>
        <tr>
          <td><strong>Fan</strong></td>
          <td>팬 회전 속도를 수집합니다</td>
          <td>60s</td>
        </tr>
        <tr>
          <td><strong>GPU</strong></td>
          <td>GPU 사용률/온도를 수집합니다</td>
          <td>60s</td>
        </tr>
        <tr>
          <td><strong>Voltage</strong></td>
          <td>전압 센서 값을 수집합니다</td>
          <td>60s</td>
        </tr>
        <tr>
          <td><strong>MotherboardTemp</strong></td>
          <td>메인보드 온도를 수집합니다</td>
          <td>60s</td>
        </tr>
      </tbody>
    </table>

    <h4>3.5 프로세스 순위</h4>
    <table>
      <thead>
        <tr><th>Collector</th><th>설명</th><th>기본 주기</th><th>추가 필드</th></tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>CPUProcess</strong></td>
          <td>CPU 사용률 상위 프로세스를 수집합니다</td>
          <td>60s</td>
          <td rowspan="2">
            <strong>Top N</strong> — 상위 몇 개까지 수집 (기본 10)<br/>
            <strong>감시 프로세스</strong> — 순위와 관계없이 항상 수집할 프로세스명
          </td>
        </tr>
        <tr>
          <td><strong>MemoryProcess</strong></td>
          <td>메모리 사용량 상위 프로세스를 수집합니다</td>
          <td>60s</td>
        </tr>
      </tbody>
    </table>

    <h4>3.6 프로세스 감시</h4>
    <table>
      <thead>
        <tr><th>Collector</th><th>설명</th><th>기본 주기</th><th>추가 필드</th></tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>ProcessWatch</strong></td>
          <td>특정 프로세스의 실행 여부를 감시합니다</td>
          <td>60s</td>
          <td>
            <strong>필수 프로세스</strong> — 반드시 실행 중이어야 하는 프로세스. 미실행 시 경고<br/>
            <strong>금지 프로세스</strong> — 실행되면 안 되는 프로세스. 실행 감지 시 경고
          </td>
        </tr>
      </tbody>
    </table>

    <!-- ===== 4. 태그 입력 ===== -->
    <h3>4. 배열 필드 입력 방법</h3>
    <p>
      대상 디스크, 대상 인터페이스, 감시 프로세스 등의 배열 필드는 <strong>태그 입력</strong> 방식으로 관리합니다:
    </p>
    <ul>
      <li>입력 필드에 값을 입력하고 <strong>Enter</strong>를 누르면 태그로 추가됩니다</li>
      <li>각 태그의 <strong>&times;</strong> 버튼을 클릭하면 삭제됩니다</li>
      <li>비워두면 해당 Collector가 모든 대상을 자동으로 감지합니다</li>
    </ul>

    <div class="callout-warning">
      <div class="callout-title">주기 설정 시 주의</div>
      <p>
        수집 주기가 너무 짧으면 클라이언트 시스템에 부하가 발생할 수 있습니다.
        일반적으로 CPU/Memory는 30초, 센서류는 60초, S.M.A.R.T./Uptime은 5분 이상을 권장합니다.
      </p>
    </div>
  </div>
</template>
