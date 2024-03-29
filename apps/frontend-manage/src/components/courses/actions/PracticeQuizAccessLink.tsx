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
          root: 'flex flex-row items-center gap-1 text-primary',
        }}
        data={{ cy: `copy-practice-quiz-link-${practiceQuiz.name}` }}
      >
        <FontAwesomeIcon icon={faCopy} size="sm" className="w-4" />
        <div>{t('manage.course.copyAccessLink')}</div>
      </Button>
      <Toast
        openExternal={copyToast}
        setOpenExternal={setCopyToast}
        type="success"
        className={{ root: 'w-[24rem]' }}
      >
        {t('manage.course.linkPracticeQuizCopied')}
      </Toast>
    </>
  )
}

export default PracticeQuizAccessLink
