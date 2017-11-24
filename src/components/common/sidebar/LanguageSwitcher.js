import React from 'react'
import { Dropdown } from 'semantic-ui-react'
import { compose, withHandlers, withState } from 'recompose'
import PropTypes from 'prop-types'

const languageOptions = [
  {
    flag: 'gb',
    key: 'EN',
    text: 'English',
    value: 'EN',
  },
  {
    flag: 'de',
    key: 'DE',
    text: 'Deutsch',
    value: 'DE',
  },
]

const propTypes = {
  chosenLanguage: PropTypes.string.isRequired,
  handleSetLanguage: PropTypes.func.isRequired,
}

const LanguageSwitcher = ({ chosenLanguage, handleSetLanguage }) => (
  <div className="languageSwitcher">
    <Dropdown
      selection
      defaultValue={chosenLanguage}
      options={languageOptions}
      placeholder={'Select Language'}
      onChange={(param, data) => handleSetLanguage(data.value)}
    />

    <style jsx>{`
      .languageSwitcher {
        margin-top: 20rem;
      }
    `}</style>
  </div>
)

LanguageSwitcher.propTypes = propTypes

export default compose(
  withState('chosenLanguage', 'setLanguage', 'EN'), // English defined as intial language
  withHandlers({
    handleSetLanguage: ({ setLanguage }) => newLanguage => setLanguage(newLanguage),
  }),
)(LanguageSwitcher)
