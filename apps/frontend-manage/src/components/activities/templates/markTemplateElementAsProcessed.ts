import { Dispatch, SetStateAction } from 'react'
import { TemplateCollapsibleUIStates } from './SectionCollapsible'

function markTemplateElementAsProcessed({
  collapsibles,
  setCollapsibles,
  blockIx,
  elementIx,
}: {
  collapsibles: TemplateCollapsibleUIStates
  setCollapsibles: Dispatch<SetStateAction<TemplateCollapsibleUIStates>>
  blockIx: number
  elementIx: number
}) {
  setCollapsibles((prev) => ({
    ...prev,
    [blockIx]: {
      ...prev[blockIx],
      [elementIx]: {
        open: true,
        status: 'success',
      },
    },
  }))
}

export default markTemplateElementAsProcessed
