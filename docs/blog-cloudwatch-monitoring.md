# ECS-less 3-Tier — CloudWatch 기본 모니터링

이전 ECS(`coupang-eats-infra`)에서는 Task `awslogs` + ECS CPU/Memory 알람을 붙였다.  
이번 프로젝트는 **ECS가 없으므로** 같은 목적을 **ALB / ASG·EC2 / Docker awslogs** 로 옮겼다.

---

## 1. 무엇을 붙였는가

| 계층 | 리소스 | 역할 |
|------|--------|------|
| Logs | `/coupang-eats-dev/app/nginx`, `.../nest` | 컨테이너 stdout → CloudWatch (보관 **7일**) |
| ALB 알람 | `*-alb-5xx`, `*-alb-unhealthy-hosts` | 5xx·헬스체크 실패 |
| ASG 알람 | `*-asg-cpu`, `*-asg-status-check`, `*-asg-in-service-low` | CPU·상태검사·InService 부족 |
| DB 알람 | `*-db-{a,b,c}-cpu`, `*-status-check` | 노드별 CPU·상태검사 |
| Dashboard | `coupang-eats-dev-overview` | 한 화면 그래프 + Nest 로그 테이블 |
| IAM | `app` 역할 `logs:PutLogEvents` 등 | Docker awslogs 전송 권한 |

코드 위치:

- `dev_infra/modules/compute/monitoring.tf`
- `dev_infra/modules/compute/iam.tf` (CW Logs 정책)
- `dev_infra/modules/compute/userdata/app.sh` (`logging: awslogs`)
- `dev_infra/modules/database/monitoring.tf`

---

## 2. ECS 시절과의 대응

| ECS (`coupang-eats-infra`) | 이번 (ECS-less) |
|----------------------------|-----------------|
| `/ecs/...` Log Group + Task `awslogs` | `/…/app/nginx`, `/…/app/nest` + Compose `awslogs` |
| `AWS/ECS` CPU·Memory | `AWS/EC2` CPU (ASG dimension) + StatusCheck |
| ALB 5xx / Unhealthy | **동일** (`AWS/ApplicationELB`) |
| Container Insights | 미사용 (비용·범위 밖) |
| — | ASG `GroupInServiceInstances` |
| — | DB EC2 노드별 CPU/StatusCheck |

---

## 3. 트래픽·로그가 흐르는 길

```text
[Nest/Nginx 컨테이너]
        │  Docker logging driver = awslogs
        ▼
[App EC2 Instance Profile]
        │  logs:PutLogEvents (NAT → 공인 CloudWatch API)
        ▼
[CloudWatch Log Groups]
  /coupang-eats-dev/app/nginx
  /coupang-eats-dev/app/nest

[ALB / ASG / EC2]
        │  AWS 기본 메트릭 (에이전트 불필요)
        ▼
[CloudWatch Metrics + Alarms + Dashboard]
```

**DB 서브넷**은 NAT가 없어 1차에서는 **메트릭 알람만** 둔다.  
DB 프로세스 로그를 CW로 보내려면 Logs Interface VPC Endpoint + 에이전트가 필요하고, 그건 입주 확장이다.

---

## 4. 알람 임계값 (기본)

| 알람 | 조건 |
|------|------|
| ALB 5xx | 1분 Sum > 10 |
| Unhealthy hosts | 2분 평균 ≥ 1 |
| ASG CPU | 2분 평균 > 80% |
| ASG StatusCheck | StatusCheckFailed > 0 |
| ASG InService | InService < `asg_min` (`treat_missing_data=notBreaching`, 부팅 직후 오탐 방지) |
| DB CPU | 노드별 > 80% |
| DB StatusCheck | 노드별 Failed > 0 |

SNS/슬랙 연동은 넣지 않았다. 콘솔 **Alarms** 상태에서 확인한다. (원하면 다음 스프린트에 SNS Topic만 붙이면 된다.)

끄려면 모듈 변수:

```hcl
enable_monitoring  = false   # compute / database
log_retention_days = 7       # compute only
```

기본값은 **켜짐(`true`)**.

---

## 5. 배포 후 확인 방법

`terraform apply` 로 compute(+database)가 올라온 뒤.

### 5.1 대시보드 (가장 빠른 확인)

1. AWS 콘솔 → **CloudWatch** → **Dashboards**
2. `coupang-eats-dev-overview` 선택  
   (이름 prefix는 `settings.tf`의 `name_prefix`에 따름)
3. 보이는 것:
   - ALB Request / 2xx / 5xx
   - Healthy vs UnHealthy
   - ASG CPU · StatusCheck
   - ASG Desired / InService / Total
   - Nest 최근 로그 테이블

CLI:

```bash
cd dev_infra/environments/dev
terraform output cloudwatch_dashboard_name
# 콘솔 URL 예 (리전·계정에 맞게)
# https://ap-northeast-2.console.aws.amazon.com/cloudwatch/home?region=ap-northeast-2#dashboards:
```

### 5.2 로그 스트림

1. CloudWatch → **Log groups**
2. `/coupang-eats-dev/app/nest` , `.../nginx`
3. **Log streams** — `nest/...`, `nginx/...` 접두사

입주(ECR push + Compose 기동) 전에는 스트림이 비어 있을 수 있다.  
User Data가 awslogs로 `docker compose up` 한 뒤에야 쌓인다.

```bash
terraform output cloudwatch_log_groups

aws logs describe-log-groups \
  --log-group-name-prefix "/coupang-eats-dev/app" \
  --region ap-northeast-2

aws logs tail "/coupang-eats-dev/app/nest" --follow --region ap-northeast-2
```

Logs Insights 예:

```sql
fields @timestamp, @message
| filter @message like /error|Error|ERROR/
| sort @timestamp desc
| limit 50
```

Log group: `/coupang-eats-dev/app/nest`

### 5.3 알람 상태

1. CloudWatch → **Alarms** → **All alarms**
2. 접두사 `coupang-eats-dev-` 필터
3. 정상: **OK** / 데이터 없음(아직 트래픽·인스턴스 전): **Insufficient data** (대부분 `notBreaching`이라 방치해도 안전)
4. 문제: **In alarm** (빨간불)

```bash
terraform output cloudwatch_alarm_names
terraform output cloudwatch_db_alarm_names

aws cloudwatch describe-alarms \
  --alarm-name-prefix "coupang-eats-dev-" \
  --region ap-northeast-2 \
  --query 'MetricAlarms[].{Name:AlarmName,State:StateValue}' \
  --output table
```

### 5.4 메트릭만 직접 보기

CloudWatch → **Metrics** → **All metrics**

| 네임스페이스 | 볼 것 |
|--------------|--------|
| `AWS/ApplicationELB` | RequestCount, HTTPCode_Target_5XX_Count, HealthyHostCount |
| `AWS/EC2` | CPUUtilization (차원: AutoScalingGroupName 또는 InstanceId) |
| `AWS/AutoScaling` | GroupInServiceInstances, GroupDesiredCapacity |

“사용량이 뛴다”고 보이던 화면이 바로 이 **Metrics / Dashboard** 쪽이다.

### 5.5 알람을 일부러 검증하려면 (선택)

- Unhealthy: Nest를 잠시 내려 `/health` 실패 → `*-alb-unhealthy-hosts` In alarm
- 5xx: 앱에서 500을 연속 유발
- ASG InService: desired를 0으로 낮추면(비추천·실습 시 주의) `*-asg-in-service-low`

실습 후 **반드시 destroy** 또는 desired 복구.

---

## 6. 비용 메모

| 항목 | 대략 |
|------|------|
| 커스텀 메트릭 | 거의 없음 (AWS 기본 메트릭 사용) |
| 알람 | 개당 소액 (월 단위 센트~달러 수준) |
| Logs | 수집·보관량 비례 — **retention 7일**로 상한 |
| Dashboard | 기본 무료 티어 범위 내인 경우가 많음 |

destroy 하면 로그 그룹·알람·대시보드도 함께 사라진다.

---

## 7. 입주 체크리스트 (모니터링)

1. `terraform apply` (compute + database)
2. `terraform output cloudwatch_*` 확인
3. ECR push → ASG 인스턴스 Compose 기동
4. Dashboard에 Request / Healthy 그래프 갱신 확인
5. Log group에 nest/nginx 스트림 생성 확인
6. Alarms 대부분 OK (또는 Insufficient data → 트래픽 후 OK)

---

## 8. 스모크 apply 결과 (2026-09-06)

비용 최소(`t3.micro`, ASG=1, DB vol 10GiB)로 **125 resources** apply 후 검증하고 destroy 함.

| 항목 | 결과 |
|------|------|
| Log groups `/…/app/nginx`, `/…/nest` retention 7 | ✅ 생성 |
| Dashboard `coupang-eats-dev-overview` | ✅ 존재 |
| ALB/ASG/DB 알람 11개 | ✅ 생성 |
| ALB·ASG CPU·DB 알람 | 대부분 **OK** |
| `asg-in-service-low` | 부팅 직후 **ALARM** 오탐 → `treat_missing_data=notBreaching` 로 코드 수정 |
| EC2 CPU ASG 메트릭 datapoint | ✅ 수집됨 (2개+) |
| Docker 로그 스트림 | 이미지 미push라 비어 있음 (입주 후 확인) |
| destroy 125 + orphan EBS 3개 수동 삭제 | ✅ |
| Route 53 존 | 유지 |

---

## 9. 한 줄

> **ECS awslogs·ECS CPU 알람을, ALB/ASG 메트릭 + Docker awslogs + 대시보드로 치환해 기본 관측성을 복구했다.**  
> 확인은 콘솔 **Dashboards → `coupang-eats-dev-overview`**, **Log groups**, **Alarms** 세 곳이면 충분하다.
