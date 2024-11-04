import { ElementInstance, ElementType } from '@klicker-uzh/graphql/dist/ops'
import StudentElement, {
  SingleStudentResponseType,
} from '@klicker-uzh/shared-components/src/StudentElement'
import useSingleStudentResponse from '@klicker-uzh/shared-components/src/hooks/useSingleStudentResponse'
import SessionProgress from '@klicker-uzh/shared-components/src/questions/SessionProgress'
import { push } from '@socialgouv/matomo-next'
import { H2 } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import localForage from 'localforage'
import { useTranslations } from 'next-intl'
import React, { useState } from 'react'
import { isDeepEqual } from 'remeda'
import useRemainingInstances from '../hooks/useRemainingInstances'

interface QuestionAreaProps {
  expiresAt?: Date
  instances: ElementInstance[]
  handleNewResponse: (
    type: ElementType,
    instanceId: number,
    answer: any
  ) => void
  quizId: string
  execution: number
  timeLimit?: number
  isStaticPreview?: boolean
}

function QuestionArea({
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
    useState<SingleStudentResponseType>({
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
    input: SingleStudentResponseType
  }): void => {
    if (!input.valid) {
      return
    } else if (
      ((type === ElementType.Sc && input.type === ElementType.Sc) ||
        (type === ElementType.Mc && input.type === ElementType.Mc) ||
        (type === ElementType.Kprim && input.type === ElementType.Kprim)) &&
      typeof input.response !== 'undefined'
    ) {
      const choicesIdxs = Object.entries(input.response)
        .map(([key, value]) => (value === true ? parseInt(key) : undefined))
        .filter((choice) => typeof choice !== 'undefined')

      handleNewResponse(type, instanceId, choicesIdxs)
    } else if (
      ElementType.FreeText === type &&
      input.type === ElementType.FreeText &&
      typeof input.response !== 'undefined'
    ) {
      handleNewResponse(type, instanceId, input.response)
    } else if (
      ElementType.Numerical === type &&
      input.type === ElementType.Numerical &&
      typeof input.response !== 'undefined'
    ) {
      handleNewResponse(type, instanceId, String(parseFloat(input.response)))
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
      <H2 className={{ root: 'mb-2 hidden md:block' }}>
        {t('shared.generic.question')}
      </H2>

      {remainingQuestions.length === 0 ? (
        t('pwa.session.allQuestionsAnswered')
      ) : (
        <div className="flex w-full flex-col gap-2">
          <SessionProgress
            activeIndex={instances.length - remainingQuestions.length}
            numItems={instances.length}
            expiresAt={expiresAt}
            timeLimit={timeLimit}
            isSubmitDisabled={!studentResponse.valid}
            onSubmit={onSubmit}
            onExpire={onExpire}
          />
          <StudentElement
            element={currentInstance}
            elementIx={activeInstance}
            singleStudentResponse={studentResponse}
            setSingleStudentResponse={setStudentResponse}
            hideReadButton
            // disabledInput={submitting} // TODO: add to avoid double submission
          />
        </div>
      )}
    </div>
  )
}

export default QuestionArea
