import { ObjectType } from '@lib/constants/sharingEnums'
import CatalogInfoAnswerCollection from './CatalogInfoAnswerCollection'

function CatalogAdditionalObjectInfo({
  objectId,
  objectType,
}: {
  objectId: string | number
  objectType: ObjectType
}) {
  if (objectType === ObjectType.AnswerCollection) {
    return <CatalogInfoAnswerCollection id={objectId as number} />
  }

  return null
}

export default CatalogAdditionalObjectInfo
