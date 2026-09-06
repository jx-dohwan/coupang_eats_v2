# =============================================================================
# modules/dns — 출력
# =============================================================================

output "acm_certificate_arn" {
  description = "발급 완료된 ACM 인증서 ARN (ALB 443 리스너에 사용)"
  value       = aws_acm_certificate_validation.main.certificate_arn
}

output "zone_id" {
  description = "Route 53 퍼블릭 호스팅 영역 ID (Alias 레코드 생성 시 사용)"
  value       = data.aws_route53_zone.main.zone_id
}

output "zone_name" {
  description = "호스팅 영역 도메인 이름"
  value       = data.aws_route53_zone.main.name
}
