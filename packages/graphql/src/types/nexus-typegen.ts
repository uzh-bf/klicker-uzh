/**
 * This file was generated by Nexus Schema
 * Do not make changes to this file directly
 */


import type { core } from "nexus"
declare global {
  interface NexusGenCustomInputMethods<TypeName extends string> {
    /**
     * The `JSONObject` scalar type represents JSON objects as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf).
     */
    json<FieldName extends string>(fieldName: FieldName, opts?: core.CommonInputFieldConfig<TypeName, FieldName>): void // "JSONObject";
    /**
     * A date-time string at UTC, such as 2007-12-03T10:15:30Z, compliant with the `date-time` format outlined in section 5.6 of the RFC 3339 profile of the ISO 8601 standard for representation of dates and times using the Gregorian calendar.
     */
    date<FieldName extends string>(fieldName: FieldName, opts?: core.CommonInputFieldConfig<TypeName, FieldName>): void // "DateTime";
  }
}
declare global {
  interface NexusGenCustomOutputMethods<TypeName extends string> {
    /**
     * The `JSONObject` scalar type represents JSON objects as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf).
     */
    json<FieldName extends string>(fieldName: FieldName, ...opts: core.ScalarOutSpread<TypeName, FieldName>): void // "JSONObject";
    /**
     * A date-time string at UTC, such as 2007-12-03T10:15:30Z, compliant with the `date-time` format outlined in section 5.6 of the RFC 3339 profile of the ISO 8601 standard for representation of dates and times using the Gregorian calendar.
     */
    date<FieldName extends string>(fieldName: FieldName, ...opts: core.ScalarOutSpread<TypeName, FieldName>): void // "DateTime";
  }
}


declare global {
  interface NexusGen extends NexusGenTypes {}
}

export interface NexusGenInputs {
  AvatarSettingsInput: { // input type
    accessory: string; // String!
    clothing: string; // String!
    clothingColor: string; // String!
    eyes: string; // String!
    facialHair: string; // String!
    hair: string; // String!
    hairColor: string; // String!
    mouth: string; // String!
    skinTone: string; // String!
  }
  BlockInput: { // input type
    questionIds: number[]; // [Int!]!
    randomSelection?: number | null; // Int
    timeLimit?: number | null; // Int
  }
  ResponseInput: { // input type
    choices?: number[] | null; // [Int!]
    value?: string | null; // String
  }
  SubscriptionKeys: { // input type
    auth: string; // String!
    p256dh: string; // String!
  }
  SubscriptionObjectInput: { // input type
    endpoint: string; // String!
    expirationTime?: number | null; // Int
    keys: NexusGenInputs['SubscriptionKeys']; // SubscriptionKeys!
  }
}

export interface NexusGenEnums {
  AccessMode: "PUBLIC" | "RESTRICTED"
  AttachmentType: "GIF" | "JPEG" | "LINK" | "PNG" | "SVG" | "WEBP"
  SessionBlockStatus: "ACTIVE" | "EXECUTED" | "SCHEDULED"
  SessionStatus: "COMPLETED" | "PREPARED" | "RUNNING" | "SCHEDULED"
}

export interface NexusGenScalars {
  String: string
  Int: number
  Float: number
  Boolean: boolean
  ID: string
  DateTime: any
  JSONObject: any
}

export interface NexusGenObjects {
  AggregatedConfusionFeedbacks: { // root type
    difficulty: number; // Float!
    numberOfParticipants: number; // Int!
    speed: number; // Float!
    timestamp?: NexusGenScalars['DateTime'] | null; // DateTime
  }
  Attachment: { // root type
    description?: string | null; // String
    href: string; // String!
    id: string; // String!
    name: string; // String!
    originalName?: string | null; // String
    type: NexusGenEnums['AttachmentType']; // AttachmentType!
  }
  Choice: { // root type
    correct?: boolean | null; // Boolean
    feedback?: string | null; // String
    ix: number; // Int!
    value: string; // String!
  }
  ChoicesQuestionData: { // root type
    content: string; // String!
    contentPlain: string; // String!
    id: number; // Int!
    isArchived: boolean; // Boolean!
    isDeleted: boolean; // Boolean!
    name: string; // String!
    options: NexusGenRootTypes['ChoicesQuestionOptions']; // ChoicesQuestionOptions!
    type: string; // String!
  }
  ChoicesQuestionOptions: { // root type
    choices: NexusGenRootTypes['Choice'][]; // [Choice!]!
  }
  ConfusionTimestep: { // root type
    createdAt: NexusGenScalars['DateTime']; // DateTime!
    difficulty: number; // Int!
    id: number; // Int!
    speed: number; // Int!
  }
  Course: { // root type
    color?: string | null; // String
    displayName: string; // String!
    id: string; // ID!
    learningElements: NexusGenRootTypes['LearningElement'][]; // [LearningElement!]!
    microSessions: NexusGenRootTypes['MicroSession'][]; // [MicroSession!]!
    name: string; // String!
    sessions: NexusGenRootTypes['Session'][]; // [Session!]!
  }
  Feedback: { // root type
    content: string; // String!
    createdAt?: NexusGenScalars['DateTime'] | null; // DateTime
    id: number; // Int!
    isPinned: boolean; // Boolean!
    isPublished: boolean; // Boolean!
    isResolved: boolean; // Boolean!
    resolvedAt?: NexusGenScalars['DateTime'] | null; // DateTime
    responses?: Array<NexusGenRootTypes['FeedbackResponse'] | null> | null; // [FeedbackResponse]
    updatedAt?: NexusGenScalars['DateTime'] | null; // DateTime
    votes: number; // Int!
  }
  FeedbackResponse: { // root type
    content: string; // String!
    createdAt: NexusGenScalars['DateTime']; // DateTime!
    id: number; // Int!
    negativeReactions: number; // Int!
    positiveReactions: number; // Int!
    resolvedAt?: NexusGenScalars['DateTime'] | null; // DateTime
  }
  FreeTextQuestionData: { // root type
    content: string; // String!
    contentPlain: string; // String!
    id: number; // Int!
    isArchived: boolean; // Boolean!
    isDeleted: boolean; // Boolean!
    name: string; // String!
    options: NexusGenRootTypes['FreeTextQuestionOptions']; // FreeTextQuestionOptions!
    type: string; // String!
  }
  FreeTextQuestionOptions: { // root type
    restrictions?: NexusGenRootTypes['FreeTextRestrictions'] | null; // FreeTextRestrictions
    solutions?: string[] | null; // [String!]
  }
  FreeTextRestrictions: { // root type
    maxLength?: number | null; // Int
  }
  InstanceEvaluation: { // root type
    choices: NexusGenScalars['JSONObject']; // JSONObject!
    feedbacks?: NexusGenRootTypes['QuestionFeedback'][] | null; // [QuestionFeedback!]
  }
  LeaderboardEntry: { // root type
    avatar?: string | null; // String
    id: string; // ID!
    score: number; // Float!
    username: string; // String!
  }
  LearningElement: { // root type
    course: NexusGenRootTypes['Course']; // Course!
    displayName: string; // String!
    id: string; // ID!
    instances: NexusGenRootTypes['QuestionInstance'][]; // [QuestionInstance!]!
    name: string; // String!
  }
  LecturerSession: { // root type
    accessMode: NexusGenEnums['AccessMode']; // AccessMode!
    activeBlock?: NexusGenRootTypes['SessionBlock'] | null; // SessionBlock
    blocks: NexusGenRootTypes['SessionBlock'][]; // [SessionBlock!]!
    confusionFeedbacks?: Array<NexusGenRootTypes['AggregatedConfusionFeedbacks'] | null> | null; // [AggregatedConfusionFeedbacks]
    course?: NexusGenRootTypes['Course'] | null; // Course
    displayName: string; // String!
    feedbacks?: Array<NexusGenRootTypes['Feedback'] | null> | null; // [Feedback]
    finishedAt?: NexusGenScalars['DateTime'] | null; // DateTime
    id: string; // ID!
    isAudienceInteractionActive: boolean; // Boolean!
    isGamificationEnabled: boolean; // Boolean!
    isModerationEnabled: boolean; // Boolean!
    name: string; // String!
    namespace: string; // String!
    startedAt?: NexusGenScalars['DateTime'] | null; // DateTime
    status: NexusGenEnums['SessionStatus']; // SessionStatus!
  }
  MicroSession: { // root type
    course: NexusGenRootTypes['Course']; // Course!
    description?: string | null; // String
    displayName: string; // String!
    id: string; // ID!
    instances: NexusGenRootTypes['QuestionInstance'][]; // [QuestionInstance!]!
    name: string; // String!
    scheduledEndAt: NexusGenScalars['DateTime']; // DateTime!
    scheduledStartAt: NexusGenScalars['DateTime']; // DateTime!
  }
  Mutation: {};
  NumericalQuestionData: { // root type
    content: string; // String!
    contentPlain: string; // String!
    id: number; // Int!
    isArchived: boolean; // Boolean!
    isDeleted: boolean; // Boolean!
    name: string; // String!
    options: NexusGenRootTypes['NumericalQuestionOptions']; // NumericalQuestionOptions!
    type: string; // String!
  }
  NumericalQuestionOptions: { // root type
    restrictions?: NexusGenRootTypes['NumericalRestrictions'] | null; // NumericalRestrictions
    solutionRanges?: NexusGenRootTypes['NumericalSolutionRange'][] | null; // [NumericalSolutionRange!]
  }
  NumericalRestrictions: { // root type
    max?: number | null; // Int
    min?: number | null; // Int
  }
  NumericalSolutionRange: { // root type
    max?: number | null; // Float
    min?: number | null; // Float
  }
  Participant: { // root type
    avatar?: string | null; // String
    avatarSettings?: NexusGenScalars['JSONObject'] | null; // JSONObject
    id: string; // ID!
    username: string; // String!
  }
  ParticipantLearningData: { // root type
    course?: NexusGenRootTypes['Course'] | null; // Course
    id: string; // ID!
    participant?: NexusGenRootTypes['Participant'] | null; // Participant
    participantToken?: string | null; // String
    participation?: NexusGenRootTypes['Participation'] | null; // Participation
  }
  Participation: { // root type
    course?: NexusGenRootTypes['Course'] | null; // Course
    id: number; // Int!
    isActive: boolean; // Boolean!
    points: number; // Int!
    subscriptions?: NexusGenRootTypes['Subscription'][] | null; // [Subscription!]
  }
  PushSubscription: { // root type
    auth: string; // String!
    endpoint: string; // String!
    expirationTime?: number | null; // Int
    id: number; // Int!
    p256dh: string; // String!
  }
  Query: {};
  QuestionFeedback: { // root type
    correct: boolean; // Boolean!
    feedback: string; // String!
    ix: number; // Int!
    value: string; // String!
  }
  QuestionInstance: { // root type
    attachments: Array<NexusGenRootTypes['Attachment'] | null>; // [Attachment]!
    evaluation?: NexusGenRootTypes['InstanceEvaluation'] | null; // InstanceEvaluation
    id: number; // Int!
    questionData: NexusGenRootTypes['QuestionData']; // QuestionData!
  }
  Session: { // root type
    accessMode: NexusGenEnums['AccessMode']; // AccessMode!
    activeBlock?: NexusGenRootTypes['SessionBlock'] | null; // SessionBlock
    blocks: NexusGenRootTypes['SessionBlock'][]; // [SessionBlock!]!
    confusionFeedbacks?: Array<NexusGenRootTypes['ConfusionTimestep'] | null> | null; // [ConfusionTimestep]
    course?: NexusGenRootTypes['Course'] | null; // Course
    createdAt: NexusGenScalars['DateTime']; // DateTime!
    displayName: string; // String!
    feedbacks?: Array<NexusGenRootTypes['Feedback'] | null> | null; // [Feedback]
    id: string; // ID!
    isAudienceInteractionActive: boolean; // Boolean!
    isGamificationEnabled: boolean; // Boolean!
    isModerationEnabled: boolean; // Boolean!
    linkTo?: string | null; // String
    name: string; // String!
    namespace: string; // String!
    status: NexusGenEnums['SessionStatus']; // SessionStatus!
  }
  SessionBlock: { // root type
    execution: number; // Int!
    expiresAt?: NexusGenScalars['DateTime'] | null; // DateTime
    id: number; // Int!
    instances: NexusGenRootTypes['QuestionInstance'][]; // [QuestionInstance!]!
    randomSelection?: boolean | null; // Boolean
    status: NexusGenEnums['SessionBlockStatus']; // SessionBlockStatus!
    timeLimit?: number | null; // Int
  }
  Subscription: { // root type
    endpoint: string; // String!
    id: number; // Int!
  }
  User: { // root type
    description?: string | null; // String
    email: string; // String!
    id: string; // ID!
    isActive: boolean; // Boolean!
    shortname: string; // String!
  }
}

export interface NexusGenInterfaces {
  QuestionData: NexusGenRootTypes['ChoicesQuestionData'] | NexusGenRootTypes['FreeTextQuestionData'] | NexusGenRootTypes['NumericalQuestionData'];
}

export interface NexusGenUnions {
}

export type NexusGenRootTypes = NexusGenInterfaces & NexusGenObjects

export type NexusGenAllTypes = NexusGenRootTypes & NexusGenScalars & NexusGenEnums

export interface NexusGenFieldTypes {
  AggregatedConfusionFeedbacks: { // field return type
    difficulty: number; // Float!
    numberOfParticipants: number; // Int!
    speed: number; // Float!
    timestamp: NexusGenScalars['DateTime'] | null; // DateTime
  }
  Attachment: { // field return type
    description: string | null; // String
    href: string; // String!
    id: string; // String!
    name: string; // String!
    originalName: string | null; // String
    type: NexusGenEnums['AttachmentType']; // AttachmentType!
  }
  Choice: { // field return type
    correct: boolean | null; // Boolean
    feedback: string | null; // String
    ix: number; // Int!
    value: string; // String!
  }
  ChoicesQuestionData: { // field return type
    content: string; // String!
    contentPlain: string; // String!
    id: number; // Int!
    isArchived: boolean; // Boolean!
    isDeleted: boolean; // Boolean!
    name: string; // String!
    options: NexusGenRootTypes['ChoicesQuestionOptions']; // ChoicesQuestionOptions!
    type: string; // String!
  }
  ChoicesQuestionOptions: { // field return type
    choices: NexusGenRootTypes['Choice'][]; // [Choice!]!
  }
  ConfusionTimestep: { // field return type
    createdAt: NexusGenScalars['DateTime']; // DateTime!
    difficulty: number; // Int!
    id: number; // Int!
    speed: number; // Int!
  }
  Course: { // field return type
    color: string | null; // String
    displayName: string; // String!
    id: string; // ID!
    learningElements: NexusGenRootTypes['LearningElement'][]; // [LearningElement!]!
    microSessions: NexusGenRootTypes['MicroSession'][]; // [MicroSession!]!
    name: string; // String!
    sessions: NexusGenRootTypes['Session'][]; // [Session!]!
  }
  Feedback: { // field return type
    content: string; // String!
    createdAt: NexusGenScalars['DateTime'] | null; // DateTime
    id: number; // Int!
    isPinned: boolean; // Boolean!
    isPublished: boolean; // Boolean!
    isResolved: boolean; // Boolean!
    resolvedAt: NexusGenScalars['DateTime'] | null; // DateTime
    responses: Array<NexusGenRootTypes['FeedbackResponse'] | null> | null; // [FeedbackResponse]
    updatedAt: NexusGenScalars['DateTime'] | null; // DateTime
    votes: number; // Int!
  }
  FeedbackResponse: { // field return type
    content: string; // String!
    createdAt: NexusGenScalars['DateTime']; // DateTime!
    id: number; // Int!
    negativeReactions: number; // Int!
    positiveReactions: number; // Int!
    resolvedAt: NexusGenScalars['DateTime'] | null; // DateTime
  }
  FreeTextQuestionData: { // field return type
    content: string; // String!
    contentPlain: string; // String!
    id: number; // Int!
    isArchived: boolean; // Boolean!
    isDeleted: boolean; // Boolean!
    name: string; // String!
    options: NexusGenRootTypes['FreeTextQuestionOptions']; // FreeTextQuestionOptions!
    type: string; // String!
  }
  FreeTextQuestionOptions: { // field return type
    restrictions: NexusGenRootTypes['FreeTextRestrictions'] | null; // FreeTextRestrictions
    solutions: string[] | null; // [String!]
  }
  FreeTextRestrictions: { // field return type
    maxLength: number | null; // Int
  }
  InstanceEvaluation: { // field return type
    choices: NexusGenScalars['JSONObject']; // JSONObject!
    feedbacks: NexusGenRootTypes['QuestionFeedback'][] | null; // [QuestionFeedback!]
  }
  LeaderboardEntry: { // field return type
    avatar: string | null; // String
    id: string; // ID!
    score: number; // Float!
    username: string; // String!
  }
  LearningElement: { // field return type
    course: NexusGenRootTypes['Course']; // Course!
    displayName: string; // String!
    id: string; // ID!
    instances: NexusGenRootTypes['QuestionInstance'][]; // [QuestionInstance!]!
    name: string; // String!
  }
  LecturerSession: { // field return type
    accessMode: NexusGenEnums['AccessMode']; // AccessMode!
    activeBlock: NexusGenRootTypes['SessionBlock'] | null; // SessionBlock
    blocks: NexusGenRootTypes['SessionBlock'][]; // [SessionBlock!]!
    confusionFeedbacks: Array<NexusGenRootTypes['AggregatedConfusionFeedbacks'] | null> | null; // [AggregatedConfusionFeedbacks]
    course: NexusGenRootTypes['Course'] | null; // Course
    displayName: string; // String!
    feedbacks: Array<NexusGenRootTypes['Feedback'] | null> | null; // [Feedback]
    finishedAt: NexusGenScalars['DateTime'] | null; // DateTime
    id: string; // ID!
    isAudienceInteractionActive: boolean; // Boolean!
    isGamificationEnabled: boolean; // Boolean!
    isModerationEnabled: boolean; // Boolean!
    name: string; // String!
    namespace: string; // String!
    startedAt: NexusGenScalars['DateTime'] | null; // DateTime
    status: NexusGenEnums['SessionStatus']; // SessionStatus!
  }
  MicroSession: { // field return type
    course: NexusGenRootTypes['Course']; // Course!
    description: string | null; // String
    displayName: string; // String!
    id: string; // ID!
    instances: NexusGenRootTypes['QuestionInstance'][]; // [QuestionInstance!]!
    name: string; // String!
    scheduledEndAt: NexusGenScalars['DateTime']; // DateTime!
    scheduledStartAt: NexusGenScalars['DateTime']; // DateTime!
  }
  Mutation: { // field return type
    activateSessionBlock: NexusGenRootTypes['Session'] | null; // Session
    addConfusionTimestep: NexusGenRootTypes['ConfusionTimestep'] | null; // ConfusionTimestep
    changeSessionSettings: NexusGenRootTypes['Session'] | null; // Session
    createCourse: NexusGenRootTypes['Course'] | null; // Course
    createFeedback: NexusGenRootTypes['Feedback'] | null; // Feedback
    createSession: NexusGenRootTypes['Session'] | null; // Session
    deactivateSessionBlock: NexusGenRootTypes['Session'] | null; // Session
    deleteFeedback: NexusGenRootTypes['Feedback'] | null; // Feedback
    deleteFeedbackResponse: NexusGenRootTypes['FeedbackResponse'] | null; // FeedbackResponse
    endSession: NexusGenRootTypes['Session'] | null; // Session
    joinCourse: NexusGenRootTypes['Participation'] | null; // Participation
    leaveCourse: NexusGenRootTypes['Participation'] | null; // Participation
    loginParticipant: string | null; // ID
    loginUser: string | null; // ID
    logoutParticipant: string | null; // ID
    logoutUser: string | null; // ID
    pinFeedback: NexusGenRootTypes['Feedback'] | null; // Feedback
    publishFeedback: NexusGenRootTypes['Feedback'] | null; // Feedback
    registerParticipantFromLTI: NexusGenRootTypes['ParticipantLearningData'] | null; // ParticipantLearningData
    resolveFeedback: NexusGenRootTypes['Feedback'] | null; // Feedback
    respondToFeedback: NexusGenRootTypes['Feedback'] | null; // Feedback
    respondToQuestionInstance: NexusGenRootTypes['QuestionInstance'] | null; // QuestionInstance
    startSession: NexusGenRootTypes['Session'] | null; // Session
    subscribeToPush: NexusGenRootTypes['Participation'] | null; // Participation
    updateParticipantProfile: NexusGenRootTypes['Participant'] | null; // Participant
    upvoteFeedback: NexusGenRootTypes['Feedback'] | null; // Feedback
    voteFeedbackResponse: NexusGenRootTypes['FeedbackResponse'] | null; // FeedbackResponse
  }
  NumericalQuestionData: { // field return type
    content: string; // String!
    contentPlain: string; // String!
    id: number; // Int!
    isArchived: boolean; // Boolean!
    isDeleted: boolean; // Boolean!
    name: string; // String!
    options: NexusGenRootTypes['NumericalQuestionOptions']; // NumericalQuestionOptions!
    type: string; // String!
  }
  NumericalQuestionOptions: { // field return type
    restrictions: NexusGenRootTypes['NumericalRestrictions'] | null; // NumericalRestrictions
    solutionRanges: NexusGenRootTypes['NumericalSolutionRange'][] | null; // [NumericalSolutionRange!]
  }
  NumericalRestrictions: { // field return type
    max: number | null; // Int
    min: number | null; // Int
  }
  NumericalSolutionRange: { // field return type
    max: number | null; // Float
    min: number | null; // Float
  }
  Participant: { // field return type
    avatar: string | null; // String
    avatarSettings: NexusGenScalars['JSONObject'] | null; // JSONObject
    id: string; // ID!
    username: string; // String!
  }
  ParticipantLearningData: { // field return type
    course: NexusGenRootTypes['Course'] | null; // Course
    id: string; // ID!
    participant: NexusGenRootTypes['Participant'] | null; // Participant
    participantToken: string | null; // String
    participation: NexusGenRootTypes['Participation'] | null; // Participation
  }
  Participation: { // field return type
    course: NexusGenRootTypes['Course'] | null; // Course
    id: number; // Int!
    isActive: boolean; // Boolean!
    points: number; // Int!
    subscriptions: NexusGenRootTypes['Subscription'][] | null; // [Subscription!]
  }
  PushSubscription: { // field return type
    auth: string; // String!
    endpoint: string; // String!
    expirationTime: number | null; // Int
    id: number; // Int!
    p256dh: string; // String!
  }
  Query: { // field return type
    cockpitSession: NexusGenRootTypes['LecturerSession'] | null; // LecturerSession
    feedbacks: NexusGenRootTypes['Feedback'][] | null; // [Feedback!]
    getCourseOverviewData: NexusGenRootTypes['ParticipantLearningData'] | null; // ParticipantLearningData
    learningElement: NexusGenRootTypes['LearningElement'] | null; // LearningElement
    microSession: NexusGenRootTypes['MicroSession'] | null; // MicroSession
    participations: NexusGenRootTypes['Participation'][] | null; // [Participation!]
    pinnedFeedbacks: NexusGenRootTypes['LecturerSession'] | null; // LecturerSession
    runningSessions: NexusGenRootTypes['Session'][] | null; // [Session!]
    self: NexusGenRootTypes['Participant'] | null; // Participant
    session: NexusGenRootTypes['Session'] | null; // Session
    sessionLeaderboard: NexusGenRootTypes['LeaderboardEntry'][] | null; // [LeaderboardEntry!]
    userProfile: NexusGenRootTypes['User'] | null; // User
    userSessions: NexusGenRootTypes['Session'][] | null; // [Session!]
  }
  QuestionFeedback: { // field return type
    correct: boolean; // Boolean!
    feedback: string; // String!
    ix: number; // Int!
    value: string; // String!
  }
  QuestionInstance: { // field return type
    attachments: Array<NexusGenRootTypes['Attachment'] | null>; // [Attachment]!
    evaluation: NexusGenRootTypes['InstanceEvaluation'] | null; // InstanceEvaluation
    id: number; // Int!
    questionData: NexusGenRootTypes['QuestionData']; // QuestionData!
  }
  Session: { // field return type
    accessMode: NexusGenEnums['AccessMode']; // AccessMode!
    activeBlock: NexusGenRootTypes['SessionBlock'] | null; // SessionBlock
    blocks: NexusGenRootTypes['SessionBlock'][]; // [SessionBlock!]!
    confusionFeedbacks: Array<NexusGenRootTypes['ConfusionTimestep'] | null> | null; // [ConfusionTimestep]
    course: NexusGenRootTypes['Course'] | null; // Course
    createdAt: NexusGenScalars['DateTime']; // DateTime!
    displayName: string; // String!
    feedbacks: Array<NexusGenRootTypes['Feedback'] | null> | null; // [Feedback]
    id: string; // ID!
    isAudienceInteractionActive: boolean; // Boolean!
    isGamificationEnabled: boolean; // Boolean!
    isModerationEnabled: boolean; // Boolean!
    linkTo: string | null; // String
    name: string; // String!
    namespace: string; // String!
    status: NexusGenEnums['SessionStatus']; // SessionStatus!
  }
  SessionBlock: { // field return type
    execution: number; // Int!
    expiresAt: NexusGenScalars['DateTime'] | null; // DateTime
    id: number; // Int!
    instances: NexusGenRootTypes['QuestionInstance'][]; // [QuestionInstance!]!
    randomSelection: boolean | null; // Boolean
    status: NexusGenEnums['SessionBlockStatus']; // SessionBlockStatus!
    timeLimit: number | null; // Int
  }
  Subscription: { // field return type
    endpoint: string; // String!
    id: number; // Int!
  }
  User: { // field return type
    description: string | null; // String
    email: string; // String!
    id: string; // ID!
    isActive: boolean; // Boolean!
    shortname: string; // String!
  }
  QuestionData: { // field return type
    content: string; // String!
    contentPlain: string; // String!
    id: number; // Int!
    isArchived: boolean; // Boolean!
    isDeleted: boolean; // Boolean!
    name: string; // String!
    type: string; // String!
  }
}

export interface NexusGenFieldTypeNames {
  AggregatedConfusionFeedbacks: { // field return type name
    difficulty: 'Float'
    numberOfParticipants: 'Int'
    speed: 'Float'
    timestamp: 'DateTime'
  }
  Attachment: { // field return type name
    description: 'String'
    href: 'String'
    id: 'String'
    name: 'String'
    originalName: 'String'
    type: 'AttachmentType'
  }
  Choice: { // field return type name
    correct: 'Boolean'
    feedback: 'String'
    ix: 'Int'
    value: 'String'
  }
  ChoicesQuestionData: { // field return type name
    content: 'String'
    contentPlain: 'String'
    id: 'Int'
    isArchived: 'Boolean'
    isDeleted: 'Boolean'
    name: 'String'
    options: 'ChoicesQuestionOptions'
    type: 'String'
  }
  ChoicesQuestionOptions: { // field return type name
    choices: 'Choice'
  }
  ConfusionTimestep: { // field return type name
    createdAt: 'DateTime'
    difficulty: 'Int'
    id: 'Int'
    speed: 'Int'
  }
  Course: { // field return type name
    color: 'String'
    displayName: 'String'
    id: 'ID'
    learningElements: 'LearningElement'
    microSessions: 'MicroSession'
    name: 'String'
    sessions: 'Session'
  }
  Feedback: { // field return type name
    content: 'String'
    createdAt: 'DateTime'
    id: 'Int'
    isPinned: 'Boolean'
    isPublished: 'Boolean'
    isResolved: 'Boolean'
    resolvedAt: 'DateTime'
    responses: 'FeedbackResponse'
    updatedAt: 'DateTime'
    votes: 'Int'
  }
  FeedbackResponse: { // field return type name
    content: 'String'
    createdAt: 'DateTime'
    id: 'Int'
    negativeReactions: 'Int'
    positiveReactions: 'Int'
    resolvedAt: 'DateTime'
  }
  FreeTextQuestionData: { // field return type name
    content: 'String'
    contentPlain: 'String'
    id: 'Int'
    isArchived: 'Boolean'
    isDeleted: 'Boolean'
    name: 'String'
    options: 'FreeTextQuestionOptions'
    type: 'String'
  }
  FreeTextQuestionOptions: { // field return type name
    restrictions: 'FreeTextRestrictions'
    solutions: 'String'
  }
  FreeTextRestrictions: { // field return type name
    maxLength: 'Int'
  }
  InstanceEvaluation: { // field return type name
    choices: 'JSONObject'
    feedbacks: 'QuestionFeedback'
  }
  LeaderboardEntry: { // field return type name
    avatar: 'String'
    id: 'ID'
    score: 'Float'
    username: 'String'
  }
  LearningElement: { // field return type name
    course: 'Course'
    displayName: 'String'
    id: 'ID'
    instances: 'QuestionInstance'
    name: 'String'
  }
  LecturerSession: { // field return type name
    accessMode: 'AccessMode'
    activeBlock: 'SessionBlock'
    blocks: 'SessionBlock'
    confusionFeedbacks: 'AggregatedConfusionFeedbacks'
    course: 'Course'
    displayName: 'String'
    feedbacks: 'Feedback'
    finishedAt: 'DateTime'
    id: 'ID'
    isAudienceInteractionActive: 'Boolean'
    isGamificationEnabled: 'Boolean'
    isModerationEnabled: 'Boolean'
    name: 'String'
    namespace: 'String'
    startedAt: 'DateTime'
    status: 'SessionStatus'
  }
  MicroSession: { // field return type name
    course: 'Course'
    description: 'String'
    displayName: 'String'
    id: 'ID'
    instances: 'QuestionInstance'
    name: 'String'
    scheduledEndAt: 'DateTime'
    scheduledStartAt: 'DateTime'
  }
  Mutation: { // field return type name
    activateSessionBlock: 'Session'
    addConfusionTimestep: 'ConfusionTimestep'
    changeSessionSettings: 'Session'
    createCourse: 'Course'
    createFeedback: 'Feedback'
    createSession: 'Session'
    deactivateSessionBlock: 'Session'
    deleteFeedback: 'Feedback'
    deleteFeedbackResponse: 'FeedbackResponse'
    endSession: 'Session'
    joinCourse: 'Participation'
    leaveCourse: 'Participation'
    loginParticipant: 'ID'
    loginUser: 'ID'
    logoutParticipant: 'ID'
    logoutUser: 'ID'
    pinFeedback: 'Feedback'
    publishFeedback: 'Feedback'
    registerParticipantFromLTI: 'ParticipantLearningData'
    resolveFeedback: 'Feedback'
    respondToFeedback: 'Feedback'
    respondToQuestionInstance: 'QuestionInstance'
    startSession: 'Session'
    subscribeToPush: 'Participation'
    updateParticipantProfile: 'Participant'
    upvoteFeedback: 'Feedback'
    voteFeedbackResponse: 'FeedbackResponse'
  }
  NumericalQuestionData: { // field return type name
    content: 'String'
    contentPlain: 'String'
    id: 'Int'
    isArchived: 'Boolean'
    isDeleted: 'Boolean'
    name: 'String'
    options: 'NumericalQuestionOptions'
    type: 'String'
  }
  NumericalQuestionOptions: { // field return type name
    restrictions: 'NumericalRestrictions'
    solutionRanges: 'NumericalSolutionRange'
  }
  NumericalRestrictions: { // field return type name
    max: 'Int'
    min: 'Int'
  }
  NumericalSolutionRange: { // field return type name
    max: 'Float'
    min: 'Float'
  }
  Participant: { // field return type name
    avatar: 'String'
    avatarSettings: 'JSONObject'
    id: 'ID'
    username: 'String'
  }
  ParticipantLearningData: { // field return type name
    course: 'Course'
    id: 'ID'
    participant: 'Participant'
    participantToken: 'String'
    participation: 'Participation'
  }
  Participation: { // field return type name
    course: 'Course'
    id: 'Int'
    isActive: 'Boolean'
    points: 'Int'
    subscriptions: 'Subscription'
  }
  PushSubscription: { // field return type name
    auth: 'String'
    endpoint: 'String'
    expirationTime: 'Int'
    id: 'Int'
    p256dh: 'String'
  }
  Query: { // field return type name
    cockpitSession: 'LecturerSession'
    feedbacks: 'Feedback'
    getCourseOverviewData: 'ParticipantLearningData'
    learningElement: 'LearningElement'
    microSession: 'MicroSession'
    participations: 'Participation'
    pinnedFeedbacks: 'LecturerSession'
    runningSessions: 'Session'
    self: 'Participant'
    session: 'Session'
    sessionLeaderboard: 'LeaderboardEntry'
    userProfile: 'User'
    userSessions: 'Session'
  }
  QuestionFeedback: { // field return type name
    correct: 'Boolean'
    feedback: 'String'
    ix: 'Int'
    value: 'String'
  }
  QuestionInstance: { // field return type name
    attachments: 'Attachment'
    evaluation: 'InstanceEvaluation'
    id: 'Int'
    questionData: 'QuestionData'
  }
  Session: { // field return type name
    accessMode: 'AccessMode'
    activeBlock: 'SessionBlock'
    blocks: 'SessionBlock'
    confusionFeedbacks: 'ConfusionTimestep'
    course: 'Course'
    createdAt: 'DateTime'
    displayName: 'String'
    feedbacks: 'Feedback'
    id: 'ID'
    isAudienceInteractionActive: 'Boolean'
    isGamificationEnabled: 'Boolean'
    isModerationEnabled: 'Boolean'
    linkTo: 'String'
    name: 'String'
    namespace: 'String'
    status: 'SessionStatus'
  }
  SessionBlock: { // field return type name
    execution: 'Int'
    expiresAt: 'DateTime'
    id: 'Int'
    instances: 'QuestionInstance'
    randomSelection: 'Boolean'
    status: 'SessionBlockStatus'
    timeLimit: 'Int'
  }
  Subscription: { // field return type name
    endpoint: 'String'
    id: 'Int'
  }
  User: { // field return type name
    description: 'String'
    email: 'String'
    id: 'ID'
    isActive: 'Boolean'
    shortname: 'String'
  }
  QuestionData: { // field return type name
    content: 'String'
    contentPlain: 'String'
    id: 'Int'
    isArchived: 'Boolean'
    isDeleted: 'Boolean'
    name: 'String'
    type: 'String'
  }
}

export interface NexusGenArgTypes {
  Mutation: {
    activateSessionBlock: { // args
      sessionBlockId: number; // Int!
      sessionId: string; // ID!
    }
    addConfusionTimestep: { // args
      difficulty: number; // Int!
      sessionId: string; // ID!
      speed: number; // Int!
    }
    changeSessionSettings: { // args
      id: string; // ID!
      isAudienceInteractionActive?: boolean | null; // Boolean
      isGamificationEnabled?: boolean | null; // Boolean
      isModerationEnabled?: boolean | null; // Boolean
    }
    createCourse: { // args
      color?: string | null; // String
      displayName?: string | null; // String
      name: string; // String!
    }
    createFeedback: { // args
      content: string; // String!
      sessionId: string; // ID!
    }
    createSession: { // args
      blocks: NexusGenInputs['BlockInput'][]; // [BlockInput!]!
      courseId?: string | null; // String
      displayName?: string | null; // String
      name: string; // String!
    }
    deactivateSessionBlock: { // args
      sessionBlockId: number; // Int!
      sessionId: string; // ID!
    }
    deleteFeedback: { // args
      id: number; // Int!
    }
    deleteFeedbackResponse: { // args
      id: number; // Int!
    }
    endSession: { // args
      id: string; // ID!
    }
    joinCourse: { // args
      courseId: string; // ID!
    }
    leaveCourse: { // args
      courseId: string; // ID!
    }
    loginParticipant: { // args
      password: string; // String!
      username: string; // String!
    }
    loginUser: { // args
      email: string; // String!
      password: string; // String!
    }
    pinFeedback: { // args
      id: number; // Int!
      isPinned: boolean; // Boolean!
    }
    publishFeedback: { // args
      id: number; // Int!
      isPublished: boolean; // Boolean!
    }
    registerParticipantFromLTI: { // args
      courseId: string; // ID!
      participantId: string; // ID!
    }
    resolveFeedback: { // args
      id: number; // Int!
      isResolved: boolean; // Boolean!
    }
    respondToFeedback: { // args
      id: number; // Int!
      responseContent: string; // String!
    }
    respondToQuestionInstance: { // args
      courseId: string; // ID!
      id: number; // Int!
      response: NexusGenInputs['ResponseInput']; // ResponseInput!
    }
    startSession: { // args
      id: string; // ID!
    }
    subscribeToPush: { // args
      courseId: string; // ID!
      subscriptionObject: NexusGenInputs['SubscriptionObjectInput']; // SubscriptionObjectInput!
    }
    updateParticipantProfile: { // args
      avatar?: string | null; // String
      avatarSettings?: NexusGenInputs['AvatarSettingsInput'] | null; // AvatarSettingsInput
      username?: string | null; // String
    }
    upvoteFeedback: { // args
      feedbackId: number; // Int!
      increment: number; // Int!
    }
    voteFeedbackResponse: { // args
      id: number; // Int!
      incrementDownvote: number; // Int!
      incrementUpvote: number; // Int!
    }
  }
  Query: {
    cockpitSession: { // args
      id: string; // ID!
    }
    feedbacks: { // args
      id: string; // ID!
    }
    getCourseOverviewData: { // args
      courseId: string; // ID!
    }
    learningElement: { // args
      id: string; // ID!
    }
    microSession: { // args
      id: string; // ID!
    }
    participations: { // args
      endpoint?: string | null; // String
    }
    pinnedFeedbacks: { // args
      id: string; // ID!
    }
    runningSessions: { // args
      shortname: string; // String!
    }
    session: { // args
      id: string; // ID!
    }
    sessionLeaderboard: { // args
      sessionId: string; // ID!
    }
  }
}

export interface NexusGenAbstractTypeMembers {
  QuestionData: "ChoicesQuestionData" | "FreeTextQuestionData" | "NumericalQuestionData"
}

export interface NexusGenTypeInterfaces {
  ChoicesQuestionData: "QuestionData"
  FreeTextQuestionData: "QuestionData"
  NumericalQuestionData: "QuestionData"
}

export type NexusGenObjectNames = keyof NexusGenObjects;

export type NexusGenInputNames = keyof NexusGenInputs;

export type NexusGenEnumNames = keyof NexusGenEnums;

export type NexusGenInterfaceNames = keyof NexusGenInterfaces;

export type NexusGenScalarNames = keyof NexusGenScalars;

export type NexusGenUnionNames = never;

export type NexusGenObjectsUsingAbstractStrategyIsTypeOf = never;

export type NexusGenAbstractsUsingStrategyResolveType = "QuestionData";

export type NexusGenFeaturesConfig = {
  abstractTypeStrategies: {
    isTypeOf: false
    resolveType: true
    __typename: false
  }
}

export interface NexusGenTypes {
  context: any;
  inputTypes: NexusGenInputs;
  rootTypes: NexusGenRootTypes;
  inputTypeShapes: NexusGenInputs & NexusGenEnums & NexusGenScalars;
  argTypes: NexusGenArgTypes;
  fieldTypes: NexusGenFieldTypes;
  fieldTypeNames: NexusGenFieldTypeNames;
  allTypes: NexusGenAllTypes;
  typeInterfaces: NexusGenTypeInterfaces;
  objectNames: NexusGenObjectNames;
  inputNames: NexusGenInputNames;
  enumNames: NexusGenEnumNames;
  interfaceNames: NexusGenInterfaceNames;
  scalarNames: NexusGenScalarNames;
  unionNames: NexusGenUnionNames;
  allInputTypes: NexusGenTypes['inputNames'] | NexusGenTypes['enumNames'] | NexusGenTypes['scalarNames'];
  allOutputTypes: NexusGenTypes['objectNames'] | NexusGenTypes['enumNames'] | NexusGenTypes['unionNames'] | NexusGenTypes['interfaceNames'] | NexusGenTypes['scalarNames'];
  allNamedTypes: NexusGenTypes['allInputTypes'] | NexusGenTypes['allOutputTypes']
  abstractTypes: NexusGenTypes['interfaceNames'] | NexusGenTypes['unionNames'];
  abstractTypeMembers: NexusGenAbstractTypeMembers;
  objectsUsingAbstractStrategyIsTypeOf: NexusGenObjectsUsingAbstractStrategyIsTypeOf;
  abstractsUsingStrategyResolveType: NexusGenAbstractsUsingStrategyResolveType;
  features: NexusGenFeaturesConfig;
}


declare global {
  interface NexusGenPluginTypeConfig<TypeName extends string> {
  }
  interface NexusGenPluginInputTypeConfig<TypeName extends string> {
  }
  interface NexusGenPluginFieldConfig<TypeName extends string, FieldName extends string> {
    /**
     * The nullability guard can be helpful, but is also a potentially expensive operation for lists.
     * We need to iterate the entire list to check for null items to guard against. Set this to true
     * to skip the null guard on a specific field if you know there's no potential for unsafe types.
     */
    skipNullGuard?: boolean
  }
  interface NexusGenPluginInputFieldConfig<TypeName extends string, FieldName extends string> {
  }
  interface NexusGenPluginSchemaConfig {
  }
  interface NexusGenPluginArgConfig {
  }
}