import { initializeApollo } from '@lib/apollo'
import {
  Button,
  FormikSwitchField,
  FormikTextField,
  H3,
  Prose,
} from '@uzh-bf/design-system'
import bodyParser from 'body-parser'
import { Form, Formik } from 'formik'
import generatePassword from 'generate-password'
import JWT from 'jsonwebtoken'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import nookies from 'nookies'
import * as yup from 'yup'

import FormikAvatarEditor from '@components/participant/FormikAvatarEditor'
import { faSave } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Markdown } from '@klicker-uzh/markdown'
import { AVATAR_OPTIONS } from '@klicker-uzh/shared-components/src/constants'
import Layout from 'src/components/Layout'

interface CreateAccountProps {
  signedLtiData?: string
  ssoId?: string
  email?: string
  username: string
}

function CreateAccount({
  signedLtiData,
  ssoId,
  email,
  username,
}: CreateAccountProps) {
  const t = useTranslations()
  const router = useRouter()

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
  })

  return (
    <Layout displayName={t('pwa.profile.createProfile')}>
      <Formik
        initialValues={{
          ssoId,
          email,
          username,
          password: '',
          passwordRepetition: '',
          isProfilePublic: true,
          // TODO: canton or country on the shirts
          skinTone: AVATAR_OPTIONS.skinTone[0],
          eyes: AVATAR_OPTIONS.eyes[0],
          mouth: AVATAR_OPTIONS.mouth[0],
          hair: AVATAR_OPTIONS.hair[0],
          facialHair: AVATAR_OPTIONS.facialHair[0],
          accessory: AVATAR_OPTIONS.accessory[0],
          hairColor: AVATAR_OPTIONS.hairColor[0],
          clothing: AVATAR_OPTIONS.clothing[0],
          clothingColor: AVATAR_OPTIONS.clothingColor[0],
        }}
        validationSchema={createAccountSchema}
        onSubmit={async (values, { setSubmitting }) => {
          setSubmitting(true)

          // send ssoId, email, signature, etc. to the backend for signup
          setSubmitting(false)
        }}
      >
        {({ values, isSubmitting, isValid }) => {
          return (
            <Form>
              <div className="grid md:grid-cols-2 md:w-full md:max-w-[1090px] md:mx-auto gap-2">
                <div className="col-span-2 flex flex-row justify-between bg-slate-100 rounded p-1">
                  <div></div>
                  <Button
                    className={{
                      root: '',
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
                <div className="gap-3 md:bg-slate-50 md:p-4 rounded">
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

                <div className=" md:bg-slate-50 md:p-4 rounded justify-between space-y-4">
                  <H3 className={{ root: 'border-b mb-0' }}>Privacy</H3>
                  <Markdown
                    withProse
                    withLinkButtons={false}
                    content={t('pwa.profile.privacyNotice')}
                  />
                </div>

                <FormikAvatarEditor />
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
  // and redirect to the profile page
  // let participantToken =
  //   cookies['participant_token'] || cookies['next-auth.session-token']

  // if (participantToken) {
  //   return {
  //     redirect: {
  //       destination: `/editProfile`,
  //       permanent: false,
  //     },
  //   }
  // }

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

    if (request?.body?.lis_person_sourcedid) {
      const secret = process.env.APP_SECRET as string

      const signedLtiData = JWT.sign(
        {
          sub: request.body.lis_person_sourcedid,
          email: request.body.lis_person_contact_email_primary,
        },
        secret,
        {
          algorithm: 'HS256',
          expiresIn: '1h',
        }
      )

      return {
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
      }
    }
  }

  const apolloClient = initializeApollo()

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
