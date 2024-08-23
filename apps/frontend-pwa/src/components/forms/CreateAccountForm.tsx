import { useLazyQuery } from '@apollo/client'
import { faSave } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { CheckParticipantNameAvailableDocument } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import DebouncedUsernameField from '@klicker-uzh/shared-components/src/DebouncedUsernameField'
import DynamicMarkdown from '@klicker-uzh/shared-components/src/evaluation/DynamicMarkdown'
import {
  Button,
  Checkbox,
  Collapsible,
  FormikSwitchField,
  FormikTextField,
  H3,
  H4,
  Prose,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import * as yup from 'yup'

interface Props {
  initialUsername?: string
  initialEmail?: string
  handleSubmit: (values: any, formikExtra: any) => void
}

function CreateAccountForm({
  initialUsername,
  initialEmail,
  handleSubmit,
}: Props) {
  const t = useTranslations()
  const [checkParticipantNameAvailable] = useLazyQuery(
    CheckParticipantNameAvailableDocument
  )

  const createAccountSchema = yup.object({
    email: yup
      .string()
      .required(t('pwa.profile.emailRequired'))
      .email(t('pwa.profile.emailInvalid')),
    username: yup
      .string()
      .required(t('pwa.profile.usernameRequired'))
      .min(5, t('pwa.profile.usernameMinLength', { length: '5' }))
      .max(15, t('pwa.profile.usernameMaxLength', { length: '15' }))
      .test(
        'isUsernameAvailable',
        t('pwa.createAccount.usernameAvailability'),
        () =>
          typeof isUsernameAvailable === 'undefined' ||
          isUsernameAvailable === true
      ),
    password: yup
      .string()
      .required()
      .min(8, t('pwa.profile.passwordMinLength', { length: '8' })),
    passwordRepetition: yup.string().when('password', {
      is: (val: string) => val && val.length > 0,
      then: (schema) =>
        schema
          .required(t('pwa.profile.identicalPasswords'))
          .min(8, t('pwa.profile.passwordMinLength', { length: '8' }))
          .oneOf(
            [yup.ref('password'), 'null'],
            t('pwa.profile.identicalPasswords')
          ),
      otherwise: (schema) =>
        schema.oneOf([''], t('pwa.profile.identicalPasswords')),
    }),
  })

  const [tosChecked, setTosChecked] = useState<boolean>(false)
  const [openCollapsibleIx, setOpenCollapsibleIx] = useState<number>(0)
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<
    boolean | undefined
  >(true)

  return (
    <Formik
      isInitialValid={false}
      initialValues={{
        email: initialEmail?.toLowerCase() ?? '',
        username: initialUsername,
        password: '',
        passwordRepetition: '',
        isProfilePublic: true,
      }}
      validationSchema={createAccountSchema}
      onSubmit={handleSubmit}
    >
      {({ isSubmitting, isValid, values, validateField }) => (
        <Form>
          <div className="flex flex-col gap-2 md:mx-auto md:grid md:w-full md:max-w-[1090px] md:grid-cols-2">
            <div className="order-3 flex flex-col items-center justify-between gap-2 rounded bg-slate-100 p-4 py-2 md:col-span-2 md:flex-row md:gap-4 md:px-4">
              <div className="flex flex-row items-center gap-4">
                <div className="flex-1 text-slate-600">
                  {/* <FontAwesomeIcon icon={faWarning} /> */}
                  <Checkbox
                    className={{
                      root: twMerge(
                        'h-6 w-6',
                        !tosChecked && 'border-red-600 bg-red-400'
                      ),
                    }}
                    data={{ cy: 'tos-checkbox' }}
                    label={
                      <DynamicMarkdown
                        withProse
                        withLinkButtons={false}
                        className={{
                          root: twMerge(
                            'prose-p:mb-0 prose-sm ml-4 max-w-lg',
                            !tosChecked && 'text-red-600'
                          ),
                        }}
                        content={t('pwa.createAccount.confirmationMessage')}
                      />
                    }
                    onCheck={() => setTosChecked(!tosChecked)}
                    checked={tosChecked}
                  />
                </div>
              </div>
              <Button
                className={{
                  root: 'w-full flex-none md:w-max',
                }}
                type="submit"
                disabled={!tosChecked || isSubmitting || !isValid}
                data={{ cy: 'create-profile-button' }}
              >
                <Button.Icon>
                  <FontAwesomeIcon icon={faSave} />
                </Button.Icon>
                <Button.Label>{t('pwa.profile.createProfile')}</Button.Label>
              </Button>
            </div>
            <div className="order-1 gap-3 rounded md:order-1 md:bg-slate-50 md:p-4">
              <H3 className={{ root: 'mb-0 border-b' }}>
                {t('shared.generic.profile')}
              </H3>
              <div className="mb-2 space-y-3">
                <FormikTextField
                  required
                  disabled={!!initialEmail}
                  name="email"
                  label={t('shared.generic.email')}
                  className={{
                    label: 'mt-4 text-black',
                  }}
                  data={{ cy: 'email-field' }}
                />
                <DebouncedUsernameField
                  required
                  name="username"
                  label={t('shared.generic.username')}
                  valid={isUsernameAvailable}
                  setValid={(usernameAvailable: boolean | undefined) =>
                    setIsUsernameAvailable(usernameAvailable)
                  }
                  validateField={async () => {
                    await validateField('username')
                  }}
                  checkUsernameAvailable={async (name: string) => {
                    const { data: result } =
                      await checkParticipantNameAvailable({
                        variables: { username: name },
                      })
                    return result?.checkParticipantNameAvailable ?? false
                  }}
                  className={{ label: 'mt-0' }}
                  data={{ cy: 'username-field-account-creation' }}
                />
                <FormikTextField
                  required
                  name="password"
                  label={t('shared.generic.password')}
                  className={{
                    label: 'mt-0 text-black',
                  }}
                  type="password"
                  data={{ cy: 'password-field' }}
                />
                <FormikTextField
                  required
                  name="passwordRepetition"
                  label={t('shared.generic.passwordRepetition')}
                  className={{
                    label: 'mt-0 text-black',
                  }}
                  type="password"
                  data={{ cy: 'password-repetition-field' }}
                />

                <div>
                  <div className="font-bold">
                    {t('pwa.profile.publicProfile')}
                  </div>
                  <div className="space-between flex flex-row gap-4">
                    <div className="flex flex-col items-center gap-1">
                      <FormikSwitchField
                        name="isProfilePublic"
                        data={{ cy: 'toggle-profile-public-setting' }}
                      />
                      {values.isProfilePublic
                        ? t('shared.generic.yes')
                        : t('shared.generic.no')}
                    </div>
                    <div className="flex-1">
                      <Prose className={{ root: 'prose-sm' }}>
                        {t('pwa.profile.isProfilePublic')}
                      </Prose>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="order-2 space-y-2 rounded md:order-2 md:justify-between md:bg-slate-50 md:p-4">
              <H3 className={{ root: 'mb-0 border-b' }}>
                {t('pwa.createAccount.dataProcessingTitle')}
              </H3>
              <Collapsible
                open={openCollapsibleIx === 0}
                onChange={() =>
                  setOpenCollapsibleIx(openCollapsibleIx === 0 ? -1 : 0)
                }
                staticContent={
                  <H4>{t('pwa.createAccount.dataCollectionTitle')}</H4>
                }
              >
                <Markdown
                  withProse
                  withLinkButtons={false}
                  className={{ root: 'prose-sm' }}
                  content={t('pwa.createAccount.dataCollectionNotice')}
                />
              </Collapsible>
              <Collapsible
                open={openCollapsibleIx === 1}
                onChange={() =>
                  setOpenCollapsibleIx(openCollapsibleIx === 1 ? -1 : 1)
                }
                staticContent={
                  <H4>{t('pwa.createAccount.dataSharingTitle')}</H4>
                }
              >
                <Markdown
                  withProse
                  withLinkButtons={false}
                  className={{ root: 'prose-sm' }}
                  content={t('pwa.createAccount.dataSharingNotice')}
                />
              </Collapsible>
              <Collapsible
                open={openCollapsibleIx === 2}
                onChange={() =>
                  setOpenCollapsibleIx(openCollapsibleIx === 2 ? -1 : 2)
                }
                staticContent={<H4>{t('pwa.createAccount.dataUsageTitle')}</H4>}
              >
                <Markdown
                  withProse
                  withLinkButtons={false}
                  className={{ root: 'prose-sm' }}
                  content={t('pwa.createAccount.dataUsageNotice')}
                />
              </Collapsible>
              <Collapsible
                open={openCollapsibleIx === 3}
                onChange={() =>
                  setOpenCollapsibleIx(openCollapsibleIx === 3 ? -1 : 3)
                }
                staticContent={
                  <H4>{t('pwa.createAccount.dataStorageTitle')}</H4>
                }
              >
                <Markdown
                  withProse
                  withLinkButtons={false}
                  className={{ root: 'prose-sm' }}
                  content={t('pwa.createAccount.dataStorageNotice')}
                />
              </Collapsible>
            </div>
          </div>
        </Form>
      )}
    </Formik>
  )
}

export default CreateAccountForm
