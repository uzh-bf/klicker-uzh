import { Block } from '@klicker-uzh/graphql/dist/ops'
import { useMemo } from 'react'

interface useEvaluationTabsProps {
  blocks: Block[]
  selectedBlock: number
  width: number
}

function useEvaluationTabs({
  blocks,
  selectedBlock,
  width,
}: useEvaluationTabsProps) {
  // the tabs array will only include the tabs that should be rendered (at most 2 * width + 1 tabs) to prevent overflows
  const tabs = useMemo(() => {
    const tabs = blocks.map((block) => {
      return {
        label: 'Block ' + String(block.blockIx + 1),
        value: block.blockIx,
      }
    })

    // if fewer tabs than the maximum amount are available, return all tabs
    if (tabs.length <= 2 * width + 1) {
      return tabs
    }
    // return width tabs on both sides of the selected tab and the selected tab itself
    else if (
      selectedBlock >= width &&
      selectedBlock <= tabs.length - width - 1
    ) {
      return tabs.filter(
        (tab) =>
          tab.value <= selectedBlock + width &&
          tab.value >= selectedBlock - width
      )
    }
    // if the selected tab is too close to the end for width on both sides, return the last 2 * width + 1 tabs
    else if (selectedBlock >= blocks.length - 2) {
      return tabs.filter((tab) => tab.value >= blocks.length - 2 * width - 1)
    }

    // if the selected tab is too close to the beginning for width on both sides, return the first 2 * width + 1 tabs
    return tabs.slice(0, 2 * width + 1)
  }, [blocks, selectedBlock, width])

  return tabs
}

export default useEvaluationTabs
