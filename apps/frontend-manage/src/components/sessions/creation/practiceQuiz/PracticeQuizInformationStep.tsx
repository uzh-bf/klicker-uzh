import {
  faBookOpen,
  faLightbulb,
  faUsers,
} from '@fortawesome/free-solid-svg-icons'
import { NewFormikTextField, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import PropertyList from '../PropertyList'
import { PracticeQuizWizardStepProps } from './PracticeQuizWizard'

function PracticeQuizInformationStep(props: PracticeQuizWizardStepProps) {
  const t = useTranslations()
  const noCourse =
    props.gamifiedCourses?.length === 0 &&
    props.nonGamifiedCourses?.length === 0

  return (
    <div className="flex flex-row">
      <div className="w-full md:w-1/2">
        {noCourse ? (
          <UserNotification
            type="error"
            message={t('manage.sessionForms.practiceQuizNoCourse')}
            className={{ root: 'mb-2' }}
          />
        ) : null}
        <div className="w-full md:pr-14">
          {t('manage.sessionForms.practiceQuizIntroductionName')}
        </div>
        <NewFormikTextField
          required
          autoComplete="off"
          name="name"
          label={t('manage.sessionForms.name')}
          tooltip={t('manage.sessionForms.practiceQuizName')}
          className={{
            root: 'mb-2 md:w-96',
            tooltip: 'z-20',
            label: 'text-base mb-0.5',
          }}
          data-cy="insert-practice-quiz-name"
        />
      </div>
      <div className="hidden md:flex flex-col gap-2 w-1/2 ml-1 p-3 border border-solid border-uzh-grey-80 bg-uzh-grey-20 rounded-md h-max">
        <PropertyList
          elements={[
            {
              icon: faLightbulb,
              iconColor: 'text-orange-400',
              richText: t.rich('manage.sessionForms.practiceQuizUseCase', {
                link: (text) => (
                  <a
                    href="https://www.klicker.uzh.ch/use_cases/practice_quiz/"
                    target="_blank"
                    className="underline"
                  >
                    {text}
                  </a>
                ),
              }),
            },
            {
              icon: faBookOpen,
              iconColor: 'text-uzh-blue-100',
              richText: t.rich('manage.sessionForms.practiceQuizLecturerDocs', {
                link: (text) => (
                  <a
                    href="https://www.klicker.uzh.ch/tutorials/practice_quiz/"
                    target="_blank"
                    className="underline"
                  >
                    {text}
                  </a>
                ),
              }),
            },
            {
              icon: faUsers,
              iconColor: 'text-black',
              richText: t.rich('manage.sessionForms.practiceQuizStudentDocs', {
                link: (text) => (
                  <a
                    href="https://www.klicker.uzh.ch/student_tutorials/practice_quiz/"
                    target="_blank"
                    className="underline"
                  >
                    {text}
                  </a>
                ),
              }),
            },
          ]}
        />
      </div>
    </div>
  )
}

export default PracticeQuizInformationStep
