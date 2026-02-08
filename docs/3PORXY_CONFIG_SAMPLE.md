## System(WebManager 포함) 과 Local PC (ipAddrL 설정이 있는 PC) 통신을 중계하는 3proxy 프로그램의 proxy 설정
socks -p 30000
proxy -p 7184

---
위 설정중 WebManager 가 Client 상태조회/시작/중지 및 config 조회/설정을  위해 사용하는 설정은 socks -p 30000 이다