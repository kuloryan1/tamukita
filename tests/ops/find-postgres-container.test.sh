#!/usr/bin/env bash
set -Eeuo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
helper="$project_root/scripts/find-postgres-container.sh"
temporary_directory="$(mktemp -d)"
trap 'rm -rf "$temporary_directory"' EXIT
mkdir -p "$temporary_directory/bin"

cat > "$temporary_directory/bin/docker" <<'DOCKER'
#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${1:-}" != "ps" ]]; then
  echo "Unexpected docker command: ${1:-}" >&2
  exit 90
fi

shift
project_filter_seen=false
service_filter_seen=false
for argument in "$@"; do
  [[ "$argument" == "label=com.docker.compose.project=${MOCK_DOCKER_EXPECT_PROJECT}" ]] && project_filter_seen=true
  [[ "$argument" == "label=com.docker.compose.service=${MOCK_DOCKER_EXPECT_SERVICE}" ]] && service_filter_seen=true
done

if [[ "$project_filter_seen" != true || "$service_filter_seen" != true ]]; then
  echo "Docker label filters did not match the requested Compose project and service." >&2
  exit 91
fi

if [[ "${MOCK_DOCKER_FAIL:-false}" == true ]]; then
  exit 92
fi

printf '%s' "${MOCK_DOCKER_IDS:-}"
DOCKER
chmod +x "$temporary_directory/bin/docker"

run_helper() {
  env \
    "PATH=$temporary_directory/bin:$PATH" \
    "MOCK_DOCKER_EXPECT_PROJECT=${MOCK_EXPECT_PROJECT:-tamukita-production-abc123}" \
    "MOCK_DOCKER_EXPECT_SERVICE=${MOCK_EXPECT_SERVICE:-postgres}" \
    "MOCK_DOCKER_IDS=${MOCK_IDS:-}" \
    "MOCK_DOCKER_FAIL=${MOCK_FAIL:-false}" \
    "BACKUP_COMPOSE_PROJECT_NAME=${MOCK_PROJECT:-tamukita-production-abc123}" \
    "BACKUP_POSTGRES_SERVICE=${MOCK_SERVICE:-postgres}" \
    bash \
    "$helper"
}

MOCK_IDS="container-123"
output="$(run_helper)"
if [[ "$output" != "container-123" ]]; then
  echo "Expected the unique running PostgreSQL container ID; got: $output" >&2
  exit 1
fi

for case_name in none multiple; do
  case "$case_name" in
    none) MOCK_IDS="" ;;
    multiple) MOCK_IDS=$'container-123\ncontainer-456' ;;
  esac
  if output="$(run_helper 2>&1)"; then
    echo "Expected discovery to fail for $case_name matching containers." >&2
    exit 1
  fi
  if [[ "$output" != *"Expected exactly one running postgres container"* ]]; then
    echo "Unexpected $case_name-container error: $output" >&2
    exit 1
  fi
done

if output="$(MOCK_PROJECT="Invalid.Project" run_helper 2>&1)"; then
  echo "Expected an invalid project name to be rejected." >&2
  exit 1
fi
if [[ "$output" != *"BACKUP_COMPOSE_PROJECT_NAME must be a lowercase"* ]]; then
  echo "Unexpected invalid-project error: $output" >&2
  exit 1
fi

if output="$(MOCK_FAIL=true run_helper 2>&1)"; then
  echo "Expected Docker CLI failure to stop discovery." >&2
  exit 1
fi

echo "Dokploy PostgreSQL container discovery checks passed."
