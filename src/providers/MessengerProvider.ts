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
   * @param request - Формат зависит от провайдера:
   *   - MAX: phoneNumber как строка 7XXXXXXXXXX (RU) или 375XXXXXXXXX (BY)
   *   - WhatsApp: phoneNumber как строка в формате E.164 (только цифры, мин. 10)
   *   - Telegram: phoneNumber как integer (без +) ИЛИ username (строка, начинается с @)
   *   и опционально force
   * @returns Promise с результатом проверки (exist, chatId, fromCache, plus username/phoneNumber для Telegram)
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
 *
 * Метод `request` предоставляет переопределяемые хуки для настройки:
 * - `buildRequestUrl` — формирование полного URL с токеном
 * - `prepareRequestBody` — трансформация тела запроса перед отправкой
 * - `getRequestHeaders` — добавление/изменение заголовков
 * - `parseResponse` — парсинг ответа (включая пустые тела)
 * - `handleErrorResponse` — обработка ошибочных ответов
 * Наследники могут переопределять эти методы для мессенджер-специфичной логики.
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
   * Хук: формирует полный URL запроса с вставкой токена.
   * Формат GREEN-API: {baseUrl}/{methodName}/{token}/{rest}?{query}
   * @param path - Путь метода API (начинается с /)
   * @returns Полный URL для fetch
   */
  protected buildRequestUrl(path: string): string {
    if (!this.apiTokenInstance) {
      console.error('[GreenApiProvider] apiTokenInstance is EMPTY!', {
        provider: this.id,
        path,
      })
      throw new Error(
        '[GreenApiProvider] apiTokenInstance is empty — cannot make request',
      )
    }
    // GREEN-API формат URL: {apiUrl}/waInstance{idInstance}/{method}/{token}/[rest]?[query]
    // Токен ВСЕГДА вставляется ПОСЛЕ имени метода (первого сегмента пути)
    const [pathname, search = ''] = path.split('?')
    const segments = pathname.split('/').filter(Boolean)
    if (segments.length === 0) {
      throw new Error('[GreenApiProvider] Invalid path: missing method name')
    }
    const methodName = segments[0]
    const rest = segments.slice(1).join('/')
    const pathWithToken = rest
      ? `/${methodName}/${this.apiTokenInstance}/${rest}`
      : `/${methodName}/${this.apiTokenInstance}`
    return `${this.getBaseUrl()}${pathWithToken}${search ? `?${search}` : ''}`
  }

  /**
   * Хук: подготавитвает тело запроса перед отправкой.
   * По умолчанию возвращает тело как есть.
   * Наследники могут трансформировать body (например, привести phoneNumber к integer для Telegram).
   * @param _path - Путь метода API (не используется в базовой реализации)
   * @param body - Исходное тело запроса
   * @returns Трансформированное тело запроса
   */
  protected prepareRequestBody(_path: string, body?: unknown): unknown {
    return body
  }

  /**
   * Хук: возвращает заголовки для запроса.
   * По умолчанию: Content-Type: application/json
   * @param _path - Путь метода API (не используется в базовой реализации)
   * @param _method - HTTP метод (не используется в базовой реализации)
   * @returns Объект заголовков
   */
  protected getRequestHeaders(
    _path: string,
    _method: string,
  ): Record<string, string> {
    return {
      'Content-Type': 'application/json',
    }
  }

  /**
   * Хук: парсит успешный ответ.
   * Обрабатывает 204 No Content и пустые тела.
   * @param response - Response объект от fetch
   * @returns Распаршенный JSON или пустой объект
   */
  protected async parseResponse<T>(response: Response): Promise<T> {
    if (response.status === 204) {
      return {} as T
    }
    const text = await response.text()
    if (!text) {
      return {} as T
    }
    return JSON.parse(text) as T
  }

  /**
   * Хук: обрабатывает ошибочный ответ (HTTP != 2xx).
   * По умолчанию читает тело и выбрасывает Error с деталями.
   * Наследники могут добавить специфичную обработку ошибок.
   * @param response - Response объект с ошибкой
   * @throws Error
   */
  protected async handleErrorResponse(response: Response): Promise<never> {
    const errorText = await response.text().catch(() => '')
    console.error('[GreenApiProvider] Request failed:', {
      url: response.url,
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    })
    throw new Error(
      `GREEN-API error: ${response.status} ${response.statusText} - ${errorText || 'No response body'}`,
    )
  }

  /**
   * Универсальный метод выполнения HTTP-запроса к GREEN-API.
   * Использует переопределяемые хуки для настройки URL, тела, заголовков и обработки ответа.
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
    const url = this.buildRequestUrl(path)
    const preparedBody = this.prepareRequestBody(path, body)
    const headers = this.getRequestHeaders(path, method)

    const response = await fetch(url, {
      method,
      headers,
      body: preparedBody ? JSON.stringify(preparedBody) : undefined,
    })

    if (!response.ok) {
      return this.handleErrorResponse(response)
    }

    return this.parseResponse<T>(response)
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
          if (response?.receiptId && response.body) {
            const body = response.body

            // Логируем все входящие уведомления для диагностики
            console.log('[GreenApiProvider] Received notification:', {
              provider: this.id,
              typeWebhook: body.typeWebhook,
              typeMessage: body.messageData?.typeMessage,
              hasText: !!body.messageData?.textMessageData?.textMessage,
              chatId: body.messageData?.chatId,
              instanceType: body.instanceData?.typeInstance,
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
              // Для Telegram (особенно ботов) chatId может быть в senderData, а не в messageData
              const chatId = md.chatId ?? body.senderData?.chatId
              if (!chatId) {
                console.warn(
                  '[GreenApiProvider] No chatId found in notification',
                  { body },
                )
              } else {
                const text = md.textMessageData!.textMessage
                // Отладка: полный текст входящего сообщения
                console.log('[GreenApiProvider] Incoming text message:', {
                  provider: this.id,
                  chatId,
                  textLength: text.length,
                  textPreview: text.slice(0, 200),
                  hasEntities: !!md.textMessageData?.entities,
                  entities: md.textMessageData?.entities,
                  forwardingScore: md.textMessageData?.forwardingScore,
                  isForwarded: md.textMessageData?.isForwarded,
                })
                // GREEN-API возвращает timestamp в секундах.
                // У Telegram timestamp на уровне body, у WhatsApp/MAX — внутри messageData
                const timestamp = (md.timestamp ?? body.timestamp) * 1000
                onIncomingText(chatId, text, timestamp)
              }
            }

            // Всегда подтверждаем получение уведомления (удаляем из очереди)
            try {
              // Отладка: что отправляем на удаление
              console.log('[GreenApiProvider] DELETE notification:', {
                provider: this.id,
                receiptId: response.receiptId,
                tokenPresent: !!this.apiTokenInstance,
                tokenPrefix: this.apiTokenInstance?.slice(0, 10),
                path: `/deleteNotification/${response.receiptId}`,
              })
              await this.request<DeleteNotificationResponse>(
                'DELETE',
                `/deleteNotification/${response.receiptId}`,
              )
            } catch (deleteError) {
              const errMsg =
                deleteError instanceof Error
                  ? deleteError.message
                  : String(deleteError)
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
