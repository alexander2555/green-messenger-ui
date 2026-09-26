import React, { memo } from 'react'
import type { Message } from '../types'
import styles from './MessageList.module.css'

/** Props для MessageList */
interface MessageListProps {
  /** Массив сообщений для отображения */
  messages: Message[]
}

/** Компонент списка сообщений.
 * Отображает входящие и исходящие сообщения с разным стилем.
 * Поддерживает статусы доставки для исходящих сообщений.
 */
const MessageList = memo(function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className={`${styles.container} ${styles.empty}`} role="status" aria-label="Нет сообщений">
        <svg
          className={styles.emptyIcon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <p className={styles.emptyText}>Сообщений пока нет</p>
      </div>
    )
  }

  return (
    <div className={styles.container} role="list" aria-label="История сообщений">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`${styles.messageWrapper} ${message.direction === 'outgoing' ? styles.messageWrapperOutgoing : styles.messageWrapperIncoming}`}
          role="listitem"
        >
          <div
            className={`${styles.messageBubble} ${message.direction === 'outgoing' ? styles.messageOutgoing : styles.messageIncoming}`}
          >
            <p className={styles.messageText}>{message.text}</p>
            <div className={styles.messageMeta}>
              <time className={styles.messageTime} dateTime={new Date(message.timestamp).toISOString()}>
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </time>
              {message.direction === 'outgoing' && message.status && (
                <span className={`${styles.messageStatus} ${styles[`status${message.status.charAt(0).toUpperCase() + message.status.slice(1)}`]}`} aria-label={`Статус: ${message.status}`}>
                  {getStatusIcon(message.status)}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
})

/** Получение SVG иконки для статуса сообщения */
function getStatusIcon(status: Message['status']): React.ReactNode {
  switch (status) {
    case 'sending':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      )
    case 'sent':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )
    case 'delivered':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
          <polyline points="14 19 21 12 14 5" />
        </svg>
      )
    case 'read':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )
    case 'error':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      )
    default:
      return null
  }
}

export default MessageList