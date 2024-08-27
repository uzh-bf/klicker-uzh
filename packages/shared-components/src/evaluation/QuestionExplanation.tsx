import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React from 'react'
import DynamicMarkdown from './DynamicMarkdown'

interface QuestionExplanationProps {
  explanation: string
}

function QuestionExplanation({ explanation }: QuestionExplanationProps) {
  const t = useTranslations()

  return (
    <UserNotification
      type="success"
      message=""
      className={{
        root: 'mb-2 flex flex-row items-center gap-3 px-3 text-base md:mb-4',
        content: 'mt-0',
      }}
    >
      <div className="font-bold">{t('shared.generic.explanation')}</div>
      <DynamicMarkdown
        className={{
          root: 'prose prose-sm prose-p:mb-1 prose-p:mt-0 max-w-none text-green-800',
        }}
        content={explanation}
      />
    </UserNotification>
  )
}

export default QuestionExplanation
