import { faSave } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ElementBlockStatus } from '@klicker-uzh/graphql/dist/ops'
import { CycleCountdown } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { Dispatch, SetStateAction, useEffect, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { QuizTimelineBlock } from './LiveQuizBlock'

// fixed cooldown duration (including some buffer for UI updates after block closure)
const COOLDOWN_DURATION = 12

function LiveQuizCountdown({
  block,
  size,
  inCooldown,
  onExpiration,
  setInCooldown,
  className,
}: {
  block: Pick<QuizTimelineBlock, 'id' | 'status' | 'expiresAt' | 'timeLimit'>
  size?: 'sm' | 'md' | 'lg'
  inCooldown: boolean
  onExpiration: () => void
  setInCooldown: Dispatch<SetStateAction<boolean>>
  className?: string
}) {
  // compute the time until expiration (student-visible time) and
  // the time until the block is closed (including cooldown)
  const { endDuration, endTimestamp, cooldown } = useMemo(() => {
    // if the block is already closed, return early
    if (block.status === ElementBlockStatus.Executed) {
      return { endDuration: 0, endTimestamp: new Date(), cooldown: false }
    }

    // if the block is still scheduled, return early
    if (block.status === ElementBlockStatus.Scheduled) {
      return { endDuration: 0, endTimestamp: null, cooldown: false }
    }

    // compute the time until the official closure and the time until the actual closure
    const timeUntilExpiration = block.expiresAt
      ? dayjs(block.expiresAt).diff(dayjs(), 'second') + 1
      : block.timeLimit

    const expirationTime = new Date()
    expirationTime.setSeconds(
      expirationTime.getSeconds() + (timeUntilExpiration ?? 0)
    )

    if (!((timeUntilExpiration ?? 0) > 1)) {
      const timeUntilClosure = block.expiresAt
        ? dayjs(block.expiresAt).diff(dayjs(), 'second') + COOLDOWN_DURATION
        : block.timeLimit
      const closureTime = new Date()
      closureTime.setSeconds(closureTime.getSeconds() + (timeUntilClosure ?? 0))

      return {
        endDuration: timeUntilClosure ?? 0,
        endTimestamp: closureTime,
        cooldown: true,
      }
    }

    return {
      endDuration: timeUntilExpiration ?? 0,
      endTimestamp: expirationTime,
      cooldown: false,
    }
  }, [block.expiresAt, block.status, block.timeLimit])

  // as soon as the endTimestamp changes, we should re-evaluate if the block is in cooldown
  useEffect(() => {
    if (cooldown && !inCooldown) {
      setInCooldown(cooldown)
      onExpiration()
    } else if (!cooldown && inCooldown) {
      setInCooldown(cooldown)
      onExpiration()
    }
  }, [cooldown, inCooldown, onExpiration, setInCooldown])

  const isStatic = !endTimestamp || block.status === ElementBlockStatus.Executed
  const isActiveCooldown = inCooldown && !isStatic

  return (
    <CycleCountdown
      key={`${block.id}-${endTimestamp}-${endDuration}-${String(inCooldown)}`}
      size={size ?? 'sm'}
      isStatic={isStatic}
      color={isActiveCooldown ? '#FF4D01' : undefined}
      terminalColor={
        block.status === ElementBlockStatus.Executed ? undefined : '#00A321'
      }
      expiresAt={
        endTimestamp ?? dayjs().add(block.timeLimit!, 'second').toDate()
      }
      totalDuration={endDuration}
      terminalPercentage={100}
      onExpire={() => {
        onExpiration()
        setInCooldown(true)
      }}
      formatter={(value) => {
        if (inCooldown && value !== 0) {
          return <FontAwesomeIcon icon={faSave} />
        } else {
          return Math.max(value, 0)
        }
      }}
      className={{ countdown: 'font-bold', root: twMerge('ml-2', className) }}
    />
  )
}

export default LiveQuizCountdown
