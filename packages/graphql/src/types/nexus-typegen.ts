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
    questionIds?: number[] | null; // [Int!]
    randomSelection?: number | null; // Int
    timeLimit?: number | null; // Int
  }
  ResponseInput: { // input type
    choices?: Array<number | null> | null; // [Int]
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
    id?: number | null; // Int
    isArchived: boolean; // Boolean!
    isDeleted: boolean; // Boolean!
    name: string; // String!
    options: NexusGenRootTypes['ChoicesQuestionOptions']; // ChoicesQuestionOptions!
    type: string; // String!
  }
  ChoicesQuestionOptions: { // root type
    choices?: Array<NexusGenRootTypes['Choice'] | null> | null; // [Choice]
  }
  Course: { // root type
    displayName?: string | null; // String
    id?: string | null; // ID
    learningElements?: Array<NexusGenRootTypes['LearningElement'] | null> | null; // [LearningElement]
    name: string; // String!
  }
  FreeTextQuestionData: { // root type
    content: string; // String!
    contentPlain: string; // String!
    id?: number | null; // Int
    isArchived: boolean; // Boolean!
    isDeleted: boolean; // Boolean!
    name: string; // String!
    options: NexusGenRootTypes['FreeTextQuestionOptions']; // FreeTextQuestionOptions!
    type: string; // String!
  }
  FreeTextQuestionOptions: { // root type
    restrictions?: NexusGenRootTypes['FreeTextRestrictions'] | null; // FreeTextRestrictions
    solutions?: Array<string | null> | null; // [String]
  }
  FreeTextRestrictions: { // root type
    maxLength?: number | null; // Int
  }
  InstanceEvaluation: { // root type
    choices?: NexusGenScalars['JSONObject'] | null; // JSONObject
    feedbacks?: Array<NexusGenRootTypes['QuestionFeedback'] | null> | null; // [QuestionFeedback]
  }
  LearningElement: { // root type
    course?: NexusGenRootTypes['Course'] | null; // Course
    id?: string | null; // ID
    instances?: Array<NexusGenRootTypes['QuestionInstance'] | null> | null; // [QuestionInstance]
  }
  Mutation: {};
  NumericalQuestionData: { // root type
    content: string; // String!
    contentPlain: string; // String!
    id?: number | null; // Int
    isArchived: boolean; // Boolean!
    isDeleted: boolean; // Boolean!
    name: string; // String!
    options: NexusGenRootTypes['NumericalQuestionOptions']; // NumericalQuestionOptions!
    type: string; // String!
  }
  NumericalQuestionOptions: { // root type
    restrictions?: NexusGenRootTypes['NumericalRestrictions'] | null; // NumericalRestrictions
    solutionRanges?: Array<NexusGenRootTypes['NumericalSolutionRange'] | null> | null; // [NumericalSolutionRange]
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
    id?: string | null; // ID
    username?: string | null; // String
  }
  ParticipantLearningData: { // root type
    course?: NexusGenRootTypes['Course'] | null; // Course
    id?: string | null; // ID
    participant?: NexusGenRootTypes['Participant'] | null; // Participant
    participantToken?: string | null; // String
    participation?: NexusGenRootTypes['Participation'] | null; // Participation
  }
  Participation: { // root type
    id?: number | null; // Int
    isActive?: boolean | null; // Boolean
    points?: number | null; // Int
  }
  Query: {};
  QuestionFeedback: { // root type
    correct?: boolean | null; // Boolean
    feedback?: string | null; // String
    ix?: number | null; // Int
    value?: string | null; // String
  }
  QuestionInstance: { // root type
    evaluation?: NexusGenRootTypes['InstanceEvaluation'] | null; // InstanceEvaluation
    id?: number | null; // Int
    questionData?: NexusGenRootTypes['QuestionData'] | null; // QuestionData
  }
  Session: { // root type
    activeBlock: number; // Int!
    blocks?: Array<NexusGenRootTypes['SessionBlock'] | null> | null; // [SessionBlock]
    displayName: string; // String!
    execution: number; // Int!
    id?: string | null; // ID
    isAudienceInteractionActive: boolean; // Boolean!
    isFeedbackChannelPublic: boolean; // Boolean!
    name: string; // String!
    namespace: string; // String!
    status: NexusGenEnums['SessionStatus']; // SessionStatus!
  }
  SessionBlock: { // root type
    expiresAt?: NexusGenScalars['DateTime'] | null; // DateTime
    id?: number | null; // Int
    instances?: Array<NexusGenRootTypes['QuestionInstance'] | null> | null; // [QuestionInstance]
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
    id: number | null; // Int
    isArchived: boolean; // Boolean!
    isDeleted: boolean; // Boolean!
    name: string; // String!
    options: NexusGenRootTypes['ChoicesQuestionOptions']; // ChoicesQuestionOptions!
    type: string; // String!
  }
  ChoicesQuestionOptions: { // field return type
    choices: Array<NexusGenRootTypes['Choice'] | null> | null; // [Choice]
  }
  Course: { // field return type
    displayName: string | null; // String
    id: string | null; // ID
    learningElements: Array<NexusGenRootTypes['LearningElement'] | null> | null; // [LearningElement]
    name: string; // String!
  }
  FreeTextQuestionData: { // field return type
    content: string; // String!
    contentPlain: string; // String!
    id: number | null; // Int
    isArchived: boolean; // Boolean!
    isDeleted: boolean; // Boolean!
    name: string; // String!
    options: NexusGenRootTypes['FreeTextQuestionOptions']; // FreeTextQuestionOptions!
    type: string; // String!
  }
  FreeTextQuestionOptions: { // field return type
    restrictions: NexusGenRootTypes['FreeTextRestrictions'] | null; // FreeTextRestrictions
    solutions: Array<string | null> | null; // [String]
  }
  FreeTextRestrictions: { // field return type
    maxLength: number | null; // Int
  }
  InstanceEvaluation: { // field return type
    choices: NexusGenScalars['JSONObject'] | null; // JSONObject
    feedbacks: Array<NexusGenRootTypes['QuestionFeedback'] | null> | null; // [QuestionFeedback]
  }
  LearningElement: { // field return type
    course: NexusGenRootTypes['Course'] | null; // Course
    id: string | null; // ID
    instances: Array<NexusGenRootTypes['QuestionInstance'] | null> | null; // [QuestionInstance]
  }
  Mutation: { // field return type
    activateSessionBlock: NexusGenRootTypes['Session'] | null; // Session
    createSession: NexusGenRootTypes['Session'] | null; // Session
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
    id: number | null; // Int
    isArchived: boolean; // Boolean!
    isDeleted: boolean; // Boolean!
    name: string; // String!
    options: NexusGenRootTypes['NumericalQuestionOptions']; // NumericalQuestionOptions!
    type: string; // String!
  }
  NumericalQuestionOptions: { // field return type
    restrictions: NexusGenRootTypes['NumericalRestrictions'] | null; // NumericalRestrictions
    solutionRanges: Array<NexusGenRootTypes['NumericalSolutionRange'] | null> | null; // [NumericalSolutionRange]
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
    id: string | null; // ID
    username: string | null; // String
  }
  ParticipantLearningData: { // field return type
    course: NexusGenRootTypes['Course'] | null; // Course
    id: string | null; // ID
    participant: NexusGenRootTypes['Participant'] | null; // Participant
    participantToken: string | null; // String
    participation: NexusGenRootTypes['Participation'] | null; // Participation
  }
  Participation: { // field return type
    id: number | null; // Int
    isActive: boolean | null; // Boolean
    points: number | null; // Int
  }
  Query: { // field return type
    getCourseOverviewData: NexusGenRootTypes['ParticipantLearningData'] | null; // ParticipantLearningData
    getParticipantCourses: Array<NexusGenRootTypes['Course'] | null> | null; // [Course]
    learningElement: NexusGenRootTypes['LearningElement'] | null; // LearningElement
    self: NexusGenRootTypes['Participant'] | null; // Participant
    session: NexusGenRootTypes['Session'] | null; // Session
  }
  QuestionFeedback: { // field return type
    correct: boolean | null; // Boolean
    feedback: string | null; // String
    ix: number | null; // Int
    value: string | null; // String
  }
  QuestionInstance: { // field return type
    evaluation: NexusGenRootTypes['InstanceEvaluation'] | null; // InstanceEvaluation
    id: number | null; // Int
    questionData: NexusGenRootTypes['QuestionData'] | null; // QuestionData
  }
  Session: { // field return type
    activeBlock: number; // Int!
    blocks: Array<NexusGenRootTypes['SessionBlock'] | null> | null; // [SessionBlock]
    displayName: string; // String!
    execution: number; // Int!
    id: string | null; // ID
    isAudienceInteractionActive: boolean; // Boolean!
    isFeedbackChannelPublic: boolean; // Boolean!
    name: string; // String!
    namespace: string; // String!
    status: NexusGenEnums['SessionStatus']; // SessionStatus!
  }
  SessionBlock: { // field return type
    expiresAt: NexusGenScalars['DateTime'] | null; // DateTime
    id: number | null; // Int
    instances: Array<NexusGenRootTypes['QuestionInstance'] | null> | null; // [QuestionInstance]
    randomSelection: boolean | null; // Boolean
    status: NexusGenEnums['SessionBlockStatus']; // SessionBlockStatus!
    timeLimit: number | null; // Int
  }
  QuestionData: { // field return type
    content: string; // String!
    contentPlain: string; // String!
    id: number | null; // Int
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
    name: 'String'
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
  LearningElement: { // field return type name
    course: 'Course'
    id: 'ID'
    instances: 'QuestionInstance'
  }
  Mutation: { // field return type name
    activateSessionBlock: 'Session'
    createSession: 'Session'
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
    id: 'Int'
    isActive: 'Boolean'
    points: 'Int'
  }
  Query: { // field return type name
    getCourseOverviewData: 'ParticipantLearningData'
    getParticipantCourses: 'Course'
    learningElement: 'LearningElement'
    self: 'Participant'
    session: 'Session'
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
    activeBlock: 'Int'
    blocks: 'SessionBlock'
    displayName: 'String'
    execution: 'Int'
    id: 'ID'
    isAudienceInteractionActive: 'Boolean'
    isFeedbackChannelPublic: 'Boolean'
    name: 'String'
    namespace: 'String'
    status: 'SessionStatus'
  }
  SessionBlock: { // field return type name
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
    createSession: { // args
      blocks: NexusGenInputs['BlockInput'][]; // [BlockInput!]!
      displayName?: string | null; // String
      name: string; // String!
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