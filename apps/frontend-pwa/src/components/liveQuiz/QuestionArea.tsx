import { ElementInstance, ElementType } from '@klicker-uzh/graphql/dist/ops'
import StudentElement, {
  InstanceStackStudentResponseType,
} from '@klicker-uzh/shared-components/src/StudentElement'
import useSingleStudentResponse from '@klicker-uzh/shared-components/src/hooks/useSingleStudentResponse'
import LiveQuizProgress from '@klicker-uzh/shared-components/src/questions/LiveQuizProgress'
import { push } from '@socialgouv/matomo-next'
import { H2 } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import localForage from 'localforage'
import { useTranslations } from 'next-intl'
import React, { useState } from 'react'
import { isDeepEqual } from 'remeda'
import useRemainingInstances from '../hooks/useRemainingInstances'
import AllQuestionsAnsweredMessage from './AllQuestionsAnsweredMessage'

interface QuestionAreaProps {
  gamificationEnabled: boolean
  expiresAt?: Date
  instances: ElementInstance[]
  handleNewResponse: (
    sessionId: string,
    instanceId: number,
    type: ElementType,
    answer: any
  ) => void
  quizId: string
  execution: number
  timeLimit?: number
  isStaticPreview?: boolean
}

function QuestionArea({
  gamificationEnabled,
  expiresAt,
  instances,
  handleNewResponse,
  quizId,
  timeLimit,
  execution,
}: QuestionAreaProps): React.ReactElement {
  const t = useTranslations()

  const [remainingQuestions, setRemainingQuestions] = useState(new Array())
  const [activeInstance, setActiveInstance] = useState<number>(0)
  const currentInstance = instances[activeInstance]

  // initialize student response with default state (FT question) - is overwritten on instance change
  const [studentResponse, setStudentResponse] =
    useState<InstanceStackStudentResponseType>({
      type: ElementType.FreeText,
      response: undefined,
      valid: false,
    })

  // hook running on every instance change to initialize the student response correctly
  useSingleStudentResponse({
    instance: currentInstance,
    setStudentResponse,
  })

  // compute remaining instances based on stored responses
  useRemainingInstances({
    quizId,
    instances,
    execution,
    setRemainingQuestions,
    setActiveInstance,
  })

  const onSubmit = async (): Promise<void> => {
    const { id: instanceId, elementType } = instances[activeInstance]

    // if the question has been answered, add a response
    if (studentResponse.valid) {
      answerQuestion({ instanceId, type: elementType, input: studentResponse })
    } else {
      push(['trackEvent', 'Live Quiz', 'Question Skipped'])
    }

    // update the stored responses
    await updateStoredResponses(instanceId, quizId, execution)

    // calculate the new indices of remaining questions
    const newRemaining = remainingQuestions.filter(
      (question) => !isDeepEqual(activeInstance, question)
    )

    setActiveInstance(newRemaining[0] || 0)
    setRemainingQuestions(newRemaining)
  }

  const onExpire = async (): Promise<void> => {
    const { id: instanceId, elementType } = instances[activeInstance]

    // save the response, if one was given before the time expired
    if (studentResponse.valid) {
      answerQuestion({ instanceId, type: elementType, input: studentResponse })
    }

    const remainingQuestionIds = remainingQuestions.map(
      (index: number) => instances[index].id
    )
    await updateStoredResponses(remainingQuestionIds, quizId, execution)

    // automatically skip all possibly remaining questions
    setRemainingQuestions([])
    push(['trackEvent', 'Live Quiz', 'Time expired'])
  }

  // use the handleNewResponse function to add a response to the question instance
  const answerQuestion = ({
    instanceId,
    type,
    input,
  }: {
    instanceId: number
    type: ElementType
    input: InstanceStackStudentResponseType
  }): void => {
    if (!input.valid) {
      return
    } else if (
      ((type === ElementType.Sc && input.type === ElementType.Sc) ||
        (type === ElementType.Mc && input.type === ElementType.Mc) ||
        (type === ElementType.Kprim && input.type === ElementType.Kprim)) &&
      typeof input.response !== 'undefined'
    ) {
      const responseList = Object.entries(input.response)
        .filter(([, value]) => value)
        .map(([key, value]) => ({
          ix: parseInt(key),
          selected: value,
        }))

      handleNewResponse(quizId, instanceId, type, responseList)
    } else if (
      ElementType.FreeText === type &&
      input.type === ElementType.FreeText &&
      typeof input.response !== 'undefined'
    ) {
      handleNewResponse(quizId, instanceId, type, input.response)
    } else if (
      ElementType.Numerical === type &&
      input.type === ElementType.Numerical &&
      typeof input.response !== 'undefined'
    ) {
      handleNewResponse(
        quizId,
        instanceId,
        type,
        String(parseFloat(input.response))
      )
    } else if (
      ElementType.Selection === type &&
      input.type === ElementType.Selection &&
      typeof input.response !== 'undefined'
    ) {
      // submit responses as an array of answer ids that were selected
      handleNewResponse(quizId, instanceId, type, Object.values(input.response))
    } else if (
      ElementType.CaseStudy === type &&
      input.type === ElementType.CaseStudy &&
      typeof input.response !== 'undefined'
    ) {
      // submit responses as an object with case, item and criterion ids as nested keys
      handleNewResponse(quizId, instanceId, type, input.response)
    } else if (type === ElementType.Content) {
      // for content elements, only the number of reads / next clicks are counted
      handleNewResponse(quizId, instanceId, type, true)
    }
  }

  const updateStoredResponses = async (
    instanceId: number | number[],
    quizId: string,
    execution: number
  ) => {
    if (typeof window !== 'undefined') {
      try {
        const prevResponses: any = await localForage.getItem(
          `${quizId}-responses`
        )
        let newResponses: string[] = []

        if (Array.isArray(instanceId)) {
          newResponses = instanceId.map(
            (instanceId: number) => `${instanceId}-${execution}`
          )
        } else {
          newResponses = [`${instanceId}-${execution}`]
        }
        const stringified = JSON.stringify(
          prevResponses
            ? {
                responses: [
                  ...JSON.parse(prevResponses).responses,
                  ...newResponses,
                ],
                timestamp: dayjs().unix(),
              }
            : {
                responses: newResponses,
                timestamp: dayjs().unix(),
              }
        )
        await localForage.setItem(`${quizId}-responses`, stringified)
      } catch (e) {
        console.error(e)
        // TODO: maybe delete possible responses that were already saved in case of failure
      }
    }
  }

  return (
    <div className="min-h-content h-full w-full">
      <H2 className={{ root: 'mb-0 pt-4 md:pt-2' }}>
        {t('shared.generic.question')}
      </H2>

      {remainingQuestions.length === 0 ? (
        <AllQuestionsAnsweredMessage
          gamificationEnabled={gamificationEnabled}
        />
      ) : (
        <div className="flex w-full flex-col">
          <LiveQuizProgress
            activeIndex={instances.length - remainingQuestions.length}
            contentInstance={
              currentInstance.elementType === ElementType.Content
            }
            numItems={instances.length}
            expiresAt={expiresAt}
            timeLimit={timeLimit}
            isSubmitDisabled={!studentResponse.valid}
            onSubmit={onSubmit}
            onExpire={onExpire}
          />
          <StudentElement
            sequential
            hideReadButton
            element={currentInstance}
            elementIx={activeInstance}
            singleStudentResponse={studentResponse}
            setSingleStudentResponse={setStudentResponse}
          />
        </div>
      )}
    </div>
  )
}

export default QuestionArea
