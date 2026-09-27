import { GreenApiProvider } from './MessengerProvider'
import type {
  SendMessageRequest,
  SendMessageResponse,
  CheckAccountRequest,
  CheckAccountResponse,
} from '../types'

/**
 * Провайдер для мессенджера Telegram через GREEN-API.
 * Реализует конкретные методы API для Telegram:
 * - sendMessage: отправка текстового сообщения
 * - checkAccount: проверка номера телефона (любой международный формат E.164)
 * Наследует long polling логику от GreenApiProvider.
 */
export class TelegramProvider extends GreenApiProvider {
  /** Идентификатор провайдера — 'telegram' */
  readonly id = 'telegram' as const

  /**
   * @param apiUrl - Базовый URL инстанса GREEN-API (например, https://3100.api.green-api.com)
   * @param idInstance - ID инстанса
   * @param apiTokenInstance - Токен инстанса
   */
  constructor(apiUrl: string, idInstance: string, apiTokenInstance: string) {
    super(apiUrl, idInstance, apiTokenInstance)
  }

  /**
   * Отправка текстового сообщения в Telegram.
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
   * Проверка существования аккаунта в Telegram по номеру телефона.
   * Вызывает POST /checkAccount/ (как для MAX).
   * Для Telegram поддерживается любой международный формат (E.164).
   * Формат: цифры с кодом страны, без + и пробелов (например, 79001234567, 15551234567).
   *
   * @param request - phoneNumber в формате E.164 (только цифры), опционально force=true для принудительной проверки
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
