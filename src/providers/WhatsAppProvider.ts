import { GreenApiProvider } from './MessengerProvider'
import type {
  SendMessageRequest,
  SendMessageResponse,
  CheckAccountRequest,
  CheckAccountResponse,
  CheckWhatsAppResponse,
} from '../types'

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