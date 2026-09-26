import React, { useState, useCallback, type FormEvent } from 'react'
import styles from './NewChatBar.module.css'

/** Props для NewChatBar */
interface NewChatBarProps {
  /** Callback при создании чата: (phoneNumber) => void */
  onCreateChat: (phoneNumber: string) => void
}

/** Компонент для ввода номера телефона и создания нового чата.
 * Валидирует формат номера (RU +7 или BY +375 для MAX).
 */
export default function NewChatBar({ onCreateChat }: NewChatBarProps) {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  /** Валидация номера телефона для MAX */
  const validatePhone = useCallback((value: string): string | null => {
    const cleaned = value.replace(/\D/g, '')

    if (!cleaned) {
      return 'Введите номер телефона'
    }

    // MAX поддерживает только RU (7) и BY (375)
    if (cleaned.startsWith('7')) {
      if (cleaned.length !== 11) {
        return 'Номер России должен содержать 11 цифр (7XXXXXXXXXX)'
      }
      return null
    }

    if (cleaned.startsWith('375')) {
      if (cleaned.length !== 12) {
        return 'Номер Беларуси должен содержать 12 цифр (375XXXXXXXXX)'
      }
      return null
    }

    return 'Для MAX поддерживаются только номера России (+7) и Беларуси (+375)'
  }, [])

  /** Обработка изменения ввода */
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      // Оставляем только цифры и + в начале
      const cleaned = value.replace(/[^\d+]/g, '').replace(/\+(?=.*\+)/g, '')
      setPhoneNumber(cleaned)
      setError(null)
    },
    [],
  )

  /** Обработка отправки формы */
  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      const validationError = validatePhone(phoneNumber)
      if (validationError) {
        setError(validationError)
        return
      }

      setIsSubmitting(true)
      try {
        // Передаём очищенный номер (только цифры)
        const cleaned = phoneNumber.replace(/\D/g, '')
        await onCreateChat(cleaned)
      } finally {
        setIsSubmitting(false)
      }
    },
    [phoneNumber, validatePhone, onCreateChat],
  )

  return (
    <div className={styles.container} role="region" aria-label="Создание нового чата">
      <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>

      <h2 className={styles.title}>Новый чат</h2>
      <p className={styles.description}>
        Введите номер телефона получателя, чтобы начать переписку в MAX
      </p>

      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <div className={styles.inputWrapper}>
          <label htmlFor="phoneNumber" className={styles.label}>
            Номер телефона
          </label>
          <input
            id="phoneNumber"
            type="tel"
            className={`${styles.input} ${error ? styles.inputError : ''}`}
            value={phoneNumber}
            onChange={handleChange}
            placeholder="+7 (XXX) XXX-XX-XX"
            disabled={isSubmitting}
            aria-describedby={error ? 'phone-error' : 'phone-hint'}
            aria-invalid={!!error}
            autoComplete="tel"
            inputMode="tel"
          />
          {error ? (
            <p id="phone-error" className={styles.errorText} role="alert">
              {error}
            </p>
          ) : (
            <p id="phone-hint" className={styles.helperText}>
              Формат: +7XXXXXXXXXX (Россия) или +375XXXXXXXXX (Беларусь)
            </p>
          )}
        </div>

        <button type="submit" className={styles.btn} disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? 'Создание чата...' : 'Создать чат'}
        </button>
      </form>

      <p className={styles.formatHint}>
        Убедитесь, что у получателя установлен MAX и номер зарегистрирован в GREEN-API
      </p>
    </div>
  )
}