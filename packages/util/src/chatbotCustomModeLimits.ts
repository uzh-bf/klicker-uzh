// Limits for lecturer-authored chat modes. They live apart from the parsing
// helpers so a browser bundle can read them without loading the validation
// module's Node-only dependencies.
export const CHATBOT_CUSTOM_MODE_NAME_MAX_LENGTH = 60
export const CHATBOT_CUSTOM_MODE_DESCRIPTION_MAX_LENGTH = 160
export const CHATBOT_CUSTOM_MODE_PERSONA_MAX_LENGTH = 10_000
// The ceiling for lecturers granted the `chatbot-long-custom-prompts` flag. It
// is also what stored configurations may hold, so a long persona saved under
// the flag, or migrated from a legacy prompt, survives saves by anyone else.
export const CHATBOT_CUSTOM_MODE_PERSONA_EXTENDED_MAX_LENGTH = 100_000
export const CHATBOT_CUSTOM_MODE_MAX_COUNT = 5
// The authored welcome is interface text shown in an empty chat. It may span
// lines, but stays short enough to read as an introduction.
export const CHATBOT_CUSTOM_MODE_WELCOME_MESSAGE_MAX_LENGTH = 2000
// Starters stay short because the same text is used on the button and in the
// composer.
export const CHATBOT_CUSTOM_MODE_STARTER_PROMPT_MAX_COUNT = 4
export const CHATBOT_CUSTOM_MODE_STARTER_PROMPT_MAX_LENGTH = 500
// Time facts a custom mode may add to each turn; absence means none.
export const CHATBOT_CUSTOM_MODE_MEETING_CLOCKS = [
  'ELAPSED',
  'ELAPSED_AND_TIME',
] as const
