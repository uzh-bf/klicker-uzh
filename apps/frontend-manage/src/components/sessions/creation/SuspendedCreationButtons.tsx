import { useSuspenseQuery } from '@apollo/client'
import { UserProfileDocument } from '@klicker-uzh/graphql/dist/ops'

import {
  faChalkboardUser,
  faGraduationCap,
  faUserGroup,
  faUsersLine,
} from '@fortawesome/free-solid-svg-icons'
import { useTranslations } from 'next-intl'
import CreationButton from '../../sessions/creation/CreationButton'
import { WizardMode } from './SessionCreation'

interface CreationButtonsProps {
  setCreationMode: (mode: WizardMode) => void
}

function SuspendedCreationButtons({ setCreationMode }: CreationButtonsProps) {
  const t = useTranslations()

  const { data } = useSuspenseQuery(UserProfileDocument)

  return (
    <div className="grid gap-1 mb-4 md:grid-cols-4 md:gap-2">
      <CreationButton
        icon={faUsersLine}
        text={t('manage.questionPool.createLiveQuiz')}
        onClick={() => {
          setCreationMode(WizardMode.LiveSession)
        }}
        data={{ cy: 'create-live-quiz' }}
      />
      <CreationButton
        isCatalystRequired
        disabled={!data?.userProfile?.catalyst}
        icon={faChalkboardUser}
        text={t('manage.questionPool.createMicrolearning')}
        onClick={() => {
          setCreationMode(WizardMode.Microlearning)
        }}
        data={{ cy: 'create-microlearning' }}
      />
      <CreationButton
        isCatalystRequired
        disabled={!data?.userProfile?.catalyst}
        icon={faGraduationCap}
        text={t('manage.questionPool.createPracticeQuiz')}
        onClick={() => {
          setCreationMode(WizardMode.PracticeQuiz)
        }}
        data={{ cy: 'create-practice-quiz' }}
      />
      <CreationButton
        comingSoon
        isCatalystRequired
        disabled={true || !data?.userProfile?.catalyst}
        icon={faUserGroup}
        text={t('manage.questionPool.createGroupTask')}
        onClick={() => {
          setCreationMode(WizardMode.GroupActivity)
        }}
        data={{ cy: 'create-group-task' }}
      />
    </div>
  )
}

export default SuspendedCreationButtons
