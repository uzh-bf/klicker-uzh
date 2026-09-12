import {
  type Element,
  PermissionLevel,
  type ShareElementsBatchMutation,
} from '@klicker-uzh/graphql/dist/ops'

export type ElementBatchSharingFormValues = {
  enabled: boolean
  shortnameOrEmail: string
  userGroupId?: string
  permissionLevel: PermissionLevel
}

export const INITIAL_ELEMENT_BATCH_SHARING: ElementBatchSharingFormValues = {
  enabled: false,
  shortnameOrEmail: '',
  userGroupId: undefined,
  permissionLevel: PermissionLevel.Read,
}

export type ElementBatchUpdateExecutionResult =
  | { status: 'NOT_REQUESTED' }
  | { status: 'SKIPPED' }
  | {
      status: 'SUCCEEDED' | 'PARTIAL'
      expectedCount: number
      updatedCount: number
    }
  | { status: 'FAILED' }

export type ElementBatchSharingExecutionResult =
  | { status: 'NOT_REQUESTED' }
  | { status: 'REQUEST_FAILED' }
  | {
      status: 'COMPLETED'
      response: ShareElementsBatchMutation['shareElementsBatch']
    }

export type ElementBatchExecutionResult = {
  selectedElements: Pick<Element, 'id' | 'name'>[]
  update: ElementBatchUpdateExecutionResult
  sharing: ElementBatchSharingExecutionResult
  refreshFailed: boolean
}
