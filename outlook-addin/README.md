# Kosta File — Office add-in

`https://tickets.kostalegal.com/outlook-addin/`

Авторизация **та же, что у Hub** (Microsoft → session cookie).

Два манифеста (у Microsoft нельзя смешать Mail и Word/Excel/PPT в одном `MailApp`):

| Файл | Клиенты |
|------|---------|
| `KostaFile.manifest.xml` | **Outlook Classic** (Windows), New Outlook, Outlook в браузере, Mac, Mobile |
| `KostaFile.Office.manifest.xml` | **Word**, **Excel**, **PowerPoint** (Desktop) |

Версия обоих манифестов: `0.5.0.0` (берётся из `package.json`) · Mailbox **1.5+** · **SupportsPinning** + `TaskpaneId`.

## Панель «всегда как MacroView»

Web add-in не может сам открыться при старте Outlook (это умеет только VSTO/COM вроде MacroView). Ближайший эквивалент:

1. Установить манифест (лучше централизованно на тенант).
2. Открыть **Kosta File** один раз.
3. Нажать **📌** в шапке панели (New Outlook → Apps / Classic → task pane).

После закрепления панель **остаётся** при смене и закрытии письма; UI обновляется через `ItemChanged`.

## Установка Outlook (Classic / New)

1. **Get Add-ins** → **My add-ins** → **Add a custom add-in** → **Add from File…**
2. Выберите `KostaFile.manifest.xml` (**переустановите**, если уже стояла старая версия — нужен `0.5.0.0`)
3. Откройте письмо → **Kosta File**
4. Закрепите панель **📌**
5. **Настройки** → **Войти в Kosta Hub** (если сессии ещё нет)

**Classic Windows:** после sideload перезапустите Outlook.

**Для всей фирмы (рекомендуется):** Microsoft 365 Admin → Integrated apps → Upload custom apps → тот же XML. Тогда кнопка появляется у всех без ручной установки.

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

## Разработка

```bash
npm ci
npm run dev                # https://localhost:3001/outlook-addin/ (сертификат mkcert)
```

Sideload dev-манифестов из `manifests/dev/` — у них свои `Id` и имя «Kosta File (dev)»,
поэтому они ставятся рядом с боевой надстройкой.

| Команда | Что делает |
|---------|------------|
| `npm run build` | typecheck → проверка манифестов → `vite build` (так же в Docker и CI) |
| `npm run typecheck` | `tsc` без тестов |
| `npm test` | unit-тесты (Vitest основного проекта, `outlook-addin/src/**/*.test.ts`) |
| `npm run manifests` | пересобрать манифесты из `manifests/templates/` |
| `npm run manifests:check` | упасть, если XML в корне разошёлся с шаблонами |

### Манифесты

Правьте только `manifests/templates/*.xml` и `ENVIRONMENTS` в `scripts/manifests.mjs`,
затем `npm run manifests`. Версия — `version` в `package.json` (`0.5.0` → `0.5.0.0`).
Файлы в корне генерируются и коммитятся: их загружают админы M365.

### Безопасность

- Адрес File Manager API ограничен списком наших шлюзов (`settings.ts → ALLOWED_API_ORIGINS`):
  токен Hub никогда не уходит на чужой хост. Поле адреса доступно только в dev-сборке.
- Токен надстройки хранится в отдельном ключе `kosta.addin.hubToken` и не трогает сессию Hub SPA.
- Roaming-настройки Office ограничены ~32 КБ: туда пишется урезанная история загрузок,
  правила сохраняются всегда (`buildRoamingPayload`).
