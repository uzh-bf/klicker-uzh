import type { ElementInstance } from '@klicker-uzh/graphql/dist/ops'
import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import type { InstanceStackStudentResponseType } from '@klicker-uzh/shared-components/src/StudentElement'
import useSingleStudentResponse from '@klicker-uzh/shared-components/src/hooks/useSingleStudentResponse'
import type { Dispatch, SetStateAction } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const effectHarness = vi.hoisted(() => {
  let previousDependencies: readonly unknown[] | undefined

  return {
    reset() {
      previousDependencies = undefined
    },
    useEffect(effect: () => void, dependencies?: readonly unknown[]) {
      const changed =
        !dependencies ||
        !previousDependencies ||
        dependencies.length !== previousDependencies.length ||
        dependencies.some(
          (dependency, index) =>
            !Object.is(dependency, previousDependencies![index])
        )

      if (changed) {
        previousDependencies = dependencies
        effect()
      }
    },
  }
})

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return { ...actual, useEffect: effectHarness.useEffect }
})

describe('useSingleStudentResponse', () => {
  beforeEach(() => effectHarness.reset())

  it('resets the same instance when its attempt scope changes', () => {
    const instance = {
      elementData: {
        __typename: 'FreeTextElementData',
        type: ElementType.FreeText,
      },
    } as unknown as ElementInstance
    const setStudentResponse = vi.fn()
    const dispatch = setStudentResponse as unknown as Dispatch<
      SetStateAction<InstanceStackStudentResponseType>
    >

    useSingleStudentResponse({
      instance,
      setStudentResponse: dispatch,
      resetKey: 'attempt-1',
    })
    expect(setStudentResponse).toHaveBeenCalledOnce()

    setStudentResponse.mockClear()
    useSingleStudentResponse({
      instance,
      setStudentResponse: dispatch,
      resetKey: 'attempt-2',
    })

    expect(setStudentResponse).toHaveBeenCalledWith({
      type: ElementType.FreeText,
      response: undefined,
      valid: false,
    })
  })
})
