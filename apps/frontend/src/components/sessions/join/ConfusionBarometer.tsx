import { useState, useEffect, useRef, useCallback } from 'react'
import { useMutation } from '@apollo/client'
import localForage from 'localforage'
import _debounce from 'lodash/debounce'
import { push } from '@socialgouv/matomo-next'
import { useIntl, defineMessages, FormattedMessage } from 'react-intl'

import ConfusionDialog from '../../interaction/confusion/ConfusionDialog'
import AddConfusionTSMutation from '../../../graphql/mutations/AddConfusionTSMutation.graphql'

const messages = defineMessages({
  feedbackPlaceholder: {
    id: 'joinSession.feedbackArea.feedbackPlaceholder',
    defaultMessage: 'Post a question or feedback...',
  },
  difficultyRangeMin: {
    defaultMessage: 'easy',
    id: 'runningSession.confusion.difficulty.RangeMin',
  },
  difficultyRangeMid: {
    defaultMessage: 'optimal',
    id: 'runningSession.confusion.difficulty.RangeMid',
  },
  difficultyRangeMax: {
    defaultMessage: 'difficult',
    id: 'runningSession.confusion.difficulty.RangeMax',
  },
  speedRangeMin: {
    defaultMessage: 'slow',
    id: 'runningSession.confusion.speed.RangeMin',
  },
  speedRangeMid: {
    defaultMessage: 'optimal',
    id: 'runningSession.confusion.speed.RangeMid',
  },
  speedRangeMax: {
    defaultMessage: 'fast',
    id: 'runningSession.confusion.speed.RangeMax',
  },
})

interface Props {
  shortname: string
  sessionId: string
}

function ConfusionBarometer({ shortname, sessionId }: Props) {
  const intl = useIntl()

  const [confusionDifficulty, setConfusionDifficulty] = useState(0)
  const [confusionSpeed, setConfusionSpeed] = useState(0)
  const [isConfusionEnabled, setConfusionEnabled] = useState(true)
  const confusionButtonTimeout = useRef<any>()
  const [newConfusionTS] = useMutation(AddConfusionTSMutation)

  useEffect((): void => {
    const exec = async () => {
      try {
        const confusion: any = await localForage.getItem(`${shortname}-${sessionId}-confusion`)
        if (confusion) {
          setConfusionSpeed(confusion.prevSpeed)
          setConfusionDifficulty(confusion.prevDifficulty)
        }
      } catch (e) {
        console.error(e)
      }
    }
    exec()
  }, [])

  // handle creation of a new confusion timestep with debounce for aggregation
  const handleNewConfusionTS = async ({ speed = 0, difficulty = 0 }): Promise<void> => {
    try {
      newConfusionTS({
        variables: {
          speed,
          difficulty,
          // fp: fingerprint,
          sessionId,
        },
      })
      localForage.setItem(`${shortname}-${sessionId}-confusion`, {
        prevSpeed: speed,
        prevDifficulty: difficulty,
      })
      push(['trackEvent', 'Join Session', 'Confusion Interacted', `speed=${speed},difficulty=${difficulty}`])
    } catch ({ message }) {
      console.error(message)
    } finally {
      setConfusionEnabled(false)
      if (confusionButtonTimeout.current) {
        clearTimeout(confusionButtonTimeout.current)
      }
      confusionButtonTimeout.current = setTimeout(setConfusionEnabled, 60000, true)
    }
  }

  const debouncedHandleNewConfusionTS = useCallback(_debounce(handleNewConfusionTS, 4000, { trailing: true }), [])

  const onNewConfusionTS = async (newValue: any, selector: string) => {
    // send the new confusion entry to the server
    if (selector === 'speed') {
      setConfusionSpeed(newValue)
    } else if (selector === 'difficulty') {
      setConfusionDifficulty(newValue)
    }

    debouncedHandleNewConfusionTS({
      speed: selector === 'speed' ? newValue : confusionSpeed,
      difficulty: selector === 'difficulty' ? newValue : confusionDifficulty,
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <ConfusionDialog
        disabled={!isConfusionEnabled}
        handleChange={(newValue: any): Promise<void> => onNewConfusionTS(newValue, 'speed')}
        icons={{
          min: '🐌',
          mid: '😀',
          max: '🦘',
        }}
        labels={{
          min: intl.formatMessage(messages.speedRangeMin),
          mid: intl.formatMessage(messages.speedRangeMid),
          max: intl.formatMessage(messages.speedRangeMax),
        }}
        title={<FormattedMessage defaultMessage="Speed" id="common.string.speed" />}
        value={confusionSpeed}
      />
      <ConfusionDialog
        disabled={!isConfusionEnabled}
        handleChange={(newValue: any): Promise<void> => onNewConfusionTS(newValue, 'difficulty')}
        icons={{
          min: '😴',
          mid: '😀',
          max: '🤯',
        }}
        labels={{
          min: intl.formatMessage(messages.difficultyRangeMin),
          mid: intl.formatMessage(messages.difficultyRangeMid),
          max: intl.formatMessage(messages.difficultyRangeMax),
        }}
        title={<FormattedMessage defaultMessage="Difficulty" id="common.string.difficulty" />}
        value={confusionDifficulty}
      />
    </div>
  )
}

export default ConfusionBarometer
