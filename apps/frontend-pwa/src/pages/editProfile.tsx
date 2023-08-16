import { useMutation, useQuery } from '@apollo/client'
import { BigHead } from '@bigheads/core'
import {
  SelfDocument,
  UpdateParticipantProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { AVATAR_OPTIONS } from '@klicker-uzh/shared-components/src/constants'
import {
  Button,
  FormikSelectField,
  FormikTextField,
  Prose,
  Toast,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import hash from 'object-hash'
import { pick } from 'ramda'
import { useEffect, useState } from 'react'
import * as yup from 'yup'
import Layout from '../components/Layout'

function EditProfile() {
  const t = useTranslations()
  const router = useRouter()
  const { data, loading } = useQuery(SelfDocument)
  const [updateParticipantProfile] = useMutation(
    UpdateParticipantProfileDocument
  )

  const [decodedRedirectPath, setDecodedRedirectPath] = useState('/profile')
  const [showError, setShowError] = useState(false)

  useEffect(() => {
    const urlParams = new URLSearchParams(window?.location?.search)
    const redirectTo = urlParams?.get('redirect_to')
    if (redirectTo) {
      setDecodedRedirectPath(decodeURIComponent(redirectTo))
    }
  }, [])

  if (loading || !data?.self) {
    return (
      <Layout
        course={{ displayName: t('shared.generic.title') }}
        displayName={t('pwa.profile.editProfile')}
      >
        <Loader />
      </Layout>
    )
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

          if (result.data?.updateParticipantProfile) {
            router.replace(decodedRedirectPath)
          } else {
            setShowError(true)
          }
        }}
      >
        {({ values, isSubmitting, isValid }) => {
          return (
            <div className="flex flex-col md:w-full md:border md:p-8 md:rounded md:max-w-3xl md:mx-auto">
              <BigHead
                // @ts-ignore
                className="border-b-4 h-36 md:h-48 border-primary-80"
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
                      <FormikTextField
                        name="username"
                        label={t('shared.generic.username')}
                        labelType="small"
                        className={{ label: 'font-bold text-md text-black' }}
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
                        <FormikSelectField
                          name={key}
                          items={AVATAR_OPTIONS[key].map((value) => {
                            return {
                              label: t(`pwa.avatar.${value}`),
                              value: value,
                            }
                          })}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </Form>
            </div>
          )
        }}
      </Formik>
      <Toast
        type="error"
        openExternal={showError}
        setOpenExternal={setShowError}
        duration={8000}
      >
        {t('pwa.profile.editProfileFailed')}
      </Toast>
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}.json`))
        .default,
    },
  }
}

export default EditProfile
