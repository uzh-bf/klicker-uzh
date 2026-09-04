import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { createElement } from 'react'

// Renders the type label with a concise authoring description beneath it.
// The description is derived from apps/docs/docs/tutorials/supported_element_types.mdx.
function typeOptionLabel(typeLabel: string, description: string) {
  return createElement(
    'span',
    {
      className:
        'flex w-[calc(100vw-4rem)] max-w-[30rem] flex-col gap-0.5 whitespace-normal',
    },
    createElement('span', null, typeLabel),
    createElement(
      'span',
      { className: 'text-xs text-uzh-grey-80' },
      description
    )
  )
}

function useElementTypeOptions() {
  const t = useTranslations()
  return [
    {
      value: ElementType.Sc,
      label: typeOptionLabel(
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
      label: typeOptionLabel(
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
      label: typeOptionLabel(
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
      label: typeOptionLabel(
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
      label: typeOptionLabel(
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
      label: typeOptionLabel(
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
      label: typeOptionLabel(
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
      label: typeOptionLabel(
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
      label: typeOptionLabel(
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
