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
  ResponseInput: { // input type
    choices?: Array<number | null> | null; // [Int]
    value?: string | null; // String
  }
}

export interface NexusGenEnums {
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
    id?: string | null; // ID
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
  Participant: { // root type
    avatar?: string | null; // String
    id?: string | null; // ID
    pseudonym?: string | null; // String
  }
  ParticipantLearningData: { // root type
    course?: NexusGenRootTypes['Course'] | null; // Course
    id?: string | null; // ID
    participant?: NexusGenRootTypes['Participant'] | null; // Participant
    participantToken?: string | null; // String
    participation?: NexusGenRootTypes['Participation'] | null; // Participation
  }
  Participation: { // root type
    id?: string | null; // ID
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
    id?: string | null; // ID
    questionData?: NexusGenRootTypes['QuestionData'] | null; // QuestionData
  }
}

export interface NexusGenInterfaces {
  QuestionData: NexusGenRootTypes['ChoicesQuestionData'];
}

export interface NexusGenUnions {
}

export type NexusGenRootTypes = NexusGenInterfaces & NexusGenObjects

export type NexusGenAllTypes = NexusGenRootTypes & NexusGenScalars

export interface NexusGenFieldTypes {
  Choice: { // field return type
    correct: boolean | null; // Boolean
    feedback: string | null; // String
    value: string; // String!
  }
  ChoicesQuestionData: { // field return type
    content: string; // String!
    contentPlain: string; // String!
    id: string | null; // ID
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
    joinCourse: NexusGenRootTypes['Participation'] | null; // Participation
    leaveCourse: NexusGenRootTypes['Participation'] | null; // Participation
    login: string | null; // ID
    registerParticipantFromLTI: NexusGenRootTypes['ParticipantLearningData'] | null; // ParticipantLearningData
    respondToQuestionInstance: NexusGenRootTypes['QuestionInstance'] | null; // QuestionInstance
  }
  Participant: { // field return type
    avatar: string | null; // String
    id: string | null; // ID
    pseudonym: string | null; // String
  }
  ParticipantLearningData: { // field return type
    course: NexusGenRootTypes['Course'] | null; // Course
    id: string | null; // ID
    participant: NexusGenRootTypes['Participant'] | null; // Participant
    participantToken: string | null; // String
    participation: NexusGenRootTypes['Participation'] | null; // Participation
  }
  Participation: { // field return type
    id: string | null; // ID
    isActive: boolean | null; // Boolean
    points: number | null; // Int
  }
  Query: { // field return type
    getCourseOverviewData: NexusGenRootTypes['ParticipantLearningData'] | null; // ParticipantLearningData
    learningElement: NexusGenRootTypes['LearningElement'] | null; // LearningElement
  }
  QuestionFeedback: { // field return type
    correct: boolean | null; // Boolean
    feedback: string | null; // String
    ix: number | null; // Int
    value: string | null; // String
  }
  QuestionInstance: { // field return type
    evaluation: NexusGenRootTypes['InstanceEvaluation'] | null; // InstanceEvaluation
    id: string | null; // ID
    questionData: NexusGenRootTypes['QuestionData'] | null; // QuestionData
  }
  QuestionData: { // field return type
    content: string; // String!
    contentPlain: string; // String!
    id: string | null; // ID
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
    id: 'ID'
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
    joinCourse: 'Participation'
    leaveCourse: 'Participation'
    login: 'ID'
    registerParticipantFromLTI: 'ParticipantLearningData'
    respondToQuestionInstance: 'QuestionInstance'
  }
  Participant: { // field return type name
    avatar: 'String'
    id: 'ID'
    pseudonym: 'String'
  }
  ParticipantLearningData: { // field return type name
    course: 'Course'
    id: 'ID'
    participant: 'Participant'
    participantToken: 'String'
    participation: 'Participation'
  }
  Participation: { // field return type name
    id: 'ID'
    isActive: 'Boolean'
    points: 'Int'
  }
  Query: { // field return type name
    getCourseOverviewData: 'ParticipantLearningData'
    learningElement: 'LearningElement'
  }
  QuestionFeedback: { // field return type name
    correct: 'Boolean'
    feedback: 'String'
    ix: 'Int'
    value: 'String'
  }
  QuestionInstance: { // field return type name
    evaluation: 'InstanceEvaluation'
    id: 'ID'
    questionData: 'QuestionData'
  }
  QuestionData: { // field return type name
    content: 'String'
    contentPlain: 'String'
    id: 'ID'
    isArchived: 'Boolean'
    isDeleted: 'Boolean'
    name: 'String'
    type: 'String'
  }
}

export interface NexusGenArgTypes {
  Mutation: {
    joinCourse: { // args
      courseId: string; // ID!
    }
    leaveCourse: { // args
      courseId: string; // ID!
    }
    login: { // args
      email: string; // String!
      password: string; // String!
    }
    registerParticipantFromLTI: { // args
      courseId: string; // ID!
      participantEmail: string; // ID!
      participantId: string; // ID!
    }
    respondToQuestionInstance: { // args
      id: string; // ID!
      response: NexusGenInputs['ResponseInput']; // ResponseInput!
    }
  }
  Query: {
    getCourseOverviewData: { // args
      courseId: string; // ID!
    }
    learningElement: { // args
      id: string; // ID!
    }
  }
}

export interface NexusGenAbstractTypeMembers {
  QuestionData: "ChoicesQuestionData"
}

export interface NexusGenTypeInterfaces {
  ChoicesQuestionData: "QuestionData"
}

export type NexusGenObjectNames = keyof NexusGenObjects;

export type NexusGenInputNames = keyof NexusGenInputs;

export type NexusGenEnumNames = never;

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