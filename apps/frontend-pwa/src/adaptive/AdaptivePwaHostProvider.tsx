import {
  type AdaptivePwaHostPorts,
  AdaptivePwaHostProvider,
} from '@klicker-uzh/adaptive-pwa-ui/ports'
import PreviewMessage from '../components/common/PreviewMessage'
import { LAYOUT_SCROLL_CONTAINER_ID } from '../components/Layout'
export const adaptivePwaHostPorts: AdaptivePwaHostPorts = {
  PreviewMessage,
  scrollContainerId: LAYOUT_SCROLL_CONTAINER_ID,
}
export { AdaptivePwaHostProvider }
