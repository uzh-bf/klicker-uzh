import {
  faChalkboardUser,
  faGraduationCap,
  faUserGroup,
  faUsersLine,
} from '@fortawesome/free-solid-svg-icons'
import { Button } from '@uzh-bf/design-system'
import { ActivityType } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import CreationButton from './CreationButton'

interface CreationButtonsProps {
  setCreationMode: (mode: ActivityType) => void
  onCreateElement: () => void
}

function SuspendedCreationButtons({
  setCreationMode,
  onCreateElement,
}: CreationButtonsProps) {
  const t = useTranslations()

  return (
    <div className="pb-4" data-cy="activity-creation-choices">
      <div className="flex flex-col items-start gap-3 md:flex-row md:items-stretch md:gap-6">
        <div className="flex flex-col items-start gap-1">
          <span className="text-sm font-bold text-slate-700">
            {t('manage.questionPool.createElementaryLabel')}
          </span>
          <Button
            primary
            onClick={onCreateElement}
            data={{ cy: 'create-question' }}
            className={{ root: 'h-9 font-bold' }}
          >
            <Button.Label>
              {t('manage.questionPool.createElement')}
            </Button.Label>
          </Button>
        </div>
        <div
          aria-hidden="true"
          className="hidden w-px shrink-0 self-stretch bg-slate-200 md:block"
        />
        <div className="flex flex-col items-start gap-1">
          <span className="text-sm font-bold text-slate-700">
            {t('manage.questionPool.createActivitiesLabel')}
          </span>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
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
              description={t(
                'manage.questionPool.createMicrolearningDescription'
              )}
              data={{ cy: 'create-microlearning' }}
            />
            <CreationButton
              icon={faGraduationCap}
              text={t('manage.questionPool.createPracticeQuiz')}
              onClick={() => {
                setCreationMode(ActivityType.PracticeQuiz)
              }}
              description={t(
                'manage.questionPool.createPracticeQuizDescription'
              )}
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
        </div>
      </div>
    </div>
  )
}

export default SuspendedCreationButtons
