// Limits for lecturer-authored chat modes. They live apart from the parsing
// helpers so a browser bundle can read them without loading the validation
// module's Node-only dependencies.
export const CHATBOT_CUSTOM_MODE_NAME_MAX_LENGTH = 60
export const CHATBOT_CUSTOM_MODE_DESCRIPTION_MAX_LENGTH = 160
export const CHATBOT_CUSTOM_MODE_PERSONA_MAX_LENGTH = 1000
export const CHATBOT_CUSTOM_MODE_MAX_COUNT = 5
