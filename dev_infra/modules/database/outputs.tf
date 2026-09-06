# =============================================================================
# modules/database — 출력
# =============================================================================

output "db_instance_ids" {
  description = "DB EC2 인스턴스 ID 맵 (a/b/c)"
  value       = { for k, i in aws_instance.db : k => i.id }
}

output "db_private_ips" {
  description = "DB 프라이빗 IP 맵 — 클러스터 seed / Router 설정에 사용"
  value       = { for k, i in aws_instance.db : k => i.private_ip }
}

output "db_data_volume_ids" {
  description = "데이터 EBS 볼륨 ID 맵 (delete_on_termination=false)"
  value = {
    for k, i in aws_instance.db : k => one([
      for b in i.ebs_block_device : b.volume_id if b.device_name == "/dev/sdf"
    ])
  }
}

output "backup_bucket_name" {
  description = "MySQL 백업 S3 버킷 이름"
  value       = aws_s3_bucket.db_backup.bucket
}

output "backup_bucket_arn" {
  description = "MySQL 백업 S3 버킷 ARN"
  value       = aws_s3_bucket.db_backup.arn
}

output "db_security_group_id" {
  description = "부착된 sg-db ID"
  value       = var.db_security_group_id
}

output "backup_retention_days" {
  description = "S3 백업 보존 일수"
  value       = var.backup_retention_days
}

output "cloudwatch_db_alarm_names" {
  description = "DB CPU/StatusCheck 알람 이름"
  value = var.enable_monitoring ? concat(
    [for a in aws_cloudwatch_metric_alarm.db_cpu : a.alarm_name],
    [for a in aws_cloudwatch_metric_alarm.db_status_check : a.alarm_name],
  ) : []
}
