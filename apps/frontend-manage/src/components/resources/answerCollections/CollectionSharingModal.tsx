import { useQuery } from '@apollo/client'
import { faSave, faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  AccessLevel,
  AnswerCollection,
  GetAnswerCollectionPermissionsDocument,
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
import PermissionsTable from '../PermissionsTable'
import CollectionSharingErrorToast from './CollectionSharingErrorToast'
import CollectionSharingSuccessToast from './CollectionSharingSuccessToast'

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

  // TODO: split up this component into smaller components
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
            <tbody className="bg-white">
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
                  userGroup: undefined,
                  accessLevel: AccessLevel.Read,
                }}
                onSubmit={(values, { setSubmitting, resetForm }) => {
                  setSubmitting(true)

                  // TODO: handle form submission to add new permission
                  alert(JSON.stringify(values, null, 2))

                  resetForm()
                  setSubmitting(false)
                }}
                validationSchema={
                  // either individual user or user group need to be defined
                  Yup.object().shape({
                    usernameOrEmail: Yup.string().required(
                      t('manage.resources.usernameEmailOrGroupRequired')
                    ),
                    userGroup: Yup.string().nullable(
                      t('manage.resources.usernameEmailOrGroupRequired')
                    ),
                    accessLevel: Yup.string().required(),
                  })
                }
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
                        name="userGroup"
                        id="userGroup"
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
