#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${REPO_ROOT}/assets/visuals/social-preview.jpg"
SETTINGS_URL="https://github.com/cobusgreyling/loop-engineering/settings"

if [[ ! -f "${IMAGE}" ]]; then
  echo "Missing ${IMAGE}"
  echo "Regenerate with:"
  echo "  sips -c 640 1280 assets/visuals/loop-engineering-social-banner.jpg --out assets/visuals/social-preview.jpg"
  exit 1
fi

BYTES=$(wc -c < "${IMAGE}" | tr -d ' ')
if (( BYTES > 1048576 )); then
  echo "Warning: social preview should be under 1 MB (current: ${BYTES} bytes)"
fi

echo "Ready: ${IMAGE} ($(sips -g pixelWidth -g pixelHeight "${IMAGE}" 2>/dev/null | awk '/pixel/{print $2}' | tr '\n' 'x' | sed 's/x$//'))"
echo
echo "GitHub has no public API for social preview upload."
echo "1. Open: ${SETTINGS_URL}"
echo "2. Social preview → Edit → Upload an image"
echo "3. Choose: assets/visuals/social-preview.jpg"
echo

if command -v open >/dev/null 2>&1; then
  open "${SETTINGS_URL}"
fi