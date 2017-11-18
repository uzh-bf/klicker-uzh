/* eslint-disable import/prefer-default-export, react/prop-types, no-unused-vars */

import React from 'react'
import Autosuggest from 'react-autosuggest'
import _sortBy from 'lodash/sortBy'

const autocompleteRenderInput = (tags, currentValue) => ({ addTag, ...props }) => {
  const { ref, value } = props

  const handleOnChange = (e, { newValue, method }) => {
    if (method === 'enter') {
      e.preventDefault()
    } else {
      props.onChange(e)
    }
  }

  const inputValue = (value && value.trim().toLowerCase()) || ''
  const inputLength = inputValue.length

  // calculate suggestions for possible tags
  const suggestions = tags.filter(
    ({ name }) =>
      name.toLowerCase().slice(0, inputLength) === inputValue && !currentValue.includes(name),
  )

  // sort the suggestions
  const sortedSuggestions = _sortBy(suggestions, ['name'])

  const getSuggestionValue = ({ name }) => name
  const renderSuggestion = ({ name }) => <span>{name}</span>

  return (
    <Autosuggest
      getSuggestionValue={getSuggestionValue}
      inputProps={{ ...props, onChange: handleOnChange }}
      ref={ref}
      renderSuggestion={renderSuggestion}
      shouldRenderSuggestions={val => val && val.trim().length > 0}
      suggestions={sortedSuggestions}
      onSuggestionSelected={(e, { suggestion }) => {
        addTag(suggestion.name)
      }}
      onSuggestionsClearRequested={() => {}}
      onSuggestionsFetchRequested={() => {}}
    />
  )
}

export { autocompleteRenderInput }
