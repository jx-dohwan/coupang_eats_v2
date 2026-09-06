# 밑바닥부터 다시 쌓는 3-Tier 인프라 — DB단 Terraform 구현편

[설계편](./blog-database-innodb-cluster-design.md)에서 고정한 것:

- RDS가 아니라 **EC2 × 3 + InnoDB Cluster**
- Primary(읽기/쓰기) 1 + Secondary(읽기) 2
- **EBS로 장부 영속**, **cron → S3 → 보존 기간 후 삭제**
- DB 서브넷은 **NAT 없음** (이중 자물쇠)

이 글은 그 설계를 **Terraform 코드로 시공한 기록**이다.  
비유를 섞어 “왜 이 리소스인가”를 풀고, **apply 이후에 Bastion에서 할 일**(MySQL 설치·클러스터 bootstrap)까지 이어 준다.

> **운영 원칙:** 코드 작성과 `terraform plan`까지가 기본이다.  
> **`apply` / `destroy`는 비용이 붙으므로 반드시 본인 승인 후에만** 실행한다.  
> 이 문서를 작성·검증하는 과정에서도 **apply는 하지 않았다.**

---

## 0. Terraform이 하는 일 / 사람이 하는 일

설계편에서 인정한 경계다.

| Terraform (`modules/database`) | Bastion 경유 수동(또는 스크립트) |
|--------------------------------|----------------------------------|
| EC2 3대 (AZ-a/b/c, private_db) | MySQL 서버 패키지 설치 |
| 데이터 EBS (`delete_on_termination=false`) | datadir 이전·권한 |
| `sg-db` attach | `my.cnf` 확정·GTID·GR 튜닝 |
| IAM Instance Profile (S3 백업) | `mysqlsh`로 InnoDB Cluster 생성 |
| S3 백업 버킷 + Lifecycle(N일 만료) | Router를 앱 EC2에 설치·seed 지정 |
| User Data: `/data` 마운트, 백업 스크립트·cron 골격 | Nest `127.0.0.1:6446` 연결 |

비유:

> Terraform은 **금고동에 빈 금고 칸 3개와 철제 캐비닛(EBS), 서류 창고(S3) 계약**까지 해 둔다.  
> **장부를 넣고 세 칸이 무전기로 합의하게 만드는 의식**은 경비실(Bastion)에서 진행한다.

**왜 User Data로 `apt install mysql`을 안 하나?**  
DB 라우팅 테이블에 **NAT가 없다.**  
패키지를 받으러 인터넷에 나갈 길이 없다. 설계상 의도다.

---

## 1. 한 장 흐름

```text
module.network.private_db_subnet_ids (a/b/c)
module.security.db_security_group_id
aws_key_pair.main
        │
        ▼
┌─ modules/database ─────────────────────────────────────┐
│  ① S3 backup bucket + Lifecycle (보존 N일)             │
│  ② IAM role/profile (s3:PutObject …)                   │
│  ③ aws_instance.db["a"|"b"|"c"]                        │
│       - Ubuntu 24.04                                   │
│       - private IP only                                │
│       - EBS /dev/sdf (장부, terminate 시에도 잔존)     │
│       - user_data → /data 마운트 + backup cron 골격    │
│  ④ output: private_ips, volume_ids, bucket             │
└────────────────────────────────────────────────────────┘
        │
        ▼ (apply 후, 승인된 환경에서)
Bastion → MySQL 설치 → Cluster bootstrap → Router → Nest
```

---

## 2. 디렉터리 구조

```text
dev_infra/
├── environments/dev/
│   ├── settings.tf      # db_instance_type, db_data_volume_size, backup_retention_days
│   ├── main.tf          # module "database" 추가
│   └── outputs.tf       # db_private_ips, db_backup_bucket, …
│
└── modules/database/
    ├── variables.tf
    ├── locals.tf        # 노드 맵 a/b/c, server_id
    ├── data.tf          # Ubuntu AMI, account id
    ├── s3.tf            # 백업 버킷 + 암호화 + Lifecycle
    ├── iam.tf           # Instance Profile
    ├── instances.tf     # EC2 × 3 + 데이터 EBS
    ├── outputs.tf
    └── userdata/
        └── db.sh        # 마운트·설정 초안·백업 cron
```

---

## 3. environments/dev 조립

### 3.1 `settings.tf`

```hcl
db_instance_type      = "t3.small"
db_data_volume_size   = 20
backup_retention_days = 7
```

| 변수 | 비유 |
|------|------|
| `db_instance_type` | 금고 칸 크기 (CPU/RAM) |
| `db_data_volume_size` | 철제 캐비닛 용량 (GiB) |
| `backup_retention_days` | 서류 창고에 **며칠치** 복사본을 남길지 |

### 3.2 `module "database"`

```hcl
module "database" {
  source = "../../modules/database"

  name_prefix = local.name_prefix
  aws_region  = local.aws_region

  private_db_subnet_ids = module.network.private_db_subnet_ids
  db_security_group_id  = module.security.db_security_group_id
  ssh_key_name          = aws_key_pair.main.key_name

  db_instance_type      = local.db_instance_type
  db_data_volume_size   = local.db_data_volume_size
  mysql_port            = local.mysql_port      # 13306
  mysql_gr_port         = local.mysql_gr_port   # 13361
  backup_retention_days = local.backup_retention_days

  tags = local.tags
}
```

포트 숫자는 `ports.tf`가 SSOT다. database 모듈이 새 문 번호를 발명하지 않는다.

---

## 4. S3 백업 창고 — `s3.tf`

```hcl
resource "aws_s3_bucket" "db_backup" {
  bucket = "${var.name_prefix}-mysql-backup-${account_id}"
}
# versioning + AES256 + public access block
# Lifecycle: prefix mysql-backup/ → N일 후 expiration
```

| 설정 | 역할 | 비유 |
|------|------|------|
| 계정 ID를 이름에 포함 | 전역 유일 버킷명 | 창고 고유 번호 |
| 퍼블릭 차단 | 백업 유출 방지 | 창고 자물쇠 |
| Lifecycle N일 | 초안의 “일정 기간 후 삭제” | 오래된 서류 폐기 |
| DB→S3 | **S3 Gateway Endpoint** (NAT 없음) | 단지 안 운반로 |

IAM은 이 버킷 ARN에만 `PutObject`/`GetObject`/`ListBucket`/`DeleteObject`를 준다.

---

## 5. IAM — `iam.tf`

앱 Instance Profile이 ECR을 당기듯,  
DB Instance Profile은 **백업 창고 열쇠**만 받는다.

```text
ec2.amazonaws.com → AssumeRole
                 → s3:*Object / ListBucket (backup bucket만)
```

비유: 금고 직원에게 **시내 외출증(NAT)** 은 안 주고,  
**서류 창고 열쇠(S3)** 만 준다.

---

## 6. EC2 × 3 — `instances.tf` ★

### 6.1 ASG가 아니라 for_each

```hcl
locals {
  db_nodes = {
    for az_key, subnet_id in var.private_db_subnet_ids : az_key => {
      subnet_id = subnet_id
      name      = "${var.name_prefix}-db-${az_key}"
      server_id = index(sort(keys(...)), az_key) + 1  # a=1,b=2,c=3
    }
  }
}

resource "aws_instance" "db" {
  for_each = local.db_nodes
  # ...
  associate_public_ip_address = false
  vpc_security_group_ids      = [var.db_security_group_id]
  subnet_id                   = each.value.subnet_id
}
```

| 앱 ASG | DB for_each |
|---------|-------------|
| 갈아끼우기 쉬움 | **멤버십·쿼럼**이 깨지기 쉬움 |
| desired 숫자 | **항상 3** (설계 고정) |

### 6.2 데이터 EBS — 장부 캐비닛

```hcl
ebs_block_device {
  device_name           = "/dev/sdf"
  volume_size           = var.db_data_volume_size
  volume_type           = "gp3"
  encrypted             = true
  delete_on_termination = false   # ★ 인스턴스 종료 ≠ 장부 삭제
}
```

| 플래그 | 의미 |
|--------|------|
| `delete_on_termination = false` | EC2를 지워도 볼륨(장부)은 남김 |
| 루트 `= true` | OS 디스크는 인스턴스와 같이 정리 |

Nitro에서는 `/dev/sdf`가 `/dev/nvme1n1`로 보인다. User Data가 둘 다 기다린다.

### 6.3 공인 IP 금지

`associate_public_ip_address = false`  
인터넷에서 금고 주소를 알 수 없다. 입구는 Bastion뿐이다.

---

## 7. User Data — `userdata/db.sh`

하는 일:

1. 데이터 디바이스 대기 → (필요 시) XFS 포맷 → `/data` 마운트 → fstab  
2. `/data/mysql` 디렉터리 생성 (datadir 후보)  
3. `/opt/coupang-eats/db/node.env` — node_key, server_id, 포트, 버킷  
4. `99-coupang-eats.cnf` 초안 — port 13306, GR 13361, GTID 등  
5. `backup-to-s3.sh` + **cron 매일 03:15 UTC**  
6. `README.txt` — Bastion에서 할 일 요약  

하지 않는 일:

- `apt-get install mysql-server` (NAT 없음 → 실패가 정상)  
- InnoDB Cluster create (일회성 의식)

백업 스크립트는 `mysqldump`가 아직 없으면 **exit 0으로 건너뛴다.**  
MySQL 설치 전에는 cron이 매일 돌아도 장부를 깨지 않는다.

---

## 8. outputs — apply 후 손에 쥐는 값

| output | 용도 |
|--------|------|
| `db_private_ips` | GR seed, Router 설정, mysqlsh |
| `db_instance_ids` | 콘솔·SSM 추적용 |
| `db_data_volume_ids` | 장부 볼륨 ID (사고 시 추적) |
| `db_backup_bucket` | cron·aws s3 cp 목적지 |

```bash
terraform output db_private_ips
terraform output db_backup_bucket
```

---

## 9. apply 이후 절차 (설계의 “의식”)

아래는 **Terraform 밖**이다. 비밀번호·그룹 UUID는 비밀로 관리한다.

### 9.1 Bastion → DB 노드 SSH

```text
ssh -i ~/.ssh/coupang-eats-dev-key ubuntu@<bastion>
ssh ubuntu@<db-a private ip>
```

### 9.2 MySQL 설치 (패키지 경로)

DB에 NAT가 없으므로 예시는 다음 중 하나다.

- Bastion에서 deb 다운로드 후 `scp` → DB에서 `dpkg`  
- 사설 apt 미러 / 내부 리포지토리  
- MySQL이 미리 깔린 **커스텀 AMI** (반복 구축 시 권장)

설치 후:

- `/opt/coupang-eats/db/99-coupang-eats.cnf`를 적용  
- `REPORT_HOST_REPLACE` → 해당 노드 private IP  
- `SEED_HOSTS_REPLACE` → `ip-a:13361,ip-b:13361,ip-c:13361`  
- datadir을 `/data/mysql`로  

### 9.3 InnoDB Cluster bootstrap (개념)

```text
mysqlsh 로 노드 a에서 클러스터 생성
노드 b, c addInstance
cluster.status() → ONLINE
```

교육 [Day31](https://backbone-archive.tistory.com/category/%EA%B5%90%EC%9C%A1) 절차를  
우리 포트(13306/13361)·IP·SG에 맞춰 수행한다.

### 9.4 앱 EC2에 MySQL Router

```text
Router → bootstrap against cluster
Nest DATABASE_HOST=127.0.0.1 PORT=6446
```

### 9.5 백업 검증

```bash
# DB 노드에서 MySQL·awscli 준비 후
sudo /opt/coupang-eats/db/backup-to-s3.sh
aws s3 ls s3://$(terraform output -raw db_backup_bucket)/mysql-backup/
```

S3 Lifecycle가 **N일 후 삭제**하는지는 콘솔 Lifecycle 규칙으로 확인한다.

---

## 10. 비용·destroy 시 주의

| 리소스 | 주의 |
|--------|------|
| EC2 × 3 | 시간당. 미사용 시 stop/destroy |
| EBS × 3 (`delete_on_termination=false`) | **인스턴스만 지워도 볼륨 요금 잔존** 가능 |
| S3 백업 | 용량·요청 소액 + Lifecycle로 상한 |
| NAT | DB는 안 쓰지만, 앱/compute를 같이 켜면 NAT는 계속 과금 |

`terraform destroy` 후에도 **고아 EBS·스냅샷**이 남았는지 콘솔에서 한 번 더 본다.  
장부를 남기려다 **청구서만 남는** 패턴이다.

---

## 11. 트러블슈팅

| 증상 | 원인 | 대응 |
|------|------|------|
| userdata에 apt 실패 | NAT 없음 | 정상. Bastion/AMI 경로 사용 |
| `/data` 미마운트 | 볼륨 지연 | 로그 `/var/log/coupang-eats-db-userdata.log` |
| GR 타임아웃 | SG 13361 in/out self | `rules_db.tf` 확인 |
| S3 upload AccessDenied | IAM/버킷 ARN | Instance Profile·버킷 정책 |
| S3 upload 경로 없음 | Endpoint/RT | DB RT에 S3 Gateway Endpoint |
| 클러스터는 산데 Nest 실패 | Router/6446 | 앱 로컬 Router·시크릿 |

---

## 12. 성공 기준

**Terraform 범위**

- [ ] `module.database`가 plan에서 EC2×3, EBS, IAM, S3+Lifecycle을 만듦  
- [ ] 공인 IP 없음, subnet=private_db, sg=db  
- [ ] output에 `db_private_ips`, `db_backup_bucket`  

**apply 이후 (승인된 환경)**

- [ ] 각 노드 `/data` 마운트  
- [ ] InnoDB Cluster ONLINE  
- [ ] Router 6446 → Nest 연결  
- [ ] 수동/cron 백업 객체가 S3에 존재  
- [ ] Lifecycle 보존 일수 = settings 값  

---

## 13. 한 줄 요약

`modules/database`는 **빈 금고 3칸(EC2) + 철제 캐비닛(EBS) + 서류 창고(S3 Lifecycle) + 창고 열쇠(IAM)** 를 Terraform으로 짓고,  
User Data는 **마운트와 백업 골격**만 맡는다.  
MySQL 설치와 InnoDB Cluster bootstrap은 NAT 없는 설계 때문에 **Bastion 의식**으로 남긴다.  
그것이 설계편의 “데이터는 자산 / 원리를 확인한다”를 코드로 옮긴 모습이다.

---

## 관련 글

- [DB 기획·설계편 (최종)](./blog-database-innodb-cluster-design.md)
- [보안 그룹 Terraform](./blog-terraform-security-groups.md)
- [WEB·WAS 컴퓨트 Terraform 구현편](./blog-compute-terraform-implementation.md)
- [교육 카테고리 Day31](https://backbone-archive.tistory.com/category/%EA%B5%90%EC%9C%A1)
