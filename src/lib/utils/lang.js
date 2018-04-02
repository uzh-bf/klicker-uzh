import { defineMessages } from 'react-intl'

export const generateTypesLabel = (intl) => {
  const messages = defineMessages({
    freeLabel: {
      defaultMessage: 'FREE',
      id: 'common.FREE.label',
    },
    freeRangeLabel: {
      defaultMessage: 'FREE_RANGE',
      id: 'common.FREE_RANGE.label',
    },
    mcLabel: {
      defaultMessage: 'MC',
      id: 'common.MC.label',
    },
    scLabel: {
      defaultMessage: 'SC',
      id: 'common.SC.label',
    },
  })

  return {
    FREE: intl.formatMessage(messages.freeLabel),
    FREE_RANGE: intl.formatMessage(messages.freeRangeLabel),
    MC: intl.formatMessage(messages.mcLabel),
    SC: intl.formatMessage(messages.scLabel),
  }
}

export const generateTypesShort = (intl) => {
  const messages = defineMessages({
    freeRangeShort: {
      defaultMessage: 'FREE_RANGE',
      id: 'common.FREE_RANGE.short',
    },
    freeShort: {
      defaultMessage: 'FREE',
      id: 'common.FREE.short',
    },
    mcShort: {
      defaultMessage: 'MC',
      id: 'common.MC.short',
    },
    scShort: {
      defaultMessage: 'SC',
      id: 'common.SC.short',
    },
  })

  return {
    FREE: intl.formatMessage(messages.freeShort),
    FREE_RANGE: intl.formatMessage(messages.freeRangeShort),
    MC: intl.formatMessage(messages.mcShort),
    SC: intl.formatMessage(messages.scShort),
  }
}
