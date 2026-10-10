#!/usr/bin/env bash
set -Eeuo pipefail

if [[ -n "${BACKUP_S3_ENDPOINT:-}" ]]; then
  endpoint="$BACKUP_S3_ENDPOINT"
else
  account_id="${R2_ACCOUNT_ID:?Set R2_ACCOUNT_ID or BACKUP_S3_ENDPOINT}"
  if [[ ! "$account_id" =~ ^[A-Za-z0-9-]+$ ]]; then
    echo "R2_ACCOUNT_ID must contain only letters, digits, and hyphens." >&2
    exit 2
  fi
  endpoint="https://${account_id}.r2.cloudflarestorage.com"
fi

if [[ "$endpoint" =~ ^https://([A-Za-z0-9.-]+)(:([0-9]{1,5}))?$ ]]; then
  host="${BASH_REMATCH[1]}"
  port="${BASH_REMATCH[3]:-}"
  if [[ "$host" == .* || "$host" == *. || "$host" == *..* || "$host" == *.-* || "$host" == *-. ]]; then
    echo "BACKUP_S3_ENDPOINT must be an HTTPS origin without credentials, path, query, or fragment." >&2
    exit 2
  fi
  if [[ -n "$port" ]] && (( 10#$port < 1 || 10#$port > 65535 )); then
    echo "BACKUP_S3_ENDPOINT contains an invalid port." >&2
    exit 2
  fi
elif [[ "$endpoint" =~ ^http://(localhost|127\.0\.0\.1|\[::1\]|minio|host\.docker\.internal)(:([0-9]{1,5}))?$ && "${BACKUP_S3_ALLOW_HTTP:-false}" == "true" ]]; then
  port="${BASH_REMATCH[3]:-}"
  if [[ -n "$port" ]] && (( 10#$port < 1 || 10#$port > 65535 )); then
    echo "BACKUP_S3_ENDPOINT contains an invalid port." >&2
    exit 2
  fi
else
  echo "BACKUP_S3_ENDPOINT must use HTTPS. HTTP is allowed only for an explicit local S3-compatible test endpoint." >&2
  exit 2
fi

printf '%s\n' "$endpoint"
