declare module '@klicker-uzh/lti'
declare module 'next-ims-lti'

// Use type safe message keys with `next-intl`
type Messages =
  typeof import('@klicker-uzh/shared-components/src/intl-messages/en.json')
declare interface IntlMessages extends Messages {}
