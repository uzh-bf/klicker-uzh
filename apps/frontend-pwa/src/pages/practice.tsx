import { useQuery } from '@apollo/client'
import { faBookOpenReader, faRepeat } from '@fortawesome/free-solid-svg-icons'
import { GetPracticeQuizListWithPersonalElementsDocument } from '@klicker-uzh/graphql/dist/ops'
import { H1, H2, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Layout from '../components/Layout'
import LinkButton from '../components/common/LinkButton'
import { resetPracticeQuizLocalStorage } from '../components/practiceQuiz/PracticeQuiz'

function Practice() {
  const t = useTranslations()
  const { data } = useQuery(GetPracticeQuizListWithPersonalElementsDocument)

  return (
    <Layout
      course={{ displayName: 'KlickerUZH' }}
      displayName={t('shared.generic.practiceTitle')}
    >
      <div className="flex flex-col gap-2 md:mx-auto md:w-full md:max-w-xl md:rounded md:border md:p-8">
        <H1 className={{ root: 'text-xl' }}>
          {t('shared.generic.practiceTitle')}
        </H1>
        {data?.getPracticeQuizList?.map((course) => (
          <div key={course.id} className="flex flex-col gap-2">
            <H2 className={{ root: 'text-lg' }}>{course.displayName}</H2>
            <LinkButton
              href={`/course/${course.id}/practice`}
              data={{ cy: `lecturer-elements-course-${course.id}` }}
              icon={faBookOpenReader}
              onClick={() => {
                resetPracticeQuizLocalStorage(course.id)
              }}
            >
              {t('pwa.personalElements.lecturerElements')}
            </LinkButton>
            <LinkButton
              href={`/course/${course.id}/personal`}
              data={{ cy: `own-elements-course-${course.id}` }}
              icon={faRepeat}
            >
              {t('pwa.personalElements.ownElements', {
                count: course.personalDueCount ?? 0,
              })}
            </LinkButton>
          </div>
        ))}

        {(!data?.getPracticeQuizList ||
          data.getPracticeQuizList.length === 0) && (
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
