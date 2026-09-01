import { useTranslations } from 'next-intl'
import * as yup from 'yup'

// note: named with a `use` prefix (and called as a hook) rather than taking
// `t` as a parameter, since typing the parameter explicitly as
// `ReturnType<typeof useTranslations>` blows up tsc with TS2590 ("union type
// too complex") given how large this repo's generated Messages type already is
export function useEscapeRoomYupFields() {
  const t = useTranslations()

  return {
    isEscapeRoom: yup.boolean(),
    escapeRoomTimeLimit: yup.number().when('isEscapeRoom', {
      is: true,
      then: (schema) =>
        schema
          .required(t('manage.activityWizard.escapeRoomTimeLimitRequired'))
          .integer(t('manage.activityWizard.escapeRoomInteger'))
          .positive(t('manage.activityWizard.escapeRoomTimeLimitPositive'))
          .max(1440, t('manage.activityWizard.escapeRoomTimeLimitMax')),
      otherwise: (schema) => schema.notRequired(),
    }),
    escapeRoomHintPenalty: yup.number().when('isEscapeRoom', {
      is: true,
      then: (schema) =>
        schema
          .required(t('manage.activityWizard.escapeRoomHintPenaltyRequired'))
          .integer(t('manage.activityWizard.escapeRoomInteger'))
          .min(0, t('manage.activityWizard.escapeRoomHintPenaltyMin'))
          .max(3600, t('manage.activityWizard.escapeRoomHintPenaltyMax')),
      otherwise: (schema) => schema.notRequired(),
    }),
    escapeRoomIntroText: yup
      .string()
      .max(5000, t('manage.activityWizard.escapeRoomIntroTextMax')),
  }
}
