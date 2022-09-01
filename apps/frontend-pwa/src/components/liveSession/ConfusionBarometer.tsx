import { useMutation } from '@apollo/client'
import { push } from '@socialgouv/matomo-next'
import localForage from 'localforage'
import _debounce from 'lodash/debounce'
import { useCallback, useEffect, useRef, useState } from 'react'

import AddConfusionTSMutation from '../../../graphql/mutations/AddConfusionTSMutation.graphql'
import ConfusionDialog from '../../interaction/confusion/ConfusionDialog'

interface Props {
  shortname: string
  sessionId: string
}

function ConfusionBarometer({ shortname, sessionId }: Props) {
  const [confusionDifficulty, setConfusionDifficulty] = useState(0)
  const [confusionSpeed, setConfusionSpeed] = useState(0)
  const [isConfusionEnabled, setConfusionEnabled] = useState(true)
  const confusionButtonTimeout = useRef<any>()
  const [newConfusionTS] = useMutation(AddConfusionTSMutation)

  useEffect((): void => {
    const exec = async () => {
      try {
        const confusion: any = await localForage.getItem(
          `${shortname}-${sessionId}-confusion`
        )
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
  const handleNewConfusionTS = async ({
    speed = 0,
    difficulty = 0,
  }): Promise<void> => {
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
      push([
        'trackEvent',
        'Join Session',
        'Confusion Interacted',
        `speed=${speed},difficulty=${difficulty}`,
      ])
    } catch ({ message }) {
      console.error(message)
    } finally {
      setConfusionEnabled(false)
      if (confusionButtonTimeout.current) {
        clearTimeout(confusionButtonTimeout.current)
      }
      confusionButtonTimeout.current = setTimeout(
        setConfusionEnabled,
        60000,
        true
      )
    }
  }

  const debouncedHandleNewConfusionTS = useCallback(
    _debounce(handleNewConfusionTS, 4000, { trailing: true }),
    []
  )

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
        handleChange={(newValue: any): Promise<void> =>
          onNewConfusionTS(newValue, 'speed')
        }
        icons={{
          min: '🐌',
          mid: '😀',
          max: '🦘',
        }}
        labels={{
          min: 'slow',
          mid: 'optimal',
          max: 'fast',
        }}
        title="Speed"
        value={confusionSpeed}
      />
      <ConfusionDialog
        disabled={!isConfusionEnabled}
        handleChange={(newValue: any): Promise<void> =>
          onNewConfusionTS(newValue, 'difficulty')
        }
        icons={{
          min: '😴',
          mid: '😀',
          max: '🤯',
        }}
        labels={{
          min: 'easy',
          mid: 'optimal',
          max: 'difficult',
        }}
        title="Difficulty"
        value={confusionDifficulty}
      />
    </div>
  )
}

export default ConfusionBarometer
