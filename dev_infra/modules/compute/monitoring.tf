# =============================================================================
# CloudWatch — 기본 모니터링 (로그 그룹 · 알람 · 대시보드)
#
# ECS 시절: Task awslogs + ECS CPU/Memory 알람
# 이번(ECS-less): ALB/ASG/EC2 메트릭 + Docker awslogs → Log Group
# =============================================================================

# ---------- Log Groups (Docker awslogs 가 여기로 전송) ----------
resource "aws_cloudwatch_log_group" "app_nginx" {
  count = var.enable_monitoring ? 1 : 0

  name              = "/${var.name_prefix}/app/nginx"
  retention_in_days = var.log_retention_days
  tags              = merge(var.tags, { Name = "${var.name_prefix}-logs-nginx" })
}

resource "aws_cloudwatch_log_group" "app_nest" {
  count = var.enable_monitoring ? 1 : 0

  name              = "/${var.name_prefix}/app/nest"
  retention_in_days = var.log_retention_days
  tags              = merge(var.tags, { Name = "${var.name_prefix}-logs-nest" })
}

# ---------- ALB Alarms (이전 ECS 프로젝트와 동일 계열) ----------
resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  count = var.enable_monitoring ? 1 : 0

  alarm_name          = "${var.name_prefix}-alb-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 10
  treat_missing_data  = "notBreaching"
  alarm_description   = "ALB target 5xx count is high"

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "alb_unhealthy_hosts" {
  count = var.enable_monitoring ? 1 : 0

  alarm_name          = "${var.name_prefix}-alb-unhealthy-hosts"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Average"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  alarm_description   = "ALB has unhealthy targets (Nginx/Nest /health 실패)"

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
    TargetGroup  = aws_lb_target_group.app.arn_suffix
  }

  tags = var.tags
}

# ---------- ASG / EC2 (ECS CPU·Memory 알람의 대체) ----------
resource "aws_cloudwatch_metric_alarm" "asg_cpu" {
  count = var.enable_monitoring ? 1 : 0

  alarm_name          = "${var.name_prefix}-asg-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 60
  statistic           = "Average"
  threshold           = 80
  treat_missing_data  = "notBreaching"
  alarm_description   = "ASG app EC2 average CPU > 80%"

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.app.name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "asg_status_check" {
  count = var.enable_monitoring ? 1 : 0

  alarm_name          = "${var.name_prefix}-asg-status-check"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "StatusCheckFailed"
  namespace           = "AWS/EC2"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_description   = "ASG member EC2 status check failed"

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.app.name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "asg_in_service" {
  count = var.enable_monitoring ? 1 : 0

  alarm_name          = "${var.name_prefix}-asg-in-service-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "GroupInServiceInstances"
  namespace           = "AWS/AutoScaling"
  period              = 60
  statistic           = "Average"
  threshold           = var.asg_min
  # 부팅 직후 메트릭 공백을 ALARM으로 치지 않음 (오탐 방지)
  treat_missing_data  = "notBreaching"
  alarm_description   = "ASG InService instances below min (${var.asg_min})"

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.app.name
  }

  tags = var.tags
}

# ---------- Dashboard ----------
resource "aws_cloudwatch_dashboard" "main" {
  count = var.enable_monitoring ? 1 : 0

  dashboard_name = "${var.name_prefix}-overview"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "ALB RequestCount / 5XX"
          region = var.aws_region
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", aws_lb.main.arn_suffix, { stat = "Sum", label = "Requests" }],
            [".", "HTTPCode_Target_5XX_Count", ".", ".", { stat = "Sum", label = "5XX" }],
            [".", "HTTPCode_Target_2XX_Count", ".", ".", { stat = "Sum", label = "2XX" }]
          ]
          view    = "timeSeries"
          stacked = false
          period  = 60
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "ALB Healthy / UnHealthy Hosts"
          region = var.aws_region
          metrics = [
            ["AWS/ApplicationELB", "HealthyHostCount", "LoadBalancer", aws_lb.main.arn_suffix, "TargetGroup", aws_lb_target_group.app.arn_suffix, { stat = "Average" }],
            [".", "UnHealthyHostCount", ".", ".", ".", ".", { stat = "Average" }]
          ]
          view   = "timeSeries"
          period = 60
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "ASG EC2 CPU / StatusCheck"
          region = var.aws_region
          metrics = [
            ["AWS/EC2", "CPUUtilization", "AutoScalingGroupName", aws_autoscaling_group.app.name, { stat = "Average" }],
            [".", "StatusCheckFailed", ".", ".", { stat = "Maximum", yAxis = "right" }]
          ]
          view   = "timeSeries"
          period = 60
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "ASG Capacity"
          region = var.aws_region
          metrics = [
            ["AWS/AutoScaling", "GroupDesiredCapacity", "AutoScalingGroupName", aws_autoscaling_group.app.name],
            [".", "GroupInServiceInstances", ".", "."],
            [".", "GroupTotalInstances", ".", "."]
          ]
          view   = "timeSeries"
          period = 60
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 12
        width  = 24
        height = 6
        properties = {
          title  = "Nest / Nginx recent logs"
          region = var.aws_region
          query  = "SOURCE '${aws_cloudwatch_log_group.app_nest[0].name}' | SOURCE '${aws_cloudwatch_log_group.app_nginx[0].name}' | fields @timestamp, @logStream, @message | sort @timestamp desc | limit 50"
          view   = "table"
        }
      }
    ]
  })
}
