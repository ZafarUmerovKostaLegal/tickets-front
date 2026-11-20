# Kosta File — установка в Office

Kosta File — веб-надстройка: панель всегда грузится с `https://tickets.kostalegal.com/outlook-addin/`,
поэтому обновляется сама. Установщики только регистрируют её в Office.

## Быстрый выбор

| Где | Как появляется | Что сделать |
|---|---|---|
| **Outlook** — Windows, Mac, веб, iPhone/iPad, Android | Сама у всех сотрудников | Один раз: администратор Exchange запускает `admin/Deploy-Outlook.ps1` (или центр администрирования M365 → Интегрированные приложения → ссылка на манифест) |
| **Word, Excel, PowerPoint — Windows** | Кнопка на ленте после перезапуска Office | `KostaFileForOffice.exe` (без прав администратора) |
| **Word, Excel, PowerPoint — Mac** | В «Надстройках», после первого выбора — на ленте | `curl -fsSL https://tickets.kostalegal.com/outlook-addin/install-mac.sh \| bash` или `KostaFileForOffice.pkg` через MDM |
| **Word, Excel, PowerPoint — iPad и веб** | Через центральное развёртывание | Центр администрирования M365 → Интегрированные приложения → загрузить `manifests/KostaFile.Office.manifest.xml` |
| **Word, Excel, PowerPoint — iPhone, Android** | Не поддерживается Microsoft | Документы — в Kosta Hub в браузере телефона |

Центральное развёртывание из центра администрирования M365 — лучший вариант для всей компании:
одна загрузка обоих манифестов включает Kosta File во всех версиях Office у выбранных сотрудников.
Установщики нужны для компьютеров вне этой схемы.

## Сборка

- Windows: `npm run installer` → `installer/out/KostaFileForOffice.exe` (IExpress, встроен в Windows).
  Подпишите exe сертификатом компании (`signtool sign …`), иначе SmartScreen предупреждает.
- macOS: на Mac `bash installer/mac/build-pkg.sh` → `installer/out/KostaFileForOffice.pkg`.
  Для раздачи вне MDM подпишите: `SIGN_IDENTITY="Developer ID Installer: …" bash installer/mac/build-pkg.sh`.
- `npm run build` кладёт в `dist/` манифесты, `install-mac.sh` и (если собран) `KostaFileForOffice.exe`.

## Удаление

- Windows: «Приложения и возможности» → Kosta File for Office.
- Mac: `bash ~/Library/Application\ Support/Kosta/KostaFile/kostafile.sh uninstall`.
- Outlook для компании: `admin/Deploy-Outlook.ps1 -Remove`.

## Журналы

- Windows: `%LOCALAPPDATA%\Kosta\KostaFile\install.log`
- Mac: `~/Library/Application Support/Kosta/KostaFile/install.log`
