import { useLazyQuery, useMutation } from '@apollo/client'
import { faSave } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  CheckUsernameAvailabilityDocument,
  Participant,
  UpdateParticipantProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import DebouncedUsernameField from '@klicker-uzh/shared-components/src/DebouncedUsernameField'
import {
  Button,
  FormikSwitchField,
  FormikTextField,
  H3,
  Prose,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import * as yup from 'yup'

interface UpdateAccountInfoFormProps {
  user: Partial<Participant>
  setShowError: (showError: boolean) => void
  setShowSuccess: (showSuccess: boolean) => void
}

function UpdateAccountInfoForm({
  user,
  setShowError,
  setShowSuccess,
}: UpdateAccountInfoFormProps) {
  const t = useTranslations()
  const [updateParticipantProfile] = useMutation(
    UpdateParticipantProfileDocument
  )
  const [checkUsernameAvailable] = useLazyQuery(
    CheckUsernameAvailabilityDocument
  )

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
            t('pwa.createAccount.usernameAvailability'),
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
                [yup.ref('password'), null],
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
          typeof values.email === 'undefined' ||
          values.email === null
        ) {
          setShowError(true)
          return
        }

        const result = await updateParticipantProfile({
          variables: {
            isProfilePublic: values.isProfilePublic,
            password:
              values.password === '' ? undefined : values.password.trim(),
            username: values.username.trim(),
            email: values.email,
          },
        })

        if (!result.data?.updateParticipantProfile || result.errors) {
          setShowError(true)
        } else {
          setShowSuccess(true)
        }
      }}
    >
      {({ values, isSubmitting, isValid, validateField }) => {
        return (
          <Form>
            <div className="flex flex-col justify-between order-2 gap-3 rounded-md md:order-1 md:bg-slate-50 md:p-4">
              <div>
                <H3 className={{ root: 'border-b mb-0' }}>
                  {t('shared.generic.profile')}
                </H3>
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
                    labelType="small"
                    className={{ label: 'font-bold text-md text-black' }}
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
                      const { data: result } = await checkUsernameAvailable({
                        variables: { username: name },
                      })
                      return result?.checkUsernameAvailability ?? false
                    }}
                  />
                  <FormikTextField
                    name="password"
                    label={t('shared.generic.password')}
                    labelType="small"
                    className={{ label: 'font-bold text-md text-black' }}
                    type="password"
                  />
                  <FormikTextField
                    name="passwordRepetition"
                    label={t('shared.generic.passwordRepetition')}
                    labelType="small"
                    className={{ label: 'font-bold text-md text-black' }}
                    type="password"
                  />
                  <div>
                    <div className="font-bold">
                      {t('pwa.profile.publicProfile')}
                    </div>
                    <div className="flex flex-row gap-4 space-between">
                      <div className="flex flex-col items-center gap-1">
                        <FormikSwitchField name="isProfilePublic" />
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

              <Button fluid type="submit" disabled={isSubmitting || !isValid}>
                <Button.Icon>
                  <FontAwesomeIcon icon={faSave} />
                </Button.Icon>
                <Button.Label>{t('shared.generic.save')}</Button.Label>
              </Button>
            </div>
          </Form>
        )
      }}
    </Formik>
  )
}

export default UpdateAccountInfoForm
