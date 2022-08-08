import { defineMessages, useIntl } from 'react-intl'
import { Input } from 'semantic-ui-react'

const messages = defineMessages({
  searchPlaceholder: {
    defaultMessage: 'Search...',
    id: 'common.input.search.placeholder',
  },
})

interface Props {
  handleSearch: any
}

function SearchField({ handleSearch }: Props) {
  const intl = useIntl()

  return (
    <Input
      fluid
      className="!flex-1 !mr-4"
      icon="search"
      placeholder={intl.formatMessage(messages.searchPlaceholder)}
      onChange={(e): void => handleSearch(e.target.value)}
    >
      <input />
    </Input>
  )
}

export default SearchField
