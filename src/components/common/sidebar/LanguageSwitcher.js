import React from 'react'
import { Dropdown } from 'semantic-ui-react'
import { compose, withStateHandlers } from 'recompose'
import PropTypes from 'prop-types'
import Cookies from 'js-cookie'

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

const propTypes = {
  handleChangeLocale: PropTypes.func.isRequired,
  locale: PropTypes.string.isRequired,
}

const LanguageSwitcher = ({ locale, handleChangeLocale }) => (
  <div className="languageSwitcher">
    <Dropdown
      fluid
      search
      selection
      upward
      defaultValue={locale}
      options={languageOptions}
      placeholder={'Select Language'}
      onChange={(param, data) => handleChangeLocale(data.value)}
    />
  </div>
)

LanguageSwitcher.propTypes = propTypes

export default compose(
  withStateHandlers(
    {
      locale: Cookies.get('locale') || 'en',
    },
    {
      handleChangeLocale: () => (locale) => {
        Cookies.set('locale', locale)
        // TODO: could this be done more nicely?
        location.reload() // eslint-disable-line no-restricted-globals
        return { locale }
      },
    },
  ),
)(LanguageSwitcher)
