# =============================================================================
# EC2 × 3 — InnoDB Cluster 멤버 (ASG 없음, 고정 노드)
# DB 서브넷은 NAT 없음 → User Data에서 apt 설치 불가.
# MySQL·클러스터 bootstrap은 Bastion 경유 절차 (블로그 구현편 참고)
#
# 데이터 EBS: ebs_block_device + delete_on_termination=false
# → 인스턴스 부팅 시점에 장치가 보여 userdata 마운트가 안정적
# → EC2 terminate 후에도 볼륨(장부)은 남김
# =============================================================================

resource "aws_instance" "db" {
  for_each = local.db_nodes

  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.db_instance_type
  subnet_id              = each.value.subnet_id
  vpc_security_group_ids = [var.db_security_group_id]
  key_name               = var.ssh_key_name
  iam_instance_profile   = aws_iam_instance_profile.db.name

  # 금고동 — 공인 IP 금지
  associate_public_ip_address = false

  user_data = base64encode(templatefile("${path.module}/userdata/db.sh", {
    node_key              = each.key
    server_id             = each.value.server_id
    mysql_port            = var.mysql_port
    mysql_gr_port         = var.mysql_gr_port
    backup_bucket         = aws_s3_bucket.db_backup.bucket
    backup_prefix         = local.backup_prefix
    aws_region            = var.aws_region
    backup_retention_days = var.backup_retention_days
    name_prefix           = var.name_prefix
  }))

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  root_block_device {
    volume_type           = "gp3"
    volume_size           = 20
    encrypted             = true
    delete_on_termination = true
  }

  # 장부 캐비닛 — 인스턴스를 지워도 기본은 볼륨 잔존
  ebs_block_device {
    device_name           = "/dev/sdf"
    volume_size           = var.db_data_volume_size
    volume_type           = var.db_data_volume_type
    encrypted             = true
    delete_on_termination = false
  }

  tags = merge(var.tags, {
    Name = each.value.name
    Role = "mysql-innodb-cluster"
    Node = each.key
  })

  lifecycle {
    ignore_changes = [ami, ebs_block_device]
  }
}
