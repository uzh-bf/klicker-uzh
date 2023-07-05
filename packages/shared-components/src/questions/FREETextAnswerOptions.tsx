import { ThemeContext } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { useContext } from 'react'
import { twMerge } from 'tailwind-merge'
import ContentInput from '../ContentInput'

export interface FREETextAnswerOptionsProps {
  placeholder?: string
  maxLength?: number
  onChange: (value: any) => any
  value: string
}

export function FREETextAnswerOptions({
  placeholder,
  maxLength,
  onChange,
  value,
}: FREETextAnswerOptionsProps): React.ReactElement {
  const theme = useContext(ThemeContext)
  const t = useTranslations()

  return (
    <div className="flex flex-col gap-2">
      <ContentInput
        className={{
          root: twMerge(
            'rounded focus:border focus:border-solid',
            theme.primaryBorderDarkFocus
          ),
        }}
        content={value}
        onChange={onChange}
        placeholder={placeholder || t('shared.questions.ftPlaceholder')}
        data_cy="free-text-response-input"
        touched={false}
        toolbar={{
          texInline: true,
          ol: true,
          ul: true,
          undo: true,
          redo: true,
        }}
      />

      <div className="text-sm italic text-right">
        ({value?.length ?? 0} / {maxLength ?? '1500'}{' '}
        {t('shared.generic.characters')})
      </div>
    </div>
  )
}

export default FREETextAnswerOptions
