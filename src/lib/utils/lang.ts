import { defineMessages, IntlShape } from 'react-intl'

export function generateTypesLabel(intl: IntlShape): any {
  const messages = defineMessages({
    freeLabel: {
      defaultMessage: 'Free Text (FT)',
      id: 'common.FREE.label',
    },
    freeRangeLabel: {
      defaultMessage: 'Numerical (NR)',
      id: 'common.FREE_RANGE.label',
    },
    mcLabel: {
      defaultMessage: 'Multiple Choice (MC)',
      id: 'common.MC.label',
    },
    scLabel: {
      defaultMessage: 'Single Choice (SC)',
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

export function generateTypesShort(intl: IntlShape): any {
  const messages = defineMessages({
    freeRangeShort: {
      defaultMessage: 'NR',
      id: 'common.FREE_RANGE.short',
    },
    freeShort: {
      defaultMessage: 'FT',
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
