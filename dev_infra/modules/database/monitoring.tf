# =============================================================================
# CloudWatch — DB EC2 기본 메트릭 알람
# (DB 서브넷은 NAT 없음 → Docker awslogs/에이전트 로그 전송은 입주 단계에서
#  Interface VPC Endpoint 추가 후 가능. 1차는 EC2 기본 메트릭만.)
# =============================================================================

resource "aws_cloudwatch_metric_alarm" "db_cpu" {
  for_each = var.enable_monitoring ? aws_instance.db : {}

  alarm_name          = "${var.name_prefix}-db-${each.key}-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 60
  statistic           = "Average"
  threshold           = 80
  treat_missing_data  = "notBreaching"
  alarm_description   = "DB node ${each.key} CPU > 80%"

  dimensions = {
    InstanceId = each.value.id
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "db_status_check" {
  for_each = var.enable_monitoring ? aws_instance.db : {}

  alarm_name          = "${var.name_prefix}-db-${each.key}-status-check"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "StatusCheckFailed"
  namespace           = "AWS/EC2"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_description   = "DB node ${each.key} EC2 status check failed"

  dimensions = {
    InstanceId = each.value.id
  }

  tags = var.tags
}
