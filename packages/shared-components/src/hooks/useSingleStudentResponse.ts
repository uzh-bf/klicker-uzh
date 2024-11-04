import type { ElementInstance } from '@klicker-uzh/graphql/dist/ops'
import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import React, { useEffect } from 'react'
import type {
  ElementChoicesType,
  SingleStudentResponseType,
} from '../StudentElement'

function useSingleStudentResponse({
  instance,
  setStudentResponse,
  defaultRead = false,
}: {
  instance?: ElementInstance
  setStudentResponse: React.Dispatch<
    React.SetStateAction<SingleStudentResponseType>
  >
  defaultRead?: boolean
}) {
  useEffect(() => {
    if (!instance) {
      return
    }

    if (instance.elementData.__typename === 'ChoicesElementData') {
      setStudentResponse({
        type: instance.elementData.type as ElementChoicesType,
        response: instance.elementData.options.choices.reduce(
          (acc, _, ix) => {
            return { ...acc, [ix]: undefined }
          },
          {} as Record<number, boolean | undefined>
        ),
        valid: false,
      })
    } else if (instance.elementData.type === ElementType.Content) {
      setStudentResponse({
        type: instance.elementData.type,
        response: defaultRead ? true : undefined,
        valid: true,
      })
    }
    // default case - valid for FREE_TEXT, NUMERICAL, FLASHCARD elements
    else {
      setStudentResponse({
        type: instance.elementData.type,
        response: undefined,
        valid: false,
      })
    }
  }, [instance])
}

export default useSingleStudentResponse
