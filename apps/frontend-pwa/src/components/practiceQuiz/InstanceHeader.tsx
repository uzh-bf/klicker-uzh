import { useMutation } from '@apollo/client'
import { faThumbsDown, faThumbsUp } from '@fortawesome/free-regular-svg-icons'
import {
  faCheck,
  faCheckDouble,
  faThumbsDown as faThumbsDownSolid,
  faThumbsUp as faThumbsUpSolid,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementFeedback,
  GetStackElementFeedbacksDocument,
  RateElementDocument,
  ResponseCorrectnessType,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import FlagElementModal from '../flags/FlagElementModal'

interface InstanceHeaderProps {
  index: number
  instanceId: number
  elementId: number
  name: string
  withParticipant: boolean
  correctness?: ResponseCorrectnessType
  previousElementFeedback?: ElementFeedback
  stackInstanceIds: number[]
  showSeparator?: boolean
  className?: string
}

function InstanceHeader({
  index,
  instanceId,
  elementId,
  name,
  withParticipant,
  correctness,
  previousElementFeedback,
  stackInstanceIds,
  showSeparator = false,
  className,
}: InstanceHeaderProps) {
  const t = useTranslations()
  // TODO: add query update
  const [rateElement, { loading: ratingLoading }] =
    useMutation(RateElementDocument)

  const [vote, setVote] = useState(
    previousElementFeedback?.upvote
      ? 1
      : previousElementFeedback?.downvote
        ? -1
        : 0
  )
  const [feedbackValue, setFeedbackValue] = useState(
    previousElementFeedback?.feedback ?? undefined
  )

  useEffect(() => {
    setVote(
      previousElementFeedback?.upvote
        ? 1
        : previousElementFeedback?.downvote
          ? -1
          : 0
    )
    setFeedbackValue(previousElementFeedback?.feedback ?? undefined)
  }, [previousElementFeedback])

  const handleVote = async (upvote: boolean) => {
    const res = await rateElement({
      variables: {
        elementInstanceId: instanceId,
        elementId,
        rating: upvote ? 1 : -1,
      },
      optimisticResponse: {
        __typename: 'Mutation',
        rateElement: {
          __typename: 'ElementFeedback',
          id: 0,
          upvote,
          downvote: !upvote,
        },
      },
      update(cache, { data: dataRating }) {
        const dataQuery = cache.readQuery({
          query: GetStackElementFeedbacksDocument,
          variables: { instanceIds: stackInstanceIds },
        })

        const feedbackIx = dataQuery?.getStackElementFeedbacks?.findIndex(
          (feedback) => feedback.elementInstanceId === instanceId
        )
        let newFeedbacks = [...(dataQuery?.getStackElementFeedbacks ?? [])]
        if (typeof feedbackIx === 'undefined' || feedbackIx === -1) {
          newFeedbacks.push({
            __typename: 'ElementFeedback',
            id:
              dataRating?.rateElement?.id ??
              Math.round(Math.random() * -1000000),
            elementInstanceId: instanceId,
            upvote,
            downvote: !upvote,
            feedback: null,
          })
        } else {
          newFeedbacks[feedbackIx] = {
            ...newFeedbacks[feedbackIx],
            upvote,
            downvote: !upvote,
          }
        }

        cache.writeQuery({
          query: GetStackElementFeedbacksDocument,
          variables: { instanceIds: stackInstanceIds },
          data: {
            getStackElementFeedbacks: newFeedbacks,
          },
        })
      },
    })

    if (res.data?.rateElement?.upvote) {
      setVote(1)
    } else if (res.data?.rateElement?.downvote) {
      setVote(-1)
    } else {
      toast({
        type: 'error',
        message: t('pwa.practiceQuiz.errorRatingElement'),
        options: { duration: 5000 },
      })
      setVote(0)
    }
  }

  return (
    <div className={className}>
      <div className="flex flex-row justify-between">
        <div className="flex flex-row items-center gap-2">
          {correctness === ResponseCorrectnessType.Correct && (
            <FontAwesomeIcon icon={faCheckDouble} className="text-green-600" />
          )}
          {correctness === ResponseCorrectnessType.Partial && (
            <FontAwesomeIcon icon={faCheck} className="text-yellow-600" />
          )}
          {correctness === ResponseCorrectnessType.Incorrect && (
            <FontAwesomeIcon icon={faXmark} className="text-red-600" />
          )}
          <div
            className="text-lg font-bold"
            data-cy={`element-instance-header-${name}`}
          >
            {name}
          </div>
        </div>
        {withParticipant && (
          <div className="flex flex-row items-center gap-1">
            <Button
              basic
              disabled={ratingLoading}
              onClick={() => handleVote(true)}
              className={{
                root: twMerge(
                  'text-uzh-grey-100 hover:text-primary-80 px-1',
                  vote === 1 && 'text-primary-100'
                ),
              }}
              data={{ cy: `upvote-element-${index}-button` }}
            >
              <Button.Icon
                withoutLabel
                icon={vote === 1 ? faThumbsUpSolid : faThumbsUp}
              />
            </Button>
            <Button
              basic
              disabled={ratingLoading}
              onClick={() => handleVote(false)}
              className={{
                root: twMerge(
                  'text-uzh-grey-100 hover:text-primary-80 px-1',
                  vote === -1 && 'text-primary-100'
                ),
              }}
              data={{ cy: `downvote-element-${index}-button` }}
            >
              <Button.Icon
                withoutLabel
                icon={vote === -1 ? faThumbsDownSolid : faThumbsDown}
              />
            </Button>
            <FlagElementModal
              index={index}
              instanceId={instanceId}
              elementId={elementId}
              feedbackValue={feedbackValue}
              setFeedbackValue={setFeedbackValue}
              stackInstanceIds={stackInstanceIds}
            />
          </div>
        )}
      </div>
      {showSeparator && <hr className="mb-3 h-px border-0 bg-gray-300" />}
    </div>
  )
}

export default InstanceHeader
