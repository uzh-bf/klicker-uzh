export enum StatusCode {
  SUCCESS = 200, // Request succeeded
  BAD_REQUEST = 400, // Malformed request (e.g. missing/invalid parameter, invalid header)
  UNAUTHORIZED = 401, // Invalid or missing API key
  NOT_FOUND = 404, // Resource not found (optional, e.g. courseID not found)
  UNSUPPORTED_MEDIA_TYPE = 415,
  TOO_MANY_REQUESTS = 429, // Too many requests in a short time
  INTERNAL_SERVER_ERROR = 500,
}

export interface ActivityType {
  id: string
  title: string
  path: string
  olatConfigurationKey: string
  isSubselectionRequired: boolean
  isEmailTransferRequired: boolean
}

export interface ActivityTypeOfCourse {
  id: string
  title: string
  olatConfigurationKey: string
  isSubselectionRequired: boolean
}

export const activityKeysSubselection: string[] = [
  'live-quiz',
  'practice-quiz',
  'micro-learning',
] as const // NOTE: add more if required
export type ActivityTypeSubselection = (typeof activityKeysSubselection)[number]

export interface AccountParameters {
  provider: string
  providerAccountId: string
}

export interface CourseParameters {
  courseID: string
}

export interface ActivityTypeKeyParameters {
  activityTypeKey: string
}

export interface ParametersError {
  error: string
  status: StatusCode
}
