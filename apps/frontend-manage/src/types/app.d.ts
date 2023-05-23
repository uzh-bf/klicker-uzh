// Use type safe message keys with `next-intl`
type Messages = typeof import('shared-components/src/intl-messages/en.json')
declare interface IntlMessages extends Messages {}
