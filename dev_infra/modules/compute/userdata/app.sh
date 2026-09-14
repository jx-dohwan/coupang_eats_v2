#!/bin/bash
set -euo pipefail

# Ubuntu 24.04(noble) — apt awscli 없음 → AWS CLI v2 공식 바이너리

# 0. NAT/outbound 준비 대기 (최대 ~10분). 실패 시 명확히 종료.
OUTBOUND_OK=0
for i in $(seq 1 120); do
  if curl -fsI --connect-timeout 3 http://archive.ubuntu.com/ubuntu/ >/dev/null 2>&1; then
    OUTBOUND_OK=1
    echo "outbound ready after $((i * 5))s"
    break
  fi
  echo "waiting for NAT/outbound ($i/120)..."
  sleep 5
done
if [ "$OUTBOUND_OK" != "1" ]; then
  echo "FATAL: no outbound after waiting for NAT — abort userdata" >&2
  exit 1
fi

# 1. Docker + 설치 도구
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y docker.io docker-compose-v2 curl unzip
systemctl enable docker
systemctl start docker

# 2. AWS CLI v2
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
unzip -qo /tmp/awscliv2.zip -d /tmp
/tmp/aws/install -i /usr/local/aws-cli -b /usr/local/bin
rm -rf /tmp/aws /tmp/awscliv2.zip

# 3. ECR 로그인
aws ecr get-login-password --region ${region} | \
  docker login --username AWS --password-stdin ${ecr_registry}

# 4. docker-compose.yml
#    App 호스트 MySQL+Redis 사이드카 (InnoDB 입주와 별개) + 실 S3 업로드 버킷
mkdir -p /opt/app
cat > /opt/app/docker-compose.yml <<'COMPOSE'
services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpass
      MYSQL_DATABASE: coupangeats
      MYSQL_USER: eats
      MYSQL_PASSWORD: eatspass
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "127.0.0.1", "-uroot", "-prootpass"]
      interval: 5s
      timeout: 5s
      retries: 30
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

  nest:
    image: ${nest_image}
    environment:
      - PORT=3000
      - NODE_ENV=production
      - DB_HOST=mysql
      - DB_PORT=3306
      - DB_USER_NAME=eats
      - DB_PASSWORD=eatspass
      - DB_DATABASE=coupangeats
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - JWT_ACCESS_SECRET=aws-smoke-access-secret-change
      - JWT_REFRESH_SECRET=aws-smoke-refresh-secret-change
      - JWT_ACCESS_EXPIRATION=900s
      - JWT_REFRESH_EXPIRATION=7d
      - AWS_REGION=${region}
      - AWS_S3_BUCKET_NAME=${s3_uploads_bucket}
      - AUTO_VERIFY_USERS=true
      - SKIP_EMAIL_NOTIFICATION=true
      - BASE_URL=https://${domain_name}
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_started
    expose:
      - "3000"
    restart: unless-stopped

  nginx:
    image: ${nginx_image}
    ports:
      - "80:80"
    depends_on:
      - nest
    restart: unless-stopped

volumes:
  mysql_data:
COMPOSE

# 5. 실행
cd /opt/app
docker compose up -d
