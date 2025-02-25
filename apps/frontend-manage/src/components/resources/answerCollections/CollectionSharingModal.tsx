import { useMutation, useQuery } from '@apollo/client'
import { faSave, faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  AccessLevel,
  AnswerCollection,
  GetAnswerCollectionPermissionsDocument,
  GetAnswerCollectionsInfoDocument,
  ShareAnswerCollectionDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikSelectField,
  FormikTextField,
  H3,
  Modal,
  Select,
} from '@uzh-bf/design-system'
import { Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'
import CollectionSharingErrorToast from '../sharing/CollectionSharingErrorToast'
import CollectionSharingSuccessToast from '../sharing/CollectionSharingSuccessToast'
import PermissionsTable from '../sharing/PermissionsTable'

function CollectionSharingModal({
  collection,
  open,
  onClose,
}: {
  collection: AnswerCollection
  open: boolean
  onClose: () => void
}) {
  const t = useTranslations()
  const [sharingSuccess, setSharingSuccess] = useState(false)
  const [sharingFailure, setSharingFailure] = useState(false)

  // get all permissions that have already been granted for this collection
  const { data, loading: permissionsLoading } = useQuery(
    GetAnswerCollectionPermissionsDocument,
    {
      variables: { collectionId: collection.id },
      skip: !open,
    }
  )
  const permissions = data?.getAnswerCollectionPermissions

  // mutation to create new permission entry for answer collection
  const [shareAnswerCollection] = useMutation(ShareAnswerCollectionDocument)

  // TODO: split up this component into smaller components (the bottom table should be generic enough to be re-used for other sharing modals as well)
  // TODO: add loading state if permissions are still loading
  return (
    <>
      <Modal
        fullScreen
        title={t('manage.resources.shareAnswerCollection')}
        open={open}
        onClose={onClose}
        dataCloseButton={{ cy: 'close-remove-answer-collection' }}
        className={{
          content: 'max-w-5xl',
        }}
      >
        <div>
          {t.rich('manage.resources.infoCollectionSharing', {
            name: collection.name,
            b: (text) => <b>{text}</b>,
          })}
        </div>
        <div className="my-4">
          <PermissionsTable
            actions={[
              {
                action: t('manage.resources.viewUseCollectionContent'),
                permissions: [true, true, true, true],
              },
              {
                action: t('manage.resources.modifyContent'),
                permissions: [false, true, true, true],
              },
              {
                action: t('manage.resources.shareCollection'),
                permissions: [false, false, true, true],
              },
              {
                action: t('manage.resources.modifyCatalogAssignment'),
                permissions: [false, false, true, true],
              },
              {
                action: t('manage.resources.modifyPermissions'),
                permissions: [false, false, true, true],
              },
              {
                action: t('manage.resources.revokeAccess'),
                permissions: [false, false, true, true],
              },
              {
                action: t('manage.resources.deleteCollection'),
                permissions: [false, false, true, true],
              },
              {
                action: t('manage.resources.transferOwnership'),
                permissions: [false, false, false, true],
              },
            ]}
          />
        </div>

        <div className="mt-8">
          <H3>{t('manage.resources.grantedPermissions')}</H3>
          <table className="mt-1 w-full border-collapse overflow-hidden rounded-lg border-b shadow-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">
                  {t('shared.generic.username')} ({t('shared.generic.email')})
                </th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">
                  {t('shared.generic.userGroup')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">
                  {t('shared.generic.accessLevel')}
                </th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody
              className="bg-white"
              key={permissions?.map((p) => p.permissionId).join()}
            >
              {permissions
                ?.filter(
                  (permission) =>
                    permission.username || permission.userGroupName
                )
                .map((permission, index) => (
                  <tr
                    key={index}
                    className="border-t border-gray-200 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {permission.username
                        ? `${permission.username} (${permission.userEmail})`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {permission.userGroupName || '-'}
                    </td>
                    <td className="px-4 py-1.5 text-gray-900">
                      <Select
                        value={permission.accessLevel}
                        items={[
                          AccessLevel.Read,
                          AccessLevel.Write,
                          AccessLevel.Admin,
                        ].map((level) => ({
                          label: t(`manage.resources.access${level}`),
                          value: level,
                        }))}
                        onChange={(value) => alert('CHANGE PERMISSION')} // TODO: handle changing of permission
                        className={{
                          trigger: 'h-7 text-sm text-gray-900',
                        }}
                      />
                    </td>
                    <td className="w-10 text-center">
                      <Button
                        basic
                        className={{
                          root: 'mt-1 text-red-600 hover:text-red-800',
                        }}
                        onClick={() => alert('DELETE PERMISSION')} // TODO: handle deletion of permission
                      >
                        <FontAwesomeIcon
                          icon={faTrashCan}
                          className="h-4 w-4"
                        />
                      </Button>
                    </td>
                  </tr>
                ))}
              <Formik
                isInitialValid={false}
                initialValues={{
                  usernameOrEmail: undefined,
                  userGroupId: undefined,
                  accessLevel: AccessLevel.Read,
                }}
                onSubmit={async (values, { setSubmitting, resetForm }) => {
                  setSubmitting(true)

                  if (
                    typeof values.userGroupId !== 'undefined' ||
                    (typeof values.usernameOrEmail !== 'undefined' &&
                      values.usernameOrEmail !== '')
                  ) {
                    const newPermission = await shareAnswerCollection({
                      variables: {
                        collectionId: collection.id,
                        usernameOrEmail: values.usernameOrEmail,
                        userGroupId:
                          typeof values.usernameOrEmail === 'undefined'
                            ? values.userGroupId
                            : undefined,
                        accessLevel: values.accessLevel,
                      },
                      update: (cache, { data }) => {
                        if (!data?.shareAnswerCollection) return

                        const prevPermissions = cache.readQuery({
                          query: GetAnswerCollectionPermissionsDocument,
                          variables: {
                            collectionId: collection.id,
                          },
                        })

                        if (
                          !prevPermissions?.getAnswerCollectionPermissions ||
                          !data.shareAnswerCollection
                        ) {
                          return
                        }

                        // replace the permission that was just added (if it already exists) and add it otherwise
                        const newPermissions =
                          prevPermissions.getAnswerCollectionPermissions.filter(
                            (permission) =>
                              permission.permissionId !==
                              data.shareAnswerCollection!.permissionId
                          )
                        newPermissions.push(data.shareAnswerCollection)

                        cache.writeQuery({
                          query: GetAnswerCollectionPermissionsDocument,
                          variables: {
                            collectionId: collection.id,
                          },
                          data: {
                            getAnswerCollectionPermissions: newPermissions,
                          },
                        })
                      },
                      refetchQueries: [GetAnswerCollectionsInfoDocument],
                    })

                    if (
                      typeof newPermission.data?.shareAnswerCollection
                        ?.permissionId !== 'undefined'
                    ) {
                      setSharingSuccess(true)
                      resetForm()
                      setSubmitting(false)
                    } else {
                      setSharingFailure(true)
                      setSubmitting(false)
                    }
                  } else {
                    setSharingFailure(true)
                    setSubmitting(false)
                  }
                }}
                validationSchema={Yup.object()
                  .shape({
                    usernameOrEmail: Yup.string(),
                    userGroupId: Yup.number(),
                    accessLevel: Yup.string().required(),
                  })
                  .test(
                    'either-user-or-group',
                    t('manage.resources.usernameEmailOrGroupRequired'),
                    function (values) {
                      const { usernameOrEmail, userGroupId } = values
                      return (
                        (!!usernameOrEmail && usernameOrEmail !== '') ||
                        !!userGroupId
                      )
                    }
                  )}
              >
                {({ isSubmitting, isValid, submitForm }) => (
                  <tr className="border-t border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <FormikTextField
                        name="usernameOrEmail"
                        id="usernameOrEmail"
                        placeholder={
                          t('shared.generic.username') +
                          ' / ' +
                          t('shared.generic.email')
                        }
                        disabled={isSubmitting}
                        className={{
                          input: 'h-7 w-full text-sm text-gray-900',
                        }}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <FormikSelectField
                        name="userGroupId"
                        id="userGroupId"
                        placeholder={t('manage.resources.noUserGroupSelected')}
                        items={[]} // TODO: add available user groups
                        disabled={isSubmitting}
                        className={{
                          select: {
                            trigger: 'h-7 text-sm text-gray-900',
                          },
                        }}
                      />
                    </td>
                    <td className="px-4 py-1.5 text-sm text-gray-900">
                      <FormikSelectField
                        name="accessLevel"
                        id="accessLevel"
                        items={[
                          AccessLevel.Read,
                          AccessLevel.Write,
                          AccessLevel.Admin,
                        ].map((level) => ({
                          label: t(`manage.resources.access${level}`),
                          value: level,
                        }))}
                        disabled={isSubmitting}
                        className={{
                          select: {
                            trigger: 'h-7 text-sm text-gray-900',
                          },
                        }}
                      />
                    </td>
                    <td className="w-10 text-center">
                      <Button
                        basic
                        type="button"
                        onClick={() => submitForm()}
                        disabled={!isValid || isSubmitting}
                        className={{
                          root: twMerge(
                            'mt-1 text-green-700 hover:text-green-800',
                            !isValid || isSubmitting
                              ? 'text-gray-500 hover:cursor-not-allowed hover:text-gray-500'
                              : '',
                            isSubmitting && 'hover:cursor-progress'
                          ),
                        }}
                      >
                        <FontAwesomeIcon
                          icon={faSave}
                          className="h-[1.1rem] w-[1.1rem]"
                        />
                      </Button>
                    </td>
                  </tr>
                )}
              </Formik>
            </tbody>
          </table>
        </div>
      </Modal>
      <CollectionSharingSuccessToast
        open={sharingSuccess}
        onClose={() => setSharingSuccess(false)}
      />
      <CollectionSharingErrorToast
        open={sharingFailure}
        onClose={() => setSharingFailure(false)}
      />
    </>
  )
}

export default CollectionSharingModal
