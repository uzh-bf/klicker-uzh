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
  Course: { // root type
    id?: string | null; // ID
    learningElements?: Array<NexusGenRootTypes['LearningElement'] | null> | null; // [LearningElement]
  }
  LearningElement: { // root type
    course?: NexusGenRootTypes['Course'] | null; // Course
    id?: string | null; // ID
    instances?: Array<NexusGenRootTypes['QuestionInstance'] | null> | null; // [QuestionInstance]
  }
  Mutation: {};
  Participant: { // root type
    id?: string | null; // ID
  }
  ParticipantLearningData: { // root type
    course?: NexusGenRootTypes['Course'] | null; // Course
    participant: NexusGenRootTypes['Participant']; // Participant!
    participantToken: string; // String!
    participation?: NexusGenRootTypes['Participation'] | null; // Participation
  }
  Participation: { // root type
    id?: string | null; // ID
  }
  Query: {};
  QuestionInstance: { // root type
    id?: string | null; // ID
    questionData?: NexusGenScalars['JSONObject'] | null; // JSONObject
  }
}

export interface NexusGenInterfaces {
}

export interface NexusGenUnions {
}

export type NexusGenRootTypes = NexusGenObjects

export type NexusGenAllTypes = NexusGenRootTypes & NexusGenScalars

export interface NexusGenFieldTypes {
  Course: { // field return type
    id: string | null; // ID
    learningElements: Array<NexusGenRootTypes['LearningElement'] | null> | null; // [LearningElement]
  }
  LearningElement: { // field return type
    course: NexusGenRootTypes['Course'] | null; // Course
    id: string | null; // ID
    instances: Array<NexusGenRootTypes['QuestionInstance'] | null> | null; // [QuestionInstance]
  }
  Mutation: { // field return type
    login: string | null; // ID
    registerParticipantFromLTI: NexusGenRootTypes['ParticipantLearningData'] | null; // ParticipantLearningData
  }
  Participant: { // field return type
    id: string | null; // ID
  }
  ParticipantLearningData: { // field return type
    course: NexusGenRootTypes['Course'] | null; // Course
    participant: NexusGenRootTypes['Participant']; // Participant!
    participantToken: string; // String!
    participation: NexusGenRootTypes['Participation'] | null; // Participation
  }
  Participation: { // field return type
    id: string | null; // ID
  }
  Query: { // field return type
    learningElement: NexusGenRootTypes['LearningElement'] | null; // LearningElement
  }
  QuestionInstance: { // field return type
    id: string | null; // ID
    questionData: NexusGenScalars['JSONObject'] | null; // JSONObject
  }
}

export interface NexusGenFieldTypeNames {
  Course: { // field return type name
    id: 'ID'
    learningElements: 'LearningElement'
  }
  LearningElement: { // field return type name
    course: 'Course'
    id: 'ID'
    instances: 'QuestionInstance'
  }
  Mutation: { // field return type name
    login: 'ID'
    registerParticipantFromLTI: 'ParticipantLearningData'
  }
  Participant: { // field return type name
    id: 'ID'
  }
  ParticipantLearningData: { // field return type name
    course: 'Course'
    participant: 'Participant'
    participantToken: 'String'
    participation: 'Participation'
  }
  Participation: { // field return type name
    id: 'ID'
  }
  Query: { // field return type name
    learningElement: 'LearningElement'
  }
  QuestionInstance: { // field return type name
    id: 'ID'
    questionData: 'JSONObject'
  }
}

export interface NexusGenArgTypes {
  Mutation: {
    login: { // args
      email: string; // String!
      password: string; // String!
    }
    registerParticipantFromLTI: { // args
      courseId: string; // ID!
      participantEmail: string; // ID!
      participantId: string; // ID!
    }
  }
  Query: {
    learningElement: { // args
      id: string; // ID!
    }
  }
}

export interface NexusGenAbstractTypeMembers {
}

export interface NexusGenTypeInterfaces {
}

export type NexusGenObjectNames = keyof NexusGenObjects;

export type NexusGenInputNames = never;

export type NexusGenEnumNames = never;

export type NexusGenInterfaceNames = never;

export type NexusGenScalarNames = keyof NexusGenScalars;

export type NexusGenUnionNames = never;

export type NexusGenObjectsUsingAbstractStrategyIsTypeOf = never;

export type NexusGenAbstractsUsingStrategyResolveType = never;

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
  }
  interface NexusGenPluginInputFieldConfig<TypeName extends string, FieldName extends string> {
  }
  interface NexusGenPluginSchemaConfig {
  }
  interface NexusGenPluginArgConfig {
  }
}