import { CatalogObjectType } from '@klicker-uzh/graphql/dist/ops'
import CatalogInfoAnswerCollection from './CatalogInfoAnswerCollection'

function CatalogAdditionalObjectInfo({
  objectId,
  objectType,
}: {
  objectId: string | number
  objectType: CatalogObjectType
}) {
  if (objectType === CatalogObjectType.AnswerCollection) {
    return <CatalogInfoAnswerCollection id={objectId as number} />
  }

  return null
}

export default CatalogAdditionalObjectInfo
