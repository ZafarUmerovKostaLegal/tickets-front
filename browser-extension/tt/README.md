# Kosta Legal — расширение Time Tracking

MVP расширения Chrome/Edge для учёта времени без постоянно открытой вкладки приложения.

## Возможности (v0.1)

- Авторизация через открытую вкладку Kosta Legal (токен из `localStorage`)
- Popup: текущий таймер, проект, «Сегодня: X ч»
- **Продолжить последнюю** — старт по последней записи за сегодня
- **Пауза / Стоп** — синхронизация с приложением через `localStorage`
- Badge на иконке расширения (минуты/часы)

## Сборка

```bash
npm run ext:tt:build
```

Артефакт: `browser-extension/tt/dist/`

## Установка (dev)

1. Соберите расширение (`npm run ext:tt:build`)
2. Chrome → `chrome://extensions` → «Режим разработчика»
3. «Загрузить распакованное» → выберите папку `browser-extension/tt/dist`
4. Откройте приложение (localhost:5173 или production), войдите в аккаунт
5. Откройте popup расширения — сессия подхватится за несколько секунд

> **Важно:** после каждой пересборки нажимайте «Обновить» на карточке расширения.
> Content script собирается одним файлом (`content.js` без `import`) — иначе Chrome показывает ошибку
> `Cannot use import statement outside a module`.

## Разработка

```bash
npm run ext:tt:dev
```

После изменений нажмите «Обновить» на карточке расширения в `chrome://extensions`.

## Архитектура

| Файл | Назначение |
|------|------------|
| `src/background.ts` | API, состояние таймера, badge |
| `src/content/app-bridge.ts` | Синхронизация token/timer с вкладкой приложения |
| `src/popup/` | UI popup |
| `src/shared/` | API-клиент, логика таймера |

## Домены

В `manifest.json` разрешены:

- `http://localhost:5173/*`
- `https://*.kostalegal.com/*`

Добавьте свой staging-домен при необходимости.

## Дальше (roadmap)

- Выбор проекта/задачи в popup
- Напоминание «таймер не запущен»
- Firefox (MV3)
- Публикация в Chrome Web Store (internal)
