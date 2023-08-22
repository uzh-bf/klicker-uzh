import { useMutation, useQuery } from '@apollo/client'
import { BigHead } from '@bigheads/core'
import { faSave } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  DeleteParticipantAccountDocument,
  SelfDocument,
  UpdateParticipantProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { AVATAR_OPTIONS } from '@klicker-uzh/shared-components/src/constants'
import {
  Button,
  FormikSelectField,
  FormikSwitchField,
  FormikTextField,
  H3,
  Modal,
  Prose,
  Toast,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import hash from 'object-hash'
import { pick } from 'ramda'
import { useEffect, useState } from 'react'
import * as yup from 'yup'
import Layout from '../components/Layout'

function EditProfile() {
  const t = useTranslations()
  const { data, loading } = useQuery(SelfDocument)
  const [updateParticipantProfile] = useMutation(
    UpdateParticipantProfileDocument
  )
  const [deleteParticipantAccount] = useMutation(
    DeleteParticipantAccountDocument
  )

  const [decodedRedirectPath, setDecodedRedirectPath] = useState('/profile')
  const [showError, setShowError] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

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
        })}
        initialValues={{
          isProfilePublic: data.self.isProfilePublic,
          email: data.self.email,
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
              isProfilePublic: values.isProfilePublic,
              password: values.password,
              username: values.username,
              email: values.email,
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

          if (result.data?.updateParticipantProfile && !result.errors) {
            // router.replace(decodedRedirectPath)
          } else {
            setShowError(true)
          }
        }}
      >
        {({ values, isSubmitting, isValid }) => {
          return (
            <Form>
              <div className="flex flex-col md:w-full md:max-w-5xl md:mx-auto gap-4">
                <div className="flex flex-col w-full md:flex-row gap-4">
                  <div className="flex flex-col justify-between flex-1 order-2 gap-3 md:order-1 md:bg-slate-50 md:p-4 rounded">
                    <div>
                      <H3 className={{ root: 'border-b mb-0' }}>
                        {t('shared.generic.profile')}
                      </H3>
                      <div className="space-y-3 mb-2">
                        <FormikTextField
                          disabled={!!values.email}
                          name="email"
                          label={t('shared.generic.email')}
                          labelType="small"
                          className={{ label: 'font-bold text-md text-black' }}
                        />
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

                    <Button
                      fluid
                      type="submit"
                      disabled={isSubmitting || !isValid}
                    >
                      <Button.Icon>
                        <FontAwesomeIcon icon={faSave} />
                      </Button.Icon>
                      <Button.Label>{t('shared.generic.save')}</Button.Label>
                    </Button>
                  </div>

                  <div className="flex-1 order-1 md:order-2 md:bg-slate-50 md:p-4 rounded justify-between flex flex-col space-y-4">
                    <div className="flex-initial space-y-2">
                      <H3 className={{ root: 'border-b mb-0' }}>
                        {t('pwa.profile.deleteProfile')}
                      </H3>
                      <Prose className={{ root: '' }}>
                        {t('pwa.profile.deleteProfileDescription')}
                      </Prose>

                      <Modal
                        title={t('pwa.profile.deleteProfile')}
                        open={deleteModalOpen}
                        onClose={(): void => setDeleteModalOpen(false)}
                        hideCloseButton={true}
                        className={{ content: 'h-max max-w-md' }}
                        onPrimaryAction={
                          <Button
                            className={{
                              root: 'bg-red-600 border-red-700 text-white',
                            }}
                            onClick={async () => {
                              await deleteParticipantAccount()
                              window?.location.reload()
                            }}
                          >
                            {t('shared.generic.confirm')}
                          </Button>
                        }
                        onSecondaryAction={
                          <Button onClick={() => setDeleteModalOpen(false)}>
                            {t('shared.generic.cancel')}
                          </Button>
                        }
                        trigger={
                          <Button
                            onClick={(): void => setDeleteModalOpen(true)}
                          >
                            {t('shared.generic.delete')}
                          </Button>
                        }
                      >
                        {t('pwa.profile.deleteProfileConfirmation')}
                      </Modal>
                    </div>
                  </div>
                </div>

                <div className="md:bg-slate-50 md:p-4 rounded space-y-2">
                  <H3 className={{ root: 'border-b' }}>Avatar</H3>
                  <div className="flex flex-col md:flex-row gap-4 md:gap-8">
                    <div className="flex-1">
                      <BigHead
                        // @ts-ignore
                        className="border-b-4 md:h-48 border-primary-80 w-full"
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
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs md:text-sm">
                      {Object.keys(AVATAR_OPTIONS).map((key) => (
                        <FormikSelectField
                          className={{
                            root: 'w-full',
                            label: 'font-bold text-md',
                            select: {
                              root: 'w-full md:w-36',
                              trigger: 'w-full md:p-1 justify-between md:px-3',
                            },
                          }}
                          key={key}
                          label={t(`pwa.avatar.${key}`)}
                          labelType="small"
                          name={key}
                          items={AVATAR_OPTIONS[key].map((value) => {
                            return {
                              label: t(`pwa.avatar.${value}`),
                              value: value,
                            }
                          })}
                        />
                      ))}
                    </div>
                  </div>
                  <Button
                    fluid
                    type="submit"
                    disabled={isSubmitting || !isValid}
                  >
                    <Button.Icon>
                      <FontAwesomeIcon icon={faSave} />
                    </Button.Icon>
                    <Button.Label>{t('shared.generic.save')}</Button.Label>
                  </Button>
                </div>
              </div>
            </Form>
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
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export default EditProfile
