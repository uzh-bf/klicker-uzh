import { faLockOpen } from '@fortawesome/free-solid-svg-icons'
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
  UserNotification,
  toast,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import * as Yup from 'yup'
import Layout from '../components/Layout'
import { trpc } from '../lib/trpc'

function AdminPanel() {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const { data, isLoading } = trpc.user.privatePreviewUsers.useQuery()
  const grantPrivatePreviewAccess =
    trpc.user.grantPrivatePreviewAccess.useMutation()

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
                  onSubmit={async (values, { resetForm, setSubmitting }) => {
                    setSubmitting(true)

                    try {
                      const success =
                        await grantPrivatePreviewAccess.mutateAsync({
                          email: values.email,
                        })

                      if (success === 0) {
                        await utils.user.privatePreviewUsers
                          .invalidate()
                          .catch(console.error)
                        toast({
                          type: 'success',
                          message: t('manage.admin.accessGranted'),
                        })
                        resetForm()
                        return
                      } else if (success === 1) {
                        toast({
                          type: 'error',
                          message: t('manage.admin.userNotExist'),
                          options: { duration: 6000 },
                        })
                        return
                      } else if (success === 2) {
                        await utils.user.privatePreviewUsers
                          .invalidate()
                          .catch(console.error)
                        toast({
                          type: 'success',
                          message: t('manage.admin.alreadyAccess'),
                          options: { duration: 6000 },
                        })
                        resetForm()
                        return
                      }

                      toast({
                        type: 'error',
                        message: t('manage.admin.grantAccessError'),
                        options: { duration: 6000 },
                      })
                    } catch (error) {
                      console.error(error)
                      toast({
                        type: 'error',
                        message: t('manage.admin.grantAccessError'),
                        options: { duration: 6000 },
                      })
                    } finally {
                      setSubmitting(false)
                    }
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
              {isLoading && !data ? (
                <Loader />
              ) : !data ? (
                <UserNotification
                  type="error"
                  message={t('shared.generic.systemError')}
                />
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
                  data={data}
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
