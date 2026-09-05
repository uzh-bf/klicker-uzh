import type {
  ElementInstance,
  FlashcardCorrectness,
  InstanceEvaluation,
} from '@klicker-uzh/graphql/dist/ops'
import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import type { Dispatch, SetStateAction } from 'react'
import CaseStudyQuestion from './CaseStudyQuestion'
import ChoicesQuestion from './ChoicesQuestion'
import ContentElement from './ContentElement'
import Flashcard from './Flashcard'
import FreeTextQuestion from './FreeTextQuestion'
import NumericalQuestion from './NumericalQuestion'
import SelectionQuestion from './SelectionQuestion'

export type ElementChoicesType =
  | ElementType.Sc
  | ElementType.Mc
  | ElementType.Kprim

export type ChoicesStudentResponseType = {
  [optionIx: number]: boolean | undefined
}

export type SelectionStudentResponseType = {
  [inputIx: number]: number // collection entry id
}

export type CaseStudyStudentResponseType = {
  [caseId: string]: {
    [itemId: string]: {
      [criterionId: string]: number | undefined
    }
  }
}

export type InstanceStackStudentResponseType =
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
      response?: ChoicesStudentResponseType
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
  | {
      type: ElementType.Selection
      response?: SelectionStudentResponseType
      valid?: boolean
      evaluation?: InstanceEvaluation
    }
  | {
      type: ElementType.CaseStudy
      response?: CaseStudyStudentResponseType
      valid?: boolean
      evaluation?: InstanceEvaluation
    }

export type StackStudentResponseType = Record<
  number,
  InstanceStackStudentResponseType
>

interface StudentElementBaseProps {
  element: ElementInstance
  elementIx: number
  hideReadButton?: boolean
  disabledInput?: boolean
  sequential?: boolean
  preview?: boolean
}

interface StudentElementStackProps extends StudentElementBaseProps {
  studentResponse: StackStudentResponseType
  setStudentResponse: Dispatch<SetStateAction<StackStudentResponseType>>
  stackStorage?: StackStudentResponseType
  singleStudentResponse?: never
  setSingleStudentResponse?: never
}

interface StudentElementSingleProps extends StudentElementBaseProps {
  studentResponse?: never
  setStudentResponse?: never
  stackStorage?: StackStudentResponseType
  singleStudentResponse: InstanceStackStudentResponseType
  setSingleStudentResponse: Dispatch<
    SetStateAction<InstanceStackStudentResponseType>
  >
}

function StudentElement({
  element,
  elementIx,
  studentResponse,
  setStudentResponse,
  stackStorage,
  singleStudentResponse,
  setSingleStudentResponse,
  hideReadButton = false,
  disabledInput = false,
  sequential = false, // chose cases of case study element sequentially to student
  preview = false,
}: StudentElementStackProps | StudentElementSingleProps) {
  const evaluation = stackStorage?.[element.id]?.evaluation

  if (element.elementData.__typename === 'ChoicesElementData') {
    return (
      <ChoicesQuestion
        key={element.id}
        preview={preview}
        content={element.elementData.content}
        type={element.elementData.type as ElementChoicesType}
        options={element.elementData.options}
        response={
          typeof studentResponse !== 'undefined'
            ? (studentResponse[element.id]
                ?.response as ChoicesStudentResponseType)
            : (singleStudentResponse.response as ChoicesStudentResponseType)
        }
        setResponse={(newValue, valid) => {
          typeof setStudentResponse !== 'undefined'
            ? setStudentResponse((response) => {
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
            : setSingleStudentResponse((response) => {
                return {
                  ...response,
                  type: element.elementData.type as ElementChoicesType,
                  response: newValue,
                  valid: valid,
                }
              })
        }}
        existingResponse={
          stackStorage?.[element.id]?.response as ChoicesStudentResponseType
        }
        evaluation={
          evaluation && evaluation.__typename === 'ChoicesInstanceEvaluation'
            ? evaluation
            : undefined
        }
        elementIx={elementIx}
        noPoints={
          element.elementData.basePoints === false &&
          !element.elementData.options.hasSampleSolution
        }
        disabled={disabledInput}
      />
    )
  } else if (element.elementData.__typename === 'NumericalElementData') {
    return (
      <NumericalQuestion
        key={element.id}
        preview={preview}
        content={element.elementData.content}
        options={element.elementData.options}
        response={
          typeof studentResponse !== 'undefined'
            ? (studentResponse[element.id]?.response as string)
            : (singleStudentResponse.response as string)
        }
        valid={
          typeof studentResponse !== 'undefined'
            ? (studentResponse[element.id]?.valid as boolean)
            : (singleStudentResponse.valid as boolean)
        }
        setResponse={(newValue, valid) => {
          typeof setStudentResponse !== 'undefined'
            ? setStudentResponse((response) => {
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
            : setSingleStudentResponse((response) => {
                return {
                  ...response,
                  type: ElementType.Numerical,
                  response: newValue,
                  valid: valid,
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
        noPoints={
          element.elementData.basePoints === false &&
          !element.elementData.options.hasSampleSolution
        }
        disabled={disabledInput}
      />
    )
  } else if (element.elementData.__typename === 'FreeTextElementData') {
    return (
      <FreeTextQuestion
        key={element.id}
        preview={preview}
        content={element.elementData.content}
        options={element.elementData.options}
        response={
          typeof studentResponse !== 'undefined'
            ? (studentResponse[element.id]?.response as string)
            : (singleStudentResponse.response as string)
        }
        valid={
          typeof studentResponse !== 'undefined'
            ? (studentResponse[element.id]?.valid as boolean)
            : (singleStudentResponse.valid as boolean)
        }
        setResponse={(newValue, valid) => {
          typeof setStudentResponse !== 'undefined'
            ? setStudentResponse((response) => {
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
            : setSingleStudentResponse((response) => {
                return {
                  ...response,
                  type: ElementType.FreeText,
                  response: newValue,
                  valid: valid,
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
        noPoints={
          element.elementData.basePoints === false &&
          !element.elementData.options.hasSampleSolution
        }
        disabled={disabledInput}
      />
    )
  } else if (element.elementData.__typename === 'SelectionElementData') {
    return (
      <SelectionQuestion
        key={element.id}
        preview={preview}
        content={element.elementData.content}
        options={element.elementData.options}
        response={
          typeof studentResponse !== 'undefined'
            ? (studentResponse[element.id]
                ?.response as SelectionStudentResponseType)
            : (singleStudentResponse.response as SelectionStudentResponseType)
        }
        valid={
          typeof studentResponse !== 'undefined'
            ? (studentResponse[element.id]?.valid as boolean)
            : (singleStudentResponse.valid as boolean)
        }
        setResponse={(newValue, valid) => {
          typeof setStudentResponse !== 'undefined'
            ? setStudentResponse((response) => {
                return {
                  ...response,
                  [element.id]: {
                    ...response[element.id],
                    type: ElementType.Selection,
                    response: newValue,
                    valid: valid,
                  },
                }
              })
            : setSingleStudentResponse((response) => {
                return {
                  ...response,
                  type: ElementType.Selection,
                  response: newValue,
                  valid: valid,
                }
              })
        }}
        existingResponse={
          stackStorage?.[element.id]?.response as SelectionStudentResponseType
        }
        evaluation={
          evaluation && evaluation.__typename === 'SelectionInstanceEvaluation'
            ? evaluation
            : undefined
        }
        elementIx={elementIx}
        noPoints={
          element.elementData.basePoints === false &&
          !element.elementData.options.hasSampleSolution
        }
        disabled={disabledInput}
      />
    )
  } else if (element.elementData.__typename === 'CaseStudyElementData') {
    return (
      <CaseStudyQuestion
        key={element.id}
        preview={preview}
        sequential={sequential}
        content={element.elementData.content}
        options={element.elementData.options}
        response={
          typeof studentResponse !== 'undefined'
            ? (studentResponse[element.id]
                ?.response as CaseStudyStudentResponseType)
            : (singleStudentResponse.response as CaseStudyStudentResponseType)
        }
        setResponse={(newValue, valid) => {
          typeof setStudentResponse !== 'undefined'
            ? setStudentResponse((response) => {
                return {
                  ...response,
                  [element.id]: {
                    ...response[element.id],
                    type: ElementType.CaseStudy,
                    response: newValue,
                    valid: valid,
                  },
                }
              })
            : setSingleStudentResponse((response) => {
                return {
                  ...response,
                  type: ElementType.CaseStudy,
                  response: newValue,
                  valid: valid,
                }
              })
        }}
        existingResponse={
          stackStorage?.[element.id]?.response as CaseStudyStudentResponseType
        }
        evaluation={
          evaluation && evaluation.__typename === 'CaseStudyInstanceEvaluation'
            ? evaluation
            : undefined
        }
        elementIx={elementIx}
        noPoints={
          element.elementData.basePoints === false &&
          !element.elementData.options.hasSampleSolution
        }
        disabled={disabledInput}
      />
    )
  } else if (element.elementData.__typename === 'FlashcardElementData') {
    return (
      <Flashcard
        key={element.id}
        content={element.elementData.content}
        explanation={element.elementData.explanation!}
        response={
          typeof studentResponse !== 'undefined'
            ? (studentResponse[element.id]?.response as FlashcardCorrectness)
            : (singleStudentResponse.response as FlashcardCorrectness)
        }
        setResponse={(studentResponse) => {
          typeof setStudentResponse !== 'undefined'
            ? setStudentResponse((response) => {
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
            : setSingleStudentResponse((response) => {
                return {
                  ...response,
                  type: ElementType.Flashcard,
                  response: studentResponse,
                  valid: true,
                }
              })
        }}
        existingResponse={
          stackStorage?.[element.id]?.response as FlashcardCorrectness
        }
        elementIx={elementIx}
      />
    )
  } else if (element.elementData.__typename === 'ContentElementData') {
    return (
      <ContentElement
        key={element.id}
        element={element}
        read={
          (stackStorage?.[element.id]?.response as boolean) ||
          (typeof studentResponse !== 'undefined'
            ? (studentResponse[element.id]?.response as boolean)
            : (singleStudentResponse.response as boolean))
        }
        onRead={() => {
          typeof setStudentResponse !== 'undefined'
            ? setStudentResponse((response) => {
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
            : setSingleStudentResponse((response) => {
                return {
                  ...response,
                  type: ElementType.Content,
                  response: true,
                  valid: true,
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
