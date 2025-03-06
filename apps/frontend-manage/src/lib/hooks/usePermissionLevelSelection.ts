import {
  CatalogObjectType,
  PermissionLevel,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'

function usePermissionLevelSelection({ type }: { type: CatalogObjectType }) {
  const t = useTranslations()

  // TODO: once objects with execution rights are available, add the corresponding case here

  // default case: no execution permissions, all other access levels
  return [
    PermissionLevel.Read,
    PermissionLevel.Write,
    PermissionLevel.Admin,
  ].map((level) => ({
    label: t(`manage.resources.permissions${level}`),
    value: level,
    data: { cy: `permission-level-${level}` },
  }))
}

export default usePermissionLevelSelection
