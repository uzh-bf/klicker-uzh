import { Dispatch, SetStateAction, useMemo } from 'react'
import { ElementFormTypesCaseStudy } from '../types'

function useSelectedNewItems({
  createdItems,
  itemSelectionMode,
  setSelectedItems,
}: {
  createdItems: ElementFormTypesCaseStudy['options']['manuallyCreatedItems']
  itemSelectionMode: 'existing' | 'new'
  setSelectedItems?: Dispatch<SetStateAction<{ id: number; name: string }[]>>
}) {
  return useMemo(() => {
    if (
      typeof createdItems === 'undefined' ||
      createdItems.length === 0 ||
      typeof itemSelectionMode === 'undefined' ||
      itemSelectionMode === 'existing'
    ) {
      return []
    }

    setSelectedItems?.(
      createdItems.map((item) => ({ id: item.id, name: item.value }))
    )
    return null
  }, [createdItems, itemSelectionMode, setSelectedItems])
}

export default useSelectedNewItems
