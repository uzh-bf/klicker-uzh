import { compose, withStateHandlers } from 'recompose'
import { OrderedSet } from 'immutable'

export default (ComposedComponent) => {
  const withSelection = compose(
    withStateHandlers(
      {
        numSelectedItems: 0,
        selectedItems: OrderedSet(),
      },
      {
        handleSelectItem: ({ selectedItems }) => (id) => {
          const newSet = selectedItems.has(id) ? selectedItems.delete(id) : selectedItems.add(id)

          console.log(newSet)

          return {
            numSelectedItems: newSet.size,
            selectedItems: newSet,
          }
        },
      },
    ),
  )(ComposedComponent)

  withSelection.displayName = `withSelection(${ComposedComponent.displayName ||
    ComposedComponent.name})`

  return withSelection
}
