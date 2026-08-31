import { ActivityType } from '@klicker-uzh/graphql/dist/ops'
import {
  faChalkboardUser,
  faGraduationCap,
  faUserGroup,
  faUsersLine,
} from '@fortawesome/free-solid-svg-icons'
import { useTranslations } from 'next-intl'
import { featureTargetProps } from '../../onboarding/featureTargets'
import CreationButton from './CreationButton'

interface CreationButtonsProps {
  setCreationMode: (mode: ActivityType) => void
}

function SuspendedCreationButtons({ setCreationMode }: CreationButtonsProps) {
  const t = useTranslations()

  return (
    // The onboarding tour points at the group rather than at one button: the
    // step is about the four activity types existing, not about picking one.
    <div
      className="grid gap-1 pb-4 md:grid-cols-4 md:gap-2"
      {...featureTargetProps('manage-home-activity-types')}
    >
      <CreationButton
        icon={faUsersLine}
        text={t('manage.questionPool.createLiveQuiz')}
        onClick={() => {
          setCreationMode(ActivityType.LiveQuiz)
        }}
        data={{ cy: 'create-live-quiz' }}
      />
      <CreationButton
        icon={faChalkboardUser}
        text={t('manage.questionPool.createMicrolearning')}
        onClick={() => {
          setCreationMode(ActivityType.MicroLearning)
        }}
        data={{ cy: 'create-microlearning' }}
      />
      <CreationButton
        icon={faGraduationCap}
        text={t('manage.questionPool.createPracticeQuiz')}
        onClick={() => {
          setCreationMode(ActivityType.PracticeQuiz)
        }}
        data={{ cy: 'create-practice-quiz' }}
      />
      <CreationButton
        icon={faUserGroup}
        text={t('manage.questionPool.createGroupTask')}
        onClick={() => {
          setCreationMode(ActivityType.GroupActivity)
        }}
        data={{ cy: 'create-group-activity' }}
      />
    </div>
  )
}

export default SuspendedCreationButtons
