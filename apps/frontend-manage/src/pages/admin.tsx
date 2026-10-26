import { useMutation, useQuery } from '@apollo/client'
import { faLockOpen } from '@fortawesome/free-solid-svg-icons'
import {
  GetUsersPrivatePreviewDocument,
  GrantPrivatePreviewAccessDocument,
  ManageUserProfileDocument,
  UserRole,
} from '@klicker-uzh/graphql/dist/ops'
import DataTable from '@klicker-uzh/shared-components/src/DataTable'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import TableSortingButton from '@klicker-uzh/shared-components/src/TableSortingButton'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  FormikTextField,
  toast,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import type { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import * as Yup from 'yup'
import ChatbotPublicationQueue from '../components/admin/ChatbotPublicationQueue'
import Layout from '../components/Layout'

function AdminPanel() {
  const t = useTranslations()
  const { data: profile, loading: profileLoading } = useQuery(
    ManageUserProfileDocument
  )
  const isAdmin = profile?.userProfile?.role === UserRole.Admin
  const { data, loading } = useQuery(GetUsersPrivatePreviewDocument, {
    skip: !isAdmin,
  })
  const [grantPrivatePreviewAccess] = useMutation(
    GrantPrivatePreviewAccessDocument
  )

  if (!isAdmin) {
    return (
      <Layout displayName={t('manage.admin.pageName')}>
        {profileLoading ? (
          <Loader />
        ) : (
          <UserNotification type="error">
            {t('manage.admin.adminOnly')}
          </UserNotification>
        )}
      </Layout>
    )
  }

  return (
    <Layout displayName={t('manage.admin.pageName')}>
      <div className="mx-auto w-full max-w-3xl">
        <Accordion
          collapsible
          type="single"
          defaultValue="chatbot-approvals"
          className="w-full"
        >
          <AccordionItem value="chatbot-approvals">
            <AccordionTrigger
              className="hover:bg-accent px-1 py-2 text-lg font-semibold hover:no-underline"
              data-cy="open-chatbot-approvals"
            >
              {t('manage.admin.chatbotApprovals')}
            </AccordionTrigger>
            <AccordionContent className="px-1">
              <ChatbotPublicationQueue />
            </AccordionContent>
          </AccordionItem>
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
                      // performance is not relevant for admin access operations
                      // prefer additional fetches over potentially outdated data
                      refetchQueries: [
                        { query: GetUsersPrivatePreviewDocument },
                      ],
                    })

                    if (success?.grantPrivatePreviewAccess === 0) {
                      // success toast - access granted successfully
                      toast({
                        type: 'success',
                        message: t('manage.admin.accessGranted'),
                      })
                      resetForm()
                      return
                    } else if (success?.grantPrivatePreviewAccess === 1) {
                      // error toast - user does not exist
                      toast({
                        type: 'error',
                        message: t('manage.admin.userNotExist'),
                        options: { duration: 6000 },
                      })
                      return
                    } else if (success?.grantPrivatePreviewAccess === 2) {
                      // success toast - user already has private preview access
                      toast({
                        type: 'success',
                        message: t('manage.admin.alreadyAccess'),
                        options: { duration: 6000 },
                      })
                      resetForm()
                      return
                    }

                    // error toast - mutation failed / insufficient permissions for user triggering it
                    toast({
                      type: 'error',
                      message: t('manage.admin.grantAccessError'),
                      options: { duration: 6000 },
                    })
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
