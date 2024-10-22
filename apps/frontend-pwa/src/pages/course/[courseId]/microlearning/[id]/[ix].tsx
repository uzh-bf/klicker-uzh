import { useQuery } from '@apollo/client'
import {
  GetMicroLearningDocument,
  SelfDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Progress, Toast } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import Layout from '../../../../../components/Layout'
import MicroLearningSubscriber from '../../../../../components/microLearning/MicroLearningSubscriber'
import ElementStack from '../../../../../components/practiceQuiz/ElementStack'

function MicrolearningInstance() {
  const t = useTranslations()
  const router = useRouter()
  const ix = parseInt(router.query.ix as string)
  const id = router.query.id as string
  const [endedMicroLearning, setEndedMicroLearning] = useState(false)

  const { loading, data, subscribeToMore } = useQuery(
    GetMicroLearningDocument,
    {
      variables: { id },
      skip: !id,
    }
  )
  const { data: selfData } = useQuery(SelfDocument)

  if (loading || !data?.microLearning) {
    return <Loader />
  }

  const microLearning = data.microLearning
  const microLearningPast = dayjs(microLearning.scheduledEndAt).isBefore(
    dayjs()
  )

  // throw error if length of stacks is smaller than number
  if (!microLearning.stacks || !(ix <= (microLearning.stacks.length || -1))) {
    throw new Error('Stack not found')
  }

  const currentStack = microLearning.stacks[ix]

  if (!currentStack) {
    throw new Error('Stack not found')
  }

  return (
    <Layout
      displayName={microLearning.displayName}
      course={microLearning.course ?? undefined}
    >
      <MicroLearningSubscriber
        activityId={microLearning.id}
        subscribeToMore={subscribeToMore}
        setEndedMicroLearning={setEndedMicroLearning}
      />
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
            max={(microLearning?.stacks?.length ?? -1) + 1}
          />
          <ElementStack
            key={currentStack.id}
            parentId={microLearning.id}
            courseId={microLearning.course!.id}
            stack={currentStack}
            currentStep={ix + 1}
            totalSteps={microLearning.stacks?.length ?? 0}
            handleNextElement={() =>
              router.push(`/microlearning/${id}/${ix + 1}`)
            }
            onAllStacksCompletion={() =>
              // TODO: also mark the microlearning as completed with this action already?
              router.push(`/microlearning/${id}/evaluation`)
            }
            withParticipant={!!selfData?.self}
            hideBookmark
            singleSubmission
            activityExpired={dayjs(microLearning.scheduledEndAt).isBefore(
              dayjs()
            )}
            activityExpiredMessage={t('pwa.microLearning.activityExpired')}
          />
        </div>
      </div>
      <Toast
        type="warning"
        openExternal={endedMicroLearning}
        onCloseExternal={() => setEndedMicroLearning(false)}
        duration={10000}
        className={{ root: 'max-w-[30rem]' }}
        dismissible
      >
        {t('pwa.courses.microLearningEndedToast', {
          activityName: microLearning.displayName,
        })}
      </Toast>
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
