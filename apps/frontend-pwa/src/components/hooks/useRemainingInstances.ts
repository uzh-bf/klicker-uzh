import { ElementInstance, ElementType } from '@klicker-uzh/graphql/dist/ops'
import localForage from 'localforage'
import { Dispatch, SetStateAction, useEffect } from 'react'

function useRemainingInstances({
  quizId,
  instances,
  execution,
  isBlockCompleted,
  setRemainingQuestions,
  setActiveInstance,
  participantId,
}: {
  quizId: string
  instances: ElementInstance[]
  execution: number
  isBlockCompleted: boolean
  setRemainingQuestions: Dispatch<SetStateAction<number[] | null>>
  setActiveInstance: Dispatch<SetStateAction<number>>
  participantId?: string
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

        const parseStoredResponses = (stored: unknown): string[] => {
          const parsed =
            typeof stored === 'string' ? JSON.parse(stored) : stored
          return Array.isArray((parsed as any)?.responses)
            ? (parsed as any).responses
            : []
        }
        const storedResponses = new Set(
          parseStoredResponses(await localForage.getItem(`${quizId}-responses`))
        )
        const storedCodeResponses = new Set(
          participantId
            ? parseStoredResponses(
                await localForage.getItem(
                  `${quizId}-p-${participantId}-responses`
                )
              )
            : []
        )

        const remaining = instances
          .map((instance) => instance.id)
          .reduce<number[]>((indices, instanceId, index) => {
            const instance = instances[index]
            const responseKey = `${instanceId}-${execution}`
            const answered =
              instance?.elementType === ElementType.Code
                ? storedCodeResponses.has(responseKey)
                : storedResponses.has(responseKey)
            if (answered) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId, instances, execution, isBlockCompleted, participantId])
}

export default useRemainingInstances
