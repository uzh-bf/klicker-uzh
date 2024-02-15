import { useQuery } from '@apollo/client'
import {
  GetMicrolearningDocument,
  SelfDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Progress } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useRouter } from 'next/router'
import { twMerge } from 'tailwind-merge'
import ElementStack from '../../../components/practiceQuiz/ElementStack'

function MicrolearningInstance() {
  const router = useRouter()
  const ix = parseInt(router.query.ix as string)
  const id = router.query.id as string

  const { loading, error, data } = useQuery(GetMicrolearningDocument, {
    variables: { id },
    skip: !id,
  })
  const { data: selfData } = useQuery(SelfDocument)

  if (loading || !data?.microlearning) {
    return <Loader />
  }

  const microlearning = data.microlearning

  // throw error if length of stacks is smaller than number
  if (!microlearning.stacks || !(ix <= (microlearning.stacks.length || -1))) {
    throw new Error('Stack not found')
  }

  const currentStack = microlearning.stacks[ix]

  if (!currentStack) {
    throw new Error('Stack not found')
  }

  return (
    <div className="flex-1">
      <div
        className={twMerge(
          'space-y-4 md:max-w-6xl md:mx-auto md:mb-4 md:p-8 md:pt-6 md:border md:rounded w-full'
        )}
      >
        <Progress
          isMaxVisible
          formatter={(v) => v}
          value={ix + 1}
          max={(data.microlearning?.stacks?.length ?? -1) + 1}
        />
        <ElementStack
          parentId={microlearning.id}
          courseId={microlearning.course!.id}
          // TODO: fix this issue where pointsMultiplier might not be defined on flashcards and content elements
          stack={currentStack}
          currentStep={ix + 1}
          totalSteps={microlearning.stacks?.length ?? 0}
          handleNextElement={() =>
            router.push(`/microlearning/${id}/${ix + 1}`)
          }
          onAllStacksCompletion={() =>
            router.push(`/microlearning/${id}/evaluation`)
          }
          withParticipant={!!selfData?.self}
          hideBookmark
        />
      </div>
    </div>
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
