import { faCopy } from '@fortawesome/free-solid-svg-icons'
import { PracticeQuiz } from '@klicker-uzh/graphql/dist/ops'
import { Button, Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

interface PracticeQuizAccessLinkProps {
  practiceQuiz: Partial<PracticeQuiz>
  href: string
}

function PracticeQuizAccessLink({
  practiceQuiz,
  href,
}: PracticeQuizAccessLinkProps) {
  const t = useTranslations()
  const [copyToast, setCopyToast] = useState(false)

  return (
    <div>
      <Button
        basic
        onClick={() => {
          try {
            navigator.clipboard.writeText(href)
            setCopyToast(true)
          } catch (e) {}
        }}
        className={{
          root: 'text-primary-100 hover:text-primary-100 h-7 py-0 text-sm',
        }}
        data={{ cy: `copy-quiz-link-${practiceQuiz.name}` }}
      >
        <Button.Icon icon={faCopy} />
        <Button.Label>{t('manage.course.copyAccessLink')}</Button.Label>
      </Button>
      <Toast
        dismissible
        openExternal={copyToast}
        onCloseExternal={() => setCopyToast(false)}
        type="success"
        duration={4000}
        className={{ root: 'w-[24rem]' }}
      >
        {t('manage.course.linkAccessCopied')}
      </Toast>
    </div>
  )
}

export default PracticeQuizAccessLink
