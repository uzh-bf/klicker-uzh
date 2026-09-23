import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import optionLabel from './optionLabel'

function useElementTypeOptions() {
  const t = useTranslations()
  return [
    {
      value: ElementType.Sc,
      label: optionLabel(
        t(`shared.${ElementType.Sc}.typeLabel`),
        t(`shared.${ElementType.Sc}.description`)
      ),
      shortLabel: t(`shared.${ElementType.Sc}.typeLabel`),
      data: {
        cy: `select-question-type-${t(`shared.${ElementType.Sc}.typeLabel`)}`,
      },
    },
    {
      value: ElementType.Mc,
      label: optionLabel(
        t(`shared.${ElementType.Mc}.typeLabel`),
        t(`shared.${ElementType.Mc}.description`)
      ),
      shortLabel: t(`shared.${ElementType.Mc}.typeLabel`),
      data: {
        cy: `select-question-type-${t(`shared.${ElementType.Mc}.typeLabel`)}`,
      },
    },
    {
      value: ElementType.Kprim,
      label: optionLabel(
        t(`shared.${ElementType.Kprim}.typeLabel`),
        t(`shared.${ElementType.Kprim}.description`)
      ),
      shortLabel: t(`shared.${ElementType.Kprim}.typeLabel`),
      data: {
        cy: `select-question-type-${t(
          `shared.${ElementType.Kprim}.typeLabel`
        )}`,
      },
    },
    {
      value: ElementType.Numerical,
      label: optionLabel(
        t(`shared.${ElementType.Numerical}.typeLabel`),
        t(`shared.${ElementType.Numerical}.description`)
      ),
      shortLabel: t(`shared.${ElementType.Numerical}.typeLabel`),
      data: {
        cy: `select-question-type-${t(
          `shared.${ElementType.Numerical}.typeLabel`
        )}`,
      },
    },
    {
      value: ElementType.FreeText,
      label: optionLabel(
        t(`shared.${ElementType.FreeText}.typeLabel`),
        t(`shared.${ElementType.FreeText}.description`)
      ),
      shortLabel: t(`shared.${ElementType.FreeText}.typeLabel`),
      data: {
        cy: `select-question-type-${t(
          `shared.${ElementType.FreeText}.typeLabel`
        )}`,
      },
    },
    {
      value: ElementType.Selection,
      label: optionLabel(
        t(`shared.${ElementType.Selection}.typeLabel`),
        t(`shared.${ElementType.Selection}.description`)
      ),
      shortLabel: t(`shared.${ElementType.Selection}.typeLabel`),
      data: {
        cy: `select-question-type-${t(
          `shared.${ElementType.Selection}.typeLabel`
        )}`,
      },
    },
    {
      value: ElementType.CaseStudy,
      label: optionLabel(
        t(`shared.${ElementType.CaseStudy}.typeLabel`),
        t(`shared.${ElementType.CaseStudy}.description`)
      ),
      shortLabel: t(`shared.${ElementType.CaseStudy}.typeLabel`),
      data: {
        cy: `select-question-type-${t(
          `shared.${ElementType.CaseStudy}.typeLabel`
        )}`,
      },
    },
    {
      value: ElementType.Content,
      label: optionLabel(
        t(`shared.${ElementType.Content}.typeLabel`),
        t(`shared.${ElementType.Content}.description`)
      ),
      shortLabel: t(`shared.${ElementType.Content}.typeLabel`),
      data: {
        cy: `select-question-type-${t(
          `shared.${ElementType.Content}.typeLabel`
        )}`,
      },
    },
    {
      value: ElementType.Flashcard,
      label: optionLabel(
        t(`shared.${ElementType.Flashcard}.typeLabel`),
        t(`shared.${ElementType.Flashcard}.description`)
      ),
      shortLabel: t(`shared.${ElementType.Flashcard}.typeLabel`),
      data: {
        cy: `select-question-type-${t(
          `shared.${ElementType.Flashcard}.typeLabel`
        )}`,
      },
    },
  ]
}

export default useElementTypeOptions
