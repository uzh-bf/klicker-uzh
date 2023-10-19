import { useQuery } from '@apollo/client'
import { faBookOpenReader } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetLearningElementsDocument,
  GetPracticeQuizzesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H1, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import Layout from '../components/Layout'

function Repetition() {
  const { data: learningElementsData } = useQuery(GetLearningElementsDocument)
  const { data: practiceQuizzesData } = useQuery(GetPracticeQuizzesDocument)
  const t = useTranslations()

  console.log('practiceQuizzes: ', practiceQuizzesData?.practiceQuizzes)

  return (
    <Layout
      course={{ displayName: 'KlickerUZH' }}
      displayName={t('pwa.learningElement.repetitionTitle')}
    >
      <div className="flex flex-col gap-2 md:w-full md:max-w-xl md:p-8 md:mx-auto md:border md:rounded">
        <H1 className={{ root: 'text-xl' }}>
          {t('shared.generic.repetition')}
        </H1>
        {learningElementsData?.learningElements?.map((element) => (
          <Link
            key={element.id}
            href={`/course/${element.courseId}/element/${element.id}`}
            legacyBehavior
          >
            <Button
              className={{
                root: twMerge(
                  'gap-6 px-4 py-2 text-lg shadow bg-uzh-grey-20 sm:hover:bg-uzh-grey-40'
                ),
              }}
              data={{ cy: 'repetition-element' }}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faBookOpenReader} />
              </Button.Icon>
              <Button.Label className={{ root: 'flex-1 text-left' }}>
                <div>{element.displayName}</div>
              </Button.Label>
            </Button>
          </Link>
        ))}
        {practiceQuizzesData?.practiceQuizzes?.map((practiceQuiz) => (
          <Link
            key={practiceQuiz.id}
            href={`/course/${practiceQuiz.courseId}/element/${practiceQuiz.id}`}
            legacyBehavior
          >
            <Button
              className={{
                root: twMerge(
                  'gap-6 px-4 py-2 text-lg shadow bg-uzh-grey-20 sm:hover:bg-uzh-grey-40'
                ),
              }}
              data={{ cy: 'repetition-element' }}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faBookOpenReader} />
              </Button.Icon>
              <Button.Label className={{ root: 'flex-1 text-left' }}>
                <div>{practiceQuiz.displayName}</div>
              </Button.Label>
            </Button>
          </Link>
        ))}
        {(!learningElementsData?.learningElements ||
          learningElementsData?.learningElements?.length === 0) &&
          (!practiceQuizzesData?.practiceQuizzes ||
            practiceQuizzesData.practiceQuizzes.length === 0) && (
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

export default Repetition
