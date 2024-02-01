import {
  ChoicesElementData,
  ElementStack,
  ElementType,
  FlashcardCorrectnessType,
  NumericalElementData,
  StackFeedbackStatus,
} from '@klicker-uzh/graphql/dist/ops'
import ChoicesQuestion from '@klicker-uzh/shared-components/src/ChoicesQuestion'
import FreeTextQuestion from '@klicker-uzh/shared-components/src/FreeTextQuestion'
import NumericalQuestion from '@klicker-uzh/shared-components/src/NumericalQuestion'
import { Dispatch, SetStateAction } from 'react'
import ContentElement from './ContentElement'
import Flashcard from './Flashcard'

interface StudentElementProps {
  stack: ElementStack
  studentResponse: StudentResponseType
  setStudentResponse: Dispatch<SetStateAction<StudentResponseType>>
  stackStorage: StudentResponseType
}

export type ElementChoicesType =
  | ElementType.Sc
  | ElementType.Mc
  | ElementType.Kprim

export type StudentResponseType = Record<
  number,
  | {
      type: ElementType.Flashcard
      response?: FlashcardCorrectnessType
      correct?: StackFeedbackStatus
      valid?: boolean
    }
  | {
      type: ElementType.Content
      response?: boolean
      correct?: StackFeedbackStatus
      valid?: boolean
    }
  | {
      type: ElementType.Sc | ElementType.Mc | ElementType.Kprim
      response?: Record<number, boolean | undefined>
      correct?: StackFeedbackStatus
      valid?: boolean
    }
  | {
      type: ElementType.Numerical
      response?: string
      correct?: StackFeedbackStatus
      valid?: boolean
    }
  | {
      type: ElementType.FreeText
      response?: string
      correct?: StackFeedbackStatus
      valid?: boolean
    }
>

function StudentElement({
  stack,
  studentResponse,
  setStudentResponse,
  stackStorage,
}: StudentElementProps) {
  return (
    <div className="flex flex-col gap-3">
      {stack.elements &&
        stack.elements.length > 0 &&
        stack.elements.map((element, elementIx) => {
          if (element.elementData.type === ElementType.Flashcard) {
            return (
              <Flashcard
                key={element.id}
                content={element.elementData.content}
                explanation={element.elementData.explanation!}
                response={
                  studentResponse[element.id]
                    ?.response as FlashcardCorrectnessType
                }
                setResponse={(studentResponse) => {
                  setStudentResponse((response) => {
                    return {
                      ...response,
                      [element.id]: {
                        ...response[element.id],
                        type: ElementType.Flashcard,
                        response: studentResponse,
                        valid: true,
                      },
                    }
                  })
                }}
                existingResponse={
                  stackStorage?.[element.id]
                    ?.response as FlashcardCorrectnessType
                }
                elementIx={elementIx}
              />
            )
          } else if (
            element.elementData.type === ElementType.Sc ||
            element.elementData.type === ElementType.Mc ||
            element.elementData.type === ElementType.Kprim
          ) {
            return (
              <ChoicesQuestion
                key={element.id}
                content={element.elementData.content}
                type={element.elementData.type}
                options={(element.elementData as ChoicesElementData).options}
                response={
                  studentResponse[element.id]?.response as Record<
                    number,
                    boolean
                  >
                }
                setResponse={(newValue, valid) => {
                  setStudentResponse((response) => {
                    return {
                      ...response,
                      [element.id]: {
                        ...response[element.id],
                        type: element.elementData.type as ElementChoicesType,
                        response: newValue,
                        valid: valid,
                      },
                    }
                  })
                }}
                existingResponse={
                  stackStorage?.[element.id]?.response as Record<
                    number,
                    boolean
                  >
                }
                elementIx={elementIx}
              />
            )
          } else if (element.elementData.type === ElementType.Numerical) {
            return (
              <NumericalQuestion
                key={element.id}
                content={element.elementData.content}
                options={(element.elementData as NumericalElementData).options}
                response={studentResponse[element.id]?.response as string}
                valid={studentResponse[element.id]?.valid as boolean}
                setResponse={(newValue, valid) => {
                  setStudentResponse((response) => {
                    return {
                      ...response,
                      [element.id]: {
                        ...response[element.id],
                        type: ElementType.Numerical,
                        response: newValue,
                        valid: valid,
                      },
                    }
                  })
                }}
                existingResponse={
                  stackStorage?.[element.id]?.response as string
                }
                elementIx={elementIx}
              />
            )
          } else if (element.elementData.type === ElementType.FreeText) {
            return <FreeTextQuestion key={element.id} />
          } else if (element.elementData.type === ElementType.Content) {
            return (
              <ContentElement
                key={element.id}
                element={element}
                read={
                  (stackStorage?.[element.id]?.response as boolean) ||
                  (studentResponse[element.id]?.response as boolean)
                }
                onRead={() => {
                  setStudentResponse((response) => {
                    return {
                      ...response,
                      [element.id]: {
                        ...response[element.id],
                        type: ElementType.Content,
                        response: true,
                        valid: true,
                      },
                    }
                  })
                }}
                elementIx={elementIx}
              />
            )
          } else {
            return null
          }
        })}
    </div>
  )
}

export default StudentElement
