import HTML5Backend from 'react-dnd-html5-backend'
import { DragDropContext } from 'react-dnd'

export default (ComposedComponent) => {
  const WithDnD = DragDropContext(HTML5Backend)(ComposedComponent)

  WithDnD.displayName = `WithDnD(${ComposedComponent.displayName || ComposedComponent.name})`

  return WithDnD
}
