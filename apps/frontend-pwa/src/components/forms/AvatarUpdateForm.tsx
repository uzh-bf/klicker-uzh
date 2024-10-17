import { useMutation } from '@apollo/client'
import { BigHead } from '@bigheads/core'
import { faSave } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Participant,
  UpdateParticipantAvatarDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  AVATAR_OPTIONS,
  AVATAR_OPTIONS_KEY,
} from '@klicker-uzh/shared-components/src/constants'
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
                    // @ts-ignore
                    className="border-primary-80 w-full border-b-4 md:h-48"
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
                <div className="flex flex-col gap-2">
                  <div className="grid w-full grid-cols-2 gap-2 text-sm md:grid-cols-3">
                    {Object.keys(AVATAR_OPTIONS).map((key) => (
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
                        label={t(`pwa.avatar.${key as AVATAR_OPTIONS_KEY}`)}
                        labelType="small"
                        name={key}
                        items={AVATAR_OPTIONS[key as AVATAR_OPTIONS_KEY].map(
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
