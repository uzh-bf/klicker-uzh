import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'

function useElementTypeOptions() {
  const t = useTranslations()
  return [
    {
      value: ElementType.Sc,
      label: t(`shared.${ElementType.Sc}.typeLabel`),
      data: {
        cy: `select-question-type-${t(`shared.${ElementType.Sc}.typeLabel`)}`,
      },
    },
    {
      value: ElementType.Mc,
      label: t(`shared.${ElementType.Mc}.typeLabel`),
      data: {
        cy: `select-question-type-${t(`shared.${ElementType.Mc}.typeLabel`)}`,
      },
    },
    {
      value: ElementType.Kprim,
      label: t(`shared.${ElementType.Kprim}.typeLabel`),
      data: {
        cy: `select-question-type-${t(
          `shared.${ElementType.Kprim}.typeLabel`
        )}`,
      },
    },
    {
      value: ElementType.Numerical,
      label: t(`shared.${ElementType.Numerical}.typeLabel`),
      data: {
        cy: `select-question-type-${t(
          `shared.${ElementType.Numerical}.typeLabel`
        )}`,
      },
    },
    {
      value: ElementType.FreeText,
      label: t(`shared.${ElementType.FreeText}.typeLabel`),
      data: {
        cy: `select-question-type-${t(
          `shared.${ElementType.FreeText}.typeLabel`
        )}`,
      },
    },
    {
      value: ElementType.Selection,
      label: t(`shared.${ElementType.Selection}.typeLabel`),
      data: {
        cy: `select-question-type-${t(
          `shared.${ElementType.Selection}.typeLabel`
        )}`,
      },
    },
    {
      value: ElementType.CaseStudy,
      label: t(`shared.${ElementType.CaseStudy}.typeLabel`),
      data: {
        cy: `select-question-type-${t(
          `shared.${ElementType.CaseStudy}.typeLabel`
        )}`,
      },
    },
    {
      value: ElementType.QrScan,
      label: t(`shared.${ElementType.QrScan}.typeLabel`),
      data: {
        cy: `select-question-type-${t(
          `shared.${ElementType.QrScan}.typeLabel`
        )}`,
      },
    },
    {
      value: ElementType.Content,
      label: t(`shared.${ElementType.Content}.typeLabel`),
      data: {
        cy: `select-question-type-${t(
          `shared.${ElementType.Content}.typeLabel`
        )}`,
      },
    },
    {
      value: ElementType.Flashcard,
      label: t(`shared.${ElementType.Flashcard}.typeLabel`),
      data: {
        cy: `select-question-type-${t(
          `shared.${ElementType.Flashcard}.typeLabel`
        )}`,
      },
    },
  ]
}

export default useElementTypeOptions
