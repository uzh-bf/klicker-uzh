import ObjectImport from './import/ObjectImport'
import PendingSharingRequests from './import/PendingSharingRequests'

function CatalogBrowser() {
  return (
    <div className="h-full">
      <PendingSharingRequests />
      <ObjectImport />
    </div>
  )
}

export default CatalogBrowser
