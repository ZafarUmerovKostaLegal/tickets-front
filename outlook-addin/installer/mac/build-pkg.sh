#!/bin/bash
# Builds KostaFileForOffice.pkg on macOS — for MDM (Intune, Jamf) or a double-click install.
# The package carries no files: its postinstall runs install-mac.sh as the logged-in user,
# so Office finds the add-in in that user's containers.
#
#   bash installer/mac/build-pkg.sh [version]
#   SIGN_IDENTITY="Developer ID Installer: Kosta Legal (TEAMID)" bash installer/mac/build-pkg.sh
#
# Without a Developer ID Installer signature macOS Gatekeeper blocks a downloaded pkg
# (MDM-deployed packages are fine).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
VERSION="${1:-$(node -p "require('$HERE/../../package.json').version" 2>/dev/null || echo 1.0.0)}"
OUT="$HERE/../out"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$WORK/scripts" "$OUT"
cp "$HERE/install-mac.sh" "$WORK/scripts/install-mac.sh"
cat > "$WORK/scripts/postinstall" <<'POST'
#!/bin/bash
# Runs as root: install for the user at the console (the one who opened the pkg / is logged in).
user="$(stat -f%Su /dev/console)"
if [ -z "$user" ] || [ "$user" = "root" ] || [ "$user" = "loginwindow" ]; then
  echo "Нет вошедшего пользователя — Kosta File установится при его входе" >&2
  exit 0
fi
uid="$(id -u "$user")"
home="$(dscl . -read "/Users/$user" NFSHomeDirectory | awk '{print $2}')"
launchctl asuser "$uid" sudo -u "$user" env HOME="$home" /bin/bash "$(dirname "$0")/install-mac.sh" install
exit 0
POST
chmod 755 "$WORK/scripts/postinstall" "$WORK/scripts/install-mac.sh"

UNSIGNED="$WORK/KostaFileForOffice.pkg"
pkgbuild --nopayload --scripts "$WORK/scripts" --identifier com.kostalegal.kostafile --version "$VERSION" "$UNSIGNED"
if [ -n "${SIGN_IDENTITY:-}" ]; then
  productsign --sign "$SIGN_IDENTITY" "$UNSIGNED" "$OUT/KostaFileForOffice.pkg"
else
  cp "$UNSIGNED" "$OUT/KostaFileForOffice.pkg"
  echo "Внимание: пакет не подписан (задайте SIGN_IDENTITY)." >&2
fi
echo "Готово: $OUT/KostaFileForOffice.pkg"
