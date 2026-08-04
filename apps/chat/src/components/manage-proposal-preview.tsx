'use client'

import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import useSingleStudentResponse from '@klicker-uzh/shared-components/src/hooks/useSingleStudentResponse'
import StudentElement, {
  type InstanceStackStudentResponseType,
} from '@klicker-uzh/shared-components/src/StudentElement'
import { useMemo, useState, type FC } from 'react'
import type { ManageProposalPayload } from '../services/proposalToElementInstance'
import { proposalPayloadToElementInstance } from '../services/proposalToElementInstance'

type ManageProposalPreviewProps = {
  payload: ManageProposalPayload
}

export const ManageProposalPreview: FC<ManageProposalPreviewProps> = ({
  payload,
}) => {
  const element = useMemo(
    () => proposalPayloadToElementInstance(payload),
    [payload]
  )

  const [singleStudentResponse, setSingleStudentResponse] =
    useState<InstanceStackStudentResponseType>({
      response: undefined,
      type: ElementType.FreeText,
      valid: false,
    })

  useSingleStudentResponse({
    instance: element,
    setStudentResponse: setSingleStudentResponse,
  })

  return (
    <div className="max-w-full overflow-x-auto">
      <StudentElement
        compact
        element={element}
        elementIx={0}
        preview
        setSingleStudentResponse={setSingleStudentResponse}
        singleStudentResponse={singleStudentResponse}
      />
    </div>
  )
}
