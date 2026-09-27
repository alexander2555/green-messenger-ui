import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  type KeyboardEvent,
} from 'react'
import styles from './MessageInput.module.css'

/** Props для MessageInput */
interface MessageInputProps {
  /** Callback при отправке: (text) => void */
  onSend: (text: string) => void
  /** Отключить ввод и отправку */
  disabled?: boolean
}

/** Компонент ввода сообщения.
 * Enter — отправка, Shift+Enter — новая строка.
 * Авто-ресайз по высоте контента (до max-height).
 */
export default function MessageInput({
  onSend,
  disabled = false,
}: MessageInputProps) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  /** Авто-ресайз textarea */
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`
  }, [])

  useEffect(() => {
    adjustHeight()
  }, [text, adjustHeight])

  /** Отправка сообщения */
  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (trimmed && !disabled) {
      onSend(trimmed)
      setText('')
      // Ресайз после очистки
      setTimeout(adjustHeight, 0)
    }
  }, [text, disabled, onSend, adjustHeight])

  /** Обработка клавиатуры */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  /** Обработка изменения текста */
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value)
    },
    [],
  )

  return (
    <div className={styles.container}>
      <div className={styles.inputWrapper}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? 'Выберите чат для отправки сообщений'
              : 'Введите сообщение...'
          }
          aria-label="Текст сообщения"
          aria-describedby="input-hint"
          rows={1}
        />
        <p id="input-hint" className={styles.hint}>
          Enter — отправить, Shift+Enter — новая строка
        </p>
      </div>
      <button
        className={styles.btnSend}
        onClick={handleSend}
        disabled={disabled || text.trim() === ''}
        aria-label="Отправить сообщение"
        aria-disabled={disabled || text.trim() === ''}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  )
}
