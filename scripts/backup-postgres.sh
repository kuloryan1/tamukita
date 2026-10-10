#!/usr/bin/env bash
set -Eeuo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

temporary_directory=""
cleanup() {
  if [[ -n "$temporary_directory" ]]; then
    rm -rf "$temporary_directory"
  fi
}
trap cleanup EXIT

notify_backup_failure() {
  local exit_code="$1"
  trap - ERR
  if [[ -z "${BACKUP_ALERT_WEBHOOK_URL:-}" ]]; then
    return 0
  fi
  if [[ "$BACKUP_ALERT_WEBHOOK_URL" != https://* ]] || ! command -v curl >/dev/null 2>&1; then
    echo "Backup alert was not sent; configure an HTTPS webhook and install curl." >&2
    return 0
  fi

  local payload="{\"text\":\"TamuKita PostgreSQL backup failed with exit code ${exit_code}. Check the systemd journal for details.\"}"
  if ! curl --fail-with-body --silent --show-error --max-time 10 \
    -H "Content-Type: application/json" \
    --data-raw "$payload" \
    "$BACKUP_ALERT_WEBHOOK_URL" >&2; then
    echo "Backup alert delivery failed; inspect the systemd journal." >&2
  fi
}
trap 'exit_code=$?; notify_backup_failure "$exit_code"; exit "$exit_code"' ERR

: "${R2_ACCOUNT_ID:?Set R2_ACCOUNT_ID}"
: "${R2_BACKUP_ACCESS_KEY_ID:?Set R2_BACKUP_ACCESS_KEY_ID}"
: "${R2_BACKUP_SECRET_ACCESS_KEY:?Set R2_BACKUP_SECRET_ACCESS_KEY}"
: "${BACKUP_BUCKET:?Set BACKUP_BUCKET}"
: "${BACKUP_AGE_RECIPIENT:?Set BACKUP_AGE_RECIPIENT to an age public recipient}"

prefix="${BACKUP_PREFIX:-tamukita/postgres}"
timestamp="$(date -u +'%Y%m%dT%H%M%SZ')"
object_key="${prefix%/}/${timestamp}.dump.age"
temporary_directory="$(mktemp -d)"
postgres_container_id="$(bash "$project_root/scripts/find-postgres-container.sh")"

docker exec "$postgres_container_id" sh -ec 'pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom --no-owner --no-acl' > "$temporary_directory/database.dump"
age --recipient "$BACKUP_AGE_RECIPIENT" --output "$temporary_directory/database.dump.age" "$temporary_directory/database.dump"
(cd "$temporary_directory" && sha256sum database.dump.age > database.dump.age.sha256)

endpoint="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
AWS_ACCESS_KEY_ID="$R2_BACKUP_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$R2_BACKUP_SECRET_ACCESS_KEY" \
AWS_DEFAULT_REGION=auto \
aws --endpoint-url "$endpoint" s3 cp "$temporary_directory/database.dump.age" "s3://${BACKUP_BUCKET}/${object_key}" --only-show-errors
AWS_ACCESS_KEY_ID="$R2_BACKUP_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$R2_BACKUP_SECRET_ACCESS_KEY" \
AWS_DEFAULT_REGION=auto \
aws --endpoint-url "$endpoint" s3 cp "$temporary_directory/database.dump.age.sha256" "s3://${BACKUP_BUCKET}/${object_key}.sha256" --only-show-errors

printf 'Encrypted PostgreSQL backup uploaded: s3://%s/%s\n' "$BACKUP_BUCKET" "$object_key"
