import { ElementInstance } from '@klicker-uzh/graphql/dist/ops'
import localForage from 'localforage'
import { Dispatch, SetStateAction, useEffect } from 'react'

function useRemainingInstances({
  quizId,
  instances,
  execution,
  setRemainingQuestions,
  setActiveInstance,
}: {
  quizId: string
  instances: ElementInstance[]
  execution: number
  setRemainingQuestions: Dispatch<SetStateAction<number[]>>
  setActiveInstance: Dispatch<SetStateAction<number>>
}): void {
  useEffect((): void => {
    const exec = async () => {
      try {
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

        setActiveInstance(remaining[0])
        setRemainingQuestions(remaining)
      } catch (e) {
        console.error(e)
      }
    }
    exec()
  }, [quizId, instances, execution])
}

export default useRemainingInstances
