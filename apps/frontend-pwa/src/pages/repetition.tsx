import { useQuery } from '@apollo/client'
import LinkButton from '@components/common/LinkButton'
import { faBookOpenReader } from '@fortawesome/free-solid-svg-icons'
import {
  GetLearningElementsDocument,
  GetPracticeQuizzesDocument,
  LearningElement,
  PracticeQuiz,
} from '@klicker-uzh/graphql/dist/ops'
import { H1, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Layout from '../components/Layout'

function Repetition() {
  const { data: learningElementsData } = useQuery(GetLearningElementsDocument)
  const { data: practiceQuizzesData } = useQuery(GetPracticeQuizzesDocument)
  const t = useTranslations()

  //
  const learningElementsByCourse:
    | Record<string, LearningElement[]>
    | undefined = learningElementsData?.learningElements?.reduce(
    (acc, element) => {
      return {
        ...acc,
        [element.course!.displayName]: [
          ...(acc[element.course!.displayName] || []),
          element,
        ],
      }
    },
    {}
  )

  const elementsByCourse:
    | Record<string, (LearningElement | PracticeQuiz)[]>
    | undefined = practiceQuizzesData?.practiceQuizzes?.reduce(
    (acc, element) => {
      return {
        ...acc,
        [element.course!.displayName]: [
          ...(acc?.[element.course!.displayName] || []),
          element,
        ],
      }
    },
    learningElementsByCourse
  )

  return (
    <Layout
      course={{ displayName: 'KlickerUZH' }}
      displayName={t('pwa.learningElement.repetitionTitle')}
    >
      <div className="flex flex-col gap-2 md:w-full md:max-w-xl md:p-8 md:mx-auto md:border md:rounded">
        <H1 className={{ root: 'text-xl' }}>
          {t('shared.generic.repetition')}
        </H1>
        {elementsByCourse &&
          Object.entries(elementsByCourse).map(([key, element]) => (
            <div key={`list-${key}`}>
              <div>{key}</div>
              <div className="flex flex-col gap-2">
                {element.map((element) => (
                  <LinkButton
                    key={element.id}
                    icon={faBookOpenReader}
                    href=""
                    data={{ cy: 'practice-quiz' }}
                  >
                    {element.displayName}
                  </LinkButton>
                ))}
              </div>
            </div>
          ))}
        {/* {learningElementsData?.learningElements?.map((element) => (
          <Link
            key={element.id}
            href={`/course/${element.course!.id}/element/${element.id}`}
            legacyBehavior
          >
            <Button
              className={{
                root: twMerge(
                  'gap-6 px-4 py-2 text-lg shadow bg-uzh-grey-20 sm:hover:bg-uzh-grey-40'
                ),
              }}
              data={{ cy: 'practice-quiz' }}
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
            href={`/course/${practiceQuiz.course!.id}/quiz/${practiceQuiz.id}`}
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
                const localStorageKeys = Object.keys(localStorage)
                localStorageKeys.forEach((key) => {
                  if (key.includes(practiceQuiz.id)) {
                    localStorage.removeItem(key)
                  }
                })
              }}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faBookOpenReader} />
              </Button.Icon>
              <Button.Label className={{ root: 'flex-1 text-left' }}>
                <div>{practiceQuiz.displayName}</div>
              </Button.Label>
            </Button>
          </Link>
        ))} */}
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
