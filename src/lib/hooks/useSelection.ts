import { useReducer } from 'react'

const INITIAL_STATE = { ids: [], items: [] }

function reducer(state, action): any {
  switch (action.type) {
    case 'SELECT_BATCH':
      return {
        ids: action.items.map((el): void => el.id),
        items: action.items.map((item) => ({ ...item, version: -1 })),
      }

    case 'SELECT':
      // if the id is already selected, unselect (toggle)
      if (state.ids.includes(action.id)) {
        const index = state.ids.indexOf(action.id)
        const ids = [...state.ids]
        const items = [...state.items]
        ids.splice(index, 1)
        items.splice(index, 1)
        return { ids, items }
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

function useSelection(): [any, any, any, Function] {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)

  const onSelectItem = (id, item): any => (extra): void => {
    dispatch({ type: 'SELECT', id, item: { ...item, ...extra } })
  }
  const onSelectItems = (items): any => {
    dispatch({ type: 'SELECT_BATCH', items })
  }
  const onResetSelection = (): void => {
    dispatch({ type: 'RESET' })
  }

  return [state, onSelectItem, onResetSelection, onSelectItems]
}

export default useSelection
