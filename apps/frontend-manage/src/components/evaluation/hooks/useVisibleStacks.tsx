import { StackEvaluation } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { ActiveStackType, ActivityEvaluationType } from '../ActivityEvaluation'

interface UseVisibleStacksProps {
  stacks: StackEvaluation[]
  activeStack: ActiveStackType
  width: number
  type: ActivityEvaluationType
}

function useVisibleStacks({
  stacks,
  activeStack,
  width,
  type,
}: UseVisibleStacksProps) {
  const t = useTranslations()

  const visibleStacks = useMemo(() => {
    const items = stacks.map((_, index) => ({
      label: t(
        type === 'LiveQuiz' ? 'shared.generic.blockN' : 'shared.generic.stackN',
        { number: String(index + 1) }
      ),
      value: index,
    }))

    // if fewer items than the maximum amount are available, return all items
    if (items.length <= 2 * width + 1) {
      return items
    }

    // if no stack is selected, return the first 2 * width + 1 items
    if (typeof activeStack === 'string') {
      return items.slice(0, 2 * width + 1)
    }

    // return width items on both sides of the selected item and the selected item itself
    else if (activeStack >= width && activeStack <= items.length - width - 1) {
      return items.filter(
        (item) =>
          item.value <= activeStack + width && item.value >= activeStack - width
      )
    }

    // if the selected item is too close to the end for width on both sides, return the last 2 * width + 1 items
    else if (activeStack >= stacks.length - 2) {
      return items.filter((item) => item.value >= stacks.length - 2 * width - 1)
    }

    // if the selected item is too close to the beginning for width on both sides, return the first 2 * width + 1 items
    return items.slice(0, 2 * width + 1)
  }, [activeStack, stacks, t, type, width])

  return visibleStacks
}

export default useVisibleStacks
