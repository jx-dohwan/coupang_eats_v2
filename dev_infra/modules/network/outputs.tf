# modules/network 출력 — environments/dev/outputs.tf 에서 다시 export

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.this.id
}

output "vpc_cidr" {
  description = "VPC CIDR"
  value       = aws_vpc.this.cidr_block
}

output "igw_id" {
  description = "Internet Gateway ID"
  value       = aws_internet_gateway.this.id
}

output "nat_gateway_id" {
  description = "단일 NAT Gateway ID"
  value       = aws_nat_gateway.this.id
}

output "nat_eip_public_ip" {
  description = "NAT Elastic IP"
  value       = aws_eip.nat.public_ip
}

output "public_subnet_ids" {
  description = "퍼블릭 서브넷 ID (a/b/c)"
  value       = { for k, s in aws_subnet.public : k => s.id }
}

output "private_app_subnet_ids" {
  description = "프라이빗 앱 서브넷 ID (a/b/c)"
  value       = { for k, s in aws_subnet.private_app : k => s.id }
}

output "private_db_subnet_ids" {
  description = "DB 서브넷 ID (a/b/c)"
  value       = { for k, s in aws_subnet.private_db : k => s.id }
}

output "public_route_table_id" {
  description = "퍼블릭 공유 RT"
  value       = aws_route_table.public.id
}

output "private_app_route_table_ids" {
  description = "프라이빗 앱 서브넷별 RT (a/b/c)"
  value       = { for k, rt in aws_route_table.private_app : k => rt.id }
}

output "private_db_route_table_id" {
  description = "DB 공유 RT"
  value       = aws_route_table.private_db.id
}

output "s3_vpc_endpoint_id" {
  description = "S3 Gateway Endpoint ID"
  value       = aws_vpc_endpoint.s3.id
}
