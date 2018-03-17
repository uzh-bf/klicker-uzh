import { compose, withStateHandlers } from 'recompose'
import { OrderedMap } from 'immutable'

const initialState = {
  numSelectedItems: 0,
  selectedItems: OrderedMap(),
}

export default (ComposedComponent) => {
  const withSelection = compose(
    withStateHandlers(initialState, {
      // reset the selection to the initial state
      handleResetSelection: () => () => initialState,

      // handle the selection of a new item (toggle)
      handleSelectItem: ({ selectedItems }) => (id, item) => {
        const newMap = selectedItems.has(id)
          ? selectedItems.delete(id)
          : selectedItems.set(id, item)

        console.log(newMap)

        return {
          numSelectedItems: newMap.size,
          selectedItems: newMap,
        }
      },
    }),
  )(ComposedComponent)

  withSelection.displayName = `withSelection(${ComposedComponent.displayName ||
    ComposedComponent.name})`

  return withSelection
}
