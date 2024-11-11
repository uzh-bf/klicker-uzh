import type {
  ElementInstance,
  FlashcardCorrectness,
  InstanceEvaluation,
} from '@klicker-uzh/graphql/dist/ops'
import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import type { Dispatch, SetStateAction } from 'react'
import React from 'react'
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
      response?: FlashcardCorrectness
      valid?: boolean
      evaluation?: InstanceEvaluation
    }
  | {
      type: ElementType.Content
      response?: boolean
      valid?: boolean
      evaluation?: InstanceEvaluation
    }
  | {
      type: ElementType.Sc | ElementType.Mc | ElementType.Kprim
      response?: Record<number, boolean | undefined>
      valid?: boolean
      evaluation?: InstanceEvaluation
    }
  | {
      type: ElementType.Numerical
      response?: string
      valid?: boolean
      evaluation?: InstanceEvaluation
    }
  | {
      type: ElementType.FreeText
      response?: string
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
  const evaluation = stackStorage?.[element.id]?.evaluation

  if (element.elementData.__typename === 'FlashcardElementData') {
    return (
      <Flashcard
        key={element.id}
        content={element.elementData.content}
        explanation={element.elementData.explanation!}
        response={studentResponse[element.id]?.response as FlashcardCorrectness}
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
          stackStorage?.[element.id]?.response as FlashcardCorrectness
        }
        elementIx={elementIx}
      />
    )
  } else if (element.elementData.__typename === 'ChoicesElementData') {
    return (
      <ChoicesQuestion
        key={element.id}
        content={element.elementData.content}
        type={element.elementData.type as ElementChoicesType}
        options={element.elementData.options}
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
        evaluation={
          evaluation && evaluation.__typename === 'ChoicesInstanceEvaluation'
            ? evaluation
            : undefined
        }
        elementIx={elementIx}
        disabled={disabledInput}
      />
    )
  } else if (element.elementData.__typename === 'NumericalElementData') {
    return (
      <NumericalQuestion
        key={element.id}
        content={element.elementData.content}
        options={element.elementData.options}
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
        evaluation={
          evaluation && evaluation.__typename === 'NumericalInstanceEvaluation'
            ? evaluation
            : undefined
        }
        elementIx={elementIx}
        disabled={disabledInput}
      />
    )
  } else if (element.elementData.__typename === 'FreeTextElementData') {
    return (
      <FreeTextQuestion
        key={element.id}
        content={element.elementData.content}
        options={element.elementData.options}
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
        evaluation={
          evaluation && evaluation.__typename === 'FreeTextInstanceEvaluation'
            ? evaluation
            : undefined
        }
        elementIx={elementIx}
        disabled={disabledInput}
      />
    )
  } else if (element.elementData.__typename === 'ContentElementData') {
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
