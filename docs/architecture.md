# Архитектура Green Messenger UI

## Обзор

Статическое SPA (Single Page Application) для обмена сообщениями через GREEN-API.

**Стек:** React 18 + TypeScript + Vite + CSS Modules
**API:** Прямые вызовы GREEN-API из браузера (CORS разрешен)
**State:** React Context + localStorage

---

## Структура проекта

```
src/
├── components/          # UI компоненты
│   ├── App.tsx              # Корневой компонент + провайдеры
│   ├── ProviderSettingsScreen.tsx  # Настройки подключений
│   ├── ChatScreen.tsx       # Экран чата (state machine)
│   ├── NewChatBar.tsx       # Ввод номера + создание чата
│   ├── MessageList.tsx      # Список сообщений
│   ├── MessageInput.tsx     # Поле ввода + отправка
│   └── *.module.css         # Стили компонентов
├── context/
│   └── ConnectionsContext.tsx   # Состояние подключений + localStorage
├── hooks/
│   └── useNotificationsPolling.ts # Жизненный цикл long polling
├── providers/
│   ├── MessengerProvider.ts     # Интерфейс + базовый класс (GreenApiProvider)
│   ├── providerFactory.ts       # Фабрика createProvider()
│   ├── MaxProvider.ts           # MAX провайдер
│   ├── WhatsAppProvider.ts      # WhatsApp провайдер
│   └── TelegramProvider.ts      # Telegram провайдер
├── styles/
│   └── index.css                # Глобальные стили + design tokens
├── types/
│   └── index.ts                 # Доменные типы (Connection, Message, Chat, API контракты)
└── main.tsx                     # Точка входа
```

---

## Ключевые архитектурные решения

### 1. Multi-provider архитектура
```typescript
// Интерфейс провайдера (MessengerProvider.ts)
interface MessengerProvider {
  readonly id: 'max' | 'whatsapp' | 'telegram'
  sendMessage(req): Promise<SendMessageResponse>
  checkAccount(req): Promise<CheckAccountResponse>
  pollNotifications(cb): () => void
}

// Базовый класс (MessengerProvider.ts)
abstract class GreenApiProvider implements MessengerProvider

// Фабрика (providerFactory.ts)
createProvider(type, apiUrl, idInstance, apiTokenInstance)
```
- `MaxProvider` — формат 7XXXXXXXXXX / 375XXXXXXXXX, endpoint `/checkAccount/`
- `WhatsAppProvider` — E.164, endpoint `/checkWhatsApp/`
- `TelegramProvider` — E.164, endpoint `/checkAccount/`

### 2. Long Polling
- `GreenApiProvider.pollNotifications()` — бесконечный цикл `receiveNotification/?receiveTimeout=25`
- Обрабатывает только входящие текстовые сообщения (`incomingMessageReceived` / `incomingMessage`)
- Все уведомления подтверждаются через `deleteNotification/{receiptId}`
- Ошибки логируются, цикл продолжается (retry 1 сек)

### 3. Состояние подключений (ConnectionsContext)
- `connections: Connection[]` — список сохранённых в localStorage
- `activeConnectionId: string | null` — текущее активное
- `activeProvider: MessengerProvider | null` — инстанс провайдера
- CRUD: `addConnection`, `removeConnection`, `setActiveConnection`
- Персистентность: `localStorage['green-messenger-connections']`

### 4. ChatScreen — State Machine
```
no-connection → no-chat → loading → ready
                      ↘ error
```
- `no-connection` — нет активного подключения
- `no-chat` — есть подключение, ждём ввод номера (NewChatBar)
- `loading` — checkAccount в процессе
- `ready` — чат открыт, поллинг запущен, можно писать
- `error` — ошибка создания чата, кнопка "Повторить"

### 5. Оптимистичный UI
- Исходящие сообщения сразу добавляются в список (`status: 'sending'`)
- После ответа API — обновляют `idMessage` и `status: 'sent'`
- Ошибка отправки — `status: 'error'`, сообщение остаётся в списке

---

## Валидация номеров

| Провайдер | Формат | Пример |
|-----------|--------|--------|
| MAX | `7XXXXXXXXXX` (11 цифр) / `375XXXXXXXXX` (12 цифр) | `79001234567` |
| WhatsApp | Любой E.164 (мин. 10 цифр) | `79001234567`, `15551234567` |
| Telegram | Любой E.164 (мин. 10 цифр) | `79001234567`, `15551234567` |

---

## GREEN-API интеграция

**Базовый URL:** `{apiUrl}/waInstance{idInstance}/{method}/{apiTokenInstance}`

| Метод | Эндпоинт | Назначение |
|-------|----------|------------|
| POST | `/sendMessage/` | Отправка текста (все провайдеры) |
| POST | `/checkAccount/` | Проверка номера (MAX, Telegram) |
| POST | `/checkWhatsApp/` | Проверка номера (WhatsApp) |
| GET | `/receiveNotification/?receiveTimeout=25` | Long polling |
| DELETE | `/deleteNotification/{receiptId}` | Подтверждение получения |

**CORS:** GREEN-API возвращает `access-control-allow-origin: *` — прямые вызовы из браузера работают.

---

## Деплой

```bash
npm run build  # → dist/
```
Содержимое `dist/` загружается на хостинг как статический сайт.
`vite.config.ts`: `base: './'` для относительных путей.

---

## Скрипты

| Команда | Назначение |
|---------|------------|
| `npm run dev` | Dev server (HMR) |
| `npm run build` | Production build |
| `npm run preview` | Preview dist локально |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |