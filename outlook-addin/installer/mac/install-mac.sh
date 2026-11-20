#!/bin/bash
# Kosta File for Office — macOS (Word, Excel, PowerPoint). Per-user, no administrator rights.
#
#   curl -fsSL https://tickets.kostalegal.com/outlook-addin/install-mac.sh | bash            # install
#   bash ~/Library/Application\ Support/Kosta/KostaFile/kostafile.sh uninstall                  # remove
#
# Office for Mac loads add-ins whose manifest sits in each app's container:
#   ~/Library/Containers/com.microsoft.<App>/Data/Documents/wef/
# A LaunchAgent re-runs this script at every login: it refreshes the manifest (new versions and
# buttons arrive by themselves) and picks up Office apps opened for the first time after install.
# Outlook for Mac takes add-ins from the Exchange mailbox — IT deploys it for the organisation.
set -euo pipefail

BASE="${KOSTA_FILE_BASE:-https://tickets.kostalegal.com/outlook-addin/}"
MANIFEST="KostaFile.Office.manifest.xml"
SUPPORT="$HOME/Library/Application Support/Kosta/KostaFile"
SELF="$SUPPORT/kostafile.sh"
LABEL="com.kostalegal.kostafile"
AGENT="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$SUPPORT/install.log"
APPS=("Word:Microsoft Word" "Excel:Microsoft Excel" "Powerpoint:Microsoft PowerPoint")
MODE="${1:-install}"
APPS_DIR="${KOSTA_FILE_APPS_DIR:-/Applications}"   # override only for tests

mkdir -p "$SUPPORT"
log() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$LOG" >&2; }  # stderr: stdout carries results

valid_manifest() { [ -s "$1" ] && grep -q '<OfficeApp' "$1" && grep -q '<Id>' "$1"; }

fetch_manifest() {
  local tmp="$SUPPORT/$MANIFEST.download"
  if curl -fsSL --max-time 30 "${BASE%/}/manifests/$MANIFEST" -o "$tmp" && valid_manifest "$tmp"; then
    mv -f "$tmp" "$SUPPORT/$MANIFEST"
    log "Манифест обновлён с ${BASE%/}/manifests/$MANIFEST"
  else
    rm -f "$tmp"
    if valid_manifest "$SUPPORT/$MANIFEST"; then
      log "Сервер недоступен — используем сохранённый манифест"
    else
      log "ОШИБКА: не удалось скачать манифест, а сохранённой копии нет"
      return 1
    fi
  fi
}

# The installer itself is kept locally for the login refresh and for uninstall.
keep_self() {
  if [ -f "${BASH_SOURCE[0]:-}" ] && [ "${BASH_SOURCE[0]}" != "$SELF" ]; then
    cp -f "${BASH_SOURCE[0]}" "$SELF"
  else
    curl -fsSL --max-time 30 "${BASE%/}/install-mac.sh" -o "$SELF.download" && mv -f "$SELF.download" "$SELF" || rm -f "$SELF.download"
  fi
  chmod 755 "$SELF" 2>/dev/null || true
}

install_manifest() {
  local placed=0 entry app name container
  for entry in "${APPS[@]}"; do
    app="${entry%%:*}"; name="${entry#*:}"
    container="$HOME/Library/Containers/com.microsoft.$app"
    if [ ! -d "$APPS_DIR/$name.app" ] && [ ! -d "$HOME/Applications/$name.app" ]; then
      continue
    fi
    # macOS creates the container on the app's first launch; never fake it.
    if [ ! -d "$container" ]; then
      log "$name ещё ни разу не открывался — Kosta File добавится после первого запуска и следующего входа"
      continue
    fi
    mkdir -p "$container/Data/Documents/wef"
    cp -f "$SUPPORT/$MANIFEST" "$container/Data/Documents/wef/$MANIFEST"
    log "$name: Kosta File установлен"
    placed=$((placed + 1))
  done
  echo "$placed"
}

install_agent() {
  mkdir -p "$(dirname "$AGENT")"
  cat > "$AGENT" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>$SELF</string><string>update</string></array>
  <key>RunAtLoad</key><true/>
  <key>StartInterval</key><integer>86400</integer>
  <key>StandardOutPath</key><string>/dev/null</string>
  <key>StandardErrorPath</key><string>/dev/null</string>
</dict>
</plist>
PLIST
  launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
  launchctl bootstrap "gui/$(id -u)" "$AGENT" >/dev/null 2>&1 || launchctl load -w "$AGENT" >/dev/null 2>&1 || true
}

uninstall() {
  local entry app
  for entry in "${APPS[@]}"; do
    app="${entry%%:*}"
    rm -f "$HOME/Library/Containers/com.microsoft.$app/Data/Documents/wef/$MANIFEST"
  done
  launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || launchctl unload "$AGENT" >/dev/null 2>&1 || true
  rm -f "$AGENT"
  rm -rf "$SUPPORT"
  echo "Kosta File удалён из Word, Excel и PowerPoint. Перезапустите Office."
}

case "$MODE" in
  uninstall)
    uninstall
    ;;
  update)
    fetch_manifest || exit 0
    install_manifest >/dev/null
    ;;
  install)
    log "=== Kosta File for Office: установка (пользователь ${USER:-$(id -un)}) ==="
    fetch_manifest
    keep_self
    placed="$(install_manifest | tail -n 1)"
    install_agent
    echo
    if [ "$placed" -gt 0 ]; then
      echo "Готово. Перезапустите Word, Excel и PowerPoint."
      echo "Первый раз откройте «Главная» → «Надстройки» (или «Вставка» → «Мои надстройки») и выберите Kosta File —"
      echo "дальше кнопка остаётся на ленте."
    else
      echo "Office ещё не открывался на этом Mac. Откройте Word, Excel или PowerPoint один раз —"
      echo "Kosta File добавится сам при следующем входе в систему."
    fi
    echo "Outlook: Kosta File появится сам, если ИТ включил его для компании."
    ;;
  *)
    echo "Использование: $0 [install|update|uninstall]" >&2
    exit 2
    ;;
esac
