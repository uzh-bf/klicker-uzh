import { useQuery } from '@apollo/client'
import {
  GetObjectPermissionRemovalPreviewDocument,
  ObjectType,
} from '@klicker-uzh/graphql/dist/ops'
import { Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

interface PermissionRevocationModalProps {
  objectId: string
  permissionId: number
  objectType: ObjectType
  onClose: () => void
  onRevocation: () => Promise<void>
  username?: string
  userGroup?: string
}

function PermissionRevocationModal({
  objectId,
  permissionId,
  objectType,
  onClose,
  onRevocation,
  username,
  userGroup,
}: PermissionRevocationModalProps) {
  const t = useTranslations()
  const [isRevoking, setIsRevoking] = useState(false)
  const revokingKnowledgeBase = objectType === ObjectType.Kb
  const previewEnabled = revokingKnowledgeBase && username != null
  const {
    data: previewData,
    loading: previewLoading,
    error: previewError,
  } = useQuery(GetObjectPermissionRemovalPreviewDocument, {
    variables: { permissionId, objectId, objectType },
    skip: !previewEnabled,
    fetchPolicy: 'network-only',
  })
  const accessPreview = previewData?.getObjectPermissionRemovalPreview

  const handleRevocation = async () => {
    if (previewLoading) return
    setIsRevoking(true)
    try {
      await onRevocation()
    } finally {
      setIsRevoking(false)
      onClose()
    }
  }

  return (
    <Modal
      open
      hideCloseButton
      onClose={onClose}
      title={t('manage.sharing.revokeDirectPermission')}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={onClose}
      dataSecondaryAction={{ cy: 'cancel-revocation' }}
      primaryLabel={t('shared.generic.confirm')}
      primaryLoading={isRevoking || previewLoading}
      primaryDisabled={previewLoading}
      primaryButtonStyle="destructive"
      onPrimaryAction={handleRevocation}
      dataPrimaryAction={{ cy: 'confirm-revocation' }}
      className={{ content: 'max-w-lg' }}
      dataCloseButton={{ cy: 'close-permission-revocation-modal' }}
    >
      <div className="mb-4 mt-2">
        <p className="mb-2 text-base">
          {username
            ? t.rich(
                revokingKnowledgeBase
                  ? 'manage.sharing.revokeKbUserPermission'
                  : 'manage.sharing.revokeUserPermission',
                {
                  username,
                  b: (text) => <b>{text}</b>,
                }
              )
            : t.rich(
                revokingKnowledgeBase
                  ? 'manage.sharing.revokeKbGroupPermission'
                  : 'manage.sharing.revokeGroupPermission',
                {
                  groupName: userGroup!,
                  b: (text) => <b>{text}</b>,
                }
              )}
        </p>
        <p className="text-sm text-gray-600">
          {revokingKnowledgeBase
            ? t('manage.sharing.knowledgeBaseRevocationWarning')
            : t('manage.sharing.derivedPermissionWarning')}
        </p>
        {revokingKnowledgeBase && !userGroup ? (
          <p
            className="mt-2 text-sm text-gray-600"
            aria-live="polite"
            data-cy={
              previewLoading
                ? 'kb-revocation-overlap-loading'
                : previewError
                  ? 'kb-revocation-overlap-unavailable'
                  : accessPreview?.readSurvives === true
                    ? 'kb-revocation-overlap-survives'
                    : accessPreview?.readSurvives === false
                      ? 'kb-revocation-overlap-lost'
                      : 'kb-revocation-overlap-unavailable'
            }
          >
            {previewLoading
              ? t('manage.sharing.knowledgeBaseOverlapChecking')
              : previewError || accessPreview?.readSurvives == null
                ? t('manage.sharing.knowledgeBaseOverlapUnavailable')
                : accessPreview.readSurvives
                  ? t('manage.sharing.knowledgeBaseOverlapSurvives')
                  : t('manage.sharing.knowledgeBaseOverlapLost')}
          </p>
        ) : null}
        {revokingKnowledgeBase && userGroup ? (
          <p
            className="mt-2 text-sm text-gray-600"
            data-cy="kb-revocation-overlap-group"
          >
            {t('manage.sharing.knowledgeBaseOverlapGroup')}
          </p>
        ) : null}
      </div>
    </Modal>
  )
}

export default PermissionRevocationModal
