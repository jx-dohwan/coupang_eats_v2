# =============================================================================
# settings.tf  ← 단지 이름, 리전, 태그 (주소가 아님)
# CIDR 숫자는 cidrs.tf
# =============================================================================

locals {
  aws_region  = "ap-northeast-2"
  name_prefix = "coupang-eats-dev"
  domain_name = "hdg1234.cloud"

  ssh_key_name      = "coupang-eats-dev-key"
  ssh_public_key    = pathexpand("~/.ssh/coupang-eats-dev-key.pub")
  app_instance_type = "t3.small"
  asg_min           = 1
  asg_max           = 3
  asg_desired       = 2

  # DB — 도메인 HTTPS 테스트에서는 apply 제외
  db_instance_type      = "t3.small"
  db_data_volume_size   = 20
  backup_retention_days = 7

  tags = {
    Environment = "dev"
  }
}
