import { useMutation, useQuery } from '@apollo/client'
import { faLockOpen } from '@fortawesome/free-solid-svg-icons'
import {
  GetUsersPrivatePreviewDocument,
  GrantPrivatePreviewAccessDocument,
} from '@klicker-uzh/graphql/dist/ops'
import DataTable from '@klicker-uzh/shared-components/src/DataTable'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import TableSortingButton from '@klicker-uzh/shared-components/src/TableSortingButton'
import { Button, FormikTextField, Toast } from '@uzh-bf/design-system'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@uzh-bf/design-system/dist/future'
import { Form, Formik } from 'formik'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import * as Yup from 'yup'
import Layout from '../components/Layout'

function AdminPanel() {
  const t = useTranslations()
  const [toastType, setToastType] = useState<
    'success' | 'alreadyAccess' | 'userNotExist' | 'error' | null
  >(null)

  const { data, loading } = useQuery(GetUsersPrivatePreviewDocument)
  const [grantPrivatePreviewAccess] = useMutation(
    GrantPrivatePreviewAccessDocument
  )

  return (
    <Layout displayName={t('manage.admin.pageName')}>
      <div className="mx-auto w-full max-w-2xl">
        <Accordion
          collapsible
          type="single"
          defaultValue="metadata"
          className="w-full"
        >
          <AccordionItem value="metadata">
            <AccordionTrigger
              className="hover:bg-accent px-1 py-2 text-lg font-semibold hover:no-underline"
              data-cy="open-private-preview-management"
            >
              {t('manage.admin.privatePreviewAvailability')}
            </AccordionTrigger>
            <AccordionContent className="flex flex-col gap-2 px-1">
              <div>{t('manage.admin.privatePreviewDescription')}</div>
              <div className="mb-4">
                <Formik
                  initialValues={{ email: '' }}
                  validationSchema={Yup.object({
                    email: Yup.string()
                      .email(t('manage.admin.grantAccessEmailError'))
                      .required(t('manage.admin.grantAccessEmailRequired')),
                  })}
                  onSubmit={async (values, { resetForm }) => {
                    const { data: success } = await grantPrivatePreviewAccess({
                      variables: { email: values.email },
                      refetchQueries: [
                        { query: GetUsersPrivatePreviewDocument },
                      ],
                    })

                    if (success?.grantPrivatePreviewAccess === 0) {
                      // Success toast - access granted successfully
                      setToastType('success')
                      resetForm()
                      return
                    } else if (success?.grantPrivatePreviewAccess === 1) {
                      // Error toast - user does not exist
                      setToastType('userNotExist')
                      return
                    } else if (success?.grantPrivatePreviewAccess === 2) {
                      // Success toast - user already has private preview access
                      setToastType('alreadyAccess')
                      resetForm()
                      return
                    }

                    // Error toast - mutation failed / insufficient permissions for user triggering it
                    setToastType('error')
                  }}
                >
                  {({ isValid, isSubmitting }) => (
                    <Form className="flex flex-col gap-3">
                      <div className="flex items-end gap-2">
                        <FormikTextField
                          required
                          name="email"
                          label={t('manage.admin.grantAccessEmailLabel')}
                          placeholder="user@example.com"
                          tooltip={t('manage.admin.grantAccessTooltip')}
                          data-cy="private-preview-email-input"
                        />
                        <Button
                          type="submit"
                          disabled={!isValid || isSubmitting}
                          loading={isSubmitting}
                          className={{ root: 'h-9 whitespace-nowrap' }}
                          data-cy="grant-access-button"
                        >
                          <Button.Icon
                            icon={faLockOpen}
                            loading={isSubmitting}
                          />
                          <Button.Label>
                            {t('manage.admin.grantAccess')}
                          </Button.Label>
                        </Button>
                      </div>
                    </Form>
                  )}
                </Formik>
              </div>
              {loading ? (
                <Loader />
              ) : (
                <DataTable
                  isPaginated
                  isResetSortingEnabled
                  initialSorting={[{ id: 'email', desc: false }]}
                  columns={[
                    {
                      accessorKey: 'email',
                      header: ({ column }: any) => {
                        return (
                          <TableSortingButton
                            column={column}
                            title={t('shared.generic.email')}
                          />
                        )
                      },
                      displayName: t('shared.generic.email'),
                      className: 'w-10',
                    },
                    {
                      accessorKey: 'shortname',
                      header: ({ column }: any) => {
                        return (
                          <TableSortingButton
                            column={column}
                            title={t('shared.generic.shortname')}
                          />
                        )
                      },
                      displayName: '%',
                      className: 'w-20',
                    },
                  ]}
                  data={data?.getUsersPrivatePreview ?? []}
                  className={{
                    tableHeader: 'h-7 p-2',
                    tableCell: 'h-7 p-2',
                    buttons: 'h-7 text-sm',
                    buttonsContainer: 'w-full justify-between',
                  }}
                />
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Success toast - access granted successfully */}
      <Toast
        dismissible
        type="success"
        openExternal={toastType === 'success'}
        onCloseExternal={() => setToastType(null)}
      >
        {t('manage.admin.accessGranted')}
      </Toast>

      {/* Success toast - user already has access */}
      <Toast
        dismissible
        type="success"
        openExternal={toastType === 'alreadyAccess'}
        onCloseExternal={() => setToastType(null)}
      >
        {t('manage.admin.alreadyAccess')}
      </Toast>

      {/* Error toast - user does not exist */}
      <Toast
        dismissible
        type="error"
        openExternal={toastType === 'userNotExist'}
        onCloseExternal={() => setToastType(null)}
        duration={6000}
      >
        {t('manage.admin.userNotExist')}
      </Toast>

      {/* Error toast - mutation failed */}
      <Toast
        dismissible
        type="error"
        openExternal={toastType === 'error'}
        onCloseExternal={() => setToastType(null)}
        duration={6000}
      >
        {t('manage.admin.grantAccessError')}
      </Toast>
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export default AdminPanel
