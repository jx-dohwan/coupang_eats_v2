# modules/security 출력 — 다음 레이어(ALB, ASG, EC2)가 attach 할 ID

output "alb_security_group_id" {
  description = "sg-alb"
  value       = aws_security_group.alb.id
}

output "app_security_group_id" {
  description = "sg-app"
  value       = aws_security_group.app.id
}

output "db_security_group_id" {
  description = "sg-db"
  value       = aws_security_group.db.id
}

output "redis_security_group_id" {
  description = "sg-redis"
  value       = aws_security_group.redis.id
}

output "router_security_group_id" {
  description = "sg-router (전용 Router EC2일 때만 attach)"
  value       = aws_security_group.router.id
}

output "bastion_security_group_id" {
  description = "sg-bastion"
  value       = aws_security_group.bastion.id
}

output "security_group_ids" {
  description = "역할 키로 묶은 SG ID"
  value = {
    alb     = aws_security_group.alb.id
    app     = aws_security_group.app.id
    db      = aws_security_group.db.id
    redis   = aws_security_group.redis.id
    router  = aws_security_group.router.id
    bastion = aws_security_group.bastion.id
  }
}
