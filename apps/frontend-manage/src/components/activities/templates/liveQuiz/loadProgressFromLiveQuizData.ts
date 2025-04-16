import { TemplateCollapsibleUIStates } from '../SectionCollapsible'
import { LiveQuizTemplateFormValues } from '../types'

function loadProgressFromLiveQuizData({
  quizData,
}: {
  quizData: LiveQuizTemplateFormValues
}): TemplateCollapsibleUIStates {
  const progress: TemplateCollapsibleUIStates = {
    settings: {
      open: false,
      status: quizData.settingsProcessed ? 'success' : 'due',
    },
  }

  // create the block and element states with numeric indices as keys
  quizData.blocks.forEach((block, blockIx) => {
    progress[blockIx] = {}

    block.elements.forEach((element, elementIx) => {
      progress[blockIx][elementIx] = {
        open: false,
        status: element.processed ? 'success' : 'due',
      }
    })
  })

  return progress
}

export default loadProgressFromLiveQuizData
