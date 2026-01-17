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