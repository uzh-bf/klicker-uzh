import {
  faChalkboardUser,
  faGraduationCap,
  faUserGroup,
  faUsersLine,
} from '@fortawesome/free-solid-svg-icons'
import { ActivityType } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import CreationButton from './CreationButton'

interface CreationButtonsProps {
  setCreationMode: (mode: ActivityType) => void
}

function createUseCaseLinkRenderer(href: string) {
  return function UseCaseLinkRenderer(chunks: ReactNode) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        {chunks}
      </a>
    )
  }
}

function SuspendedCreationButtons({ setCreationMode }: CreationButtonsProps) {
  const t = useTranslations()

  return (
    <div
      className="grid gap-1 pb-4 md:grid-cols-4 md:gap-2"
      data-cy="activity-creation-choices"
    >
      <CreationButton
        icon={faUsersLine}
        text={t('manage.questionPool.createLiveQuiz')}
        onClick={() => {
          setCreationMode(ActivityType.LiveQuiz)
        }}
        description={t.rich('manage.activityWizard.liveQuizUseCase', {
          link: createUseCaseLinkRenderer(
            'https://www.klicker.uzh.ch/use_cases/live_quiz/'
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
          link: createUseCaseLinkRenderer(
            'https://www.klicker.uzh.ch/use_cases/microlearning/'
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
          link: createUseCaseLinkRenderer(
            'https://www.klicker.uzh.ch/use_cases/practice_quiz/'
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
          link: createUseCaseLinkRenderer(
            'https://www.klicker.uzh.ch/use_cases/group_activity/'
          ),
        })}
        data={{ cy: 'create-group-activity' }}
      />
    </div>
  )
}

export default SuspendedCreationButtons
