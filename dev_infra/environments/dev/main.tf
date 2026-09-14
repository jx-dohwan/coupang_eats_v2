# =============================================================================
# main.tf  ← 이 환경에서 부르는 모듈을 한곳에 모은다
#
# apply 위치: environments/dev
# 값은 여기 없다.
#   주소(CIDR) → cidrs.tf
#   포트·Bastion IP → ports.tf
#   리전·이름·태그 → settings.tf
# =============================================================================

module "network" {
  source = "../../modules/network"

  name_prefix              = local.name_prefix
  vpc_cidr                 = local.vpc_cidr
  azs                      = local.azs
  public_subnet_cidrs      = local.public_subnet_cidrs
  private_app_subnet_cidrs = local.private_app_subnet_cidrs
  private_db_subnet_cidrs  = local.private_db_subnet_cidrs
  tags                     = local.tags
}

module "security" {
  source = "../../modules/security"

  name_prefix = local.name_prefix
  vpc_id      = module.network.vpc_id
  tags        = local.tags

  mysql_port              = local.mysql_port
  mysql_gr_port           = local.mysql_gr_port
  mysql_x_port            = local.mysql_x_port
  enable_mysql_x_protocol = local.enable_mysql_x_protocol
  mysql_router_rw_port    = local.mysql_router_rw_port
  mysql_router_ro_port    = local.mysql_router_ro_port
  redis_port              = local.redis_port
  http_port               = local.http_port
  https_port              = local.https_port
  ssh_port                = local.ssh_port
  dns_port                = local.dns_port
  ntp_port                = local.ntp_port
  bastion_ssh_cidrs       = local.bastion_ssh_cidrs
}

module "dns" {
  source = "../../modules/dns"

  domain_name = local.domain_name
  tags        = local.tags
}

resource "aws_key_pair" "main" {
  key_name   = local.ssh_key_name
  public_key = file(local.ssh_public_key)

  tags = merge(local.tags, {
    Name = local.ssh_key_name
  })
}

module "compute" {
  source = "../../modules/compute"

  name_prefix = local.name_prefix
  aws_region  = local.aws_region
  vpc_id      = module.network.vpc_id

  public_subnet_ids      = module.network.public_subnet_ids
  private_app_subnet_ids = module.network.private_app_subnet_ids

  alb_security_group_id     = module.security.alb_security_group_id
  app_security_group_id     = module.security.app_security_group_id
  bastion_security_group_id = module.security.bastion_security_group_id

  acm_certificate_arn = module.dns.acm_certificate_arn
  enable_https        = true
  zone_id             = module.dns.zone_id
  domain_name         = local.domain_name

  ssh_key_name      = aws_key_pair.main.key_name
  app_instance_type = local.app_instance_type
  asg_min           = local.asg_min
  asg_max           = local.asg_max
  asg_desired       = local.asg_desired

  tags = local.tags

  # NAT·프라이빗 라우트가 준비된 뒤에만 ASG 기동 (userdata apt/ECR pull)
  nat_gateway_id = module.network.nat_gateway_id

  # ALB 앞단 기본 WAF (관리형 룰 + IP 레이트리밋)
  enable_waf     = local.enable_waf
  waf_rate_limit = local.waf_rate_limit

  depends_on = [module.network]
}

module "database" {
  source = "../../modules/database"

  name_prefix = local.name_prefix
  aws_region  = local.aws_region

  private_db_subnet_ids = module.network.private_db_subnet_ids
  db_security_group_id  = module.security.db_security_group_id
  ssh_key_name          = aws_key_pair.main.key_name

  db_instance_type      = local.db_instance_type
  db_data_volume_size   = local.db_data_volume_size
  mysql_port            = local.mysql_port
  mysql_gr_port         = local.mysql_gr_port
  backup_retention_days = local.backup_retention_days

  tags = local.tags
}

