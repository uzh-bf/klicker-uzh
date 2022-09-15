import { AvatarProps, BigHead } from '@bigheads/core'
import { NextPageWithLayout } from '@pages/_app'
import { Button, H1 } from '@uzh-bf/design-system'
import { Field, Form, Formik } from 'formik'
import hash from 'object-hash'
import { omit } from 'ramda'
import { AVATAR_LABELS, AVATAR_OPTIONS } from 'src/constants'
import * as yup from 'yup'

const fakeUsername = 'testuser'
const EditProfile: NextPageWithLayout = () => {
  const onSubmit = (values: any) => {
    console.log('submit', values)
  }

  const initialValues: {
    userName: string
    body: AvatarProps['body']
    skinTone: AvatarProps['skinTone']
    eyes: AvatarProps['eyes']
    eyebrows: AvatarProps['eyebrows']
    mouth: AvatarProps['mouth']
    hair: AvatarProps['hair']
    facialHair: AvatarProps['facialHair']
    clothing: AvatarProps['clothing']
    accessory: AvatarProps['accessory']
    graphic: AvatarProps['graphic']
    hat: AvatarProps['hat']
    hairColor: AvatarProps['hairColor']
    clothingColor: AvatarProps['clothingColor']
    lipColor: AvatarProps['lipColor']
  } = {
    userName: fakeUsername,
    body: AVATAR_OPTIONS.body[0],
    skinTone: AVATAR_OPTIONS.skinTone[0],
    eyes: AVATAR_OPTIONS.eyes[0],
    eyebrows: AVATAR_OPTIONS.eyebrows[0],
    mouth: AVATAR_OPTIONS.mouth[0],
    hair: AVATAR_OPTIONS.hair[0],
    facialHair: AVATAR_OPTIONS.facialHair[0],
    clothing: AVATAR_OPTIONS.clothing[0],
    accessory: AVATAR_OPTIONS.accessory[0],
    graphic: AVATAR_OPTIONS.graphic[0],
    hat: AVATAR_OPTIONS.hat[0],
    hairColor: AVATAR_OPTIONS.hairColor[0],
    clothingColor: AVATAR_OPTIONS.clothingColor[0],
  }

  return (
    <Formik
      validationSchema={yup.object({
        body: yup.string(),
        // TODO: min and max length of username
        name: yup.string().min(5),
      })}
      initialValues={initialValues}
      onSubmit={(values, { setSubmitting }) => {
        setSubmitting(true)
        const valuesToHash = omit(['userName'], values)
        const hashedValues = hash(valuesToHash)
        console.log('submit', valuesToHash, hashedValues)
        setSubmitting(false)
      }}
    >
      {({ values, errors, isSubmitting, isValid }) => {
        return (
          <div className="flex flex-col items-center justify-center">
            <H1>Profil Bearbeiten</H1>
            <BigHead
              accessory={values.accessory}
              body={values.body}
              clothing={values.clothing}
              clothingColor={values.clothingColor}
              eyebrows={values.eyebrows}
              eyes={values.eyes}
              faceMask={false}
              facialHair={values.facialHair}
              graphic={values.graphic}
              hair={values.hair}
              hairColor={values.hairColor}
              hat={values.hat}
              lashes={false}
              mask={false}
              mouth={values.mouth}
              skinTone={values.skinTone}
              className="h-48"
            />
            <Form>
              <div className="flex flex-row items-center mt-7">
                <div className="flex-1">
                  <p className="font-bold">Geschlecht</p>
                </div>
                <div className="flex-1">
                  <Field as="select" name="body" style={{ width: '100%' }}>
                    {AVATAR_OPTIONS.body.map((value) => (
                      <option value={value}>{AVATAR_LABELS[value]}</option>
                    ))}
                  </Field>
                </div>
              </div>

              <div className="flex flex-row items-center">
                <div className="flex-1">
                  <p className="font-bold">Hautfarbe</p>
                </div>
                <div className="flex-1">
                  <Field as="select" name="skinTone" style={{ width: '100%' }}>
                    {AVATAR_OPTIONS.skinTone.map((value) => (
                      <option value={value}>{AVATAR_LABELS[value]}</option>
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
                      <option value={value}>{AVATAR_LABELS[value]}</option>
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
                      <option value={value}>{AVATAR_LABELS[value]}</option>
                    ))}
                  </Field>
                </div>
              </div>

              <div className="flex flex-row items-center">
                <div className="flex-1">
                  <p className="font-bold">Haarfarbe</p>
                </div>
                <div className="flex-1">
                  <Field as="select" name="hairColor" style={{ width: '100%' }}>
                    {AVATAR_OPTIONS.hairColor.map((value) => (
                      <option value={value}>{AVATAR_LABELS[value]}</option>
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
                      <option value={value}>{AVATAR_LABELS[value]}</option>
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
                      <option value={value}>{AVATAR_LABELS[value]}</option>
                    ))}
                  </Field>
                </div>
              </div>

              <div className="flex flex-row items-center">
                <div className="flex-1">
                  <p className="font-bold">Brille</p>
                </div>
                <div className="flex-1">
                  <Field as="select" name="accessory" style={{ width: '100%' }}>
                    {AVATAR_OPTIONS.accessory.map((value) => (
                      <option value={value}>{AVATAR_LABELS[value]}</option>
                    ))}
                  </Field>
                </div>
              </div>

              <div className="flex flex-row items-center">
                <div className="flex-1">
                  <p className="font-bold">Benutzername</p>
                </div>
                <div className="flex-1">
                  <Field
                    type="text"
                    name="userName"
                    style={{ width: '100%', backgroundColor: 'lightgray' }}
                  />
                </div>
              </div>

              <div className="flex justify-center mt-7">
                <Button type="submit" disabled={isSubmitting || !isValid}>
                  Save
                </Button>
              </div>
            </Form>
          </div>
        )
      }}
    </Formik>
  )
}

export default EditProfile
