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
  BlockInput: { // input type
    questionIds: number[]; // [Int!]!
    randomSelection?: number | null; // Int
    timeLimit?: number | null; // Int
  }
  ResponseInput: { // input type
    choices?: number[] | null; // [Int!]
    value?: string | null; // String
  }
}

export interface NexusGenEnums {
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
  Choice: { // root type
    correct?: boolean | null; // Boolean
    feedback?: string | null; // String
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
  Course: { // root type
    displayName: string; // String!
    id: string; // ID!
    learningElements: NexusGenRootTypes['LearningElement'][]; // [LearningElement!]!
    microSessions: NexusGenRootTypes['MicroSession'][]; // [MicroSession!]!
    name: string; // String!
    sessions: NexusGenRootTypes['Session'][]; // [Session!]!
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
    avatar: string; // String!
    id: string; // ID!
    points: number; // Float!
    username: string; // String!
  }
  LearningElement: { // root type
    course: NexusGenRootTypes['Course']; // Course!
    id: string; // ID!
    instances: NexusGenRootTypes['QuestionInstance'][]; // [QuestionInstance!]!
  }
  MicroSession: { // root type
    displayName: string; // String!
    id: string; // ID!
    name: string; // String!
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
    avatar: string; // String!
    id: string; // ID!
    username: string; // String!
  }
  ParticipantLearningData: { // root type
    course: NexusGenRootTypes['Course']; // Course!
    id: string; // ID!
    participant: NexusGenRootTypes['Participant']; // Participant!
    participantToken: string; // String!
    participation: NexusGenRootTypes['Participation']; // Participation!
  }
  Participation: { // root type
    course: NexusGenRootTypes['Course']; // Course!
    id: number; // Int!
    isActive: boolean; // Boolean!
    points: number; // Int!
  }
  Query: {};
  QuestionFeedback: { // root type
    correct: boolean; // Boolean!
    feedback: string; // String!
    ix: number; // Int!
    value: string; // String!
  }
  QuestionInstance: { // root type
    evaluation?: NexusGenRootTypes['InstanceEvaluation'] | null; // InstanceEvaluation
    id: number; // Int!
    questionData: NexusGenRootTypes['QuestionData']; // QuestionData!
  }
  Session: { // root type
    activeBlock?: NexusGenRootTypes['SessionBlock'] | null; // SessionBlock
    blocks: NexusGenRootTypes['SessionBlock'][]; // [SessionBlock!]!
    displayName: string; // String!
    id: string; // ID!
    isAudienceInteractionActive: boolean; // Boolean!
    isFeedbackChannelPublic: boolean; // Boolean!
    isGamificationEnabled: boolean; // Boolean!
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
}

export interface NexusGenInterfaces {
  QuestionData: NexusGenRootTypes['ChoicesQuestionData'] | NexusGenRootTypes['FreeTextQuestionData'] | NexusGenRootTypes['NumericalQuestionData'];
}

export interface NexusGenUnions {
}

export type NexusGenRootTypes = NexusGenInterfaces & NexusGenObjects

export type NexusGenAllTypes = NexusGenRootTypes & NexusGenScalars & NexusGenEnums

export interface NexusGenFieldTypes {
  Choice: { // field return type
    correct: boolean | null; // Boolean
    feedback: string | null; // String
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
  Course: { // field return type
    displayName: string; // String!
    id: string; // ID!
    learningElements: NexusGenRootTypes['LearningElement'][]; // [LearningElement!]!
    microSessions: NexusGenRootTypes['MicroSession'][]; // [MicroSession!]!
    name: string; // String!
    sessions: NexusGenRootTypes['Session'][]; // [Session!]!
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
    avatar: string; // String!
    id: string; // ID!
    points: number; // Float!
    username: string; // String!
  }
  LearningElement: { // field return type
    course: NexusGenRootTypes['Course']; // Course!
    id: string; // ID!
    instances: NexusGenRootTypes['QuestionInstance'][]; // [QuestionInstance!]!
  }
  MicroSession: { // field return type
    displayName: string; // String!
    id: string; // ID!
    name: string; // String!
  }
  Mutation: { // field return type
    activateSessionBlock: NexusGenRootTypes['Session'] | null; // Session
    createCourse: NexusGenRootTypes['Course'] | null; // Course
    createSession: NexusGenRootTypes['Session'] | null; // Session
    deactivateSessionBlock: NexusGenRootTypes['Session'] | null; // Session
    joinCourse: NexusGenRootTypes['Participation'] | null; // Participation
    leaveCourse: NexusGenRootTypes['Participation'] | null; // Participation
    loginParticipant: string | null; // ID
    loginUser: string | null; // ID
    registerParticipantFromLTI: NexusGenRootTypes['ParticipantLearningData'] | null; // ParticipantLearningData
    respondToQuestionInstance: NexusGenRootTypes['QuestionInstance'] | null; // QuestionInstance
    startSession: NexusGenRootTypes['Session'] | null; // Session
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
    avatar: string; // String!
    id: string; // ID!
    username: string; // String!
  }
  ParticipantLearningData: { // field return type
    course: NexusGenRootTypes['Course']; // Course!
    id: string; // ID!
    participant: NexusGenRootTypes['Participant']; // Participant!
    participantToken: string; // String!
    participation: NexusGenRootTypes['Participation']; // Participation!
  }
  Participation: { // field return type
    course: NexusGenRootTypes['Course']; // Course!
    id: number; // Int!
    isActive: boolean; // Boolean!
    points: number; // Int!
  }
  Query: { // field return type
    getCourseOverviewData: NexusGenRootTypes['ParticipantLearningData'] | null; // ParticipantLearningData
    learningElement: NexusGenRootTypes['LearningElement'] | null; // LearningElement
    participations: NexusGenRootTypes['Participation'][] | null; // [Participation!]
    self: NexusGenRootTypes['Participant'] | null; // Participant
    session: NexusGenRootTypes['Session'] | null; // Session
    sessionLeaderboard: NexusGenRootTypes['LeaderboardEntry'][] | null; // [LeaderboardEntry!]
  }
  QuestionFeedback: { // field return type
    correct: boolean; // Boolean!
    feedback: string; // String!
    ix: number; // Int!
    value: string; // String!
  }
  QuestionInstance: { // field return type
    evaluation: NexusGenRootTypes['InstanceEvaluation'] | null; // InstanceEvaluation
    id: number; // Int!
    questionData: NexusGenRootTypes['QuestionData']; // QuestionData!
  }
  Session: { // field return type
    activeBlock: NexusGenRootTypes['SessionBlock'] | null; // SessionBlock
    blocks: NexusGenRootTypes['SessionBlock'][]; // [SessionBlock!]!
    displayName: string; // String!
    id: string; // ID!
    isAudienceInteractionActive: boolean; // Boolean!
    isFeedbackChannelPublic: boolean; // Boolean!
    isGamificationEnabled: boolean; // Boolean!
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
  Choice: { // field return type name
    correct: 'Boolean'
    feedback: 'String'
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
  Course: { // field return type name
    displayName: 'String'
    id: 'ID'
    learningElements: 'LearningElement'
    microSessions: 'MicroSession'
    name: 'String'
    sessions: 'Session'
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
    points: 'Float'
    username: 'String'
  }
  LearningElement: { // field return type name
    course: 'Course'
    id: 'ID'
    instances: 'QuestionInstance'
  }
  MicroSession: { // field return type name
    displayName: 'String'
    id: 'ID'
    name: 'String'
  }
  Mutation: { // field return type name
    activateSessionBlock: 'Session'
    createCourse: 'Course'
    createSession: 'Session'
    deactivateSessionBlock: 'Session'
    joinCourse: 'Participation'
    leaveCourse: 'Participation'
    loginParticipant: 'ID'
    loginUser: 'ID'
    registerParticipantFromLTI: 'ParticipantLearningData'
    respondToQuestionInstance: 'QuestionInstance'
    startSession: 'Session'
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
  }
  Query: { // field return type name
    getCourseOverviewData: 'ParticipantLearningData'
    learningElement: 'LearningElement'
    participations: 'Participation'
    self: 'Participant'
    session: 'Session'
    sessionLeaderboard: 'LeaderboardEntry'
  }
  QuestionFeedback: { // field return type name
    correct: 'Boolean'
    feedback: 'String'
    ix: 'Int'
    value: 'String'
  }
  QuestionInstance: { // field return type name
    evaluation: 'InstanceEvaluation'
    id: 'Int'
    questionData: 'QuestionData'
  }
  Session: { // field return type name
    activeBlock: 'SessionBlock'
    blocks: 'SessionBlock'
    displayName: 'String'
    id: 'ID'
    isAudienceInteractionActive: 'Boolean'
    isFeedbackChannelPublic: 'Boolean'
    isGamificationEnabled: 'Boolean'
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
    createCourse: { // args
      displayName?: string | null; // String
      name: string; // String!
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
    registerParticipantFromLTI: { // args
      courseId: string; // ID!
      participantEmail: string; // String!
      participantId: string; // ID!
    }
    respondToQuestionInstance: { // args
      courseId: string; // ID!
      id: number; // Int!
      response: NexusGenInputs['ResponseInput']; // ResponseInput!
    }
    startSession: { // args
      id: string; // ID!
    }
  }
  Query: {
    getCourseOverviewData: { // args
      courseId: string; // ID!
    }
    learningElement: { // args
      id: string; // ID!
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