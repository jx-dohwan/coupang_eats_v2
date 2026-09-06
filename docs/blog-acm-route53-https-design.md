# 밑바닥부터 다시 쌓는 3-Tier 인프라 — 도메인·Route 53·ACM·HTTPS 설계

담장(VPC)과 출입증(보안 그룹)은 [네트워크](./blog-vpc-network-design.md)·[보안 그룹](./blog-security-groups.md)에서 도면을 고정했고, Terraform으로 미리 필요한 보안 그룹까지 생성해 두었다.

이제 막히는 다음 단계는 **컴퓨트 골격**이다. ALB, Bastion, ASG, Nginx, Nest — 아마 이번 프로젝트에서 가장 손이 많이 가는 공사가 될 것이다.

그런데 그 전에 먼저 할 일이 있다.

> **실무와 가까운 프로젝트**를 만들기 위해, 호스팅케이알에서 도메인을 구매하고 Route 53과 ACM으로 **HTTPS 정문**을 여는 것이다.

이 글은 그 작업의 **설계와 시공 순서**를 고정한다. 컴퓨트 모듈을 코딩하기 전에, 왜 도메인·인증서가 먼저인지, 무엇은 수동으로 하고 무엇은 Terraform으로 할지, 무엇은 일부러 안 쓰는지까지 정리한다.

---

## 0. 왜 컴퓨트보다 먼저 하는가

컴퓨트 모듈에서 ALB를 만들 때 **ACM 인증서 ARN**을 443 리스너에 걸 예정이다. 동시에 HTTP(:80)는 **301 리다이렉트**로 HTTPS(:443)만 받도록 한다.

```text
손님 ──http://hdg1234.cloud──▶ ALB :80  ──301──▶ https://hdg1234.cloud
손님 ──https://hdg1234.cloud──▶ ALB :443 (ACM 인증서) ──▶ Nginx :80 ──▶ Nest
```

인증서가 없으면 443 리스너를 열 수 없고, “HTTPS만 받는다”는 설계도 공허해진다.  
반대로 ACM과 DNS 검증은 **VPC·NAT·EC2 없이도** 진행할 수 있다. NAT 요금을 인증서 때문에 미리 켤 필요가 없다.

그래서 시공 순서는 이렇게 고정한다.

```text
network + security  (완료)
        ↓
dns (Route 53 조회 + ACM + 검증 CNAME)   ← 지금
        ↓
compute (ALB + HTTPS + ASG …)
        ↓
apex ALIAS → ALB
```

비유: **명패(ACM)와 주소 안내판(Route 53)** 은 건물(ALB)이 올라가기 **전에** 받아 둘 수 있다. 에스컬레이터 위치(ALIAS)만 건물이 선 다음에 붙인다.

---

## 1. 전체 비유 — 단지 주소 이야기

| 실제 | 비유 |
|------|------|
| `hdg1234.cloud` | **등기된 단지 주소** |
| 호스팅케이알 | **시청에 단지 이름을 신고한 등록 기관**. 매년 관리비 |
| Route 53 호스팅 영역 | **단지 안내데스크 호수 대장** — “이 이름이면 어디로?” |
| NS 위임 | “호수 문의는 AWS 안내데스크로 하세요” |
| ACM 인증서 | **정문 명패·자물쇠 증명서** — 브라우저가 사칭이 아님을 믿는 근거 |
| ALB 443 리스너 | **자물쇠가 달린 정문** |
| ALB 80 → 301 | **낡은 쪽문을 닫고 정문으로 안내하는 표지판** |
| Route 53 Alias | **“101동은 저 에스컬레이터”** 안내판 — ALB DNS를 가리킴 |

---

## 2. 이미 끝난 일

| 항목 | 상태 |
|------|------|
| VPC·서브넷·NAT·S3 Endpoint | 설계·Terraform 완료 |
| 보안 그룹 (`sg-alb`, `sg-app`, …) | 미리 생성 완료 |
| 도메인 `hdg1234.cloud` | 호스팅케이알에서 구매 |
| Route 53 **퍼블릭 호스팅 영역** | 콘솔에서 등록 (`hdg1234.cloud`) |

호스팅 영역을 처음 만들면 레코드는 **NS 4개 + SOA** 만 보인다. 이건 “주소록은 만들었는데 아직 호수 배정은 비어 있다”는 정상 상태다.

---

## 3. 네임서버 동기화 — 수동, 한 번, Terraform 밖

Route 53 호스팅 영역과 **등록 기관(호스팅케이알)의 네임서버를 맞추는 작업**은 **수동**으로 한다.

### 3.1. 하는 방법

1. AWS 콘솔 → Route 53 → 호스팅 영역 `hdg1234.cloud` 선택  
2. **NS 레코드에 나오는 4개 주소**를 복사한다. (예: `ns-123.awsdns-12.com` 형태)  
3. 호스팅케이알 로그인 → 내 도메인 → **네임서버 변경 / DNS 위임**  
4. 기본 네임서버를 지우고, Route 53의 **4개를 그대로** 입력 후 저장  

### 3.2. 왜 Terraform이 아닌가

| 구분 | 이유 |
|------|------|
| **등록 기관 NS 변경** | AWS API 밖이다. 호스팅케이알 콘솔에서 사람이 한 번 한다 |
| **destroy/apply 반복** | 호스팅 영역을 Terraform `resource`로 **새로 만들면** destroy 때 영역이 사라지고, 다음 apply에서 **NS 4개가 바뀐다**. 등록 기관 NS와 어긋나 ACM은 영원히 Pending, 브라우저는 주소를 못 찾는다 |
| **실무 관행** | NS 위임은 “단지 등기”에 가깝다. 인프라를 헐고 다시 지어도 **등기 주소는 그대로** 두는 편이 맞다 |

Terraform이 할 일은 호스팅 영역을 **만들지 않고** `data "aws_route53_zone"`으로 **찾아 쓰는 것**뿐이다. 그 안의 CNAME·ALIAS만 올리고 내린다.

### 3.3. 전파 시간

네임서버 변경은 **전 세계 DNS에 퍼지는 데 시간이 걸린다.**  
보통 수 분~수 시간. 길면 하루 넘길 수도 있다.

그동안 ACM DNS 검증이 Pending이면 당황하지 말고, 아래를 확인한다.

- 호스팅케이알 NS 4개 = Route 53 호스팅 영역 NS 4개 (**글자 하나까지** 동일)  
- `dig NS hdg1234.cloud` 또는 [whatsmydns.net](https://www.whatsmydns.net/)으로 전파 확인  

```text
[ 전 세계 DNS ]
     │
     │  “hdg1234.cloud 의 NS는 누구?”
     ▼
호스팅케이알 (Registrar)          ← ★ 여기 NS 4개를 수동으로 맞춤
     │  네임서버 = Route 53 NS 4개
     ▼
Route 53 호스팅 영역 hdg1234.cloud.
     │  지금: NS + SOA (빈 주소록)
     ▼
(이후 Terraform)  ACM 검증 CNAME
(compute 이후)    apex ALIAS → ALB
```

---

## 4. 비용 — ACM은 공짜, 뭘 돈 내는가

| 항목 | 대략 | 이번 프로젝트 |
|------|------|----------------|
| ACM **공인** 인증서 (ALB 연동) | **무료** | 이걸 만든다 |
| ACM **Private CA** | 월 과금, 비쌈 | **안 씀** |
| Let’s Encrypt on Nginx | 인증서 무료, 갱신 스크립트 필요 | ALB 종료 → **안 씀** |
| 도메인 등록 (호스팅케이알) | 연 1회 | `hdg1234.cloud` |
| Route 53 **호스팅 영역** | 영역당 월 ~0.5 USD + 질의 | 이미 생성 |
| ALB | 시간당 + LCU | compute에서 생성 |
| NAT | 시간당 + 데이터 | ACM과 **무관** |

> **ACM 공인 인증서를 ALB에 붙이면 인증서 요금은 0원이다.**  
> “SSL = 돈”은 상용 벤더·Private CA 이야기다. ALB용 ACM 공인 인증서는 임대료가 없다.

TLS는 **로비(ALB)에서 끝낸다.** Nginx·Nest 구간은 단지 내부 복도(HTTP)다. EC2마다 인증서 갱신할 필요가 없다.

---

## 5. ACM — 어디에, 어떤 이름으로

### 5.1. TLS 종료 위치

```text
브라우저  ──HTTPS──▶  ALB (TLS 종료, ACM)
                      │ HTTP :80
                      ▼
                   Nginx (프라이빗 EC2)
                      │ 127.0.0.1:3000
                      ▼
                   Nest
```

`sg-alb`는 이미 **80·443** 인바운드를 `0.0.0.0/0`으로 열어 두었다.  
`sg-app`은 **80만** ALB에서 받는다. 443은 앱까지 안 내려간다. 자물쇠는 로비 것.

### 5.2. 리전 규칙

ACM은 **리전 종속** 서비스다. 인증서를 **붙일 리소스와 같은 리전**에 만들어야 한다.

| 붙일 대상 | 인증서 리전 | 이번 |
|-----------|-------------|------|
| **ALB** | ALB가 있는 리전 (서울 `ap-northeast-2`) | **이걸 만든다** |
| **API Gateway (Regional)** | API GW 리전 | **안 씀** (아래 §8) |
| **CloudFront** | **버지니아 북부 `us-east-1`만** | **안 씀** (아래 §8) |

우리 ALB는 서울에 둔다. **ACM도 서울**에서 발급한다.

### 5.3. 루트 + 와일드카드를 함께 신청

한 장의 인증서에 아래 **두 SAN**을 넣는다.

| 이름 | 포함 여부 | 용도 |
|------|-----------|------|
| `hdg1234.cloud` (apex, **루트**) | 와일드카드에 **포함 안 됨** | 주소창에 그냥 치는 이름 |
| `*.hdg1234.cloud` (와일드카드) | 1단계 서브도메인만 | `www`, `api`, `alb` 등 |

**흔한 실수:** `*.hdg1234.cloud`만 신청하면 `www.hdg1234.cloud`는 보호되지만 **`hdg1234.cloud` 자체는 보호되지 않는다.**  
루트와 와일드카드를 **반드시 함께** 기재한다.

와일드카드는 **한 단계**만 덮는다.

| 이름 | `*.hdg1234.cloud`로 보호? |
|------|---------------------------|
| `www.hdg1234.cloud` | ✅ |
| `api.hdg1234.cloud` | ✅ |
| `a.b.hdg1234.cloud` | ❌ (2단계) |

1차 권장: **apex `hdg1234.cloud`** 를 정문으로 ALB에 붙인다.  
`www`는 같은 인증서로 커버되니, 원하면 나중에 apex 리다이렉트 또는 별도 ALIAS를 추가한다.

---

## 6. DNS 검증 — “주소록 주인이 당신 맞소?”

ACM은 도메인을 **조종할 수 있는지** 확인한 뒤 인증서를 준다.

| 방법 | 이번 |
|------|------|
| 이메일 검증 | 자동화 불편. **안 씀** |
| **DNS 검증** | **고정** — Route 53에 ACM이 준 CNAME을 붙임 |

```text
1. ACM에 “hdg1234.cloud + *.hdg1234.cloud” 신청 (서울 리전)
2. ACM이 검증용 CNAME 이름·값을 줌
3. Route 53 호스팅 영역에 그 CNAME 생성 (Terraform)
4. ACM이 DNS 조회 → 상태 Issued
5. ALB 443 리스너에 certificate_arn 연결
```

NS가 Route 53을 가리키고 있으면, 검증 CNAME은 **호스팅케이알 콘솔을 다시 열 필요 없이** Route 53에만 붙이면 된다.  
게시판(주소록)이 AWS 안에 있기 때문이다.

발급까지 보통 **몇 분**. NS 미동기화·전파 미완료면 **Pending**이 길어진다.

---

## 7. Route 53 Alias — ALB를 가리키는 안내판

인증서만으로는 브라우저가 `hdg1234.cloud`를 찾지 못한다. **주소록에 목적지**가 있어야 한다.

ALB는 고정 IP가 아니라 DNS 이름(`….ap-northeast-2.elb.amazonaws.com`)이다.  
A 레코드에 IP를 박지 않고, Route 53 **별칭(Alias)** 으로 ALB를 가리킨다.

| 레코드 | 타입 | 대상 | 시점 |
|--------|------|------|------|
| ACM 검증 | CNAME | ACM이 준 값 | **인증서 신청과 동시** (ALB 없어도 됨) |
| `hdg1234.cloud` | **A (Alias)** | ALB | **ALB 생성 후** |
| (선택) `www.hdg1234.cloud` | A Alias 또는 CNAME | ALB 또는 apex | ALB 이후 |

Alias의 장점:

- Route 53 ↔ AWS 리소스(ALB 등) **네이티브 연동**  
- ALB IP가 바뀌어도 Alias가 따라감  
- Apex 도메인에 CNAME을 못 쓰는 DNS 제약을 Alias가 우회  

비유: **명패(ACM)** 는 건물 전에 받을 수 있다. **“101동 = 저 에스컬레이터”** 안내판은 에스컬레이터가 선 다음에 붙인다.

---

## 8. ALB 리스너 — HTTP/HTTPS 분기

예전 Fargate 시절 쓰던 분기를 **그대로 살린다.**

```text
acm_certificate_arn 이 있으면
  :80  → 301 Redirect → https://{host}:443
  :443 → Forward → Target Group (Nginx :80, target_type = instance)

없으면 (비상용)
  :80  → Forward → Target Group 직접
```

정상 경로에서는 인증서가 **Issued**된 뒤 443을 연다. 인증서 없이 443을 열면 ALB가 거절한다.

헬스체크는 **HTTP :80 `/health`** 그대로다. ALB → Nginx 구간은 HTTP이므로 헬스체크를 HTTPS로 바꿀 필요 없다.

---

## 9. 일부러 안 쓰는 것

### 9.1. CloudFront

CloudFront는 **글로벌 CDN**이다. 인증서를 붙이려면 **반드시 `us-east-1` ACM**이 필요하다.

| | CloudFront | 이번 3-Tier |
|--|------------|-------------|
| 서비스 범위 | 전 세계 엣지 캐시 | **한국 리전 중심** 실습·서비스 |
| 비용 | 트래픽·요청·리전별 상이, 체감 큼 | ALB + EC2로 충분 |
| 적합 사례 | 넷플릭스처럼 **글로벌 대용량 정적·스트리밍** | 배달앱 실습 규모 |

**1차 CloudFront 없음.** CDN 없이 ALB 정문 + 서울 ACM으로 HTTPS를 연다.

### 9.2. API Gateway

백엔드(Nest)가 **경로 라우팅을 전부** 처리한다. `/api/orders`, `/api/auth` 등은 Nginx → Nest로 프록시하면 된다.

API Gateway를 앞에 두면:

- 커스텀 도메인 + ACM + 스테이지 + 통합 설정이 **한 겹 더** 생긴다  
- 우리 아키텍처는 **ALB 한 입구**로 WEB(SPA) + WAS(API)를 이미 Nginx가 나눈다  

**API Gateway 없음.** ALB 루트 경로만으로 WEB·WAS 모두 수용 가능하다.

### 9.3. 기타

| 안 함 | 이유 |
|-------|------|
| ACM Private CA | 월 과금. 공인 인증서로 충분 |
| 호스팅 영역 Terraform **신규 생성** | 이미 있음. `data`로 조회만 |
| 호스팅케이알 NS Terraform/API | 등록 기관 밖. **수동 1회** |
| Let’s Encrypt on Nginx | ALB 종료와 중복. 인스턴스마다 갱신 |
| HTTP만 열고 HTTPS 미룸 | 도메인 있고 ACM 공짜. **1차부터 HTTPS** |
| `api.hdg1234.cloud` 별도 ALB | 와일드카드로 나중에 가능. 지금은 apex 한 입구 |

---

## 10. Terraform 배치 (코딩 시)

숫자는 `settings.tf`, 조립은 `main.tf`. CIDR·포트와 섞지 않는다.

```text
settings.tf
  domain_name = "hdg1234.cloud"

modules/dns
  data.aws_route53_zone          ← 호스팅 영역 조회 (생성 금지)
  aws_acm_certificate
  aws_route53_record (validation)
  aws_acm_certificate_validation

modules/compute
  ALB + 리스너 (certificate_arn = module.dns.acm_certificate_arn)
  HTTP 301, HTTPS forward
  (선택) apex A Alias — ALB DNS name 입력

environments/dev/main.tf
  module "network"      # 완료
  module "security"     # 완료
  module "dns"          # VPC·NAT 불필요
  module "compute"      # dns cert + network + security
```

**순환 의존 주의:**

- ACM 발급은 ALB를 **기다리지 않는다**  
- apex ALIAS만 ALB를 **기다린다**  

권장 apply 순서:

```text
1. (수동) 호스팅케이알 NS ↔ Route 53 NS 동기화 · 전파 대기
2. module dns  → ACM Issued
3. module compute → ALB + 443
4. apex ALIAS → ALB
5. 브라우저 https://hdg1234.cloud 확인
```

`module "dns"`만 먼저 apply해서 NAT 없이 **명패만** 발급받을 수 있다.

기존 Fargate 코드의 `var.acm_certificate_arn` 빈 문자열 패턴은, ARN을 `module.dns`에서 넘기면 `https_enabled = true`가 된다.

---

## 11. 컴퓨트 기획과의 관계

[WEB·WAS 컴퓨트 설계](./blog-compute-web-was-design.md)의 전제를 여기서 **갱신**한다.

| 항목 | 결정 |
|------|------|
| 도메인 | `hdg1234.cloud` (호스팅케이알 + Route 53) |
| NS 위임 | **수동**, Terraform 밖 |
| ACM | **1차**, 서울, DNS 검증, `apex + *.apex` |
| HTTPS | ALB 종료, 80→301→443 |
| CloudFront | **없음** |
| API Gateway | **없음** — Nest가 경로 처리 |
| 다음 코딩 | **dns 모듈 → compute (Docker·ECR·ALB·ASG) → database …** |

컴퓨트에서 Docker를 1차로 올린 경위는 [기획 수정 편](./blog-planning-revision-docker-ecr.md). HTTPS 도면 자체는 그 수정과 무관하다.

---

## 12. 시공 체크리스트

### 수동 (한 번)

- [ ] Route 53 호스팅 영역 `hdg1234.cloud` 확인 (NS 4개 + SOA)  
- [ ] 호스팅케이알에 NS 4개 입력 · 저장  
- [ ] NS 전파 확인 (`dig NS hdg1234.cloud`)  

### Terraform — dns 모듈

- [ ] `settings.tf`에 `domain_name = "hdg1234.cloud"`  
- [ ] `data.aws_route53_zone` — **새 zone resource 금지**  
- [ ] ACM: `hdg1234.cloud` + `*.hdg1234.cloud`, 서울, DNS 검증  
- [ ] 검증 CNAME + `aws_acm_certificate_validation` → **Issued**  

### Terraform — compute 모듈

- [ ] ALB 443 + `module.dns.acm_certificate_arn`  
- [ ] ALB 80 → 301 → HTTPS  
- [ ] Target Group :80, `instance`, 헬스 `/health`  
- [ ] apex **A Alias** → ALB  

### 검증

- [ ] `https://hdg1234.cloud` — 브라우저 자물쇠  
- [ ] `http://hdg1234.cloud` — 301 → HTTPS  
- [ ] (앱 기동 후) `/health` 200  

---

## 13. 한 줄 요약

네트워크·보안 그룹 다음, 컴퓨트 전에 **호스팅케이알 NS를 Route 53에 수동 위임**하고, Terraform으로 **서울 ACM(루트+와일드카드)** 을 DNS 검증해 받은 뒤, ALB 443에 걸어 **HTTPS만** 받는다. CloudFront·API Gateway는 넣지 않는다. 호스팅 영역은 destroy 사이클 밖에 두고, 주소록 **안의 레코드만** Terraform이 올리고 내린다.
