import { useQuery } from '@apollo/client'
import { faBookOpenReader } from '@fortawesome/free-solid-svg-icons'
import { GetPracticeCoursesDocument } from '@klicker-uzh/graphql/dist/ops'
import { H1, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Layout from '../components/Layout'
import LinkButton from '../components/common/LinkButton'
import { resetPracticeQuizLocalStorage } from '../components/practiceQuiz/PracticeQuiz'

function Practice() {
  const t = useTranslations()
  const { data } = useQuery(GetPracticeCoursesDocument)

  return (
    <Layout
      course={{ displayName: 'KlickerUZH' }}
      displayName={t('shared.generic.practiceTitle')}
    >
      <div className="flex flex-col gap-2 md:mx-auto md:w-full md:max-w-xl md:rounded md:border md:p-8">
        <H1 className={{ root: 'text-xl' }}>
          {t('shared.generic.practiceTitle')}
        </H1>
        {data?.getPracticeCourses?.map((course) => {
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

        {(!data?.getPracticeCourses ||
          data.getPracticeCourses.length === 0) && (
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
