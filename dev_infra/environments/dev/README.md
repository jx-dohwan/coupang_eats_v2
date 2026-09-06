# Dev 환경 — 파일 이름 = 그 파일에 있는 것
#
#   main.tf       ★ 모듈 조립 (network + security). 여기서 apply
#   cidrs.tf      ★ 서브넷 주소. 퍼블릭 0번대 / 앱 10번대 / DB 20번대
#   ports.tf      ★ SG 포트. MySQL 13306, GR 13361, Redis 6379, Bastion IP
#   settings.tf   리전, 이름 접두사, 태그
#   versions.tf   Terraform 버전 + S3 backend
#   providers.tf  AWS provider
#   outputs.tf    다음 레이어가 쓸 ID
#
# 모듈
#   ../../modules/network   VPC/서브넷/IGW/NAT/RT/S3 Endpoint
#   ../../modules/security  SG 껍데기 + 체이닝 규칙 (rules_*.tf)
#
# 사용
#   cd environments/dev
#   terraform init
#   terraform plan
#   terraform apply
