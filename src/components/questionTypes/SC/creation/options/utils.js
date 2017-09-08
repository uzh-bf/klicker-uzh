// reorder an array using start and end index
const reorder = (list, startIndex, endIndex) => {
  const result = Array.from(list)
  const [removed] = result.splice(startIndex, 1)
  result.splice(endIndex, 0, removed)

  return result
}

// handle the drag end event
const onDragEnd = (items, result, cb) => {
  // check whether the item was dropped outside the list
  if (!result.destination) {
    return
  }

  // reorder the items accordingly
  const reordered = reorder(items, result.source.index, result.destination.index)

  // callback with the new order
  cb(reordered)
}

export { reorder, onDragEnd }
