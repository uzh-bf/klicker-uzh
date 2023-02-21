import { useMutation, useQuery } from '@apollo/client'
import { BigHead } from '@bigheads/core'
import {
  SelfDocument,
  UpdateParticipantProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { NextPageWithLayout } from '@pages/_app'
import {
  Button,
  Prose,
  ThemeContext,
  UserNotification,
} from '@uzh-bf/design-system'
import { ErrorMessage, Field, Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import Router from 'next/router'
import hash from 'object-hash'
import { pick } from 'ramda'
import { useContext, useEffect, useState } from 'react'
import { AVATAR_OPTIONS } from 'shared-components/src/constants'
import { twMerge } from 'tailwind-merge'
import * as yup from 'yup'
import Layout from '../components/Layout'

function EditProfile(): NextPageWithLayout {
  const t = useTranslations()
  const theme = useContext(ThemeContext)
  const { data, loading } = useQuery(SelfDocument)
  const [updateParticipantProfile, { error }] = useMutation(
    UpdateParticipantProfileDocument
  )

  const [decodedRedirectPath, setDecodedRedirectPath] = useState('/profile')

  useEffect(() => {
    const urlParams = new URLSearchParams(window?.location?.search)
    const redirectTo = urlParams?.get('redirect_to')
    if (redirectTo) {
      setDecodedRedirectPath(decodeURIComponent(redirectTo))
    }
  }, [])

  if (loading || !data?.self) {
    return <div>Loading...</div>
  }

  return (
    <Layout
      course={{ displayName: t('shared.generic.title') }}
      displayName={t('pwa.profile.editProfile')}
    >
      <Formik
        validationSchema={yup.object({
          username: yup
            .string()
            .required(t('pwa.profile.usernameRequired'))
            .min(5, t('pwa.profile.usernameMinLength', { length: '5' }))
            .max(10, t('pwa.profile.usernameMaxLength', { length: '10' })),
          password: yup
            .string()
            .optional()
            .min(8, t('pwa.profile.passwordMinLenght', { length: '8' })),
          passwordRepetition: yup.string().when('password', {
            is: (val: string) => val && val.length > 0,
            then: (schema) =>
              schema
                .required(t('pwa.profile.identicalPasswords'))
                .min(8, t('pwa.profile.passwordMinLenght', { length: '8' }))
                .oneOf(
                  [yup.ref('password'), null],
                  t('pwa.profile.identicalPasswords')
                ),
            otherwise: (schema) =>
              schema.oneOf([''], t('pwa.profile.identicalPasswords')),
          }),
        })}
        initialValues={{
          username: data.self.username,
          password: '',
          passwordRepetition: '',

          // TODO: canton or country on the shirts
          skinTone:
            data.self.avatarSettings?.skinTone ?? AVATAR_OPTIONS.skinTone[0],
          eyes: data.self.avatarSettings?.eyes ?? AVATAR_OPTIONS.eyes[0],
          mouth: data.self.avatarSettings?.mouth ?? AVATAR_OPTIONS.mouth[0],
          hair: data.self.avatarSettings?.hair ?? AVATAR_OPTIONS.hair[0],
          facialHair:
            data.self.avatarSettings?.facialHair ??
            AVATAR_OPTIONS.facialHair[0],
          accessory:
            data.self.avatarSettings?.accessory ?? AVATAR_OPTIONS.accessory[0],
          hairColor:
            data.self.avatarSettings?.hairColor ?? AVATAR_OPTIONS.hairColor[0],
          clothing:
            data.self.avatarSettings?.clothing ?? AVATAR_OPTIONS.clothing[0],
          clothingColor:
            data.self.avatarSettings?.clothingColor ??
            AVATAR_OPTIONS.clothingColor[0],
        }}
        onSubmit={async (values, { setSubmitting }) => {
          setSubmitting(true)

          const definition = {
            skinTone: values.skinTone,
            eyes: values.eyes,
            mouth: values.mouth,
            hair: values.hair,
            facialHair: values.facialHair,
            body: 'chest',
            accessory: values.accessory,
            hairColor: values.hairColor,
            clothingColor: values.clothingColor,
            eyebrows: 'raised',
            faceMask: false,
            lashes: false,
            mask: false,
            clothing: values.clothing,
            graphic: 'none',
            hat: 'none',
          }

          const avatarHash = hash(definition)

          const result = await updateParticipantProfile({
            variables: {
              password: values.password,
              username: values.username,
              avatar: avatarHash,
              avatarSettings: pick(
                [
                  'skinTone',
                  'eyes',
                  'mouth',
                  'hair',
                  'clothingColor',
                  'clothing',
                  'accessory',
                  'hairColor',
                  'facialHair',
                ],
                definition
              ),
            },
          })

          Router.replace(decodedRedirectPath)
        }}
      >
        {({ values, errors, isSubmitting, isValid }) => {
          return (
            <div className="flex flex-col md:w-full md:border md:p-8 md:rounded md:max-w-3xl md:mx-auto">
              <BigHead
                // @ts-ignore
                className={twMerge(
                  'border-b-4 h-36 md:h-48',
                  theme.primaryBorderDark
                )}
                eyebrows="raised"
                faceMask={false}
                lashes={false}
                mask={false}
                clothing={values.clothing}
                hat="none"
                graphic="none"
                accessory={values.accessory}
                body="chest"
                skinTone={values.skinTone}
                clothingColor={values.clothingColor}
                eyes={values.eyes}
                hair={values.hair}
                hairColor={values.hairColor}
                mouth={values.mouth}
                facialHair={values.facialHair}
              />

              <Form>
                <div className="flex flex-col w-full gap-8 mt-8 md:flex-row md:gap-16">
                  <div className="flex flex-col justify-between flex-1 order-2 gap-4 md:order-1">
                    {!data.self?.avatar && (
                      <Prose>{t('pwa.profile.welcomeMessage')}</Prose>
                    )}

                    <div className="space-y-4">
                      <div className="">
                        <div>
                          <p className="font-bold">
                            {t('shared.generic.username')}
                          </p>
                        </div>
                        <div>
                          <Field
                            className="w-full"
                            type="text"
                            name="username"
                          />
                        </div>
                        <ErrorMessage
                          name="username"
                          component="div"
                          className="text-sm text-red-400"
                        />
                      </div>
                      {error && (
                        <UserNotification
                          notificationType="error"
                          message="Please choose a different username."
                        />
                      )}

                      <div>
                        <div>
                          <p className="font-bold">
                            {t('shared.generic.password')}
                          </p>
                        </div>
                        <div className="flex-1">
                          <Field
                            className="w-full"
                            type="password"
                            name="password"
                          />
                        </div>
                        <ErrorMessage
                          name="password"
                          component="div"
                          className="text-sm text-red-400"
                        />
                      </div>

                      <div>
                        <div>
                          <p className="font-bold">
                            {t('shared.generic.passwordRepetition')}
                          </p>
                        </div>
                        <div>
                          <Field
                            className="w-full"
                            type="password"
                            name="passwordRepetition"
                          />
                        </div>
                        <ErrorMessage
                          name="passwordRepetition"
                          component="div"
                          className="text-sm text-red-400"
                        />
                      </div>
                    </div>

                    <div>
                      <Button
                        fluid
                        type="submit"
                        disabled={isSubmitting || !isValid}
                      >
                        {t('shared.generic.save')}
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1 order-1 space-y-2 md:order-2">
                    {Object.keys(AVATAR_OPTIONS).map((key) => (
                      <div className="flex flex-row items-center" key={key}>
                        <div className="flex-1">
                          <p className="font-bold">{t(`pwa.avatar.${key}`)}</p>
                        </div>
                        <div className="flex-1">
                          <Field
                            as="select"
                            name={key}
                            style={{ width: '100%' }}
                          >
                            {AVATAR_OPTIONS[key].map((value) => (
                              <option key={value} value={value}>
                                {t(`pwa.avatar.${value}`)}
                              </option>
                            ))}
                          </Field>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Form>
            </div>
          )
        }}
      </Formik>
    </Layout>
  )
}

export function getStaticProps({ locale }: any) {
  return {
    props: {
      messages: {
        ...require(`shared-components/src/intl-messages/${locale}.json`),
      },
    },
  }
}

export default EditProfile
