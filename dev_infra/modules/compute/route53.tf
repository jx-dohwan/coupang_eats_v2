# =============================================================================
# Route 53 — apex A Alias → ALB
# =============================================================================

resource "aws_route53_record" "apex" {
  zone_id = var.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}
