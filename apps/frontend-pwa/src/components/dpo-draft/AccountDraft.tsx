import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import DataUseChoices from '@klicker-uzh/shared-components/src/DataUseChoices'
import {
  Button,
  Checkbox,
  Collapsible,
  FormikTextField,
  H3,
  H4,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import * as yup from 'yup'

export default function AccountDraft() {
  const t = useTranslations()
  const [openNotices, setOpenNotices] = useState<string[]>([])
  const [complete, setComplete] = useState(false)
  const schema = yup.object({
    email: yup
      .string()
      .required(t('dpoDraft.required'))
      .email(t('dpoDraft.invalidEmail')),
    username: yup
      .string()
      .required(t('dpoDraft.required'))
      .min(5, t('dpoDraft.usernameLength'))
      .max(15, t('dpoDraft.usernameLength'))
      .test(
        'available',
        t('dpoDraft.usernameTaken'),
        (value) => value?.toLowerCase() !== 'occupied'
      ),
    password: yup
      .string()
      .required(t('dpoDraft.required'))
      .min(8, t('dpoDraft.passwordLength')),
    learningAnalytics: yup.boolean().required(t('dpoDraft.choices.required')),
    acknowledgement: yup.boolean().oneOf([true]).required(),
  })

  return (
    <Formik
      initialValues={{
        email: '',
        username: '',
        password: '',
        researchAllowed: true,
        learningAnalytics: undefined as boolean | undefined,
        acknowledgement: false,
      }}
      validationSchema={schema}
      validateOnMount
      onSubmit={(_, helpers) => {
        setComplete(true)
        helpers.setSubmitting(false)
      }}
    >
      {({ values, setFieldValue, isValid, isSubmitting }) => (
        <Form
          className="flex flex-col gap-2 md:grid md:grid-cols-2"
          data-cy="dpo-account-form"
          onChange={() => setComplete(false)}
        >
          <section className="space-y-3 rounded md:bg-slate-50 md:p-4">
            <H3 className={{ root: 'mb-0 border-b' }}>
              {t('dpoDraft.account.title')}
            </H3>
            <FormikTextField
              id="dpo-email"
              name="email"
              type="email"
              autoComplete="email"
              label={t('dpoDraft.account.email')}
              data={{ cy: 'dpo-email' }}
            />
            <FormikTextField
              id="dpo-username"
              name="username"
              autoComplete="username"
              label={t('dpoDraft.account.username')}
              data={{ cy: 'dpo-username' }}
            />
            <p className="text-sm">{t('dpoDraft.account.usernameHelp')}</p>
            <FormikTextField
              id="dpo-password"
              name="password"
              type="password"
              autoComplete="new-password"
              label={t('dpoDraft.account.password')}
              data={{ cy: 'dpo-password' }}
            />
            {(
              ['collection', 'visibility', 'purpose', 'retention'] as const
            ).map((notice) => (
              <Collapsible
                key={notice}
                open={openNotices.includes(notice)}
                onChange={() =>
                  setOpenNotices(
                    openNotices.includes(notice)
                      ? openNotices.filter((item) => item !== notice)
                      : [...openNotices, notice]
                  )
                }
                staticContent={<H4>{t(`dpoDraft.account.${notice}Title`)}</H4>}
                data={{ cy: `dpo-notice-${notice}` }}
                customTrigger={
                  <>
                    <FontAwesomeIcon
                      icon={
                        openNotices.includes(notice)
                          ? faChevronUp
                          : faChevronDown
                      }
                      size="sm"
                    />
                    <span className="sr-only">
                      {t(`dpoDraft.account.${notice}Title`)}
                    </span>
                  </>
                }
              >
                <p className="my-2 text-sm leading-relaxed">
                  {t(`dpoDraft.account.${notice}`)}
                </p>
              </Collapsible>
            ))}
          </section>
          <section className="space-y-2 rounded md:bg-slate-50 md:p-4">
            <H3 className={{ root: 'mb-0 border-b' }}>
              {t('dpoDraft.account.choicesTitle')}
            </H3>
            <DataUseChoices
              id="dpo-account"
              researchAllowed={values.researchAllowed}
              learningAnalytics={values.learningAnalytics}
              onResearchChange={(value) => {
                setComplete(false)
                void setFieldValue('researchAllowed', value)
              }}
              onLearningAnalyticsChange={(value) => {
                setComplete(false)
                void setFieldValue('learningAnalytics', value)
              }}
            />
          </section>
          <div className="space-y-3 rounded bg-slate-100 p-4 md:col-span-2">
            <Checkbox
              id="dpo-ack"
              checked={values.acknowledgement}
              onCheck={() => {
                setComplete(false)
                void setFieldValue('acknowledgement', !values.acknowledgement)
              }}
              data={{ cy: 'dpo-ack' }}
              className={{
                root: values.acknowledgement
                  ? 'h-6 w-6'
                  : 'h-6 w-6 border-red-600 bg-red-400',
              }}
              label={
                <label htmlFor="dpo-ack" className="text-sm">
                  {t.rich('dpoDraft.account.acknowledgement', {
                    privacy: (chunks) => (
                      <a
                        href="https://www.klicker.uzh.ch/privacy_policy"
                        data-cy="dpo-privacy"
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        {chunks}
                      </a>
                    ),
                    terms: (chunks) => (
                      <a
                        href="https://www.klicker.uzh.ch/terms_of_service"
                        data-cy="dpo-terms"
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        {chunks}
                      </a>
                    ),
                  })}
                </label>
              }
            />
            <div className="flex justify-end">
              <Button
                primary
                type="submit"
                disabled={!isValid || isSubmitting}
                data={{ cy: 'dpo-account-submit' }}
              >
                {t('dpoDraft.account.submit')}
              </Button>
            </div>
            {complete && (
              <p role="status" data-cy="dpo-account-result">
                {t('dpoDraft.simulatedResult')}
              </p>
            )}
          </div>
        </Form>
      )}
    </Formik>
  )
}
