import {
  ChoicesElementData,
  ElementInstance,
  ElementType,
  FlashcardCorrectnessType,
  FreeTextElementData,
  InstanceEvaluation,
  NumericalElementData,
  StackFeedbackStatus,
} from '@klicker-uzh/graphql/dist/ops'
import React, { Dispatch, SetStateAction } from 'react'
import ChoicesQuestion from './ChoicesQuestion'
import ContentElement from './ContentElement'
import Flashcard from './Flashcard'
import FreeTextQuestion from './FreeTextQuestion'
import NumericalQuestion from './NumericalQuestion'

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
      evaluation?: InstanceEvaluation
    }
  | {
      type: ElementType.Content
      response?: boolean
      correct?: StackFeedbackStatus
      valid?: boolean
      evaluation?: InstanceEvaluation
    }
  | {
      type: ElementType.Sc | ElementType.Mc | ElementType.Kprim
      response?: Record<number, boolean | undefined>
      correct?: StackFeedbackStatus
      valid?: boolean
      evaluation?: InstanceEvaluation
    }
  | {
      type: ElementType.Numerical
      response?: string
      correct?: StackFeedbackStatus
      valid?: boolean
      evaluation?: InstanceEvaluation
    }
  | {
      type: ElementType.FreeText
      response?: string
      correct?: StackFeedbackStatus
      valid?: boolean
      evaluation?: InstanceEvaluation
    }
>

interface StudentElementProps {
  element: ElementInstance
  elementIx: number
  studentResponse: StudentResponseType
  setStudentResponse: Dispatch<SetStateAction<StudentResponseType>>
  stackStorage?: StudentResponseType
  hideReadButton?: boolean
  disabledInput?: boolean
}

function StudentElement({
  element,
  elementIx,
  studentResponse,
  setStudentResponse,
  stackStorage,
  hideReadButton = false,
  disabledInput = false,
}: StudentElementProps) {
  if (element.elementData.type === ElementType.Flashcard) {
    return (
      <Flashcard
        key={element.id}
        content={element.elementData.content}
        explanation={element.elementData.explanation!}
        response={
          studentResponse[element.id]?.response as FlashcardCorrectnessType
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
          stackStorage?.[element.id]?.response as FlashcardCorrectnessType
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
          studentResponse[element.id]?.response as Record<number, boolean>
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
          stackStorage?.[element.id]?.response as Record<number, boolean>
        }
        evaluation={stackStorage?.[element.id]?.evaluation}
        elementIx={elementIx}
        disabled={disabledInput}
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
        existingResponse={stackStorage?.[element.id]?.response as string}
        evaluation={stackStorage?.[element.id]?.evaluation}
        elementIx={elementIx}
        disabled={disabledInput}
      />
    )
  } else if (element.elementData.type === ElementType.FreeText) {
    return (
      <FreeTextQuestion
        key={element.id}
        content={element.elementData.content}
        options={(element.elementData as FreeTextElementData).options}
        response={studentResponse[element.id]?.response as string}
        valid={studentResponse[element.id]?.valid as boolean}
        setResponse={(newValue, valid) => {
          setStudentResponse((response) => {
            return {
              ...response,
              [element.id]: {
                ...response[element.id],
                type: ElementType.FreeText,
                response: newValue,
                valid: valid,
              },
            }
          })
        }}
        existingResponse={stackStorage?.[element.id]?.response as string}
        evaluation={stackStorage?.[element.id]?.evaluation}
        elementIx={elementIx}
        disabled={disabledInput}
      />
    )
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
        hideReadButton={hideReadButton}
      />
    )
  } else {
    return null
  }
}

export default StudentElement
