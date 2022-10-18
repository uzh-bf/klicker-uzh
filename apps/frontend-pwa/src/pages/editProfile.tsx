import { useMutation, useQuery } from '@apollo/client'
import { BigHead } from '@bigheads/core'
import Layout from '@components/Layout'
import UserNotification from '@components/UserNotification'
import {
  SelfDocument,
  UpdateParticipantProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { NextPageWithLayout } from '@pages/_app'
import { Button, Prose } from '@uzh-bf/design-system'
import { ErrorMessage, Field, Form, Formik } from 'formik'
import Router from 'next/router'
import hash from 'object-hash'
import { pick } from 'ramda'
import { useEffect, useState } from 'react'
import { AVATAR_LABELS, AVATAR_OPTIONS } from 'shared-components'
import * as yup from 'yup'

const EditProfile: NextPageWithLayout = () => {
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
    <Layout courseName="KlickerUZH" displayName="Profil editieren">
      <Formik
        validationSchema={yup.object({
          username: yup
            .string()
            .required()
            .min(5, 'Der Benutzername muss mindestens 5 Zeichen lang sein.')
            .max(10, 'Der Benutzername darf nicht länger als 10 Zeichen sein.'),
          password: yup
            .string()
            .optional()
            .min(8, 'Das Passwort muss mindestens 8 Zeichen lang sein.'),
          passwordRepetition: yup.string().when('password', {
            is: (val: string) => val && val.length > 0,
            then: (schema) =>
              schema
                .required('Passwörter müssen übereinstimmen.')
                .min(8, 'Das Passwort muss mindestens 8 Zeichen lang sein.')
                .oneOf(
                  [yup.ref('password'), null],
                  'Passwörter müssen übereinstimmen.'
                ),
            otherwise: (schema) =>
              schema.oneOf([''], 'Passwörter müssen übereinstimmen.'),
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
            <div className="flex flex-col md:w-full md:border md:p-8 md:rounded md:max-w-3xl md:m-auto">
              <BigHead
                // @ts-ignore
                className="border-b-4 border-uzh-blue-100 h-36 md:h-48 "
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
                    {!data.self.avatar && (
                      <Prose>
                        Willkommen beim KlickerUZH! Falls dies dein erstes Mal
                        hier ist, setze bitte ein Passwort und definiere deinen
                        eigenen Benutzernamen und Avatar.
                      </Prose>
                    )}

                    <div className="space-y-4">
                      <div className="">
                        <div>
                          <p className="font-bold">Benutzername</p>
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
                          <p className="font-bold">Passwort</p>
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
                          <p className="font-bold">Passwort (Wiederholung)</p>
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
                        Save
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1 order-1 space-y-2 md:order-2">
                    <div className="flex flex-row items-center">
                      <div className="flex-1">
                        <p className="font-bold">Frisur</p>
                      </div>
                      <div className="flex-1">
                        <Field
                          as="select"
                          name="hair"
                          style={{ width: '100%' }}
                        >
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
                        <Field
                          as="select"
                          name="eyes"
                          style={{ width: '100%' }}
                        >
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
                        <Field
                          as="select"
                          name="mouth"
                          style={{ width: '100%' }}
                        >
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
                        <p className="font-bold">Bart</p>
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
                        <p className="font-bold">Kleidungsstil</p>
                      </div>
                      <div className="flex-1">
                        <Field
                          as="select"
                          name="clothing"
                          style={{ width: '100%' }}
                        >
                          {AVATAR_OPTIONS.clothing.map((value) => (
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
                        <p className="font-bold">Hautton</p>
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

export default EditProfile
