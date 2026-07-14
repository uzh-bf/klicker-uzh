import type { ElementImportReviewModel } from './elementImportPreview'

type WorkflowBase = {
  generation: number
}

export type ElementImportWorkflowState =
  | (WorkflowBase & { phase: 'idle' })
  | (WorkflowBase & { phase: 'uploading'; fileName: string })
  | (WorkflowBase & { phase: 'validating'; fileName: string })
  | (WorkflowBase & {
      phase: 'reviewing'
      fileName: string
      review: ElementImportReviewModel
      commitError: string | null
    })
  | (WorkflowBase & {
      phase: 'importing'
      fileName: string
      review: ElementImportReviewModel
    })
  | (WorkflowBase & {
      phase: 'success'
      fileName: string
      importedElements: number
      cleanupPending: boolean
      refreshStatus: 'refreshing' | 'failed'
    })
  | (WorkflowBase & { phase: 'error'; message: string })

export type ElementImportWorkflowAction =
  | { type: 'START_UPLOAD'; generation: number; fileName: string }
  | { type: 'FILE_REJECTED'; generation: number; message: string }
  | { type: 'START_VALIDATION'; generation: number }
  | {
      type: 'REVIEW_READY'
      generation: number
      review: ElementImportReviewModel
    }
  | { type: 'UPLOAD_FAILED'; generation: number; message: string }
  | { type: 'START_IMPORT' }
  | { type: 'IMPORT_FAILED'; message: string }
  | {
      type: 'IMPORT_COMMITTED'
      importedElements: number
      cleanupPending: boolean
    }
  | { type: 'REFRESH_FAILED' }

export const initialElementImportWorkflowState: ElementImportWorkflowState = {
  phase: 'idle',
  generation: 0,
}

export function isElementImportWorkflowBusy(
  state: ElementImportWorkflowState
): boolean {
  return (
    state.phase === 'uploading' ||
    state.phase === 'validating' ||
    state.phase === 'importing'
  )
}

export function elementImportWorkflowReducer(
  state: ElementImportWorkflowState,
  action: ElementImportWorkflowAction
): ElementImportWorkflowState {
  switch (action.type) {
    case 'START_UPLOAD':
      if (
        isElementImportWorkflowBusy(state) ||
        action.generation <= state.generation
      ) {
        return state
      }
      return {
        phase: 'uploading',
        generation: action.generation,
        fileName: action.fileName,
      }
    case 'FILE_REJECTED':
      if (
        isElementImportWorkflowBusy(state) ||
        action.generation <= state.generation
      ) {
        return state
      }
      return {
        phase: 'error',
        generation: action.generation,
        message: action.message,
      }
    case 'START_VALIDATION':
      if (
        state.phase !== 'uploading' ||
        action.generation !== state.generation
      ) {
        return state
      }
      return { ...state, phase: 'validating' }
    case 'REVIEW_READY':
      if (
        state.phase !== 'validating' ||
        action.generation !== state.generation
      ) {
        return state
      }
      return {
        phase: 'reviewing',
        generation: state.generation,
        fileName: state.fileName,
        review: action.review,
        commitError: null,
      }
    case 'UPLOAD_FAILED':
      if (
        (state.phase !== 'uploading' && state.phase !== 'validating') ||
        action.generation !== state.generation
      ) {
        return state
      }
      return {
        phase: 'error',
        generation: state.generation,
        message: action.message,
      }
    case 'START_IMPORT':
      if (state.phase !== 'reviewing') {
        return state
      }
      return {
        phase: 'importing',
        generation: state.generation,
        fileName: state.fileName,
        review: state.review,
      }
    case 'IMPORT_FAILED':
      if (state.phase !== 'importing') {
        return state
      }
      return {
        phase: 'reviewing',
        generation: state.generation,
        fileName: state.fileName,
        review: state.review,
        commitError: action.message,
      }
    case 'IMPORT_COMMITTED':
      if (state.phase !== 'importing') {
        return state
      }
      return {
        phase: 'success',
        generation: state.generation,
        fileName: state.fileName,
        importedElements: action.importedElements,
        cleanupPending: action.cleanupPending,
        refreshStatus: 'refreshing',
      }
    case 'REFRESH_FAILED':
      if (state.phase !== 'success' || state.refreshStatus !== 'refreshing') {
        return state
      }
      return { ...state, refreshStatus: 'failed' }
  }
}
