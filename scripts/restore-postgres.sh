#!/usr/bin/env bash
set -Eeuo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

: "${R2_BACKUP_ACCESS_KEY_ID:?Set R2_BACKUP_ACCESS_KEY_ID}"
: "${R2_BACKUP_SECRET_ACCESS_KEY:?Set R2_BACKUP_SECRET_ACCESS_KEY}"
: "${BACKUP_BUCKET:?Set BACKUP_BUCKET}"
: "${BACKUP_OBJECT:?Set BACKUP_OBJECT to an object key inside BACKUP_BUCKET}"
: "${BACKUP_AGE_IDENTITY_FILE:?Set BACKUP_AGE_IDENTITY_FILE to an age private identity file}"
: "${RESTORE_DATABASE:?Set RESTORE_DATABASE to a new, empty database name}"

if [[ ! "$RESTORE_DATABASE" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]]; then
  echo "RESTORE_DATABASE must be a simple PostgreSQL identifier." >&2
  exit 2
fi

temporary_directory="$(mktemp -d)"
trap 'rm -rf "$temporary_directory"' EXIT
postgres_container_id="$(bash "$project_root/scripts/find-postgres-container.sh")"
endpoint="$(bash "$project_root/scripts/resolve-backup-s3-endpoint.sh")"

AWS_ACCESS_KEY_ID="$R2_BACKUP_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$R2_BACKUP_SECRET_ACCESS_KEY" \
AWS_DEFAULT_REGION=auto \
aws --endpoint-url "$endpoint" s3 cp "s3://${BACKUP_BUCKET}/${BACKUP_OBJECT}" "$temporary_directory/database.dump.age" --only-show-errors
AWS_ACCESS_KEY_ID="$R2_BACKUP_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$R2_BACKUP_SECRET_ACCESS_KEY" \
AWS_DEFAULT_REGION=auto \
aws --endpoint-url "$endpoint" s3 cp "s3://${BACKUP_BUCKET}/${BACKUP_OBJECT}.sha256" "$temporary_directory/database.dump.age.sha256" --only-show-errors

(cd "$temporary_directory" && sha256sum --check database.dump.age.sha256)
age --decrypt --identity "$BACKUP_AGE_IDENTITY_FILE" --output "$temporary_directory/database.dump" "$temporary_directory/database.dump.age"

docker exec -e RESTORE_DATABASE="$RESTORE_DATABASE" "$postgres_container_id" sh -ec 'createdb --owner="$POSTGRES_USER" "$RESTORE_DATABASE"'
docker exec -i -e RESTORE_DATABASE="$RESTORE_DATABASE" "$postgres_container_id" sh -ec 'pg_restore --username="$POSTGRES_USER" --dbname="$RESTORE_DATABASE" --no-owner --exit-on-error' < "$temporary_directory/database.dump"

printf 'Backup restored into new database %s. Review it before switching application traffic.\n' "$RESTORE_DATABASE"
