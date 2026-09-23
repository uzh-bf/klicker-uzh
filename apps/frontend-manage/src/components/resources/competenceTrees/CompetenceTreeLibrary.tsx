import { CompetenceTreeLibrary } from '@klicker-uzh/adaptive-manage-ui'
import {
  AdaptiveManageHostProvider,
  adaptiveManageHostPorts,
} from '../../../adaptive/AdaptiveManageHostProvider'
export default function AdaptiveHostWrapper() {
  return (
    <AdaptiveManageHostProvider ports={adaptiveManageHostPorts}>
      <CompetenceTreeLibrary />
    </AdaptiveManageHostProvider>
  )
}
