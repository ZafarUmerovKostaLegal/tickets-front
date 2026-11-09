# Kosta File — Outlook add-in

Хостится **на том же домене Hub**:  
`https://tickets.kostalegal.com/outlook-addin/`

Сборка фронта (Docker) копирует add-in в nginx под этот путь. Отдельный localhost:3001 для прода не нужен.

## Установка в Outlook

1. Задеплойте фронт (чтобы открывался `/outlook-addin/index.html`).
2. Azure App Registration → Redirect URI (**SPA**):  
   `https://tickets.kostalegal.com/outlook-addin/auth/callback.html`
3. Auth env:  
   `AUTH_OUTLOOK_REDIRECT_URI=https://tickets.kostalegal.com/outlook-addin/auth/callback.html`
4. Outlook → **Get Add-ins** → **My add-ins** → **Add from file** →  
   `outlook-addin/manifest.xml`
5. Откройте письмо → лента **Kosta File** → **В matter**.
6. В настройках task pane:
   - File Manager API: `https://ticketsback.kostalegal.com/api/v1/files`  
     (или тот URL API, что у Hub)
   - Auth: `https://ticketsback.kostalegal.com/api/v1/auth/outlook`  
     (можно оставить пустым — выведется из API URL)
   - **Войти через Microsoft**

## Локальная разработка

```bash
cd outlook-addin
npm install
npm run dev
```

Dev: `https://localhost:3001/outlook-addin/`  
Для локального sideload временно подставьте localhost в копии `manifest.xml` или используйте прод-URL после деплоя.

## Безопасность токенов

Отдельная Azure-авторизация add-in (не hub cookie):

- Access JWT 10 мин, `typ=outlook_fm`, только filing-scope
- Refresh opaque + ротация, AES-GCM в клиенте
- Device binding (`X-Outlook-Device-Id`)

## API

- `GET/POST /api/v1/auth/outlook/*` (gateway → auth)
