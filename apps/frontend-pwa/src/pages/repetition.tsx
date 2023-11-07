import { useQuery } from '@apollo/client'
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
import CourseCollapsible, {
  RepetitionElementType,
} from '../components/practiceQuiz/CourseCollapsible'

function Repetition() {
  const { data: learningElementsData } = useQuery(GetLearningElementsDocument)
  const { data: practiceQuizzesData } = useQuery(GetPracticeQuizzesDocument)
  const t = useTranslations()

  //
  const learningElementsByCourse:
    | Record<string, [LearningElement, RepetitionElementType][]>
    | undefined = learningElementsData?.learningElements?.reduce(
    (acc, element) => {
      return {
        ...acc,
        [element.course!.displayName]: [
          ...(acc[element.course!.displayName] || []),
          [element, RepetitionElementType.LEARNING_ELEMENT],
        ],
      }
    },
    {}
  )

  const elementsByCourse:
    | Record<string, [LearningElement | PracticeQuiz, RepetitionElementType][]>
    | undefined = practiceQuizzesData?.practiceQuizzes?.reduce(
    (acc, element) => {
      return {
        ...acc,
        [element.course!.displayName]: [
          ...(acc?.[element.course!.displayName] || []),
          [element, RepetitionElementType.PRACTICE_QUIZ],
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
      <div className="flex flex-col gap-4 md:w-full md:max-w-xl md:p-8 md:mx-auto md:border md:rounded">
        <H1 className={{ root: 'text-xl' }}>
          {t('shared.generic.repetition')}
        </H1>
        {elementsByCourse &&
          Object.entries(elementsByCourse).map(([key, elements]) => (
            <CourseCollapsible
              key={`list-${key}`}
              courseName={key}
              elements={elements}
            />
          ))}

        {(!learningElementsData?.learningElements ||
          learningElementsData?.learningElements?.length === 0) &&
          (!practiceQuizzesData?.practiceQuizzes ||
            practiceQuizzesData.practiceQuizzes.length === 0) && (
            <UserNotification
              type="info"
              // TODO: change message to no courses available
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
