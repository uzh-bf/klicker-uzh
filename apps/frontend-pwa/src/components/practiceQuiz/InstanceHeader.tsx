import { faThumbsDown, faThumbsUp } from '@fortawesome/free-regular-svg-icons'
import {
  faChartBar,
  faCheck,
  faCheckDouble,
  faThumbsDown as faThumbsDownSolid,
  faThumbsUp as faThumbsUpSolid,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { trpc } from '../../lib/trpc'
import FlagElementModal from '../flags/FlagElementModal'
import type { StackElementFeedback } from '../hooks/useStackElementFeedbacks'

const RESPONSE_CORRECTNESS_TYPE = {
  Correct: 'CORRECT',
  Incorrect: 'INCORRECT',
  Partial: 'PARTIAL',
} as const

type ResponseCorrectnessType =
  (typeof RESPONSE_CORRECTNESS_TYPE)[keyof typeof RESPONSE_CORRECTNESS_TYPE]

interface InstanceHeaderProps {
  index: number
  instanceId: number
  elementId: number
  name: string
  withParticipant: boolean
  correctness?: ResponseCorrectnessType
  previousElementFeedback?: StackElementFeedback
  stackInstanceIds: number[]
  showSeparator?: boolean
  className?: string
  evaluationOpen?: boolean
  onToggleEvaluation?: () => void
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
  evaluationOpen,
  onToggleEvaluation,
}: InstanceHeaderProps) {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const stackFeedbacksInput = { instanceIds: stackInstanceIds }
  const rateElement = trpc.participant.rateElement.useMutation({
    onSuccess: async () => {
      await utils.participant.stackElementFeedbacks
        .invalidate(stackFeedbacksInput)
        .catch(console.error)
    },
  })

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
    const res = await rateElement
      .mutateAsync({
        elementInstanceId: instanceId,
        elementId,
        rating: upvote ? 1 : -1,
      })
      .catch((error) => {
        console.error(error)
        toast({
          type: 'error',
          message: t('pwa.practiceQuiz.errorRatingElement'),
          options: { duration: 5000 },
        })
        return undefined
      })

    if (typeof res === 'undefined') {
      return
    }

    if (res?.upvote) {
      setVote(1)
    } else if (res?.downvote) {
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
        {typeof correctness !== 'undefined' ? (
          <div className="flex flex-row items-center gap-2">
            {correctness === RESPONSE_CORRECTNESS_TYPE.Correct && (
              <FontAwesomeIcon
                icon={faCheckDouble}
                className="text-green-700"
              />
            )}
            {correctness === RESPONSE_CORRECTNESS_TYPE.Partial && (
              <FontAwesomeIcon icon={faCheck} className="text-yellow-600" />
            )}
            {correctness === RESPONSE_CORRECTNESS_TYPE.Incorrect && (
              <FontAwesomeIcon icon={faXmark} className="text-red-600" />
            )}
            <div
              className="text-lg font-bold"
              data-cy={`element-instance-header-${name}`}
            >
              {name}
            </div>
          </div>
        ) : (
          <div />
        )}
        {withParticipant && (
          <div className="flex flex-row items-center gap-1">
            {onToggleEvaluation && (
              <Button
                basic
                onClick={onToggleEvaluation}
                className={{
                  root: twMerge(
                    'text-uzh-grey-100 hover:text-primary-80 px-1',
                    evaluationOpen && 'text-primary-100'
                  ),
                }}
                data={{ cy: `toggle-evaluation-${index}-button` }}
              >
                <Button.Icon withoutLabel icon={faChartBar} />
              </Button>
            )}
            <Button
              basic
              disabled={rateElement.isLoading}
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
              disabled={rateElement.isLoading}
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
