import { useMutation, useQuery } from '@apollo/client'
import { faSave } from '@fortawesome/free-regular-svg-icons'
import { faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ChangeShortnameDocument,
  ChangeUserLocaleDocument,
  LocaleType,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, FormikTextField, H1, Select } from '@uzh-bf/design-system'
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

  const { data: user } = useQuery(UserProfileDocument)
  const [changeUserLocale] = useMutation(ChangeUserLocaleDocument)
  const [changeShortname] = useMutation(ChangeShortnameDocument)

  const [editShortname, setEditShortname] = useState(false)

  return (
    <Layout displayName={t('shared.generic.settings')}>
      <div className="mx-auto p-4 w-[42rem] max-w-full flex flex-col border border-solid border-uzh-grey-100 rounded">
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
              onSubmit={async (values, { setSubmitting }) => {
                const result = await changeShortname({
                  variables: { shortname: values.shortname },
                })

                if (result.data?.changeShortname?.id) {
                  setEditShortname(false)
                }
              }}
              validationSchema={Yup.object().shape({
                // TODO: show error messages in a proper place without causing significant layout shifts
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
              {({ isSubmitting, isValid }) => (
                <Form className="flex flex-row items-center gap-1 text-black font-normal">
                  <FormikTextField
                    name="shortname"
                    className={{
                      field: 'w-36',
                      input: 'bg-white h-8',
                    }}
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
            <div className="italic font-normal text-black flex flex-row items-center gap-5">
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

        <Setting title={t('auth.delegatedAccess')}>
          <Suspense fallback={<Loader />}>
            <DelegatedAccessSettings shortname={user?.userProfile?.shortname} />
          </Suspense>
        </Setting>
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
