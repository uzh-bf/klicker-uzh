import { AccessLevel, CatalogObjectType } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'

function useAccessLevelSelection({ type }: { type: CatalogObjectType }) {
  const t = useTranslations()

  // TODO: once objects with execution rights are available, add the corresponding case here

  // default case: no execution permissions, all other access levels
  return [AccessLevel.Read, AccessLevel.Write, AccessLevel.Admin].map(
    (level) => ({
      label: t(`manage.resources.access${level}`),
      value: level,
      data: { cy: `access-level-${level}` },
    })
  )
}

export default useAccessLevelSelection
