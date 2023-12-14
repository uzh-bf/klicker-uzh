import { useLazyQuery, useMutation, useQuery } from '@apollo/client'
import { faSave } from '@fortawesome/free-regular-svg-icons'
import {
  faCircleExclamation,
  faPencil,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ChangeShortnameDocument,
  ChangeUserLocaleDocument,
  CheckShortnameAvailableDocument,
  GetUserScopeDocument,
  LocaleType,
  UserLoginScope,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import DebouncedUsernameField from '@klicker-uzh/shared-components/src/DebouncedUsernameField'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H1, Select, Tooltip } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { Suspense, useState } from 'react'
import * as Yup from 'yup'
import Layout from '../../components/Layout'
import DelegatedAccessSettings from '../../components/user/DelegatedAccessSettings'
import Setting from '../../components/user/Setting'
import SimpleSetting from '../../components/user/SimpleSetting'

function Settings() {
  const t = useTranslations()
  const router = useRouter()
  const { pathname, asPath, query } = router

  const [isShortnameAvailable, setIsShortnameAvailable] = useState<
    boolean | undefined
  >(true)

  const { data: user } = useQuery(UserProfileDocument)
  const { data: scope } = useQuery(GetUserScopeDocument)
  const [changeUserLocale] = useMutation(ChangeUserLocaleDocument)
  const [changeShortname] = useMutation(ChangeShortnameDocument)
  const [checkShortnameAvailable] = useLazyQuery(
    CheckShortnameAvailableDocument
  )

  const [editShortname, setEditShortname] = useState(false)

  return (
    <Layout displayName={t('shared.generic.settings')}>
      <div className="mx-auto p-4 w-[46rem] max-w-full flex flex-col border border-solid border-uzh-grey-100 rounded">
        <H1>{t('manage.settings.userSettings')}</H1>
        <SimpleSetting
          label={t('shared.generic.shortname')}
          tooltip={t.rich('manage.settings.shortnameRequirements', {
            ul: (children) => <ul>{children}</ul>,
            li: (children) => <li>- {children}</li>,
          })}
        >
          {editShortname ? (
            <Formik
              initialValues={{ shortname: user?.userProfile?.shortname || '' }}
              onSubmit={async (values, { setErrors, setSubmitting }) => {
                setSubmitting(true)
                const trimmedShortname = values.shortname.trim()

                const result = await changeShortname({
                  variables: { shortname: trimmedShortname },
                })

                if (!result) {
                  setErrors({
                    shortname: t('shared.generic.systemError'),
                  })
                } else if (
                  result.data?.changeShortname?.shortname !== trimmedShortname
                ) {
                  setErrors({
                    shortname: t('manage.settings.shortnameTaken'),
                  })
                } else {
                  setSubmitting(false)
                  setEditShortname(false)
                }
              }}
              validationSchema={Yup.object().shape({
                shortname: Yup.string()
                  .required(t('manage.settings.shortnameRequired'))
                  .min(5, t('manage.settings.shortnameMin'))
                  .max(8, t('manage.settings.shortnameMax'))
                  .matches(
                    /^[a-zA-Z0-9]*$/,
                    t('manage.settings.shortnameAlphanumeric')
                  ),
              })}
            >
              {({ isSubmitting, isValid, errors, validateField }) => (
                <Form className="flex flex-row items-center gap-1 font-normal text-black">
                  {Object.keys(errors).length > 0 && (
                    <Tooltip
                      tooltip={Object.values(errors)[0]}
                      delay={0}
                      className={{ tooltip: 'text-sm' }}
                    >
                      <FontAwesomeIcon
                        icon={faCircleExclamation}
                        className="mr-1 text-red-600"
                      />
                    </Tooltip>
                  )}
                  <DebouncedUsernameField
                    className={{
                      root: 'w-36',
                      label: 'hidden',
                      input: 'bg-white h-8',
                      icon: 'bg-transparent',
                    }}
                    name="shortname"
                    label={t('shared.generic.shortname')}
                    labelType="normal"
                    valid={isShortnameAvailable}
                    setValid={(shortnameAvailable: boolean | undefined) =>
                      setIsShortnameAvailable(shortnameAvailable)
                    }
                    validateField={async () => {
                      await validateField('shortname')
                    }}
                    checkUsernameAvailable={async (name: string) => {
                      const { data: result } = await checkShortnameAvailable({
                        variables: { shortname: name },
                      })
                      return result?.checkShortnameAvailable ?? false
                    }}
                    required
                    hideError
                  />
                  <Button
                    disabled={isSubmitting || !isValid}
                    type="submit"
                    className={{
                      root: 'h-8 w-8 items-center justify-center shadow-none border-uzh-grey-60',
                    }}
                  >
                    <FontAwesomeIcon icon={faSave} />
                  </Button>
                </Form>
              )}
            </Formik>
          ) : (
            <div className="flex flex-row items-center gap-5 italic font-normal text-black">
              <div>{user?.userProfile?.shortname}</div>
              <FontAwesomeIcon
                icon={faPencil}
                className="hover:cursor-pointer hover:text-primary-80"
                onClick={() => setEditShortname(true)}
              />
            </div>
          )}
        </SimpleSetting>

        <SimpleSetting
          label={t('manage.settings.languageSettings')}
          tooltip={t('manage.settings.languageTooltip')}
        >
          <Select
            value={user?.userProfile?.locale || 'en'}
            onChange={(newLocale: string) => {
              changeUserLocale({
                variables: { locale: newLocale as LocaleType },
              })
              router.push({ pathname, query }, asPath, {
                locale: newLocale,
              })
            }}
            items={[
              { label: t('shared.generic.english'), value: 'en' },
              { label: t('shared.generic.german'), value: 'de' },
            ]}
            className={{
              content: 'font-normal text-black',
              trigger: 'font-normal text-black',
            }}
          />
        </SimpleSetting>

        {typeof scope?.userScope !== 'undefined' &&
          scope.userScope === UserLoginScope.AccountOwner && (
            <Setting title={t('auth.delegatedAccess')}>
              <Suspense fallback={<Loader />}>
                <DelegatedAccessSettings
                  shortname={user?.userProfile?.shortname}
                />
              </Suspense>
            </Setting>
          )}
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

export default Settings
