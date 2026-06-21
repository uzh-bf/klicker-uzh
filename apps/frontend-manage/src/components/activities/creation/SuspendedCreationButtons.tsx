import {
  faChalkboardUser,
  faGraduationCap,
  faUserGroup,
  faUsersLine,
} from '@fortawesome/free-solid-svg-icons'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { ActivityType } from '../../../lib/constants/activityEnums'
import { trpc } from '../../../lib/trpc'
import CreationButton from './CreationButton'

interface CreationButtonsProps {
  setCreationMode: (mode: ActivityType) => void
}

function SuspendedCreationButtons({ setCreationMode }: CreationButtonsProps) {
  const t = useTranslations()

  const { data, error, isLoading } = trpc.user.profile.useQuery()
  const catalystDisabled = (isLoading && !data) || !data?.catalyst

  return (
    <div className="grid gap-1 pb-4 md:grid-cols-4 md:gap-2">
      {error ? (
        <UserNotification
          type="error"
          message={t('shared.generic.systemError')}
          className={{ root: 'py-1 md:col-span-4' }}
        />
      ) : null}
      <CreationButton
        icon={faUsersLine}
        text={t('manage.questionPool.createLiveQuiz')}
        onClick={() => {
          setCreationMode(ActivityType.LiveQuiz)
        }}
        data={{ cy: 'create-live-quiz' }}
      />
      <CreationButton
        isCatalystRequired
        disabled={catalystDisabled}
        icon={faChalkboardUser}
        text={t('manage.questionPool.createMicrolearning')}
        onClick={() => {
          setCreationMode(ActivityType.MicroLearning)
        }}
        data={{ cy: 'create-microlearning' }}
      />
      <CreationButton
        isCatalystRequired
        disabled={catalystDisabled}
        icon={faGraduationCap}
        text={t('manage.questionPool.createPracticeQuiz')}
        onClick={() => {
          setCreationMode(ActivityType.PracticeQuiz)
        }}
        data={{ cy: 'create-practice-quiz' }}
      />
      <CreationButton
        isCatalystRequired
        disabled={catalystDisabled}
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
