import de from './messages/de'
import en from './messages/en'

type MessageShape<T> = T extends string
  ? string
  : T extends Record<string, unknown>
    ? { [K in keyof T]: MessageShape<T[K]> }
    : T

const deHasEnglishKeys: MessageShape<typeof en> = de
const enHasGermanKeys: MessageShape<typeof de> = en

void deHasEnglishKeys
void enHasGermanKeys
