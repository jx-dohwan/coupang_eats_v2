# =============================================================================
# modules/compute — 출력
# =============================================================================

output "alb_dns_name" {
  description = "ALB DNS Name"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "ALB Hosted Zone ID"
  value       = aws_lb.main.zone_id
}

output "bastion_public_ip" {
  description = "Bastion 공인 IP"
  value       = aws_instance.bastion.public_ip
}

output "asg_name" {
  description = "ASG 이름"
  value       = aws_autoscaling_group.app.name
}

output "ecr_nginx_url" {
  description = "Nginx ECR 리포지토리 URL"
  value       = aws_ecr_repository.nginx.repository_url
}

output "ecr_nest_url" {
  description = "Nest ECR 리포지토리 URL"
  value       = aws_ecr_repository.nest.repository_url
}

output "target_group_arn" {
  description = "앱 Target Group ARN"
  value       = aws_lb_target_group.app.arn
}

output "cloudwatch_dashboard_name" {
  description = "CloudWatch 대시보드 이름 (콘솔 확인용)"
  value       = var.enable_monitoring ? aws_cloudwatch_dashboard.main[0].dashboard_name : null
}

output "cloudwatch_log_groups" {
  description = "앱 컨테이너 로그 그룹"
  value = var.enable_monitoring ? {
    nginx = aws_cloudwatch_log_group.app_nginx[0].name
    nest  = aws_cloudwatch_log_group.app_nest[0].name
  } : {}
}

output "cloudwatch_alarm_names" {
  description = "컴퓨트 알람 이름 목록"
  value = var.enable_monitoring ? [
    aws_cloudwatch_metric_alarm.alb_5xx[0].alarm_name,
    aws_cloudwatch_metric_alarm.alb_unhealthy_hosts[0].alarm_name,
    aws_cloudwatch_metric_alarm.asg_cpu[0].alarm_name,
    aws_cloudwatch_metric_alarm.asg_status_check[0].alarm_name,
    aws_cloudwatch_metric_alarm.asg_in_service[0].alarm_name,
  ] : []
}
