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
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import DynamicMarkdown from './DynamicMarkdown'
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
          <div>{stack.displayName}</div>
          <div
            className={twMerge(
              'flex flex-row gap-2',
              !data?.getBookmarksLearningElement && 'hidden'
            )}
          >
            {/* // TODO: better integration into overall design necessary... */}
            <div>Bookmark QuestionStack</div>
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
        <DynamicMarkdown content={stack.description ?? undefined} />
        {stack.elements?.map((element) => {
          if (element.mdContent) {
            return (
              <div className="gap-8 md:flex md:flex-row" key={element.id}>
                <div
                  className={twMerge(
                    'flex-1 py-4 my-8 border-y',
                    isEvaluation && 'basis-2/3'
                  )}
                >
                  <DynamicMarkdown content={element.mdContent} />
                </div>
                {isEvaluation && <div className="flex-1 basis-1/3"></div>}
              </div>
            )
          }

          if (element.questionInstance) {
            return (
              <div key={element.id}>
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
              </div>
            )
          }

          return (
            <div
              className="flex flex-col items-center justify-center h-28"
              key={element.id}
            >
              <FontAwesomeIcon icon={faSync} />
            </div>
          )
        })}
      </div>
      <Button
        className={{ root: 'float-right mt-4' }}
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
