import { CatalogObjectType } from '@klicker-uzh/graphql/dist/ops'
import CatalogInfoAnswerCollection from './CatalogInfoAnswerCollection'

function CatalogAdditionalObjectInfo({
  objectId,
  objectType,
}: {
  objectId: string | number
  objectType: CatalogObjectType
}) {
  // TODO: implement approach for answer collections
  if (objectType === CatalogObjectType.AnswerCollection) {
    return <CatalogInfoAnswerCollection id={objectId as number} />
  }

  return null
}

export default CatalogAdditionalObjectInfo
