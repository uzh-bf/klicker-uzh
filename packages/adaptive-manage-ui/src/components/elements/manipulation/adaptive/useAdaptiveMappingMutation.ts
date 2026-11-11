import { useMutation } from '@apollo/client'
import { UpdateCompetenceTreeElementAssignmentDocument } from '@klicker-uzh/graphql/dist/ops'
import { useCallback, useState } from 'react'
import { AdaptiveMappingAssignmentInput } from './types'

interface MutationIssue {
  message?: unknown
}

function getMutationErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return String(error)
  }

  const graphQLErrors = (error as { graphQLErrors?: unknown }).graphQLErrors
  if (Array.isArray(graphQLErrors)) {
    const issueMessages = graphQLErrors.flatMap((graphQLError) => {
      if (!graphQLError || typeof graphQLError !== 'object') {
        return []
      }

      const extensions = (graphQLError as { extensions?: unknown }).extensions
      if (!extensions || typeof extensions !== 'object') {
        return []
      }

      const issues = (extensions as { issues?: unknown }).issues
      if (!Array.isArray(issues)) {
        return []
      }

      return issues.flatMap((issue: MutationIssue) =>
        typeof issue?.message === 'string' ? [issue.message] : []
      )
    })

    if (issueMessages.length > 0) {
      return issueMessages.join(' ')
    }
  }

  const message = (error as { message?: unknown }).message
  return typeof message === 'string' ? message : String(error)
}

export default function useAdaptiveMappingMutation() {
  const [mutate, { loading }] = useMutation(
    UpdateCompetenceTreeElementAssignmentDocument
  )
  const [error, setError] = useState<string | null>(null)

  const saveMapping = useCallback(
    async ({
      treeId,
      elementId,
      assignment,
    }: {
      treeId: string
      elementId: number
      assignment: AdaptiveMappingAssignmentInput | null
    }): Promise<boolean> => {
      setError(null)

      try {
        await mutate({
          variables: {
            treeId,
            elementId,
            assignment,
          },
        })
        return true
      } catch (mutationError) {
        setError(getMutationErrorMessage(mutationError))
        return false
      }
    },
    [mutate]
  )

  return {
    saveMapping,
    loading,
    error,
    clearError: () => setError(null),
  }
}
