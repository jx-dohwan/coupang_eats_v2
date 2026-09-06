# =============================================================================
# locals — DB 노드 키 a/b/c (서브넷 맵과 동일)
# =============================================================================

locals {
  db_nodes = {
    for az_key, subnet_id in var.private_db_subnet_ids : az_key => {
      subnet_id = subnet_id
      name      = "${var.name_prefix}-db-${az_key}"
      # server_id 는 MySQL 전역 고유. a=1, b=2, c=3
      server_id = index(sort(keys(var.private_db_subnet_ids)), az_key) + 1
    }
  }

  backup_prefix = "mysql-backup"
}
