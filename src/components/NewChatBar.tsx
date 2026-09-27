import React, { useState, useCallback, type FormEvent } from 'react'
import styles from './NewChatBar.module.css'

/** Props для NewChatBar */
interface NewChatBarProps {
  /** Callback при создании чата: (phoneNumber) => void */
  onCreateChat: (phoneNumber: string) => void
  /** Тип провайдера для валидации номера */
  provider: 'max' | 'whatsapp' | 'telegram'
}

/** Компонент для ввода номера телефона и создания нового чата.
 * Валидирует формат номера в зависимости от провайдера.
 */
export default function NewChatBar({
  onCreateChat,
  provider,
}: NewChatBarProps) {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  /** Валидация номера телефона в зависимости от провайдера */
  const validatePhone = useCallback(
    (value: string): string | null => {
      const cleaned = value.replace(/\D/g, '')

      if (!cleaned) {
        return 'Введите номер телефона'
      }

      if (provider === 'max') {
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
      }

      // WhatsApp и Telegram: любой международный формат (E.164)
      // Минимум 10 цифр (код страны + номер)
      if (cleaned.length < 10) {
        return 'Номер слишком короткий. Введите в международном формате (например, 79001234567)'
      }

      return null
    },
    [provider],
  )

  /** Текст подсказки в зависимости от провайдера */
  const placeholderText =
    provider === 'max' ? '+7 (XXX) XXX-XX-XX' : '+<код страны><номер>'

  const helperText =
    provider === 'max'
      ? 'Формат: +7XXXXXXXXXX (Россия) или +375XXXXXXXXX (Беларусь)'
      : 'Формат: цифры с кодом страны без + (например, 79001234567 для РФ, 15551234567 для США)'

  const formatHint =
    provider === 'max'
      ? 'Убедитесь, что у получателя установлен MAX и номер зарегистрирован в GREEN-API'
      : `Убедитесь, что у получателя установлен ${provider.toUpperCase()} и номер зарегистрирован в GREEN-API`

  /** Обработка изменения ввода */
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Оставляем только цифры и + в начале
    const cleaned = value.replace(/[^\d+]/g, '').replace(/\+(?=.*\+)/g, '')
    setPhoneNumber(cleaned)
    setError(null)
  }, [])

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
    <div
      className={styles.container}
      role="region"
      aria-label="Создание нового чата"
    >
      <svg
        className={styles.icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>

      <h2 className={styles.title}>Новый чат</h2>
      <p className={styles.description}>
        Введите номер телефона получателя, чтобы начать переписку в{' '}
        {provider.toUpperCase()}
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
            placeholder={placeholderText}
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
              {helperText}
            </p>
          )}
        </div>

        <button
          type="submit"
          className={styles.btn}
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? 'Создание чата...' : 'Создать чат'}
        </button>
      </form>

      <p className={styles.formatHint}>{formatHint}</p>
    </div>
  )
}
