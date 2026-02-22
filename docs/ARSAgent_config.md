# trigger.json
{
 "LIMITATION_TEST": {
   "source": "__LogReadInfo__",
   "recipe": [
     {
       "name": "Limitaion_step1",
       "type": "regex",
       "trigger": [
         {
           "syntax": ".*S3F216.*"
         }
         ],
       "duration": "",
       "times": 1,
       "next": "Limitaion_step2"
     },
     {
       "name": "Limitaion_step2",
       "type": "regex",
       "trigger": [
         {
           "syntax": ".*S3F216.*"
         }
         ],
       "duration": "10 minutes",
       "times": 2,
       "next": "@script",
       "script": {
         "name": "Test.scala",
         "arg": "arg1;arg2",
         "no-email": "success;fail",
         "key": 1,
         "timeout": "30 seconds",
         "retry": "3 minutes"
       }
     }
     ],
     "limitation": {
       "times": 1,
       "durtaion": "1 minutes"
     }
 }
}

# AccessLog.json
{
  "__LogReadInfo__": {
    "directory": "C:/EARS/TestFile",
    "prefix": "log_",
    "wildcard": "",
    "suffix": ".txt",
    "log_type": "date_single",
    "date_subdir_format": "'\\'yyyy'\\'MM'\\'dd",
    "reopen": true,
    "access_interval": "10 seconds",
    "exclude_suffix": [],
    "charset": "EUC-KR",
    "back": true,
    "end": false,
    "batch_count": 1000,
    "batch_timeout": "30 seconds"
  }
}

# ARSAgent.json
{
    "ErrorTrigger": [
        {
            "alid": "LIMITATION_TEST"
        }
    ],
    "AccessLogLists": [
        "__LogReadInfo__"
    ]
}



# class MULTI 설정 예제 및 관련 설명
{
 "CLASSS_MULI_TEST": {
   "source": "__LogReadInfo__",
   "recipe": [
     {
       "name": "step_01",
       "type": "regex",
       "trigger": [
         {
           "syntax": ".* error occur. code: (<<code>>[_A-z]+).*"
         }
         ],
       "duration": "",
       "times": 1,
       "next": "step_01"
     },
     {
       "name": "step_02",
       "type": "delay",
       "trigger": [
         {
           "syntax": ".* error reset. code: @<<code>>@.*"
         }
         ],
       "duration": "10 minutes",
       "times": 1,
       "next": "@recovery"
     }
     ],
     "limitation": {
       "times": 1,
       "durtaion": "1 minutes"
     },
     "class": "MULTI"
 }
}

- class 의 용도: 이전 step 에서 추출된 data 를 여러개 임시 저장 후, 이후 step 의 log 매칭 여부 확인 시 텍스트로 치환하여 활용하기 위한 설정
- class 설정 허용 : `"MULTI"`, `"none"` 
- `"MULTI"` : 기능 사용
- `"none"` : 기능 미사용
-  시나리오 예시
 1) 14:10:00 error occur. code: 1234
   : data (1234) 저장. data (1234) 에 대해 step_02 로 이동.
     "syntax": ".* error reset. code: 1234.*" -> @<<code>> 를 1234 로 치환
 2) 14:11:00 error occur. code: 4567
   : data (4567) 저장. data (4567) 에 대해 step_02 로 이동
     "syntax": ".* error reset. code: 4567.*" -> @<<code>> 를 4567 로 치환
 3) 14:12:00 error reset. code: 7890
   : 저장된 data 들에 대해, data 들의 syntax 를 활용하여 매칭 여부 확인. 없으면 아무 동작 안함
 4) 14:13:00 error reset. code: 4567
   : 저장된 data 들에 대해, data 들의 syntax 를 활용하여 매칭 여부 확인. 4567 이 있으므로 매칭. delay type 이므로 4567 에 대한 체인 종료
 5) 14:20:00 이후 reset log 발생하지 않음
   : 저장된 data 중 1234 가 step_02 에서 timeout 발생하였으므로, @recovery 실행. 1234 에 대한 체인 종료 
 * 위의 시나리오는 마지막 step 이 delay 의 경우의 예시이며 regex step 도 사용가능하다
- 저장하는 data 의 수량은 WebManager 의 로그 매칭 기능 테스트에서 관련 코드 및 설계에 따라 재검토한다.

