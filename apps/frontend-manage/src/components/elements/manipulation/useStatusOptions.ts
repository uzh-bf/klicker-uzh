import { ElementStatus } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import optionLabel from './optionLabel'

function useStatusOptions() {
  const t = useTranslations()

  return [
    {
      value: ElementStatus.Draft,
      label: optionLabel(
        t(`shared.${ElementStatus.Draft}.statusLabel`),
        t(`shared.${ElementStatus.Draft}.statusDescription`)
      ),
      shortLabel: t(`shared.${ElementStatus.Draft}.statusLabel`),
      description: t(`shared.${ElementStatus.Draft}.statusDescription`),
      data: {
        cy: `select-question-status-${t(
          `shared.${ElementStatus.Draft}.statusLabel`
        )}`,
      },
    },
    {
      value: ElementStatus.Review,
      label: optionLabel(
        t(`shared.${ElementStatus.Review}.statusLabel`),
        t(`shared.${ElementStatus.Review}.statusDescription`)
      ),
      shortLabel: t(`shared.${ElementStatus.Review}.statusLabel`),
      description: t(`shared.${ElementStatus.Review}.statusDescription`),
      data: {
        cy: `select-question-status-${t(
          `shared.${ElementStatus.Review}.statusLabel`
        )}`,
      },
    },
    {
      value: ElementStatus.Ready,
      label: optionLabel(
        t(`shared.${ElementStatus.Ready}.statusLabel`),
        t(`shared.${ElementStatus.Ready}.statusDescription`)
      ),
      shortLabel: t(`shared.${ElementStatus.Ready}.statusLabel`),
      description: t(`shared.${ElementStatus.Ready}.statusDescription`),
      data: {
        cy: `select-question-status-${t(
          `shared.${ElementStatus.Ready}.statusLabel`
        )}`,
      },
    },
  ]
}

export default useStatusOptions
