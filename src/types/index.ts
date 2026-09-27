// Доменные типы приложения

export type MessengerType = 'max' | 'whatsapp' | 'telegram'

export interface Connection {
  id: string
  provider: MessengerType
  apiUrl: string
  idInstance: string
  apiTokenInstance: string
  name?: string // опциональное имя
}

export interface Message {
  id: string
  chatId: string
  text: string
  direction: 'incoming' | 'outgoing'
  timestamp: number
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'error'
}

export interface Chat {
  id: string
  phoneNumber: string
  chatId: string
  messages: Message[]
  createdAt: number
}

export interface SendMessageRequest {
  chatId: string
  message: string
  typingTime?: number
  quotedMessageId?: string
}

export interface SendMessageResponse {
  idMessage: string
}

export interface CheckAccountRequest {
  phoneNumber: string
  force?: boolean
}

export interface CheckAccountResponse {
  exist: boolean
  chatId: string
  fromCache: boolean
}

export interface CheckWhatsAppResponse {
  existsWhatsapp: boolean
  chatId: string
  username: string
  phoneNumber: string
  fromCache: boolean
}

export interface NotificationBody {
  typeWebhook: string
  instanceData: {
    idInstance: string
    wid: string
    typeInstance: string
  }
  messageData?: {
    typeMessage: string
    textMessageData?: {
      textMessage: string
    }
    chatId: string
    senderData: {
      chatId: string
      sender: string
      senderName: string
    }
    timestamp: number
  }
}

export interface ReceiveNotificationResponse {
  receiptId: string
  body: NotificationBody
}

export interface DeleteNotificationResponse {
  result: boolean
  reason: string
}
