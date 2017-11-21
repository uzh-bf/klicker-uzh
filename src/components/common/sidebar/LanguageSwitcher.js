import React from 'react'
import { Dropdown } from 'semantic-ui-react'
import { compose, withState, withHandlers } from 'recompose'

const languageOptions = [
  {
    flag: 'gb',
    key: 'en',
    text: 'English',
    value: 'en',
  },
  {
    flag: 'de',
    key: 'de',
    text: 'Deutsch',
    value: 'de',
  },
]

const LanguageSwitcher = () => (
  <div className="languageSwitcher">
    <Dropdown selection options={languageOptions} placeholder={'Select Language'} />

    <style jsx>{`
      .languageSwitcher {
        margin-top: 20rem;
      }
    `}</style>
  </div>
)

export default compose(
  withState('chosenLanguage', 'setLanguage', 'EN'), // English defined as intial language
  withHandlers({
    handleSetLanguage: ({ setLanguage }) => newLanguage => setLanguage(newLanguage),
  }),
)(LanguageSwitcher)
