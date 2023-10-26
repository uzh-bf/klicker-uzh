import { useQuery } from '@apollo/client'
import { resetPracticeQuizLocalStorage } from '@components/practiceQuiz/PracticeQuiz'
import { faBookOpenReader } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ParticipationsDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, H1, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import Layout from '../components/Layout'

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
            <Link
              key={participation.id}
              href={`/course/${participation.course.id}/practice`}
              legacyBehavior
            >
              <Button
                className={{
                  root: twMerge(
                    'gap-6 px-4 py-2 text-lg shadow bg-uzh-grey-20 sm:hover:bg-uzh-grey-40'
                  ),
                }}
                data={{ cy: 'practice-quiz' }}
                onClick={() => {
                  // check the localstorage and delete all elements, which contain practiceQuiz.id
                  resetPracticeQuizLocalStorage(participation.course!.id)
                }}
              >
                <Button.Icon>
                  <FontAwesomeIcon icon={faBookOpenReader} />
                </Button.Icon>
                <Button.Label className={{ root: 'flex-1 text-left' }}>
                  <div>{participation.course.displayName}</div>
                </Button.Label>
              </Button>
            </Link>
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
