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
    <div className="grid gap-1 pb-4 md:grid-cols-4 md:gap-2">
      <CreationButton
        icon={faUsersLine}
        text={t('manage.questionPool.createLiveQuiz')}
        onClick={() => {
          setCreationMode(ActivityType.LiveQuiz)
        }}
        description={t.rich('manage.activityWizard.liveQuizUseCase', {
          link: (chunks) => (
            <a href="https://www.klicker.uzh.ch/use_cases/live_quiz/">
              {chunks}
            </a>
          ),
        })}
        data={{ cy: 'create-live-quiz' }}
      />
      <CreationButton
        icon={faChalkboardUser}
        text={t('manage.questionPool.createMicrolearning')}
        onClick={() => {
          setCreationMode(ActivityType.MicroLearning)
        }}
        description={t.rich('manage.activityWizard.microlearningUseCase', {
          link: (chunks) => (
            <a href="https://www.klicker.uzh.ch/use_cases/microlearning/">
              {chunks}
            </a>
          ),
        })}
        data={{ cy: 'create-microlearning' }}
      />
      <CreationButton
        icon={faGraduationCap}
        text={t('manage.questionPool.createPracticeQuiz')}
        onClick={() => {
          setCreationMode(ActivityType.PracticeQuiz)
        }}
        description={t.rich('manage.activityWizard.practiceQuizUseCase', {
          link: (chunks) => (
            <a href="https://www.klicker.uzh.ch/use_cases/practice_quiz/">
              {chunks}
            </a>
          ),
        })}
        data={{ cy: 'create-practice-quiz' }}
      />
      <CreationButton
        icon={faUserGroup}
        text={t('manage.questionPool.createGroupTask')}
        onClick={() => {
          setCreationMode(ActivityType.GroupActivity)
        }}
        description={t.rich('manage.activityWizard.groupActivityUseCase', {
          link: (chunks) => (
            <a href="https://www.klicker.uzh.ch/use_cases/group_activity/">
              {chunks}
            </a>
          ),
        })}
        data={{ cy: 'create-group-activity' }}
      />
    </div>
  )
}

export default SuspendedCreationButtons
