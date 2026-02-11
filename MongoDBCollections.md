| Field Name | Type | 필수/선택 | Description |
|---|---|---|---|
| line | String | 필수 | line info |
| lineDesc | String | 필수 | line description |
| process | String | 필수 | Process Name |
| eqpModel | String | 필수 | Equipment Model |
| eqpId | String | 필수(PK) | Equipment ID |
| category | String | 필수 | Equipment Category |
| IpAddr | String | 필수(PK) | Equipment IP Address |
| IpAddrL | String | 선택 | Equipment IP Address for Inner(local) Network |
| localpcNunber | Long | 필수 | Local PC 여부. 1:Local PC, 0: Local PC 아님 |
| emailcategory | String | 필수 | 사용하는 email category |
| osVer | String | 필수 | OS version |
| onoffNunber | Long | 필수 | Equipment 사용 여부. 1:사용, 0: 미사용 |
| webmanagerUse | Number | 필수 | Web Manager 사용 여부. 1:사용, 0:미사용 |
| installdate | String | 선택 | Client설치일자. format : yyyy-MM-dd |
| scFirstExcute | String | 선택 | Client의 Scenario 최초 동작 일자. format : yyyy-MM-dd |
| snapshotTimeDiff | Number | 선택 | 서버와의 시간 차이 |
| usereleasemsg | Number | 필수 | Release Message 사용 여부. 1:사용, 0: 미사용 |
| usetkincancel | Number | 필수 | TKIN Cancel 사용 여부. 1:사용, 0: 미사용 |

---

## LOG_SETTINGS (WEB_MANAGER DB)

agentGroup별 로그 파일 소스 설정. 서버 시작 시 자동 초기화.

| Field Name | Type | 필수/선택 | Description |
|---|---|---|---|
| agentGroup | String | 필수(PK) | Agent 그룹 ('ars_agent', 'resource_agent') |
| logSources | Array | 필수 | 로그 소스 목록 |
| logSources[].sourceId | String | 필수 | 소스 식별자 ('log_1', 'log_2', ...) |
| logSources[].name | String | 필수 | 소스 표시명 ('Agent Log') |
| logSources[].path | String | 필수 | FTP 상대 디렉토리 경로 ('/log/ARSAgent') |
| logSources[].keyword | String | 선택 | 파일명 필터 ('arsagent', '*') |
| updatedBy | String | 선택 | 마지막 수정자 |
| createdAt | Date | 자동 | 생성 시각 |
| updatedAt | Date | 자동 | 수정 시각 |

### 초기 데이터

| agentGroup | sourceId | name | path | keyword |
|---|---|---|---|---|
| ars_agent | log_1 | Agent Log | /log/ARSAgent | arsagent |
| resource_agent | log_1 | Agent Log | /log/Resource/Agent | resourceagent |

---

## CONFIG_SETTINGS (WEB_MANAGER DB)

agentGroup별 Config 파일 설정. 서버 시작 시 자동 초기화.

| Field Name | Type | 필수/선택 | Description |
|---|---|---|---|
| agentGroup | String | 필수(PK) | Agent 그룹 ('ars_agent', 'resource_agent') |
| configFiles | Array | 필수 | Config 파일 목록 |
| configFiles[].fileId | String | 필수 | 파일 식별자 ('config_1', 'config_2', ...) |
| configFiles[].name | String | 필수 | 파일 표시명 ('Main Config') |
| configFiles[].path | String | 필수 | FTP 상대 경로 ('/config/main.json') |
| updatedBy | String | 선택 | 마지막 수정자 |
| createdAt | Date | 자동 | 생성 시각 |
| updatedAt | Date | 자동 | 수정 시각 |