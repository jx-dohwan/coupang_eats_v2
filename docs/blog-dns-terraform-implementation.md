# 밑바닥부터 다시 쌓는 3-Tier 인프라 — DNS 모듈 Terraform 구현편

[설계편](./blog-acm-route53-https-design.md)에서 "왜 컴퓨트보다 도메인·인증서가 먼저인가"를 고정했다.

이 글은 그 설계를 **Terraform 코드로 시공한 기록**이다. 리소스 한 줄마다 "왜 이렇게 짰는가"를 비유와 함께 풀어 놓는다. 이 모듈을 `apply`하면 **ACM 인증서가 Issued 상태로 도착**하고, 이후 compute 모듈에서 ALB 443 리스너에 바로 꽂을 수 있다.

---

## 0. 전체 흐름 — 한 장 다이어그램

```text
┌─────────────────────────────────────────────────────────────────┐
│  Terraform dns 모듈                                             │
│                                                                 │
│  ① data.aws_route53_zone.main                                  │
│     "이미 있는 주소록 찾아와"                                   │
│            │                                                    │
│            ▼                                                    │
│  ② aws_acm_certificate.main                                    │
│     "명패(인증서) 신청서 접수"                                  │
│            │                                                    │
│            │  (ACM이 검증용 CNAME 이름·값을 돌려줌)             │
│            ▼                                                    │
│  ③ aws_route53_record.acm_validation                           │
│     "ACM이 달라는 증명 메모를 주소록에 붙이기"                  │
│            │                                                    │
│            ▼                                                    │
│  ④ aws_acm_certificate_validation.main                         │
│     "ACM이 메모를 확인하고 명패를 발급할 때까지 기다리기"       │
│                                                                 │
│  output → acm_certificate_arn (다음 편 ALB에 주입)              │
└─────────────────────────────────────────────────────────────────┘
```

비유로 말하면:

1. **안내데스크(호스팅 영역)** 위치를 확인하고  
2. **명패 발급 신청서**를 시청(ACM)에 제출하고  
3. 시청이 "이 주소의 주인이 맞는지 확인하겠다"며 건네준 **확인 스티커**를 안내데스크에 붙이고  
4. 시청 직원이 **스티커를 확인**하고 명패를 건네줄 때까지 대기한다.

---

## 1. 디렉터리 구조

```text
dev_infra/
├── environments/dev/
│   ├── settings.tf          # domain_name = "hdg1234.cloud" 추가
│   ├── main.tf              # module "dns" 호출 추가
│   └── outputs.tf           # acm_certificate_arn 출력 추가
└── modules/dns/
    ├── variables.tf         # 입력: domain_name, tags
    ├── main.tf              # 핵심 로직 4단계
    └── outputs.tf           # 출력: acm_certificate_arn, zone_id
```

파일이 **3개**뿐이다. DNS 모듈은 VPC도 서브넷도 EC2도 필요 없다. 순수하게 **주소록과 명패** 작업만 한다. NAT Gateway 시간당 요금을 태울 이유가 없는 이유가 바로 이것이다.

---

## 2. 입력 변수 — `variables.tf`

```hcl
variable "domain_name" {
  description = "루트 도메인 (예: hdg1234.cloud)"
  type        = string
}

variable "tags" {
  description = "공통 태그"
  type        = map(string)
  default     = {}
}
```

| 변수 | 역할 | 비유 |
|------|------|------|
| `domain_name` | 모든 리소스의 기준점 | **단지 주소** — 이 한 줄에서 인증서 이름, 호스팅 영역 조회, 와일드카드까지 파생된다 |
| `tags` | AWS 콘솔·비용 태그 | 건물에 붙이는 관리 번호 |

변수를 **최소화**한 이유: ACM 발급에는 VPC ID도 서브넷도 보안 그룹도 필요 없다. 도메인 이름 하나면 충분하다.

---

## 3. 핵심 구현 — `main.tf` 4단계 해설

### 3.1. 1단계: 호스팅 영역 조회 (data source)

```hcl
data "aws_route53_zone" "main" {
  name         = var.domain_name
  private_zone = false
}
```

**왜 `resource`가 아니라 `data`인가?**

| 방법 | 동작 | 위험 |
|------|------|------|
| `resource "aws_route53_zone"` | 새로 **생성**한다 | `destroy`하면 NS 4개가 바뀐다 → 호스팅케이알과 어긋남 → ACM 영원히 Pending |
| `data "aws_route53_zone"` | 이미 있는 영역을 **읽기만** 한다 | 없음. destroy해도 영역은 그대로 |

비유: **등기소에 가서 우리 단지 주소를 "조회"**하는 것이지, 단지 이름을 **새로 등록**하는 게 아니다. 인프라를 허물었다 다시 지어도 등기 주소는 바뀌면 안 된다.

`private_zone = false`는 "퍼블릭 인터넷에서 찾을 수 있는 영역"이라는 뜻이다. VPC 내부용 Private Hosted Zone과 구분한다.

---

### 3.2. 2단계: ACM 인증서 요청

```hcl
resource "aws_acm_certificate" "main" {
  domain_name               = var.domain_name          # hdg1234.cloud
  subject_alternative_names = ["*.${var.domain_name}"] # *.hdg1234.cloud
  validation_method         = "DNS"

  tags = merge(var.tags, {
    Name = "${var.domain_name}-acm"
  })

  lifecycle {
    create_before_destroy = true
  }
}
```

#### 한 줄씩 해부

| 속성 | 의미 | 비유 |
|------|------|------|
| `domain_name` | 인증서의 **주 이름** (CN) | 명패에 새기는 **대표 이름** |
| `subject_alternative_names` | 추가로 보호할 이름 (SAN) | 명패 뒷면에 적는 **별칭 목록** — `*.hdg1234.cloud` |
| `validation_method = "DNS"` | 도메인 소유권을 DNS 레코드로 증명 | "주소록에 스티커를 붙여라. 확인되면 명패를 준다" |
| `lifecycle { create_before_destroy = true }` | 갱신 시 새 인증서를 먼저 만들고 기존 것을 삭제 | 새 명패를 먼저 발급받고, 기존 명패를 반납. **순단 없음** |

**`create_before_destroy`를 왜 넣는가?**

ACM 인증서를 교체(갱신·재발급)할 때, Terraform의 기본 동작은 **기존 삭제 → 새로 생성**이다. 그런데 ALB 리스너가 기존 인증서 ARN을 물고 있으면 삭제가 실패한다. `create_before_destroy`는 이 순서를 뒤집어서 새 인증서가 먼저 나오고, ALB가 새 ARN으로 갈아탄 뒤 기존 것이 사라지게 한다.

비유: 새 명패를 먼저 걸어두고 낡은 명패를 떼는 것이다. 정문이 명패 없이 비는 순간이 없다.

---

### 3.3. 3단계: DNS 검증용 CNAME 레코드 생성

```hcl
resource "aws_route53_record" "acm_validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.main.zone_id
}
```

#### 이 코드가 하는 일

ACM이 인증서를 신청받으면 **"이 CNAME을 DNS에 붙여봐라"** 라는 과제를 준다. 이 과제(domain_validation_options)는 인증서에 적은 도메인 수만큼 나온다.

우리는 `hdg1234.cloud` + `*.hdg1234.cloud` 두 개를 신청했지만, ACM은 동일 영역의 루트+와일드카드에 대해 **검증 CNAME을 하나만** 요구하는 경우가 대부분이다. 그래도 코드에서는 `for_each`로 **몇 개가 오든 처리**하도록 일반화해 둔다.

| 핵심 속성 | 의미 | 비유 |
|-----------|------|------|
| `for_each` | ACM이 준 검증 과제 목록을 순회 | 시청이 건네준 **확인 스티커 목록** |
| `allow_overwrite = true` | 이미 같은 이름의 레코드가 있으면 덮어쓴다 | 안내데스크에 같은 메모가 붙어 있으면 새 것으로 교체 |
| `ttl = 60` | 60초마다 DNS 캐시 갱신 | ACM이 빠르게 확인할 수 있도록 **짧은 유효 시간** |
| `zone_id` | 어느 호스팅 영역에 붙일지 | **어느 안내데스크**에 스티커를 붙일지 |

비유: 시청(ACM)이 "당신이 이 주소의 진짜 주인이면, 안내데스크에 **이 비밀 코드 메모**를 붙여보시오"라고 한다. Route 53에 CNAME을 붙이는 것이 그 증명 행위다.

---

### 3.4. 4단계: 검증 완료 대기

```hcl
resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.acm_validation : record.fqdn]
}
```

이 리소스는 **실제 인프라를 만들지 않는다.** Terraform이 `terraform apply` 중에 ACM의 상태가 `Issued`로 바뀔 때까지 **폴링(대기)**하는 역할이다.

| 속성 | 의미 |
|------|------|
| `certificate_arn` | 어떤 인증서의 발급을 기다릴지 |
| `validation_record_fqdns` | 검증 CNAME의 FQDN 목록 — ACM이 이 레코드를 조회한다 |

비유: 안내데스크에 메모를 붙여 놓고 나서, 시청 직원이 **"확인했습니다, 명패 나왔습니다"** 라고 말해줄 때까지 창구 앞에서 기다리는 것이다.

**소요 시간:** NS 위임이 정상적으로 전파된 상태라면 보통 **2~5분**. 전파가 안 끝났으면 30분 이상 걸릴 수 있다. `terraform apply`가 오래 멈춰 있으면 NS 동기화 상태를 다시 확인한다.

---

## 4. 출력값 — `outputs.tf`

```hcl
output "acm_certificate_arn" {
  description = "발급 완료된 ACM 인증서 ARN (ALB 443 리스너에 사용)"
  value       = aws_acm_certificate_validation.main.certificate_arn
}

output "zone_id" {
  description = "Route 53 퍼블릭 호스팅 영역 ID (Alias 레코드 생성 시 사용)"
  value       = data.aws_route53_zone.main.zone_id
}
```

| 출력 | 소비자 | 비유 |
|------|--------|------|
| `acm_certificate_arn` | compute 모듈 → ALB 443 리스너 | 건물 정문에 걸 **명패 번호** |
| `zone_id` | compute 모듈 → apex A Alias 레코드 | 안내판을 붙일 **안내데스크 번호** |

`validation` 리소스의 ARN을 내보내는 이유: **`aws_acm_certificate.main.arn`** 을 직접 쓰면 아직 `Pending Validation`일 수 있다. `validation` 리소스는 `Issued` 확인 후에야 완료되므로, 이 출력을 쓰면 **항상 발급 완료된 인증서만** 다음 모듈에 전달된다.

---

## 5. 호출부 — `environments/dev`

### 5.1. `settings.tf` — 도메인 이름 한 줄 추가

```hcl
locals {
  aws_region  = "ap-northeast-2"
  name_prefix = "coupang-eats-dev"
  domain_name = "hdg1234.cloud"        # ← 추가
  tags = {
    Environment = "dev"
  }
}
```

### 5.2. `main.tf` — 모듈 호출

```hcl
module "dns" {
  source = "../../modules/dns"

  domain_name = local.domain_name
  tags        = local.tags
}
```

VPC도, 서브넷도, 보안 그룹도 넘기지 않는다. dns 모듈은 **네트워크 인프라와 독립적**이다. 이것이 "ACM은 컴퓨트보다 먼저, 비용 0으로 선행할 수 있다"의 코드적 증거다.

### 5.3. `outputs.tf` — 결과 노출

```hcl
output "acm_certificate_arn" {
  description = "ACM 인증서 ARN (ALB HTTPS 리스너용)"
  value       = module.dns.acm_certificate_arn
}

output "route53_zone_id" {
  description = "Route 53 퍼블릭 호스팅 영역 ID"
  value       = module.dns.zone_id
}
```

---

## 6. Apply 실행 흐름 — 시간순

```text
$ terraform init        # dns 모듈 로드
$ terraform plan        # 생성 예정: ACM 1개, CNAME 1~2개, Validation 1개
$ terraform apply

  → data.aws_route53_zone.main: 호스팅 영역 ID 획득         (즉시)
  → aws_acm_certificate.main: 인증서 신청                    (즉시)
  → aws_route53_record.acm_validation: CNAME 생성            (수 초)
  → aws_acm_certificate_validation.main: Issued 대기...       (2~5분)

Apply complete! Resources: 3 added, 0 changed, 0 destroyed.

Outputs:
  acm_certificate_arn = "arn:aws:acm:ap-northeast-2:123456789:certificate/abc-def-..."
  route53_zone_id     = "Z0123456789ABCDEFGHIJ"
```

**apply 후 AWS 콘솔에서 확인할 수 있는 것:**

- ACM > 인증서 목록 → `hdg1234.cloud` 상태: **발급됨(Issued)**
- Route 53 > 호스팅 영역 → CNAME 레코드 1개 추가됨 (`_acm-validations...`)

---

## 7. 자주 겪는 문제와 대처

### 7.1. `terraform apply`가 10분 넘게 멈춘다

**원인:** NS 전파가 아직 안 끝났다. ACM이 Route 53의 CNAME을 찾지 못하는 상태.

**확인:**
```bash
dig NS hdg1234.cloud +short
```
Route 53의 NS 4개가 응답하면 전파 완료. 호스팅케이알 기본 NS가 보이면 아직 미완료.

**대처:** 기다린다. 최대 48시간까지 걸릴 수 있지만, 대부분 30분 이내에 끝난다.

### 7.2. `Error: certificate is still pending validation`

**원인:** `aws_acm_certificate_validation`이 타임아웃(기본 75분) 내에 Issued를 받지 못했다.

**확인:**
- AWS 콘솔 ACM → 해당 인증서 → 검증 상태 확인
- CNAME 레코드가 Route 53에 정상 생성됐는지 확인
- 호스팅케이알 NS와 Route 53 NS 일치 여부 재확인

**대처:** NS 동기화 완료 후 `terraform apply` 재실행. 이미 CNAME이 있으므로 바로 Issued된다.

### 7.3. `for_each`가 2개가 아니라 1개만 만든다

**이유:** ACM은 같은 호스팅 영역의 루트(`hdg1234.cloud`)와 와일드카드(`*.hdg1234.cloud`)에 대해 **동일한 검증 CNAME**을 요구한다. `for_each`의 키가 `dvo.domain_name`이므로, 중복 CNAME 값이면 하나로 합쳐진다.

이것은 **정상 동작**이다. ACM이 요구하는 CNAME을 전부 생성하면 되고, 그 수가 1개인지 2개인지는 ACM이 결정한다.

---

## 8. 보안 관점 — 이 모듈에서 지키는 원칙

| 원칙 | 구현 |
|------|------|
| 호스팅 영역 불멸 | `data` source로 조회만. destroy 무관 |
| 인증서 무중단 교체 | `create_before_destroy = true` |
| 최소 TTL | 검증 CNAME은 60초. 빠른 확인, 빠른 정리 |
| ARN 주입 방식 | validation 완료된 ARN만 output. 미발급 인증서가 ALB에 닿지 않음 |
| 와일드카드 + 루트 동시 | SAN에 둘 다 명시. 루트만 빠뜨리는 실수 방지 |

---

## 9. 다음 단계와의 연결

이 모듈의 `acm_certificate_arn`과 `zone_id`는 compute 모듈의 **입력**이 된다.

```text
module "compute" {
  source = "../../modules/compute"

  acm_certificate_arn = module.dns.acm_certificate_arn   # ← 명패 번호
  zone_id             = module.dns.zone_id               # ← 안내데스크 번호
  ...
}
```

compute 모듈에서 할 일:

1. **ALB 443 리스너** — `certificate_arn`에 위 ARN을 넣는다
2. **ALB 80 리스너** — `redirect { status_code = "HTTP_301" }` HTTPS로 전환
3. **Route 53 A Alias 레코드** — `zone_id`에 ALB DNS Name을 매핑

이때 비로소 **건물에 명패를 걸고, 안내판에 화살표를 찍는** 작업이 완성된다.

---

## 10. 전체 비유 요약 — 명패 발급 4단계

| 단계 | Terraform 리소스 | 비유 |
|------|------------------|------|
| ① 안내데스크 위치 확인 | `data.aws_route53_zone` | 단지 안내데스크가 어디 있는지 찾아감 |
| ② 명패 신청서 접수 | `aws_acm_certificate` | 시청에 "이 주소의 보안 명패 만들어주세요" 제출 |
| ③ 확인 스티커 부착 | `aws_route53_record` (CNAME) | 시청이 "안내데스크에 이 스티커 붙여봐" → 붙임 |
| ④ 발급 대기 | `aws_acm_certificate_validation` | 시청 직원이 스티커 확인 → "명패 나왔습니다" |

명패(ACM)는 **건물(ALB)이 없어도 미리 받을 수 있다.** 그래서 NAT Gateway 비용 없이, 네트워크만 있는 상태에서 이 모듈을 먼저 돌린다.

건물이 올라가면(compute `apply`) 명패를 정문에 걸고(`certificate_arn`), 안내판에 "정문은 저기"라고 화살표를 찍는다(`A Alias → ALB`).

---

## 11. 한 줄 요약

`data`로 호스팅 영역을 찾고, `aws_acm_certificate`로 루트+와일드카드를 신청하고, Route 53에 검증 CNAME을 붙이고, `validation` 리소스가 Issued를 확인하면 — **인증서 ARN 하나**가 output으로 나온다. 이것을 다음 편 compute 모듈의 ALB 443 리스너에 꽂으면 HTTPS 정문이 열린다.
