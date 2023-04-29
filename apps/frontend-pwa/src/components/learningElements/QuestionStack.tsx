import { useMutation, useQuery } from '@apollo/client'
import { faBookmark } from '@fortawesome/free-regular-svg-icons'
import {
  faBookmark as faBookmarkFilled,
  faSync,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  BookmarkQuestionDocument,
  GetBookmarksLearningElementDocument,
  QuestionStack,
  QuestionType,
  ResponseToQuestionInstanceDocument,
} from '@klicker-uzh/graphql/dist/ops'
import formatResponse from '@lib/formatResponse'
import { Button, H2 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import EvaluationDisplay from '../evaluation/EvaluationDisplay'
import DynamicMarkdown from './DynamicMarkdown'
import LearningElementPoints from './LearningElementPoints'
import SingleQuestion from './SingleQuestion'

interface QuestionStackProps {
  elementId: string
  stack: QuestionStack
  currentStep: number
  totalSteps: number
  handleNextQuestion: () => void
}

function QuestionStack({
  elementId,
  stack,
  currentStep,
  totalSteps,
  handleNextQuestion,
}: QuestionStackProps) {
  const t = useTranslations()
  const router = useRouter()

  const [responses, setResponses] = useState<
    Record<string, {} | number[] | string | null>
  >({})
  const [isEvaluation, setIsEvaluation] = useState(false)
  const [informationOnly, setInformationOnly] = useState(true)
  const [inputValid, setInputValid] = useState<Record<number, boolean>>({})
  const [allValid, setAllValid] = useState(false)

  const [respondToQuestionInstance] = useMutation(
    ResponseToQuestionInstanceDocument
  )

  const { data } = useQuery(GetBookmarksLearningElementDocument, {
    variables: {
      courseId: router.query.courseId as string,
      elementId: elementId,
    },
    skip: !router.query.courseId,
  })

  const isBookmarked = useMemo(() => {
    if (!data || !data.getBookmarksLearningElement) {
      return false
    }

    return data.getBookmarksLearningElement
      .map((entry) => entry.id)
      .includes(stack.id)
  }, [data, stack.id])

  const [bookmarkQuestion] = useMutation(BookmarkQuestionDocument, {
    variables: {
      stackId: stack.id,
      courseId: router.query.courseId as string,
      bookmarked: !isBookmarked,
    },
    update(cache) {
      const data = cache.readQuery({
        query: GetBookmarksLearningElementDocument,
        variables: { courseId: router.query.courseId as string, elementId },
      })
      cache.writeQuery({
        query: GetBookmarksLearningElementDocument,
        variables: { courseId: router.query.courseId as string, elementId },
        data: {
          getBookmarksLearningElement: isBookmarked
            ? (data?.getBookmarksLearningElement ?? []).filter(
                (entry) => entry.id !== stack.id
              )
            : [
                ...(data?.getBookmarksLearningElement ?? []),
                {
                  __typename: 'QuestionStack',
                  id: stack.id,
                },
              ],
        },
      })
    },
    optimisticResponse: {
      bookmarkQuestion: isBookmarked
        ? data?.getBookmarksLearningElement?.filter(
            (entry) => entry.id !== stack.id
          )
        : [
            ...(data?.getBookmarksLearningElement ?? []),
            {
              __typename: 'QuestionStack',
              id: stack.id,
            },
          ],
    },
  })

  useEffect(() => {
    stack.elements?.map((element) => {
      if (element.mdContent) return

      const questionType = element.questionInstance?.questionData.type
      setInformationOnly(false)
      if (
        questionType === QuestionType.Sc ||
        questionType === QuestionType.Mc
      ) {
        setResponses((prev) => ({
          ...prev,
          [element.id]: [],
        }))
      } else if (questionType === QuestionType.Kprim) {
        setResponses((prev) => ({
          ...prev,
          [element.id]: {},
        }))
      } else {
        setResponses((prev) => ({
          ...prev,
          [element.id]: '',
        }))
      }

      if (element.questionInstance?.evaluation) {
        setIsEvaluation(true)
      }
    })

    return () => {
      setResponses({})
      setIsEvaluation(false)
      setInformationOnly(true)
    }
  }, [stack])

  useEffect(() => {
    stack.elements?.map((element) => {
      if (element.mdContent) return

      return setInputValid((prev) => ({
        ...prev,
        [element.id]: false,
      }))
    })

    return () => {
      setInputValid({})
    }
  }, [stack])

  useEffect(() => {
    if (
      Object.keys(inputValid).length === 0 ||
      Object.values(inputValid).every((v) => v)
    ) {
      setAllValid(true)
    } else {
      setAllValid(false)
    }

    return () => {
      setAllValid(false)
    }
  }, [inputValid])

  const handleSubmitResponse = async () => {
    const responsePromises = Object.entries(responses).map(
      ([key, response]) => {
        const element = stack.elements?.find((el) => el.id === parseInt(key))
        if (!element?.questionInstance) return

        return respondToQuestionInstance({
          variables: {
            courseId: router.query.courseId as string,
            id: element.questionInstance.id,
            response: formatResponse(
              element.questionInstance.questionData,
              response
            ),
          },
        })
      }
    )

    await Promise.all(responsePromises)
  }

  return (
    <div>
      <div className="flex flex-col">
        <div className="flex flex-row items-center justify-between">
          <div>{stack.displayName && <H2>{stack.displayName}</H2>}</div>
          <div
            className={twMerge(
              'flex flex-row gap-2',
              !data?.getBookmarksLearningElement && 'hidden'
            )}
          >
            <div>Bookmark</div>
            <Button basic onClick={() => bookmarkQuestion()}>
              {isBookmarked ? (
                <FontAwesomeIcon
                  className="text-red-600 hover:text-red-500"
                  icon={faBookmarkFilled}
                />
              ) : (
                <FontAwesomeIcon
                  className="hover:text-red-400"
                  icon={faBookmark}
                />
              )}
            </Button>
          </div>
        </div>

        {stack.description && (
          <div className="mb-4">
            <DynamicMarkdown content={stack.description} />
          </div>
        )}

        <div
          className={twMerge(
            'w-full grid grid-cols-1 md:grid-cols-2 md:gap-6',
            isEvaluation && 'md:grid-cols-3'
          )}
        >
          {stack.elements?.flatMap((element) => {
            return (
              <>
                <div
                  className="py-4 mr-2 first:pt-0 last:pb-0 md:col-span-2"
                  key={element.id}
                >
                  {element.mdContent && (
                    <div key={element.id}>
                      <div className="w-full py-4 border-y">
                        <DynamicMarkdown content={element.mdContent} />
                      </div>
                    </div>
                  )}
                  {element.questionInstance && (
                    <SingleQuestion
                      instance={element.questionInstance}
                      currentStep={currentStep}
                      totalSteps={totalSteps}
                      response={responses[element.id]}
                      setResponse={(response) =>
                        setResponses((prev) => ({
                          ...prev,
                          [element.id]: response,
                        }))
                      }
                      setInputValid={(valid: boolean) =>
                        setInputValid((prev) => ({
                          ...prev,
                          [element.id]: valid,
                        }))
                      }
                    />
                  )}
                  {!element.mdContent && !element.questionInstance && (
                    <div
                      className="flex flex-col items-center justify-center h-20"
                      key={element.id}
                    >
                      <FontAwesomeIcon icon={faSync} />
                    </div>
                  )}
                </div>
                {isEvaluation && element.questionInstance && (
                  <div
                    className="col-span-1 px-2 py-4 mr-2 border border-solid md:px-0 md:ml-2 md:mr-0 bg-slate-50"
                    key={element.id}
                  >
                    {element.mdContent && <div key={element.id} />}
                    {element.questionInstance.evaluation && (
                      <div
                        className="flex flex-col gap-4 md:px-4"
                        key={element.id}
                      >
                        <LearningElementPoints
                          evaluation={element.questionInstance.evaluation}
                          pointsMultiplier={
                            element.questionInstance.pointsMultiplier
                          }
                        />

                        <EvaluationDisplay
                          options={
                            element.questionInstance.questionData.options
                          }
                          questionType={
                            element.questionInstance.questionData.type
                          }
                          evaluation={element.questionInstance.evaluation}
                          reference={String(responses[element.id])}
                        />
                      </div>
                    )}
                  </div>
                )}
              </>
            )
          })}
        </div>
      </div>
      <Button
        className={{ root: 'float-right mt-4 text-lg' }}
        onClick={
          isEvaluation || informationOnly
            ? () => handleNextQuestion()
            : () => handleSubmitResponse()
        }
        disabled={!allValid && !isEvaluation}
      >
        {isEvaluation || informationOnly
          ? t('shared.generic.continue')
          : t('shared.generic.sendAnswer')}
      </Button>
    </div>
  )
}

export default QuestionStack
