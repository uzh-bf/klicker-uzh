import {
  faChalkboardUser,
  faGraduationCap,
  faUserGroup,
  faUsersLine,
} from '@fortawesome/free-solid-svg-icons'
import { ActivityType } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import CreationButton from './CreationButton'

interface CreationButtonsProps {
  setCreationMode: (mode: ActivityType) => void
}

function SuspendedCreationButtons({ setCreationMode }: CreationButtonsProps) {
  const t = useTranslations()

  return (
    <section
      className="pb-4"
      data-cy="activity-creation-choices"
      aria-label={t('manage.questionPool.createActivitiesLabel')}
    >
      <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
        <CreationButton
          icon={faUsersLine}
          text={t('manage.questionPool.createLiveQuiz')}
          onClick={() => {
            setCreationMode(ActivityType.LiveQuiz)
          }}
          description={t('manage.questionPool.createLiveQuizDescription')}
          tooltipAlignment="start"
          data={{ cy: 'create-live-quiz' }}
        />
        <CreationButton
          icon={faChalkboardUser}
          text={t('manage.questionPool.createMicrolearning')}
          onClick={() => {
            setCreationMode(ActivityType.MicroLearning)
          }}
          description={t('manage.questionPool.createMicrolearningDescription')}
          data={{ cy: 'create-microlearning' }}
        />
        <CreationButton
          icon={faGraduationCap}
          text={t('manage.questionPool.createPracticeQuiz')}
          onClick={() => {
            setCreationMode(ActivityType.PracticeQuiz)
          }}
          description={t('manage.questionPool.createPracticeQuizDescription')}
          data={{ cy: 'create-practice-quiz' }}
        />
        <CreationButton
          icon={faUserGroup}
          text={t('manage.questionPool.createGroupTask')}
          onClick={() => {
            setCreationMode(ActivityType.GroupActivity)
          }}
          description={t('manage.questionPool.createGroupTaskDescription')}
          tooltipAlignment="end"
          data={{ cy: 'create-group-activity' }}
        />
      </div>
    </section>
  )
}

export default SuspendedCreationButtons
