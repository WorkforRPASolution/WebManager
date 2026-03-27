# Manual Screenshot Seed Data Manifest

## 생성 / 삭제 방법
```bash
cd server
node scripts/seedManualData.js              # 데이터 생성
node scripts/seedManualData.js --status     # 현재 상태 확인
node scripts/seedManualData.js --cleanup    # 데이터 삭제
```

## 식별자
모든 데이터에 `_manual_seed_` 마커가 포함되어 있어 기존 데이터와 구분 가능.

| 컬렉션 | 마커 필드 | 마커 값 |
|--------|----------|---------|
| EQP_INFO | `note` | `_manual_seed_` |
| ARS_USER_INFO | `note` | `_manual_seed_` |
| EMAIL_TEMPLATE_REPOSITORY | `html` 내부 | `_manual_seed_` |
| WEBMANAGER_LOG | `details` | `_manual_seed_` |
| Redis | N/A | EQP_INFO의 eqpId 기반 키 |

## 생성 데이터 상세

### EQP_INFO (40건)
| Process | Model | 장비 수 | eqpId 패턴 |
|---------|-------|---------|-----------|
| CVD | CVD-100 | 5 | CVD-CVD-100-01 ~ 05 |
| CVD | CVD-200 | 5 | CVD-CVD-200-01 ~ 05 |
| ETCH | ETCH-A | 5 | ETCH-ETCH-A-01 ~ 05 |
| ETCH | ETCH-B | 5 | ETCH-ETCH-B-01 ~ 05 |
| PHOTO | PHOTO-X | 5 | PHOTO-PHOTO-X-01 ~ 05 |
| PHOTO | PHOTO-Y | 5 | PHOTO-PHOTO-Y-01 ~ 05 |
| DIFF | DIFF-300 | 5 | DIFF-DIFF-300-01 ~ 05 |
| DIFF | DIFF-400 | 5 | DIFF-DIFF-400-01 ~ 05 |

### ARS_USER_INFO (15건)
| singleid | 이름 | 역할 | 공정 | 상태 |
|----------|------|------|------|------|
| conductor01 | 김공정 | Conductor | CVD;ETCH | active |
| conductor02 | 이장비 | Conductor | PHOTO;DIFF | active |
| manager01 | 박관리 | Manager | CVD | active |
| manager02 | 최운영 | Manager | ETCH | active |
| user01~10 | 다양 | User | 각 1~3개 공정 | active |
| user_pending | 조대기 | User | CVD | pending |

### EMAIL_TEMPLATE_REPOSITORY (8건)
| Process | Model | Code | SubCode | 제목 |
|---------|-------|------|---------|------|
| CVD | CVD-100 | RECOVERY | SUCCESS | Recovery 성공 알림 |
| CVD | CVD-100 | RECOVERY | FAIL | Recovery 실패 알림 |
| CVD | CVD-200 | ALARM | CRITICAL | Critical 알람 발생 |
| ETCH | ETCH-A | RECOVERY | SUCCESS | ETCH Recovery 성공 |
| ETCH | ETCH-B | REPORT | DAILY | 일일 보고서 |
| PHOTO | PHOTO-X | ALARM | WARNING | Warning 알람 발생 |
| DIFF | DIFF-300 | RECOVERY | SUCCESS | DIFF Recovery 성공 |
| DIFF | DIFF-400 | MAINT | SCHEDULE | 정기 점검 안내 |

### WEBMANAGER_LOG (300건)
| 카테고리 | 건수 | 기간 |
|---------|------|------|
| audit | 50 | 최근 30일 |
| auth | 80 | 최근 14일 |
| access | 100 | 최근 7일 |
| error | 20 | 최근 14일 |
| batch | 50 | 최근 14일 |

### Redis
| 키 패턴 | 수량 | TTL |
|---------|------|-----|
| AgentRunning:{key} | ~34 (85%) | 600초 |
| AgentHealth:ars_agent:{key} | ~34 | 600초 |
| AgentHealth:resource_agent:{key} | ~27 (80% of running) | 600초 |
| AgentMetaInfo:{process}-{model} | 8 hashes | 영구 |
| ResourceAgentMetaInfo:{process}-{model} | 8 hashes | 영구 |

## 주의사항
- Redis TTL이 10분이므로 스크린샷 캡처 전 재실행 필요
- Recovery 데이터는 별도 스크립트: `node scripts/seedRecoveryData.js --reset --count 75000 --days 90`
- admin 계정은 이미 존재한다고 가정 (setupAdmin.js)
