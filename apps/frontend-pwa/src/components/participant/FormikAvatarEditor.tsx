import { BigHead } from '@bigheads/core'
import { AVATAR_OPTIONS } from '@klicker-uzh/shared-components/src/constants'
import { FormikSelectField, H3 } from '@uzh-bf/design-system'
import { useFormikContext } from 'formik'
import { useTranslations } from 'next-intl'

function FormikAvatarEditor() {
  const t = useTranslations()

  const { values }: any = useFormikContext()

  return (
    <div className="col-span-2 md:bg-slate-50 md:p-4 rounded space-y-2">
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
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
    </div>
  )
}

export default FormikAvatarEditor
