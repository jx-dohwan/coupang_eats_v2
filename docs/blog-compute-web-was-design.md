# 밑바닥부터 다시 쌓는 3-Tier 인프라 — WEB·WAS 컴퓨트 설계 (최종)

뼈대(VPC, 보안 그룹, 도메인·ACM)는 모두 세웠다.  
이제 그 뼈대에 **콘크리트를 부어서 실제 모양을 완성**하는 단계다.

이번 공사가 이 프로젝트에서 **가장 핵심**이다. 3-Tier 아키텍처의 WEB과 WAS가 실제로 동작하는 형태를 결정짓기 때문이다.

> 도로(VPC)와 도어락(SG)과 명패(ACM)는 준비됐다.  
> 이제 **로비 에스컬레이터(ALB)**, **매장·주방 건물(EC2 + Docker)**, **경비실(Bastion)** 을 **실제로 짓는다.**

---

## 0. 완료 현황과 이번 목표

| 층 | 상태 |
|----|------|
| 네트워크 (VPC, 서브넷, NAT, S3 Endpoint) | Terraform 완료 |
| 보안 그룹 (sg-alb, sg-app, sg-bastion 등) | Terraform 완료 |
| 도메인·ACM (hdg1234.cloud, 와일드카드 인증서) | Terraform 완료. Issued |
| **WEB + WAS (Nginx + NestJS)** | **← 이번 작업** |
| DB (MySQL InnoDB Cluster) | [기획·설계편](./blog-database-innodb-cluster-design.md) |

---

## 1. 전체 아키텍처 (최종)

```text
[사용자 브라우저]
       │
       │  https://hdg1234.cloud
       ▼
[ Route 53 ] ── A Alias ──▶ [ ALB (퍼블릭 a/b/c) ]
                                    │
                        ┌───────────┼───────────┐
                        │    :443 (ACM TLS 종료)  │
                        │    :80 → 301 → HTTPS   │
                        └───────────┼───────────┘
                                    │ HTTP :80
                                    ▼
                    [ Target Group (instance, port 80) ]
                                    │
                     ┌──────────────┼──────────────┐
                     ▼              ▼              ▼
            [ EC2 (AZ-a) ]  [ EC2 (AZ-b) ]  [ EC2 (AZ-c) ]
            ┌──────────────────────────────┐
            │  Docker Compose              │
            │                              │
            │  ┌─────────┐  ┌──────────┐  │
            │  │ Nginx   │  │  NestJS  │  │
            │  │ :80     │──│  :3000   │  │
            │  │ (WEB)   │  │  (WAS)   │  │
            │  └─────────┘  └──────────┘  │
            │       ↑              ↑       │
            │   ECR pull       ECR pull    │
            └──────────────────────────────┘
                     ↑
            [ ASG: min 1, desired 2, max 3 ]

[관리자 PC] ── SSH :22 ──▶ [ Bastion (퍼블릭 a) ] ── SSH ──▶ [ 앱 EC2 ]
```

---

## 2. 핵심 설계 결정

### 2.1 WEB과 WAS를 한 EC2에 둘 것인가, 분리할 것인가?

| 방식 | 장점 | 단점 |
|------|------|------|
| **한 EC2에 Compose** (Nginx+Nest) | 구조 단순, 비용 절감, Compose 내부 통신으로 지연 없음 | 독립 스케일링 불가 |
| EC2 분리 (WEB ASG + WAS ASG) | 독립 스케일링, 장애 격리 | ALB 내부용 추가, SG 복잡, 비용 2배 |

**결정: 한 EC2에 Compose로 Nginx + Nest를 함께 둔다.**

이유:
1. 이 프로젝트는 ECS의 밑바닥을 이해하는 것이 목적. 분리는 2차 확장
2. Nginx → Nest 통신이 Compose 내부 네트워크(localhost급)라 지연 없음
3. ALB 타깃은 EC2 :80 하나. 대상그룹·리스너 구조가 단순
4. 비용: t3.small 하나로 Nginx(~30MB) + Node(~200MB) 충분

### 2.2 도메인 설계 — `hdg1234.cloud` 하나로

| 도메인 | 용도 | 레코드 |
|--------|------|--------|
| `hdg1234.cloud` | SPA + API 모두 | A Alias → ALB |
| ~~`api.hdg1234.cloud`~~ | ~~API 전용~~ | **사용하지 않음** |

**`api.hdg1234.cloud`를 별도로 쓰지 않는 이유:**

- Nginx가 한 도메인 안에서 **경로 기반**으로 WEB/WAS를 분기한다 (`/` → SPA, `/api` → Nest)
- 같은 오리진이므로 **CORS 설정이 불필요**
- 브라우저 쿠키가 자연스럽게 공유됨
- 서브도메인을 쓰면 ALB 리스너 규칙 또는 별도 대상그룹이 필요 → 복잡도 증가

와일드카드 인증서(`*.hdg1234.cloud`)는 이미 발급됐으므로 나중에 `api.hdg1234.cloud`를 쓸 수도 있지만, **1차는 경로 기반 단일 도메인으로 간다.**

### 2.3 AMI 선택 — Ubuntu 24.04 LTS

| 항목 | 선택 | 이유 |
|------|------|------|
| OS | **Ubuntu 24.04 LTS** | 최신 안정판, Docker 공식 지원, apt 패키지 풍부 |
| ~~Amazon Linux 2023~~ | 미사용 | dnf는 익숙하지만 Ubuntu가 Docker 생태계와 궁합 좋음 |

Ubuntu 24.04에서 Docker 설치는 `apt install docker.io docker-compose-v2`로 간결하다.

---

## 3. 시공 순서 — 무엇을 먼저 하는가

```text
┌─────────────────────────────────────────────────────────────┐
│  1단계: 이미지 준비 (로컬)                                  │
│    프론트: Dockerfile → npm build → dist 포함 Nginx 이미지  │
│    백엔드: Dockerfile → NestJS 이미지                       │
│    → ECR에 push                                             │
├─────────────────────────────────────────────────────────────┤
│  2단계: ECR + IAM (Terraform)                               │
│    ECR 리포지토리 생성 (nginx, nest)                        │
│    IAM Instance Profile (ECR pull 권한)                     │
├─────────────────────────────────────────────────────────────┤
│  3단계: Bastion (Terraform)                                 │
│    경비실 EC2 + SSH 접속 확인                               │
├─────────────────────────────────────────────────────────────┤
│  4단계: ALB + 대상그룹 (Terraform)                          │
│    ALB 생성, 리스너 80→301, 443→TG                         │
│    대상그룹: instance, port 80, /health                     │
├─────────────────────────────────────────────────────────────┤
│  5단계: 시작 템플릿 + ASG (Terraform)                       │
│    Launch Template: Ubuntu 24.04, User Data                 │
│    ASG: 프라이빗 a/b/c, target_group_arns                  │
│    → EC2 부팅 시 Docker 설치 + ECR pull + compose up       │
├─────────────────────────────────────────────────────────────┤
│  6단계: Route 53 Alias (Terraform)                          │
│    hdg1234.cloud → ALB                                      │
├─────────────────────────────────────────────────────────────┤
│  7단계: AMI 스냅샷 (수동/선택)                              │
│    정상 동작 확인 후 AMI 생성 → 향후 빠른 부팅용           │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Docker 이미지 빌드 & ECR Push 흐름

### 4.1 프론트엔드 (React SPA → Nginx 이미지)

```text
[로컬 또는 CI]
  프론트 소스 → npm run build → dist/ 생성
       ↓
  Dockerfile (nginx 기반)
    FROM nginx:alpine
    COPY dist/ /usr/share/nginx/html/
    COPY nginx.conf /etc/nginx/conf.d/default.conf
       ↓
  docker build -t {ECR_URL}/nginx:latest .
  docker push {ECR_URL}/nginx:latest
```

### 4.2 백엔드 (NestJS 이미지)

```text
[로컬 또는 CI]
  NestJS 소스 → npm run build → dist/ 생성
       ↓
  Dockerfile (node 기반)
    FROM node:20-alpine
    COPY dist/ package.json package-lock.json ./
    RUN npm ci --production
    CMD ["node", "dist/main.js"]
       ↓
  docker build -t {ECR_URL}/nest:latest .
  docker push {ECR_URL}/nest:latest
```

### 4.3 ECR Push 명령 (AWS CLI)

```bash
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin {ACCOUNT_ID}.dkr.ecr.ap-northeast-2.amazonaws.com

docker push {ACCOUNT_ID}.dkr.ecr.ap-northeast-2.amazonaws.com/nginx:latest
docker push {ACCOUNT_ID}.dkr.ecr.ap-northeast-2.amazonaws.com/nest:latest
```

---

## 5. Nginx `.conf` — 리버스 프록시 설계

```nginx
server {
    listen 80;
    server_name _;

    # SPA 정적 파일 서빙 (WEB)
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # API 리버스 프록시 (WAS)
    location /api/ {
        proxy_pass http://nest:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 헬스체크 (ALB가 이 경로를 두드림)
    location /health {
        proxy_pass http://nest:3000/health;
    }
}
```

| 경로 | 처리 | 설명 |
|------|------|------|
| `/` | Nginx가 직접 서빙 | React SPA의 `dist/index.html` |
| `/api/*` | `proxy_pass http://nest:3000` | Compose 내부 DNS로 NestJS에 전달 |
| `/health` | Nest에 프록시 | ALB 헬스체크. Nest가 죽으면 502 → 언헬시 |

**핵심:** `proxy_pass` 대상이 `http://nest:3000`이다. 이것은 Docker Compose 내부 서비스 이름이다. 호스트 포트를 열지 않고 Compose 네트워크 안에서만 통신한다. 보안 그룹에 3000을 열 필요가 없다.

### 5.1 왜 `http://nest:3000`이고 `https://api.hdg1234.cloud`가 아닌가

두 가지 방식을 비교한다.

```text
방식 A (현재 설계): Compose 내부 통신
──────────────────────────────────────
[브라우저] → https://hdg1234.cloud/api/orders
    → [ALB :443] TLS 종료
        → [EC2 Nginx :80]
            → proxy_pass http://nest:3000   ← Compose 내부 DNS
                → [같은 EC2 안 Nest 컨테이너]

경로: 브라우저 → ALB → Nginx → (EC2 내부) → Nest
네트워크: Compose bridge. 인터넷 안 나감.


방식 B (서브도메인 방식): 외부 도메인 경유
──────────────────────────────────────
[브라우저] → https://hdg1234.cloud/api/orders
    → [ALB :443] TLS 종료
        → [EC2 Nginx :80]
            → proxy_pass https://api.hdg1234.cloud   ← 외부 도메인
                → [NAT Gateway] → 인터넷 → [Route 53] → [ALB] → [다시 EC2]

경로: 브라우저 → ALB → Nginx → NAT → 인터넷 → ALB → Nginx/Nest (헤어핀)
```

| 비교 항목 | 방식 A: `http://nest:3000` | 방식 B: `https://api.hdg1234.cloud` |
|-----------|---------------------------|--------------------------------------|
| 통신 경로 | EC2 내부 (Compose 네트워크) | EC2 → NAT → 인터넷 → ALB → 다시 EC2 |
| 지연 | **~0ms** (같은 호스트) | 수십ms (네트워크 왕복) |
| NAT 비용 | 없음 | **발생** (요청마다 과금) |
| 무한루프 위험 | 없음 | ALB 리스너 규칙 실수 시 **헤어핀 루프** |
| TLS 이중 암호화 | 없음 (내부는 HTTP) | 발생 (Nginx→ALB 구간 재암호화) |
| 보안 그룹 | 3000 안 열어도 됨 | 추가 규칙 필요 |
| Route 53 레코드 | 불필요 | `api.hdg1234.cloud` A Alias 추가 필요 |
| ALB 리스너 규칙 | 불필요 | 호스트 기반 분기 규칙 추가 필요 |
| CORS | 같은 오리진 → **불필요** | 다른 오리진 → **설정 필요** |

**방식 B(`api.hdg1234.cloud`)가 의미 있는 경우:**

- WEB 서버와 WAS 서버가 **물리적으로 다른 EC2/ASG**에 분리된 아키텍처
- WEB이 S3+CloudFront에 있고 WAS가 별도 ALB 뒤에 있는 경우
- 마이크로서비스로 API를 외부에 독립 공개할 때

**현재 설계에서는 Nginx와 Nest가 같은 EC2 안 Compose에 있으므로, 외부 도메인을 거칠 이유가 전혀 없다.** 같은 집 안에서 옆방에 가는데 밖으로 나갔다 다시 들어오는 셈이다.

비유:

> 아파트 101호(Nginx)에서 102호(Nest)에 택배를 보내는데,  
> **방식 A:** 복도로 건너가서 문 두드림 (Compose 내부)  
> **방식 B:** 택배를 우체국에 맡기고, 우체국이 같은 아파트로 배달 (인터넷 경유)  
> 당연히 복도로 건너가는 게 맞다.

---

## 6. Docker Compose (EC2 내부)

```yaml
services:
  nginx:
    image: ${ECR_URL}/nginx:latest
    ports:
      - "80:80"
    depends_on:
      - nest

  nest:
    image: ${ECR_URL}/nest:latest
    environment:
      - PORT=3000
      - NODE_ENV=production
    expose:
      - "3000"
```

| 서비스 | 포트 | 외부 노출 |
|--------|------|-----------|
| nginx | 80:80 | **ALB만 접근** (sg-app이 ALB에서만 80 허용) |
| nest | 3000 | **노출 안 함** — `expose`만 (Compose 내부) |

`ports`와 `expose`의 차이가 보안의 핵심이다:
- `ports: "80:80"` → 호스트의 80 포트에 바인딩 → ALB가 여기를 두드림
- `expose: "3000"` → Compose 네트워크 내부에서만 접근 가능 → 외부 불가

---

## 7. IAM + ECR Pull 경로 — 내부에서 이미지를 가져오는 방법

### 7.1 왜 S3 Gateway Endpoint가 필요한가

ECR의 실체는 이렇다:
- **ECR API** (인증, 매니페스트 조회) → `ecr.ap-northeast-2.amazonaws.com` → NAT를 통해 나감
- **ECR 이미지 레이어** → 실제 파일은 **S3에 저장**됨 → S3 Gateway Endpoint를 타면 NAT 비용 없이 프라이빗에서 직접 다운로드

```text
[앱 EC2 (프라이빗 서브넷)]
    │
    ├── ECR API (인증 토큰, 매니페스트) ──▶ NAT Gateway ──▶ 인터넷 ──▶ ECR 서비스
    │
    └── 이미지 레이어 (실제 파일) ──▶ S3 Gateway Endpoint ──▶ S3 (비용 0, NAT 안 탐)
```

S3 Gateway Endpoint는 **이미 네트워크 모듈에서 생성 완료**다. 추가 작업 없이 ECR pull이 내부 경로를 탄다.

### 7.2 IAM Instance Profile — 허가증

EC2가 ECR에서 이미지를 당기려면 **Instance Profile**(역할)이 필요하다.

필요한 권한:

```text
ecr:GetAuthorizationToken      ← docker login 토큰 발급
ecr:BatchGetImage              ← 이미지 매니페스트 조회
ecr:GetDownloadUrlForLayer     ← 레이어 다운로드 URL (S3 경유)
```

비유: 창고(ECR)에서 상자(이미지)를 꺼내려면 **열쇠(Instance Profile)**가 있어야 한다. 열쇠 없이 가면 문이 안 열린다.

---

## 8. User Data — EC2 부팅 시 자동 실행

EC2가 처음 뜰 때 자동으로 Docker를 설치하고 ECR에서 이미지를 당겨와 실행한다.

```bash
#!/bin/bash
# 1. Docker 설치 (Ubuntu 24.04 — apt awscli 없음)
apt-get update -y
apt-get install -y docker.io docker-compose-v2 curl unzip
systemctl enable docker && systemctl start docker

# 1b. AWS CLI v2 공식 설치 (noble에 apt awscli 패키지 없음)
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
unzip -qo /tmp/awscliv2.zip -d /tmp && /tmp/aws/install

# 2. ECR 로그인
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin ${ECR_URL}

# 3. docker-compose.yml 생성 & 실행
cat > /opt/app/docker-compose.yml <<'EOF'
services:
  nginx:
    image: ${ECR_URL}/nginx:latest
    ports:
      - "80:80"
    depends_on:
      - nest
  nest:
    image: ${ECR_URL}/nest:latest
    environment:
      - PORT=3000
      - NODE_ENV=production
    expose:
      - "3000"
EOF

cd /opt/app && docker compose up -d
```

이 스크립트가 **시작 템플릿(Launch Template)**의 User Data에 들어간다. ASG가 새 인스턴스를 띄울 때마다 이 과정이 자동으로 반복된다.

---

## 9. 시작 템플릿 → 대상그룹 → ALB → ASG 연결 구조

```text
[ Launch Template ]
  - AMI: Ubuntu 24.04 LTS
  - Instance Type: t3.small
  - SG: sg-app
  - IAM Instance Profile: ECR pull 권한
  - User Data: Docker + ECR pull + compose up
  - Key Pair: SSH 접속용
        │
        ▼
[ Auto Scaling Group ]
  - min: 1, desired: 2, max: 3
  - 서브넷: private_app a/b/c
  - health_check_type: ELB
  - target_group_arns: [TG]     ← 여기서 ALB와 연결됨
        │
        ▼
[ Target Group ]
  - target_type: instance
  - port: 80
  - health_check: GET /health
        │
        ▼
[ ALB ]
  - 리스너 443 → forward → TG
  - 리스너 80 → 301 → HTTPS
  - ACM 인증서 바인딩
        │
        ▼
[ Route 53 ]
  - hdg1234.cloud → A Alias → ALB
```

**연결 핵심:**
- ASG의 `target_group_arns`가 대상그룹을 가리킨다
- 대상그룹이 ALB 리스너에 연결된다
- EC2가 뜨면 ASG가 **자동으로** 대상그룹에 등록한다 (수동 등록 불필요)
- EC2가 죽으면 ASG가 자동으로 대상그룹에서 빼고 새 인스턴스를 띄운다

---

## 10. AMI 스냅샷 — 향후 빠른 부팅용

EC2에 Docker + 이미지까지 정상 동작하는 것을 확인한 뒤, **AMI로 저장**해둔다.

| 구분 | User Data 방식 | AMI 방식 |
|------|----------------|----------|
| 부팅 시간 | 느림 (apt + pull 매번) | 빠름 (이미 설치됨) |
| 이미지 업데이트 | compose pull만 하면 됨 | AMI 재생성 필요 |
| 용도 | 개발 단계 (유연) | 운영 단계 (빠른 스케일아웃) |

**1차는 User Data 방식으로 진행한다.** 안정화 후 AMI로 굳히는 것은 선택 사항이다.

---

## 11. 왜 DB를 지금 하지 않는가

| 이유 | 설명 |
|------|------|
| 수명이 다르다 | 앱 ASG는 갈아치워도 DB 데이터는 남아야 함 |
| 스케일이 다르다 | WAS는 수평 확장, DB는 3노드 쿼럼 |
| 포트가 다르다 | 80 vs 13306/13361 |
| 검증 순서 | `/health`만 200이면 WEB+WAS 인프라는 성공. DB 없어도 됨 |

1차 NestJS는 DB·Redis 없이도 `/health`에 200을 내도록 만든다.

---

## 12. 성공 기준

**성공:**
- `terraform output`에 ALB DNS, Bastion 공인 IP가 나온다
- `https://hdg1234.cloud`로 SPA가 뜬다
- `/health`가 200, ALB 대상이 healthy
- Bastion 없이는 앱 EC2에 접근 불가 (프라이빗 격리 확인)
- Bastion 경유 SSH로 앱에 접속 가능
- 인스턴스 하나를 terminate하면 ASG가 새로 띄움

**아직 실패가 아닌 것:**
- 로그인·주문 API가 500 — DB가 없으니 당연
- 이미지 업데이트 자동화 없음 — CI/CD는 다음

---

## 13. 일부러 안 하는 것

| 미룸 | 어디서 |
|------|--------|
| MySQL 3노드 InnoDB Cluster | `modules/database` — 설계는 [DB 기획·설계편](./blog-database-innodb-cluster-design.md) |
| Redis | `modules/redis` |
| WEB ASG / WAS ASG 분리 | 2차 확장 |
| GitHub Actions → docker push + ASG refresh | compose 안정 후 |
| Docker Swarm | 안 함. ASG+ALB가 오케스트레이션 |
| api.hdg1234.cloud 서브도메인 | 경로 기반으로 충분. 필요 시 추가 |
| CloudFront / API Gateway | 불필요 |

---

## 14. 한 줄 요약

프론트와 백엔드를 각각 Docker 이미지로 빌드해 ECR에 올리고, Ubuntu 24.04 EC2에서 Compose로 Nginx(WEB) + Nest(WAS)를 띄우되, ALB가 HTTPS 정문을 열고, ASG가 인스턴스 수를 조절하며, Nginx `.conf`의 리버스 프록시가 `/api` 요청을 Nest에 전달하는 것이 이번 컴퓨트의 전부다.

Terraform 구현 상세(HCL 코드, 파일 구조, 코딩 순서)는 [컴퓨트 Terraform 구현편](./blog-compute-terraform-implementation.md)에서 다룬다.
