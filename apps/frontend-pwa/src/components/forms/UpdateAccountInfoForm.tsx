import { faSave } from '@fortawesome/free-regular-svg-icons'
import DebouncedUsernameField from '@klicker-uzh/shared-components/src/DebouncedUsernameField'
import { trpc } from '@lib/trpc'
import {
  Button,
  FormikSwitchField,
  FormikTextField,
  H3,
  Prose,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import * as yup from 'yup'

type ProfileUser = {
  email?: string | null
  isProfilePublic?: boolean | null
  username?: string | null
}

interface UpdateAccountInfoFormProps {
  user: ProfileUser
  onError: () => void
  onSuccess: () => void | Promise<void>
}

function UpdateAccountInfoForm({
  user,
  onError,
  onSuccess,
}: UpdateAccountInfoFormProps) {
  const t = useTranslations()
  const updateParticipantProfile = trpc.participant.updateProfile.useMutation()
  const utils = trpc.useUtils()

  const [isUsernameAvailable, setIsUsernameAvailable] = useState<
    boolean | undefined
  >(true)

  return (
    <Formik
      validationSchema={yup.object({
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
            t('shared.generic.usernameAvailability'),
            () =>
              typeof isUsernameAvailable === 'undefined' ||
              isUsernameAvailable === true
          ),
        password: yup
          .string()
          .optional()
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
      })}
      initialValues={{
        isProfilePublic: user.isProfilePublic,
        email: user.email,
        username: user.username,
        password: '',
        passwordRepetition: '',
      }}
      onSubmit={async (values, { setSubmitting }) => {
        setSubmitting(true)

        if (
          typeof values.username === 'undefined' ||
          values.username === null ||
          typeof values.email === 'undefined' ||
          values.email === null
        ) {
          onError()
          setSubmitting(false)
          return
        }

        try {
          const result = await updateParticipantProfile.mutateAsync({
            isProfilePublic: values.isProfilePublic,
            password:
              values.password === '' ? undefined : values.password.trim(),
            username: values.username.trim(),
            email: values.email.toLowerCase(),
          })

          if (!result) {
            onError()
          } else {
            await onSuccess()
          }
        } catch {
          onError()
        } finally {
          setSubmitting(false)
        }
      }}
    >
      {({ values, isSubmitting, isValid, validateField }) => {
        return (
          <Form className="md:h-full">
            <div className="order-2 flex flex-col justify-between gap-3 rounded-md md:order-1 md:h-full md:bg-slate-50 md:p-4">
              <div>
                <H3 className={{ root: 'mb-0 border-b' }}>
                  {t('shared.generic.profile')}
                </H3>
                {!user.email ? (
                  <UserNotification
                    message={t('pwa.profile.emailMissing')}
                    type="error"
                    className={{ root: 'mt-2' }}
                  />
                ) : null}
                <div className="mb-2 space-y-3">
                  <FormikTextField
                    // TODO: as soon as verification mechanism for email is implemented, add check for "isEmailValid" in DB for disabled field as emails with typos cannot be changed currently
                    disabled={
                      user?.email !== '' &&
                      user?.email !== null &&
                      typeof user?.email !== 'undefined' &&
                      !!values.email
                    }
                    name="email"
                    label={t('shared.generic.email')}
                    className={{
                      label: 'mt-2 text-black',
                    }}
                    data={{ cy: 'update-account-email' }}
                  />
                  <DebouncedUsernameField
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
                      return utils.participant.checkNameAvailable.fetch({
                        username: name,
                      })
                    }}
                    unavailableMessage={t(
                      'shared.generic.usernameAvailability'
                    )}
                    className={{ label: 'mt-0' }}
                    data={{ cy: 'update-account-username' }}
                  />
                  {process.env.NEXT_PUBLIC_IS_ASSESSMENT !== 'true' && (
                    <>
                      <FormikTextField
                        name="password"
                        label={t('shared.generic.password')}
                        className={{ label: 'text-black' }}
                        type="password"
                        data={{ cy: 'update-account-password' }}
                      />
                      <FormikTextField
                        name="passwordRepetition"
                        label={t('shared.generic.passwordRepetition')}
                        className={{ label: 'text-black' }}
                        type="password"
                        data={{ cy: 'update-account-password-repetition' }}
                      />
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div>
                  <div className="mb-1 font-bold">
                    {t('pwa.profile.publicProfile')}
                  </div>
                  <div className="space-between flex flex-row gap-4">
                    <div className="flex flex-col items-center gap-1">
                      <FormikSwitchField
                        name="isProfilePublic"
                        data={{ cy: 'update-account-toggle-profile-public' }}
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

                <Button
                  fluid
                  type="submit"
                  disabled={isSubmitting || !isValid || !isUsernameAvailable}
                  loading={isSubmitting}
                  className={{ root: 'border-primary-100 h-8' }}
                  data={{ cy: 'save-account-update' }}
                >
                  <Button.Icon icon={faSave} loading={isSubmitting} />
                  <Button.Label>{t('shared.generic.save')}</Button.Label>
                </Button>
              </div>
            </div>
          </Form>
        )
      }}
    </Formik>
  )
}

export default UpdateAccountInfoForm
