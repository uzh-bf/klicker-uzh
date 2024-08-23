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
import { Button, H4, Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import FlagElementModal from '../flags/FlagElementModal'

interface RatingErrorToastProps {
  open: boolean
  setOpen: (newValue: boolean) => void
}

function RatingErrorToast({ open, setOpen }: RatingErrorToastProps) {
  const t = useTranslations()

  return (
    <Toast
      duration={5000}
      type="error"
      openExternal={open}
      setOpenExternal={setOpen}
    >
      <H4>{t('shared.generic.error')}</H4>
      <div>{t('pwa.practiceQuiz.errorRatingElement')}</div>
    </Toast>
  )
}

interface InstanceHeaderProps {
  index: number
  instanceId: number
  elementId: number
  name: string
  withParticipant: boolean
  correctness?: ResponseCorrectnessType
  previousElementFeedback?: ElementFeedback
  stackInstanceIds: number[]
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
  className,
}: InstanceHeaderProps) {
  const [rateElement] = useMutation(RateElementDocument)
  const [modalOpen, setModalOpen] = useState(false)
  const [ratingErrorToast, setRatingErrorToast] = useState(false)
  const [ratingInProgress, setRatingInProgress] = useState(false)
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
    setRatingInProgress(true)
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

    setRatingInProgress(false)
    if (res.data?.rateElement?.upvote) {
      setVote(1)
    } else if (res.data?.rateElement?.downvote) {
      setVote(-1)
    } else {
      setRatingErrorToast(true)
      setVote(0)
    }
  }

  return (
    <div className={twMerge('mb-4', className)}>
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
          <H4 data={{ cy: `element-instance-header-${name}` }}>{name}</H4>
        </div>
        {withParticipant && (
          <div className="flex flex-row items-center gap-4">
            <Button
              basic
              active={vote === 1}
              onClick={() => handleVote(true)}
              data={{ cy: `upvote-element-${index}-button` }}
              disabled={ratingInProgress}
            >
              <Button.Icon>
                <FontAwesomeIcon
                  icon={vote === 1 ? faThumbsUpSolid : faThumbsUp}
                  className={twMerge(
                    'text-uzh-grey-100 hover:text-primary-80',
                    vote === 1 && 'text-primary-80'
                  )}
                />
              </Button.Icon>
            </Button>
            <Button
              basic
              active={vote === -1}
              onClick={() => handleVote(false)}
              data={{ cy: `downvote-element-${index}-button` }}
              disabled={ratingInProgress}
            >
              <Button.Icon>
                <FontAwesomeIcon
                  icon={vote === -1 ? faThumbsDownSolid : faThumbsDown}
                  className={twMerge(
                    'text-uzh-grey-100 hover:text-primary-80',
                    vote === -1 && 'text-primary-80'
                  )}
                />
              </Button.Icon>
            </Button>
            <FlagElementModal
              index={index}
              open={modalOpen}
              setOpen={setModalOpen}
              instanceId={instanceId}
              elementId={elementId}
              feedbackValue={feedbackValue}
              setFeedbackValue={setFeedbackValue}
              stackInstanceIds={stackInstanceIds}
            />
            <RatingErrorToast
              open={ratingErrorToast}
              setOpen={setRatingErrorToast}
            />
          </div>
        )}
      </div>
      <hr className="h-[1px] border-0 bg-gray-300" />
    </div>
  )
}

export default InstanceHeader
