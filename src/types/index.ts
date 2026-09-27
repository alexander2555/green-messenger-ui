/**
 * Доменные типы приложения Green Messenger UI
 * @packageDocumentation
 */

/** Тип поддерживаемого мессенджера */
export type MessengerType = 'max' | 'whatsapp' | 'telegram'

/**
 * Подключение к GREEN-API инстансу.
 * Хранится в localStorage, управляется через ConnectionsContext.
 */
export interface Connection {
  /** Уникальный идентификатор подключения (UUID) */
  id: string
  /** Тип мессенджера: max, whatsapp, telegram */
  provider: MessengerType
  /** Базовый URL API инстанса, напр. https://3100.api.green-api.com */
  apiUrl: string
  /** ID инстанса GREEN-API (только цифры) */
  idInstance: string
  /** Токен доступа к инстансу */
  apiTokenInstance: string
  /** Опциональное пользовательское имя для отображения в списке */
  name?: string
}

/** Направление сообщения */
export type MessageDirection = 'incoming' | 'outgoing'

/** Статус исходящего сообщения */
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'error'

/**
 * Сообщение в чате.
 * Входящие — создаются при получении через Long Polling.
 * Исходящие — создаются оптимистично при отправке, затем обновляются после ответа API.
 */
export interface Message {
  /** Уникальный ID сообщения (локальный UUID или idMessage от API) */
  id: string
  /** ID чата (chatId от GREEN-API, напр. 79001234567@c.us) */
  chatId: string
  /** Текст сообщения */
  text: string
  /** Направление: incoming — от собеседника, outgoing — от пользователя */
  direction: MessageDirection
  /** Unix timestamp в миллисекундах (GREEN-API возвращает секунды, умножаем на 1000) */
  timestamp: number
  /** Статус доставки (только для outgoing). undefined для incoming. */
  status?: MessageStatus
}

/**
 * Чат (переписка с одним контактом).
 * Создаётся после успешного CheckAccount / CheckWhatsApp.
 */
export interface Chat {
  /** Уникальный ID чата (локальный) */
  id: string
  /** Номер телефона получателя в формате провайдера (79001234567) */
  phoneNumber: string
  /** Канонический chatId от GREEN-API (используется в SendMessage) */
  chatId: string
  /** Список сообщений текущей сессии (история не загружается в MVP) */
  messages: Message[]
  /** Unix timestamp создания чата (мс) */
  createdAt: number
}

/** Запрос на отправку сообщения (GREEN-API SendMessage) */
export interface SendMessageRequest {
  /** chatId из CheckAccount / CheckWhatsApp */
  chatId: string
  /** Текст сообщения (до 4000 символов, UTF-8) */
  message: string
  /** Опционально: время "печатает..." в секундах */
  typingTime?: number
  /** Опционально: ID сообщения для цитирования */
  quotedMessageId?: string
}

/** Ответ на отправку сообщения */
export interface SendMessageResponse {
  /** ID сообщения, назначенный сервером GREEN-API */
  idMessage: string
}

/** Запрос на проверку номера (MAX: checkAccount) */
export interface CheckAccountRequest {
  /** Номер телефона: 11 цифр (7XXXXXXXXXX) для RU или 12 цифр (375XXXXXXXXX) для BY, без + и пробелов */
  phoneNumber: string
  /** Принудительная проверка (игнорировать кэш) */
  force?: boolean
}

/** Ответ на проверку номера (MAX) */
export interface CheckAccountResponse {
  /** Есть ли аккаунт в MAX */
  exist: boolean
  /** Канонический chatId для отправки сообщений */
  chatId: string
  /** Данные из кэша GREEN-API */
  fromCache: boolean
}

/** Ответ на проверку номера (WhatsApp: checkWhatsApp) */
export interface CheckWhatsAppResponse {
  /** Есть ли WhatsApp на номере */
  existsWhatsapp: boolean
  /** ID чата в формате 123@lid или 79001234567@c.us */
  chatId: string
  /** Имя пользователя WhatsApp (если есть) */
  username: string
  /** Номер телефона в международном формате */
  phoneNumber: string
  /** Данные из кэша */
  fromCache: boolean
}

/**
 * Тело уведомления от GREEN-API (receiveNotification).
 * Содержит typeWebhook и опциональные messageData для входящих сообщений.
 */
export interface NotificationBody {
  /** Тип вебхука: incomingMessageReceived, incomingMessage, outgoingMessageStatus, ... */
  typeWebhook: string
  /** Данные инстанса */
  instanceData: {
    /** ID инстанса */
    idInstance: string
    /** WhatsApp ID (wid) */
    wid: string
    /** Тип инстанса: whatsapp, max, telegram */
    typeInstance: string
  }
  /** Данные сообщения (если применимо к типу вебхука) */
  messageData?: {
    /** Тип сообщения: textMessage, imageMessage, ... */
    typeMessage: string
    /** Текст сообщения (только для textMessage) */
    textMessageData?: {
      /** Сам текст */
      textMessage: string
    }
    /** Канонический chatId чата */
    chatId: string
    /** Данные отправителя */
    senderData: {
      /** chatId отправителя */
      chatId: string
      /** Номер/ID отправителя */
      sender: string
      /** Имя отправителя */
      senderName: string
    }
    /** Unix timestamp в секундах (GREEN-API) */
    timestamp: number
  }
}

/** Ответ receiveNotification (Long Polling) */
export interface ReceiveNotificationResponse {
  /** Уникальный ID уведомления в очереди — нужен для deleteNotification */
  receiptId: string
  /** Тело уведомления (может отсутствовать по таймауту long polling) */
  body: NotificationBody
}

/** Ответ deleteNotification */
export interface DeleteNotificationResponse {
  /** true — уведомление удалено из очереди */
  result: boolean
  /** Причина результата (обычно "deleted" или описание ошибки) */
  reason: string
}
