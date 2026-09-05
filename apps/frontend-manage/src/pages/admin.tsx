import { useMutation, useQuery } from '@apollo/client'
import { faBan, faLockOpen } from '@fortawesome/free-solid-svg-icons'
import {
  GetUsersAiFeaturesDocument,
  GetUsersPrivatePreviewDocument,
  GrantPrivatePreviewAccessDocument,
  SetAiFeaturesDocument,
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
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import * as Yup from 'yup'
import Layout from '../components/Layout'

function AdminPanel() {
  const t = useTranslations()
  const { data, loading } = useQuery(GetUsersPrivatePreviewDocument)
  const [grantPrivatePreviewAccess] = useMutation(
    GrantPrivatePreviewAccessDocument
  )
  const { data: aiData, loading: aiLoading } = useQuery(
    GetUsersAiFeaturesDocument
  )
  const [setAiFeatures] = useMutation(SetAiFeaturesDocument)

  // Both halves of the switch share this, so the enable and disable buttons
  // differ only in the value they send and the confirmation they show.
  const submitAiFeatures = async (email: string, enabled: boolean) => {
    const { data: result } = await setAiFeatures({
      variables: { email, enabled },
      // performance is not relevant for admin access operations
      // prefer additional fetches over potentially outdated data
      refetchQueries: [{ query: GetUsersAiFeaturesDocument }],
    })

    if (result?.setAiFeatures === 0) {
      toast({
        type: 'success',
        message: enabled
          ? t('manage.admin.aiFeaturesEnabled')
          : t('manage.admin.aiFeaturesDisabled'),
      })
      return true
    }

    if (result?.setAiFeatures === 1) {
      toast({
        type: 'error',
        message: t('manage.admin.userNotExist'),
        options: { duration: 6000 },
      })
      return false
    }

    if (result?.setAiFeatures === 2) {
      toast({
        type: 'success',
        message: t('manage.admin.aiFeaturesUnchanged'),
        options: { duration: 6000 },
      })
      return true
    }

    toast({
      type: 'error',
      message: t('manage.admin.aiFeaturesError'),
      options: { duration: 6000 },
    })
    return false
  }

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

          <AccordionItem value="ai-features">
            <AccordionTrigger
              className="hover:bg-accent px-1 py-2 text-lg font-semibold hover:no-underline"
              data-cy="open-ai-features-management"
            >
              {t('manage.admin.aiFeaturesAvailability')}
            </AccordionTrigger>
            <AccordionContent className="flex flex-col gap-2 px-1">
              <div>{t('manage.admin.aiFeaturesDescription')}</div>
              <div className="mb-4">
                <Formik
                  initialValues={{ email: '' }}
                  validationSchema={Yup.object({
                    email: Yup.string()
                      .email(t('manage.admin.grantAccessEmailError'))
                      .required(t('manage.admin.grantAccessEmailRequired')),
                  })}
                  // The buttons decide whether the address is enabled or
                  // disabled, so the form itself submits nothing on Enter.
                  onSubmit={() => {}}
                >
                  {({
                    values,
                    isValid,
                    isSubmitting,
                    setSubmitting,
                    resetForm,
                  }) => (
                    <Form className="flex flex-col gap-3">
                      <div className="flex items-end gap-2">
                        <FormikTextField
                          required
                          name="email"
                          label={t('manage.admin.grantAccessEmailLabel')}
                          placeholder="user@example.com"
                          tooltip={t('manage.admin.grantAccessTooltip')}
                          data-cy="ai-features-email-input"
                        />
                        <Button
                          type="button"
                          disabled={!isValid || isSubmitting}
                          loading={isSubmitting}
                          className={{ root: 'h-9 whitespace-nowrap' }}
                          data-cy="enable-ai-features-button"
                          onClick={async () => {
                            setSubmitting(true)
                            const changed = await submitAiFeatures(
                              values.email,
                              true
                            )
                            setSubmitting(false)
                            if (changed) resetForm()
                          }}
                        >
                          <Button.Icon
                            icon={faLockOpen}
                            loading={isSubmitting}
                          />
                          <Button.Label>
                            {t('manage.admin.aiFeaturesEnable')}
                          </Button.Label>
                        </Button>
                        <Button
                          type="button"
                          disabled={!isValid || isSubmitting}
                          loading={isSubmitting}
                          className={{ root: 'h-9 whitespace-nowrap' }}
                          data-cy="disable-ai-features-button"
                          onClick={async () => {
                            setSubmitting(true)
                            const changed = await submitAiFeatures(
                              values.email,
                              false
                            )
                            setSubmitting(false)
                            if (changed) resetForm()
                          }}
                        >
                          <Button.Icon icon={faBan} loading={isSubmitting} />
                          <Button.Label>
                            {t('manage.admin.aiFeaturesDisable')}
                          </Button.Label>
                        </Button>
                      </div>
                    </Form>
                  )}
                </Formik>
              </div>
              {aiLoading ? (
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
                  data={aiData?.getUsersAiFeatures ?? []}
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
