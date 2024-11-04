import {
  ChoiceQuestionOptions,
  ElementInstance,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import StudentElement, {
  SingleStudentResponseType,
} from '@klicker-uzh/shared-components/src/StudentElement'
import { QUESTION_GROUPS } from '@klicker-uzh/shared-components/src/constants'
import useSingleStudentResponse from '@klicker-uzh/shared-components/src/hooks/useSingleStudentResponse'
import SessionProgress from '@klicker-uzh/shared-components/src/questions/SessionProgress'
import { push } from '@socialgouv/matomo-next'
import { H2 } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import localForage from 'localforage'
import { useTranslations } from 'next-intl'
import React, { useEffect, useState } from 'react'
import { isDeepEqual } from 'remeda'

interface QuestionAreaProps {
  expiresAt?: Date
  instances: ElementInstance[]
  handleNewResponse: (
    type: ElementType,
    instanceId: number,
    answer: any
  ) => void
  sessionId: string
  execution: number
  timeLimit?: number
  isStaticPreview?: boolean
}

function QuestionArea({
  expiresAt,
  instances,
  handleNewResponse,
  sessionId,
  timeLimit,
  execution,
}: QuestionAreaProps): React.ReactElement {
  const t = useTranslations()

  const [remainingQuestions, setRemainingQuestions] = useState(new Array())
  const [activeInstance, setactiveInstance] = useState(
    (): any => remainingQuestions[0]
  )
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

  // TODO: remove this once replaced with new answering logic
  const [{ inputValue, inputValid, inputEmpty }, setInputState] = useState({
    inputEmpty: true,
    inputValid: false,
    inputValue: QUESTION_GROUPS.CHOICES.includes(
      instances[remainingQuestions[0]]?.elementType
    )
      ? new Array(
          (
            instances[remainingQuestions[0]].options as ChoiceQuestionOptions
          ).choices.length
        ).fill(false)
      : '',
  })

  useEffect((): void => {
    const exec = async () => {
      try {
        let storedResponses: any = (await localForage.getItem(
          `${sessionId}-responses`
        )) || {
          responses: [],
        }

        if (typeof storedResponses === 'string') {
          storedResponses = JSON.parse(storedResponses)
        }

        const remaining = instances
          .map((question: any) => question.instanceId)
          .reduce((indices, instanceId, index): any[] => {
            if (
              storedResponses?.responses?.includes(`${instanceId}-${execution}`)
            ) {
              return indices
            }

            return [...indices, index]
          }, [])

        setactiveInstance(remaining[0])
        setRemainingQuestions(remaining)
      } catch (e) {
        console.error(e)
      }
    }
    exec()
  }, [sessionId, instances, execution])

  const onSubmit = async (): Promise<void> => {
    const { id: instanceId, elementType } = instances[activeInstance]

    // if the question has been answered, add a response
    if (typeof inputValue !== 'undefined') {
      answerQuestion(inputValue, elementType, instanceId)
    } else {
      push(['trackEvent', 'Live Quiz', 'Question Skipped'])
    }

    // update the stored responses
    await updateStoredResponses(instanceId, sessionId, execution)

    // calculate the new indices of remaining questions
    const newRemaining = remainingQuestions.filter(
      (question) => !isDeepEqual(activeInstance, question)
    )

    setactiveInstance(newRemaining[0] || 0)
    setInputState({
      inputEmpty: true,
      inputValid: false,
      inputValue: '',
    })
    setRemainingQuestions(newRemaining)
  }

  const onExpire = async (): Promise<void> => {
    const { id: instanceId, elementType } = instances[activeInstance]

    // save the response, if one was given before the time expired
    if (
      typeof inputValue !== 'undefined' &&
      inputValue.length !== 0 &&
      inputValid
    ) {
      answerQuestion(inputValue, elementType, instanceId)
    }

    const remainingQuestionIds = remainingQuestions.map(
      (index: number) => instances[index].id
    )
    await updateStoredResponses(remainingQuestionIds, sessionId, execution)

    // automatically skip all possibly remaining questions
    setInputState({
      inputEmpty: true,
      inputValid: false,
      inputValue: '',
    })
    setRemainingQuestions([])
    push(['trackEvent', 'Live Quiz', 'Time expired'])
  }

  // use the handleNewResponse function to add a response to the question instance
  const answerQuestion = (
    value: any,
    type: ElementType,
    instanceId: number
  ): void => {
    if (type === ElementType.Kprim) {
      handleNewResponse(
        type,
        instanceId,
        Object.keys(value).flatMap<number[]>((key) =>
          value[key] === true ? [parseInt(key)] : []
        )
      )
    } else if (value.length > 0 && QUESTION_GROUPS.CHOICES.includes(type)) {
      handleNewResponse(type, instanceId, value)
    } else if (ElementType.FreeText === type) {
      handleNewResponse(type, instanceId, value)
    } else if (ElementType.Numerical === type) {
      handleNewResponse(type, instanceId, String(parseFloat(value)))
    }
  }

  const updateStoredResponses = async (
    instanceId: number | number[],
    sessionId: string,
    execution: number
  ) => {
    if (typeof window !== 'undefined') {
      try {
        const prevResponses: any = await localForage.getItem(
          `${sessionId}-responses`
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
        await localForage.setItem(`${sessionId}-responses`, stringified)
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
