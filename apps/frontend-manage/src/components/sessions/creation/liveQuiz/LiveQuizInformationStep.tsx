import {
  faBookOpen,
  faLightbulb,
  faUsers,
} from '@fortawesome/free-solid-svg-icons'
import { NewFormikTextField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import PropertyList from '../PropertyList'
import { LiveQuizWizardStepProps } from './LiveSessionWizard'

function LiveQuizInformationStep(_: LiveQuizWizardStepProps) {
  const t = useTranslations()

  return (
    <div className="flex flex-row">
      <div className="w-full md:w-1/2">
        <div className="w-full md:pr-14">
          {t('manage.sessionForms.liveQuizIntroductionName')}
        </div>
        <NewFormikTextField
          required
          autoComplete="off"
          name="name"
          label={t('manage.sessionForms.name')}
          tooltip={t('manage.sessionForms.liveQuizName')}
          className={{
            root: 'mb-2 md:w-96',
            tooltip: 'z-20',
            label: 'text-base mb-0.5',
          }}
          data-cy="insert-live-quiz-name"
          shouldValidate={() => true}
        />
      </div>
      <div className="hidden md:flex flex-col gap-2 w-1/2 ml-1 p-3 border border-solid border-uzh-grey-80 bg-uzh-grey-20 rounded-md">
        <PropertyList
          elements={[
            {
              key: 'liveQuizUseCase',
              icon: faLightbulb,
              iconColor: 'text-orange-400',
              richText: t.rich('manage.sessionForms.liveQuizUseCase', {
                link: (text) => (
                  <a
                    href="https://www.klicker.uzh.ch/use_cases/live_quiz/"
                    target="_blank"
                    className="underline"
                  >
                    {text}
                  </a>
                ),
              }),
            },
            {
              key: 'liveQuizLecturerDocs',
              icon: faBookOpen,
              iconColor: 'text-uzh-blue-100',
              richText: t.rich('manage.sessionForms.liveQuizLecturerDocs', {
                link: (text) => (
                  <a
                    href="https://www.klicker.uzh.ch/tutorials/live_quiz/"
                    target="_blank"
                    className="underline"
                  >
                    {text}
                  </a>
                ),
              }),
            },
            {
              key: 'liveQuizStudentDocs',
              icon: faUsers,
              iconColor: 'text-black',
              richText: t.rich('manage.sessionForms.liveQuizStudentDocs', {
                link: (text) => (
                  <a
                    href="https://www.klicker.uzh.ch/student_tutorials/live_quiz/"
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

export default LiveQuizInformationStep
