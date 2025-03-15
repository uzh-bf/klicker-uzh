import { Dispatch, SetStateAction } from 'react'
import { TemplateCollapsibleUIStates } from './SectionCollapsible'

function goToNextTemplateElement({
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
  const nextInSameBlock =
    typeof collapsibles[blockIx]?.[elementIx + 1] !== 'undefined'
  const nextInNextBlock = typeof collapsibles[blockIx + 1]?.[0] !== 'undefined'

  setCollapsibles((prev) => ({
    ...prev,
    [blockIx]: {
      ...prev[blockIx],
      [elementIx]: {
        ...prev[blockIx][elementIx],
        open: false,
      },
      ...(nextInSameBlock
        ? {
            [elementIx + 1]: {
              ...prev[blockIx][elementIx + 1],
              open: true,
            },
          }
        : {}),
    },
    ...(nextInNextBlock
      ? {
          [blockIx + 1]: {
            ...prev[blockIx + 1],
            0: {
              ...prev[blockIx + 1][0],
              open: true,
            },
          },
        }
      : {}),
  }))
}

export default goToNextTemplateElement
