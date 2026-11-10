// What a chatbot starts with when its owner never touches the credit
// controls. One credit is one participant message. The daily refill means
// the chatbot is usable by participants on the day it is created, rather
// than waiting for a longer reset period to elapse. The server applies it to
// new chatbots, and Manage compares against it to label a policy as default.
// It lives apart from the other helpers so a browser bundle can read it.
export const DEFAULT_CHATBOT_CREDIT_POLICY_VALUES = {
  creditInitialCredits: 3,
  creditResetPeriod: 'DAILY',
  creditResetAmount: 3,
  creditMaxCredits: 3,
} as const
