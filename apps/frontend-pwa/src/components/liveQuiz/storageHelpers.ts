import { ElementInstance, ElementType } from '@klicker-uzh/graphql/dist/ops'
import { InstanceStackStudentResponseType } from '@klicker-uzh/shared-components/src/StudentElement'
import {
  validateCaseStudyResponse,
  validateFreeTextResponse,
  validateKprimResponse,
  validateMcResponse,
  validateNumericalResponse,
  validateScResponse,
  validateSelectionResponse,
} from '@klicker-uzh/shared-components/src/utils/validateResponse'
import {
  FreeTextElementData,
  isValidQrScanCode,
  NumericalElementData,
} from '@klicker-uzh/types'
import dayjs from 'dayjs'
import localforage from 'localforage'
import { Dispatch, SetStateAction } from 'react'

export async function updateStoredResponses(
  instanceId: number | number[],
  quizId: string,
  execution: number
) {
  if (typeof window !== 'undefined') {
    try {
      const prevResponses: any = await localforage.getItem(
        `${quizId}-responses`
      )
      let newResponses: string[] = []

      if (Array.isArray(instanceId)) {
        newResponses = instanceId.map(
          (instanceId: number) => `${instanceId}-${execution}`
        )
      } else {
        newResponses = [`${instanceId}-${execution}`]
      }
      const stringified = JSON.stringify(
        prevResponses
          ? {
              responses: [
                ...JSON.parse(prevResponses).responses,
                ...newResponses,
              ],
              timestamp: dayjs().unix(),
            }
          : {
              responses: newResponses,
              timestamp: dayjs().unix(),
            }
      )
      await localforage.setItem(`${quizId}-responses`, stringified)
    } catch (e) {
      console.error(e)
    }
  }
}

export async function loadStoredResponse({
  quizId,
  execution,
  currentInstance,
  setStudentResponse,
  setSubmittedAt,
}: {
  quizId: string
  execution: number
  currentInstance: ElementInstance | undefined
  setStudentResponse: Dispatch<SetStateAction<InstanceStackStudentResponseType>>
  setSubmittedAt: Dispatch<SetStateAction<number | null>>
}) {
  if (!currentInstance) return
  try {
    const key = `lq-${quizId}-ex-${execution}-i-${currentInstance.id}`
    const stored = (await localforage.getItem(key)) as any
    const tempStored = (await localforage.getItem(`${key}-temp`)) as any

    // if neither a submitted response, nor a temporary response exists, return early
    if (!stored && !tempStored) return

    // if the block was already submitted, load the previously submitted response and remove the temporary one (if it exists)
    if (stored) {
      setStudentResponse({
        type: currentInstance.elementType,
        response: stored.response as any,
        valid: true,
      })

      if (typeof stored.responseTimestamp === 'number') {
        setSubmittedAt(stored.responseTimestamp)
      }

      // if still exists, remove the temporary response
      if (tempStored) {
        await localforage.removeItem(`${key}-temp`)
      }
    } else {
      setSubmittedAt(null)
      setStudentResponse({
        type: currentInstance.elementType,
        response: tempStored as any,
        valid: false, // initialize loaded response with invalid -> subsequent validation
      })

      // validate the loaded student response and set validity flag accordingly
      if (tempStored) {
        if (currentInstance.elementType === ElementType.Sc) {
          const valid = validateScResponse({ response: tempStored })
          setStudentResponse((prev) => ({ ...prev, valid }))
        } else if (currentInstance.elementType === ElementType.Mc) {
          const valid = validateMcResponse({ response: tempStored })
          setStudentResponse((prev) => ({ ...prev, valid }))
        } else if (currentInstance.elementType === ElementType.Kprim) {
          const valid = validateKprimResponse({ response: tempStored })
          setStudentResponse((prev) => ({ ...prev, valid }))
        } else if (currentInstance.elementType === ElementType.Numerical) {
          const valid = validateNumericalResponse({
            response: tempStored,
            options: (currentInstance.elementData as NumericalElementData)
              .options,
          })
          setStudentResponse((prev) => ({ ...prev, valid }))
        } else if (currentInstance.elementType === ElementType.FreeText) {
          const valid = validateFreeTextResponse({
            response: tempStored,
            options: (currentInstance.elementData as FreeTextElementData)
              .options,
          })
          setStudentResponse((prev) => ({ ...prev, valid }))
        } else if (currentInstance.elementType === ElementType.QrScan) {
          const valid = isValidQrScanCode(tempStored)
          setStudentResponse((prev) => ({ ...prev, valid }))
        } else if (currentInstance.elementType === ElementType.Selection) {
          const valid = validateSelectionResponse({ response: tempStored })
          setStudentResponse((prev) => ({ ...prev, valid }))
        } else if (currentInstance.elementType === ElementType.CaseStudy) {
          const valid = validateCaseStudyResponse({ response: tempStored })
          setStudentResponse((prev) => ({ ...prev, valid }))
        } else if (currentInstance.elementType === ElementType.Content) {
          // content elements are always valid
          setStudentResponse((prev) => ({ ...prev, valid: true }))
        }
      }
    }
  } catch (e) {
    console.error(e)
  }
}
