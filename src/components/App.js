import { FormattedMessage } from 'react-intl'
import React from 'react'
import pageWithIntl from '../lib/pageWithIntl'

export default pageWithIntl(({ children }) =>
  (<main>
    <header>
      <h1>
        <FormattedMessage id="title" defaultMessage="Hello World" />
      </h1>
    </header>
    {children}
  </main>),
)
