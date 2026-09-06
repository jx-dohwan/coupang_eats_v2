#!/bin/bash
# =============================================================================
# DB 노드 User Data
# - 데이터 EBS 마운트 (/data)  ← 장부 캐비닛
# - 백업 스크립트·cron 골격   ← S3 (Gateway Endpoint)
# - MySQL 패키지 설치는 하지 않음 (DB 서브넷에 NAT 없음)
# =============================================================================
set -euo pipefail

exec > >(tee /var/log/coupang-eats-db-userdata.log | logger -t userdata -s 2>/dev/console) 2>&1

echo "==> DB node ${node_key} bootstrap start"

# ---------- 1. 데이터 볼륨 대기·포맷·마운트 ----------
# Nitro: /dev/sdf → /dev/nvme1n1 (루트가 nvme0n1)
DATA_MOUNT="/data"
MYSQL_DATA="$${DATA_MOUNT}/mysql"

for i in $(seq 1 60); do
  if [ -b /dev/nvme1n1 ]; then
    DEVICE=/dev/nvme1n1
    break
  fi
  if [ -b /dev/sdf ]; then
    DEVICE=/dev/sdf
    break
  fi
  echo "waiting for data volume... ($${i}/60)"
  sleep 5
done

if [ -z "$${DEVICE:-}" ]; then
  echo "ERROR: data volume device not found"
  exit 1
fi

if ! blkid "$${DEVICE}" >/dev/null 2>&1; then
  echo "formatting $${DEVICE} as xfs"
  mkfs.xfs -f "$${DEVICE}"
fi

mkdir -p "$${DATA_MOUNT}"
if ! grep -q "$${DATA_MOUNT}" /etc/fstab; then
  UUID=$$(blkid -s UUID -o value "$${DEVICE}")
  echo "UUID=$${UUID} $${DATA_MOUNT} xfs defaults,nofail 0 2" >> /etc/fstab
fi
mount -a || mount "$${DEVICE}" "$${DATA_MOUNT}"
mkdir -p "$${MYSQL_DATA}"
chmod 755 "$${DATA_MOUNT}"

# ---------- 2. 노드 메타 (클러스터 bootstrap 참고용) ----------
mkdir -p /opt/coupang-eats/db
cat > /opt/coupang-eats/db/node.env <<EOF
NODE_KEY=${node_key}
SERVER_ID=${server_id}
MYSQL_PORT=${mysql_port}
MYSQL_GR_PORT=${mysql_gr_port}
MYSQL_DATA_DIR=$${MYSQL_DATA}
BACKUP_BUCKET=${backup_bucket}
BACKUP_PREFIX=${backup_prefix}
AWS_REGION=${aws_region}
BACKUP_RETENTION_DAYS=${backup_retention_days}
NAME_PREFIX=${name_prefix}
EOF

# ---------- 3. my.cnf 초안 (MySQL 설치 후 /etc/mysql/mysql.conf.d/ 로 복사) ----------
cat > /opt/coupang-eats/db/99-coupang-eats.cnf <<EOF
# InnoDB Cluster 준비용 — Bastion에서 MySQL 설치 후 적용
[mysqld]
server_id=${server_id}
port=${mysql_port}
datadir=$${MYSQL_DATA}
bind_address=0.0.0.0

# Group Replication (무전기)
loose-group_replication_group_name=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
loose-group_replication_start_on_boot=off
loose-group_replication_local_address=REPORT_HOST_REPLACE:${mysql_gr_port}
loose-group_replication_group_seeds=SEED_HOSTS_REPLACE
loose-group_replication_bootstrap_group=off

# 실습용 최소 세트 — bootstrap 절차에서 보강
gtid_mode=ON
enforce_gtid_consistency=ON
binlog_checksum=NONE
log_bin=binlog
log_slave_updates=ON
binlog_format=ROW
master_info_repository=TABLE
relay_log_info_repository=TABLE
transaction_write_set_extraction=XXHASH64
EOF

# ---------- 4. S3 백업 스크립트 (awscli는 Bastion에서 설치 후 사용) ----------
cat > /opt/coupang-eats/db/backup-to-s3.sh <<'BACKUP'
#!/bin/bash
set -euo pipefail
# shellcheck disable=SC1091
source /opt/coupang-eats/db/node.env

STAMP=$$(date -u +%Y%m%dT%H%M%SZ)
FILE="/tmp/$${NAME_PREFIX}-$${NODE_KEY}-$${STAMP}.sql.gz"
DEST="s3://$${BACKUP_BUCKET}/$${BACKUP_PREFIX}/$${NODE_KEY}/$${STAMP}.sql.gz"

# MySQL이 설치된 뒤에만 의미 있음
if ! command -v mysqldump >/dev/null 2>&1; then
  echo "mysqldump not installed yet — skip"
  exit 0
fi

# 비밀번호는 Bastion에서 /root/.my.cnf 등으로 준비
mysqldump --all-databases --single-transaction --routines --triggers \
  | gzip -c > "$${FILE}"

aws s3 cp "$${FILE}" "$${DEST}" --region "$${AWS_REGION}"
rm -f "$${FILE}"
echo "uploaded $${DEST}"
BACKUP
chmod 750 /opt/coupang-eats/db/backup-to-s3.sh

# cron: 매일 03:15 UTC — MySQL·awscli 준비 전에는 no-op에 가깝게 동작
cat > /etc/cron.d/coupang-eats-db-backup <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
15 3 * * * root /opt/coupang-eats/db/backup-to-s3.sh >> /var/log/coupang-eats-db-backup.log 2>&1
EOF
chmod 644 /etc/cron.d/coupang-eats-db-backup

cat > /opt/coupang-eats/db/README.txt <<EOF
CoupangEats DB node (${node_key})
================================
1) 이 서브넷에는 NAT가 없습니다. apt는 Bastion 경유 또는 패키지 복사로 설치하세요.
2) 데이터 디렉터리 후보: $${MYSQL_DATA} (EBS 마운트됨)
3) 설정 초안: /opt/coupang-eats/db/99-coupang-eats.cnf
4) 백업: /opt/coupang-eats/db/backup-to-s3.sh → s3://${backup_bucket}/${backup_prefix}/
5) 보존: S3 Lifecycle ${backup_retention_days}일 (Terraform)
6) InnoDB Cluster bootstrap은 Bastion + mysqlsh 절차 (블로그 구현편)
EOF

echo "==> DB node ${node_key} userdata done"
