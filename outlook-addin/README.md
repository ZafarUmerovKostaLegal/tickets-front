# Kosta File — Outlook add-in

`https://tickets.kostalegal.com/outlook-addin/`

Авторизация **та же, что у Hub** (Microsoft → session cookie). Отдельный Outlook-логин не нужен.

## Установка (файл)

1. **Custom Add-ins** → **Add from File…** → `KostaFile.manifest.xml`
2. Письмо → **Kosta File** → **В matter**
3. **Настройки** → **Войти в Kosta Hub** (если сессии ещё нет в WebView Outlook)

## Статус в Outlook

После успешной загрузки в File Manager на письмо ставится категория **Saved to Kosta** (видна в списке писем). SharePoint пока не подключён.

## Панель не должна закрываться

В манифесте включён **SupportsPinning**. Откройте Kosta File → в шапке панели Apps нажмите **булавку (Pin)** — после этого панель остаётся открытой при смене писем, автозагрузка продолжает работать.

## API

По умолчанию: `https://ticketsback.kostalegal.com/api/v1/files`
