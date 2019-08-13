import { useReducer } from 'react'

const INITIAL_STATE = { ids: [], items: [] }

function reducer(state, action): any {
  switch (action.type) {
    case 'SELECT':
      // if the id is already selected, unselect (toggle)
      if (state.ids.includes(action.id)) {
        const index = state.ids.indexOf(action.id)
        return {
          ids: [...state.ids].splice(index),
          items: [...state.items].splice(index),
        }
      }

      // if the id has not been selected before, add it
      return {
        ids: [...state.ids, action.id],
        items: [...state.items, action.item],
      }

    case 'RESET':
      return INITIAL_STATE

    default:
      return state
  }
}

function useSelection(): [any, any, any] {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)

  const onSelectItem = (id, item): any => (extra): void => {
    dispatch({ type: 'SELECT', id, item: { ...item, ...extra } })
  }
  const onResetSelection = (): void => {
    dispatch({ type: 'RESET' })
  }

  return [state, onSelectItem, onResetSelection]
}

export default useSelection
