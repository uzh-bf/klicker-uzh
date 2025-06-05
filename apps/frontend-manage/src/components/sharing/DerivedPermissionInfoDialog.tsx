import { useQuery } from '@apollo/client'
import {
  GetDerivedPermissionOriginDocument,
  PermissionLevel,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'

function DerivedPermissionInfoDialog({
  derivedPermissionOriginAlert,
  setDerivedPermissionOriginAlert,
}: {
  derivedPermissionOriginAlert: {
    open: boolean
    permissionId?: number
    username?: string
  }
  setDerivedPermissionOriginAlert: Dispatch<
    SetStateAction<{ open: boolean; permissionId?: number; username?: string }>
  >
}) {
  const t = useTranslations()

  const { data, loading } = useQuery(GetDerivedPermissionOriginDocument, {
    variables: { id: derivedPermissionOriginAlert.permissionId ?? -1 },
    skip: !derivedPermissionOriginAlert.permissionId,
  })
  const info = data?.getDerivedPermissionOrigin

  return (
    <AlertDialog
      open={derivedPermissionOriginAlert.open}
      onOpenChange={(open) => {
        if (!open) {
          setDerivedPermissionOriginAlert({
            open: false,
            permissionId: undefined,
            username: undefined,
          })
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle>
            {t('manage.sharing.derivedPermissionOrigin')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {loading ? (
              <Loader />
            ) : (
              <>
                <span className="mb-2">
                  {t('manage.sharing.derivedAccessFor', {
                    user: info?.permissionUser,
                  })}
                </span>
                <ul className="list-inside list-disc">
                  <li>{`${t('manage.sharing.originalObjectOwner')}: ${info?.parentObjectOwner ?? derivedPermissionOriginAlert.username}`}</li>
                  {info?.parentObjectType ? (
                    <li>{`${t('manage.sharing.originalObjectType')}: ${t(`shared.types.${info.parentObjectType}`)}`}</li>
                  ) : null}
                  {info?.parentObjectName ? (
                    <li>{`${t('manage.sharing.originalObjectName')}: ${info.parentObjectName}`}</li>
                  ) : null}
                  <li>{`${t('manage.sharing.reasonDerivedAccess')}: ${
                    !info?.parentPermissionLevel ||
                    info.parentPermissionLevel === PermissionLevel.Owner
                      ? t('manage.sharing.ownerOfOriginalObject')
                      : `${t(`manage.sharing.originalObjectShared${info?.parentPermissionLevel}`)} ${
                          info?.parentTargetUserGroup
                            ? `(${t('manage.sharing.viaUserGroup', { name: info.parentTargetUserGroup })})`
                            : ''
                        }`
                  }`}</li>
                </ul>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('shared.generic.close')}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default DerivedPermissionInfoDialog
