import { useMutation, useQuery } from '@apollo/client'
import { BigHead } from '@bigheads/core'
import Layout from '@components/Layout'
import UserNotification from '@components/UserNotification'
import {
  SelfDocument,
  UpdateParticipantProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { NextPageWithLayout } from '@pages/_app'
import { Button } from '@uzh-bf/design-system'
import { Field, Form, Formik } from 'formik'
import Router from 'next/router'
import hash from 'object-hash'
import { omit, pick } from 'ramda'
import { AVATAR_LABELS, AVATAR_OPTIONS } from 'src/constants'
import * as yup from 'yup'

const EditProfile: NextPageWithLayout = () => {
  const { data, loading } = useQuery(SelfDocument)
  const [updateParticipantProfile, { error }] = useMutation(
    UpdateParticipantProfileDocument
  )

  if (loading || !data?.self) {
    return <div>Loading...</div>
  }

  return (
    <Layout>
      <Formik
        validationSchema={yup.object({
          body: yup.string(),
          // TODO: min and max length of username
          name: yup.string().min(5),
        })}
        initialValues={{
          userName: data.self.username,

          // TODO: canton or country on the shirts
          body: data.self.avatarSettings?.body ?? AVATAR_OPTIONS.body[0],
          skinTone:
            data.self.avatarSettings?.skinTone ?? AVATAR_OPTIONS.skinTone[0],
          eyes: data.self.avatarSettings?.eyes ?? AVATAR_OPTIONS.eyes[0],
          mouth: data.self.avatarSettings?.mouth ?? AVATAR_OPTIONS.mouth[0],
          hair: data.self.avatarSettings?.hair ?? AVATAR_OPTIONS.hair[0],
          clothingColor:
            data.self.avatarSettings?.clothingColor ??
            AVATAR_OPTIONS.clothingColor[0],
          accessory:
            data.self.avatarSettings?.accessory ?? AVATAR_OPTIONS.accessory[0],
          hairColor:
            data.self.avatarSettings?.hairColor ?? AVATAR_OPTIONS.hairColor[0],
          facialHair:
            data.self.avatarSettings?.facialHair ??
            AVATAR_OPTIONS.facialHair[0],
          eyebrows: 'raised',
          faceMask: false,
          lashes: false,
          mask: false,
          clothing: 'shirt',
          graphic: 'none',
          hat: 'none',
        }}
        onSubmit={async (values, { setSubmitting }) => {
          setSubmitting(true)

          const avatarSettings = omit(['userName'], values)
          const avatarHash = hash(avatarSettings)

          const result = await updateParticipantProfile({
            variables: {
              username: values.userName,
              avatar: avatarHash,
              avatarSettings: pick(
                [
                  'body',
                  'skinTone',
                  'eyes',
                  'mouth',
                  'hair',
                  'clothingColor',
                  'accessory',
                  'hairColor',
                  'facialHair',
                ],
                avatarSettings
              ),
            },
          })

          Router.push('/profile')
        }}
      >
        {({ values, errors, isSubmitting, isValid }) => {
          return (
            <div className="flex flex-col items-center justify-center md:border md:p-4 md:rounded md:max-w-md md:m-auto">
              <BigHead
                className="border rounded-full h-36 md:h-48 border-uzh-blue-20"
                eyebrows={AVATAR_OPTIONS.eyebrows[0] as 'raised'}
                faceMask={false}
                lashes={false}
                mask={false}
                clothing={AVATAR_OPTIONS.clothing[0] as 'shirt'}
                hat={AVATAR_OPTIONS.hat[0] as 'none'}
                graphic={AVATAR_OPTIONS.graphic[0] as 'none'}
                accessory={values.accessory}
                body={values.body}
                skinTone={values.skinTone}
                clothingColor={values.clothingColor}
                eyes={values.eyes}
                hair={values.hair}
                hairColor={values.hairColor}
                mouth={values.mouth}
                facialHair={values.facialHair}
              />

              <Form>
                <div className="mt-4 space-y-2">
                  <div className="flex flex-row items-center">
                    <div className="flex-1">
                      <p className="font-bold">Benutzername</p>
                    </div>
                    <div className="flex-1">
                      <Field className="w-full" type="text" name="userName" />
                    </div>
                  </div>

                  <div className="flex flex-row items-center">
                    <div className="flex-1">
                      <p className="font-bold">Geschlecht</p>
                    </div>
                    <div className="flex-1">
                      <Field as="select" name="body" style={{ width: '100%' }}>
                        {AVATAR_OPTIONS.body.map((value) => (
                          <option key={value} value={value}>
                            {AVATAR_LABELS[value]}
                          </option>
                        ))}
                      </Field>
                    </div>
                  </div>

                  <div className="flex flex-row items-center">
                    <div className="flex-1">
                      <p className="font-bold">Frisur</p>
                    </div>
                    <div className="flex-1">
                      <Field as="select" name="hair" style={{ width: '100%' }}>
                        {AVATAR_OPTIONS.hair.map((value) => (
                          <option key={value} value={value}>
                            {AVATAR_LABELS[value]}
                          </option>
                        ))}
                      </Field>
                    </div>
                  </div>

                  <div className="flex flex-row items-center">
                    <div className="flex-1">
                      <p className="font-bold">Haarfarbe</p>
                    </div>
                    <div className="flex-1">
                      <Field
                        as="select"
                        name="hairColor"
                        style={{ width: '100%' }}
                      >
                        {AVATAR_OPTIONS.hairColor.map((value) => (
                          <option key={value} value={value}>
                            {AVATAR_LABELS[value]}
                          </option>
                        ))}
                      </Field>
                    </div>
                  </div>

                  <div className="flex flex-row items-center">
                    <div className="flex-1">
                      <p className="font-bold">Augen</p>
                    </div>
                    <div className="flex-1">
                      <Field as="select" name="eyes" style={{ width: '100%' }}>
                        {AVATAR_OPTIONS.eyes.map((value) => (
                          <option key={value} value={value}>
                            {AVATAR_LABELS[value]}
                          </option>
                        ))}
                      </Field>
                    </div>
                  </div>

                  <div className="flex flex-row items-center">
                    <div className="flex-1">
                      <p className="font-bold">Brille</p>
                    </div>
                    <div className="flex-1">
                      <Field
                        as="select"
                        name="accessory"
                        style={{ width: '100%' }}
                      >
                        {AVATAR_OPTIONS.accessory.map((value) => (
                          <option key={value} value={value}>
                            {AVATAR_LABELS[value]}
                          </option>
                        ))}
                      </Field>
                    </div>
                  </div>

                  <div className="flex flex-row items-center">
                    <div className="flex-1">
                      <p className="font-bold">Mund</p>
                    </div>
                    <div className="flex-1">
                      <Field as="select" name="mouth" style={{ width: '100%' }}>
                        {AVATAR_OPTIONS.mouth.map((value) => (
                          <option key={value} value={value}>
                            {AVATAR_LABELS[value]}
                          </option>
                        ))}
                      </Field>
                    </div>
                  </div>

                  <div className="flex flex-row items-center">
                    <div className="flex-1">
                      <p className="font-bold">Gesichtsbehaarung</p>
                    </div>
                    <div className="flex-1">
                      <Field
                        as="select"
                        name="facialHair"
                        style={{ width: '100%' }}
                      >
                        {AVATAR_OPTIONS.facialHair.map((value) => (
                          <option key={value} value={value}>
                            {AVATAR_LABELS[value]}
                          </option>
                        ))}
                      </Field>
                    </div>
                  </div>

                  <div className="flex flex-row items-center">
                    <div className="flex-1">
                      <p className="font-bold">Kleiderfarbe</p>
                    </div>
                    <div className="flex-1">
                      <Field
                        as="select"
                        name="clothingColor"
                        style={{ width: '100%' }}
                      >
                        {AVATAR_OPTIONS.clothingColor.map((value) => (
                          <option key={value} value={value}>
                            {AVATAR_LABELS[value]}
                          </option>
                        ))}
                      </Field>
                    </div>
                  </div>

                  <div className="flex flex-row items-center">
                    <div className="flex-1">
                      <p className="font-bold">Hautfarbe</p>
                    </div>
                    <div className="flex-1">
                      <Field
                        as="select"
                        name="skinTone"
                        style={{ width: '100%' }}
                      >
                        {AVATAR_OPTIONS.skinTone.map((value) => (
                          <option key={value} value={value}>
                            {AVATAR_LABELS[value]}
                          </option>
                        ))}
                      </Field>
                    </div>
                  </div>

                  <div className="pt-4">
                    <Button
                      fluid
                      type="submit"
                      disabled={isSubmitting || !isValid}
                    >
                      Save
                    </Button>
                  </div>

                  {error && (
                    <UserNotification
                      notificationType="error"
                      message="Please choose a different username."
                    />
                  )}
                </div>
              </Form>
            </div>
          )
        }}
      </Formik>
    </Layout>
  )
}

export default EditProfile
