# =============================================================================
# Outputs — 네트워크 ID + 보안 그룹 ID (Bastion, ALB, ASG attach)
# =============================================================================

output "vpc_id" {
  description = "VPC ID"
  value       = module.network.vpc_id
}

output "igw_id" {
  description = "Internet Gateway ID"
  value       = module.network.igw_id
}

output "public_subnet_ids" {
  description = "퍼블릭 서브넷 ID 맵 (키: a/b/c)"
  value       = module.network.public_subnet_ids
}

output "private_app_subnet_ids" {
  description = "프라이빗 앱 서브넷 ID 맵 (키: a/b/c)"
  value       = module.network.private_app_subnet_ids
}

output "private_db_subnet_ids" {
  description = "DB 서브넷 ID 맵 (키: a/b/c)"
  value       = module.network.private_db_subnet_ids
}

output "nat_gateway_id" {
  description = "단일 NAT Gateway ID (실습 1차, public-a에 배치)"
  value       = module.network.nat_gateway_id
}

output "nat_eip_public_ip" {
  description = "NAT에 붙인 Elastic IP (프라이빗 outbound의 공인 출구)"
  value       = module.network.nat_eip_public_ip
}

output "s3_vpc_endpoint_id" {
  description = "S3 Gateway VPC Endpoint ID"
  value       = module.network.s3_vpc_endpoint_id
}

output "security_group_ids" {
  description = "역할별 보안 그룹 ID (ALB/ASG/EC2 attach)"
  value       = module.security.security_group_ids
}

# ---------- DNS / ACM ----------
output "acm_certificate_arn" {
  description = "ACM 인증서 ARN (ALB HTTPS 리스너용)"
  value       = module.dns.acm_certificate_arn
}

output "route53_zone_id" {
  description = "Route 53 퍼블릭 호스팅 영역 ID"
  value       = module.dns.zone_id
}

# ---------- Compute ----------
output "ssh_key_pair_name" {
  description = "AWS에 등록된 EC2 키 페어 이름"
  value       = aws_key_pair.main.key_name
}

output "alb_dns_name" {
  description = "ALB DNS Name"
  value       = module.compute.alb_dns_name
}

output "bastion_public_ip" {
  description = "Bastion 공인 IP"
  value       = module.compute.bastion_public_ip
}

output "ecr_nginx_url" {
  description = "Nginx ECR URL"
  value       = module.compute.ecr_nginx_url
}

output "ecr_nest_url" {
  description = "Nest ECR URL"
  value       = module.compute.ecr_nest_url
}

output "cloudwatch_dashboard_name" {
  description = "CloudWatch 대시보드 이름"
  value       = module.compute.cloudwatch_dashboard_name
}

output "cloudwatch_log_groups" {
  description = "앱 컨테이너 CloudWatch 로그 그룹"
  value       = module.compute.cloudwatch_log_groups
}

output "cloudwatch_alarm_names" {
  description = "컴퓨트 CloudWatch 알람"
  value       = module.compute.cloudwatch_alarm_names
}

# ---------- Database ----------
output "db_private_ips" {
  description = "DB 노드 프라이빗 IP (a/b/c) — 클러스터·Router seed"
  value       = module.database.db_private_ips
}

output "db_instance_ids" {
  description = "DB EC2 인스턴스 ID"
  value       = module.database.db_instance_ids
}

output "db_backup_bucket" {
  description = "MySQL 백업 S3 버킷"
  value       = module.database.backup_bucket_name
}

output "db_data_volume_ids" {
  description = "DB 데이터 EBS 볼륨 ID (인스턴스와 수명 분리)"
  value       = module.database.db_data_volume_ids
}

output "cloudwatch_db_alarm_names" {
  description = "DB CloudWatch 알람"
  value       = module.database.cloudwatch_db_alarm_names
}

output "route_table_ids" {
  description = <<-EOT
    라우팅 테이블 요약
    - public: 퍼블릭 3서브넷이 공유 (→ IGW)
    - private_app: 서브넷별 RT 맵 a/b/c (→ NAT, 이후 AZ별 NAT로 교체 가능)
    - private_db: DB 3서브넷이 공유 (local only + S3 endpoint)
  EOT
  value = {
    public      = module.network.public_route_table_id
    private_app = module.network.private_app_route_table_ids
    private_db  = module.network.private_db_route_table_id
  }
}
