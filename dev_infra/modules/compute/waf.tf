# =============================================================================
# AWS WAFv2 — ALB 앞단 기본 보호 (Regional)
# Security Group은 L3/L4, WAF는 L7(HTTP) 시그니처·레이트리밋
# =============================================================================

resource "aws_wafv2_web_acl" "alb" {
  count = var.enable_waf ? 1 : 0

  name        = "${var.name_prefix}-alb-waf"
  description = "Basic ALB WAF: rate limit + AWS managed common/bad-inputs"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # 1) IP당 과도한 요청 차단 (로그인/스크래핑/단순 플러드)
  rule {
    name     = "RateLimitPerIP"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = var.waf_rate_limit
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-waf-rate"
      sampled_requests_enabled   = true
    }
  }

  # 2) OWASP 계열 공통 웹 공격 (SQLi/XSS 등 시그니처)
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 10

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-waf-common"
      sampled_requests_enabled   = true
    }
  }

  # 3) 알려진 악성 입력 패턴
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 20

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-waf-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  # 4) Amazon IP 평판 (봇·스캐너로 알려진 IP)
  rule {
    name     = "AWSManagedRulesAmazonIpReputationList"
    priority = 30

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesAmazonIpReputationList"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-waf-ip-reputation"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.name_prefix}-alb-waf"
    sampled_requests_enabled   = true
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-alb-waf"
  })
}

resource "aws_wafv2_web_acl_association" "alb" {
  count = var.enable_waf ? 1 : 0

  resource_arn = aws_lb.main.arn
  web_acl_arn  = aws_wafv2_web_acl.alb[0].arn
}
