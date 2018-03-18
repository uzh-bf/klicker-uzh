import { compose, withStateHandlers, withProps } from 'recompose'
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

        console.log(newMap.toJS())

        return {
          numSelectedItems: newMap.size,
          selectedItems: newMap,
        }
      },
    }),
    withProps(({ handleSelectItem }) => ({
      // the extra parameter allows us to pass in the activeVersion
      // from within the onCheck callback in the question component
      handleSelectItem: (id, item) => extra => handleSelectItem(id, { ...item, ...extra }),
    })),
  )(ComposedComponent)

  withSelection.displayName = `withSelection(${ComposedComponent.displayName ||
    ComposedComponent.name})`

  return withSelection
}
