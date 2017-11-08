/* eslint-disable import/prefer-default-export, react/prop-types, no-unused-vars */

import React from 'react'
import Autosuggest from 'react-autosuggest'
import _sortBy from 'lodash/sortBy'

const autocompleteRenderInput = (tags, currentValue) => ({ addTag, ...props }) => {
  const handleOnChange = (e, { newValue, method }) => {
    if (method === 'enter') {
      e.preventDefault()
    } else {
      props.onChange(e)
    }
  }

  const inputValue = (props.value && props.value.trim().toLowerCase()) || ''
  const inputLength = inputValue.length

  // calculate suggestions for possible tags
  const suggestions = tags.filter(
    tag =>
      tag.name.toLowerCase().slice(0, inputLength) === inputValue &&
      !currentValue.includes(tag.name),
  )

  // sort the suggestions
  const sortedSuggestions = _sortBy(suggestions, ['name'])

  const getSuggestionValue = suggestion => suggestion.name
  const renderSuggestion = suggestion => <span>{suggestion.name}</span>

  return (
    <Autosuggest
      ref={props.ref}
      suggestions={sortedSuggestions}
      shouldRenderSuggestions={value => value && value.trim().length > 0}
      getSuggestionValue={getSuggestionValue}
      renderSuggestion={renderSuggestion}
      inputProps={{ ...props, onChange: handleOnChange }}
      onSuggestionSelected={(e, { suggestion }) => {
        addTag(suggestion.name)
      }}
      onSuggestionsClearRequested={() => {}}
      onSuggestionsFetchRequested={() => {}}
    />
  )
}

export { autocompleteRenderInput }
