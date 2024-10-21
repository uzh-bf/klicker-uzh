import { ElementStatus } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'

function useStatusOptions() {
  const t = useTranslations()

  return [
    {
      value: ElementStatus.Draft,
      label: t(`shared.${ElementStatus.Draft}.statusLabel`),
      data: {
        cy: `select-question-status-${t(
          `shared.${ElementStatus.Draft}.statusLabel`
        )}`,
      },
    },
    {
      value: ElementStatus.Review,
      label: t(`shared.${ElementStatus.Review}.statusLabel`),
      data: {
        cy: `select-question-status-${t(
          `shared.${ElementStatus.Review}.statusLabel`
        )}`,
      },
    },
    {
      value: ElementStatus.Ready,
      label: t(`shared.${ElementStatus.Ready}.statusLabel`),
      data: {
        cy: `select-question-status-${t(
          `shared.${ElementStatus.Ready}.statusLabel`
        )}`,
      },
    },
  ]
}

export default useStatusOptions
