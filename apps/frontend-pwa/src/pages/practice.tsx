import { useQuery } from '@apollo/client'
import LinkButton from '@components/common/LinkButton'
import { faBookOpenReader } from '@fortawesome/free-solid-svg-icons'
import { ParticipationsDocument } from '@klicker-uzh/graphql/dist/ops'
import { H1, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Layout from '../components/Layout'
import { resetPracticeQuizLocalStorage } from '../components/practiceQuiz/PracticeQuiz'

function Practice() {
  const t = useTranslations()

  const { data, loading } = useQuery(ParticipationsDocument, {
    fetchPolicy: 'cache-first',
  })

  return (
    <Layout
      course={{ displayName: 'KlickerUZH' }}
      displayName={t('shared.generic.practiceTitle')}
    >
      <div className="flex flex-col gap-2 md:w-full md:max-w-xl md:p-8 md:mx-auto md:border md:rounded">
        <H1 className={{ root: 'text-xl' }}>
          {t('shared.generic.practiceTitle')}
        </H1>
        {data?.participations?.flatMap((participation) => {
          if (!participation.course) return []
          return (
            <LinkButton
              key={participation.id}
              href={`/course/${participation.course.id}/practice`}
              data={{ cy: 'practice-quiz' }}
              icon={faBookOpenReader}
              onClick={() => {
                // check the localstorage and delete all elements, which contain practiceQuiz.id
                resetPracticeQuizLocalStorage(participation.course!.id)
              }}
              legacyBehavior
            >
              {participation.course.displayName}
            </LinkButton>
          )
        })}

        {(!data?.participations || data.participations.length === 0) && (
          <UserNotification
            type="info"
            message={t('pwa.learningElement.noRepetition')}
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
