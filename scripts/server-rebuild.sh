#!/bin/sh
# Rebuild the frontend image from the current commit and replace the running container.
# A plain `docker compose build` can reuse the old app layer, so the site stays unchanged.
set -eu
cd "$(dirname "$0")/.."

export BUILD_REV="$(git rev-parse HEAD)"
echo "Building frontend $BUILD_REV"

docker compose build --no-cache tickets-front
docker compose up -d --force-recreate --no-deps tickets-front

echo "Deployed $BUILD_REV"
