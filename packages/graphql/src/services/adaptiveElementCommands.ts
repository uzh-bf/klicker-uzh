import { createAdaptiveElementCommands } from '@klicker-uzh/adaptive-server/services/adaptiveElementCommands'
import {
  formatManipulatedElement,
  getManipulatedElementCreationIdentity,
  manipulateElement,
} from './elements.js'

export const { manipulateElementWithInitialCompetenceTreeAssignment } =
  createAdaptiveElementCommands({
    formatManipulatedElement,
    getManipulatedElementCreationIdentity,
    manipulateElement,
  })
