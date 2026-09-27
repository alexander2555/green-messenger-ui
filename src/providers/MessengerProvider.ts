import type {
  SendMessageRequest,
  SendMessageResponse,
  CheckAccountRequest,
  CheckAccountResponse,
  ReceiveNotificationResponse,
  DeleteNotificationResponse,
} from '../types'

/**
 * Интерфейс провайдера мессенджера.
 * Абстрагирует взаимодействие с GREEN-API для конкретного мессенджера.
 * Все реализации должны обеспечивать одинаковый контракт для отправки,
 * проверки аккаунта и получения уведомлений.
 */
export interface MessengerProvider {
  /** Идентификатор провайдера (используется для выбора в UI) */
  readonly id: 'max' | 'whatsapp' | 'telegram'

  /**
   * Отправка текстового сообщения.
   * @param request - Параметры сообщения (chatId, текст, опционально typingTime, quotedMessageId)
   * @returns Promise с ответом API, содержащим idMessage
   * @throws Error при сетевой ошибке или ошибке API (HTTP != 2xx)
   */
  sendMessage(request: SendMessageRequest): Promise<SendMessageResponse>

  /**
   * Проверка существования аккаунта по номеру телефона и получение chatId.
   * @param request - Номер телефона (в формате 7XXXXXXXXXX или 375XXXXXXXXX для MAX) и флаг force
   * @returns Promise с результатом проверки (exist, chatId, fromCache)
   * @throws Error при сетевой ошибке или ошибке API
   */
  checkAccount(request: CheckAccountRequest): Promise<CheckAccountResponse>

  /**
   * Запуск long polling для получения входящих уведомлений.
   * Цикл: GET receiveNotification -> обработка incomingMessageReceived/textMessage ->
   * DELETE deleteNotification -> повтор.
   * @param onIncomingText - Callback, вызываемый для каждого входящего текстового сообщения
   * @returns Функция остановки поллинга (cleanup)
   */
  pollNotifications(
    onIncomingText: (chatId: string, text: string, timestamp: number) => void,
  ): () => void
}

/**
 * Базовый абстрактный класс провайдера GREEN-API.
 * Инкапсулирует общую логику: формирование URL, HTTP-запросы, long polling цикл.
 * Конкретные провайдеры (MaxProvider, WhatsAppProvider, TelegramProvider)
 * наследуются от этого класса и реализуют только специфичные методы.
 */
export abstract class GreenApiProvider implements MessengerProvider {
  /** Идентификатор провайдера — задаётся в наследниках */
  abstract readonly id: 'max' | 'whatsapp' | 'telegram'

  /**
   * @param apiUrl - Базовый URL инстанса GREEN-API (например, https://3100.api.green-api.com)
   * @param idInstance - ID инстанса (числовой)
   * @param apiTokenInstance - Токен инстанса
   */
  constructor(
    protected readonly apiUrl: string,
    protected readonly idInstance: string,
    protected readonly apiTokenInstance: string,
  ) {}

  /**
   * Формирует базовый URL для вызова методов API.
   * Шаблон: {apiUrl}/waInstance{idInstance}
   * @returns Базовый URL без токена и без метода
   */
  protected getBaseUrl(): string {
    return `${this.apiUrl}/waInstance${this.idInstance}`
  }

  /**
   * Универсальный метод выполнения HTTP-запроса к GREEN-API.
   * Добавляет токен в URL перед query string (формат GREEN-API: /method/{token}?query).
   * Устанавливает Content-Type: application/json, обрабатывает ошибки HTTP-статусов.
   * @template T - Тип ожидаемого ответа
   * @param method - HTTP метод (GET, POST, DELETE)
   * @param path - Путь метода API (начинается с /, например /sendMessage/ или /receiveNotification/?receiveTimeout=25)
   * @param body - Тело запроса (для POST), будет сериализовано в JSON
   * @returns Promise с распаршенным JSON ответом типа T
   * @throws Error с описанием статуса и тела ответа при ошибке
   */
  protected async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    // Разделяем путь и query string, токен вставляется ПЕРЕД ? (формат GREEN-API)
    const [pathname, search = ''] = path.split('?')
    const url = `${this.getBaseUrl()}${pathname}${this.apiTokenInstance}${search ? `?${search}` : ''}`
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      console.error('[GreenApiProvider] Request failed:', {
        url,
        method,
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      })
      throw new Error(
        `GREEN-API error: ${response.status} ${response.statusText} - ${errorText || 'No response body'}`,
      )
    }

    // 204 No Content или 200 с пустым телом (receiveNotification таймаут)
    if (response.status === 204) {
      return {} as T
    }

    // Проверяем, есть ли тело ответа перед парсингом JSON
    const text = await response.text()
    if (!text) {
      return {} as T
    }

    return JSON.parse(text) as T
  }

  /** Отправка сообщения — реализуется в наследниках */
  abstract sendMessage(
    request: SendMessageRequest,
  ): Promise<SendMessageResponse>

  /** Проверка аккаунта — реализуется в наследниках */
  abstract checkAccount(
    request: CheckAccountRequest,
  ): Promise<CheckAccountResponse>

  /**
   * Запускает бесконечный цикл long polling для получения уведомлений.
   * Обрабатывает только входящие текстовые сообщения (incomingMessageReceived + textMessage).
   * Все уведомления (в том числе сервисные) подтверждаются через deleteNotification.
   *
   * @param onIncomingText - Callback: (chatId, text, timestampMs) => void
   * @returns Функция остановки (устанавливает флаг stopped = true)
   */
  pollNotifications(
    onIncomingText: (chatId: string, text: string, timestamp: number) => void,
  ): () => void {
    let stopped = false

    /**
     * Основной цикл поллинга.
     * Выполняется до вызова возвращённой функции остановки.
     */
    const poll = async () => {
      while (!stopped) {
        try {
          // Long polling: сервер держит соединение до receiveTimeout (25 сек) или пока не придет уведомление
          const response = await this.request<ReceiveNotificationResponse>(
            'GET',
            `/receiveNotification/?receiveTimeout=25`,
          )

          // Если есть receiptId и body — обрабатываем уведомление
          if (response.receiptId && response.body) {
            const body = response.body

            // Логируем все входящие уведомления для диагностики
            console.log('[GreenApiProvider] Received notification:', {
              typeWebhook: body.typeWebhook,
              typeMessage: body.messageData?.typeMessage,
              hasText: !!body.messageData?.textMessageData?.textMessage,
              chatId: body.messageData?.chatId,
            })

            // Фильтруем: только входящие текстовые сообщения
            // Поддерживаем разные типы webhook для разных мессенджеров
            const md = body.messageData
            const isIncomingText =
              md != null &&
              (body.typeWebhook === 'incomingMessageReceived' ||
                body.typeWebhook === 'incomingMessage') &&
              md.typeMessage === 'textMessage' &&
              md.textMessageData?.textMessage != null

            if (isIncomingText && md) {
              const chatId = md.chatId
              const text = md.textMessageData!.textMessage
              // GREEN-API возвращает timestamp в секундах, приводим к миллисекундам
              const timestamp = md.timestamp * 1000

              onIncomingText(chatId, text, timestamp)
            }

            // Всегда подтверждаем получение уведомления (удаляем из очереди)
            try {
              await this.request<DeleteNotificationResponse>(
                'DELETE',
                `/deleteNotification/${response.receiptId}`,
              )
            } catch (deleteError) {
              const errMsg = deleteError instanceof Error ? deleteError.message : String(deleteError)
              console.error('[GreenApiProvider] deleteNotification failed:', {
                receiptId: response.receiptId,
                error: errMsg,
              })
              // Не прерываем цикл — пробуем продолжить поллинг
            }
          }
        } catch (error) {
          if (!stopped) {
            // Логируем ошибку, но не прерываем цикл — делаем паузу и продолжаем
            console.error('[GreenApiProvider] Polling error:', error)
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
      }
    }

    // Запускаем цикл асинхронно (не блокируем вызов)
    poll()

    /**
     * Функция остановки поллинга.
     * Устанавливает флаг stopped = true, цикл завершится на следующей итерации.
     */
    return () => {
      stopped = true
    }
  }
}
