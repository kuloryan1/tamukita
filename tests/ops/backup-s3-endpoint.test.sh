#!/usr/bin/env bash
set -Eeuo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
helper="$project_root/scripts/resolve-backup-s3-endpoint.sh"

assert_endpoint() {
  local expected="$1"
  shift
  local actual
  actual="$(env -i PATH="$PATH" "$@" bash "$helper")"
  if [[ "$actual" != "$expected" ]]; then
    echo "Expected endpoint $expected; got $actual." >&2
    exit 1
  fi
}

assert_rejected() {
  if env -i PATH="$PATH" "$@" bash "$helper" >/dev/null 2>&1; then
    echo "Expected unsafe backup S3 endpoint configuration to be rejected." >&2
    exit 1
  fi
}

assert_endpoint "https://account-123.r2.cloudflarestorage.com" R2_ACCOUNT_ID=account-123
assert_endpoint "https://s3.example.test:9443" BACKUP_S3_ENDPOINT=https://s3.example.test:9443
assert_endpoint "http://minio:9000" BACKUP_S3_ENDPOINT=http://minio:9000 BACKUP_S3_ALLOW_HTTP=true
assert_endpoint "http://127.0.0.1:9000" BACKUP_S3_ENDPOINT=http://127.0.0.1:9000 BACKUP_S3_ALLOW_HTTP=true
assert_rejected BACKUP_S3_ENDPOINT=http://s3.example.test BACKUP_S3_ALLOW_HTTP=true
assert_rejected BACKUP_S3_ENDPOINT=http://minio:9000
assert_rejected BACKUP_S3_ENDPOINT=https://user:secret@s3.example.test
assert_rejected BACKUP_S3_ENDPOINT=https://s3.example.test/path
assert_rejected BACKUP_S3_ENDPOINT=https://s3.example.test?bucket=private
assert_rejected R2_ACCOUNT_ID='account/path'
assert_rejected BACKUP_S3_ENDPOINT=https://s3.example.test:99999

echo "Backup S3 endpoint policy checks passed."
