# Инструкция для фронта: Бюджет проектов (план / факт / остаток / прогресс)

После обновления бэка отчёт  
`GET /api/v1/time-tracking/reports/project-budget`  
отдаёт совместимые поля для бюджета в двух форматах ключей.

## 1) Какие поля использовать в UI

Для карточек и таблицы:

- План: `budgetAmount` (fallback: `budget_amount`, `budget`)
- Факт: `budgetSpent` (fallback: `budget_spent_amount`, `budget_spent`)
- Остаток: `budgetRemaining` (fallback: `budget_remaining_amount`, `budget_remaining`)
- Прогресс: `progressPercent` (fallback: `progress_percent`)

Рекомендуемый маппинг:

```ts
const budgetAmount =
  row.budgetAmount ?? row.budget_amount ?? row.budget ?? 0

const budgetSpent =
  row.budgetSpent ?? row.budget_spent_amount ?? row.budget_spent ?? 0

const budgetRemaining =
  row.budgetRemaining ?? row.budget_remaining_amount ?? row.budget_remaining ?? 0

const progressPercent =
  row.progressPercent ?? row.progress_percent ?? 0
```

---

## 2) Что показывать по режимам бюджета

Бэк возвращает `budget_by`:

- `none` — бюджета нет
- `hours` — бюджет в часах
- `money` — бюджет в деньгах
- `hours_and_money` — двойной бюджет

Для `hours_and_money`:
- используйте денежные поля (`budgetAmount`, `budgetSpent`, `budgetRemaining`) для общей колонки бюджета;
- прогресс берите из `progressPercent` (бэк уже считает max из money/hours прогресса).

---

## 3) Формат отображения

- Если `currency = "USD"`: показывать `$` и 2 знака после запятой.
- Если `currency = "UZS"`: показывать `UZS` без дробной части (или по вашему формату).
- Для `budget_by = "hours"` подписывать единицы (`ч`), а не валюту.

---

## 4) Проверка в Network

Проверьте `GET /api/v1/time-tracking/reports/project-budget?...`:

У каждой строки должны быть поля:

- `budgetAmount`
- `budgetSpent`
- `budgetRemaining`
- `progressPercent`

Если они есть, но UI пустой — проблема только в фронтовом маппинге/рендере.

---

## 5) Частая причина пустых значений

Если в проекте не задан бюджет (`budgetAmount`/`progressBudgetAmount`/`budgetHours`), бэк вернёт нули.  
Это корректно: в таком случае показывайте `0` и прогресс `0%`, либо текст «Бюджет не задан».
