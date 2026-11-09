# Kosta File — Outlook add-in (New Outlook)

Мини-приложение для **New Outlook**: правила «отправитель / домен → matter» и загрузка `.eml` в `Correspondence/Emails`.

## Безопасность токенов

Отдельная авторизация Microsoft (не hub-сессия):

| Что | Как |
|-----|-----|
| Access JWT | TTL 10 мин, `typ=outlook_fm`, `aud=file-manager`, `scope=fm.outlook.upload`, привязка к `device_id` |
| Refresh | Opaque; на сервере только SHA-256; **ротация**; reuse → revoke семьи |
| В add-in | Access **только в RAM**; refresh — AES-GCM в roaming/localStorage |
| Scope FM | Только `clients`, `browse`, `folders` create, `documents` upload |

Вставка Bearer из Hub **удалена**.

## Быстрый старт

```bash
cd outlook-addin
npm install
npm run dev
```

HTTPS: `https://localhost:3001`

### Azure App Registration

1. Redirect URI (SPA): `https://localhost:3001/auth/callback.html`
2. Тот же `AZURE_CLIENT_ID` / tenant, что у Hub (public + PKCE).
3. На auth-сервисе: `AUTH_OUTLOOK_REDIRECT_URI=https://localhost:3001/auth/callback.html`

### Sideload

1. `npm run dev`
2. Outlook → Get add-ins → My add-ins → Add from file → `manifest.xml`
3. В task pane: URL API → **Войти через Microsoft** → правила filing

### Прод

Замените в `manifest.xml` `https://localhost:3001` на боевой HTTPS-хост, соберите `npm run build`, укажите production redirect в Azure и `AUTH_OUTLOOK_REDIRECT_URI`.

## API auth

- `GET  /api/v1/auth/outlook/login-url`
- `POST /api/v1/auth/outlook/exchange` — `{ code, redirectUri, codeVerifier, deviceId }`
- `POST /api/v1/auth/outlook/refresh` — header `X-Outlook-Device-Id`
- `POST /api/v1/auth/outlook/logout`
- `GET  /api/v1/auth/outlook/me`

## Структура

```
outlook-addin/
  manifest.xml
  public/auth/callback.html
  src/
    auth/          # PKCE, session, AES-GCM
    api.ts         # FM client с auto-refresh
    main.ts
```
