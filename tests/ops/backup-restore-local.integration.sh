#!/usr/bin/env bash
set -Eeuo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
: "${PGHOST:?Set PGHOST to the disposable local PostgreSQL host}"
: "${PGPORT:?Set PGPORT to the disposable local PostgreSQL port}"
: "${PGUSER:?Set PGUSER to the disposable local PostgreSQL user}"
: "${PGPASSWORD:?Set PGPASSWORD to the disposable local PostgreSQL password}"
: "${BACKUP_S3_ENDPOINT:?Set BACKUP_S3_ENDPOINT to local MinIO}"
: "${BACKUP_S3_ALLOW_HTTP:?Set BACKUP_S3_ALLOW_HTTP=true for local MinIO}"
: "${BACKUP_TEST_ACCESS_KEY_ID:?Set local MinIO access key}"
: "${BACKUP_TEST_SECRET_ACCESS_KEY:?Set local MinIO secret key}"

case "$PGHOST" in
  localhost|127.0.0.1|\[::1\]|postgres|host.docker.internal) ;;
  *) echo "This integration test accepts only a local PostgreSQL host." >&2; exit 2 ;;
esac
case "$BACKUP_S3_ENDPOINT" in
  http://localhost:*|http://127.0.0.1:*|http://\[::1\]:*|http://minio:*|http://host.docker.internal:*) ;;
  *) echo "This integration test accepts only a local MinIO endpoint." >&2; exit 2 ;;
esac
if [[ "$BACKUP_S3_ALLOW_HTTP" != "true" ]]; then
  echo "Set BACKUP_S3_ALLOW_HTTP=true for this isolated local MinIO drill." >&2
  exit 2
fi
for command_name in age age-keygen aws createdb dropdb pg_dump pg_restore psql; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Install $command_name before running the local backup integration test." >&2
    exit 127
  fi
done

suffix="$(date -u +'%Y%m%d%H%M%S')-$$"
source_database="backup_src_${suffix//[^A-Za-z0-9_]/_}"
restore_database="backup_restore_${suffix//[^A-Za-z0-9_]/_}"
tampered_restore_database="${restore_database}_tampered"
bucket="tamukita-backup-test-${suffix//[^a-z0-9-]/-}"
prefix="integration/${suffix}"
temporary_directory="$(mktemp -d)"
identity_file="$temporary_directory/backup.agekey"
config_file="$temporary_directory/aws-config"
source_created=false
restore_created=false
bucket_created=false

cleanup() {
  local exit_code=$?
  trap - EXIT
  set +e
  if [[ "$bucket_created" == true ]]; then
    aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 rm "s3://${bucket}/" --recursive --only-show-errors >/dev/null 2>&1
    aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 rb "s3://${bucket}" >/dev/null 2>&1
  fi
  if [[ "$restore_created" == true ]]; then dropdb --if-exists "$restore_database" >/dev/null 2>&1; fi
  dropdb --if-exists "$tampered_restore_database" >/dev/null 2>&1
  if [[ "$source_created" == true ]]; then dropdb --if-exists "$source_database" >/dev/null 2>&1; fi
  rm -rf "$temporary_directory"
  exit "$exit_code"
}
trap cleanup EXIT

export PGCONNECT_TIMEOUT=5
export AWS_ACCESS_KEY_ID="$BACKUP_TEST_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$BACKUP_TEST_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION=auto
export AWS_CONFIG_FILE="$config_file"
export BACKUP_COMPOSE_PROJECT_NAME="backup-test-${suffix//[^a-z0-9-]/-}"
export BACKUP_POSTGRES_SERVICE=postgres
export POSTGRES_USER="$PGUSER"
export POSTGRES_DB="$source_database"
export R2_BACKUP_ACCESS_KEY_ID="$BACKUP_TEST_ACCESS_KEY_ID"
export R2_BACKUP_SECRET_ACCESS_KEY="$BACKUP_TEST_SECRET_ACCESS_KEY"
export BACKUP_S3_ALLOW_HTTP=true
export BACKUP_S3_ENDPOINT
export BACKUP_BUCKET="$bucket"
export BACKUP_PREFIX="$prefix"
unset R2_ACCOUNT_ID BACKUP_ALERT_WEBHOOK_URL || true

cat > "$config_file" <<'AWS_CONFIG'
[default]
s3 =
    addressing_style = path
AWS_CONFIG

mkdir -p "$temporary_directory/bin"
cat > "$temporary_directory/bin/docker" <<'DOCKER_MOCK'
#!/usr/bin/env bash
set -Eeuo pipefail

case "${1:-}" in
  ps)
    shift
    arguments=" $* "
    [[ "$arguments" == *"label=com.docker.compose.project=${BACKUP_COMPOSE_PROJECT_NAME}"* ]] || { echo "Missing Compose project filter." >&2; exit 91; }
    [[ "$arguments" == *"label=com.docker.compose.service=${BACKUP_POSTGRES_SERVICE}"* ]] || { echo "Missing PostgreSQL service filter." >&2; exit 92; }
    printf '%s\n' backup-test-postgres
    ;;
  exec)
    shift
    while (($# > 0)); do
      case "$1" in
        -i) shift ;;
        -e) export "$2"; shift 2 ;;
        *) break ;;
      esac
    done
    [[ "${1:-}" == backup-test-postgres ]] || { echo "Unexpected PostgreSQL container ID." >&2; exit 93; }
    shift
    exec "$@"
    ;;
  *)
    echo "Unexpected Docker command in backup integration test: ${1:-}" >&2
    exit 90
    ;;
esac
DOCKER_MOCK
chmod +x "$temporary_directory/bin/docker"
export PATH="$temporary_directory/bin:$PATH"

aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 mb "s3://${bucket}" >/dev/null
bucket_created=true
createdb "$source_database"
source_created=true
psql --dbname="$source_database" --set=ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE backup_probe (id integer PRIMARY KEY, value text NOT NULL);
INSERT INTO backup_probe (id, value) VALUES (1, 'TamuKita local encrypted restore fixture');
SQL

age-keygen -o "$identity_file" >/dev/null 2>&1
recipient="$(sed -n 's/^# public key: //p' "$identity_file" | head -n 1)"
if [[ ! "$recipient" =~ ^age1[0-9a-z]+$ ]]; then
  echo "Could not read the generated age public recipient." >&2
  exit 1
fi
export BACKUP_AGE_RECIPIENT="$recipient"

bash "$project_root/scripts/backup-postgres.sh" | tee "$temporary_directory/backup.log"
object_key="$(sed -n 's#^Encrypted PostgreSQL backup uploaded: s3://[^/]*/\(.*\)$#\1#p' "$temporary_directory/backup.log" | tail -n 1)"
if [[ -z "$object_key" ]]; then
  echo "The backup command did not report an uploaded object." >&2
  exit 1
fi
export BACKUP_OBJECT="$object_key"
aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 cp "s3://${bucket}/${object_key}" "$temporary_directory/encrypted.dump.age" --only-show-errors
if ! LC_ALL=C grep -a -q '^age-encryption\.org/v1$' "$temporary_directory/encrypted.dump.age"; then
  echo "The uploaded database dump is not an age-encrypted file." >&2
  exit 1
fi
aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 cp "s3://${bucket}/${object_key}.sha256" "$temporary_directory/backup.sha256" --only-show-errors
export BACKUP_AGE_IDENTITY_FILE="$identity_file"

printf '%064d  database.dump.age\n' 0 > "$temporary_directory/tampered.sha256"
aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 cp "$temporary_directory/tampered.sha256" "s3://${bucket}/${object_key}.sha256" --only-show-errors
export RESTORE_DATABASE="$tampered_restore_database"
if restore_output="$(bash "$project_root/scripts/restore-postgres.sh" 2>&1)"; then
  echo "Restore accepted a backup with a tampered checksum sidecar." >&2
  exit 1
fi
if [[ "$restore_output" != *"FAILED"* ]]; then
  echo "Tampered checksum was rejected for an unexpected reason: $restore_output" >&2
  exit 1
fi
tampered_database_exists="$(psql --dbname=postgres --tuples-only --no-align --command="SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = '${tampered_restore_database}')")"
if [[ "$tampered_database_exists" != "f" ]]; then
  echo "The checksum failure created a database before validation." >&2
  exit 1
fi

aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 cp "$temporary_directory/backup.sha256" "s3://${bucket}/${object_key}.sha256" --only-show-errors
export RESTORE_DATABASE="$restore_database"
restore_created=true
bash "$project_root/scripts/restore-postgres.sh"

source_value="$(psql --dbname="$source_database" --tuples-only --no-align --command='SELECT value FROM backup_probe WHERE id = 1')"
restored_value="$(psql --dbname="$restore_database" --tuples-only --no-align --command='SELECT value FROM backup_probe WHERE id = 1')"
if [[ "$source_value" != "$restored_value" || "$restored_value" != "TamuKita local encrypted restore fixture" ]]; then
  echo "Restored database data did not match the source fixture." >&2
  exit 1
fi

printf 'Local encrypted backup/restore drill passed: object=%s source=%s restored=%s\n' "$object_key" "$source_database" "$restore_database"
