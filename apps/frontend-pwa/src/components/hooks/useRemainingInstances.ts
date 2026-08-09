import { ElementInstance } from '@klicker-uzh/graphql/dist/ops'
import localForage from 'localforage'
import { Dispatch, SetStateAction, useEffect } from 'react'

function useRemainingInstances({
  quizId,
  instances,
  execution,
  isBlockCompleted,
  setRemainingQuestions,
  setActiveInstance,
}: {
  quizId: string
  instances: ElementInstance[]
  execution: number
  isBlockCompleted: boolean
  setRemainingQuestions: Dispatch<SetStateAction<number[] | null>>
  setActiveInstance: Dispatch<SetStateAction<number>>
}): void {
  useEffect((): void => {
    const exec = async () => {
      try {
        // if the block is already completed, automatically jump to the first instance and return early
        if (isBlockCompleted) {
          setActiveInstance(0)
          setRemainingQuestions([])
          return
        }

        let storedResponses: any = (await localForage.getItem(
          `${quizId}-responses`
        )) || {
          responses: [],
        }

        if (typeof storedResponses === 'string') {
          storedResponses = JSON.parse(storedResponses)
        }

        const remaining = instances
          .map((instance) => instance.id)
          .reduce<number[]>((indices, instanceId, index) => {
            if (
              storedResponses?.responses?.includes(`${instanceId}-${execution}`)
            ) {
              return indices
            }

            return [...indices, index]
          }, [])

        setActiveInstance(remaining[0] ?? instances.length - 1)
        setRemainingQuestions(remaining)
      } catch (e) {
        console.error(e)
      }
    }
    exec()
  }, [
    execution,
    instances,
    isBlockCompleted,
    quizId,
    setActiveInstance,
    setRemainingQuestions,
  ])
}

export default useRemainingInstances
