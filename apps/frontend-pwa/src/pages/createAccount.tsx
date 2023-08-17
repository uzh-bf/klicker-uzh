import {
  Button,
  Collapsible,
  FormikSwitchField,
  FormikTextField,
  H3,
  H4,
  Prose,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import generatePassword from 'generate-password'
import JWT from 'jsonwebtoken'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import nookies from 'nookies'
import * as yup from 'yup'

import { useMutation } from '@apollo/client'
import { faSave } from '@fortawesome/free-regular-svg-icons'
import { faWarning } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { CreateParticipantAccountDocument } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import { addApolloState, initializeApollo } from '@lib/apollo'
import bodyParser from 'body-parser'
import Layout from 'src/components/Layout'

interface CreateAccountProps {
  signedLtiData?: string
  ssoId?: string
  email?: string
  username: string
}

function CreateAccount({ signedLtiData, email, username }: CreateAccountProps) {
  const t = useTranslations()
  const router = useRouter()

  const [createParticipantAccount] = useMutation(
    CreateParticipantAccountDocument
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
      .max(10, t('pwa.profile.usernameMaxLength', { length: '10' })),
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
            [yup.ref('password'), null],
            t('pwa.profile.identicalPasswords')
          ),
      otherwise: (schema) =>
        schema.oneOf([''], t('pwa.profile.identicalPasswords')),
    }),
  })

  return (
    <Layout displayName={t('pwa.profile.createProfile')}>
      <Formik
        isInitialValid={false}
        initialValues={{
          email: email ?? '',
          username,
          password: '',
          passwordRepetition: '',
          isProfilePublic: true,
        }}
        validationSchema={createAccountSchema}
        onSubmit={async (values, { setSubmitting }) => {
          setSubmitting(true)

          const login = await createParticipantAccount({
            variables: {
              email: values.email,
              username: values.username,
              password: values.password,
              isProfilePublic: values.isProfilePublic,
              signedLtiData,
            },
          })

          if (login) {
            router.replace('/editProfile')
          }

          setSubmitting(false)
        }}
      >
        {({ values, isSubmitting, isValid }) => {
          return (
            <Form>
              <div className="flex flex-col md:grid md:grid-cols-2 md:w-full md:max-w-[1090px] md:mx-auto gap-2">
                <div className="order-3 md:col-span-2 gap-2 md:gap-4 flex flex-col justify-between md:flex-row bg-slate-100 rounded p-4 md:px-4 py-2 items-center">
                  <div className="flex flex-row items-center gap-4">
                    <div className="flex-none text-2xl text-slate-600">
                      <FontAwesomeIcon icon={faWarning} />
                    </div>
                    <div className="flex-1 max-w-xl text-sm text-slate-600">
                      I agree to the{' '}
                      <a
                        className="text-blue-500 hover:text-orange-500 hover:underline"
                        href="https://www.klicker.uzh.ch/privacy"
                        target="_blank"
                      >
                        privacy policy
                      </a>{' '}
                      and consent to the processing of my data as described
                      therein. I am aware that I can participate in most
                      activities anonymously if I do not agree to these
                      conditions.
                    </div>
                  </div>
                  <Button
                    className={{
                      root: 'flex-none w-full md:w-max',
                    }}
                    type="submit"
                    disabled={isSubmitting || !isValid}
                  >
                    <Button.Icon>
                      <FontAwesomeIcon icon={faSave} />
                    </Button.Icon>
                    <Button.Label>
                      {t('pwa.profile.createProfile')}
                    </Button.Label>
                  </Button>
                </div>
                <div className="order-2 md:order-1 gap-3 md:bg-slate-50 md:p-4 rounded">
                  <H3 className={{ root: 'border-b mb-0' }}>
                    {t('shared.generic.profile')}
                  </H3>
                  <div className="space-y-3 mb-2">
                    <FormikTextField
                      disabled={!!email}
                      name="email"
                      label={t('shared.generic.email')}
                      labelType="small"
                      className={{
                        label: 'font-bold text-md text-black',
                      }}
                    />
                    <FormikTextField
                      name="username"
                      label={t('shared.generic.username')}
                      labelType="small"
                      className={{
                        label: 'font-bold text-md text-black',
                      }}
                    />
                    <FormikTextField
                      name="password"
                      label={t('shared.generic.password')}
                      labelType="small"
                      className={{
                        label: 'font-bold text-md text-black',
                      }}
                      type="password"
                    />
                    <FormikTextField
                      name="passwordRepetition"
                      label={t('shared.generic.passwordRepetition')}
                      labelType="small"
                      className={{
                        label: 'font-bold text-md text-black',
                      }}
                      type="password"
                    />
                    <div>
                      <div className="font-bold">
                        {t('pwa.profile.publicProfile')}
                      </div>
                      <div className="flex flex-row space-between gap-4">
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
                <div className="order-1 md:order-2 md:bg-slate-50 md:p-4 rounded md:justify-between space-y-2">
                  <H3 className={{ root: 'border-b mb-0' }}>
                    Data Processing and Privacy
                  </H3>
                  <Collapsible
                    open
                    staticContent={<H4>What data do you collect about me?</H4>}
                  >
                    <Markdown
                      withProse
                      withLinkButtons={false}
                      content={t('pwa.profile.privacyDataCollection')}
                    />
                  </Collapsible>
                  <Collapsible
                    staticContent={
                      <H4>How will my data be shared with others?</H4>
                    }
                  >
                    <Markdown
                      withProse
                      withLinkButtons={false}
                      content={t('pwa.profile.privacyDataSharing')}
                    />
                  </Collapsible>
                  <Collapsible
                    staticContent={<H4>How is my data being used?</H4>}
                  >
                    <Markdown
                      withProse
                      withLinkButtons={false}
                      content={t('pwa.profile.privacyDataUsage')}
                    />
                  </Collapsible>
                  <Collapsible
                    staticContent={<H4>How long do you store my data?</H4>}
                  >
                    <Markdown
                      withProse
                      withLinkButtons={false}
                      content={t('pwa.profile.privacyDataStorage')}
                    />
                  </Collapsible>
                </div>
              </div>
            </Form>
          )
        }}
      </Formik>
    </Layout>
  )
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const { req, res, query } = ctx

  const cookies = nookies.get(ctx)

  // if the user already has a participant token, skip registration
  // and redirect to the edit  profile page
  let participantToken =
    cookies['participant_token'] || cookies['next-auth.session-token']

  if (participantToken) {
    return {
      redirect: {
        destination: `/editProfile`,
        permanent: false,
      },
    }
  }

  if (req.method === 'POST') {
    // extract the body from the LTI request
    // if there is a body, request a participant token
    // TODO: verify that there is an LTI body and that it is valid

    const { request }: any = await new Promise((resolve) => {
      bodyParser.urlencoded({ extended: true })(req, res, () => {
        bodyParser.json()(req, res, () => {
          resolve({ request: req })
        })
      })
    })

    if (!query.disableLti && request?.body?.lis_person_sourcedid) {
      const signedLtiData = JWT.sign(
        {
          sub: request.body.lis_person_sourcedid,
          email: request.body.lis_person_contact_email_primary,
        },
        process.env.APP_SECRET as string,
        {
          algorithm: 'HS256',
          expiresIn: '1h',
        }
      )

      const apolloClient = initializeApollo()

      return addApolloState(apolloClient, {
        props: {
          signedLtiData,
          ssoId: request.body.lis_person_sourcedid,
          email: request.body.lis_person_contact_email_primary,
          username: generatePassword.generate({
            length: 8,
            uppercase: true,
            symbols: false,
            numbers: true,
          }),
          messages: (
            await import(`@klicker-uzh/i18n/messages/${ctx.locale}.json`)
          ).default,
        },
      })
    }
  }

  return {
    props: {
      username: generatePassword.generate({
        length: 8,
        uppercase: true,
        symbols: false,
        numbers: true,
      }),
      messages: (await import(`@klicker-uzh/i18n/messages/${ctx.locale}.json`))
        .default,
    },
  }
}

export default CreateAccount
