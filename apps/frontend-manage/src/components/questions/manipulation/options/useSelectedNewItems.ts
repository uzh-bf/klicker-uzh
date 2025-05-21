import { Dispatch, SetStateAction, useMemo } from 'react'

function useSelectedNewItems({
  createdItems,
  itemSelectionMode,
  setSelectedItems,
}: {
  createdItems: string[]
  itemSelectionMode: 'existing' | 'new'
  setSelectedItems?: Dispatch<SetStateAction<{ id: number; name: string }[]>>
}) {
  return useMemo(() => {
    if (
      createdItems.length === 0 ||
      typeof itemSelectionMode === 'undefined' ||
      itemSelectionMode === 'existing'
    ) {
      return []
    }

    if (setSelectedItems) {
      setSelectedItems(
        createdItems.map((item, index) => ({ id: index, name: item }))
      )
    }

    return null
  }, [createdItems, itemSelectionMode, setSelectedItems])
}

export default useSelectedNewItems
