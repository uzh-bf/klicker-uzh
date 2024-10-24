import {
  ChoiceQuestionOptions,
  ChoicesQuestionData,
  ElementType,
  FreeTextQuestionData,
  NumericalQuestionData,
} from '@klicker-uzh/graphql/dist/ops'
import StudentQuestion from '@klicker-uzh/shared-components/src/StudentQuestion'
import { QUESTION_GROUPS } from '@klicker-uzh/shared-components/src/constants'
import { push } from '@socialgouv/matomo-next'
import { H2 } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import localForage from 'localforage'
import { useTranslations } from 'next-intl'
import React, { useEffect, useState } from 'react'
import { isDeepEqual } from 'remeda'

// TODO: notifications

interface QuestionAreaProps {
  expiresAt?: Date
  questions: ((
    | ChoicesQuestionData
    | NumericalQuestionData
    | FreeTextQuestionData
  ) & { instanceId: number })[]
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
  questions,
  handleNewResponse,
  sessionId,
  timeLimit,
  execution,
}: QuestionAreaProps): React.ReactElement {
  const t = useTranslations()

  const [remainingQuestions, setRemainingQuestions] = useState(new Array())
  const [activeQuestion, setActiveQuestion] = useState(
    (): any => remainingQuestions[0]
  )
  const currentQuestion = questions[activeQuestion]

  const [{ inputValue, inputValid, inputEmpty }, setInputState] = useState({
    inputEmpty: true,
    inputValid: false,
    inputValue: QUESTION_GROUPS.CHOICES.includes(
      questions[remainingQuestions[0]]?.type
    )
      ? new Array(
          (
            questions[remainingQuestions[0]].options as ChoiceQuestionOptions
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

        const remaining = questions
          .map((question: any) => question.instanceId)
          .reduce((indices, instanceId, index): any[] => {
            if (
              storedResponses?.responses?.includes(`${instanceId}-${execution}`)
            ) {
              return indices
            }

            return [...indices, index]
          }, [])

        setActiveQuestion(remaining[0])
        setRemainingQuestions(remaining)
      } catch (e) {
        console.error(e)
      }
    }
    exec()
  }, [sessionId, questions, execution])

  const onSubmit = async (): Promise<void> => {
    const { instanceId, type } = questions[activeQuestion]

    // if the question has been answered, add a response
    if (typeof inputValue !== 'undefined') {
      answerQuestion(inputValue, type, instanceId)
    } else {
      push(['trackEvent', 'Live Quiz', 'Question Skipped'])
    }

    // update the stored responses
    await updateStoredResponses(instanceId, sessionId, execution)

    // calculate the new indices of remaining questions
    const newRemaining = remainingQuestions.filter(
      (question) => !isDeepEqual(activeQuestion, question)
    )

    setActiveQuestion(newRemaining[0] || 0)
    setInputState({
      inputEmpty: true,
      inputValid: false,
      inputValue: '',
    })
    setRemainingQuestions(newRemaining)
  }

  const onExpire = async (): Promise<void> => {
    const { instanceId, type } = questions[activeQuestion]

    // save the response, if one was given before the time expired
    if (
      typeof inputValue !== 'undefined' &&
      inputValue.length !== 0 &&
      inputValid
    ) {
      answerQuestion(inputValue, type, instanceId)
    }

    const remainingQuestionIds = remainingQuestions.map(
      (index: number) => questions[index].instanceId
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
          <StudentQuestion
            key={currentQuestion.instanceId}
            activeIndex={questions.length - remainingQuestions.length}
            numItems={questions.length}
            expiresAt={expiresAt}
            timeLimit={timeLimit}
            isSubmitDisabled={
              remainingQuestions.length === 0 ||
              (!inputEmpty && !inputValid) ||
              inputEmpty
            }
            onSubmit={onSubmit}
            onExpire={onExpire}
            currentQuestion={currentQuestion}
            inputValue={inputValue}
            inputValid={inputValid}
            inputEmpty={inputEmpty}
            setInputState={setInputState}
          />
        </div>
      )}
    </div>
  )
}

export default QuestionArea
