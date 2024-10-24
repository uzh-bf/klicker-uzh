import { useMutation } from '@apollo/client'
import { BigHead } from '@bigheads/core'
import { faSave } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Participant,
  UpdateParticipantAvatarDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { AvatarOptions } from '@klicker-uzh/shared-components/src/constants'
import {
  AvatarAccessoryTypes,
  AvatarClothingColorTypes,
  AvatarClothingTypes,
  AvatarEyesTypes,
  AvatarFacialHairTypes,
  AvatarHairColorTypes,
  AvatarHairTypes,
  AvatarKeyTypes,
  AvatarMouthTypes,
  AvatarSkinToneTypes,
} from '@klicker-uzh/types'
import { Button, FormikSelectField, H3 } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import hash from 'object-hash'
import { pick } from 'remeda'

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
        skinTone: user.avatarSettings?.skinTone ?? AvatarOptions.skinTone[0],
        eyes: user.avatarSettings?.eyes ?? AvatarOptions.eyes[0],
        mouth: user.avatarSettings?.mouth ?? AvatarOptions.mouth[0],
        hair: user.avatarSettings?.hair ?? AvatarOptions.hair[0],
        facialHair:
          user.avatarSettings?.facialHair ?? AvatarOptions.facialHair[0],
        accessory: user.avatarSettings?.accessory ?? AvatarOptions.accessory[0],
        hairColor: user.avatarSettings?.hairColor ?? AvatarOptions.hairColor[0],
        clothing: user.avatarSettings?.clothing ?? AvatarOptions.clothing[0],
        clothingColor:
          user.avatarSettings?.clothingColor ?? AvatarOptions.clothingColor[0],
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
            avatarSettings: pick(definition, [
              'skinTone',
              'eyes',
              'mouth',
              'hair',
              'clothingColor',
              'clothing',
              'accessory',
              'hairColor',
              'facialHair',
            ]),
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
          <Form className="md:h-full">
            <div className="rounded md:h-full md:bg-slate-50 md:p-4">
              <div className="flex flex-col justify-between md:h-full">
                <div>
                  <H3 className={{ root: 'border-b' }}>
                    {t('shared.generic.avatar')}
                  </H3>
                  <BigHead
                    // @ts-expect-error - BigHead types are not up to date
                    className="border-primary-80 w-full border-b-4 md:h-48"
                    eyebrows="raised"
                    faceMask={false}
                    lashes={false}
                    mask={false}
                    clothing={values.clothing as AvatarClothingTypes}
                    hat="none"
                    graphic="none"
                    accessory={values.accessory as AvatarAccessoryTypes}
                    body="chest"
                    skinTone={values.skinTone as AvatarSkinToneTypes}
                    clothingColor={
                      values.clothingColor as AvatarClothingColorTypes
                    }
                    eyes={values.eyes as AvatarEyesTypes}
                    hair={values.hair as AvatarHairTypes}
                    hairColor={values.hairColor as AvatarHairColorTypes}
                    mouth={values.mouth as AvatarMouthTypes}
                    facialHair={values.facialHair as AvatarFacialHairTypes}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="grid w-full grid-cols-2 gap-2 text-sm md:grid-cols-3">
                    {Object.keys(AvatarOptions).map((key) => (
                      <FormikSelectField
                        className={{
                          root: 'w-full',
                          label: 'text-md',
                          select: {
                            root: 'md:w-38 w-full',
                            trigger:
                              'h-max w-full justify-between text-sm md:p-1 md:px-3',
                            item: 'text-sm',
                          },
                        }}
                        key={key}
                        label={t(`pwa.avatar.${key as AvatarKeyTypes}`)}
                        labelType="small"
                        name={key}
                        items={AvatarOptions[key as AvatarKeyTypes].map(
                          (value) => {
                            return {
                              label: t(`pwa.avatar.${value}`),
                              value: value,
                              data: { cy: `avatar-${key}-${value}` },
                            }
                          }
                        )}
                        data={{ cy: `avatar-${key}-select` }}
                      />
                    ))}
                  </div>
                  <Button
                    fluid
                    type="submit"
                    loading={isSubmitting}
                    disabled={!isValid}
                    data={{ cy: 'save-avatar-update' }}
                  >
                    <Button.Icon>
                      <FontAwesomeIcon icon={faSave} />
                    </Button.Icon>
                    <Button.Label>{t('shared.generic.save')}</Button.Label>
                  </Button>
                </div>
              </div>
            </div>
          </Form>
        )
      }}
    </Formik>
  )
}

export default AvatarUpdateForm
