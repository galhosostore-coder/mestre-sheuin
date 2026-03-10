#!/bin/bash
# Script de Backup Mestre - Automatizado

BACKUP_DIR="/opt/backups"
DATE=$(date +"%Y%m%d_%H%M%S")

# Configurações do Postgres
PG_CONTAINER="postgres"
PG_USER="root"
PG_DB="defaultdb"

echo "========================================"
echo "Iniciando backup mestre: $DATE"
echo "========================================"

# 1. Backup do PostgreSQL (Histórico Curto)
PG_BACKUP_FILE="$BACKUP_DIR/postgres_backup_$DATE.sql"
echo "[1/3] Realizando dump do banco de dados PostgreSQL..."
docker exec -t "$PG_CONTAINER" pg_dump -U "$PG_USER" -d "$PG_DB" -c > "$PG_BACKUP_FILE"
if [ $? -eq 0 ]; then
    echo "  -> Dump do PostgreSQL realizado com sucesso."
    gzip "$PG_BACKUP_FILE"
else
    echo "  -> ERRO ao realizar o dump do PostgreSQL!"
fi

# 2. Backup do Qdrant (Memória Vetorial / Ouro da Memória)
QDRANT_BACKUP_FILE="$BACKUP_DIR/qdrant_backup_$DATE.tar.gz"
echo "[2/3] Realizando backup do volume do Qdrant..."
# Usa um contêiner temporário (Alpine) montando o volume do qdrant para zipar os dados sem parar o serviço bruscamente
docker run --rm -v infra_qdrant_storage:/data -v "$BACKUP_DIR":/backup alpine tar -czvf "/backup/qdrant_backup_$DATE.tar.gz" -C /data . > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "  -> Backup do Qdrant realizado com sucesso."
else
    echo "  -> ERRO ao realizar o backup do Qdrant!"
fi

# 3. Limpeza de backups antigos (> 7 dias)
echo "[3/3] Removendo backups com mais de 7 dias para poupar espaço..."
find "$BACKUP_DIR" -type f -name "*.gz" -mtime +7 -exec rm -f {} \;
echo "  -> Limpeza concluída."

echo "========================================"
echo "Backup finalizado com sucesso: $(date +"%Y%m%d_%H%M%S")"
echo "========================================"
