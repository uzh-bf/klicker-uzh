import { useLazyQuery } from '@apollo/client'
import { faSave } from '@fortawesome/free-regular-svg-icons'
import { CheckParticipantNameAvailableDocument } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import DebouncedUsernameField from '@klicker-uzh/shared-components/src/DebouncedUsernameField'
import DynamicMarkdown from '@klicker-uzh/shared-components/src/evaluation/DynamicMarkdown'
import {
  Button,
  Checkbox,
  FormikTextField,
  H3,
  H4,
  RadioGroup,
  RadioGroupItem,
  ShadcnLabel,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import * as yup from 'yup'

import ParticipantDataDisclosure from '../participant/ParticipantDataDisclosure'

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
  const isAssessment = process.env.NEXT_PUBLIC_IS_ASSESSMENT === 'true'
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
        t('shared.generic.usernameAvailability'),
        () =>
          typeof isUsernameAvailable === 'undefined' ||
          isUsernameAvailable === true
      ),
    password: yup
      .string()
      .required()
      .min(8, t('pwa.profile.passwordMinLength', { length: '8' })),
    researchConsent: yup
      .boolean()
      .required(t('pwa.createAccount.signup.dataUseChoiceRequired')),
    learningAnalyticsConsent: yup
      .boolean()
      .required(t('pwa.createAccount.signup.dataUseChoiceRequired')),
    acknowledged: yup
      .boolean()
      .required(t('pwa.createAccount.signup.acknowledgementRequired'))
      .oneOf([true], t('pwa.createAccount.signup.acknowledgementRequired')),
  })

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
        isProfilePublic: true,
        researchConsent: true,
        learningAnalyticsConsent: undefined as boolean | undefined,
        acknowledged: false,
      }}
      validationSchema={createAccountSchema}
      onSubmit={handleSubmit}
    >
      {({ isSubmitting, isValid, setFieldValue, values, validateField }) => (
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
                        !values.acknowledged && 'border-red-600 bg-red-400'
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
                            !values.acknowledged && 'text-red-600'
                          ),
                        }}
                        content={t(
                          isAssessment
                            ? 'pwa.createAccount.signup.assessmentAcknowledgement'
                            : 'pwa.createAccount.signup.acknowledgement'
                        )}
                      />
                    }
                    onCheck={() =>
                      setFieldValue('acknowledged', !values.acknowledged)
                    }
                    checked={values.acknowledged}
                  />
                </div>
              </div>
              <Button
                primary
                type="submit"
                disabled={
                  !isValid ||
                  typeof values.researchConsent !== 'boolean' ||
                  typeof values.learningAnalyticsConsent !== 'boolean' ||
                  !values.acknowledged
                }
                loading={isSubmitting}
                className={{
                  root: 'h-8 w-full flex-none md:w-max',
                }}
                data={{ cy: 'create-profile-button' }}
              >
                <Button.Icon icon={faSave} loading={isSubmitting} />
                <Button.Label>
                  {t(
                    isAssessment
                      ? 'pwa.createAccount.signup.assessmentSubmit'
                      : 'pwa.createAccount.signup.submit'
                  )}
                </Button.Label>
              </Button>
            </div>
            <div className="order-1 gap-3 rounded md:order-1 md:bg-slate-50 md:p-4">
              <H3 className={{ root: 'mb-0 border-b' }}>
                {t('pwa.createAccount.signup.accountTitle')}
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
                  unavailableMessage={t('shared.generic.usernameAvailability')}
                  className={{ label: 'mt-0' }}
                  data={{ cy: 'username-field-account-creation' }}
                />
                <p className="text-sm text-slate-600">
                  {t('pwa.createAccount.signup.usernameHint')}
                </p>
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
              </div>
            </div>
            <div className="order-2 space-y-2 rounded md:order-2 md:justify-between md:bg-slate-50 md:p-4">
              <H3 className={{ root: 'mb-0 border-b' }}>
                {t('pwa.createAccount.signup.dataUseTitle')}
              </H3>
              <ParticipantDataDisclosure isAssessment={isAssessment} />
              <section className="space-y-2 rounded bg-slate-50 p-3">
                <H4>{t('pwa.createAccount.signup.researchConsentTitle')}</H4>
                <Markdown
                  withProse
                  withLinkButtons={false}
                  className={{ root: 'prose-sm' }}
                  content={t(
                    'pwa.createAccount.signup.researchConsentDescription'
                  )}
                />
                <RadioGroup
                  aria-label={t(
                    'pwa.createAccount.signup.researchConsentTitle'
                  )}
                  aria-required="true"
                  className="mt-2 gap-2"
                  value={
                    values.researchConsent === undefined
                      ? ''
                      : values.researchConsent
                        ? 'yes'
                        : 'no'
                  }
                  onValueChange={(value) => {
                    if (value === 'yes' || value === 'no') {
                      setFieldValue('researchConsent', value === 'yes')
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem
                      value="yes"
                      id="research-consent-yes"
                      data-cy="research-consent-yes"
                    />
                    <ShadcnLabel htmlFor="research-consent-yes">
                      {t('pwa.createAccount.signup.researchConsentYes')}
                    </ShadcnLabel>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem
                      value="no"
                      id="research-consent-no"
                      data-cy="research-consent-no"
                    />
                    <ShadcnLabel htmlFor="research-consent-no">
                      {t('pwa.createAccount.signup.researchConsentNo')}
                    </ShadcnLabel>
                  </div>
                </RadioGroup>
              </section>
              <section className="space-y-2 rounded bg-slate-50 p-3">
                <H4>
                  {t('pwa.createAccount.signup.learningAnalyticsConsentTitle')}
                </H4>
                <Markdown
                  withProse
                  withLinkButtons={false}
                  className={{ root: 'prose-sm' }}
                  content={t(
                    'pwa.createAccount.signup.learningAnalyticsConsentDescription'
                  )}
                />
                <RadioGroup
                  aria-label={t(
                    'pwa.createAccount.signup.learningAnalyticsConsentTitle'
                  )}
                  aria-required="true"
                  className="mt-2 gap-2"
                  value={
                    values.learningAnalyticsConsent === undefined
                      ? ''
                      : values.learningAnalyticsConsent
                        ? 'yes'
                        : 'no'
                  }
                  onValueChange={(value) => {
                    if (value === 'yes' || value === 'no') {
                      setFieldValue('learningAnalyticsConsent', value === 'yes')
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem
                      value="yes"
                      id="learning-analytics-consent-yes"
                      data-cy="learning-analytics-consent-yes"
                    />
                    <ShadcnLabel htmlFor="learning-analytics-consent-yes">
                      <span className="flex flex-col">
                        <span>
                          {t(
                            'pwa.createAccount.signup.learningAnalyticsConsentYes'
                          )}
                        </span>
                        <span className="text-sm text-slate-600">
                          {t(
                            'pwa.createAccount.signup.learningAnalyticsConsentYesDescription'
                          )}
                        </span>
                      </span>
                    </ShadcnLabel>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem
                      value="no"
                      id="learning-analytics-consent-no"
                      data-cy="learning-analytics-consent-no"
                    />
                    <ShadcnLabel htmlFor="learning-analytics-consent-no">
                      <span className="flex flex-col">
                        <span>
                          {t(
                            'pwa.createAccount.signup.learningAnalyticsConsentNo'
                          )}
                        </span>
                        <span className="text-sm text-slate-600">
                          {t(
                            'pwa.createAccount.signup.learningAnalyticsConsentNoDescription'
                          )}
                        </span>
                      </span>
                    </ShadcnLabel>
                  </div>
                </RadioGroup>
                <a
                  className="text-sm underline"
                  data-cy="learning-analytics-privacy-policy"
                  href={t('auth.privacyUrl')}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('pwa.profile.dataUsePrivacyPolicy')}
                </a>
              </section>
            </div>
          </div>
        </Form>
      )}
    </Formik>
  )
}

export default CreateAccountForm
