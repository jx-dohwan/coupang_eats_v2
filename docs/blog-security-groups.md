# 밑바닥부터 다시 쌓는 3-Tier 인프라 — 보안 그룹(Security Group) 체이닝 (최종)

지난 편에서는 **네트워크(VPC)** 구축을 진행했다. 클라우드 인프라에서 가장 기본이 되고 근간이 되는 층이다.

VPC를 만든다는 것은 AWS 위에 **나만의 가상 사설망**을 두는 것이다. 집에서 공유기로 내부망을 만들고, 바깥 인터넷과는 NAT·공인 IP로만 맞닿게 하는 감각과 비슷하다. (가정용 공유기 이야기의 IPsec VPN과는 레이어가 다르지만, “울타리 안의 사설 주소 공간” 비유로는 VPC를 이해하기 쉽다.)

지난 네트워크 편 요약:

- VPC `/16`, AZ 3개 × (퍼블릭 / 앱 프라이빗 / DB) 서브넷 `/24` → **9개**
- 퍼블릭 RT 1 → IGW · DB RT 1 → local only · **프라이빗 앱 RT는 서브넷마다 1** → NAT  
  (한 RT에는 `0.0.0.0/0`→NAT를 하나만 넣을 수 있어, 이후 AZ별 NAT·HA를 열려면 RT를 나눠 둔다)
- S3 Gateway Endpoint · Main RT는 인터넷 경로 없이 유지

이번 편은 울타리 **안쪽 ENI에 붙는 방화벽** — **보안 그룹** — 이다.  
처음에는 `sg-alb / bastion / app / db` 네 개만 떠올리기 쉽지만, **이 프로젝트 전체 설계(특히 MySQL InnoDB Cluster + Nest의 Redis)** 를 보면 **그 정도만으로는 부족하다.**  
아래는 빠진 포트·SG까지 검증한 **최종안**이다.

참고: [교육/클라우드 기본](https://backbone-archive.tistory.com/category/%EA%B5%90%EC%9C%A1/%ED%81%B4%EB%9D%BC%EC%9A%B0%EB%93%9C%20%EA%B8%B0%EB%B3%B8) Day7·21·26·27·31, [MySQL Guide to Ports](https://dev.mysql.com/blog-archive/mysql-guide-to-ports/).

---

## 1. NACL vs Security Group

| | NACL | Security Group |
|--|------|----------------|
| 위치 | 서브넷 | ENI / 인스턴스 |
| 상태 | Stateless | **Stateful** |
| 규칙 | Allow/Deny | **Allow만** |
| 이번 프로젝트 | 기본 허용 | **체이닝이 주력** |

---

## 2. 네 개만으로 되나? — 결론부터

**애플리케이션 트래픽 체인만 보면** 네 개(ALB·Bastion·App·DB)가 뼈대다.  
**안 된다 / 더 열어야 하는 것**은 주로 DB 티어다.

| 빠진 것 | 왜 필요한가 |
|---------|-------------|
| DB **노드 ↔ 노드** Group Replication 포트 | 클러스터가 서로 못 말하면 InnoDB Cluster가 성립하지 않음 |
| (쓰는 경우) **MySQL Router** 수신 포트 | Nest는 보통 Router(6446/6447)로 붙고, Router가 노드로 중계 |
| (이 백엔드 기준) **Redis** | Nest가 JWT 블랙리스트·캐시 등에 Redis 사용 → 별도 EC2면 `sg-redis` 필요 |
| DB self / Router→DB | “App만 DB에”만으로는 클러스터·라우터 경로가 막힘 |

반대로 **SG가 필요 없는 것**: IGW, NAT Gateway, S3 **Gateway** Endpoint(라우팅만), NACL 기본값.

---

## 3. 최종 보안 그룹 목록

1차 실습(WEB+WAS 동일 EC2, DB 3노드 클러스터, Redis 별도 EC2 가정):

| SG | 붙는 대상 | 역할 |
|----|-----------|------|
| `sg-alb` | ALB | 인터넷 80/443 |
| `sg-bastion` | Bastion | SSH 점프 |
| `sg-app` | Nginx+Nest ASG | ALB·Bastion만 신뢰, DB/Redis/Router로 나감 |
| `sg-db` | MySQL 노드 3대 | 클라이언트·GR·관리 SSH |
| `sg-redis` | Redis EC2 (또는 캐시 노드) | App만 6379 |
| `sg-router` | **MySQL Router를 별도 EC2/ASG에 둘 때만** | App→Router→DB |

**Router를 App 인스턴스 로컬에 설치**하면 `sg-router`는 생략 가능하고, Router→DB 트래픽은 **`sg-app` → `sg-db`** 로 열면 된다.  
교육 Day31처럼 Router를 앞에 두는 구성을 **전용 호스트**로 가져가면 `sg-router`를 추가하는 편이 깔끔하다.

---

## 4. 체이닝 큰 그림 (최종)

```text
Internet
   │  80, 443   Source: 0.0.0.0/0
   ▼
[ sg-alb ]
   │  80        Source: sg-alb
   ▼
[ sg-app ]  Nginx + Nest (+ 선택: 로컬 MySQL Router)
   │
   ├─ DB 클라이언트 포트(커스텀) ──▶ [ sg-db ]     Source: sg-app 또는 sg-router
   ├─ Redis 6379 ──────────────────▶ [ sg-redis ]  Source: sg-app
   └─ (Router 분리 시) 6446/6447 ──▶ [ sg-router ] → sg-db

[ sg-db ] 노드들끼리
   ├─ MySQL 클라이언트 포트        Source: sg-db (self)
   └─ Group Replication 포트       Source: sg-db (self)  ★클러스터 필수

관리자 IP /32
   │  22
   ▼
[ sg-bastion ] ──22──▶ sg-app / sg-db / sg-redis / sg-router
```

---

## 5. ALB · App — 기존 설계는 유지

- ALB: In 80·443 = `0.0.0.0/0`, TLS는 **ACM on ALB**
- App: In **80만** = `sg-alb` (443 불필요)
- App에 `0.0.0.0/0:80` 금지 → ALB **우회(bypass)** 방지 (Day21 핵심)
- Health check(`/health`)도 ALB→App:80 이므로 **추가 SG 불필요**
- Nest `:3000`은 같은 호스트 Nginx proxy면 **SG에 안 열어도 됨**

---

## 6. MySQL InnoDB Cluster — “몇 개를 더 열어야 하나”

맞다. **클라이언트용 DB 포트만 App에 열어 주면 클러스터는 동작하지 않는다.**

### 6.1 포트 역할 ([MySQL Guide to Ports](https://dev.mysql.com/blog-archive/mysql-guide-to-ports/))

| 기본값 | 역할 | SG에서 |
|--------|------|--------|
| **3306** (우리는 커스텀 예: **13306**) | 클라이언트 ↔ mysqld | App 또는 Router → `sg-db` |
| **33061** (또는 수동 지정) | **Group Replication** 노드 간 | **`sg-db` → `sg-db` (self)** 필수 |
| **33060** | X Protocol (Shell/일부 도구) | 쓰면 Bastion/관리·노드 간. 안 쓰면 생략 가능 |
| **6446 / 6447** | MySQL Router RW / RO | App → Router |
| **6448 / 6449** | Router X Protocol | X 쓸 때만 |

### 6.2 커스텀 포트 함정 (반드시 읽을 것)

InnoDB Cluster는 기본적으로 GR 주소를 `mysqld 포트 × 10 + 1`로 잡는다.  
예: 3306 → **33061**.

우리가 클라이언트 포트를 **13306**으로 바꾸면 자동 계산은 `13306×10+1 = 133061` → **65535 초과로 실패**한다.  
([Configuring InnoDB Cluster Ports](https://dev.mysql.com/doc/mysql-shell/8.4/en/configuring-cluster-instance-ports.html))

따라서 커스텀 MySQL 포트를 쓸 때는:

1. **`group_replication_local_address` 포트를 수동 지정** (예: MySQL `13306`, GR `13361`), 또는  
2. MySQL 포트를 **6553 이하**로 두어 공식 계산식을 만족시킨다.

SG에도 **클라이언트 포트와 GR 포트를 둘 다** 적어야 한다. “13306만 열면 된다”는 오해다.

### 6.3 `sg-db` 인바운드 (클러스터 포함 최종)

예시: MySQL `13306`, GR `13361`, Router 미사용·App이 직접 붙거나 Router가 App 로컬.

| Port | Source | 용도 |
|------|--------|------|
| 13306 | `sg-app` (또는 `sg-router`) | 앱/라우터 → Primary/노드 |
| 13306 | `sg-db` | 노드 간 복제·복구 등 클라이언트 포트 사용분 |
| **13361** | **`sg-db`** | **Group Replication** |
| 22 | `sg-bastion` | 관리 SSH |
| (선택) 33060 | `sg-bastion` / `sg-db` | MySQL Shell X Protocol |

`0.0.0.0/0` 또는 “DB 서브넷 CIDR 통째”보다 **SG self + App/Router SG** 가 정석이다.

### 6.4 서브넷 CIDR vs SG 체이닝 — 차이와 이점

교육·실습에서는 DB 인바운드 Source를 **앱 프라이빗 서브넷 CIDR**(`10.0.10.0/24` 등)로 여는 경우도 많다.  
**둘 다 동작한다.** 차이는 **얼마나 촘촘히 허용하느냐**다.

| | Source = 앱 서브넷 CIDR | Source = `sg-app` / `sg-router` + `sg-db` self |
|--|-------------------------|------------------------------------------------|
| 한 줄 | “그 **동네(대역)** 면 통과” | “**출입증(SG)** 가진 애만 통과” |
| 허용 대상 | 그 대역 IP를 가진 **모든 ENI** | 해당 SG가 **붙은 자원만** |
| ASG로 IP가 바뀌어도 | 대역만 맞으면 OK | SG만 같으면 OK |
| 같은 서브넷에 다른 역할 EC2 | DB 포트에 **같이 열릴 수 있음** | 그 SG가 없으면 **차단** |

강사님이 CIDR을 쓰신 이유는 보통 실습에서 “프라이빗 앱 대역만 DB에”가 **한눈에 보이고**, 설정이 단순하기 때문이다. **틀린 방법이 아니다.**

이번 프로젝트에서 **`sg-app` / `sg-router` + `sg-db` self 체이닝을 선택한 이점**은 다음과 같다.

1. **최소 권한**  
   CIDR을 열면 그 안의 모든 IP(실수로 올린 임시 EC2 포함)가 DB에 닿을 수 있다.  
   체이닝은 **Nginx/WAS(또는 Router)에 그 SG를 붙인 것만** DB 클라이언트 포트에 간다.

2. **역할 = 출입증**  
   IP·서브넷이 아니라 **“앱 티어 / DB 티어”라는 역할**로 막는다.  
   같은 서브넷에 두어도 SG를 안 붙이면 DB에 못 들어간다.

3. **ASG와 궁합**  
   인스턴스가 늘고 IP가 바뀌어도 **규칙을 고칠 필요 없음**.  
   “앱 SG를 붙였는가”만 보면 된다.

4. **우회·혼선 감소**  
   Bastion이 아닌 배치용·실습용 EC2가 앱 서브넷에 있어도, **`sg-app`이 없으면** DB 클라이언트 포트는 막힌다.

5. **클러스터 self도 같은 언어**  
   `sg-db` → `sg-db`는 “DB 노드끼리만 GR/동기화”.  
   DB 서브넷 CIDR 전체를 열면 그 서브넷의 **비-DB 자원**까지 열릴 여지가 있다.

6. **운영·감사**  
   “누가 DB에 붙을 수 있나?” → **SG 멤버십**으로 바로 답할 수 있다.  
   CIDR은 “그 대역에 지금 뭐가 사는지”를 매번 떠올려야 한다.

**정리:** CIDR은 실습 가독성·편의. 체이닝은 **더 좁게, 역할 단위로, ASG·혼재 배치에 안전하게**.  
둘을 동시에 열어 두지 말고, 이 프로젝트에서는 **체이닝 하나**로 통일한다.

### 6.5 MySQL Router를 어디에 두느냐에 따른 SG

| 배치 | SG | App이 붙는 주소 |
|------|-----|----------------|
| **App EC2에 Router 설치** (권장 단순) | `sg-router` 불필요. Out: App→DB 13306 | `127.0.0.1:6446` |
| **Router 전용 EC2/ASG** | **`sg-router` 추가** In 6446/6447=`sg-app`, Out 13306=`sg-db` | Router 사설 IP:6446 |
| Router를 DB 노드에 같이 | DB 노드에 6446 In=`sg-app` — 역할 혼재, 비권장 |

Nest `DB_HOST`는 실무적으로 **Router**를 가리키는 편이 Day31 설계와 맞다.

---

## 7. Redis — 이 백엔드에선 사실상 필수에 가깝다

쿠팡이츠 Nest는 Redis를 사용한다 (`REDIS_PORT=6379`).  
Redis를 **프라이빗 EC2(또는 캐시 인스턴스)** 로 올리면:

### `sg-redis`

| Direction | Port | Source/Dest |
|-----------|------|-------------|
| In | 6379 | **`sg-app`만** |
| In | 22 | `sg-bastion` (관리 시) |
| Out | (최소) | 업데이트·필요 시만 |

App Outbound에 `6379 → sg-redis`를 명시하거나, 1차는 Outbound all + Inbound만 조여도 된다.  
**Redis에 `0.0.0.0/0` 또는 퍼블릭 서브넷 CIDR을 열지 않는다.**

(나중 ElastiCache면 “캐시 SG”에 App SG만 허용하는 동일 패턴.)

---

## 8. Bastion · SSH

- Internet → Bastion 22: **관리자 IP/32**
- Bastion → App/DB/Redis/Router 22: Source **`sg-bastion`**
- App/DB에 인터넷 22 직접 개방 금지

---

## 9. 아웃바운드 (1차 실습)

Stateful이라 인바운드 응답은 자동.  
**먼저 나가는 연결**만 Outbound 필요.

| SG | 1차 Outbound |
|----|----------------|
| `sg-alb` | → `sg-app` :80 (또는 allow all) |
| `sg-app` | 443(NAT), S3 Endpoint, **13306→sg-db**, **6379→sg-redis**, DNS |
| `sg-db` | GR/클러스터용(응답·노드 간), S3 백업(Endpoint), **인터넷 광역은 최소화** |
| `sg-redis` | 최소 |
| `sg-bastion` | 22→내부 SG들, 443 |

학습 포인트는 **인바운드 체이닝**. Egress 조이기는 안정화 후.

---

## 10. 최종 설계표 (구현 체크리스트)

### `sg-alb`
| Dir | Port | Source/Dest |
|-----|------|-------------|
| In | 80, 443 | `0.0.0.0/0` |
| Out | 80 | `sg-app` |

### `sg-app`
| Dir | Port | Source/Dest |
|-----|------|-------------|
| In | 80 | `sg-alb` |
| In | 22 | `sg-bastion` |
| Out | 13306 | `sg-db` (또는 Router 경유 시 Router/로컬) |
| Out | 6446/6447 | `sg-router` (Router 분리 시) |
| Out | 6379 | `sg-redis` |
| Out | 443 | `0.0.0.0/0` (1차) |

### `sg-db` ★클러스터 보강
| Dir | Port | Source/Dest |
|-----|------|-------------|
| In | **13306** | `sg-app` 및/또는 `sg-router` |
| In | **13306** | **`sg-db`** (self) |
| In | **13361** (예시 GR) | **`sg-db`** (self) **필수** |
| In | 22 | `sg-bastion` |
| In | (선택) X 33060 | bastion / self |

### `sg-redis`
| Dir | Port | Source/Dest |
|-----|------|-------------|
| In | 6379 | `sg-app` |
| In | 22 | `sg-bastion` |

### `sg-router` (전용 호스트일 때만)
| Dir | Port | Source/Dest |
|-----|------|-------------|
| In | 6446, 6447 | `sg-app` |
| In | 22 | `sg-bastion` |
| Out | 13306 | `sg-db` |

### `sg-bastion`
| Dir | Port | Source/Dest |
|-----|------|-------------|
| In | 22 | `x.x.x.x/32` |
| Out | 22 | app/db/redis/router SG |

---

## 11. Q&A (놓치기 쉬운 것)

- **SG 네 개면 되나?** → 트래픽 입구 체인은 네 개가 뼈대. **클러스터·Redis·(분리) Router까지 보면 더 필요.**
- **DB에 App→3306만?** → **부족.** **GR 포트 + `sg-db` self** 없으면 클러스터 실패.
- **DB 소스 = 서브넷 CIDR?** → 동작은 함. 강사님 실습 방식으로도 가능. **이 프로젝트 정석은 SG 체이닝** (이점 → §6.4).
- **커스텀 13306?** → 좋음. 단 **GR 포트 수동 지정** 필수(자동 ×10+1 오버플로).
- **3000?** → Nginx 동일 호스트면 SG 불필요.
- **S3 Endpoint용 SG?** → Gateway 타입은 **불필요**.
- **Redis는 EC2로 못 만드나?** → **만들 수 있다.** ElastiCache는 매니지드 대안일 뿐.

---

## 12. 요약

```text
Internet ──443/80──▶ sg-alb ──80──▶ sg-app ──┬──13306──▶ sg-db ◀──13361──▶ (self, GR)
                                            └──6379───▶ sg-redis
관리자 ──22──▶ sg-bastion ──22──▶ app / db / redis / (router)
```

- CIDR = “그 동네면 통과”, 체이닝 = “출입증 가진 애만 통과” → **허용이 더 좁고 ASG·역할 분리에 유리** (§6.4).
- 처음 네 개만 적었을 때 빈칸은 **MySQL 클러스터 GR**, **Redis**, **Router 배치**였다.

이 최종표를 Terraform으로 옮긴 해설(단지·출입증·도어락 비유 포함)은 [보안 그룹 Terraform 코드 해설](./blog-terraform-security-groups.md)에 있다.  
포트는 `environments/dev/ports.tf`, 규칙은 `modules/security/rules_*.tf`다. 인스턴스 attach는 다음 편(Bastion·ALB·ASG)에서 한다.
