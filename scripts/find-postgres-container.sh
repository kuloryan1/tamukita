#!/usr/bin/env bash
set -Eeuo pipefail

project_name="${BACKUP_COMPOSE_PROJECT_NAME:?Set BACKUP_COMPOSE_PROJECT_NAME to the Dokploy Compose project name}"
service_name="${BACKUP_POSTGRES_SERVICE:-postgres}"

if [[ ! "$project_name" =~ ^[a-z0-9][a-z0-9_-]*$ ]]; then
  echo "BACKUP_COMPOSE_PROJECT_NAME must be a lowercase Docker Compose project name." >&2
  exit 2
fi

if [[ ! "$service_name" =~ ^[a-z0-9][a-z0-9_-]*$ ]]; then
  echo "BACKUP_POSTGRES_SERVICE must be a lowercase Docker Compose service name." >&2
  exit 2
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Install the Docker CLI on the backup host." >&2
  exit 127
fi

container_list="$(docker ps --quiet \
  --filter "label=com.docker.compose.project=${project_name}" \
  --filter "label=com.docker.compose.service=${service_name}")"
container_ids=()
while IFS= read -r container_id; do
  if [[ -n "$container_id" ]]; then
    container_ids[${#container_ids[@]}]="$container_id"
  fi
done <<< "$container_list"

if (( ${#container_ids[@]} != 1 )) || [[ -z "${container_ids[0]:-}" ]]; then
  echo "Expected exactly one running ${service_name} container for Compose project ${project_name}; found ${#container_ids[@]}." >&2
  exit 1
fi

printf '%s\n' "${container_ids[0]}"
