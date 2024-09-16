import { faCopy } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
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
    <>
      <Button
        basic
        onClick={() => {
          try {
            navigator.clipboard.writeText(href)
            setCopyToast(true)
          } catch (e) {}
        }}
        className={{
          root: 'text-primary-100 flex flex-row items-center gap-1',
        }}
        data={{ cy: `copy-quiz-link-${practiceQuiz.name}` }}
      >
        <FontAwesomeIcon icon={faCopy} size="sm" className="w-4" />
        <div>{t('manage.course.copyAccessLink')}</div>
      </Button>
      <Toast
        dismissible
        openExternal={copyToast}
        setOpenExternal={setCopyToast}
        type="success"
        duration={4000}
        className={{ root: 'w-[24rem]' }}
      >
        {t('manage.course.linkAccessCopied')}
      </Toast>
    </>
  )
}

export default PracticeQuizAccessLink
