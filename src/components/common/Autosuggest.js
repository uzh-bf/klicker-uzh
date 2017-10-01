/* eslint-disable import/prefer-default-export, react/prop-types, no-unused-vars */

import * as React from 'react'
import Autosuggest from 'react-autosuggest'

const autocompleteRenderInput = tags => ({ addTag, ...props }) => {
  const handleOnChange = (e, { newValue, method }) => {
    if (method === 'enter') {
      e.preventDefault()
    } else {
      props.onChange(e)
    }
  }

  const inputValue = (props.value && props.value.trim().toLowerCase()) || ''
  const inputLength = inputValue.length

  const suggestions = tags.filter(
    tag => tag.name.toLowerCase().slice(0, inputLength) === inputValue,
  )

  const getSuggestionValue = suggestion => suggestion.name
  const renderSuggestion = suggestion => <span>{suggestion.name}</span>

  return (
    <Autosuggest
      ref={props.ref}
      suggestions={suggestions}
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
