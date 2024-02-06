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
        root: 'text-base flex flex-row items-center mb-2 md:mb-4 gap-3 px-3',
        content: 'mt-0',
      }}
    >
      <div className="font-bold">{t('shared.generic.explanation')}</div>
      <DynamicMarkdown
        className={{
          root: 'prose prose-sm max-w-none text-green-800 prose-p:mt-0 prose-p:mb-1',
        }}
        content={explanation}
      />
    </UserNotification>
  )
}

export default QuestionExplanation
