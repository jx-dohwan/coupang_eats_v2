#!/bin/bash
set -euo pipefail

# Ubuntu 24.04(noble)에는 apt 패키지 awscli 가 없다.
# ECR 로그인용 AWS CLI v2 는 공식 바이너리로 설치한다.

# 1. Docker + 설치 도구
apt-get update -y
apt-get install -y docker.io docker-compose-v2 curl unzip
systemctl enable docker
systemctl start docker

# 2. AWS CLI v2 (공식 설치 — apt awscli 금지)
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
unzip -qo /tmp/awscliv2.zip -d /tmp
/tmp/aws/install -i /usr/local/aws-cli -b /usr/local/bin
rm -rf /tmp/aws /tmp/awscliv2.zip

# 3. ECR 로그인
aws ecr get-login-password --region ${region} | \
  docker login --username AWS --password-stdin ${ecr_registry}

# 4. docker-compose.yml 생성
mkdir -p /opt/app
%{ if enable_awslogs ~}
cat > /opt/app/docker-compose.yml <<'COMPOSE'
services:
  nginx:
    image: ${nginx_image}
    ports:
      - "80:80"
    depends_on:
      - nest
    restart: unless-stopped
    logging:
      driver: awslogs
      options:
        awslogs-group: ${log_group_nginx}
        awslogs-region: ${region}
        awslogs-stream-prefix: nginx
        awslogs-create-group: "false"

  nest:
    image: ${nest_image}
    environment:
      - PORT=3000
      - NODE_ENV=production
    expose:
      - "3000"
    restart: unless-stopped
    logging:
      driver: awslogs
      options:
        awslogs-group: ${log_group_nest}
        awslogs-region: ${region}
        awslogs-stream-prefix: nest
        awslogs-create-group: "false"
COMPOSE
%{ else ~}
cat > /opt/app/docker-compose.yml <<'COMPOSE'
services:
  nginx:
    image: ${nginx_image}
    ports:
      - "80:80"
    depends_on:
      - nest
    restart: unless-stopped

  nest:
    image: ${nest_image}
    environment:
      - PORT=3000
      - NODE_ENV=production
    expose:
      - "3000"
    restart: unless-stopped
COMPOSE
%{ endif ~}

# 5. 실행
cd /opt/app
docker compose up -d
