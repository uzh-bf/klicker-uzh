import {
  faBookOpen,
  faLightbulb,
  faUsers,
} from '@fortawesome/free-solid-svg-icons'
import { NewFormikTextField, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import PropertyList from '../PropertyList'
import { MicroLearningWizardStepProps } from './MicroLearningWizard'

function MicroLearningInformationStep(props: MicroLearningWizardStepProps) {
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
            message={t('manage.sessionForms.microLearningNoCourse')}
            className={{ root: 'mb-2' }}
          />
        ) : null}
        <div className="w-full md:pr-14">
          {t('manage.sessionForms.microLearningIntroductionName')}
        </div>
        <NewFormikTextField
          required
          autoComplete="off"
          name="name"
          label={t('manage.sessionForms.name')}
          tooltip={t('manage.sessionForms.microlearningName')}
          className={{
            root: 'mb-2 md:w-96',
            tooltip: 'z-20',
            label: 'text-base mb-0.5',
          }}
          data-cy="insert-microlearning-name"
        />
      </div>
      <div className="hidden md:flex flex-col gap-2 w-1/2 ml-1 p-3 border border-solid border-uzh-grey-80 bg-uzh-grey-20 rounded-md h-max">
        <PropertyList
          elements={[
            {
              key: 'microLearningUseCase',
              icon: faLightbulb,
              iconColor: 'text-orange-400',
              richText: t.rich('manage.sessionForms.microlearningUseCase', {
                link: (text) => (
                  <a
                    href="https://www.klicker.uzh.ch/use_cases/microlearning/"
                    target="_blank"
                    className="underline"
                  >
                    {text}
                  </a>
                ),
              }),
            },
            {
              key: 'microLearningLecturerDocs',
              icon: faBookOpen,
              iconColor: 'text-uzh-blue-100',
              richText: t.rich(
                'manage.sessionForms.microLearningLecturerDocs',
                {
                  link: (text) => (
                    <a
                      href="https://www.klicker.uzh.ch/tutorials/microlearning/"
                      target="_blank"
                      className="underline"
                    >
                      {text}
                    </a>
                  ),
                }
              ),
            },
            {
              key: 'microLearningStudentDocs',
              icon: faUsers,
              iconColor: 'text-black',
              richText: t.rich('manage.sessionForms.microLearningStudentDocs', {
                link: (text) => (
                  <a
                    href="https://www.klicker.uzh.ch/student_tutorials/microlearning/"
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

export default MicroLearningInformationStep