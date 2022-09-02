import { H1 } from '@uzh-bf/design-system'
import localForage from 'localforage'
import React, { useEffect, useState } from 'react'

import { QUESTION_TYPES } from '../../constants'
import QuestionDescription from '../common/QuestionDescription'
import SessionProgress from './SessionProgress'

// TODO: notifications

interface QuestionAreaProps {
  expiresAt?: Date
  questions: any[] // TODO: correct typing
  handleNewResponse: any // TODO: correct typing
  sessionId: string
  timeLimit?: number
  isStaticPreview?: boolean
}

const messages = {
  [QUESTION_TYPES.SC]: <p>Bitte eine einzige Option auswählen:</p>,
  [QUESTION_TYPES.MC]: <p>Bitte eine oder mehrere Optionen auswählen:</p>,
  [QUESTION_TYPES.FREE]: <p>Bitte eine Antwort eingeben:</p>,
  [QUESTION_TYPES.FREE_RANGE]: (
    <p>Bitte eine Antwort aus dem vorgegebenen Bereich auswählen:</p>
  ),
}

function QuestionArea({
  expiresAt,
  questions,
  handleNewResponse,
  sessionId,
  timeLimit,
}: QuestionAreaProps): React.ReactElement {
  const [remainingQuestions, setRemainingQuestions] = useState([])
  const [activeQuestion, setActiveQuestion] = useState(
    (): any => remainingQuestions[0]
  )
  const [{ inputValue, inputValid, inputEmpty }, setInputState] = useState({
    inputEmpty: true,
    inputValid: false,
    inputValue: undefined,
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

        const remaining = questions.reduce((indices, { id }, index): any[] => {
          if (storedResponses?.responses?.includes(id)) {
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
  }, [sessionId, questions])

  // const onActiveChoicesChange =
  //   (type): any =>
  //   (choice): any =>
  //   (): void => {
  //     const validateChoices = (newValue): boolean =>
  //       type === QUESTION_TYPES.SC ? newValue.length === 1 : newValue.length > 0

  //     if (inputValue && type === QUESTION_TYPES.MC) {
  //       // if the choice is already active, remove it
  //       if (inputValue.includes(choice)) {
  //         const newInputValue = _without(inputValue, choice)

  //         return setInputState({
  //           inputEmpty: newInputValue.length === 0,
  //           inputValid: validateChoices(newInputValue),
  //           inputValue: newInputValue,
  //         })
  //       }

  //       // else add it to the active choices
  //       const newInputValue = [...inputValue, choice]
  //       return setInputState({
  //         inputEmpty: false,
  //         inputValid: validateChoices(newInputValue),
  //         inputValue: newInputValue,
  //       })
  //     }

  //     // initialize the value with the first choice
  //     return setInputState({
  //       inputEmpty: false,
  //       inputValid: true,
  //       inputValue: [choice],
  //     })
  //   }

  // const onFreeValueChange =
  //   (type, options): any =>
  //   (newInputValue): void => {
  //     let validator = v8n()

  //     if (type === QUESTION_TYPES.FREE_RANGE) {
  //       validator = validator.number(false)

  //       if (_get(options, 'restrictions.max')) {
  //         validator = validator.lessThanOrEqual(options.restrictions.max)
  //       }

  //       if (_get(options, 'restrictions.min')) {
  //         validator = validator.greaterThanOrEqual(options.restrictions.min)
  //       }
  //     } else {
  //       validator = validator.string()
  //     }

  //     return setInputState({
  //       inputEmpty: newInputValue !== 0 && (!newInputValue || newInputValue.length === 0),
  //       inputValid: validator.test(newInputValue) || validator.test(+newInputValue),
  //       inputValue: newInputValue,
  //     })
  //   }

  // const onSubmit = async (): Promise<void> => {
  //   if (!isStaticPreview) {
  //     const { id: instanceId, execution, type } = questions[activeQuestion]

  //     // if the question has been answered, add a response
  //     if (typeof inputValue !== 'undefined') {
  //       if (inputValue.length > 0 && QUESTION_GROUPS.CHOICES.includes(type)) {
  //         handleNewResponse({ instanceId, response: { choices: inputValue } })
  //       } else if (QUESTION_GROUPS.FREE.includes(type)) {
  //         handleNewResponse({ instanceId, response: { value: String(inputValue) } })
  //       }
  //     } else {
  //       push(['trackEvent', 'Join Session', 'Question Skipped'])
  //     }

  //     // update the stored responses
  //     if (typeof window !== 'undefined') {
  //       try {
  //         const prevResponses: any = await localForage.getItem(`${shortname}-${sessionId}-responses`)
  //         const stringified = JSON.stringify(
  //           prevResponses
  //             ? {
  //                 responses: [...JSON.parse(prevResponses).responses, `${instanceId}-${execution}`],
  //                 timestamp: dayjs().unix(),
  //               }
  //             : { responses: [`${instanceId}-${execution}`], timestamp: dayjs().unix() }
  //         )
  //         await localForage.setItem(`${shortname}-${sessionId}-responses`, stringified)
  //       } catch (e) {
  //         console.error(e)
  //       }
  //     }

  //     // calculate the new indices of remaining questions
  //     const newRemaining = _without(remainingQuestions, activeQuestion)

  //     setActiveQuestion(newRemaining[0] || 0)
  //     setInputState({
  //       inputEmpty: true,
  //       inputValid: false,
  //       inputValue: undefined,
  //     })
  //     setRemainingQuestions(newRemaining)
  //   } else {
  //     setInputState({
  //       inputEmpty: true,
  //       inputValid: false,
  //       inputValue: undefined,
  //     })
  //   }
  // }

  // TODO: replace by working functions
  const onSubmit = () => null
  const onFreeValueChange = () => null
  const onActiveChoicesChange = () => null
  const onExpire = () => null

  const currentQuestion = questions[activeQuestion]

  return (
    <div className="w-full h-full">
      <H1 className="hidden mb-2 md:block md:!text-lg">Frage</H1>

      {remainingQuestions.length === 0 ? (
        'Sie haben bereits alle aktiven Fragen beantwortet.'
      ) : (
        <div className="flex flex-col w-full gap-2">
          <SessionProgress
            activeIndex={questions.length - remainingQuestions.length}
            numItems={questions.length}
            expiresAt={expiresAt}
            timeLimit={timeLimit}
            isSkipModeActive={inputEmpty}
            isSubmitDisabled={
              remainingQuestions.length === 0 || (!inputEmpty && !inputValid)
            }
            onSubmit={onSubmit}
            onExpire={onExpire}
          />

          <div className="flex-initial min-h-[6rem] p-3 bg-primary-10 border-uzh-blue-80 border border-solid rounded">
            <QuestionDescription
              content={currentQuestion.content}
              description={currentQuestion.description}
            />
          </div>

          {/* // TODO? */}
          <div>QUESTIONFILES</div>
          <div className="mb-2 font-bold">{messages[currentQuestion.type]}</div>
          <div>ANSWEROPTIONS</div>
          {/* 

        <div className="flex-1 mt-4">
          <div className="mb-2 font-bold">{messages[type]}</div>

          {((): React.ReactElement => {
            if (QUESTION_GROUPS.CHOICES.includes(type)) {
              return (
                <SCAnswerOptions
                  disabled={!remainingQuestions.includes(activeQuestion)}
                  options={options[type].choices}
                  value={inputValue}
                  onChange={onActiveChoicesChange(type)}
                />
              )
            }

            if (QUESTION_GROUPS.FREE.includes(type)) {
              return (
                <FREEAnswerOptions
                  disabled={!remainingQuestions.includes(activeQuestion)}
                  options={options[type]}
                  questionType={type}
                  value={inputValue}
                  onChange={onFreeValueChange(type, options[type])}
                />
              )
            }

            return null
          })()} */}
        </div>
      )}
    </div>
  )
}

export default QuestionArea
