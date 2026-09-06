# 밑바닥부터 다시 쌓는 3-Tier 인프라 — ECS가 숨기던 층을 오늘까지 배운 것으로 재구현하며

> **발행 후 기획 수정.** 초고는 Docker·ECR을 2차로 미뤘다. 왜 바꿨는지는 [기획 수정 편](./blog-planning-revision-docker-ecr.md)에 있다. 아래 본문은 **수정 후 정본**이다.

이번 프로젝트는 **ECS·쿠버네티스 수업을 듣기 전에**, 그 아래층을 **오늘까지 배운 것 전부로** 한 번 조립하는 일이다.

내일부터 교육은 **ECS와 Kubernetes**로 올라간다.  
그 수업이 다루는 것은 오케스트레이터다. 컨테이너를 어디에 몇 개 둘지, 죽으면 누가 다시 띄울지.

오늘까지 배운 것은 그 오케스트레이터가 **전제하는 바닥**이다.

> VPC · 보안 그룹 · EC2 · ALB · ASG · Nginx · Docker · ECR · Compose/Swarm 개념 · MySQL 클러스터 · Route 53 · ACM

Fargate + RDS만 쓰면 이 층이 한 번에 가려진다.  
그래서 이 프로젝트는 Fargate를 **쓰지 않고**, 위 목록을 **직접 이어** 3-Tier를 만든다.  
내일 ECS를 들을 때 “손이 한 일 = 매니지드가 가린 일”을 대조할 수 있게 하려는 것이다.

온프레미스로 가지 않는다. 실습은 모두 **AWS**다.

---

## 0. 커리큘럼 경계 — 오늘까지가 한 프로젝트다

```text
[ 오늘까지 배운 층 = 이 프로젝트 ]
  Docker 엔진, 이미지, Compose, Swarm이 보여 준 오케스트레이션 감각
  ECR, VPC, SG, ALB, ASG, Nginx 3-Tier, EC2 MySQL 클러스터
  도메인 · Route 53 · ACM HTTPS
           │
           │  내일부터
           ▼
[ ECS / Kubernetes ]   ← 같은 일을 AWS·K8s가 스케줄러로 대신하는 층
```

이 프로젝트의 질문은 “Docker를 2차로 미룰까?”가 아니다.

> **오늘까지 배운 ECS 대체 밑바닥을, 빼지 않고 쿠팡이츠 클론에 다 쓰는가?**

답은 **다 쓴다.**

다만 Swarm **제품**을 클러스터로 다시 올리지 않는다.  
Swarm은 오늘 배운 **오케스트레이터 감각**이고, 내일 배울 ECS가 그 AWS 판이다.  
바닥에 Swarm을 심고 그 위에 ECS를 또 배우면 스케줄러가 두 개가 된다.

Swarm이 하던 역할은 AWS 부품으로 **치환**한다.

| 오늘 교육 (예: Day35 Swarm) | 이 프로젝트 |
|-----------------------------|-------------|
| Docker Engine | **각 앱 EC2에 Docker** |
| 이미지 저장소 | **ECR** (레이어는 S3. 이미 있는 S3 Gateway Endpoint) |
| `replicas: 2` | **ASG desired** |
| Ingress mesh / 노드:80 | **ALB → EC2 :80** (`target_type = instance`) |
| overlay에서 WAS·DB 포트 안 열기 | **SG + Compose 내부 네트워크.** Nest는 호스트 3000을 퍼블릭에 안 연다 |
| AZ spread / 라벨 | ASG를 앱 프라이빗 **a/b/c**에 걸쳐 둠 |
| 매니저 Drain | 없음. 스케줄러가 AWS(ASG+ALB)라서 매니저 노드를 안 둔다 |

**빼는 것:** ECS Fargate, ECS Service/Task, RDS, CloudFront, API Gateway.  
**안 빼는 것:** Docker, ECR, Nginx WEB, ALB, ASG, 도메인·ACM, EC2 MySQL 클러스터.

---

## 1. 기존에 했던 것, 그리고 빈칸

기존에는 다음과 같이 인프라를 구축했다.

- 컴퓨팅: **ECS Fargate**
- 데이터베이스: **RDS (Aurora MySQL)**
- 이미지 저장소: **ECR**
- CI/CD: **GitHub Actions**

이 조합은 배포와 운영을 빠르게 가져가기에는 훌륭했다.  
컨테이너 이미지를 빌드해 ECR에 올리고, Actions로 ECS 서비스를 갱신하면 WAS가 떠 있는 상태를 만들 수 있었다.

문제는 **3-Tier 아키텍처에 대한 이해 부족**이었다.  
당시에는 “백엔드단, 즉 **WAS단만** 인프라로 구축하면 된다”고 생각했고, 그 결과 **WEB단**을 인프라 설계에 넣지 못했다.  
구조적으로 보면 WAS + DB에 가까운 **2-Tier**였고, 교육에서 말하는 Nginx WEB 층이 비어 있었다.

이번엔 그 빈칸을 메우고, Fargate가 숨기던 **호스트·Docker·ASG**까지 같이 깐다.

---

## 2. 이번 프로젝트의 목표와 원칙

- **목표:** 내일 배울 ECS가 전제하는 바닥을, 오늘까지 배운 AWS·Docker·3-Tier로 재구현한다.
- **원칙:** 온프레미스로 가지 않는다. 클라우드 안에서 밑바닥을 판다.
- **범위:** 로드밸런서·오토스케일을 리눅스만으로 재발명하지 않는다.  
  - 로드밸런싱 → **ALB** (Swarm Ingress의 AWS 판)  
  - 인스턴스 용량·교체 → **ASG** (replicas / desiredCount의 AWS 판)  
  - 컨테이너 런타임 → **Docker on EC2**  
  - 이미지 → **ECR**  
  - WEB → **Nginx 컨테이너** (SPA `dist` + 리버스 프록시)  
  - WAS → **Nest 컨테이너** (같은 Compose 네트워크)  
  - DB HA → **EC2 MySQL 클러스터** (RDS의 바닥. 앱 Compose 안의 MySQL이 아님)  
  - 정문 → **Route 53 + ACM**, TLS는 ALB에서 종료  

ALB·ASG까지 스크립트로 직접 만드는 것은 목표가 아니다.  
그건 AWS를 다루는 실습이 아니라 리눅스 DIY다.  
반대로 Docker를 빼면 “컨테이너 오케스트레이션의 바닥”이 아니라 **그냥 패키지 설치 서버**가 된다.  
ECS가 스케줄하는 단위는 컨테이너이므로, **Docker는 1차에 넣는다.**

---

## 3. 3-Tier를 이번 실습에 어떻게 매핑하는가

| 티어 | 역할 | 기존 (Fargate 경로) | 이번 재구현 |
|------|------|---------------------|-------------|
| **WEB** | 정적 화면, 요청 입구, 리버스 프록시 | 거의 없음 / 로컬 Vite | **Nginx 컨테이너** on ASG EC2 |
| **WAS** | 비즈니스 API (NestJS) | ECS Fargate + ALB + ECR | **Nest 컨테이너** + ALB + ASG (ECS **스케줄러** 대체) |
| **DB** | 영속 데이터 | RDS / Aurora | **EC2 MySQL 클러스터** (컨테이너 MySQL 아님) |

앱 스택은 쿠팡이츠 클론의 **NestJS(WAS)** 와 **React SPA(WEB 산출물)** 를 기준으로 한다.

요청 흐름:

```text
사용자 브라우저
  → https://hdg1234.cloud   (Route 53 Alias + ACM on ALB)
  → ALB :443
    → ASG의 EC2 :80
         [Docker Compose]
           Nginx  ── /           → SPA dist
                  ── /api, /auth → Nest :3000  (compose 네트워크, 호스트 미공개)
                      → [DB] EC2 MySQL 클러스터   (DB 모듈 이후)
```

ALB 타깃은 **인스턴스 :80** 이다. Fargate처럼 컨테이너 IP:3000을 직접 치지 않는다.  
그게 WEB 티어를 인프라에 넣는다는 뜻이다.

---

## 4. 티어별 구축 방향

### 4.1 DB단 — EC2로 클러스터

RDS가 대신해 주던 고가용 일부를, 교육에서 다룬 **EC2 위 MySQL InnoDB Cluster + Router**로 연습한다.  
Swarm YAML의 `my-db` 컨테이너로 대체하지 않는다. DB는 수명·쿼럼·포트(13306/13361)가 앱과 다르다.

데이터는 WAS ASG와 **별도 EC2**에 둔다.

### 4.2 WAS·WEB — Docker + EC2 + ALB + ASG로 ECS 스케줄러 대체

ECS Fargate Service가 하던 일을 이렇게 나눈다.

| ECS가 하던 일 | 이번 |
|---------------|------|
| 컨테이너 실행 | **Docker** (`docker compose up`) |
| 이미지 pull | **ECR** + Instance Profile |
| 몇 개 유지 | **ASG desired** |
| 죽은 것 교체 | ALB unhealthy → ASG 교체 |
| 어디에 둘지 | Launch Template 서브넷 = 앱 프라이빗 3AZ |
| 앞에 붙는 LB | **ALB** → Nginx :80 |

같은 ASG EC2에 **Nginx + Nest Compose**를 둔다.  
교육에서 한 박스에 WEB+WAS를 올린 실습과 같다.  
WEB 전용 ASG / WAS 전용 ASG 분리는 그다음 확장이다.

### 4.3 WEB단 — Nginx

React는 빌드하면 `dist`다. 프론트 Node 서버는 필요 없다.

1. **정적 서빙:** `dist`를 Nginx document root, SPA는 `try_files`  
2. **리버스 프록시:** `/auth`, `/restaurants`, `/orders` 등 → Nest  

브라우저는 **한 도메인**만 본다. CORS·쿠키가 단순해진다.

WEB을 S3 + CloudFront만으로 구성하는 방법도 있다. 이번 초점은 **Nginx 3-Tier**이므로 CDN은 쓰지 않는다.

---

## 5. 기존 파이프라인과의 관계

| 기존 | 이번 |
|------|------|
| ECR + **Fargate/ECS Service** 배포 | ECR + **EC2 Docker Compose** + ASG refresh |
| GitHub Actions → ECS 강제 배포 | Actions → `docker push` ECR → 인스턴스 pull / ASG 인스턴스 갱신 |
| RDS | EC2 MySQL 클러스터 |
| WEB 인프라 없음 | **Nginx 컨테이너 WEB 티어** |
| Swarm 클러스터 | **안 띄움.** 역할은 ALB+ASG |

나중에 같은 이미지를 **ECS 서비스**에만 올리면, 빠진 조각이 스케줄러뿐임을 바로 볼 수 있다.

---

## 6. 한 줄 요약

이 프로젝트는 **오늘까지 배운 ECS 대체 밑바닥 전체**다. 내일 ECS/K8s로 올라가기 전에, Docker·ECR·Nginx·ALB·ASG·도메인·EC2 DB를 한 단지에 조립한다.

- **WEB:** Nginx 컨테이너 — SPA + 리버스 프록시  
- **WAS:** Nest 컨테이너 — ECS 스케줄러 대신 ASG  
- **DB:** EC2 MySQL 클러스터  
- **안 씀:** Fargate, Swarm 클러스터, RDS, CloudFront  

상세 컴퓨트 도면은 [WEB·WAS 컴퓨트 설계](./blog-compute-web-was-design.md), HTTPS는 [도메인·ACM 설계](./blog-acm-route53-https-design.md), DB는 [InnoDB Cluster 기획·설계](./blog-database-innodb-cluster-design.md)다.  
1차 발행분에서 Docker를 뺀 이유와 수정 내역은 [기획 수정 편](./blog-planning-revision-docker-ecr.md).  
**기획 대비 최종 완성 판정·전체 여정**은 [최종 정리](./blog-project-final-wrapup.md).
