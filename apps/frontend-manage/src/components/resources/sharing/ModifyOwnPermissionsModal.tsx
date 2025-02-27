import { AccessLevel } from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface ModifyOwnPermissionsModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  action: 'change' | 'remove'
  newAccessLevel?: AccessLevel
}

function ModifyOwnPermissionsModal({
  open,
  onClose,
  onConfirm,
  action,
  newAccessLevel,
}: ModifyOwnPermissionsModalProps) {
  const t = useTranslations()

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('manage.resources.modifyOwnPermissionsTitle')}
      className={{ content: 'max-w-lg' }}
      dataCloseButton={{ cy: 'close-modify-own-permissions-modal' }}
      hideCloseButton
    >
      <div className="mb-6">
        {action === 'remove' ? (
          <p className="text-sm" data-cy="remove-own-access-warning">
            {t('manage.resources.removeOwnPermissionsWarning')}
          </p>
        ) : (
          <p className="text-sm" data-cy="change-own-access-warning">
            {t('manage.resources.changeOwnPermissionsWarning', {
              accessLevel: t(
                `manage.resources.access${newAccessLevel ?? AccessLevel.Read}`
              ),
            })}
          </p>
        )}
      </div>

      <div className="flex flex-row justify-between gap-2">
        <Button
          onClick={onClose}
          data={{ cy: 'cancel-modify-own-permissions' }}
        >
          {t('shared.generic.cancel')}
        </Button>
        <Button
          onClick={onConfirm}
          data={{ cy: 'confirm-modify-own-permissions' }}
          className={{
            root: 'border-red-600 bg-red-600 text-white hover:border-red-700 hover:bg-red-700 hover:text-white',
          }}
        >
          {t('shared.generic.confirm')}
        </Button>
      </div>
    </Modal>
  )
}

export default ModifyOwnPermissionsModal
