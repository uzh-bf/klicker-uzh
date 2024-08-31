import { WizardMode } from '@components/sessions/creation/ElementCreation'
import { faCopy } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useTranslations } from 'next-intl'
import { NextRouter } from 'next/router'

interface GetLiveQuizDuplicationActionProps {
  id: string
  name: string
  t: ReturnType<typeof useTranslations>
  router: NextRouter
}

function getLiveQuizDuplicationAction({
  id,
  name,
  t,
  router,
}: GetLiveQuizDuplicationActionProps) {
  return {
    label: (
      <div className="text-primary-100 flex cursor-pointer flex-row items-center gap-2">
        <FontAwesomeIcon icon={faCopy} />
        <div>{t('manage.sessions.duplicateSession')}</div>
      </div>
    ),
    onClick: () =>
      router.push({
        pathname: '/',
        query: {
          elementId: id,
          duplicationMode: WizardMode.LiveQuiz,
        },
      }),
    data: { cy: `duplicate-live-quiz-${name}` },
  }
}

export default getLiveQuizDuplicationAction
