import { GreenApiProvider } from './MessengerProvider'
import type {
  SendMessageRequest,
  SendMessageResponse,
  CheckAccountRequest,
  CheckAccountResponse,
  CheckWhatsAppResponse,
} from '../types'

/**
 * Провайдер для мессенджера MAX через GREEN-API.
 * Реализует конкретные методы API для MAX:
 * - sendMessage: отправка текстового сообщения
 * - checkAccount: проверка номера телефона (только RU +7 и BY +375)
 * Наследует long polling логику от GreenApiProvider.
 */
export class MaxProvider extends GreenApiProvider {
  /** Идентификатор провайдера — 'max' */
  readonly id = 'max' as const

  /**
   * @param apiUrl - Базовый URL инстанса GREEN-API (например, https://3100.api.green-api.com)
   * @param idInstance - ID инстанса
   * @param apiTokenInstance - Токен инстанса
   */
  constructor(apiUrl: string, idInstance: string, apiTokenInstance: string) {
    super(apiUrl, idInstance, apiTokenInstance)
  }

  /**
   * Отправка текстового сообщения в MAX.
   * Вызывает POST /sendMessage/ с параметрами chatId, message, typingTime, quotedMessageId.
   *
   * @param request - Параметры сообщения
   * @returns Promise с idMessage отправленного сообщения
   * @throws Error при ошибке API (лимиты, неверный chatId, и т.д.)
   */
  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    return this.request<SendMessageResponse>('POST', '/sendMessage/', {
      chatId: request.chatId,
      message: request.message,
      typingTime: request.typingTime,
      quotedMessageId: request.quotedMessageId,
    })
  }

  /**
   * Проверка существования аккаунта в MAX по номеру телефона.
   * Вызывает POST /checkAccount/.
   * ВАЖНО: для MAX поддерживаются только номера RU (код 7, 11 цифр) и BY (код 375, 12 цифр).
   * Формат: 7XXXXXXXXXX или 375XXXXXXXXX (без +, пробелов, скобок).
   *
   * @param request - phoneNumber в описанном формате, опционально force=true для принудительной проверки
   * @returns Promise с результатом: { exist, chatId, fromCache }
   * @throws Error при ошибке API
   */
  async checkAccount(
    request: CheckAccountRequest,
  ): Promise<CheckAccountResponse> {
    return this.request<CheckAccountResponse>('POST', '/checkAccount/', {
      phoneNumber: request.phoneNumber,
      force: request.force,
    })
  }
}

/**
 * Провайдер для WhatsApp через GREEN-API.
 * Реализует методы API для WhatsApp:
 * - sendMessage: отправка текстового сообщения
 * - checkAccount: проверка номера телефона (любой международный формат E.164)
 * Наследует long polling логику от GreenApiProvider.
 */
export class WhatsAppProvider extends GreenApiProvider {
  /** Идентификатор провайдера — 'whatsapp' */
  readonly id = 'whatsapp' as const

  /**
   * @param apiUrl - Базовый URL инстанса GREEN-API (например, https://3100.api.green-api.com)
   * @param idInstance - ID инстанса
   * @param apiTokenInstance - Токен инстанса
   */
  constructor(apiUrl: string, idInstance: string, apiTokenInstance: string) {
    super(apiUrl, idInstance, apiTokenInstance)
  }

  /**
   * Отправка текстового сообщения в WhatsApp.
   * Вызывает POST /sendMessage/ с параметрами chatId, message, typingTime, quotedMessageId.
   *
   * @param request - Параметры сообщения
   * @returns Promise с idMessage отправленного сообщения
   * @throws Error при ошибке API (лимиты, неверный chatId, и т.д.)
   */
  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    return this.request<SendMessageResponse>('POST', '/sendMessage/', {
      chatId: request.chatId,
      message: request.message,
      typingTime: request.typingTime,
      quotedMessageId: request.quotedMessageId,
    })
  }

  /**
   * Проверка существования аккаунта в WhatsApp по номеру телефона.
   * Вызывает POST /checkWhatsApp/ (специфичный для WhatsApp эндпоинт).
   * Для WhatsApp поддерживается любой международный формат (E.164).
   * Формат: цифры с кодом страны, без + и пробелов (например, 79001234567, 15551234567).
   *
   * @param request - phoneNumber в формате E.164 (только цифры), опционально force=true
   * @returns Promise с результатом: { exist, chatId, fromCache }
   * @throws Error при ошибке API
   */
  async checkAccount(
    request: CheckAccountRequest,
  ): Promise<CheckAccountResponse> {
    const response = await this.request<CheckWhatsAppResponse>(
      'POST',
      '/checkWhatsApp/',
      {
        phoneNumber: request.phoneNumber,
        // force не поддерживается checkWhatsApp, но передаем для совместимости
      },
    )
    // Маппинг ответа WhatsApp к общему интерфейсу
    return {
      exist: response.existsWhatsapp,
      chatId: response.chatId,
      fromCache: response.fromCache,
    }
  }
}

/**
 * Заглушка провайдера Telegram (на будущее).
 * Аналогична WhatsAppProvider.
 */
export class TelegramProvider extends GreenApiProvider {
  /** Идентификатор провайдера — 'telegram' */
  readonly id = 'telegram' as const

  /**
   * @param apiUrl - Базовый URL инстанса GREEN-API
   * @param idInstance - ID инстанса
   * @param apiTokenInstance - Токен инстанса
   */
  constructor(apiUrl: string, idInstance: string, apiTokenInstance: string) {
    super(apiUrl, idInstance, apiTokenInstance)
  }

  /** @throws Error — не реализовано */
  async sendMessage(): Promise<SendMessageResponse> {
    throw new Error('TelegramProvider not implemented yet')
  }

  /** @throws Error — не реализовано */
  async checkAccount(): Promise<CheckAccountResponse> {
    throw new Error('TelegramProvider not implemented yet')
  }
}

/**
 * Фабрика для создания экземпляра провайдера по типу мессенджера.
 * Централизует создание и позволяет легко добавлять новые провайдеры.
 *
 * @param type - Тип мессенджера: 'max' | 'whatsapp' | 'telegram'
 * @param apiUrl - Базовый URL инстанса GREEN-API
 * @param idInstance - ID инстанса
 * @param apiTokenInstance - Токен инстанса
 * @returns Экземпляр соответствующего провайдера (GreenApiProvider)
 * @throws Error если передан неизвестный тип
 */
export function createProvider(
  type: 'max' | 'whatsapp' | 'telegram',
  apiUrl: string,
  idInstance: string,
  apiTokenInstance: string,
): GreenApiProvider {
  switch (type) {
    case 'max':
      return new MaxProvider(apiUrl, idInstance, apiTokenInstance)
    case 'whatsapp':
      return new WhatsAppProvider(apiUrl, idInstance, apiTokenInstance)
    case 'telegram':
      return new TelegramProvider(apiUrl, idInstance, apiTokenInstance)
    default: // TypeScript exhaustive check — если добавлен новый тип без обработки, будет ошибка компиляции
    {
      const _exhaustive: never = type
      throw new Error(`Unknown provider type: ${_exhaustive}`)
    }
  }
}
