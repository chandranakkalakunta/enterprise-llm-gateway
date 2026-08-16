#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ellmgw-dev}"
REGION="${REGION:-asia-south1}"
REPOSITORY="${REPOSITORY:-gateway}"
IMAGE_NAME="${IMAGE_NAME:-gateway}"
SHORT_SHA="$(git rev-parse --short HEAD)"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${IMAGE_NAME}"

gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
docker build --platform linux/amd64 -t "${IMAGE}:${SHORT_SHA}" -t "${IMAGE}:latest" .
docker push "${IMAGE}:${SHORT_SHA}"
docker push "${IMAGE}:latest"

echo "Pushed ${IMAGE}:${SHORT_SHA}"
echo "Pushed ${IMAGE}:latest"
