# Kosta File — Office add-in

`https://tickets.kostalegal.com/outlook-addin/`

Авторизация **та же, что у Hub** (Microsoft → session cookie).

Два манифеста (у Microsoft нельзя смешать Mail и Word/Excel/PPT в одном `MailApp`):

| Файл | Клиенты |
|------|---------|
| `KostaFile.manifest.xml` | **Outlook Classic** (Windows), New Outlook, Outlook в браузере, Mac, Mobile |
| `KostaFile.Office.manifest.xml` | **Word**, **Excel**, **PowerPoint** (Desktop) |

Версия манифестов: `0.3.0.0` · Mailbox **1.5+** (шире Classic, включая pinning где поддерживается).

## Установка Outlook (Classic / New)

1. **Get Add-ins** → **My add-ins** → **Add a custom add-in** → **Add from File…**
2. Выберите `KostaFile.manifest.xml`
3. Откройте письмо → лента **Kosta File** → **В matter**
4. **Настройки** → **Войти в Kosta Hub** (если сессии ещё нет в WebView)

**Classic Windows:** после sideload перезапустите Outlook. Кнопка на вкладке сообщения (Message). Закрепите task pane булавкой, если доступна.

**Централизованное развёртывание (рекомендуется для фирмы):** Microsoft 365 Admin → Integrated apps → Upload custom apps → тот же XML.

## Установка Word / Excel / PowerPoint

1. Insert → Add-ins → Upload My Add-in → `KostaFile.Office.manifest.xml`
2. Home → **Kosta File** → **В matter**
3. Выберите matter → **Сохранить в matter** (файл уйдёт в `Correspondence/Documents`)

## Статус в Outlook

После успешной загрузки в File Manager на письмо ставится категория **Saved to Kosta**.

## Вся переписка (тред, Outlook)

На вкладке **Письмо**:
- **Сохранить переписку** — один файл `Conversation_*.eml`
- **Обновить переписку** — новая версия того же документа (check-in)

Нужны: вход с согласием **Mail.Read**, matter (правило или выбор вручную).

## API

По умолчанию: `https://ticketsback.kostalegal.com/api/v1/files`
