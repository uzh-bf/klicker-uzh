import { useQuery } from '@apollo/client'
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementType,
  GetArtificialInstanceDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import StudentElement, {
  type InstanceStackStudentResponseType,
} from '@klicker-uzh/shared-components/src/StudentElement'
import useSingleStudentResponse from '@klicker-uzh/shared-components/src/hooks/useSingleStudentResponse'
import { Button, Modal, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

function PreviewContent({ elementId }: { elementId: number }) {
  const t = useTranslations()
  const { data, loading, error, refetch } = useQuery(
    GetArtificialInstanceDocument,
    { variables: { elementId }, fetchPolicy: 'no-cache' }
  )
  const instance = data?.artificialInstance
  const [response, setResponse] = useState<InstanceStackStudentResponseType>({
    type: ElementType.Sc,
    response: undefined,
    valid: false,
  })
  useSingleStudentResponse({ instance, setStudentResponse: setResponse })
  if (loading) return <Loader />
  if (error || !instance)
    return (
      <UserNotification type="error">
        {t('manage.competenceTree.previewError')}
        <Button
          onClick={() => void refetch()}
          data={{ cy: 'competence-tree-preview-retry' }}
        >
          <Button.Label>{t('manage.competenceTree.retryPreview')}</Button.Label>
        </Button>
      </UserNotification>
    )
  return (
    <StudentElement
      preview
      element={instance}
      elementIx={0}
      singleStudentResponse={response}
      setSingleStudentResponse={setResponse}
    />
  )
}

function ElementPreview({
  elementId,
  name,
}: {
  elementId: number
  name: string
}) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        basic
        size="icon"
        className={{ root: 'h-8 w-8 shrink-0' }}
        onClick={() => setOpen(true)}
        title={t('manage.activities.previewElement')}
        aria-label={t('manage.competenceTree.previewElement', { name })}
        data={{ cy: 'competence-tree-preview-' + elementId }}
      >
        <FontAwesomeIcon icon={faMagnifyingGlass} size="sm" />
      </Button>
      {open && (
        <Modal
          open
          title={name}
          onClose={() => setOpen(false)}
          className={{
            content: 'max-w-3xl',
            title: 'whitespace-normal break-words pr-6',
          }}
          dataContent={{ cy: 'competence-tree-element-preview' }}
        >
          <PreviewContent elementId={elementId} />
        </Modal>
      )}
    </>
  )
}
export default ElementPreview
