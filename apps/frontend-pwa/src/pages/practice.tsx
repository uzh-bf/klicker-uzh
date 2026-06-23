import { faBookOpenReader } from '@fortawesome/free-solid-svg-icons'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H1, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Layout from '../components/Layout'
import LinkButton from '../components/common/LinkButton'
import { resetPracticeQuizLocalStorage } from '../components/practiceQuiz/PracticeQuiz'
import { trpc } from '../lib/trpc'

function Practice() {
  const t = useTranslations()
  const { data, error, isLoading } = trpc.participant.practiceCourses.useQuery()
  const practiceCourses = data?.practiceCourses

  return (
    <Layout
      course={{ displayName: 'KlickerUZH' }}
      displayName={t('shared.generic.practiceTitle')}
    >
      <div className="flex flex-col gap-2 md:mx-auto md:w-full md:max-w-xl md:rounded md:border md:p-8">
        <H1 className={{ root: 'text-xl' }}>
          {t('shared.generic.practiceTitle')}
        </H1>
        {isLoading && !practiceCourses ? <Loader /> : null}

        {error && !practiceCourses ? (
          <UserNotification
            type="error"
            message={t('shared.generic.systemError')}
          />
        ) : null}

        {error && practiceCourses ? (
          <UserNotification
            type="error"
            message={t('shared.generic.systemError')}
          />
        ) : null}

        {practiceCourses?.map((course) => {
          return (
            <LinkButton
              key={course.id}
              href={`/course/${course.id}/practice`}
              data={{ cy: 'practice-quiz' }}
              icon={faBookOpenReader}
              onClick={() => {
                // check the localstorage and delete all elements, which contain practiceQuiz.id
                resetPracticeQuizLocalStorage(course.id)
              }}
              legacyBehavior
            >
              {course.displayName}
            </LinkButton>
          )
        })}

        {!error && practiceCourses?.length === 0 && (
          <UserNotification
            type="info"
            message={t('pwa.practiceQuiz.noRepetition')}
          />
        )}
      </div>
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export default Practice
