# =============================================================================
# modules/dns — Route 53 조회 + ACM 발급 + DNS 검증
#
# 호스팅 영역은 콘솔에서 이미 생성됨. resource로 새로 만들지 않는다.
# destroy/apply 반복해도 NS가 바뀌지 않도록 data source만 사용한다.
# =============================================================================

# ---------- 1. 기존 호스팅 영역 조회 ----------
data "aws_route53_zone" "main" {
  name         = var.domain_name
  private_zone = false
}

# ---------- 2. ACM 공인 인증서 요청 (서울 리전) ----------
resource "aws_acm_certificate" "main" {
  domain_name               = var.domain_name
  subject_alternative_names = ["*.${var.domain_name}"]
  validation_method         = "DNS"

  tags = merge(var.tags, {
    Name = "${var.domain_name}-acm"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# ---------- 3. DNS 검증용 CNAME 레코드 생성 ----------
resource "aws_route53_record" "acm_validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.main.zone_id
}

# ---------- 4. 검증 완료 대기 (Issued 상태까지) ----------
resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.acm_validation : record.fqdn]
}
