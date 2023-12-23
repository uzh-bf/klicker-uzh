import { useMutation } from '@apollo/client'
import { BigHead } from '@bigheads/core'
import { faSave } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Participant,
  UpdateParticipantAvatarDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { AVATAR_OPTIONS } from '@klicker-uzh/shared-components/src/constants'
import { Button, FormikSelectField, H3 } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import hash from 'object-hash'
import { pick } from 'ramda'

interface AvatarUpdateFormProps {
  user: Partial<Participant>
  setShowError: (showError: boolean) => void
  setShowSuccess: (showSuccess: boolean) => void
}

function AvatarUpdateForm({
  user,
  setShowError,
  setShowSuccess,
}: AvatarUpdateFormProps) {
  const t = useTranslations()
  const [updateParticipantAvatar] = useMutation(UpdateParticipantAvatarDocument)

  return (
    <Formik
      initialValues={{
        // TODO: canton or country on the shirts
        skinTone: user.avatarSettings?.skinTone ?? AVATAR_OPTIONS.skinTone[0],
        eyes: user.avatarSettings?.eyes ?? AVATAR_OPTIONS.eyes[0],
        mouth: user.avatarSettings?.mouth ?? AVATAR_OPTIONS.mouth[0],
        hair: user.avatarSettings?.hair ?? AVATAR_OPTIONS.hair[0],
        facialHair:
          user.avatarSettings?.facialHair ?? AVATAR_OPTIONS.facialHair[0],
        accessory:
          user.avatarSettings?.accessory ?? AVATAR_OPTIONS.accessory[0],
        hairColor:
          user.avatarSettings?.hairColor ?? AVATAR_OPTIONS.hairColor[0],
        clothing: user.avatarSettings?.clothing ?? AVATAR_OPTIONS.clothing[0],
        clothingColor:
          user.avatarSettings?.clothingColor ?? AVATAR_OPTIONS.clothingColor[0],
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

        const result = await updateParticipantAvatar({
          variables: {
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

        if (result.data?.updateParticipantAvatar && !result.errors) {
          setShowSuccess(true)
        } else {
          setShowError(true)
        }
      }}
    >
      {({ values, isSubmitting, isValid }) => {
        return (
          <Form>
            <div className="space-y-2 rounded md:bg-slate-50 md:p-4">
              <H3 className={{ root: 'border-b' }}>Avatar</H3>
              <div className="flex flex-col gap-4 md:flex-row md:gap-8">
                <div className="flex-1">
                  <BigHead
                    // @ts-ignore
                    className="w-full border-b-4 md:h-48 border-primary-80"
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
                <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-3 md:text-sm">
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
                data={{ cy: 'save-avatar-update' }}
              >
                <Button.Icon>
                  <FontAwesomeIcon icon={faSave} />
                </Button.Icon>
                <Button.Label>{t('shared.generic.save')}</Button.Label>
              </Button>
            </div>
          </Form>
        )
      }}
    </Formik>
  )
}

export default AvatarUpdateForm
