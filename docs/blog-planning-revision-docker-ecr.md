# 밑바닥부터 다시 쌓는 3-Tier 인프라 — 기획 수정: Docker는 2차가 아니다

이미 발행한 글이 있다.

- [인트로](./blog-ecs-less-3tier-intro.md) — Fargate를 EC2·ALB·ASG·Nginx로 재구현한다  
- [WEB·WAS 컴퓨트 설계](./blog-compute-web-was-design.md) — Bastion·ALB·ASG, 1차는 호스트에 패키지 설치  

그 두 편의 **1차 결론은 틀리지 않았지만, 범위가 좁았다.**  
글을 지우고 처음부터 다시 쓰는 대신, 이 편에서 **무엇이 바뀌었는지, 왜 바뀌었는지, 시행착오가 어디였는지**를 남긴다.

설계가 한 번에 맞는 경우는 드물다. 단지 도면을 고쳤으면 변경 이력을 남기는 것이 실무다.

---

## 0. 한 줄로 먼저

| | 발행했던 1차 기획 | 지금 (수정) |
|--|-------------------|-------------|
| ECS에서 빼는 것 | Fargate **전체** (스케줄러 + 컨테이너 배포 방식) | **스케줄러만** (Cluster / Task / Service / Fargate) |
| 앱을 올리는 방법 | EC2에 Nginx·Node **패키지 + systemd** | EC2에 **Docker Compose** (Nginx + Nest 컨테이너) |
| ECR | 1차에서 **삭제**, 2차 선택 | **1차에 살린다** |
| Docker | “쓸지는 선택. 2차에 올려도 된다” | **오늘까지 배운 바닥이므로 1차에 넣는다** |
| Swarm | 언급 거의 없음 | **클러스터는 안 띄운다.** replicas·ingress 역할만 ALB+ASG로 치환 |
| 안 바뀐 것 | VPC, SG, ALB `instance:80`, ASG, Bastion, ACM HTTPS, EC2 MySQL 클러스터, RDS 안 씀 | 그대로 |

바뀐 것은 “3-Tier를 포기한다”가 아니다.  
**ECS 대체 밑바닥을 어디까지로 보느냐**가 바뀐 것이다.

---

## 1. 발행 당시 기획이 말했던 것

인트로와 컴퓨트 편의 원래 문장은 대략 이랬다.

> Fargate가 가리던 층을 EC2·ALB·ASG·Nginx로 다시 깐다.  
> Docker는 써도 되고, 호스트에 직접 올려도 된다.  
> 1차는 단순하게 **S3 아티팩트 + User Data + systemd** 가 맞다.  
> ECR은 Fargate 파이프라인의 일부이므로 compute에서 뺀다.

당시의 논리는 분명했다.

1. **실패 지점을 나누자.** ASG·SG·ALB `target_type=instance`·Nginx 프록시를 먼저 검증하고, 컨테이너는 나중에.  
2. **한 스프린트에 ECR pull IAM, compose 네트워크, 이미지 태그를 섞지 말자.**  
3. ECS를 버린다는 말을, 무의식적으로 **컨테이너 배포 전체**로 넓혀 읽었다.

그래서 테이블에는 이런 줄이 있었다.

| 기존 리소스 | 당시 결정 |
|-------------|-----------|
| `aws_ecr_repository` | 1차 버린다 |
| Docker / ECR | 선택 2차 |
| User Data | yum으로 Nginx·Node, S3 sync, systemd |

도메인·ACM 편, 네트워크·보안 그룹 편은 이 수정과 **거의 무관**하다. HTTPS 정문과 담장은 그대로다.

---

## 2. 어디서 막혔는가

컴퓨트 도면을 고정한 뒤, 교육 [Day35 ECR + Docker Swarm](https://backbone-archive.tistory.com/229) 과 “ECS를 EC2로 대체한다”는 문장이 겹쳤다.

질문이 이어졌다.

1. ECS는 오케스트레이션인데, Fargate를 안 쓰면 **ECS on EC2**가 맞는 것 아닌가?  
2. 밑바닥부터 ECS를 대체하는 프로젝트인데 **왜 Docker를 안 쓰나?**  
3. 오늘까지 배운 내용이 ECS 대체 밑바닥 **전체**이고, 내일부터 ECS·쿠버네티스다. 그러면 이 프로젝트가 그 바닥을 다 쓰는 것 아닌가?

1번은 개념이 맞다. ECS의 launch type은 Fargate와 **EC2**다.  
다만 이 프로젝트는 ECS **제품**을 쓰지 않기로 이미 잠갔다. ECS on EC2는 여전히 ECS 클러스터·에이전트·태스크 정의다.

2번과 3번이 기획을 뒤집었다.

ECS를 층으로 나누면 이렇다.

```text
③ 오케스트레이션   ECS Service / Swarm / Kubernetes     ← 내일 수업
② 컨테이너 런타임  Docker                                ← 오늘까지 이미 배움
① 머신             EC2 + ALB + ASG                       ← 1차 기획이 여기만 파던 층
```

발행 글은 **③만 빼고 ②까지 같이 빼 버렸다.**  
그러면 내일 ECS를 들을 때 대조할 바닥이 “컨테이너를 스케줄하기 전 상태”가 아니라 **패키지가 깔린 일반 서버**가 된다.  
배운 것을 모두 써서 밑바닥을 구현한다는 목표와 어긋난다.

시행착오의 본질은 기술 버그가 아니라 **문장의 범위**였다.

> “ECS를 대체한다” = “Fargate를 안 쓴다” 로만 읽으면, Docker·ECR까지 2차로 밀리기 쉽다.  
> “ECS를 대체한다” = “스케줄러를 ASG+ALB로 바꾸고, 런타임은 오늘 배운 Docker를 쓴다” 가 커리큘럼과 맞다.

---

## 3. 수정 후 고정한 그림

내일부터 교육은 ECS와 Kubernetes다.  
그 수업이 전제하는 바닥을 **오늘까지 배운 것 전부로** 한 단지에 조립하는 것이 이 프로젝트다.

```text
브라우저
  → https://hdg1234.cloud     (Route 53 + ACM, 이 부분은 수정 없음)
  → ALB :443
  → ASG EC2 :80
       [Docker Compose]
         Nginx  ── 정적 dist
                ── proxy → Nest :3000  (compose 네트워크, 호스트 미공개)
                      → (이후) EC2 MySQL 클러스터
```

### 3.1 살리는 것 / 여전히 버리는 것

| 항목 | 수정 후 |
|------|---------|
| Docker Engine on 앱 EC2 | **1차. 넣는다** |
| ECR 리포지토리 | **1차. 넣는다.** pull 주체만 ECS agent → EC2 User Data |
| Compose (Nginx + Nest 한 박스) | **1차.** 교육 3-Tier와 동일 |
| ASG desired | Swarm `replicas` / ECS `desired_count`의 자리 |
| ALB → instance :80 | Swarm ingress / ECS `target_type=ip:3000`을 대체. **여기 수정 없음** |
| Docker Swarm 클러스터 | **안 띄운다** |
| ECS Cluster / Task / Service / Fargate | **버린다.** 스케줄러 본체 |
| RDS / CloudFront / API Gateway | **버린다.** 이전과 동일 |
| systemd로 Nginx·Nest 직접 기동 | **1차 기본 경로에서 철수.** Docker가 그 자리 |

### 3.2 Swarm은 왜 제품으로 안 올리나

Day35는 Swarm으로 3-Tier HA를 올렸다. 배운 것을 “모두” 쓴다고 해서 **매니저 노드 + overlay + stack deploy**를 Terraform에 심지는 않는다.

이유는 단순하다. Swarm은 오케스트레이터다. 내일 배울 ECS가 그 AWS 판이다.  
바닥에 Swarm을 두고 그 위에 ECS를 배우면 스케줄러가 두 개다.

대신 **역할만** 옮긴다.

| Day35 Swarm | 수정된 프로젝트 |
|-------------|-----------------|
| Docker Engine | 각 앱 EC2에 Docker |
| ECR + S3 레이어 | ECR + 이미 있는 S3 Gateway Endpoint |
| `replicas` | ASG desired |
| Ingress mesh :80 | ALB → EC2 :80 |
| overlay에서 WAS 포트 안 열기 | Compose 내부 DNS. `sg-app`은 80만 ALB |
| AZ spread | ASG를 앱 프라이빗 a/b/c |

교육에서 몸으로 익힌 감각은 남기고, 제품은 AWS 쪽에 맞춘다.

---

## 4. 문서·코드에 손댄 곳 (레포 기준)

발행 글 본문을 몰래 고쳐서 “원래부터 이렇게 하려고 했다”고 만들지 않는다.  
레포의 설계 파일은 **수정본이 정본**이고, 이 편이 변경 이력이다.

| 파일 | 수정 내용 |
|------|-----------|
| [blog-ecs-less-3tier-intro.md](./blog-ecs-less-3tier-intro.md) | 커리큘럼 경계(오늘까지 = 이 프로젝트). Docker·ECR 1차. Swarm은 치환만 |
| [blog-compute-web-was-design.md](./blog-compute-web-was-design.md) | ECR 살림, User Data = compose, Instance Profile = ECR pull, “Docker 2차” 삭제 |
| [blog-acm-route53-https-design.md](./blog-acm-route53-https-design.md) | 다음 코딩 한 줄만 compute에 Docker·ECR이 붙는다고 명시. HTTPS 설계는 그대로 |
| 이 글 | 발행분과의 차이, 질문 세 개, 왜 ②층을 빼면 안 되는지 |

Terraform `modules/compute`는 아직 없다. 바뀐 것은 **도면**이다. 코딩할 때 User Data가 `yum install nginx`가 아니라 `docker compose up`인 것이 이 수정의 실체다.

---

## 5. 안 바뀐 것 — 헷갈리지 말 것

기획을 고쳤다고 단지 전체를 헐지 않는다.

- VPC 9서브넷, NAT 1개, S3 Gateway Endpoint  
- SG 체이닝 (`sg-alb` → `sg-app` :80)  
- ALB 타깃 **instance + 80**, Nest :3000을 ALB에 직접 안 묶음  
- 호스팅케이알 NS 수동 위임, Route 53 존은 `data`만, ACM 루트+와일드카드  
- compute에 DB 클러스터를 넣지 않음  
- WEB ASG / WAS ASG 물리 분리는 여전히 나중  

바뀐 것은 **주방에 냄비를 올리는 방식**뿐이다. 도로와 정문 자물쇠는 그대로다.

---

## 6. 이 시행착오에서 남긴 문장

다음에 같은 종류의 기획을 할 때 먼저 물을 것.

1. **빼는 서비스의 어느 층인가?** 스케줄러인가, 런타임인가, 머신인가.  
2. **내일 수업이 전제하는 바닥을 오늘 프로젝트에서 빼 버리지 않았는가?**  
3. “단순하게 가려면 2차”가 **커리큘럼을 자르는 핑계**가 되지 않는가.

실패 지점을 나누는 것 자체는 맞다.  
그래서 코딩 순서는 여전히 **Bastion → Docker Nginx stub + ALB → ECR compose 입주 → ASG 교체**다.  
한 번에 Swarm까지 올리지 않는다. 나눈 것은 시공 순서이고, 빼기로 한 층이 Docker가 아니게 된 것이다.

---

## 7. 한 줄 요약

발행했던 기획은 ECS를 버린다는 말을 **컨테이너까지 2차로 미루는 말**로 읽었다.  
수정 후 기획은 ECS에서 **스케줄러만** 버리고, 오늘까지 배운 **Docker·ECR·Compose**를 1차에 넣는다. Swarm 클러스터는 올리지 않고 ALB+ASG가 그 역할을 한다.

이전 글은 지우지 않는다. 이 편이 그 글 위의 **변경 이력**이다.
