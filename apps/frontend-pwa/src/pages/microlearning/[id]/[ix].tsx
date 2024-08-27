import { useQuery } from '@apollo/client'
import {
  ElementStack as ElementStackType,
  GetMicroLearningDocument,
  SelfDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Progress } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useRouter } from 'next/router'
import { twMerge } from 'tailwind-merge'
import Layout from '../../../components/Layout'
import ElementStack from '../../../components/practiceQuiz/ElementStack'

function MicrolearningInstance() {
  const router = useRouter()
  const ix = parseInt(router.query.ix as string)
  const id = router.query.id as string

  const { loading, error, data } = useQuery(GetMicroLearningDocument, {
    variables: { id },
    skip: !id,
  })
  const { data: selfData } = useQuery(SelfDocument)

  if (loading || !data?.microLearning) {
    return <Loader />
  }

  const microlearning = data.microLearning

  // throw error if length of stacks is smaller than number
  if (!microlearning.stacks || !(ix <= (microlearning.stacks.length || -1))) {
    throw new Error('Stack not found')
  }

  const currentStack = microlearning.stacks[ix]

  if (!currentStack) {
    throw new Error('Stack not found')
  }

  return (
    <Layout
      displayName={microlearning.displayName}
      course={microlearning.course ?? undefined}
    >
      <div className="flex-1">
        <div
          className={twMerge(
            'w-full space-y-4 md:mx-auto md:mb-4 md:max-w-6xl md:rounded md:border md:p-8 md:pt-6'
          )}
        >
          <Progress
            isMaxVisible
            formatter={(v) => v}
            value={ix + 1}
            max={(microlearning?.stacks?.length ?? -1) + 1}
          />
          <ElementStack
            key={currentStack.id}
            parentId={microlearning.id}
            courseId={microlearning.course!.id}
            // TODO: fix this issue where pointsMultiplier might not be defined on flashcards and content elements
            stack={currentStack as ElementStackType}
            currentStep={ix + 1}
            totalSteps={microlearning.stacks?.length ?? 0}
            handleNextElement={() =>
              router.push(`/microlearning/${id}/${ix + 1}`)
            }
            onAllStacksCompletion={() =>
              // TODO: also mark the microlearning as completed with this action already?
              router.push(`/microlearning/${id}/evaluation`)
            }
            withParticipant={!!selfData?.self}
            hideBookmark
          />
        </div>
      </div>
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
    revalidate: 600,
  }
}

export function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default MicrolearningInstance
