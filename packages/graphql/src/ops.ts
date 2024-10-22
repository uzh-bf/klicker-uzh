import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  /** The `ID` scalar type represents a unique identifier, often used to refetch an object or as key for a cache. The ID type appears in a JSON response as a String; however, it is not intended to be human-readable. When expected as an input type, any string (such as `"4"`) or integer (such as `4`) input value will be accepted as an ID. */
  ID: { input: string; output: string; }
  /** The `String` scalar type represents textual data, represented as UTF-8 character sequences. The String type is most often used by GraphQL to represent free-form human-readable text. */
  String: { input: string; output: string; }
  /** The `Boolean` scalar type represents `true` or `false`. */
  Boolean: { input: boolean; output: boolean; }
  /** The `Int` scalar type represents non-fractional signed whole numeric values. Int can represent values between -(2^31) and 2^31 - 1. */
  Int: { input: number; output: number; }
  /** The `Float` scalar type represents signed double-precision fractional values as specified by [IEEE 754](https://en.wikipedia.org/wiki/IEEE_floating_point). */
  Float: { input: number; output: number; }
  /** A date-time string at UTC, such as 2007-12-03T10:15:30Z, compliant with the `date-time` format outlined in section 5.6 of the RFC 3339 profile of the ISO 8601 standard for representation of dates and times using the Gregorian calendar. */
  Date: { input: any; output: any; }
  /** The `JSON` scalar type represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
  Json: { input: any; output: any; }
};

export type Achievement = {
  __typename?: 'Achievement';
  descriptionDE?: Maybe<Scalars['String']['output']>;
  descriptionEN?: Maybe<Scalars['String']['output']>;
  icon: Scalars['String']['output'];
  iconColor?: Maybe<Scalars['String']['output']>;
  id: Scalars['Int']['output'];
  nameDE?: Maybe<Scalars['String']['output']>;
  nameEN?: Maybe<Scalars['String']['output']>;
};

export type ActivityEvaluation = {
  __typename?: 'ActivityEvaluation';
  description?: Maybe<Scalars['String']['output']>;
  displayName?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  results: Array<StackEvaluation>;
};

export type ActivitySummary = {
  __typename?: 'ActivitySummary';
  numOfAnonymousResponses: Scalars['Int']['output'];
  numOfResponses: Scalars['Int']['output'];
};

export type ArchivedElement = {
  __typename?: 'ArchivedElement';
  id: Scalars['Int']['output'];
  isArchived: Scalars['Boolean']['output'];
};

export type AvatarSettings = {
  __typename?: 'AvatarSettings';
  accessory: Scalars['String']['output'];
  clothing: Scalars['String']['output'];
  clothingColor: Scalars['String']['output'];
  eyes: Scalars['String']['output'];
  facialHair: Scalars['String']['output'];
  hair: Scalars['String']['output'];
  hairColor: Scalars['String']['output'];
  mouth: Scalars['String']['output'];
  skinTone: Scalars['String']['output'];
};

export type AvatarSettingsInput = {
  accessory: Scalars['String']['input'];
  clothing: Scalars['String']['input'];
  clothingColor: Scalars['String']['input'];
  eyes: Scalars['String']['input'];
  facialHair: Scalars['String']['input'];
  hair: Scalars['String']['input'];
  hairColor: Scalars['String']['input'];
  mouth: Scalars['String']['input'];
  skinTone: Scalars['String']['input'];
};

export type AwardEntry = {
  __typename?: 'AwardEntry';
  description: Scalars['String']['output'];
  displayName: Scalars['String']['output'];
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  order: Scalars['Int']['output'];
  participant?: Maybe<Participant>;
  participantGroup?: Maybe<ParticipantGroup>;
  type: Scalars['String']['output'];
};

export type BlockInput = {
  questionIds: Array<Scalars['Int']['input']>;
  randomSelection?: InputMaybe<Scalars['Int']['input']>;
  timeLimit?: InputMaybe<Scalars['Int']['input']>;
};

export type Choice = {
  __typename?: 'Choice';
  correct?: Maybe<Scalars['Boolean']['output']>;
  feedback?: Maybe<Scalars['String']['output']>;
  ix: Scalars['Int']['output'];
  value: Scalars['String']['output'];
};

export type ChoiceElementResults = {
  __typename?: 'ChoiceElementResults';
  correct?: Maybe<Scalars['Boolean']['output']>;
  count: Scalars['Int']['output'];
  feedback?: Maybe<Scalars['String']['output']>;
  value: Scalars['String']['output'];
};

export type ChoiceInput = {
  correct?: InputMaybe<Scalars['Boolean']['input']>;
  feedback?: InputMaybe<Scalars['String']['input']>;
  ix: Scalars['Int']['input'];
  value: Scalars['String']['input'];
};

export type ChoiceQuestionOptions = {
  __typename?: 'ChoiceQuestionOptions';
  choices: Array<Choice>;
  displayMode: ElementDisplayMode;
  hasAnswerFeedbacks?: Maybe<Scalars['Boolean']['output']>;
  hasSampleSolution?: Maybe<Scalars['Boolean']['output']>;
};

export type ChoicesElement = {
  __typename?: 'ChoicesElement';
  content: Scalars['String']['output'];
  createdAt?: Maybe<Scalars['Date']['output']>;
  explanation?: Maybe<Scalars['String']['output']>;
  id: Scalars['Int']['output'];
  isArchived?: Maybe<Scalars['Boolean']['output']>;
  isDeleted?: Maybe<Scalars['Boolean']['output']>;
  name: Scalars['String']['output'];
  options: ChoiceQuestionOptions;
  pointsMultiplier: Scalars['Int']['output'];
  status: ElementStatus;
  tags?: Maybe<Array<Tag>>;
  type: ElementType;
  updatedAt?: Maybe<Scalars['Date']['output']>;
  version: Scalars['Int']['output'];
};

export type ChoicesElementData = {
  __typename?: 'ChoicesElementData';
  content: Scalars['String']['output'];
  elementId: Scalars['Int']['output'];
  explanation?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  options: ChoiceQuestionOptions;
  pointsMultiplier: Scalars['Int']['output'];
  type: ElementType;
};

export type ChoicesElementInstanceEvaluation = {
  __typename?: 'ChoicesElementInstanceEvaluation';
  content: Scalars['String']['output'];
  explanation?: Maybe<Scalars['String']['output']>;
  hasAnswerFeedbacks: Scalars['Boolean']['output'];
  hasSampleSolution: Scalars['Boolean']['output'];
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  results: ChoicesElementResults;
  type: ElementType;
};

export type ChoicesElementResults = {
  __typename?: 'ChoicesElementResults';
  anonymousAnswers: Scalars['Int']['output'];
  choices: Array<ChoiceElementResults>;
  totalAnswers: Scalars['Int']['output'];
};

export type ChoicesInstanceEvaluation = {
  __typename?: 'ChoicesInstanceEvaluation';
  choices?: Maybe<Scalars['Json']['output']>;
  correctness?: Maybe<Scalars['Float']['output']>;
  elementType: ElementType;
  explanation?: Maybe<Scalars['String']['output']>;
  feedbacks?: Maybe<Array<QuestionFeedback>>;
  instanceId: Scalars['Int']['output'];
  lastResponse?: Maybe<SingleQuestionResponseChoices>;
  newPointsFrom?: Maybe<Scalars['Date']['output']>;
  newXpFrom?: Maybe<Scalars['Date']['output']>;
  numAnswers?: Maybe<Scalars['Int']['output']>;
  percentile?: Maybe<Scalars['Float']['output']>;
  pointsAwarded?: Maybe<Scalars['Float']['output']>;
  pointsMultiplier: Scalars['Int']['output'];
  score: Scalars['Float']['output'];
  xp?: Maybe<Scalars['Int']['output']>;
  xpAwarded?: Maybe<Scalars['Int']['output']>;
};

export type ChoicesQuestionData = {
  __typename?: 'ChoicesQuestionData';
  content: Scalars['String']['output'];
  explanation?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  options: ChoiceQuestionOptions;
  pointsMultiplier?: Maybe<Scalars['Int']['output']>;
  questionId?: Maybe<Scalars['Int']['output']>;
  type: ElementType;
};

export type ChoicesQuestionResponse = {
  __typename?: 'ChoicesQuestionResponse';
  aggregatedResponses: ElementResultsChoices;
  correctCount: Scalars['Int']['output'];
  correctCountStreak: Scalars['Int']['output'];
  eFactor: Scalars['Float']['output'];
  elementType: ElementType;
  id: Scalars['Int']['output'];
  interval: Scalars['Int']['output'];
  lastAnsweredAt?: Maybe<Scalars['Date']['output']>;
  lastAwardedAt?: Maybe<Scalars['Date']['output']>;
  lastCorrectAt?: Maybe<Scalars['Date']['output']>;
  lastPartialCorrectAt?: Maybe<Scalars['Date']['output']>;
  lastResponse: SingleQuestionResponseChoices;
  lastWrongAt?: Maybe<Scalars['Date']['output']>;
  lastXpAwardedAt?: Maybe<Scalars['Date']['output']>;
  nextDueAt?: Maybe<Scalars['Date']['output']>;
  partialCorrectCount: Scalars['Int']['output'];
  totalPointsAwarded?: Maybe<Scalars['Float']['output']>;
  totalScore: Scalars['Float']['output'];
  totalXpAwarded?: Maybe<Scalars['Float']['output']>;
  trialsCount: Scalars['Int']['output'];
  wrongCount: Scalars['Int']['output'];
};

export type ClassAchievementInstance = {
  __typename?: 'ClassAchievementInstance';
  id: Scalars['Int']['output'];
};

export type ConfusionSummary = {
  __typename?: 'ConfusionSummary';
  difficulty: Scalars['Float']['output'];
  numberOfParticipants?: Maybe<Scalars['Int']['output']>;
  speed: Scalars['Float']['output'];
};

export type ConfusionTimestep = {
  __typename?: 'ConfusionTimestep';
  createdAt: Scalars['Date']['output'];
  difficulty: Scalars['Int']['output'];
  speed: Scalars['Int']['output'];
};

export type ContentElement = {
  __typename?: 'ContentElement';
  content: Scalars['String']['output'];
  createdAt?: Maybe<Scalars['Date']['output']>;
  explanation?: Maybe<Scalars['String']['output']>;
  id: Scalars['Int']['output'];
  isArchived?: Maybe<Scalars['Boolean']['output']>;
  isDeleted?: Maybe<Scalars['Boolean']['output']>;
  name: Scalars['String']['output'];
  pointsMultiplier: Scalars['Int']['output'];
  status: ElementStatus;
  tags?: Maybe<Array<Tag>>;
  type: ElementType;
  updatedAt?: Maybe<Scalars['Date']['output']>;
  version: Scalars['Int']['output'];
};

export type ContentElementData = {
  __typename?: 'ContentElementData';
  content: Scalars['String']['output'];
  elementId: Scalars['Int']['output'];
  explanation?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  pointsMultiplier: Scalars['Int']['output'];
  type: ElementType;
};

export type ContentElementInstanceEvaluation = {
  __typename?: 'ContentElementInstanceEvaluation';
  content: Scalars['String']['output'];
  explanation?: Maybe<Scalars['String']['output']>;
  hasAnswerFeedbacks: Scalars['Boolean']['output'];
  hasSampleSolution: Scalars['Boolean']['output'];
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  results: ContentElementResults;
  type: ElementType;
};

export type ContentElementResults = {
  __typename?: 'ContentElementResults';
  anonymousAnswers: Scalars['Int']['output'];
  totalAnswers: Scalars['Int']['output'];
};

export type ContentInstanceEvaluation = {
  __typename?: 'ContentInstanceEvaluation';
  correctness?: Maybe<Scalars['Float']['output']>;
  elementType: ElementType;
  explanation?: Maybe<Scalars['String']['output']>;
  feedbacks?: Maybe<Array<QuestionFeedback>>;
  instanceId: Scalars['Int']['output'];
  lastResponse?: Maybe<SingleQuestionResponseContent>;
  newPointsFrom?: Maybe<Scalars['Date']['output']>;
  newXpFrom?: Maybe<Scalars['Date']['output']>;
  numAnswers?: Maybe<Scalars['Int']['output']>;
  percentile?: Maybe<Scalars['Float']['output']>;
  pointsAwarded?: Maybe<Scalars['Float']['output']>;
  pointsMultiplier: Scalars['Int']['output'];
  score: Scalars['Float']['output'];
  xp?: Maybe<Scalars['Int']['output']>;
  xpAwarded?: Maybe<Scalars['Int']['output']>;
};

export type ContentQuestionData = {
  __typename?: 'ContentQuestionData';
  content: Scalars['String']['output'];
  explanation?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  pointsMultiplier?: Maybe<Scalars['Int']['output']>;
  questionId?: Maybe<Scalars['Int']['output']>;
  type: ElementType;
};

export type ContentQuestionResponse = {
  __typename?: 'ContentQuestionResponse';
  aggregatedResponses: ElementResultsContent;
  correctCount: Scalars['Int']['output'];
  correctCountStreak: Scalars['Int']['output'];
  eFactor: Scalars['Float']['output'];
  elementType: ElementType;
  id: Scalars['Int']['output'];
  interval: Scalars['Int']['output'];
  lastAnsweredAt?: Maybe<Scalars['Date']['output']>;
  lastAwardedAt?: Maybe<Scalars['Date']['output']>;
  lastCorrectAt?: Maybe<Scalars['Date']['output']>;
  lastPartialCorrectAt?: Maybe<Scalars['Date']['output']>;
  lastResponse: SingleQuestionResponseContent;
  lastWrongAt?: Maybe<Scalars['Date']['output']>;
  lastXpAwardedAt?: Maybe<Scalars['Date']['output']>;
  nextDueAt?: Maybe<Scalars['Date']['output']>;
  partialCorrectCount: Scalars['Int']['output'];
  totalPointsAwarded?: Maybe<Scalars['Float']['output']>;
  totalScore: Scalars['Float']['output'];
  totalXpAwarded?: Maybe<Scalars['Float']['output']>;
  trialsCount: Scalars['Int']['output'];
  wrongCount: Scalars['Int']['output'];
};

export type Course = {
  __typename?: 'Course';
  averageActiveScore?: Maybe<Scalars['Float']['output']>;
  averageScore?: Maybe<Scalars['Float']['output']>;
  awards?: Maybe<Array<AwardEntry>>;
  color: Scalars['String']['output'];
  createdAt?: Maybe<Scalars['Date']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  displayName: Scalars['String']['output'];
  endDate: Scalars['Date']['output'];
  groupActivities?: Maybe<Array<GroupActivity>>;
  groupAssignmentPoolEntries?: Maybe<Array<GroupAssignmentPoolEntry>>;
  groupDeadlineDate?: Maybe<Scalars['Date']['output']>;
  id: Scalars['ID']['output'];
  isArchived: Scalars['Boolean']['output'];
  isGamificationEnabled: Scalars['Boolean']['output'];
  isGroupCreationEnabled: Scalars['Boolean']['output'];
  isGroupDeadlinePassed?: Maybe<Scalars['Boolean']['output']>;
  leaderboard?: Maybe<Array<LeaderboardEntry>>;
  maxGroupSize: Scalars['Int']['output'];
  microLearnings?: Maybe<Array<MicroLearning>>;
  name: Scalars['String']['output'];
  notificationEmail?: Maybe<Scalars['String']['output']>;
  numOfActiveParticipants?: Maybe<Scalars['Int']['output']>;
  numOfParticipantGroups?: Maybe<Scalars['Int']['output']>;
  numOfParticipants?: Maybe<Scalars['Int']['output']>;
  owner?: Maybe<User>;
  participantGroups?: Maybe<Array<ParticipantGroup>>;
  pinCode?: Maybe<Scalars['Int']['output']>;
  practiceQuizzes?: Maybe<Array<PracticeQuiz>>;
  preferredGroupSize: Scalars['Int']['output'];
  randomAssignmentFinalized: Scalars['Boolean']['output'];
  sessions?: Maybe<Array<Session>>;
  startDate: Scalars['Date']['output'];
  updatedAt?: Maybe<Scalars['Date']['output']>;
};

export type CourseSummary = {
  __typename?: 'CourseSummary';
  numOfGroupActivities: Scalars['Int']['output'];
  numOfLeaderboardEntries: Scalars['Int']['output'];
  numOfLiveQuizzes: Scalars['Int']['output'];
  numOfMicroLearnings: Scalars['Int']['output'];
  numOfParticipantGroups: Scalars['Int']['output'];
  numOfParticipations: Scalars['Int']['output'];
  numOfPracticeQuizzes: Scalars['Int']['output'];
};

export type Element = ChoicesElement | ContentElement | FlashcardElement | FreeTextElement | NumericalElement;

export type ElementData = ChoicesElementData | ContentElementData | FlashcardElementData | FreeTextElementData | NumericalElementData;

export enum ElementDisplayMode {
  Grid = 'GRID',
  List = 'LIST'
}

export type ElementFeedback = {
  __typename?: 'ElementFeedback';
  downvote: Scalars['Boolean']['output'];
  elementInstanceId: Scalars['Int']['output'];
  feedback?: Maybe<Scalars['String']['output']>;
  id: Scalars['Int']['output'];
  upvote: Scalars['Boolean']['output'];
};

export type ElementInstance = {
  __typename?: 'ElementInstance';
  elementData: ElementData;
  elementType: ElementType;
  feedbacks?: Maybe<Array<ElementFeedback>>;
  id: Scalars['Int']['output'];
  options?: Maybe<ElementInstanceOptions>;
  type: ElementInstanceType;
};

export type ElementInstanceEvaluation = ChoicesElementInstanceEvaluation | ContentElementInstanceEvaluation | FlashcardElementInstanceEvaluation | FreeElementInstanceEvaluation | NumericalElementInstanceEvaluation;

export type ElementInstanceOptions = {
  __typename?: 'ElementInstanceOptions';
  pointsMultiplier?: Maybe<Scalars['Int']['output']>;
  resetTimeDays?: Maybe<Scalars['Int']['output']>;
};

export enum ElementInstanceType {
  GroupActivity = 'GROUP_ACTIVITY',
  LiveQuiz = 'LIVE_QUIZ',
  Microlearning = 'MICROLEARNING',
  PracticeQuiz = 'PRACTICE_QUIZ'
}

export enum ElementOrderType {
  Sequential = 'SEQUENTIAL',
  SpacedRepetition = 'SPACED_REPETITION'
}

export type ElementResultsChoices = {
  __typename?: 'ElementResultsChoices';
  choices: Scalars['Json']['output'];
  total: Scalars['Int']['output'];
};

export type ElementResultsContent = {
  __typename?: 'ElementResultsContent';
  total: Scalars['Int']['output'];
};

export type ElementResultsFlashcard = {
  __typename?: 'ElementResultsFlashcard';
  CORRECT: Scalars['Int']['output'];
  INCORRECT: Scalars['Int']['output'];
  PARTIAL: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
};

export type ElementResultsOpen = {
  __typename?: 'ElementResultsOpen';
  responses: Scalars['Json']['output'];
  total: Scalars['Int']['output'];
};

export type ElementStack = {
  __typename?: 'ElementStack';
  description?: Maybe<Scalars['String']['output']>;
  displayName?: Maybe<Scalars['String']['output']>;
  elements?: Maybe<Array<ElementInstance>>;
  id: Scalars['Int']['output'];
  order?: Maybe<Scalars['Int']['output']>;
  type: ElementStackType;
};

export type ElementStackInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  displayName?: InputMaybe<Scalars['String']['input']>;
  elements: Array<StackElementsInput>;
  order: Scalars['Int']['input'];
};

export enum ElementStackType {
  GroupActivity = 'GROUP_ACTIVITY',
  LiveQuiz = 'LIVE_QUIZ',
  Microlearning = 'MICROLEARNING',
  PracticeQuiz = 'PRACTICE_QUIZ'
}

export enum ElementStatus {
  Draft = 'DRAFT',
  Ready = 'READY',
  Review = 'REVIEW'
}

export enum ElementType {
  Content = 'CONTENT',
  Flashcard = 'FLASHCARD',
  FreeText = 'FREE_TEXT',
  Kprim = 'KPRIM',
  Mc = 'MC',
  Numerical = 'NUMERICAL',
  Sc = 'SC'
}

export type EvaluationBlock = {
  __typename?: 'EvaluationBlock';
  blockIx: Scalars['Int']['output'];
  blockStatus: SessionBlockStatus;
  tabData: Array<TabData>;
};

export type Feedback = {
  __typename?: 'Feedback';
  content: Scalars['String']['output'];
  createdAt: Scalars['Date']['output'];
  id: Scalars['Int']['output'];
  isPinned: Scalars['Boolean']['output'];
  isPublished: Scalars['Boolean']['output'];
  isResolved: Scalars['Boolean']['output'];
  resolvedAt?: Maybe<Scalars['Date']['output']>;
  responses?: Maybe<Array<FeedbackResponse>>;
  votes: Scalars['Int']['output'];
};

export type FeedbackResponse = {
  __typename?: 'FeedbackResponse';
  content: Scalars['String']['output'];
  createdAt?: Maybe<Scalars['Date']['output']>;
  id: Scalars['Int']['output'];
  negativeReactions: Scalars['Int']['output'];
  positiveReactions: Scalars['Int']['output'];
};

export type FileUploadSas = {
  __typename?: 'FileUploadSAS';
  containerName: Scalars['String']['output'];
  fileName: Scalars['String']['output'];
  uploadHref: Scalars['String']['output'];
  uploadSasURL: Scalars['String']['output'];
};

export enum FlashcardCorrectness {
  Correct = 'CORRECT',
  Incorrect = 'INCORRECT',
  Partial = 'PARTIAL'
}

export enum FlashcardCorrectnessType {
  Correct = 'CORRECT',
  Incorrect = 'INCORRECT',
  Partial = 'PARTIAL'
}

export type FlashcardElement = {
  __typename?: 'FlashcardElement';
  content: Scalars['String']['output'];
  createdAt?: Maybe<Scalars['Date']['output']>;
  explanation?: Maybe<Scalars['String']['output']>;
  id: Scalars['Int']['output'];
  isArchived?: Maybe<Scalars['Boolean']['output']>;
  isDeleted?: Maybe<Scalars['Boolean']['output']>;
  name: Scalars['String']['output'];
  pointsMultiplier: Scalars['Int']['output'];
  status: ElementStatus;
  tags?: Maybe<Array<Tag>>;
  type: ElementType;
  updatedAt?: Maybe<Scalars['Date']['output']>;
  version: Scalars['Int']['output'];
};

export type FlashcardElementData = {
  __typename?: 'FlashcardElementData';
  content: Scalars['String']['output'];
  elementId: Scalars['Int']['output'];
  explanation?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  pointsMultiplier: Scalars['Int']['output'];
  type: ElementType;
};

export type FlashcardElementInstanceEvaluation = {
  __typename?: 'FlashcardElementInstanceEvaluation';
  content: Scalars['String']['output'];
  explanation?: Maybe<Scalars['String']['output']>;
  hasAnswerFeedbacks: Scalars['Boolean']['output'];
  hasSampleSolution: Scalars['Boolean']['output'];
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  results: FlashcardElementResults;
  type: ElementType;
};

export type FlashcardElementResults = {
  __typename?: 'FlashcardElementResults';
  anonymousAnswers: Scalars['Int']['output'];
  correctCount: Scalars['Int']['output'];
  incorrectCount: Scalars['Int']['output'];
  partialCount: Scalars['Int']['output'];
  totalAnswers: Scalars['Int']['output'];
};

export type FlashcardInstanceEvaluation = {
  __typename?: 'FlashcardInstanceEvaluation';
  correctness?: Maybe<Scalars['Float']['output']>;
  elementType: ElementType;
  explanation?: Maybe<Scalars['String']['output']>;
  feedbacks?: Maybe<Array<QuestionFeedback>>;
  instanceId: Scalars['Int']['output'];
  lastResponse?: Maybe<SingleQuestionResponseFlashcard>;
  newPointsFrom?: Maybe<Scalars['Date']['output']>;
  newXpFrom?: Maybe<Scalars['Date']['output']>;
  numAnswers?: Maybe<Scalars['Int']['output']>;
  percentile?: Maybe<Scalars['Float']['output']>;
  pointsAwarded?: Maybe<Scalars['Float']['output']>;
  pointsMultiplier: Scalars['Int']['output'];
  score: Scalars['Float']['output'];
  xp?: Maybe<Scalars['Int']['output']>;
  xpAwarded?: Maybe<Scalars['Int']['output']>;
};

export type FlashcardQuestionData = {
  __typename?: 'FlashcardQuestionData';
  content: Scalars['String']['output'];
  explanation?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  pointsMultiplier?: Maybe<Scalars['Int']['output']>;
  questionId?: Maybe<Scalars['Int']['output']>;
  type: ElementType;
};

export type FlashcardQuestionResponse = {
  __typename?: 'FlashcardQuestionResponse';
  aggregatedResponses: ElementResultsFlashcard;
  correctCount: Scalars['Int']['output'];
  correctCountStreak: Scalars['Int']['output'];
  eFactor: Scalars['Float']['output'];
  elementType: ElementType;
  id: Scalars['Int']['output'];
  interval: Scalars['Int']['output'];
  lastAnsweredAt?: Maybe<Scalars['Date']['output']>;
  lastAwardedAt?: Maybe<Scalars['Date']['output']>;
  lastCorrectAt?: Maybe<Scalars['Date']['output']>;
  lastPartialCorrectAt?: Maybe<Scalars['Date']['output']>;
  lastResponse: SingleQuestionResponseFlashcard;
  lastWrongAt?: Maybe<Scalars['Date']['output']>;
  lastXpAwardedAt?: Maybe<Scalars['Date']['output']>;
  nextDueAt?: Maybe<Scalars['Date']['output']>;
  partialCorrectCount: Scalars['Int']['output'];
  totalPointsAwarded?: Maybe<Scalars['Float']['output']>;
  totalScore: Scalars['Float']['output'];
  totalXpAwarded?: Maybe<Scalars['Float']['output']>;
  trialsCount: Scalars['Int']['output'];
  wrongCount: Scalars['Int']['output'];
};

export type FreeElementInstanceEvaluation = {
  __typename?: 'FreeElementInstanceEvaluation';
  content: Scalars['String']['output'];
  explanation?: Maybe<Scalars['String']['output']>;
  hasAnswerFeedbacks: Scalars['Boolean']['output'];
  hasSampleSolution: Scalars['Boolean']['output'];
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  results: FreeElementResults;
  type: ElementType;
};

export type FreeElementResult = {
  __typename?: 'FreeElementResult';
  correct?: Maybe<Scalars['Boolean']['output']>;
  count: Scalars['Int']['output'];
  value: Scalars['String']['output'];
};

export type FreeElementResults = {
  __typename?: 'FreeElementResults';
  anonymousAnswers: Scalars['Int']['output'];
  maxLength?: Maybe<Scalars['Int']['output']>;
  responses: Array<FreeElementResult>;
  solutions?: Maybe<Array<Scalars['String']['output']>>;
  totalAnswers: Scalars['Int']['output'];
};

export type FreeTextElement = {
  __typename?: 'FreeTextElement';
  content: Scalars['String']['output'];
  createdAt?: Maybe<Scalars['Date']['output']>;
  explanation?: Maybe<Scalars['String']['output']>;
  id: Scalars['Int']['output'];
  isArchived?: Maybe<Scalars['Boolean']['output']>;
  isDeleted?: Maybe<Scalars['Boolean']['output']>;
  name: Scalars['String']['output'];
  options: FreeTextQuestionOptions;
  pointsMultiplier: Scalars['Int']['output'];
  status: ElementStatus;
  tags?: Maybe<Array<Tag>>;
  type: ElementType;
  updatedAt?: Maybe<Scalars['Date']['output']>;
  version: Scalars['Int']['output'];
};

export type FreeTextElementData = {
  __typename?: 'FreeTextElementData';
  content: Scalars['String']['output'];
  elementId: Scalars['Int']['output'];
  explanation?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  options: FreeTextQuestionOptions;
  pointsMultiplier: Scalars['Int']['output'];
  type: ElementType;
};

export type FreeTextInstanceEvaluation = {
  __typename?: 'FreeTextInstanceEvaluation';
  answers?: Maybe<Scalars['Json']['output']>;
  correctness?: Maybe<Scalars['Float']['output']>;
  elementType: ElementType;
  explanation?: Maybe<Scalars['String']['output']>;
  feedbacks?: Maybe<Array<QuestionFeedback>>;
  instanceId: Scalars['Int']['output'];
  lastResponse?: Maybe<SingleQuestionResponseValue>;
  newPointsFrom?: Maybe<Scalars['Date']['output']>;
  newXpFrom?: Maybe<Scalars['Date']['output']>;
  numAnswers?: Maybe<Scalars['Int']['output']>;
  percentile?: Maybe<Scalars['Float']['output']>;
  pointsAwarded?: Maybe<Scalars['Float']['output']>;
  pointsMultiplier: Scalars['Int']['output'];
  score: Scalars['Float']['output'];
  solutions?: Maybe<Array<Scalars['String']['output']>>;
  xp?: Maybe<Scalars['Int']['output']>;
  xpAwarded?: Maybe<Scalars['Int']['output']>;
};

export type FreeTextQuestionData = {
  __typename?: 'FreeTextQuestionData';
  content: Scalars['String']['output'];
  explanation?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  options: FreeTextQuestionOptions;
  pointsMultiplier?: Maybe<Scalars['Int']['output']>;
  questionId?: Maybe<Scalars['Int']['output']>;
  type: ElementType;
};

export type FreeTextQuestionOptions = {
  __typename?: 'FreeTextQuestionOptions';
  hasAnswerFeedbacks?: Maybe<Scalars['Boolean']['output']>;
  hasSampleSolution?: Maybe<Scalars['Boolean']['output']>;
  restrictions?: Maybe<FreeTextRestrictions>;
  solutions?: Maybe<Array<Scalars['String']['output']>>;
};

export type FreeTextRestrictions = {
  __typename?: 'FreeTextRestrictions';
  maxLength?: Maybe<Scalars['Int']['output']>;
};

export type FreeTextRestrictionsInput = {
  maxLength?: InputMaybe<Scalars['Int']['input']>;
  minLength?: InputMaybe<Scalars['Int']['input']>;
  pattern?: InputMaybe<Scalars['String']['input']>;
};

export type GroupAchievementInstance = {
  __typename?: 'GroupAchievementInstance';
  id: Scalars['Int']['output'];
};

export type GroupActivity = {
  __typename?: 'GroupActivity';
  activityInstances?: Maybe<Array<GroupActivityInstance>>;
  clues?: Maybe<Array<GroupActivityClue>>;
  course?: Maybe<Course>;
  description?: Maybe<Scalars['String']['output']>;
  displayName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  numOfQuestions?: Maybe<Scalars['Int']['output']>;
  pointsMultiplier?: Maybe<Scalars['Int']['output']>;
  scheduledEndAt: Scalars['Date']['output'];
  scheduledStartAt: Scalars['Date']['output'];
  stacks?: Maybe<Array<ElementStack>>;
  status: GroupActivityStatus;
};

export type GroupActivityClue = {
  __typename?: 'GroupActivityClue';
  displayName: Scalars['String']['output'];
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  type: ParameterType;
  unit?: Maybe<Scalars['String']['output']>;
  value: Scalars['String']['output'];
};

export type GroupActivityClueAssignment = {
  __typename?: 'GroupActivityClueAssignment';
  id: Scalars['Int']['output'];
};

export type GroupActivityClueInput = {
  displayName: Scalars['String']['input'];
  name: Scalars['String']['input'];
  type: ParameterType;
  unit?: InputMaybe<Scalars['String']['input']>;
  value: Scalars['String']['input'];
};

export type GroupActivityClueInstance = {
  __typename?: 'GroupActivityClueInstance';
  displayName: Scalars['String']['output'];
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  participant: Participant;
  type: ParameterType;
  unit?: Maybe<Scalars['String']['output']>;
  value?: Maybe<Scalars['String']['output']>;
};

export type GroupActivityDecision = {
  __typename?: 'GroupActivityDecision';
  choicesResponse?: Maybe<Array<Scalars['Int']['output']>>;
  contentResponse?: Maybe<Scalars['Boolean']['output']>;
  freeTextResponse?: Maybe<Scalars['String']['output']>;
  instanceId: Scalars['Int']['output'];
  numericalResponse?: Maybe<Scalars['Float']['output']>;
  type: ElementType;
};

export type GroupActivityDecisionInput = {
  id: Scalars['Int']['input'];
  response?: InputMaybe<Scalars['String']['input']>;
  selectedOptions?: InputMaybe<Array<Scalars['Int']['input']>>;
};

export type GroupActivityDetails = {
  __typename?: 'GroupActivityDetails';
  activityInstance?: Maybe<GroupActivityInstance>;
  clues: Array<GroupActivityClue>;
  course: Course;
  description?: Maybe<Scalars['String']['output']>;
  displayName: Scalars['String']['output'];
  group: ParticipantGroup;
  id: Scalars['String']['output'];
  name: Scalars['String']['output'];
  scheduledEndAt?: Maybe<Scalars['Date']['output']>;
  scheduledStartAt?: Maybe<Scalars['Date']['output']>;
  stacks: Array<ElementStack>;
  status: GroupActivityStatus;
};

export type GroupActivityGrading = {
  __typename?: 'GroupActivityGrading';
  feedback?: Maybe<Scalars['String']['output']>;
  instanceId: Scalars['Int']['output'];
  maxPoints: Scalars['Float']['output'];
  score: Scalars['Float']['output'];
};

export type GroupActivityGradingDecisionInput = {
  feedback?: InputMaybe<Scalars['String']['input']>;
  instanceId: Scalars['Int']['input'];
  score: Scalars['Float']['input'];
};

export type GroupActivityGradingInput = {
  comment?: InputMaybe<Scalars['String']['input']>;
  grading: Array<GroupActivityGradingDecisionInput>;
  passed: Scalars['Boolean']['input'];
};

export type GroupActivityInstance = {
  __typename?: 'GroupActivityInstance';
  clues?: Maybe<Array<GroupActivityClueInstance>>;
  decisions?: Maybe<Array<GroupActivityDecision>>;
  decisionsSubmittedAt?: Maybe<Scalars['Date']['output']>;
  groupActivityId: Scalars['ID']['output'];
  groupName?: Maybe<Scalars['String']['output']>;
  id: Scalars['Int']['output'];
  results?: Maybe<GroupActivityResults>;
  resultsComputedAt?: Maybe<Scalars['Date']['output']>;
};

export type GroupActivityParameter = {
  __typename?: 'GroupActivityParameter';
  id: Scalars['Int']['output'];
};

export type GroupActivityResults = {
  __typename?: 'GroupActivityResults';
  comment?: Maybe<Scalars['String']['output']>;
  grading: Array<GroupActivityGrading>;
  passed: Scalars['Boolean']['output'];
  points: Scalars['Float']['output'];
};

export enum GroupActivityStatus {
  Draft = 'DRAFT',
  Ended = 'ENDED',
  Graded = 'GRADED',
  Published = 'PUBLISHED',
  Scheduled = 'SCHEDULED'
}

export type GroupActivitySummary = {
  __typename?: 'GroupActivitySummary';
  numOfStartedInstances: Scalars['Int']['output'];
  numOfSubmissions: Scalars['Int']['output'];
};

export type GroupAssignmentPoolEntry = {
  __typename?: 'GroupAssignmentPoolEntry';
  courseId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  participant?: Maybe<Participant>;
  participantId: Scalars['ID']['output'];
};

export type GroupLeaderboardEntry = {
  __typename?: 'GroupLeaderboardEntry';
  id: Scalars['ID']['output'];
  isMember?: Maybe<Scalars['Boolean']['output']>;
  name: Scalars['String']['output'];
  rank: Scalars['Int']['output'];
  score: Scalars['Float']['output'];
};

export type GroupMessage = {
  __typename?: 'GroupMessage';
  content: Scalars['String']['output'];
  createdAt: Scalars['Date']['output'];
  group?: Maybe<ParticipantGroup>;
  id: Scalars['Int']['output'];
  participant: Participant;
  updatedAt: Scalars['Date']['output'];
};

export type InstanceEvaluation = ChoicesInstanceEvaluation | ContentInstanceEvaluation | FlashcardInstanceEvaluation | FreeTextInstanceEvaluation | NumericalInstanceEvaluation;

export type InstanceResult = {
  __typename?: 'InstanceResult';
  blockIx?: Maybe<Scalars['Int']['output']>;
  id: Scalars['String']['output'];
  instanceIx: Scalars['Int']['output'];
  participants: Scalars['Int']['output'];
  questionData: QuestionData;
  results: Scalars['Json']['output'];
  statistics?: Maybe<Statistics>;
  status: SessionBlockStatus;
};

export type LeaderboardEntry = {
  __typename?: 'LeaderboardEntry';
  avatar?: Maybe<Scalars['String']['output']>;
  email?: Maybe<Scalars['String']['output']>;
  id: Scalars['Int']['output'];
  isSelf?: Maybe<Scalars['Boolean']['output']>;
  lastBlockOrder?: Maybe<Scalars['Int']['output']>;
  level: Scalars['Int']['output'];
  participant?: Maybe<Participant>;
  participantId: Scalars['String']['output'];
  participation?: Maybe<Participation>;
  rank: Scalars['Int']['output'];
  score: Scalars['Float']['output'];
  username: Scalars['String']['output'];
};

export type LeaderboardStatistics = {
  __typename?: 'LeaderboardStatistics';
  averageScore: Scalars['Float']['output'];
  participantCount: Scalars['Int']['output'];
};

export type LeaveCourseParticipation = {
  __typename?: 'LeaveCourseParticipation';
  id: Scalars['String']['output'];
  participation: Participation;
};

export type Level = {
  __typename?: 'Level';
  avatar?: Maybe<Scalars['String']['output']>;
  id: Scalars['Int']['output'];
  index: Scalars['Int']['output'];
  name?: Maybe<Scalars['String']['output']>;
  nextLevel?: Maybe<Level>;
  requiredXp: Scalars['Int']['output'];
};

export enum LocaleType {
  De = 'de',
  En = 'en'
}

export type MediaFile = {
  __typename?: 'MediaFile';
  createdAt: Scalars['Date']['output'];
  href: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  type: Scalars['String']['output'];
};

export type MicroLearning = {
  __typename?: 'MicroLearning';
  arePushNotificationsSent?: Maybe<Scalars['Boolean']['output']>;
  course?: Maybe<Course>;
  description?: Maybe<Scalars['String']['output']>;
  displayName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  numOfStacks?: Maybe<Scalars['Int']['output']>;
  pointsMultiplier: Scalars['Float']['output'];
  scheduledEndAt: Scalars['Date']['output'];
  scheduledStartAt: Scalars['Date']['output'];
  stacks?: Maybe<Array<ElementStack>>;
  status: PublicationStatus;
};

export type Mutation = {
  __typename?: 'Mutation';
  activateParticipantAccount?: Maybe<Scalars['ID']['output']>;
  activateSessionBlock?: Maybe<Session>;
  addConfusionTimestep?: Maybe<ConfusionTimestep>;
  addMessageToGroup?: Maybe<GroupMessage>;
  bookmarkElementStack?: Maybe<Array<Scalars['Int']['output']>>;
  cancelSession?: Maybe<Session>;
  changeEmailSettings?: Maybe<User>;
  changeInitialSettings?: Maybe<User>;
  changeLiveQuizName?: Maybe<Session>;
  changeParticipantLocale?: Maybe<Participant>;
  changeSessionSettings?: Maybe<Session>;
  changeShortname?: Maybe<User>;
  changeUserLocale?: Maybe<User>;
  createCourse?: Maybe<Course>;
  createFeedback?: Maybe<Feedback>;
  createGroupActivity?: Maybe<GroupActivity>;
  createMicroLearning?: Maybe<MicroLearning>;
  createParticipantAccount?: Maybe<ParticipantTokenData>;
  createParticipantGroup?: Maybe<ParticipantGroup>;
  createPracticeQuiz?: Maybe<PracticeQuiz>;
  createSession?: Maybe<Session>;
  createUserLogin?: Maybe<UserLogin>;
  deactivateSessionBlock?: Maybe<Session>;
  deleteCourse?: Maybe<Course>;
  deleteFeedback?: Maybe<Feedback>;
  deleteFeedbackResponse?: Maybe<Feedback>;
  deleteGroupActivity?: Maybe<GroupActivity>;
  deleteLiveQuiz?: Maybe<Session>;
  deleteMicroLearning?: Maybe<MicroLearning>;
  deleteParticipantAccount?: Maybe<Scalars['Boolean']['output']>;
  deletePracticeQuiz?: Maybe<PracticeQuiz>;
  deleteQuestion?: Maybe<Element>;
  deleteTag?: Maybe<Tag>;
  deleteUserLogin?: Maybe<UserLogin>;
  editGroupActivity?: Maybe<GroupActivity>;
  editMicroLearning?: Maybe<MicroLearning>;
  editPracticeQuiz?: Maybe<PracticeQuiz>;
  editSession?: Maybe<Session>;
  editTag?: Maybe<Tag>;
  enableCourseGamification?: Maybe<Course>;
  endGroupActivity?: Maybe<GroupActivity>;
  endMicroLearning?: Maybe<MicroLearning>;
  endSession?: Maybe<Session>;
  extendGroupActivity?: Maybe<GroupActivity>;
  extendMicroLearning?: Maybe<MicroLearning>;
  finalRandomGroupAssignments: Scalars['Boolean']['output'];
  finalizeGroupActivityGrading?: Maybe<GroupActivity>;
  flagElement?: Maybe<ElementFeedback>;
  generateLoginToken?: Maybe<User>;
  getFileUploadSas?: Maybe<FileUploadSas>;
  gradeGroupActivitySubmission?: Maybe<GroupActivityInstance>;
  joinCourse?: Maybe<ParticipantLearningData>;
  joinCourseWithPin?: Maybe<Participant>;
  joinParticipantGroup?: Maybe<Scalars['String']['output']>;
  joinRandomCourseGroupPool: Scalars['Boolean']['output'];
  leaveCourse?: Maybe<LeaveCourseParticipation>;
  leaveParticipantGroup?: Maybe<ParticipantGroup>;
  leaveRandomCourseGroupPool: Scalars['Boolean']['output'];
  loginParticipant?: Maybe<Scalars['ID']['output']>;
  loginParticipantMagicLink?: Maybe<Scalars['ID']['output']>;
  loginParticipantWithLti?: Maybe<ParticipantTokenData>;
  loginUserToken?: Maybe<Scalars['ID']['output']>;
  logoutParticipant?: Maybe<Scalars['ID']['output']>;
  logoutUser?: Maybe<Scalars['ID']['output']>;
  manipulateChoicesQuestion?: Maybe<Element>;
  manipulateContentElement?: Maybe<Element>;
  manipulateFlashcardElement?: Maybe<Element>;
  manipulateFreeTextQuestion?: Maybe<Element>;
  manipulateNumericalQuestion?: Maybe<Element>;
  manualRandomGroupAssignments?: Maybe<Course>;
  markMicroLearningCompleted?: Maybe<Participation>;
  openGroupActivity?: Maybe<GroupActivity>;
  pinFeedback?: Maybe<Feedback>;
  publishFeedback?: Maybe<Feedback>;
  publishGroupActivity?: Maybe<GroupActivity>;
  publishMicroLearning?: Maybe<MicroLearning>;
  publishPracticeQuiz?: Maybe<PracticeQuiz>;
  publishScheduledActivities: Scalars['Boolean']['output'];
  rateElement?: Maybe<ElementFeedback>;
  renameParticipantGroup?: Maybe<ParticipantGroup>;
  requestMigrationToken?: Maybe<Scalars['Boolean']['output']>;
  resolveFeedback?: Maybe<Feedback>;
  respondToElementStack?: Maybe<StackFeedback>;
  respondToFeedback?: Maybe<Feedback>;
  runningRandomGroupAssignments: Scalars['Boolean']['output'];
  sendMagicLink?: Maybe<Scalars['Boolean']['output']>;
  sendPushNotifications: Scalars['Boolean']['output'];
  startGroupActivity?: Maybe<GroupActivityDetails>;
  startSession?: Maybe<Session>;
  submitGroupActivityDecisions?: Maybe<Scalars['Int']['output']>;
  subscribeToPush?: Maybe<Participation>;
  toggleArchiveCourse?: Maybe<Course>;
  toggleIsArchived?: Maybe<Array<ArchivedElement>>;
  triggerMigration?: Maybe<Scalars['Boolean']['output']>;
  unpublishGroupActivity?: Maybe<GroupActivity>;
  unpublishMicroLearning?: Maybe<MicroLearning>;
  unpublishPracticeQuiz?: Maybe<PracticeQuiz>;
  unsubscribeFromPush?: Maybe<Scalars['Boolean']['output']>;
  updateCourseSettings?: Maybe<Course>;
  updateGroupAverageScores: Scalars['Boolean']['output'];
  updateParticipantAvatar?: Maybe<Participant>;
  updateParticipantProfile?: Maybe<Participant>;
  updateQuestionInstances: Array<QuestionOrElementInstance>;
  updateTagOrdering?: Maybe<Array<Tag>>;
  upvoteFeedback?: Maybe<Feedback>;
  voteFeedbackResponse?: Maybe<FeedbackResponse>;
};


export type MutationActivateParticipantAccountArgs = {
  token: Scalars['String']['input'];
};


export type MutationActivateSessionBlockArgs = {
  sessionBlockId: Scalars['Int']['input'];
  sessionId: Scalars['String']['input'];
};


export type MutationAddConfusionTimestepArgs = {
  difficulty: Scalars['Int']['input'];
  sessionId: Scalars['String']['input'];
  speed: Scalars['Int']['input'];
};


export type MutationAddMessageToGroupArgs = {
  content: Scalars['String']['input'];
  groupId: Scalars['String']['input'];
};


export type MutationBookmarkElementStackArgs = {
  bookmarked: Scalars['Boolean']['input'];
  courseId: Scalars['String']['input'];
  stackId: Scalars['Int']['input'];
};


export type MutationCancelSessionArgs = {
  id: Scalars['String']['input'];
};


export type MutationChangeEmailSettingsArgs = {
  projectUpdates: Scalars['Boolean']['input'];
};


export type MutationChangeInitialSettingsArgs = {
  locale: LocaleType;
  sendUpdates: Scalars['Boolean']['input'];
  shortname: Scalars['String']['input'];
};


export type MutationChangeLiveQuizNameArgs = {
  displayName: Scalars['String']['input'];
  id: Scalars['String']['input'];
  name: Scalars['String']['input'];
};


export type MutationChangeParticipantLocaleArgs = {
  locale: LocaleType;
};


export type MutationChangeSessionSettingsArgs = {
  id: Scalars['String']['input'];
  isConfusionFeedbackEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  isGamificationEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  isLiveQAEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  isModerationEnabled?: InputMaybe<Scalars['Boolean']['input']>;
};


export type MutationChangeShortnameArgs = {
  shortname: Scalars['String']['input'];
};


export type MutationChangeUserLocaleArgs = {
  locale: LocaleType;
};


export type MutationCreateCourseArgs = {
  color?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  displayName: Scalars['String']['input'];
  endDate: Scalars['Date']['input'];
  groupDeadlineDate: Scalars['Date']['input'];
  isGamificationEnabled: Scalars['Boolean']['input'];
  isGroupCreationEnabled: Scalars['Boolean']['input'];
  maxGroupSize: Scalars['Int']['input'];
  name: Scalars['String']['input'];
  notificationEmail?: InputMaybe<Scalars['String']['input']>;
  preferredGroupSize: Scalars['Int']['input'];
  startDate: Scalars['Date']['input'];
};


export type MutationCreateFeedbackArgs = {
  content: Scalars['String']['input'];
  sessionId: Scalars['String']['input'];
};


export type MutationCreateGroupActivityArgs = {
  clues: Array<GroupActivityClueInput>;
  courseId: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  displayName: Scalars['String']['input'];
  endDate: Scalars['Date']['input'];
  multiplier: Scalars['Int']['input'];
  name: Scalars['String']['input'];
  stack: ElementStackInput;
  startDate: Scalars['Date']['input'];
};


export type MutationCreateMicroLearningArgs = {
  courseId: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  displayName: Scalars['String']['input'];
  endDate: Scalars['Date']['input'];
  multiplier: Scalars['Int']['input'];
  name: Scalars['String']['input'];
  stacks: Array<ElementStackInput>;
  startDate: Scalars['Date']['input'];
};


export type MutationCreateParticipantAccountArgs = {
  courseId?: InputMaybe<Scalars['String']['input']>;
  email: Scalars['String']['input'];
  isProfilePublic: Scalars['Boolean']['input'];
  password: Scalars['String']['input'];
  signedLtiData?: InputMaybe<Scalars['String']['input']>;
  username: Scalars['String']['input'];
};


export type MutationCreateParticipantGroupArgs = {
  courseId: Scalars['String']['input'];
  name: Scalars['String']['input'];
};


export type MutationCreatePracticeQuizArgs = {
  availableFrom?: InputMaybe<Scalars['Date']['input']>;
  courseId: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  displayName: Scalars['String']['input'];
  multiplier: Scalars['Int']['input'];
  name: Scalars['String']['input'];
  order: ElementOrderType;
  resetTimeDays: Scalars['Int']['input'];
  stacks: Array<ElementStackInput>;
};


export type MutationCreateSessionArgs = {
  blocks: Array<BlockInput>;
  courseId?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  displayName: Scalars['String']['input'];
  isConfusionFeedbackEnabled: Scalars['Boolean']['input'];
  isGamificationEnabled: Scalars['Boolean']['input'];
  isLiveQAEnabled: Scalars['Boolean']['input'];
  isModerationEnabled: Scalars['Boolean']['input'];
  maxBonusPoints: Scalars['Int']['input'];
  multiplier: Scalars['Int']['input'];
  name: Scalars['String']['input'];
  timeToZeroBonus: Scalars['Int']['input'];
};


export type MutationCreateUserLoginArgs = {
  name: Scalars['String']['input'];
  password: Scalars['String']['input'];
  scope: UserLoginScope;
};


export type MutationDeactivateSessionBlockArgs = {
  sessionBlockId: Scalars['Int']['input'];
  sessionId: Scalars['String']['input'];
};


export type MutationDeleteCourseArgs = {
  id: Scalars['String']['input'];
};


export type MutationDeleteFeedbackArgs = {
  id: Scalars['Int']['input'];
};


export type MutationDeleteFeedbackResponseArgs = {
  id: Scalars['Int']['input'];
};


export type MutationDeleteGroupActivityArgs = {
  id: Scalars['String']['input'];
};


export type MutationDeleteLiveQuizArgs = {
  id: Scalars['String']['input'];
};


export type MutationDeleteMicroLearningArgs = {
  id: Scalars['String']['input'];
};


export type MutationDeletePracticeQuizArgs = {
  id: Scalars['String']['input'];
};


export type MutationDeleteQuestionArgs = {
  id: Scalars['Int']['input'];
};


export type MutationDeleteTagArgs = {
  id: Scalars['Int']['input'];
};


export type MutationDeleteUserLoginArgs = {
  id: Scalars['String']['input'];
};


export type MutationEditGroupActivityArgs = {
  clues: Array<GroupActivityClueInput>;
  courseId: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  displayName: Scalars['String']['input'];
  endDate: Scalars['Date']['input'];
  id: Scalars['String']['input'];
  multiplier: Scalars['Int']['input'];
  name: Scalars['String']['input'];
  stack: ElementStackInput;
  startDate: Scalars['Date']['input'];
};


export type MutationEditMicroLearningArgs = {
  courseId: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  displayName: Scalars['String']['input'];
  endDate: Scalars['Date']['input'];
  id: Scalars['String']['input'];
  multiplier: Scalars['Int']['input'];
  name: Scalars['String']['input'];
  stacks: Array<ElementStackInput>;
  startDate: Scalars['Date']['input'];
};


export type MutationEditPracticeQuizArgs = {
  availableFrom?: InputMaybe<Scalars['Date']['input']>;
  courseId: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  displayName: Scalars['String']['input'];
  id: Scalars['String']['input'];
  multiplier: Scalars['Int']['input'];
  name: Scalars['String']['input'];
  order: ElementOrderType;
  resetTimeDays: Scalars['Int']['input'];
  stacks: Array<ElementStackInput>;
};


export type MutationEditSessionArgs = {
  blocks: Array<BlockInput>;
  courseId?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  displayName: Scalars['String']['input'];
  id: Scalars['String']['input'];
  isConfusionFeedbackEnabled: Scalars['Boolean']['input'];
  isGamificationEnabled: Scalars['Boolean']['input'];
  isLiveQAEnabled: Scalars['Boolean']['input'];
  isModerationEnabled: Scalars['Boolean']['input'];
  maxBonusPoints: Scalars['Int']['input'];
  multiplier: Scalars['Int']['input'];
  name: Scalars['String']['input'];
  timeToZeroBonus: Scalars['Int']['input'];
};


export type MutationEditTagArgs = {
  id: Scalars['Int']['input'];
  name: Scalars['String']['input'];
};


export type MutationEnableCourseGamificationArgs = {
  courseId: Scalars['String']['input'];
};


export type MutationEndGroupActivityArgs = {
  id: Scalars['String']['input'];
};


export type MutationEndMicroLearningArgs = {
  id: Scalars['String']['input'];
};


export type MutationEndSessionArgs = {
  id: Scalars['String']['input'];
};


export type MutationExtendGroupActivityArgs = {
  endDate: Scalars['Date']['input'];
  id: Scalars['String']['input'];
};


export type MutationExtendMicroLearningArgs = {
  endDate: Scalars['Date']['input'];
  id: Scalars['String']['input'];
};


export type MutationFinalizeGroupActivityGradingArgs = {
  id: Scalars['String']['input'];
};


export type MutationFlagElementArgs = {
  content: Scalars['String']['input'];
  elementId: Scalars['Int']['input'];
  elementInstanceId: Scalars['Int']['input'];
};


export type MutationGetFileUploadSasArgs = {
  contentType: Scalars['String']['input'];
  fileName: Scalars['String']['input'];
};


export type MutationGradeGroupActivitySubmissionArgs = {
  gradingDecisions: GroupActivityGradingInput;
  id: Scalars['Int']['input'];
};


export type MutationJoinCourseArgs = {
  courseId: Scalars['String']['input'];
};


export type MutationJoinCourseWithPinArgs = {
  pin: Scalars['Int']['input'];
};


export type MutationJoinParticipantGroupArgs = {
  code: Scalars['Int']['input'];
  courseId: Scalars['String']['input'];
};


export type MutationJoinRandomCourseGroupPoolArgs = {
  courseId: Scalars['String']['input'];
};


export type MutationLeaveCourseArgs = {
  courseId: Scalars['String']['input'];
};


export type MutationLeaveParticipantGroupArgs = {
  courseId: Scalars['String']['input'];
  groupId: Scalars['String']['input'];
};


export type MutationLeaveRandomCourseGroupPoolArgs = {
  courseId: Scalars['String']['input'];
};


export type MutationLoginParticipantArgs = {
  password: Scalars['String']['input'];
  usernameOrEmail: Scalars['String']['input'];
};


export type MutationLoginParticipantMagicLinkArgs = {
  token: Scalars['String']['input'];
};


export type MutationLoginParticipantWithLtiArgs = {
  courseId?: InputMaybe<Scalars['String']['input']>;
  signedLtiData: Scalars['String']['input'];
};


export type MutationLoginUserTokenArgs = {
  shortname: Scalars['String']['input'];
  token: Scalars['String']['input'];
};


export type MutationManipulateChoicesQuestionArgs = {
  content?: InputMaybe<Scalars['String']['input']>;
  explanation?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  options?: InputMaybe<OptionsChoicesInput>;
  pointsMultiplier?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<ElementStatus>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  type: ElementType;
};


export type MutationManipulateContentElementArgs = {
  content?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  pointsMultiplier?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<ElementStatus>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};


export type MutationManipulateFlashcardElementArgs = {
  content?: InputMaybe<Scalars['String']['input']>;
  explanation?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  pointsMultiplier?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<ElementStatus>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};


export type MutationManipulateFreeTextQuestionArgs = {
  content?: InputMaybe<Scalars['String']['input']>;
  explanation?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  options?: InputMaybe<OptionsFreeTextInput>;
  pointsMultiplier?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<ElementStatus>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};


export type MutationManipulateNumericalQuestionArgs = {
  content?: InputMaybe<Scalars['String']['input']>;
  explanation?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  options?: InputMaybe<OptionsNumericalInput>;
  pointsMultiplier?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<ElementStatus>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};


export type MutationManualRandomGroupAssignmentsArgs = {
  courseId: Scalars['String']['input'];
};


export type MutationMarkMicroLearningCompletedArgs = {
  courseId: Scalars['String']['input'];
  id: Scalars['String']['input'];
};


export type MutationOpenGroupActivityArgs = {
  id: Scalars['String']['input'];
};


export type MutationPinFeedbackArgs = {
  id: Scalars['Int']['input'];
  isPinned: Scalars['Boolean']['input'];
};


export type MutationPublishFeedbackArgs = {
  id: Scalars['Int']['input'];
  isPublished: Scalars['Boolean']['input'];
};


export type MutationPublishGroupActivityArgs = {
  id: Scalars['String']['input'];
};


export type MutationPublishMicroLearningArgs = {
  id: Scalars['String']['input'];
};


export type MutationPublishPracticeQuizArgs = {
  id: Scalars['String']['input'];
};


export type MutationRateElementArgs = {
  elementId: Scalars['Int']['input'];
  elementInstanceId: Scalars['Int']['input'];
  rating: Scalars['Int']['input'];
};


export type MutationRenameParticipantGroupArgs = {
  groupId: Scalars['String']['input'];
  name: Scalars['String']['input'];
};


export type MutationRequestMigrationTokenArgs = {
  email: Scalars['String']['input'];
};


export type MutationResolveFeedbackArgs = {
  id: Scalars['Int']['input'];
  isResolved: Scalars['Boolean']['input'];
};


export type MutationRespondToElementStackArgs = {
  courseId: Scalars['String']['input'];
  responses: Array<StackResponseInput>;
  stackAnswerTime: Scalars['Int']['input'];
  stackId: Scalars['Int']['input'];
};


export type MutationRespondToFeedbackArgs = {
  id: Scalars['Int']['input'];
  responseContent: Scalars['String']['input'];
};


export type MutationSendMagicLinkArgs = {
  usernameOrEmail: Scalars['String']['input'];
};


export type MutationStartGroupActivityArgs = {
  activityId: Scalars['String']['input'];
  groupId: Scalars['String']['input'];
};


export type MutationStartSessionArgs = {
  id: Scalars['String']['input'];
};


export type MutationSubmitGroupActivityDecisionsArgs = {
  activityId: Scalars['Int']['input'];
  responses: Array<StackResponseInput>;
};


export type MutationSubscribeToPushArgs = {
  courseId: Scalars['String']['input'];
  subscriptionObject: SubscriptionObjectInput;
};


export type MutationToggleArchiveCourseArgs = {
  id: Scalars['String']['input'];
  isArchived: Scalars['Boolean']['input'];
};


export type MutationToggleIsArchivedArgs = {
  isArchived: Scalars['Boolean']['input'];
  questionIds: Array<Scalars['Int']['input']>;
};


export type MutationTriggerMigrationArgs = {
  token: Scalars['String']['input'];
};


export type MutationUnpublishGroupActivityArgs = {
  id: Scalars['String']['input'];
};


export type MutationUnpublishMicroLearningArgs = {
  id: Scalars['String']['input'];
};


export type MutationUnpublishPracticeQuizArgs = {
  id: Scalars['String']['input'];
};


export type MutationUnsubscribeFromPushArgs = {
  courseId: Scalars['String']['input'];
  endpoint: Scalars['String']['input'];
};


export type MutationUpdateCourseSettingsArgs = {
  color?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  displayName?: InputMaybe<Scalars['String']['input']>;
  endDate?: InputMaybe<Scalars['Date']['input']>;
  groupDeadlineDate?: InputMaybe<Scalars['Date']['input']>;
  id: Scalars['String']['input'];
  isGamificationEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  isGroupCreationEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  notificationEmail?: InputMaybe<Scalars['String']['input']>;
  startDate?: InputMaybe<Scalars['Date']['input']>;
};


export type MutationUpdateParticipantAvatarArgs = {
  avatar: Scalars['String']['input'];
  avatarSettings: AvatarSettingsInput;
};


export type MutationUpdateParticipantProfileArgs = {
  email: Scalars['String']['input'];
  isProfilePublic?: InputMaybe<Scalars['Boolean']['input']>;
  password?: InputMaybe<Scalars['String']['input']>;
  username: Scalars['String']['input'];
};


export type MutationUpdateQuestionInstancesArgs = {
  questionId: Scalars['Int']['input'];
};


export type MutationUpdateTagOrderingArgs = {
  originIx: Scalars['Int']['input'];
  targetIx: Scalars['Int']['input'];
};


export type MutationUpvoteFeedbackArgs = {
  feedbackId: Scalars['Int']['input'];
  increment: Scalars['Int']['input'];
};


export type MutationVoteFeedbackResponseArgs = {
  id: Scalars['Int']['input'];
  incrementDownvote: Scalars['Int']['input'];
  incrementUpvote: Scalars['Int']['input'];
};

export type NumericalElement = {
  __typename?: 'NumericalElement';
  content: Scalars['String']['output'];
  createdAt?: Maybe<Scalars['Date']['output']>;
  explanation?: Maybe<Scalars['String']['output']>;
  id: Scalars['Int']['output'];
  isArchived?: Maybe<Scalars['Boolean']['output']>;
  isDeleted?: Maybe<Scalars['Boolean']['output']>;
  name: Scalars['String']['output'];
  options: NumericalQuestionOptions;
  pointsMultiplier: Scalars['Int']['output'];
  status: ElementStatus;
  tags?: Maybe<Array<Tag>>;
  type: ElementType;
  updatedAt?: Maybe<Scalars['Date']['output']>;
  version: Scalars['Int']['output'];
};

export type NumericalElementData = {
  __typename?: 'NumericalElementData';
  content: Scalars['String']['output'];
  elementId: Scalars['Int']['output'];
  explanation?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  options: NumericalQuestionOptions;
  pointsMultiplier: Scalars['Int']['output'];
  type: ElementType;
};

export type NumericalElementInstanceEvaluation = {
  __typename?: 'NumericalElementInstanceEvaluation';
  content: Scalars['String']['output'];
  explanation?: Maybe<Scalars['String']['output']>;
  hasAnswerFeedbacks: Scalars['Boolean']['output'];
  hasSampleSolution: Scalars['Boolean']['output'];
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  results: NumericalElementResults;
  type: ElementType;
};

export type NumericalElementResult = {
  __typename?: 'NumericalElementResult';
  correct?: Maybe<Scalars['Boolean']['output']>;
  count: Scalars['Int']['output'];
  value: Scalars['Float']['output'];
};

export type NumericalElementResults = {
  __typename?: 'NumericalElementResults';
  anonymousAnswers: Scalars['Int']['output'];
  maxValue?: Maybe<Scalars['Float']['output']>;
  minValue?: Maybe<Scalars['Float']['output']>;
  responseValues: Array<NumericalElementResult>;
  solutionRanges: Array<NumericalElementSolutions>;
  totalAnswers: Scalars['Int']['output'];
};

export type NumericalElementSolutions = {
  __typename?: 'NumericalElementSolutions';
  max?: Maybe<Scalars['Float']['output']>;
  min?: Maybe<Scalars['Float']['output']>;
};

export type NumericalInstanceEvaluation = {
  __typename?: 'NumericalInstanceEvaluation';
  answers?: Maybe<Scalars['Json']['output']>;
  correctness?: Maybe<Scalars['Float']['output']>;
  elementType: ElementType;
  explanation?: Maybe<Scalars['String']['output']>;
  feedbacks?: Maybe<Array<QuestionFeedback>>;
  instanceId: Scalars['Int']['output'];
  lastResponse?: Maybe<SingleQuestionResponseValue>;
  newPointsFrom?: Maybe<Scalars['Date']['output']>;
  newXpFrom?: Maybe<Scalars['Date']['output']>;
  numAnswers?: Maybe<Scalars['Int']['output']>;
  percentile?: Maybe<Scalars['Float']['output']>;
  pointsAwarded?: Maybe<Scalars['Float']['output']>;
  pointsMultiplier: Scalars['Int']['output'];
  score: Scalars['Float']['output'];
  solutionRanges?: Maybe<Array<NumericalSolutionRange>>;
  xp?: Maybe<Scalars['Int']['output']>;
  xpAwarded?: Maybe<Scalars['Int']['output']>;
};

export type NumericalQuestionData = {
  __typename?: 'NumericalQuestionData';
  content: Scalars['String']['output'];
  explanation?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  options: NumericalQuestionOptions;
  pointsMultiplier?: Maybe<Scalars['Int']['output']>;
  questionId?: Maybe<Scalars['Int']['output']>;
  type: ElementType;
};

export type NumericalQuestionOptions = {
  __typename?: 'NumericalQuestionOptions';
  accuracy?: Maybe<Scalars['Int']['output']>;
  hasAnswerFeedbacks?: Maybe<Scalars['Boolean']['output']>;
  hasSampleSolution?: Maybe<Scalars['Boolean']['output']>;
  placeholder?: Maybe<Scalars['String']['output']>;
  restrictions?: Maybe<NumericalRestrictions>;
  solutionRanges?: Maybe<Array<NumericalSolutionRange>>;
  unit?: Maybe<Scalars['String']['output']>;
};

export type NumericalRestrictions = {
  __typename?: 'NumericalRestrictions';
  max?: Maybe<Scalars['Float']['output']>;
  min?: Maybe<Scalars['Float']['output']>;
};

export type NumericalRestrictionsInput = {
  hasAnswerFeedbacks?: InputMaybe<Scalars['Boolean']['input']>;
  hasSampleSolution?: InputMaybe<Scalars['Boolean']['input']>;
  max?: InputMaybe<Scalars['Float']['input']>;
  min?: InputMaybe<Scalars['Float']['input']>;
};

export type NumericalSolutionRange = {
  __typename?: 'NumericalSolutionRange';
  max?: Maybe<Scalars['Float']['output']>;
  min?: Maybe<Scalars['Float']['output']>;
};

export type OpenQuestionResponse = {
  __typename?: 'OpenQuestionResponse';
  aggregatedResponses: ElementResultsOpen;
  correctCount: Scalars['Int']['output'];
  correctCountStreak: Scalars['Int']['output'];
  eFactor: Scalars['Float']['output'];
  elementType: ElementType;
  id: Scalars['Int']['output'];
  interval: Scalars['Int']['output'];
  lastAnsweredAt?: Maybe<Scalars['Date']['output']>;
  lastAwardedAt?: Maybe<Scalars['Date']['output']>;
  lastCorrectAt?: Maybe<Scalars['Date']['output']>;
  lastPartialCorrectAt?: Maybe<Scalars['Date']['output']>;
  lastResponse: SingleQuestionResponseValue;
  lastWrongAt?: Maybe<Scalars['Date']['output']>;
  lastXpAwardedAt?: Maybe<Scalars['Date']['output']>;
  nextDueAt?: Maybe<Scalars['Date']['output']>;
  partialCorrectCount: Scalars['Int']['output'];
  totalPointsAwarded?: Maybe<Scalars['Float']['output']>;
  totalScore: Scalars['Float']['output'];
  totalXpAwarded?: Maybe<Scalars['Float']['output']>;
  trialsCount: Scalars['Int']['output'];
  wrongCount: Scalars['Int']['output'];
};

export type OptionsChoicesInput = {
  choices?: InputMaybe<Array<ChoiceInput>>;
  displayMode?: InputMaybe<ElementDisplayMode>;
  hasAnswerFeedbacks?: InputMaybe<Scalars['Boolean']['input']>;
  hasSampleSolution?: InputMaybe<Scalars['Boolean']['input']>;
};

export type OptionsFreeTextInput = {
  feedback?: InputMaybe<Scalars['String']['input']>;
  hasAnswerFeedbacks?: InputMaybe<Scalars['Boolean']['input']>;
  hasSampleSolution?: InputMaybe<Scalars['Boolean']['input']>;
  placeholder?: InputMaybe<Scalars['String']['input']>;
  restrictions?: InputMaybe<FreeTextRestrictionsInput>;
  solutions?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type OptionsNumericalInput = {
  accuracy?: InputMaybe<Scalars['Int']['input']>;
  feedback?: InputMaybe<Scalars['String']['input']>;
  hasAnswerFeedbacks?: InputMaybe<Scalars['Boolean']['input']>;
  hasSampleSolution?: InputMaybe<Scalars['Boolean']['input']>;
  restrictions?: InputMaybe<NumericalRestrictionsInput>;
  solutionRanges?: InputMaybe<Array<SolutionRangeInput>>;
  unit?: InputMaybe<Scalars['String']['input']>;
};

export enum ParameterType {
  Number = 'NUMBER',
  String = 'STRING'
}

export type Participant = {
  __typename?: 'Participant';
  achievements?: Maybe<Array<ParticipantAchievementInstance>>;
  avatar?: Maybe<Scalars['String']['output']>;
  avatarSettings?: Maybe<AvatarSettings>;
  email?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  isProfilePublic?: Maybe<Scalars['Boolean']['output']>;
  isSelf?: Maybe<Scalars['Boolean']['output']>;
  lastLoginAt?: Maybe<Scalars['Date']['output']>;
  level?: Maybe<Scalars['Int']['output']>;
  levelData?: Maybe<Level>;
  locale: LocaleType;
  participantGroups?: Maybe<Array<ParticipantGroup>>;
  rank?: Maybe<Scalars['Int']['output']>;
  score?: Maybe<Scalars['Float']['output']>;
  username: Scalars['String']['output'];
  xp: Scalars['Int']['output'];
};

export type ParticipantAchievementInstance = {
  __typename?: 'ParticipantAchievementInstance';
  achievedAt: Scalars['Date']['output'];
  achievedCount: Scalars['Int']['output'];
  achievement: Achievement;
  id: Scalars['Int']['output'];
};

export type ParticipantGroup = {
  __typename?: 'ParticipantGroup';
  averageMemberScore: Scalars['Int']['output'];
  code: Scalars['Int']['output'];
  groupActivityScore: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  messages?: Maybe<Array<GroupMessage>>;
  name: Scalars['String']['output'];
  participants?: Maybe<Array<Participant>>;
  score?: Maybe<Scalars['Float']['output']>;
};

export type ParticipantLearningData = {
  __typename?: 'ParticipantLearningData';
  course?: Maybe<Course>;
  groupActivityInstances?: Maybe<Array<GroupActivityInstance>>;
  groupLeaderboard?: Maybe<Array<GroupLeaderboardEntry>>;
  groupLeaderboardStatistics?: Maybe<LeaderboardStatistics>;
  id: Scalars['String']['output'];
  inRandomGroupPool?: Maybe<Scalars['Boolean']['output']>;
  leaderboard?: Maybe<Array<LeaderboardEntry>>;
  leaderboardStatistics?: Maybe<LeaderboardStatistics>;
  participant?: Maybe<Participant>;
  participantToken?: Maybe<Scalars['String']['output']>;
  participation?: Maybe<Participation>;
};

export type ParticipantTokenData = {
  __typename?: 'ParticipantTokenData';
  participant?: Maybe<Participant>;
  participantToken?: Maybe<Scalars['String']['output']>;
};

export type ParticipantWithAchievements = {
  __typename?: 'ParticipantWithAchievements';
  achievements: Array<Achievement>;
  participant: Participant;
};

export type Participation = {
  __typename?: 'Participation';
  completedMicroLearnings: Array<Scalars['String']['output']>;
  course?: Maybe<Course>;
  id: Scalars['Int']['output'];
  isActive: Scalars['Boolean']['output'];
  participant?: Maybe<Participant>;
  subscriptions?: Maybe<Array<PushSubscription>>;
};

export type PracticeQuiz = {
  __typename?: 'PracticeQuiz';
  availableFrom?: Maybe<Scalars['Date']['output']>;
  course?: Maybe<Course>;
  courseId?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  displayName: Scalars['String']['output'];
  id: Scalars['String']['output'];
  name: Scalars['String']['output'];
  numOfStacks?: Maybe<Scalars['Int']['output']>;
  orderType: ElementOrderType;
  pointsMultiplier: Scalars['Int']['output'];
  resetTimeDays: Scalars['Int']['output'];
  stacks?: Maybe<Array<ElementStack>>;
  status: PublicationStatus;
};

export enum PublicationStatus {
  Draft = 'DRAFT',
  Published = 'PUBLISHED',
  Scheduled = 'SCHEDULED'
}

export type PushSubscription = {
  __typename?: 'PushSubscription';
  endpoint: Scalars['String']['output'];
  id: Scalars['Int']['output'];
};

export type Query = {
  __typename?: 'Query';
  basicCourseInformation?: Maybe<StudentCourse>;
  checkParticipantNameAvailable: Scalars['Boolean']['output'];
  checkShortnameAvailable: Scalars['Boolean']['output'];
  checkValidCoursePin?: Maybe<Scalars['String']['output']>;
  cockpitSession?: Maybe<Session>;
  controlCourse?: Maybe<Course>;
  controlCourses?: Maybe<Array<Course>>;
  controlSession?: Maybe<Session>;
  course?: Maybe<Course>;
  coursePracticeQuiz?: Maybe<PracticeQuiz>;
  feedbacks?: Maybe<Array<Feedback>>;
  getActiveUserCourses?: Maybe<Array<Course>>;
  getBookmarkedElementStacks?: Maybe<Array<ElementStack>>;
  getBookmarksPracticeQuiz?: Maybe<Array<Scalars['Int']['output']>>;
  getCourseGroups?: Maybe<Course>;
  getCourseOverviewData?: Maybe<ParticipantLearningData>;
  getCourseSummary?: Maybe<CourseSummary>;
  getGradingGroupActivity?: Maybe<GroupActivity>;
  getGroupActivitySummary?: Maybe<GroupActivitySummary>;
  getLiveQuizSummary?: Maybe<RunningLiveQuizSummary>;
  getLoginToken?: Maybe<User>;
  getMicroLearningEvaluation?: Maybe<ActivityEvaluation>;
  getMicroLearningSummary?: Maybe<ActivitySummary>;
  getParticipation?: Maybe<Participation>;
  getPracticeCourses?: Maybe<Array<Course>>;
  getPracticeQuizEvaluation?: Maybe<ActivityEvaluation>;
  getPracticeQuizList?: Maybe<Array<Course>>;
  getPracticeQuizSummary?: Maybe<ActivitySummary>;
  getPreviousStackEvaluation?: Maybe<StackFeedback>;
  getSingleMicroLearning?: Maybe<MicroLearning>;
  getSinglePracticeQuiz?: Maybe<PracticeQuiz>;
  getStackElementFeedbacks?: Maybe<Array<ElementFeedback>>;
  groupActivities?: Maybe<Array<GroupActivity>>;
  groupActivity?: Maybe<GroupActivity>;
  groupActivityDetails?: Maybe<GroupActivityDetails>;
  groupActivityInstances?: Maybe<Array<GroupActivityInstance>>;
  liveSession?: Maybe<Session>;
  microLearning?: Maybe<MicroLearning>;
  participantCourses?: Maybe<Array<Course>>;
  participantGroups?: Maybe<Array<ParticipantGroup>>;
  participations?: Maybe<Array<Participation>>;
  pinnedFeedbacks?: Maybe<Session>;
  practiceQuiz?: Maybe<PracticeQuiz>;
  publicParticipantProfile?: Maybe<Participant>;
  question?: Maybe<Element>;
  runningSessions?: Maybe<Array<Session>>;
  runningSessionsCourse?: Maybe<Array<Session>>;
  self?: Maybe<Participant>;
  selfWithAchievements?: Maybe<ParticipantWithAchievements>;
  session?: Maybe<Session>;
  sessionEvaluation?: Maybe<SessionEvaluation>;
  sessionHMAC?: Maybe<Scalars['String']['output']>;
  sessionLeaderboard?: Maybe<Array<LeaderboardEntry>>;
  unassignedSessions?: Maybe<Array<Session>>;
  userCourses?: Maybe<Array<Course>>;
  userLogins?: Maybe<Array<UserLogin>>;
  userMediaFiles?: Maybe<Array<MediaFile>>;
  userProfile?: Maybe<User>;
  userQuestions?: Maybe<Array<Element>>;
  userRunningSessions?: Maybe<Array<Session>>;
  userScope?: Maybe<UserLoginScope>;
  userSessions?: Maybe<Array<Session>>;
  userTags?: Maybe<Array<Tag>>;
};


export type QueryBasicCourseInformationArgs = {
  courseId: Scalars['String']['input'];
};


export type QueryCheckParticipantNameAvailableArgs = {
  username: Scalars['String']['input'];
};


export type QueryCheckShortnameAvailableArgs = {
  shortname: Scalars['String']['input'];
};


export type QueryCheckValidCoursePinArgs = {
  pin: Scalars['Int']['input'];
};


export type QueryCockpitSessionArgs = {
  id: Scalars['String']['input'];
};


export type QueryControlCourseArgs = {
  id: Scalars['String']['input'];
};


export type QueryControlSessionArgs = {
  id: Scalars['String']['input'];
};


export type QueryCourseArgs = {
  id: Scalars['String']['input'];
};


export type QueryCoursePracticeQuizArgs = {
  courseId: Scalars['String']['input'];
};


export type QueryFeedbacksArgs = {
  id: Scalars['String']['input'];
};


export type QueryGetBookmarkedElementStacksArgs = {
  courseId: Scalars['String']['input'];
};


export type QueryGetBookmarksPracticeQuizArgs = {
  courseId: Scalars['String']['input'];
  quizId?: InputMaybe<Scalars['String']['input']>;
};


export type QueryGetCourseGroupsArgs = {
  courseId: Scalars['String']['input'];
};


export type QueryGetCourseOverviewDataArgs = {
  courseId: Scalars['String']['input'];
};


export type QueryGetCourseSummaryArgs = {
  courseId: Scalars['String']['input'];
};


export type QueryGetGradingGroupActivityArgs = {
  id: Scalars['String']['input'];
};


export type QueryGetGroupActivitySummaryArgs = {
  id: Scalars['String']['input'];
};


export type QueryGetLiveQuizSummaryArgs = {
  quizId: Scalars['String']['input'];
};


export type QueryGetMicroLearningEvaluationArgs = {
  id: Scalars['String']['input'];
};


export type QueryGetMicroLearningSummaryArgs = {
  id: Scalars['String']['input'];
};


export type QueryGetParticipationArgs = {
  courseId: Scalars['String']['input'];
};


export type QueryGetPracticeQuizEvaluationArgs = {
  id: Scalars['String']['input'];
};


export type QueryGetPracticeQuizSummaryArgs = {
  id: Scalars['String']['input'];
};


export type QueryGetPreviousStackEvaluationArgs = {
  stackId: Scalars['Int']['input'];
};


export type QueryGetSingleMicroLearningArgs = {
  id: Scalars['String']['input'];
};


export type QueryGetSinglePracticeQuizArgs = {
  id: Scalars['String']['input'];
};


export type QueryGetStackElementFeedbacksArgs = {
  elementInstanceIds: Array<Scalars['Int']['input']>;
};


export type QueryGroupActivitiesArgs = {
  courseId: Scalars['String']['input'];
};


export type QueryGroupActivityArgs = {
  id: Scalars['String']['input'];
};


export type QueryGroupActivityDetailsArgs = {
  activityId: Scalars['String']['input'];
  groupId: Scalars['String']['input'];
};


export type QueryGroupActivityInstancesArgs = {
  courseId: Scalars['String']['input'];
  groupId: Scalars['String']['input'];
};


export type QueryLiveSessionArgs = {
  id: Scalars['String']['input'];
};


export type QueryMicroLearningArgs = {
  id: Scalars['String']['input'];
};


export type QueryParticipantGroupsArgs = {
  courseId: Scalars['String']['input'];
};


export type QueryParticipationsArgs = {
  endpoint?: InputMaybe<Scalars['String']['input']>;
};


export type QueryPinnedFeedbacksArgs = {
  id: Scalars['String']['input'];
};


export type QueryPracticeQuizArgs = {
  id: Scalars['String']['input'];
};


export type QueryPublicParticipantProfileArgs = {
  participantId: Scalars['String']['input'];
};


export type QueryQuestionArgs = {
  id: Scalars['Int']['input'];
};


export type QueryRunningSessionsArgs = {
  shortname: Scalars['String']['input'];
};


export type QueryRunningSessionsCourseArgs = {
  courseId: Scalars['String']['input'];
};


export type QuerySessionArgs = {
  id: Scalars['String']['input'];
};


export type QuerySessionEvaluationArgs = {
  hmac?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['String']['input'];
};


export type QuerySessionHmacArgs = {
  id: Scalars['String']['input'];
};


export type QuerySessionLeaderboardArgs = {
  sessionId: Scalars['String']['input'];
};

export type QuestionData = ChoicesQuestionData | ContentQuestionData | FlashcardQuestionData | FreeTextQuestionData | NumericalQuestionData;

export type QuestionFeedback = {
  __typename?: 'QuestionFeedback';
  correct?: Maybe<Scalars['Boolean']['output']>;
  feedback?: Maybe<Scalars['String']['output']>;
  ix: Scalars['Int']['output'];
  value: Scalars['String']['output'];
};

export type QuestionInstance = {
  __typename?: 'QuestionInstance';
  id: Scalars['Int']['output'];
  pointsMultiplier?: Maybe<Scalars['Int']['output']>;
  questionData?: Maybe<QuestionData>;
};

export type QuestionOrElementInstance = {
  __typename?: 'QuestionOrElementInstance';
  elementInstance?: Maybe<ElementInstance>;
  questionInstance?: Maybe<QuestionInstance>;
};

export type QuestionResponse = ChoicesQuestionResponse | ContentQuestionResponse | FlashcardQuestionResponse | OpenQuestionResponse;

export enum ResponseCorrectness {
  Correct = 'CORRECT',
  Partial = 'PARTIAL',
  Wrong = 'WRONG'
}

export enum ResponseCorrectnessType {
  Correct = 'CORRECT',
  Incorrect = 'INCORRECT',
  Partial = 'PARTIAL'
}

export type ResponseInput = {
  choices?: InputMaybe<Array<Scalars['Int']['input']>>;
  value?: InputMaybe<Scalars['String']['input']>;
};

export type RunningLiveQuizSummary = {
  __typename?: 'RunningLiveQuizSummary';
  numOfConfusionFeedbacks: Scalars['Int']['output'];
  numOfFeedbacks: Scalars['Int']['output'];
  numOfLeaderboardEntries: Scalars['Int']['output'];
  numOfResponses: Scalars['Int']['output'];
};

export type Session = {
  __typename?: 'Session';
  accessMode: SessionAccessMode;
  activeBlock?: Maybe<SessionBlock>;
  blocks?: Maybe<Array<SessionBlock>>;
  confusionFeedbacks?: Maybe<Array<ConfusionTimestep>>;
  confusionSummary?: Maybe<ConfusionSummary>;
  course?: Maybe<Course>;
  createdAt: Scalars['Date']['output'];
  description?: Maybe<Scalars['String']['output']>;
  displayName: Scalars['String']['output'];
  feedbacks?: Maybe<Array<Feedback>>;
  finishedAt?: Maybe<Scalars['Date']['output']>;
  id: Scalars['ID']['output'];
  isConfusionFeedbackEnabled: Scalars['Boolean']['output'];
  isGamificationEnabled: Scalars['Boolean']['output'];
  isLiveQAEnabled: Scalars['Boolean']['output'];
  isModerationEnabled: Scalars['Boolean']['output'];
  linkTo?: Maybe<Scalars['String']['output']>;
  linkToJoin?: Maybe<Scalars['String']['output']>;
  maxBonusPoints: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  namespace: Scalars['String']['output'];
  numOfBlocks?: Maybe<Scalars['Int']['output']>;
  numOfQuestions?: Maybe<Scalars['Int']['output']>;
  pinCode?: Maybe<Scalars['Int']['output']>;
  pointsMultiplier: Scalars['Int']['output'];
  startedAt?: Maybe<Scalars['Date']['output']>;
  status: SessionStatus;
  timeToZeroBonus: Scalars['Int']['output'];
  updatedAt?: Maybe<Scalars['Date']['output']>;
};

export enum SessionAccessMode {
  Public = 'PUBLIC',
  Restricted = 'RESTRICTED'
}

export type SessionBlock = {
  __typename?: 'SessionBlock';
  execution?: Maybe<Scalars['Int']['output']>;
  expiresAt?: Maybe<Scalars['Date']['output']>;
  id: Scalars['Int']['output'];
  instances?: Maybe<Array<QuestionInstance>>;
  numOfParticipants?: Maybe<Scalars['Int']['output']>;
  order: Scalars['Int']['output'];
  randomSelection?: Maybe<Scalars['Int']['output']>;
  status: SessionBlockStatus;
  timeLimit?: Maybe<Scalars['Int']['output']>;
};

export enum SessionBlockStatus {
  Active = 'ACTIVE',
  Executed = 'EXECUTED',
  Scheduled = 'SCHEDULED'
}

export type SessionEvaluation = {
  __typename?: 'SessionEvaluation';
  blocks: Array<EvaluationBlock>;
  confusionFeedbacks: Array<ConfusionTimestep>;
  displayName: Scalars['String']['output'];
  feedbacks: Array<Feedback>;
  id: Scalars['String']['output'];
  instanceResults: Array<InstanceResult>;
  isGamificationEnabled: Scalars['Boolean']['output'];
  status: SessionStatus;
};

export enum SessionStatus {
  Completed = 'COMPLETED',
  Prepared = 'PREPARED',
  Running = 'RUNNING',
  Scheduled = 'SCHEDULED'
}

export type SingleQuestionResponseChoices = {
  __typename?: 'SingleQuestionResponseChoices';
  choices: Array<Scalars['Int']['output']>;
};

export type SingleQuestionResponseContent = {
  __typename?: 'SingleQuestionResponseContent';
  viewed: Scalars['Boolean']['output'];
};

export type SingleQuestionResponseFlashcard = {
  __typename?: 'SingleQuestionResponseFlashcard';
  correctness: FlashcardCorrectness;
};

export type SingleQuestionResponseValue = {
  __typename?: 'SingleQuestionResponseValue';
  value: Scalars['String']['output'];
};

export type SolutionRangeInput = {
  max?: InputMaybe<Scalars['Float']['input']>;
  min?: InputMaybe<Scalars['Float']['input']>;
};

export type StackElementsInput = {
  elementId: Scalars['Int']['input'];
  order: Scalars['Int']['input'];
};

export type StackEvaluation = {
  __typename?: 'StackEvaluation';
  instances: Array<ElementInstanceEvaluation>;
  stackDescription?: Maybe<Scalars['String']['output']>;
  stackId: Scalars['Int']['output'];
  stackName?: Maybe<Scalars['String']['output']>;
  stackOrder: Scalars['Int']['output'];
};

export type StackFeedback = {
  __typename?: 'StackFeedback';
  evaluations?: Maybe<Array<InstanceEvaluation>>;
  id: Scalars['Int']['output'];
  score?: Maybe<Scalars['Int']['output']>;
  status: StackFeedbackStatus;
};

export enum StackFeedbackStatus {
  Correct = 'correct',
  Incorrect = 'incorrect',
  ManuallyGraded = 'manuallyGraded',
  Partial = 'partial',
  Unanswered = 'unanswered'
}

export type StackResponseInput = {
  choicesResponse?: InputMaybe<Array<Scalars['Int']['input']>>;
  contentReponse?: InputMaybe<Scalars['Boolean']['input']>;
  flashcardResponse?: InputMaybe<FlashcardCorrectnessType>;
  freeTextResponse?: InputMaybe<Scalars['String']['input']>;
  instanceId: Scalars['Int']['input'];
  numericalResponse?: InputMaybe<Scalars['Float']['input']>;
  type: ElementType;
};

export type Statistics = {
  __typename?: 'Statistics';
  max: Scalars['Float']['output'];
  mean: Scalars['Float']['output'];
  median: Scalars['Float']['output'];
  min: Scalars['Float']['output'];
  q1: Scalars['Float']['output'];
  q3: Scalars['Float']['output'];
  sd: Scalars['Float']['output'];
};

export type StudentCourse = {
  __typename?: 'StudentCourse';
  color: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  displayName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  owner: User;
  pinCode?: Maybe<Scalars['Int']['output']>;
};

export type Subscription = {
  __typename?: 'Subscription';
  feedbackAdded: Feedback;
  feedbackCreated: Feedback;
  feedbackRemoved: Scalars['String']['output'];
  feedbackUpdated: Feedback;
  groupActivityEnded: GroupActivity;
  groupActivityStarted: GroupActivity;
  microLearningEnded: MicroLearning;
  runningSessionUpdated?: Maybe<SessionBlock>;
  singleGroupActivityEnded: GroupActivity;
};


export type SubscriptionFeedbackAddedArgs = {
  sessionId: Scalars['String']['input'];
};


export type SubscriptionFeedbackCreatedArgs = {
  sessionId: Scalars['String']['input'];
};


export type SubscriptionFeedbackRemovedArgs = {
  sessionId: Scalars['String']['input'];
};


export type SubscriptionFeedbackUpdatedArgs = {
  sessionId: Scalars['String']['input'];
};


export type SubscriptionGroupActivityEndedArgs = {
  courseId: Scalars['String']['input'];
};


export type SubscriptionGroupActivityStartedArgs = {
  courseId: Scalars['String']['input'];
};


export type SubscriptionMicroLearningEndedArgs = {
  activityId: Scalars['String']['input'];
};


export type SubscriptionRunningSessionUpdatedArgs = {
  sessionId: Scalars['String']['input'];
};


export type SubscriptionSingleGroupActivityEndedArgs = {
  activityId: Scalars['String']['input'];
};

export type SubscriptionKeysInput = {
  auth: Scalars['String']['input'];
  p256dh: Scalars['String']['input'];
};

export type SubscriptionObjectInput = {
  endpoint: Scalars['String']['input'];
  expirationTime?: InputMaybe<Scalars['Int']['input']>;
  keys: SubscriptionKeysInput;
};

export type TabData = {
  __typename?: 'TabData';
  id: Scalars['String']['output'];
  name: Scalars['String']['output'];
  questionIx?: Maybe<Scalars['Int']['output']>;
  status?: Maybe<Scalars['String']['output']>;
};

export type Tag = {
  __typename?: 'Tag';
  id: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  order: Scalars['Int']['output'];
};

export type Title = {
  __typename?: 'Title';
  id: Scalars['Int']['output'];
};

export type User = {
  __typename?: 'User';
  catalyst: Scalars['Boolean']['output'];
  catalystTier?: Maybe<Scalars['String']['output']>;
  email: Scalars['String']['output'];
  firstLogin: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  locale: LocaleType;
  loginToken?: Maybe<Scalars['String']['output']>;
  loginTokenExpiresAt?: Maybe<Scalars['Date']['output']>;
  mediaFiles?: Maybe<Array<MediaFile>>;
  sendProjectUpdates: Scalars['Boolean']['output'];
  shortname: Scalars['String']['output'];
};

export type UserLogin = {
  __typename?: 'UserLogin';
  id: Scalars['ID']['output'];
  lastLoginAt?: Maybe<Scalars['Date']['output']>;
  name: Scalars['String']['output'];
  scope: UserLoginScope;
  user?: Maybe<User>;
};

export enum UserLoginScope {
  AccountOwner = 'ACCOUNT_OWNER',
  Activation = 'ACTIVATION',
  FullAccess = 'FULL_ACCESS',
  Otp = 'OTP',
  ReadOnly = 'READ_ONLY',
  SessionExec = 'SESSION_EXEC'
}

export type ElementDataFragment = { __typename?: 'ElementInstance', elementData: { __typename: 'ChoicesElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'ChoiceQuestionOptions', hasSampleSolution?: boolean | null, displayMode: ElementDisplayMode, choices: Array<{ __typename?: 'Choice', ix: number, correct?: boolean | null, feedback?: string | null, value: string }> } } | { __typename: 'ContentElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename: 'FlashcardElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename: 'FreeTextElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'FreeTextQuestionOptions', hasSampleSolution?: boolean | null, solutions?: Array<string> | null, restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename: 'NumericalElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'NumericalQuestionOptions', hasSampleSolution?: boolean | null, accuracy?: number | null, placeholder?: string | null, unit?: string | null, restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null, solutionRanges?: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> | null } } };

export type ElementDataWithoutSolutionsFragment = { __typename?: 'ElementInstance', elementData: { __typename: 'ChoicesElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'ChoiceQuestionOptions', displayMode: ElementDisplayMode, choices: Array<{ __typename?: 'Choice', ix: number, value: string }> } } | { __typename: 'ContentElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename?: 'FlashcardElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename: 'FreeTextElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'FreeTextQuestionOptions', restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename: 'NumericalElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'NumericalQuestionOptions', accuracy?: number | null, placeholder?: string | null, unit?: string | null, restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null } } };

export type EvaluationResultsFragment = { __typename?: 'ActivityEvaluation', results: Array<{ __typename?: 'StackEvaluation', stackId: number, stackName?: string | null, stackDescription?: string | null, stackOrder: number, instances: Array<{ __typename: 'ChoicesElementInstanceEvaluation', id: number, type: ElementType, name: string, content: string, explanation?: string | null, hasSampleSolution: boolean, hasAnswerFeedbacks: boolean, results: { __typename?: 'ChoicesElementResults', totalAnswers: number, anonymousAnswers: number, choices: Array<{ __typename?: 'ChoiceElementResults', value: string, count: number, correct?: boolean | null, feedback?: string | null }> } } | { __typename: 'ContentElementInstanceEvaluation', id: number, type: ElementType, name: string, content: string, explanation?: string | null, hasSampleSolution: boolean, hasAnswerFeedbacks: boolean, results: { __typename?: 'ContentElementResults', totalAnswers: number, anonymousAnswers: number } } | { __typename: 'FlashcardElementInstanceEvaluation', id: number, type: ElementType, name: string, content: string, explanation?: string | null, hasSampleSolution: boolean, hasAnswerFeedbacks: boolean, results: { __typename?: 'FlashcardElementResults', totalAnswers: number, anonymousAnswers: number, correctCount: number, partialCount: number, incorrectCount: number } } | { __typename: 'FreeElementInstanceEvaluation', id: number, type: ElementType, name: string, content: string, explanation?: string | null, hasSampleSolution: boolean, hasAnswerFeedbacks: boolean, results: { __typename?: 'FreeElementResults', totalAnswers: number, anonymousAnswers: number, maxLength?: number | null, solutions?: Array<string> | null, responses: Array<{ __typename?: 'FreeElementResult', value: string, correct?: boolean | null, count: number }> } } | { __typename: 'NumericalElementInstanceEvaluation', id: number, type: ElementType, name: string, content: string, explanation?: string | null, hasSampleSolution: boolean, hasAnswerFeedbacks: boolean, results: { __typename?: 'NumericalElementResults', totalAnswers: number, anonymousAnswers: number, maxValue?: number | null, minValue?: number | null, solutionRanges: Array<{ __typename?: 'NumericalElementSolutions', min?: number | null, max?: number | null }>, responseValues: Array<{ __typename?: 'NumericalElementResult', value: number, correct?: boolean | null, count: number }> } }> }> };

export type MicroLearningDataFragment = { __typename?: 'MicroLearning', id: string, name: string, status: PublicationStatus, displayName: string, description?: string | null, pointsMultiplier: number, scheduledStartAt: any, scheduledEndAt: any, course?: { __typename?: 'Course', id: string, displayName: string, color: string } | null, stacks?: Array<{ __typename?: 'ElementStack', id: number, type: ElementStackType, displayName?: string | null, description?: string | null, order?: number | null, elements?: Array<{ __typename?: 'ElementInstance', id: number, type: ElementInstanceType, elementType: ElementType, elementData: { __typename: 'ChoicesElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'ChoiceQuestionOptions', hasSampleSolution?: boolean | null, displayMode: ElementDisplayMode, choices: Array<{ __typename?: 'Choice', ix: number, correct?: boolean | null, feedback?: string | null, value: string }> } } | { __typename: 'ContentElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename: 'FlashcardElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename: 'FreeTextElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'FreeTextQuestionOptions', hasSampleSolution?: boolean | null, solutions?: Array<string> | null, restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename: 'NumericalElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'NumericalQuestionOptions', hasSampleSolution?: boolean | null, accuracy?: number | null, placeholder?: string | null, unit?: string | null, restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null, solutionRanges?: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> | null } } }> | null }> | null };

export type MicroLearningDataWithoutSolutionsFragment = { __typename?: 'MicroLearning', id: string, name: string, status: PublicationStatus, displayName: string, description?: string | null, pointsMultiplier: number, scheduledStartAt: any, scheduledEndAt: any, course?: { __typename?: 'Course', id: string, displayName: string, color: string } | null, stacks?: Array<{ __typename?: 'ElementStack', id: number, type: ElementStackType, displayName?: string | null, description?: string | null, order?: number | null, elements?: Array<{ __typename?: 'ElementInstance', id: number, type: ElementInstanceType, elementType: ElementType, elementData: { __typename: 'ChoicesElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'ChoiceQuestionOptions', displayMode: ElementDisplayMode, choices: Array<{ __typename?: 'Choice', ix: number, value: string }> } } | { __typename: 'ContentElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename?: 'FlashcardElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename: 'FreeTextElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'FreeTextQuestionOptions', restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename: 'NumericalElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'NumericalQuestionOptions', accuracy?: number | null, placeholder?: string | null, unit?: string | null, restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null } } }> | null }> | null };

export type PracticeQuizDataFragment = { __typename?: 'PracticeQuiz', id: string, status: PublicationStatus, name: string, displayName: string, description?: string | null, pointsMultiplier: number, resetTimeDays: number, availableFrom?: any | null, orderType: ElementOrderType, numOfStacks?: number | null, course?: { __typename?: 'Course', id: string, displayName: string, color: string } | null, stacks?: Array<{ __typename?: 'ElementStack', id: number, type: ElementStackType, displayName?: string | null, description?: string | null, order?: number | null, elements?: Array<{ __typename?: 'ElementInstance', id: number, type: ElementInstanceType, elementType: ElementType, elementData: { __typename: 'ChoicesElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'ChoiceQuestionOptions', hasSampleSolution?: boolean | null, displayMode: ElementDisplayMode, choices: Array<{ __typename?: 'Choice', ix: number, correct?: boolean | null, feedback?: string | null, value: string }> } } | { __typename: 'ContentElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename: 'FlashcardElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename: 'FreeTextElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'FreeTextQuestionOptions', hasSampleSolution?: boolean | null, solutions?: Array<string> | null, restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename: 'NumericalElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'NumericalQuestionOptions', hasSampleSolution?: boolean | null, accuracy?: number | null, placeholder?: string | null, unit?: string | null, restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null, solutionRanges?: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> | null } } }> | null }> | null };

export type PracticeQuizDataWithoutSolutionsFragment = { __typename?: 'PracticeQuiz', id: string, status: PublicationStatus, name: string, displayName: string, description?: string | null, pointsMultiplier: number, resetTimeDays: number, availableFrom?: any | null, orderType: ElementOrderType, numOfStacks?: number | null, course?: { __typename?: 'Course', id: string, displayName: string, color: string } | null, stacks?: Array<{ __typename?: 'ElementStack', id: number, type: ElementStackType, displayName?: string | null, description?: string | null, order?: number | null, elements?: Array<{ __typename?: 'ElementInstance', id: number, type: ElementInstanceType, elementType: ElementType, elementData: { __typename: 'ChoicesElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'ChoiceQuestionOptions', displayMode: ElementDisplayMode, choices: Array<{ __typename?: 'Choice', ix: number, value: string }> } } | { __typename: 'ContentElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename?: 'FlashcardElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename: 'FreeTextElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'FreeTextQuestionOptions', restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename: 'NumericalElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'NumericalQuestionOptions', accuracy?: number | null, placeholder?: string | null, unit?: string | null, restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null } } }> | null }> | null };

export type QuestionDataFragment = { __typename?: 'QuestionInstance', questionData?: { __typename: 'ChoicesQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null, options: { __typename?: 'ChoiceQuestionOptions', hasSampleSolution?: boolean | null, hasAnswerFeedbacks?: boolean | null, displayMode: ElementDisplayMode, choices: Array<{ __typename?: 'Choice', ix: number, correct?: boolean | null, feedback?: string | null, value: string }> } } | { __typename?: 'ContentQuestionData' } | { __typename?: 'FlashcardQuestionData' } | { __typename: 'FreeTextQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null, options: { __typename?: 'FreeTextQuestionOptions', hasSampleSolution?: boolean | null, solutions?: Array<string> | null, restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename: 'NumericalQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null, options: { __typename?: 'NumericalQuestionOptions', hasSampleSolution?: boolean | null, accuracy?: number | null, placeholder?: string | null, unit?: string | null, restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null, solutionRanges?: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> | null } } | null };

export type QuestionDataInfoFragment = { __typename?: 'QuestionInstance', questionData?: { __typename: 'ChoicesQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'ContentQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'FlashcardQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'FreeTextQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'NumericalQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | null };

export type QuestionDataWithoutSolutionsFragment = { __typename?: 'QuestionInstance', questionData?: { __typename: 'ChoicesQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null, options: { __typename?: 'ChoiceQuestionOptions', displayMode: ElementDisplayMode, choices: Array<{ __typename?: 'Choice', ix: number, value: string }> } } | { __typename: 'ContentQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'FlashcardQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'FreeTextQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null, options: { __typename?: 'FreeTextQuestionOptions', restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename: 'NumericalQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null, options: { __typename?: 'NumericalQuestionOptions', unit?: string | null, accuracy?: number | null, placeholder?: string | null, restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null } } | null };

export type StackFeedbackEvaluationsFragment = { __typename?: 'StackFeedback', evaluations?: Array<{ __typename: 'ChoicesInstanceEvaluation', elementType: ElementType, instanceId: number, pointsMultiplier: number, explanation?: string | null, choices?: any | null, numAnswers?: number | null, score: number, xp?: number | null, pointsAwarded?: number | null, percentile?: number | null, newPointsFrom?: any | null, xpAwarded?: number | null, newXpFrom?: any | null, correctness?: number | null, feedbacks?: Array<{ __typename?: 'QuestionFeedback', ix: number, feedback?: string | null, correct?: boolean | null, value: string }> | null, lastResponse?: { __typename: 'SingleQuestionResponseChoices', choices: Array<number> } | null } | { __typename: 'ContentInstanceEvaluation', instanceId: number, elementType: ElementType, pointsMultiplier: number, explanation?: string | null, numAnswers?: number | null, score: number, xp?: number | null, pointsAwarded?: number | null, percentile?: number | null, newPointsFrom?: any | null, xpAwarded?: number | null, newXpFrom?: any | null, correctness?: number | null, feedbacks?: Array<{ __typename?: 'QuestionFeedback', ix: number, feedback?: string | null, correct?: boolean | null, value: string }> | null, lastResponse?: { __typename: 'SingleQuestionResponseContent', viewed: boolean } | null } | { __typename: 'FlashcardInstanceEvaluation', instanceId: number, elementType: ElementType, pointsMultiplier: number, explanation?: string | null, numAnswers?: number | null, score: number, xp?: number | null, pointsAwarded?: number | null, percentile?: number | null, newPointsFrom?: any | null, xpAwarded?: number | null, newXpFrom?: any | null, correctness?: number | null, feedbacks?: Array<{ __typename?: 'QuestionFeedback', ix: number, feedback?: string | null, correct?: boolean | null, value: string }> | null, lastResponse?: { __typename: 'SingleQuestionResponseFlashcard', correctness: FlashcardCorrectness } | null } | { __typename: 'FreeTextInstanceEvaluation', instanceId: number, elementType: ElementType, pointsMultiplier: number, explanation?: string | null, numAnswers?: number | null, answers?: any | null, score: number, xp?: number | null, pointsAwarded?: number | null, percentile?: number | null, newPointsFrom?: any | null, xpAwarded?: number | null, newXpFrom?: any | null, solutions?: Array<string> | null, correctness?: number | null, feedbacks?: Array<{ __typename?: 'QuestionFeedback', ix: number, feedback?: string | null, correct?: boolean | null, value: string }> | null, lastResponse?: { __typename: 'SingleQuestionResponseValue', value: string } | null } | { __typename: 'NumericalInstanceEvaluation', elementType: ElementType, instanceId: number, pointsMultiplier: number, explanation?: string | null, numAnswers?: number | null, answers?: any | null, score: number, xp?: number | null, pointsAwarded?: number | null, percentile?: number | null, newPointsFrom?: any | null, xpAwarded?: number | null, newXpFrom?: any | null, correctness?: number | null, feedbacks?: Array<{ __typename?: 'QuestionFeedback', ix: number, feedback?: string | null, correct?: boolean | null, value: string }> | null, solutionRanges?: Array<{ __typename: 'NumericalSolutionRange', min?: number | null, max?: number | null }> | null, lastResponse?: { __typename: 'SingleQuestionResponseValue', value: string } | null }> | null };

export type ActivateParticipantAccountMutationVariables = Exact<{
  token: Scalars['String']['input'];
}>;


export type ActivateParticipantAccountMutation = { __typename?: 'Mutation', activateParticipantAccount?: string | null };

export type ActivateSessionBlockMutationVariables = Exact<{
  sessionId: Scalars['String']['input'];
  sessionBlockId: Scalars['Int']['input'];
}>;


export type ActivateSessionBlockMutation = { __typename?: 'Mutation', activateSessionBlock?: { __typename?: 'Session', id: string, status: SessionStatus, blocks?: Array<{ __typename?: 'SessionBlock', id: number, status: SessionBlockStatus }> | null } | null };

export type AddConfusionTimestepMutationVariables = Exact<{
  sessionId: Scalars['String']['input'];
  difficulty: Scalars['Int']['input'];
  speed: Scalars['Int']['input'];
}>;


export type AddConfusionTimestepMutation = { __typename?: 'Mutation', addConfusionTimestep?: { __typename?: 'ConfusionTimestep', difficulty: number, speed: number } | null };

export type AddMessageToGroupMutationVariables = Exact<{
  groupId: Scalars['String']['input'];
  content: Scalars['String']['input'];
}>;


export type AddMessageToGroupMutation = { __typename?: 'Mutation', addMessageToGroup?: { __typename?: 'GroupMessage', id: number, content: string, createdAt: any, participant: { __typename?: 'Participant', id: string, username: string, avatar?: string | null } } | null };

export type BookmarkElementStackMutationVariables = Exact<{
  stackId: Scalars['Int']['input'];
  courseId: Scalars['String']['input'];
  bookmarked: Scalars['Boolean']['input'];
}>;


export type BookmarkElementStackMutation = { __typename?: 'Mutation', bookmarkElementStack?: Array<number> | null };

export type CancelSessionMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type CancelSessionMutation = { __typename?: 'Mutation', cancelSession?: { __typename?: 'Session', id: string } | null };

export type ChangeEmailSettingsMutationVariables = Exact<{
  projectUpdates: Scalars['Boolean']['input'];
}>;


export type ChangeEmailSettingsMutation = { __typename?: 'Mutation', changeEmailSettings?: { __typename?: 'User', id: string, sendProjectUpdates: boolean } | null };

export type ChangeInitialSettingsMutationVariables = Exact<{
  shortname: Scalars['String']['input'];
  locale: LocaleType;
  sendUpdates: Scalars['Boolean']['input'];
}>;


export type ChangeInitialSettingsMutation = { __typename?: 'Mutation', changeInitialSettings?: { __typename?: 'User', id: string, email: string, shortname: string, locale: LocaleType, firstLogin: boolean, catalyst: boolean, catalystTier?: string | null } | null };

export type ChangeLiveQuizNameMutationVariables = Exact<{
  id: Scalars['String']['input'];
  name: Scalars['String']['input'];
  displayName: Scalars['String']['input'];
}>;


export type ChangeLiveQuizNameMutation = { __typename?: 'Mutation', changeLiveQuizName?: { __typename?: 'Session', id: string, name: string, displayName: string } | null };

export type ChangeParticipantLocaleMutationVariables = Exact<{
  locale: LocaleType;
}>;


export type ChangeParticipantLocaleMutation = { __typename?: 'Mutation', changeParticipantLocale?: { __typename?: 'Participant', id: string, locale: LocaleType } | null };

export type ChangeSessionSettingsMutationVariables = Exact<{
  id: Scalars['String']['input'];
  isLiveQAEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  isConfusionFeedbackEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  isModerationEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  isGamificationEnabled?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type ChangeSessionSettingsMutation = { __typename?: 'Mutation', changeSessionSettings?: { __typename?: 'Session', id: string, isLiveQAEnabled: boolean, isConfusionFeedbackEnabled: boolean, isModerationEnabled: boolean, isGamificationEnabled: boolean } | null };

export type ChangeShortnameMutationVariables = Exact<{
  shortname: Scalars['String']['input'];
}>;


export type ChangeShortnameMutation = { __typename?: 'Mutation', changeShortname?: { __typename?: 'User', id: string, shortname: string } | null };

export type ChangeUserLocaleMutationVariables = Exact<{
  locale: LocaleType;
}>;


export type ChangeUserLocaleMutation = { __typename?: 'Mutation', changeUserLocale?: { __typename?: 'User', id: string, locale: LocaleType } | null };

export type CreateCourseMutationVariables = Exact<{
  name: Scalars['String']['input'];
  displayName: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  color?: InputMaybe<Scalars['String']['input']>;
  startDate: Scalars['Date']['input'];
  endDate: Scalars['Date']['input'];
  isGroupCreationEnabled: Scalars['Boolean']['input'];
  groupDeadlineDate: Scalars['Date']['input'];
  maxGroupSize: Scalars['Int']['input'];
  preferredGroupSize: Scalars['Int']['input'];
  notificationEmail?: InputMaybe<Scalars['String']['input']>;
  isGamificationEnabled: Scalars['Boolean']['input'];
}>;


export type CreateCourseMutation = { __typename?: 'Mutation', createCourse?: { __typename?: 'Course', id: string, name: string, displayName: string, description?: string | null, color: string, startDate: any, endDate: any, isGroupCreationEnabled: boolean, groupDeadlineDate?: any | null, maxGroupSize: number, preferredGroupSize: number, notificationEmail?: string | null, isGamificationEnabled: boolean } | null };

export type CreateFeedbackMutationVariables = Exact<{
  sessionId: Scalars['String']['input'];
  content: Scalars['String']['input'];
}>;


export type CreateFeedbackMutation = { __typename?: 'Mutation', createFeedback?: { __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number } | null };

export type CreateGroupActivityMutationVariables = Exact<{
  name: Scalars['String']['input'];
  displayName: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  courseId: Scalars['String']['input'];
  multiplier: Scalars['Int']['input'];
  startDate: Scalars['Date']['input'];
  endDate: Scalars['Date']['input'];
  clues: Array<GroupActivityClueInput> | GroupActivityClueInput;
  stack: ElementStackInput;
}>;


export type CreateGroupActivityMutation = { __typename?: 'Mutation', createGroupActivity?: { __typename?: 'GroupActivity', id: string, name: string, displayName: string, description?: string | null, scheduledStartAt: any, scheduledEndAt: any, pointsMultiplier?: number | null } | null };

export type CreateMicroLearningMutationVariables = Exact<{
  name: Scalars['String']['input'];
  displayName: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  stacks: Array<ElementStackInput> | ElementStackInput;
  courseId: Scalars['String']['input'];
  multiplier: Scalars['Int']['input'];
  startDate: Scalars['Date']['input'];
  endDate: Scalars['Date']['input'];
}>;


export type CreateMicroLearningMutation = { __typename?: 'Mutation', createMicroLearning?: { __typename?: 'MicroLearning', id: string, name: string, displayName: string, description?: string | null, scheduledStartAt: any, scheduledEndAt: any, pointsMultiplier: number, course?: { __typename?: 'Course', id: string } | null, stacks?: Array<{ __typename?: 'ElementStack', id: number, displayName?: string | null, description?: string | null, elements?: Array<{ __typename?: 'ElementInstance', id: number, elementData: { __typename: 'ChoicesElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'ChoiceQuestionOptions', hasSampleSolution?: boolean | null, displayMode: ElementDisplayMode, choices: Array<{ __typename?: 'Choice', ix: number, correct?: boolean | null, feedback?: string | null, value: string }> } } | { __typename: 'ContentElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename: 'FlashcardElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename: 'FreeTextElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'FreeTextQuestionOptions', hasSampleSolution?: boolean | null, solutions?: Array<string> | null, restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename: 'NumericalElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'NumericalQuestionOptions', hasSampleSolution?: boolean | null, accuracy?: number | null, placeholder?: string | null, unit?: string | null, restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null, solutionRanges?: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> | null } } }> | null }> | null } | null };

export type CreateParticipantAccountMutationVariables = Exact<{
  email: Scalars['String']['input'];
  username: Scalars['String']['input'];
  password: Scalars['String']['input'];
  isProfilePublic: Scalars['Boolean']['input'];
  courseId?: InputMaybe<Scalars['String']['input']>;
  signedLtiData?: InputMaybe<Scalars['String']['input']>;
}>;


export type CreateParticipantAccountMutation = { __typename?: 'Mutation', createParticipantAccount?: { __typename?: 'ParticipantTokenData', participantToken?: string | null, participant?: { __typename?: 'Participant', id: string, email?: string | null, username: string } | null } | null };

export type CreateParticipantGroupMutationVariables = Exact<{
  courseId: Scalars['String']['input'];
  name: Scalars['String']['input'];
}>;


export type CreateParticipantGroupMutation = { __typename?: 'Mutation', createParticipantGroup?: { __typename?: 'ParticipantGroup', id: string, name: string, code: number, participants?: Array<{ __typename?: 'Participant', id: string, username: string }> | null } | null };

export type CreatePracticeQuizMutationVariables = Exact<{
  name: Scalars['String']['input'];
  displayName: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  stacks: Array<ElementStackInput> | ElementStackInput;
  courseId: Scalars['String']['input'];
  multiplier: Scalars['Int']['input'];
  order: ElementOrderType;
  availableFrom?: InputMaybe<Scalars['Date']['input']>;
  resetTimeDays: Scalars['Int']['input'];
}>;


export type CreatePracticeQuizMutation = { __typename?: 'Mutation', createPracticeQuiz?: { __typename?: 'PracticeQuiz', id: string, name: string, displayName: string, description?: string | null, pointsMultiplier: number, resetTimeDays: number, orderType: ElementOrderType, course?: { __typename?: 'Course', id: string } | null, stacks?: Array<{ __typename?: 'ElementStack', id: number, displayName?: string | null, description?: string | null, elements?: Array<{ __typename?: 'ElementInstance', id: number, elementData: { __typename: 'ChoicesElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'ChoiceQuestionOptions', hasSampleSolution?: boolean | null, displayMode: ElementDisplayMode, choices: Array<{ __typename?: 'Choice', ix: number, correct?: boolean | null, feedback?: string | null, value: string }> } } | { __typename: 'ContentElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename: 'FlashcardElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename: 'FreeTextElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'FreeTextQuestionOptions', hasSampleSolution?: boolean | null, solutions?: Array<string> | null, restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename: 'NumericalElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'NumericalQuestionOptions', hasSampleSolution?: boolean | null, accuracy?: number | null, placeholder?: string | null, unit?: string | null, restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null, solutionRanges?: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> | null } } }> | null }> | null } | null };

export type CreateSessionMutationVariables = Exact<{
  name: Scalars['String']['input'];
  displayName: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  blocks: Array<BlockInput> | BlockInput;
  courseId?: InputMaybe<Scalars['String']['input']>;
  multiplier: Scalars['Int']['input'];
  maxBonusPoints: Scalars['Int']['input'];
  timeToZeroBonus: Scalars['Int']['input'];
  isGamificationEnabled: Scalars['Boolean']['input'];
  isConfusionFeedbackEnabled: Scalars['Boolean']['input'];
  isLiveQAEnabled: Scalars['Boolean']['input'];
  isModerationEnabled: Scalars['Boolean']['input'];
}>;


export type CreateSessionMutation = { __typename?: 'Mutation', createSession?: { __typename?: 'Session', id: string, name: string, displayName: string, description?: string | null, pointsMultiplier: number, isGamificationEnabled: boolean, isConfusionFeedbackEnabled: boolean, isLiveQAEnabled: boolean, isModerationEnabled: boolean, blocks?: Array<{ __typename?: 'SessionBlock', id: number, status: SessionBlockStatus, timeLimit?: number | null, instances?: Array<{ __typename?: 'QuestionInstance', id: number, questionData?: { __typename: 'ChoicesQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'ContentQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'FlashcardQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'FreeTextQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'NumericalQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | null }> | null }> | null, course?: { __typename?: 'Course', id: string } | null } | null };

export type CreateUserLoginMutationVariables = Exact<{
  password: Scalars['String']['input'];
  name: Scalars['String']['input'];
  scope: UserLoginScope;
}>;


export type CreateUserLoginMutation = { __typename?: 'Mutation', createUserLogin?: { __typename?: 'UserLogin', id: string, name: string, scope: UserLoginScope, user?: { __typename?: 'User', id: string, shortname: string } | null } | null };

export type DeactivateSessionBlockMutationVariables = Exact<{
  sessionId: Scalars['String']['input'];
  sessionBlockId: Scalars['Int']['input'];
}>;


export type DeactivateSessionBlockMutation = { __typename?: 'Mutation', deactivateSessionBlock?: { __typename?: 'Session', id: string, status: SessionStatus, activeBlock?: { __typename?: 'SessionBlock', id: number } | null, blocks?: Array<{ __typename?: 'SessionBlock', id: number, status: SessionBlockStatus }> | null } | null };

export type DeleteCourseMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DeleteCourseMutation = { __typename?: 'Mutation', deleteCourse?: { __typename?: 'Course', id: string } | null };

export type DeleteFeedbackMutationVariables = Exact<{
  id: Scalars['Int']['input'];
}>;


export type DeleteFeedbackMutation = { __typename?: 'Mutation', deleteFeedback?: { __typename?: 'Feedback', id: number } | null };

export type DeleteFeedbackResponseMutationVariables = Exact<{
  id: Scalars['Int']['input'];
}>;


export type DeleteFeedbackResponseMutation = { __typename?: 'Mutation', deleteFeedbackResponse?: { __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number, createdAt: any, resolvedAt?: any | null, responses?: Array<{ __typename?: 'FeedbackResponse', id: number, content: string, positiveReactions: number, negativeReactions: number }> | null } | null };

export type DeleteGroupActivityMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DeleteGroupActivityMutation = { __typename?: 'Mutation', deleteGroupActivity?: { __typename?: 'GroupActivity', id: string } | null };

export type DeleteLiveQuizMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DeleteLiveQuizMutation = { __typename?: 'Mutation', deleteLiveQuiz?: { __typename?: 'Session', id: string } | null };

export type DeleteMicroLearningMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DeleteMicroLearningMutation = { __typename?: 'Mutation', deleteMicroLearning?: { __typename?: 'MicroLearning', id: string } | null };

export type DeleteParticipantAccountMutationVariables = Exact<{ [key: string]: never; }>;


export type DeleteParticipantAccountMutation = { __typename?: 'Mutation', deleteParticipantAccount?: boolean | null };

export type DeletePracticeQuizMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DeletePracticeQuizMutation = { __typename?: 'Mutation', deletePracticeQuiz?: { __typename?: 'PracticeQuiz', id: string } | null };

export type DeleteQuestionMutationVariables = Exact<{
  id: Scalars['Int']['input'];
}>;


export type DeleteQuestionMutation = { __typename?: 'Mutation', deleteQuestion?: { __typename?: 'ChoicesElement', id: number } | { __typename?: 'ContentElement', id: number } | { __typename?: 'FlashcardElement', id: number } | { __typename?: 'FreeTextElement', id: number } | { __typename?: 'NumericalElement', id: number } | null };

export type DeleteTagMutationVariables = Exact<{
  id: Scalars['Int']['input'];
}>;


export type DeleteTagMutation = { __typename?: 'Mutation', deleteTag?: { __typename?: 'Tag', id: number } | null };

export type DeleteUserLoginMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type DeleteUserLoginMutation = { __typename?: 'Mutation', deleteUserLogin?: { __typename?: 'UserLogin', id: string } | null };

export type EditGroupActivityMutationVariables = Exact<{
  id: Scalars['String']['input'];
  name: Scalars['String']['input'];
  displayName: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  courseId: Scalars['String']['input'];
  multiplier: Scalars['Int']['input'];
  startDate: Scalars['Date']['input'];
  endDate: Scalars['Date']['input'];
  clues: Array<GroupActivityClueInput> | GroupActivityClueInput;
  stack: ElementStackInput;
}>;


export type EditGroupActivityMutation = { __typename?: 'Mutation', editGroupActivity?: { __typename?: 'GroupActivity', id: string, name: string, displayName: string, description?: string | null, scheduledStartAt: any, scheduledEndAt: any, pointsMultiplier?: number | null } | null };

export type EditMicroLearningMutationVariables = Exact<{
  id: Scalars['String']['input'];
  name: Scalars['String']['input'];
  displayName: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  stacks: Array<ElementStackInput> | ElementStackInput;
  courseId: Scalars['String']['input'];
  multiplier: Scalars['Int']['input'];
  startDate: Scalars['Date']['input'];
  endDate: Scalars['Date']['input'];
}>;


export type EditMicroLearningMutation = { __typename?: 'Mutation', editMicroLearning?: { __typename?: 'MicroLearning', id: string, name: string, displayName: string, description?: string | null, scheduledStartAt: any, scheduledEndAt: any, pointsMultiplier: number, course?: { __typename?: 'Course', id: string } | null, stacks?: Array<{ __typename?: 'ElementStack', id: number, displayName?: string | null, description?: string | null, elements?: Array<{ __typename?: 'ElementInstance', id: number, elementData: { __typename: 'ChoicesElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'ChoiceQuestionOptions', hasSampleSolution?: boolean | null, displayMode: ElementDisplayMode, choices: Array<{ __typename?: 'Choice', ix: number, correct?: boolean | null, feedback?: string | null, value: string }> } } | { __typename: 'ContentElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename: 'FlashcardElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename: 'FreeTextElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'FreeTextQuestionOptions', hasSampleSolution?: boolean | null, solutions?: Array<string> | null, restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename: 'NumericalElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'NumericalQuestionOptions', hasSampleSolution?: boolean | null, accuracy?: number | null, placeholder?: string | null, unit?: string | null, restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null, solutionRanges?: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> | null } } }> | null }> | null } | null };

export type EditPracticeQuizMutationVariables = Exact<{
  id: Scalars['String']['input'];
  name: Scalars['String']['input'];
  displayName: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  stacks: Array<ElementStackInput> | ElementStackInput;
  courseId: Scalars['String']['input'];
  multiplier: Scalars['Int']['input'];
  order: ElementOrderType;
  availableFrom?: InputMaybe<Scalars['Date']['input']>;
  resetTimeDays: Scalars['Int']['input'];
}>;


export type EditPracticeQuizMutation = { __typename?: 'Mutation', editPracticeQuiz?: { __typename?: 'PracticeQuiz', id: string, name: string, displayName: string, description?: string | null, pointsMultiplier: number, resetTimeDays: number, orderType: ElementOrderType, course?: { __typename?: 'Course', id: string } | null, stacks?: Array<{ __typename?: 'ElementStack', id: number, displayName?: string | null, description?: string | null, order?: number | null, elements?: Array<{ __typename?: 'ElementInstance', id: number, elementData: { __typename: 'ChoicesElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'ChoiceQuestionOptions', hasSampleSolution?: boolean | null, displayMode: ElementDisplayMode, choices: Array<{ __typename?: 'Choice', ix: number, correct?: boolean | null, feedback?: string | null, value: string }> } } | { __typename: 'ContentElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename: 'FlashcardElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename: 'FreeTextElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'FreeTextQuestionOptions', hasSampleSolution?: boolean | null, solutions?: Array<string> | null, restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename: 'NumericalElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'NumericalQuestionOptions', hasSampleSolution?: boolean | null, accuracy?: number | null, placeholder?: string | null, unit?: string | null, restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null, solutionRanges?: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> | null } } }> | null }> | null } | null };

export type EditSessionMutationVariables = Exact<{
  id: Scalars['String']['input'];
  name: Scalars['String']['input'];
  displayName: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  blocks: Array<BlockInput> | BlockInput;
  courseId?: InputMaybe<Scalars['String']['input']>;
  multiplier: Scalars['Int']['input'];
  maxBonusPoints: Scalars['Int']['input'];
  timeToZeroBonus: Scalars['Int']['input'];
  isGamificationEnabled: Scalars['Boolean']['input'];
  isConfusionFeedbackEnabled: Scalars['Boolean']['input'];
  isLiveQAEnabled: Scalars['Boolean']['input'];
  isModerationEnabled: Scalars['Boolean']['input'];
}>;


export type EditSessionMutation = { __typename?: 'Mutation', editSession?: { __typename?: 'Session', id: string, name: string, displayName: string, description?: string | null, pointsMultiplier: number, isGamificationEnabled: boolean, isConfusionFeedbackEnabled: boolean, isLiveQAEnabled: boolean, isModerationEnabled: boolean, blocks?: Array<{ __typename?: 'SessionBlock', id: number, status: SessionBlockStatus, timeLimit?: number | null, instances?: Array<{ __typename?: 'QuestionInstance', id: number, questionData?: { __typename: 'ChoicesQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'ContentQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'FlashcardQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'FreeTextQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'NumericalQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | null }> | null }> | null, course?: { __typename?: 'Course', id: string } | null } | null };

export type EditTagMutationVariables = Exact<{
  id: Scalars['Int']['input'];
  name: Scalars['String']['input'];
}>;


export type EditTagMutation = { __typename?: 'Mutation', editTag?: { __typename?: 'Tag', id: number, name: string } | null };

export type EnableCourseGamificationMutationVariables = Exact<{
  courseId: Scalars['String']['input'];
}>;


export type EnableCourseGamificationMutation = { __typename?: 'Mutation', enableCourseGamification?: { __typename?: 'Course', id: string, isGamificationEnabled: boolean } | null };

export type EndGroupActivityMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type EndGroupActivityMutation = { __typename?: 'Mutation', endGroupActivity?: { __typename?: 'GroupActivity', id: string, status: GroupActivityStatus, scheduledEndAt: any } | null };

export type EndMicroLearningMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type EndMicroLearningMutation = { __typename?: 'Mutation', endMicroLearning?: { __typename?: 'MicroLearning', id: string, scheduledEndAt: any } | null };

export type EndSessionMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type EndSessionMutation = { __typename?: 'Mutation', endSession?: { __typename?: 'Session', id: string, status: SessionStatus } | null };

export type ExtendGroupActivityMutationVariables = Exact<{
  id: Scalars['String']['input'];
  endDate: Scalars['Date']['input'];
}>;


export type ExtendGroupActivityMutation = { __typename?: 'Mutation', extendGroupActivity?: { __typename?: 'GroupActivity', id: string, scheduledEndAt: any } | null };

export type ExtendMicroLearningMutationVariables = Exact<{
  id: Scalars['String']['input'];
  endDate: Scalars['Date']['input'];
}>;


export type ExtendMicroLearningMutation = { __typename?: 'Mutation', extendMicroLearning?: { __typename?: 'MicroLearning', id: string, scheduledEndAt: any } | null };

export type FinalRandomGroupAssignmentsMutationVariables = Exact<{ [key: string]: never; }>;


export type FinalRandomGroupAssignmentsMutation = { __typename?: 'Mutation', finalRandomGroupAssignments: boolean };

export type FinalizeGroupActivityGradingMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type FinalizeGroupActivityGradingMutation = { __typename?: 'Mutation', finalizeGroupActivityGrading?: { __typename?: 'GroupActivity', id: string, status: GroupActivityStatus } | null };

export type FlagElementMutationVariables = Exact<{
  elementInstanceId: Scalars['Int']['input'];
  elementId: Scalars['Int']['input'];
  content: Scalars['String']['input'];
}>;


export type FlagElementMutation = { __typename?: 'Mutation', flagElement?: { __typename?: 'ElementFeedback', id: number, upvote: boolean, downvote: boolean, feedback?: string | null } | null };

export type GenerateLoginTokenMutationVariables = Exact<{ [key: string]: never; }>;


export type GenerateLoginTokenMutation = { __typename?: 'Mutation', generateLoginToken?: { __typename?: 'User', id: string, loginToken?: string | null, loginTokenExpiresAt?: any | null } | null };

export type GetFileUploadSasMutationVariables = Exact<{
  fileName: Scalars['String']['input'];
  contentType: Scalars['String']['input'];
}>;


export type GetFileUploadSasMutation = { __typename?: 'Mutation', getFileUploadSas?: { __typename?: 'FileUploadSAS', uploadSasURL: string, uploadHref: string, containerName: string, fileName: string } | null };

export type GradeGroupActivitySubmissionMutationVariables = Exact<{
  id: Scalars['Int']['input'];
  gradingDecisions: GroupActivityGradingInput;
}>;


export type GradeGroupActivitySubmissionMutation = { __typename?: 'Mutation', gradeGroupActivitySubmission?: { __typename?: 'GroupActivityInstance', id: number, decisionsSubmittedAt?: any | null, resultsComputedAt?: any | null, decisions?: Array<{ __typename?: 'GroupActivityDecision', instanceId: number, type: ElementType, freeTextResponse?: string | null, choicesResponse?: Array<number> | null, numericalResponse?: number | null, contentResponse?: boolean | null }> | null, results?: { __typename?: 'GroupActivityResults', passed: boolean, points: number, comment?: string | null, grading: Array<{ __typename?: 'GroupActivityGrading', instanceId: number, score: number, maxPoints: number, feedback?: string | null }> } | null } | null };

export type JoinCourseMutationVariables = Exact<{
  courseId: Scalars['String']['input'];
}>;


export type JoinCourseMutation = { __typename?: 'Mutation', joinCourse?: { __typename?: 'ParticipantLearningData', id: string, participation?: { __typename?: 'Participation', id: number, isActive: boolean } | null } | null };

export type JoinCourseWithPinMutationVariables = Exact<{
  pin: Scalars['Int']['input'];
}>;


export type JoinCourseWithPinMutation = { __typename?: 'Mutation', joinCourseWithPin?: { __typename?: 'Participant', id: string } | null };

export type JoinParticipantGroupMutationVariables = Exact<{
  courseId: Scalars['String']['input'];
  code: Scalars['Int']['input'];
}>;


export type JoinParticipantGroupMutation = { __typename?: 'Mutation', joinParticipantGroup?: string | null };

export type JoinRandomCourseGroupPoolMutationVariables = Exact<{
  courseId: Scalars['String']['input'];
}>;


export type JoinRandomCourseGroupPoolMutation = { __typename?: 'Mutation', joinRandomCourseGroupPool: boolean };

export type LeaveCourseMutationVariables = Exact<{
  courseId: Scalars['String']['input'];
}>;


export type LeaveCourseMutation = { __typename?: 'Mutation', leaveCourse?: { __typename?: 'LeaveCourseParticipation', id: string, participation: { __typename?: 'Participation', id: number, isActive: boolean } } | null };

export type LeaveParticipantGroupMutationVariables = Exact<{
  groupId: Scalars['String']['input'];
  courseId: Scalars['String']['input'];
}>;


export type LeaveParticipantGroupMutation = { __typename?: 'Mutation', leaveParticipantGroup?: { __typename?: 'ParticipantGroup', id: string, name: string, code: number, participants?: Array<{ __typename?: 'Participant', id: string, username: string }> | null } | null };

export type LeaveRandomCourseGroupPoolMutationVariables = Exact<{
  courseId: Scalars['String']['input'];
}>;


export type LeaveRandomCourseGroupPoolMutation = { __typename?: 'Mutation', leaveRandomCourseGroupPool: boolean };

export type LoginParticipantMutationVariables = Exact<{
  usernameOrEmail: Scalars['String']['input'];
  password: Scalars['String']['input'];
}>;


export type LoginParticipantMutation = { __typename?: 'Mutation', loginParticipant?: string | null };

export type LoginParticipantMagicLinkMutationVariables = Exact<{
  token: Scalars['String']['input'];
}>;


export type LoginParticipantMagicLinkMutation = { __typename?: 'Mutation', loginParticipantMagicLink?: string | null };

export type LoginParticipantWithLtiMutationVariables = Exact<{
  signedLtiData: Scalars['String']['input'];
  courseId?: InputMaybe<Scalars['String']['input']>;
}>;


export type LoginParticipantWithLtiMutation = { __typename?: 'Mutation', loginParticipantWithLti?: { __typename?: 'ParticipantTokenData', participantToken?: string | null, participant?: { __typename?: 'Participant', id: string } | null } | null };

export type LoginUserTokenMutationVariables = Exact<{
  shortname: Scalars['String']['input'];
  token: Scalars['String']['input'];
}>;


export type LoginUserTokenMutation = { __typename?: 'Mutation', loginUserToken?: string | null };

export type LogoutParticipantMutationVariables = Exact<{ [key: string]: never; }>;


export type LogoutParticipantMutation = { __typename?: 'Mutation', logoutParticipant?: string | null };

export type LogoutUserMutationVariables = Exact<{ [key: string]: never; }>;


export type LogoutUserMutation = { __typename?: 'Mutation', logoutUser?: string | null };

export type ManipulateChoicesQuestionMutationVariables = Exact<{
  id?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<ElementStatus>;
  type: ElementType;
  name?: InputMaybe<Scalars['String']['input']>;
  content?: InputMaybe<Scalars['String']['input']>;
  explanation?: InputMaybe<Scalars['String']['input']>;
  options?: InputMaybe<OptionsChoicesInput>;
  pointsMultiplier?: InputMaybe<Scalars['Int']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']> | Scalars['String']['input']>;
}>;


export type ManipulateChoicesQuestionMutation = { __typename?: 'Mutation', manipulateChoicesQuestion?: { __typename: 'ChoicesElement', id: number, name: string, status: ElementStatus, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'ChoiceQuestionOptions', displayMode: ElementDisplayMode, hasSampleSolution?: boolean | null, hasAnswerFeedbacks?: boolean | null, choices: Array<{ __typename?: 'Choice', ix: number, correct?: boolean | null, feedback?: string | null, value: string }> }, tags?: Array<{ __typename?: 'Tag', id: number, name: string }> | null } | { __typename: 'ContentElement' } | { __typename: 'FlashcardElement' } | { __typename: 'FreeTextElement' } | { __typename: 'NumericalElement' } | null };

export type ManipulateContentElementMutationVariables = Exact<{
  id?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<ElementStatus>;
  name?: InputMaybe<Scalars['String']['input']>;
  content?: InputMaybe<Scalars['String']['input']>;
  pointsMultiplier?: InputMaybe<Scalars['Int']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']> | Scalars['String']['input']>;
}>;


export type ManipulateContentElementMutation = { __typename?: 'Mutation', manipulateContentElement?: { __typename: 'ChoicesElement' } | { __typename: 'ContentElement', id: number, name: string, status: ElementStatus, type: ElementType, content: string, pointsMultiplier: number, tags?: Array<{ __typename?: 'Tag', id: number, name: string }> | null } | { __typename: 'FlashcardElement' } | { __typename: 'FreeTextElement' } | { __typename: 'NumericalElement' } | null };

export type ManipulateFlashcardElementMutationVariables = Exact<{
  id?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<ElementStatus>;
  name?: InputMaybe<Scalars['String']['input']>;
  content?: InputMaybe<Scalars['String']['input']>;
  explanation?: InputMaybe<Scalars['String']['input']>;
  pointsMultiplier?: InputMaybe<Scalars['Int']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']> | Scalars['String']['input']>;
}>;


export type ManipulateFlashcardElementMutation = { __typename?: 'Mutation', manipulateFlashcardElement?: { __typename: 'ChoicesElement' } | { __typename: 'ContentElement' } | { __typename: 'FlashcardElement', id: number, name: string, status: ElementStatus, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, tags?: Array<{ __typename?: 'Tag', id: number, name: string }> | null } | { __typename: 'FreeTextElement' } | { __typename: 'NumericalElement' } | null };

export type ManipulateFreeTextQuestionMutationVariables = Exact<{
  id?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<ElementStatus>;
  name?: InputMaybe<Scalars['String']['input']>;
  content?: InputMaybe<Scalars['String']['input']>;
  explanation?: InputMaybe<Scalars['String']['input']>;
  options?: InputMaybe<OptionsFreeTextInput>;
  pointsMultiplier?: InputMaybe<Scalars['Int']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']> | Scalars['String']['input']>;
}>;


export type ManipulateFreeTextQuestionMutation = { __typename?: 'Mutation', manipulateFreeTextQuestion?: { __typename: 'ChoicesElement' } | { __typename: 'ContentElement' } | { __typename: 'FlashcardElement' } | { __typename: 'FreeTextElement', id: number, name: string, status: ElementStatus, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'FreeTextQuestionOptions', hasSampleSolution?: boolean | null, solutions?: Array<string> | null, restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null }, tags?: Array<{ __typename?: 'Tag', id: number, name: string }> | null } | { __typename: 'NumericalElement' } | null };

export type ManipulateNumericalQuestionMutationVariables = Exact<{
  id?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<ElementStatus>;
  name?: InputMaybe<Scalars['String']['input']>;
  content?: InputMaybe<Scalars['String']['input']>;
  explanation?: InputMaybe<Scalars['String']['input']>;
  options?: InputMaybe<OptionsNumericalInput>;
  pointsMultiplier?: InputMaybe<Scalars['Int']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']> | Scalars['String']['input']>;
}>;


export type ManipulateNumericalQuestionMutation = { __typename?: 'Mutation', manipulateNumericalQuestion?: { __typename: 'ChoicesElement' } | { __typename: 'ContentElement' } | { __typename: 'FlashcardElement' } | { __typename: 'FreeTextElement' } | { __typename: 'NumericalElement', id: number, name: string, status: ElementStatus, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'NumericalQuestionOptions', hasSampleSolution?: boolean | null, accuracy?: number | null, placeholder?: string | null, unit?: string | null, restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null, solutionRanges?: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> | null }, tags?: Array<{ __typename?: 'Tag', id: number, name: string }> | null } | null };

export type ManualRandomGroupAssignmentsMutationVariables = Exact<{
  courseId: Scalars['String']['input'];
}>;


export type ManualRandomGroupAssignmentsMutation = { __typename?: 'Mutation', manualRandomGroupAssignments?: { __typename?: 'Course', id: string, displayName: string, groupDeadlineDate?: any | null, randomAssignmentFinalized: boolean, participantGroups?: Array<{ __typename?: 'ParticipantGroup', id: string, name: string, code: number, averageMemberScore: number, groupActivityScore: number, participants?: Array<{ __typename?: 'Participant', id: string, username: string, score?: number | null, email?: string | null, avatar?: string | null }> | null }> | null } | null };

export type MarkMicroLearningCompletedMutationVariables = Exact<{
  courseId: Scalars['String']['input'];
  id: Scalars['String']['input'];
}>;


export type MarkMicroLearningCompletedMutation = { __typename?: 'Mutation', markMicroLearningCompleted?: { __typename?: 'Participation', id: number, completedMicroLearnings: Array<string> } | null };

export type OpenGroupActivityMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type OpenGroupActivityMutation = { __typename?: 'Mutation', openGroupActivity?: { __typename?: 'GroupActivity', id: string, status: GroupActivityStatus, scheduledStartAt: any } | null };

export type PinFeedbackMutationVariables = Exact<{
  id: Scalars['Int']['input'];
  isPinned: Scalars['Boolean']['input'];
}>;


export type PinFeedbackMutation = { __typename?: 'Mutation', pinFeedback?: { __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number } | null };

export type PublishFeedbackMutationVariables = Exact<{
  id: Scalars['Int']['input'];
  isPublished: Scalars['Boolean']['input'];
}>;


export type PublishFeedbackMutation = { __typename?: 'Mutation', publishFeedback?: { __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number } | null };

export type PublishGroupActivityMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type PublishGroupActivityMutation = { __typename?: 'Mutation', publishGroupActivity?: { __typename?: 'GroupActivity', id: string, name: string, displayName: string, status: GroupActivityStatus } | null };

export type PublishMicroLearningMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type PublishMicroLearningMutation = { __typename?: 'Mutation', publishMicroLearning?: { __typename?: 'MicroLearning', id: string, name: string, displayName: string, status: PublicationStatus } | null };

export type PublishPracticeQuizMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type PublishPracticeQuizMutation = { __typename?: 'Mutation', publishPracticeQuiz?: { __typename?: 'PracticeQuiz', id: string, name: string, displayName: string, status: PublicationStatus } | null };

export type RateElementMutationVariables = Exact<{
  elementInstanceId: Scalars['Int']['input'];
  elementId: Scalars['Int']['input'];
  rating: Scalars['Int']['input'];
}>;


export type RateElementMutation = { __typename?: 'Mutation', rateElement?: { __typename?: 'ElementFeedback', id: number, upvote: boolean, downvote: boolean, feedback?: string | null } | null };

export type RenameParticipantGroupMutationVariables = Exact<{
  groupId: Scalars['String']['input'];
  name: Scalars['String']['input'];
}>;


export type RenameParticipantGroupMutation = { __typename?: 'Mutation', renameParticipantGroup?: { __typename?: 'ParticipantGroup', id: string, name: string } | null };

export type RequestMigrationTokenMutationVariables = Exact<{
  email: Scalars['String']['input'];
}>;


export type RequestMigrationTokenMutation = { __typename?: 'Mutation', requestMigrationToken?: boolean | null };

export type ResolveFeedbackMutationVariables = Exact<{
  id: Scalars['Int']['input'];
  isResolved: Scalars['Boolean']['input'];
}>;


export type ResolveFeedbackMutation = { __typename?: 'Mutation', resolveFeedback?: { __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number } | null };

export type RespondToElementStackMutationVariables = Exact<{
  stackId: Scalars['Int']['input'];
  courseId: Scalars['String']['input'];
  responses: Array<StackResponseInput> | StackResponseInput;
  stackAnswerTime: Scalars['Int']['input'];
}>;


export type RespondToElementStackMutation = { __typename?: 'Mutation', respondToElementStack?: { __typename?: 'StackFeedback', id: number, status: StackFeedbackStatus, score?: number | null, evaluations?: Array<{ __typename: 'ChoicesInstanceEvaluation', elementType: ElementType, instanceId: number, pointsMultiplier: number, explanation?: string | null, choices?: any | null, numAnswers?: number | null, score: number, xp?: number | null, pointsAwarded?: number | null, percentile?: number | null, newPointsFrom?: any | null, xpAwarded?: number | null, newXpFrom?: any | null, correctness?: number | null, feedbacks?: Array<{ __typename?: 'QuestionFeedback', ix: number, feedback?: string | null, correct?: boolean | null, value: string }> | null, lastResponse?: { __typename: 'SingleQuestionResponseChoices', choices: Array<number> } | null } | { __typename: 'ContentInstanceEvaluation', instanceId: number, elementType: ElementType, pointsMultiplier: number, explanation?: string | null, numAnswers?: number | null, score: number, xp?: number | null, pointsAwarded?: number | null, percentile?: number | null, newPointsFrom?: any | null, xpAwarded?: number | null, newXpFrom?: any | null, correctness?: number | null, feedbacks?: Array<{ __typename?: 'QuestionFeedback', ix: number, feedback?: string | null, correct?: boolean | null, value: string }> | null, lastResponse?: { __typename: 'SingleQuestionResponseContent', viewed: boolean } | null } | { __typename: 'FlashcardInstanceEvaluation', instanceId: number, elementType: ElementType, pointsMultiplier: number, explanation?: string | null, numAnswers?: number | null, score: number, xp?: number | null, pointsAwarded?: number | null, percentile?: number | null, newPointsFrom?: any | null, xpAwarded?: number | null, newXpFrom?: any | null, correctness?: number | null, feedbacks?: Array<{ __typename?: 'QuestionFeedback', ix: number, feedback?: string | null, correct?: boolean | null, value: string }> | null, lastResponse?: { __typename: 'SingleQuestionResponseFlashcard', correctness: FlashcardCorrectness } | null } | { __typename: 'FreeTextInstanceEvaluation', instanceId: number, elementType: ElementType, pointsMultiplier: number, explanation?: string | null, numAnswers?: number | null, answers?: any | null, score: number, xp?: number | null, pointsAwarded?: number | null, percentile?: number | null, newPointsFrom?: any | null, xpAwarded?: number | null, newXpFrom?: any | null, solutions?: Array<string> | null, correctness?: number | null, feedbacks?: Array<{ __typename?: 'QuestionFeedback', ix: number, feedback?: string | null, correct?: boolean | null, value: string }> | null, lastResponse?: { __typename: 'SingleQuestionResponseValue', value: string } | null } | { __typename: 'NumericalInstanceEvaluation', elementType: ElementType, instanceId: number, pointsMultiplier: number, explanation?: string | null, numAnswers?: number | null, answers?: any | null, score: number, xp?: number | null, pointsAwarded?: number | null, percentile?: number | null, newPointsFrom?: any | null, xpAwarded?: number | null, newXpFrom?: any | null, correctness?: number | null, feedbacks?: Array<{ __typename?: 'QuestionFeedback', ix: number, feedback?: string | null, correct?: boolean | null, value: string }> | null, solutionRanges?: Array<{ __typename: 'NumericalSolutionRange', min?: number | null, max?: number | null }> | null, lastResponse?: { __typename: 'SingleQuestionResponseValue', value: string } | null }> | null } | null };

export type RespondToFeedbackMutationVariables = Exact<{
  id: Scalars['Int']['input'];
  responseContent: Scalars['String']['input'];
}>;


export type RespondToFeedbackMutation = { __typename?: 'Mutation', respondToFeedback?: { __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number, resolvedAt?: any | null, createdAt: any, responses?: Array<{ __typename?: 'FeedbackResponse', id: number, content: string, positiveReactions: number, negativeReactions: number }> | null } | null };

export type RunningRandomGroupAssignmentsMutationVariables = Exact<{ [key: string]: never; }>;


export type RunningRandomGroupAssignmentsMutation = { __typename?: 'Mutation', runningRandomGroupAssignments: boolean };

export type SendMagicLinkMutationVariables = Exact<{
  usernameOrEmail: Scalars['String']['input'];
}>;


export type SendMagicLinkMutation = { __typename?: 'Mutation', sendMagicLink?: boolean | null };

export type SendPushNotificationsMutationVariables = Exact<{ [key: string]: never; }>;


export type SendPushNotificationsMutation = { __typename?: 'Mutation', sendPushNotifications: boolean };

export type StartGroupActivityMutationVariables = Exact<{
  activityId: Scalars['String']['input'];
  groupId: Scalars['String']['input'];
}>;


export type StartGroupActivityMutation = { __typename?: 'Mutation', startGroupActivity?: { __typename?: 'GroupActivityDetails', id: string } | null };

export type StartSessionMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type StartSessionMutation = { __typename?: 'Mutation', startSession?: { __typename?: 'Session', id: string, status: SessionStatus } | null };

export type SubmitGroupActivityDecisionsMutationVariables = Exact<{
  activityId: Scalars['Int']['input'];
  responses: Array<StackResponseInput> | StackResponseInput;
}>;


export type SubmitGroupActivityDecisionsMutation = { __typename?: 'Mutation', submitGroupActivityDecisions?: number | null };

export type SubscribeToPushMutationVariables = Exact<{
  courseId: Scalars['String']['input'];
  subscriptionObject: SubscriptionObjectInput;
}>;


export type SubscribeToPushMutation = { __typename?: 'Mutation', subscribeToPush?: { __typename?: 'Participation', id: number, subscriptions?: Array<{ __typename?: 'PushSubscription', id: number, endpoint: string }> | null } | null };

export type ToggleArchiveCourseMutationVariables = Exact<{
  id: Scalars['String']['input'];
  isArchived: Scalars['Boolean']['input'];
}>;


export type ToggleArchiveCourseMutation = { __typename?: 'Mutation', toggleArchiveCourse?: { __typename?: 'Course', id: string, isArchived: boolean } | null };

export type ToggleIsArchivedMutationVariables = Exact<{
  questionIds: Array<Scalars['Int']['input']> | Scalars['Int']['input'];
  isArchived: Scalars['Boolean']['input'];
}>;


export type ToggleIsArchivedMutation = { __typename?: 'Mutation', toggleIsArchived?: Array<{ __typename: 'ArchivedElement', id: number, isArchived: boolean }> | null };

export type TriggerMigrationMutationVariables = Exact<{
  token: Scalars['String']['input'];
}>;


export type TriggerMigrationMutation = { __typename?: 'Mutation', triggerMigration?: boolean | null };

export type UnpublishGroupActivityMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type UnpublishGroupActivityMutation = { __typename?: 'Mutation', unpublishGroupActivity?: { __typename?: 'GroupActivity', id: string, name: string, displayName: string, status: GroupActivityStatus } | null };

export type UnpublishMicroLearningMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type UnpublishMicroLearningMutation = { __typename?: 'Mutation', unpublishMicroLearning?: { __typename?: 'MicroLearning', id: string, name: string, displayName: string, status: PublicationStatus, numOfStacks?: number | null } | null };

export type UnpublishPracticeQuizMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type UnpublishPracticeQuizMutation = { __typename?: 'Mutation', unpublishPracticeQuiz?: { __typename?: 'PracticeQuiz', id: string, name: string, displayName: string, status: PublicationStatus, numOfStacks?: number | null } | null };

export type UnsubscribeFromPushMutationVariables = Exact<{
  courseId: Scalars['String']['input'];
  endpoint: Scalars['String']['input'];
}>;


export type UnsubscribeFromPushMutation = { __typename?: 'Mutation', unsubscribeFromPush?: boolean | null };

export type UpdateCourseSettingsMutationVariables = Exact<{
  id: Scalars['String']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  displayName?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  color?: InputMaybe<Scalars['String']['input']>;
  startDate?: InputMaybe<Scalars['Date']['input']>;
  endDate?: InputMaybe<Scalars['Date']['input']>;
  isGroupCreationEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  groupDeadlineDate?: InputMaybe<Scalars['Date']['input']>;
  notificationEmail?: InputMaybe<Scalars['String']['input']>;
  isGamificationEnabled?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type UpdateCourseSettingsMutation = { __typename?: 'Mutation', updateCourseSettings?: { __typename?: 'Course', id: string, name: string, displayName: string, description?: string | null, color: string, startDate: any, endDate: any, isGroupCreationEnabled: boolean, groupDeadlineDate?: any | null, notificationEmail?: string | null, isGamificationEnabled: boolean } | null };

export type UpdateGroupAverageScoresMutationVariables = Exact<{ [key: string]: never; }>;


export type UpdateGroupAverageScoresMutation = { __typename?: 'Mutation', updateGroupAverageScores: boolean };

export type UpdateParticipantProfileMutationVariables = Exact<{
  username: Scalars['String']['input'];
  password?: InputMaybe<Scalars['String']['input']>;
  email: Scalars['String']['input'];
  isProfilePublic?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type UpdateParticipantProfileMutation = { __typename?: 'Mutation', updateParticipantProfile?: { __typename?: 'Participant', id: string, username: string, email?: string | null, isProfilePublic?: boolean | null } | null };

export type UpdateQuestionInstancesMutationVariables = Exact<{
  questionId: Scalars['Int']['input'];
}>;


export type UpdateQuestionInstancesMutation = { __typename?: 'Mutation', updateQuestionInstances: Array<{ __typename?: 'QuestionOrElementInstance', questionInstance?: { __typename?: 'QuestionInstance', id: number, questionData?: { __typename: 'ChoicesQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'ContentQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'FlashcardQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'FreeTextQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'NumericalQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | null } | null, elementInstance?: { __typename?: 'ElementInstance', id: number, elementData: { __typename: 'ChoicesElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'ChoiceQuestionOptions', displayMode: ElementDisplayMode, choices: Array<{ __typename?: 'Choice', ix: number, value: string }> } } | { __typename: 'ContentElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename?: 'FlashcardElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename: 'FreeTextElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'FreeTextQuestionOptions', restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename: 'NumericalElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'NumericalQuestionOptions', accuracy?: number | null, placeholder?: string | null, unit?: string | null, restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null } } } | null }> };

export type UpdateTagOrderingMutationVariables = Exact<{
  originIx: Scalars['Int']['input'];
  targetIx: Scalars['Int']['input'];
}>;


export type UpdateTagOrderingMutation = { __typename?: 'Mutation', updateTagOrdering?: Array<{ __typename?: 'Tag', id: number, order: number }> | null };

export type UpvoteFeedbackMutationVariables = Exact<{
  feedbackId: Scalars['Int']['input'];
  increment: Scalars['Int']['input'];
}>;


export type UpvoteFeedbackMutation = { __typename?: 'Mutation', upvoteFeedback?: { __typename?: 'Feedback', id: number, votes: number } | null };

export type VoteFeedbackResponseMutationVariables = Exact<{
  id: Scalars['Int']['input'];
  incrementUpvote: Scalars['Int']['input'];
  incrementDownvote: Scalars['Int']['input'];
}>;


export type VoteFeedbackResponseMutation = { __typename?: 'Mutation', voteFeedbackResponse?: { __typename?: 'FeedbackResponse', id: number, positiveReactions: number, negativeReactions: number } | null };

export type PublishScheduledActivitiesMutationVariables = Exact<{ [key: string]: never; }>;


export type PublishScheduledActivitiesMutation = { __typename?: 'Mutation', publishScheduledActivities: boolean };

export type CheckParticipantNameAvailableQueryVariables = Exact<{
  username: Scalars['String']['input'];
}>;


export type CheckParticipantNameAvailableQuery = { __typename?: 'Query', checkParticipantNameAvailable: boolean };

export type CheckShortnameAvailableQueryVariables = Exact<{
  shortname: Scalars['String']['input'];
}>;


export type CheckShortnameAvailableQuery = { __typename?: 'Query', checkShortnameAvailable: boolean };

export type CheckValidCoursePinQueryVariables = Exact<{
  pin: Scalars['Int']['input'];
}>;


export type CheckValidCoursePinQuery = { __typename?: 'Query', checkValidCoursePin?: string | null };

export type GetActiveUserCoursesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetActiveUserCoursesQuery = { __typename?: 'Query', getActiveUserCourses?: Array<{ __typename?: 'Course', id: string, name: string, displayName: string, color: string, pinCode?: number | null, isArchived: boolean, isGamificationEnabled: boolean, isGroupCreationEnabled: boolean, description?: string | null, startDate: any, endDate: any, groupDeadlineDate?: any | null, createdAt?: any | null, updatedAt?: any | null }> | null };

export type GetBasicCourseInformationQueryVariables = Exact<{
  courseId: Scalars['String']['input'];
}>;


export type GetBasicCourseInformationQuery = { __typename?: 'Query', basicCourseInformation?: { __typename?: 'StudentCourse', id: string, displayName: string, description?: string | null, color: string, owner: { __typename?: 'User', shortname: string } } | null };

export type GetBookmarkedElementStacksQueryVariables = Exact<{
  courseId: Scalars['String']['input'];
}>;


export type GetBookmarkedElementStacksQuery = { __typename?: 'Query', getBookmarkedElementStacks?: Array<{ __typename?: 'ElementStack', id: number, displayName?: string | null, description?: string | null, order?: number | null, elements?: Array<{ __typename?: 'ElementInstance', id: number, type: ElementInstanceType, elementType: ElementType, elementData: { __typename: 'ChoicesElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'ChoiceQuestionOptions', displayMode: ElementDisplayMode, choices: Array<{ __typename?: 'Choice', ix: number, value: string }> } } | { __typename: 'ContentElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename?: 'FlashcardElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename: 'FreeTextElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'FreeTextQuestionOptions', restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename: 'NumericalElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'NumericalQuestionOptions', accuracy?: number | null, placeholder?: string | null, unit?: string | null, restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null } } }> | null }> | null };

export type GetBookmarksPracticeQuizQueryVariables = Exact<{
  quizId?: InputMaybe<Scalars['String']['input']>;
  courseId: Scalars['String']['input'];
}>;


export type GetBookmarksPracticeQuizQuery = { __typename?: 'Query', getBookmarksPracticeQuiz?: Array<number> | null };

export type GetCockpitSessionQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetCockpitSessionQuery = { __typename?: 'Query', cockpitSession?: { __typename?: 'Session', id: string, isLiveQAEnabled: boolean, isConfusionFeedbackEnabled: boolean, isModerationEnabled: boolean, isGamificationEnabled: boolean, namespace: string, name: string, displayName: string, status: SessionStatus, startedAt?: any | null, course?: { __typename?: 'Course', id: string, displayName: string } | null, blocks?: Array<{ __typename?: 'SessionBlock', id: number, numOfParticipants?: number | null, order: number, status: SessionBlockStatus, expiresAt?: any | null, timeLimit?: number | null, randomSelection?: number | null, execution?: number | null, instances?: Array<{ __typename?: 'QuestionInstance', id: number, questionData?: { __typename: 'ChoicesQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'ContentQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'FlashcardQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'FreeTextQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'NumericalQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | null }> | null }> | null, activeBlock?: { __typename?: 'SessionBlock', id: number } | null, confusionSummary?: { __typename?: 'ConfusionSummary', speed: number, difficulty: number, numberOfParticipants?: number | null } | null, feedbacks?: Array<{ __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number, createdAt: any, resolvedAt?: any | null, responses?: Array<{ __typename?: 'FeedbackResponse', id: number, content: string, positiveReactions: number, negativeReactions: number }> | null }> | null } | null };

export type GetControlCourseQueryVariables = Exact<{
  courseId: Scalars['String']['input'];
}>;


export type GetControlCourseQuery = { __typename?: 'Query', controlCourse?: { __typename?: 'Course', id: string, name: string, sessions?: Array<{ __typename?: 'Session', id: string, name: string, status: SessionStatus }> | null } | null };

export type GetControlCoursesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetControlCoursesQuery = { __typename?: 'Query', controlCourses?: Array<{ __typename?: 'Course', id: string, name: string, isArchived: boolean, displayName: string, description?: string | null }> | null };

export type GetControlSessionQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetControlSessionQuery = { __typename?: 'Query', controlSession?: { __typename?: 'Session', id: string, name: string, displayName: string, course?: { __typename?: 'Course', id: string, displayName: string } | null, blocks?: Array<{ __typename?: 'SessionBlock', id: number, order: number, status: SessionBlockStatus, expiresAt?: any | null, timeLimit?: number | null, randomSelection?: number | null, execution?: number | null, instances?: Array<{ __typename?: 'QuestionInstance', id: number, questionData?: { __typename: 'ChoicesQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'ContentQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'FlashcardQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'FreeTextQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'NumericalQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | null }> | null }> | null, activeBlock?: { __typename?: 'SessionBlock', id: number, order: number } | null } | null };

export type GetCourseGroupActivitiesQueryVariables = Exact<{
  courseId: Scalars['String']['input'];
}>;


export type GetCourseGroupActivitiesQuery = { __typename?: 'Query', groupActivities?: Array<{ __typename?: 'GroupActivity', id: string, displayName: string, status: GroupActivityStatus, description?: string | null, scheduledStartAt: any, scheduledEndAt: any }> | null };

export type GetCourseGroupsQueryVariables = Exact<{
  courseId: Scalars['String']['input'];
}>;


export type GetCourseGroupsQuery = { __typename?: 'Query', getCourseGroups?: { __typename?: 'Course', participantGroups?: Array<{ __typename?: 'ParticipantGroup', id: string, name: string, code: number, averageMemberScore: number, groupActivityScore: number, participants?: Array<{ __typename?: 'Participant', id: string, username: string, score?: number | null, email?: string | null, avatar?: string | null }> | null }> | null, groupAssignmentPoolEntries?: Array<{ __typename?: 'GroupAssignmentPoolEntry', id: string, participant?: { __typename?: 'Participant', id: string, username: string, email?: string | null, avatar?: string | null } | null }> | null } | null };

export type GetCourseOverviewDataQueryVariables = Exact<{
  courseId: Scalars['String']['input'];
}>;


export type GetCourseOverviewDataQuery = { __typename?: 'Query', getCourseOverviewData?: { __typename?: 'ParticipantLearningData', id: string, inRandomGroupPool?: boolean | null, participant?: { __typename?: 'Participant', id: string, avatar?: string | null, username: string, xp: number, level?: number | null, participantGroups?: Array<{ __typename?: 'ParticipantGroup', id: string }> | null } | null, participation?: { __typename?: 'Participation', id: number, isActive: boolean } | null, course?: { __typename?: 'Course', id: string, displayName: string, color: string, description?: string | null, isGamificationEnabled: boolean, groupDeadlineDate?: any | null, isGroupDeadlinePassed?: boolean | null, isGroupCreationEnabled: boolean, maxGroupSize: number, preferredGroupSize: number, awards?: Array<{ __typename?: 'AwardEntry', id: number, order: number, type: string, displayName: string, description: string, participant?: { __typename?: 'Participant', id: string, username: string, avatar?: string | null } | null, participantGroup?: { __typename?: 'ParticipantGroup', id: string, name: string } | null }> | null } | null, leaderboard?: Array<{ __typename?: 'LeaderboardEntry', id: number, participantId: string, username: string, avatar?: string | null, score: number, isSelf?: boolean | null, rank: number, level: number }> | null, leaderboardStatistics?: { __typename?: 'LeaderboardStatistics', participantCount: number, averageScore: number } | null, groupLeaderboard?: Array<{ __typename?: 'GroupLeaderboardEntry', id: string, name: string, score: number, rank: number, isMember?: boolean | null }> | null, groupLeaderboardStatistics?: { __typename?: 'LeaderboardStatistics', participantCount: number, averageScore: number } | null } | null, participantGroups?: Array<{ __typename?: 'ParticipantGroup', id: string, name: string, code: number, averageMemberScore: number, groupActivityScore: number, score?: number | null, messages?: Array<{ __typename?: 'GroupMessage', id: number, content: string, createdAt: any, updatedAt: any, participant: { __typename?: 'Participant', id: string, username: string, avatar?: string | null } }> | null, participants?: Array<{ __typename?: 'Participant', id: string, username: string, avatar?: string | null, score?: number | null, isSelf?: boolean | null, level?: number | null, rank?: number | null }> | null }> | null };

export type GetCoursePracticeQuizQueryVariables = Exact<{
  courseId: Scalars['String']['input'];
}>;


export type GetCoursePracticeQuizQuery = { __typename?: 'Query', coursePracticeQuiz?: { __typename?: 'PracticeQuiz', id: string, status: PublicationStatus, name: string, displayName: string, description?: string | null, pointsMultiplier: number, resetTimeDays: number, availableFrom?: any | null, orderType: ElementOrderType, numOfStacks?: number | null, course?: { __typename?: 'Course', id: string, displayName: string, color: string } | null, stacks?: Array<{ __typename?: 'ElementStack', id: number, type: ElementStackType, displayName?: string | null, description?: string | null, order?: number | null, elements?: Array<{ __typename?: 'ElementInstance', id: number, type: ElementInstanceType, elementType: ElementType, elementData: { __typename: 'ChoicesElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'ChoiceQuestionOptions', hasSampleSolution?: boolean | null, displayMode: ElementDisplayMode, choices: Array<{ __typename?: 'Choice', ix: number, correct?: boolean | null, feedback?: string | null, value: string }> } } | { __typename: 'ContentElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename: 'FlashcardElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename: 'FreeTextElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'FreeTextQuestionOptions', hasSampleSolution?: boolean | null, solutions?: Array<string> | null, restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename: 'NumericalElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'NumericalQuestionOptions', hasSampleSolution?: boolean | null, accuracy?: number | null, placeholder?: string | null, unit?: string | null, restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null, solutionRanges?: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> | null } } }> | null }> | null } | null };

export type GetCourseSummaryQueryVariables = Exact<{
  courseId: Scalars['String']['input'];
}>;


export type GetCourseSummaryQuery = { __typename?: 'Query', getCourseSummary?: { __typename?: 'CourseSummary', numOfParticipations: number, numOfLiveQuizzes: number, numOfPracticeQuizzes: number, numOfMicroLearnings: number, numOfGroupActivities: number, numOfLeaderboardEntries: number, numOfParticipantGroups: number } | null };

export type GetFeedbacksQueryVariables = Exact<{
  sessionId: Scalars['String']['input'];
}>;


export type GetFeedbacksQuery = { __typename?: 'Query', feedbacks?: Array<{ __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number, resolvedAt?: any | null, createdAt: any, responses?: Array<{ __typename?: 'FeedbackResponse', id: number, content: string, positiveReactions: number, negativeReactions: number, createdAt?: any | null }> | null }> | null };

export type GetGradingGroupActivityQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetGradingGroupActivityQuery = { __typename?: 'Query', getGradingGroupActivity?: { __typename?: 'GroupActivity', id: string, name: string, displayName: string, description?: string | null, status: GroupActivityStatus, pointsMultiplier?: number | null, scheduledStartAt: any, scheduledEndAt: any, clues?: Array<{ __typename?: 'GroupActivityClue', id: number, type: ParameterType, name: string, displayName: string, value: string, unit?: string | null }> | null, stacks?: Array<{ __typename?: 'ElementStack', id: number, displayName?: string | null, description?: string | null, elements?: Array<{ __typename?: 'ElementInstance', id: number, type: ElementInstanceType, elementType: ElementType, options?: { __typename?: 'ElementInstanceOptions', pointsMultiplier?: number | null } | null, elementData: { __typename: 'ChoicesElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'ChoiceQuestionOptions', hasSampleSolution?: boolean | null, displayMode: ElementDisplayMode, choices: Array<{ __typename?: 'Choice', ix: number, correct?: boolean | null, feedback?: string | null, value: string }> } } | { __typename: 'ContentElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename: 'FlashcardElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename: 'FreeTextElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'FreeTextQuestionOptions', hasSampleSolution?: boolean | null, solutions?: Array<string> | null, restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename: 'NumericalElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'NumericalQuestionOptions', hasSampleSolution?: boolean | null, accuracy?: number | null, placeholder?: string | null, unit?: string | null, restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null, solutionRanges?: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> | null } } }> | null }> | null, activityInstances?: Array<{ __typename?: 'GroupActivityInstance', id: number, groupActivityId: string, decisionsSubmittedAt?: any | null, resultsComputedAt?: any | null, groupName?: string | null, decisions?: Array<{ __typename?: 'GroupActivityDecision', instanceId: number, type: ElementType, freeTextResponse?: string | null, choicesResponse?: Array<number> | null, numericalResponse?: number | null, contentResponse?: boolean | null }> | null, results?: { __typename?: 'GroupActivityResults', passed: boolean, points: number, comment?: string | null, grading: Array<{ __typename?: 'GroupActivityGrading', instanceId: number, score: number, maxPoints: number, feedback?: string | null }> } | null }> | null } | null };

export type GetGroupActivityQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetGroupActivityQuery = { __typename?: 'Query', groupActivity?: { __typename?: 'GroupActivity', id: string, name: string, displayName: string, description?: string | null, pointsMultiplier?: number | null, scheduledStartAt: any, scheduledEndAt: any, clues?: Array<{ __typename?: 'GroupActivityClue', id: number, type: ParameterType, name: string, displayName: string, value: string, unit?: string | null }> | null, stacks?: Array<{ __typename?: 'ElementStack', id: number, displayName?: string | null, description?: string | null, elements?: Array<{ __typename?: 'ElementInstance', id: number, type: ElementInstanceType, elementType: ElementType, elementData: { __typename: 'ChoicesElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'ChoiceQuestionOptions', displayMode: ElementDisplayMode, choices: Array<{ __typename?: 'Choice', ix: number, value: string }> } } | { __typename: 'ContentElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename?: 'FlashcardElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename: 'FreeTextElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'FreeTextQuestionOptions', restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename: 'NumericalElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'NumericalQuestionOptions', accuracy?: number | null, placeholder?: string | null, unit?: string | null, restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null } } }> | null }> | null, course?: { __typename?: 'Course', id: string, displayName: string } | null } | null };

export type GetGroupActivityInstancesQueryVariables = Exact<{
  groupId: Scalars['String']['input'];
  courseId: Scalars['String']['input'];
}>;


export type GetGroupActivityInstancesQuery = { __typename?: 'Query', groupActivityInstances?: Array<{ __typename?: 'GroupActivityInstance', id: number, decisionsSubmittedAt?: any | null, resultsComputedAt?: any | null, groupActivityId: string, results?: { __typename?: 'GroupActivityResults', passed: boolean, points: number, comment?: string | null, grading: Array<{ __typename?: 'GroupActivityGrading', instanceId: number, score: number, maxPoints: number, feedback?: string | null }> } | null }> | null };

export type GetGroupActivitySummaryQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetGroupActivitySummaryQuery = { __typename?: 'Query', getGroupActivitySummary?: { __typename?: 'GroupActivitySummary', numOfStartedInstances: number, numOfSubmissions: number } | null };

export type GetLiveQuizSummaryQueryVariables = Exact<{
  quizId: Scalars['String']['input'];
}>;


export type GetLiveQuizSummaryQuery = { __typename?: 'Query', getLiveQuizSummary?: { __typename?: 'RunningLiveQuizSummary', numOfResponses: number, numOfFeedbacks: number, numOfConfusionFeedbacks: number, numOfLeaderboardEntries: number } | null };

export type GetLoginTokenQueryVariables = Exact<{ [key: string]: never; }>;


export type GetLoginTokenQuery = { __typename?: 'Query', getLoginToken?: { __typename?: 'User', loginToken?: string | null, loginTokenExpiresAt?: any | null } | null };

export type GetMicroLearningEvaluationQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetMicroLearningEvaluationQuery = { __typename?: 'Query', getMicroLearningEvaluation?: { __typename?: 'ActivityEvaluation', id: string, name: string, displayName?: string | null, description?: string | null, results: Array<{ __typename?: 'StackEvaluation', stackId: number, stackName?: string | null, stackDescription?: string | null, stackOrder: number, instances: Array<{ __typename: 'ChoicesElementInstanceEvaluation', id: number, type: ElementType, name: string, content: string, explanation?: string | null, hasSampleSolution: boolean, hasAnswerFeedbacks: boolean, results: { __typename?: 'ChoicesElementResults', totalAnswers: number, anonymousAnswers: number, choices: Array<{ __typename?: 'ChoiceElementResults', value: string, count: number, correct?: boolean | null, feedback?: string | null }> } } | { __typename: 'ContentElementInstanceEvaluation', id: number, type: ElementType, name: string, content: string, explanation?: string | null, hasSampleSolution: boolean, hasAnswerFeedbacks: boolean, results: { __typename?: 'ContentElementResults', totalAnswers: number, anonymousAnswers: number } } | { __typename: 'FlashcardElementInstanceEvaluation', id: number, type: ElementType, name: string, content: string, explanation?: string | null, hasSampleSolution: boolean, hasAnswerFeedbacks: boolean, results: { __typename?: 'FlashcardElementResults', totalAnswers: number, anonymousAnswers: number, correctCount: number, partialCount: number, incorrectCount: number } } | { __typename: 'FreeElementInstanceEvaluation', id: number, type: ElementType, name: string, content: string, explanation?: string | null, hasSampleSolution: boolean, hasAnswerFeedbacks: boolean, results: { __typename?: 'FreeElementResults', totalAnswers: number, anonymousAnswers: number, maxLength?: number | null, solutions?: Array<string> | null, responses: Array<{ __typename?: 'FreeElementResult', value: string, correct?: boolean | null, count: number }> } } | { __typename: 'NumericalElementInstanceEvaluation', id: number, type: ElementType, name: string, content: string, explanation?: string | null, hasSampleSolution: boolean, hasAnswerFeedbacks: boolean, results: { __typename?: 'NumericalElementResults', totalAnswers: number, anonymousAnswers: number, maxValue?: number | null, minValue?: number | null, solutionRanges: Array<{ __typename?: 'NumericalElementSolutions', min?: number | null, max?: number | null }>, responseValues: Array<{ __typename?: 'NumericalElementResult', value: number, correct?: boolean | null, count: number }> } }> }> } | null };

export type GetMicroLearningSummaryQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetMicroLearningSummaryQuery = { __typename?: 'Query', getMicroLearningSummary?: { __typename?: 'ActivitySummary', numOfResponses: number, numOfAnonymousResponses: number } | null };

export type GetMicroLearningQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetMicroLearningQuery = { __typename?: 'Query', microLearning?: { __typename?: 'MicroLearning', id: string, name: string, status: PublicationStatus, displayName: string, description?: string | null, pointsMultiplier: number, scheduledStartAt: any, scheduledEndAt: any, course?: { __typename?: 'Course', id: string, displayName: string, color: string } | null, stacks?: Array<{ __typename?: 'ElementStack', id: number, type: ElementStackType, displayName?: string | null, description?: string | null, order?: number | null, elements?: Array<{ __typename?: 'ElementInstance', id: number, type: ElementInstanceType, elementType: ElementType, elementData: { __typename: 'ChoicesElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'ChoiceQuestionOptions', displayMode: ElementDisplayMode, choices: Array<{ __typename?: 'Choice', ix: number, value: string }> } } | { __typename: 'ContentElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename?: 'FlashcardElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename: 'FreeTextElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'FreeTextQuestionOptions', restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename: 'NumericalElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'NumericalQuestionOptions', accuracy?: number | null, placeholder?: string | null, unit?: string | null, restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null } } }> | null }> | null } | null };

export type GetParticipantCoursesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetParticipantCoursesQuery = { __typename?: 'Query', participantCourses?: Array<{ __typename?: 'Course', id: string, isArchived: boolean, displayName: string, description?: string | null }> | null };

export type GetParticipantGroupsQueryVariables = Exact<{
  courseId: Scalars['String']['input'];
}>;


export type GetParticipantGroupsQuery = { __typename?: 'Query', participantGroups?: Array<{ __typename?: 'ParticipantGroup', id: string, name: string, code: number, score?: number | null, participants?: Array<{ __typename?: 'Participant', id: string, username: string, score?: number | null, isSelf?: boolean | null, rank?: number | null }> | null }> | null };

export type GetParticipationQueryVariables = Exact<{
  courseId: Scalars['String']['input'];
}>;


export type GetParticipationQuery = { __typename?: 'Query', getParticipation?: { __typename?: 'Participation', id: number, isActive: boolean } | null };

export type GetPinnedFeedbacksQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetPinnedFeedbacksQuery = { __typename?: 'Query', pinnedFeedbacks?: { __typename?: 'Session', id: string, isLiveQAEnabled: boolean, isConfusionFeedbackEnabled: boolean, isModerationEnabled: boolean, isGamificationEnabled: boolean, confusionSummary?: { __typename?: 'ConfusionSummary', speed: number, difficulty: number, numberOfParticipants?: number | null } | null, feedbacks?: Array<{ __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number, createdAt: any, resolvedAt?: any | null, responses?: Array<{ __typename?: 'FeedbackResponse', id: number, content: string, positiveReactions: number, negativeReactions: number, createdAt?: any | null }> | null }> | null } | null };

export type GetPracticeCoursesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetPracticeCoursesQuery = { __typename?: 'Query', getPracticeCourses?: Array<{ __typename?: 'Course', id: string, displayName: string }> | null };

export type GetPracticeQuizQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetPracticeQuizQuery = { __typename?: 'Query', practiceQuiz?: { __typename?: 'PracticeQuiz', id: string, status: PublicationStatus, name: string, displayName: string, description?: string | null, pointsMultiplier: number, resetTimeDays: number, availableFrom?: any | null, orderType: ElementOrderType, numOfStacks?: number | null, course?: { __typename?: 'Course', id: string, displayName: string, color: string } | null, stacks?: Array<{ __typename?: 'ElementStack', id: number, type: ElementStackType, displayName?: string | null, description?: string | null, order?: number | null, elements?: Array<{ __typename?: 'ElementInstance', id: number, type: ElementInstanceType, elementType: ElementType, elementData: { __typename: 'ChoicesElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'ChoiceQuestionOptions', displayMode: ElementDisplayMode, choices: Array<{ __typename?: 'Choice', ix: number, value: string }> } } | { __typename: 'ContentElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename?: 'FlashcardElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename: 'FreeTextElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'FreeTextQuestionOptions', restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename: 'NumericalElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'NumericalQuestionOptions', accuracy?: number | null, placeholder?: string | null, unit?: string | null, restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null } } }> | null }> | null } | null };

export type GetPracticeQuizEvaluationQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetPracticeQuizEvaluationQuery = { __typename?: 'Query', getPracticeQuizEvaluation?: { __typename?: 'ActivityEvaluation', id: string, name: string, displayName?: string | null, description?: string | null, results: Array<{ __typename?: 'StackEvaluation', stackId: number, stackName?: string | null, stackDescription?: string | null, stackOrder: number, instances: Array<{ __typename: 'ChoicesElementInstanceEvaluation', id: number, type: ElementType, name: string, content: string, explanation?: string | null, hasSampleSolution: boolean, hasAnswerFeedbacks: boolean, results: { __typename?: 'ChoicesElementResults', totalAnswers: number, anonymousAnswers: number, choices: Array<{ __typename?: 'ChoiceElementResults', value: string, count: number, correct?: boolean | null, feedback?: string | null }> } } | { __typename: 'ContentElementInstanceEvaluation', id: number, type: ElementType, name: string, content: string, explanation?: string | null, hasSampleSolution: boolean, hasAnswerFeedbacks: boolean, results: { __typename?: 'ContentElementResults', totalAnswers: number, anonymousAnswers: number } } | { __typename: 'FlashcardElementInstanceEvaluation', id: number, type: ElementType, name: string, content: string, explanation?: string | null, hasSampleSolution: boolean, hasAnswerFeedbacks: boolean, results: { __typename?: 'FlashcardElementResults', totalAnswers: number, anonymousAnswers: number, correctCount: number, partialCount: number, incorrectCount: number } } | { __typename: 'FreeElementInstanceEvaluation', id: number, type: ElementType, name: string, content: string, explanation?: string | null, hasSampleSolution: boolean, hasAnswerFeedbacks: boolean, results: { __typename?: 'FreeElementResults', totalAnswers: number, anonymousAnswers: number, maxLength?: number | null, solutions?: Array<string> | null, responses: Array<{ __typename?: 'FreeElementResult', value: string, correct?: boolean | null, count: number }> } } | { __typename: 'NumericalElementInstanceEvaluation', id: number, type: ElementType, name: string, content: string, explanation?: string | null, hasSampleSolution: boolean, hasAnswerFeedbacks: boolean, results: { __typename?: 'NumericalElementResults', totalAnswers: number, anonymousAnswers: number, maxValue?: number | null, minValue?: number | null, solutionRanges: Array<{ __typename?: 'NumericalElementSolutions', min?: number | null, max?: number | null }>, responseValues: Array<{ __typename?: 'NumericalElementResult', value: number, correct?: boolean | null, count: number }> } }> }> } | null };

export type GetPracticeQuizListQueryVariables = Exact<{ [key: string]: never; }>;


export type GetPracticeQuizListQuery = { __typename?: 'Query', getPracticeQuizList?: Array<{ __typename?: 'Course', id: string, displayName: string, practiceQuizzes?: Array<{ __typename?: 'PracticeQuiz', id: string, displayName: string }> | null }> | null };

export type GetPracticeQuizSummaryQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetPracticeQuizSummaryQuery = { __typename?: 'Query', getPracticeQuizSummary?: { __typename?: 'ActivitySummary', numOfResponses: number, numOfAnonymousResponses: number } | null };

export type GetPreviousStackEvaluationQueryVariables = Exact<{
  stackId: Scalars['Int']['input'];
}>;


export type GetPreviousStackEvaluationQuery = { __typename?: 'Query', getPreviousStackEvaluation?: { __typename?: 'StackFeedback', id: number, status: StackFeedbackStatus, score?: number | null, evaluations?: Array<{ __typename: 'ChoicesInstanceEvaluation', elementType: ElementType, instanceId: number, pointsMultiplier: number, explanation?: string | null, choices?: any | null, numAnswers?: number | null, score: number, xp?: number | null, pointsAwarded?: number | null, percentile?: number | null, newPointsFrom?: any | null, xpAwarded?: number | null, newXpFrom?: any | null, correctness?: number | null, feedbacks?: Array<{ __typename?: 'QuestionFeedback', ix: number, feedback?: string | null, correct?: boolean | null, value: string }> | null, lastResponse?: { __typename: 'SingleQuestionResponseChoices', choices: Array<number> } | null } | { __typename: 'ContentInstanceEvaluation', instanceId: number, elementType: ElementType, pointsMultiplier: number, explanation?: string | null, numAnswers?: number | null, score: number, xp?: number | null, pointsAwarded?: number | null, percentile?: number | null, newPointsFrom?: any | null, xpAwarded?: number | null, newXpFrom?: any | null, correctness?: number | null, feedbacks?: Array<{ __typename?: 'QuestionFeedback', ix: number, feedback?: string | null, correct?: boolean | null, value: string }> | null, lastResponse?: { __typename: 'SingleQuestionResponseContent', viewed: boolean } | null } | { __typename: 'FlashcardInstanceEvaluation', instanceId: number, elementType: ElementType, pointsMultiplier: number, explanation?: string | null, numAnswers?: number | null, score: number, xp?: number | null, pointsAwarded?: number | null, percentile?: number | null, newPointsFrom?: any | null, xpAwarded?: number | null, newXpFrom?: any | null, correctness?: number | null, feedbacks?: Array<{ __typename?: 'QuestionFeedback', ix: number, feedback?: string | null, correct?: boolean | null, value: string }> | null, lastResponse?: { __typename: 'SingleQuestionResponseFlashcard', correctness: FlashcardCorrectness } | null } | { __typename: 'FreeTextInstanceEvaluation', instanceId: number, elementType: ElementType, pointsMultiplier: number, explanation?: string | null, numAnswers?: number | null, answers?: any | null, score: number, xp?: number | null, pointsAwarded?: number | null, percentile?: number | null, newPointsFrom?: any | null, xpAwarded?: number | null, newXpFrom?: any | null, solutions?: Array<string> | null, correctness?: number | null, feedbacks?: Array<{ __typename?: 'QuestionFeedback', ix: number, feedback?: string | null, correct?: boolean | null, value: string }> | null, lastResponse?: { __typename: 'SingleQuestionResponseValue', value: string } | null } | { __typename: 'NumericalInstanceEvaluation', elementType: ElementType, instanceId: number, pointsMultiplier: number, explanation?: string | null, numAnswers?: number | null, answers?: any | null, score: number, xp?: number | null, pointsAwarded?: number | null, percentile?: number | null, newPointsFrom?: any | null, xpAwarded?: number | null, newXpFrom?: any | null, correctness?: number | null, feedbacks?: Array<{ __typename?: 'QuestionFeedback', ix: number, feedback?: string | null, correct?: boolean | null, value: string }> | null, solutionRanges?: Array<{ __typename: 'NumericalSolutionRange', min?: number | null, max?: number | null }> | null, lastResponse?: { __typename: 'SingleQuestionResponseValue', value: string } | null }> | null } | null };

export type GetPublicParticipantProfileQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetPublicParticipantProfileQuery = { __typename?: 'Query', publicParticipantProfile?: { __typename?: 'Participant', id: string, username: string, avatar?: string | null, isProfilePublic?: boolean | null, isSelf?: boolean | null, level?: number | null, xp: number, avatarSettings?: { __typename?: 'AvatarSettings', skinTone: string, eyes: string, mouth: string, hair: string, facialHair: string, accessory: string, hairColor: string, clothing: string, clothingColor: string } | null, levelData?: { __typename?: 'Level', id: number, avatar?: string | null, name?: string | null, index: number, requiredXp: number, nextLevel?: { __typename?: 'Level', id: number, index: number, avatar?: string | null, requiredXp: number, name?: string | null } | null } | null, achievements?: Array<{ __typename?: 'ParticipantAchievementInstance', id: number, achievedAt: any, achievedCount: number, achievement: { __typename?: 'Achievement', id: number, nameDE?: string | null, nameEN?: string | null, descriptionDE?: string | null, descriptionEN?: string | null, icon: string, iconColor?: string | null } }> | null } | null };

export type GetRunningSessionQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetRunningSessionQuery = { __typename?: 'Query', session?: { __typename?: 'Session', id: string, isLiveQAEnabled: boolean, isConfusionFeedbackEnabled: boolean, isModerationEnabled: boolean, isGamificationEnabled: boolean, namespace: string, displayName: string, status: SessionStatus, course?: { __typename?: 'Course', id: string, displayName: string, color: string } | null, activeBlock?: { __typename?: 'SessionBlock', id: number, status: SessionBlockStatus, expiresAt?: any | null, timeLimit?: number | null, randomSelection?: number | null, execution?: number | null, instances?: Array<{ __typename?: 'QuestionInstance', id: number, questionData?: { __typename: 'ChoicesQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null, options: { __typename?: 'ChoiceQuestionOptions', displayMode: ElementDisplayMode, choices: Array<{ __typename?: 'Choice', ix: number, value: string }> } } | { __typename: 'ContentQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'FlashcardQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'FreeTextQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null, options: { __typename?: 'FreeTextQuestionOptions', restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename: 'NumericalQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null, options: { __typename?: 'NumericalQuestionOptions', unit?: string | null, accuracy?: number | null, placeholder?: string | null, restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null } } | null }> | null } | null } | null };

export type GetRunningSessionsQueryVariables = Exact<{
  shortname: Scalars['String']['input'];
}>;


export type GetRunningSessionsQuery = { __typename?: 'Query', runningSessions?: Array<{ __typename?: 'Session', id: string, name: string, displayName: string, linkTo?: string | null, course?: { __typename?: 'Course', id: string, displayName: string } | null }> | null };

export type GetRunningSessionsCourseQueryVariables = Exact<{
  courseId: Scalars['String']['input'];
}>;


export type GetRunningSessionsCourseQuery = { __typename?: 'Query', runningSessionsCourse?: Array<{ __typename?: 'Session', id: string, name: string, displayName: string, linkTo?: string | null, course?: { __typename?: 'Course', id: string, displayName: string } | null }> | null };

export type GetSessionEvaluationQueryVariables = Exact<{
  id: Scalars['String']['input'];
  hmac?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetSessionEvaluationQuery = { __typename?: 'Query', sessionEvaluation?: { __typename?: 'SessionEvaluation', id: string, displayName: string, status: SessionStatus, isGamificationEnabled: boolean, blocks: Array<{ __typename?: 'EvaluationBlock', blockIx: number, blockStatus: SessionBlockStatus, tabData: Array<{ __typename?: 'TabData', id: string, questionIx?: number | null, name: string, status?: string | null }> }>, instanceResults: Array<{ __typename?: 'InstanceResult', id: string, blockIx?: number | null, instanceIx: number, status: SessionBlockStatus, participants: number, results: any, questionData: { __typename: 'ChoicesQuestionData', id: string, name: string, type: ElementType, content: string, options: { __typename?: 'ChoiceQuestionOptions', hasSampleSolution?: boolean | null, hasAnswerFeedbacks?: boolean | null, displayMode: ElementDisplayMode, choices: Array<{ __typename?: 'Choice', ix: number, correct?: boolean | null, feedback?: string | null, value: string }> } } | { __typename: 'ContentQuestionData', id: string, name: string, type: ElementType, content: string } | { __typename: 'FlashcardQuestionData', id: string, name: string, type: ElementType, content: string } | { __typename: 'FreeTextQuestionData', id: string, name: string, type: ElementType, content: string, options: { __typename?: 'FreeTextQuestionOptions', hasSampleSolution?: boolean | null, solutions?: Array<string> | null, restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename: 'NumericalQuestionData', id: string, name: string, type: ElementType, content: string, options: { __typename?: 'NumericalQuestionOptions', hasSampleSolution?: boolean | null, restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null, solutionRanges?: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> | null } }, statistics?: { __typename?: 'Statistics', max: number, mean: number, median: number, min: number, q1: number, q3: number, sd: number } | null }>, feedbacks: Array<{ __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number, resolvedAt?: any | null, createdAt: any, responses?: Array<{ __typename?: 'FeedbackResponse', id: number, createdAt?: any | null, content: string, positiveReactions: number, negativeReactions: number }> | null }>, confusionFeedbacks: Array<{ __typename?: 'ConfusionTimestep', speed: number, difficulty: number, createdAt: any }> } | null, sessionLeaderboard?: Array<{ __typename?: 'LeaderboardEntry', id: number, participantId: string, rank: number, username: string, avatar?: string | null, score: number }> | null };

export type GetSessionHmacQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetSessionHmacQuery = { __typename?: 'Query', sessionHMAC?: string | null };

export type GetSessionLeaderboardQueryVariables = Exact<{
  sessionId: Scalars['String']['input'];
}>;


export type GetSessionLeaderboardQuery = { __typename?: 'Query', sessionLeaderboard?: Array<{ __typename?: 'LeaderboardEntry', id: number, participantId: string, rank: number, username: string, avatar?: string | null, score: number, isSelf?: boolean | null, lastBlockOrder?: number | null }> | null };

export type GetSingleCourseQueryVariables = Exact<{
  courseId: Scalars['String']['input'];
}>;


export type GetSingleCourseQuery = { __typename?: 'Query', course?: { __typename?: 'Course', id: string, isArchived: boolean, isGamificationEnabled: boolean, pinCode?: number | null, name: string, displayName: string, description?: string | null, color: string, numOfParticipants?: number | null, numOfActiveParticipants?: number | null, numOfParticipantGroups?: number | null, averageScore?: number | null, averageActiveScore?: number | null, startDate: any, endDate: any, isGroupCreationEnabled: boolean, groupDeadlineDate?: any | null, maxGroupSize: number, preferredGroupSize: number, randomAssignmentFinalized: boolean, sessions?: Array<{ __typename?: 'Session', id: string, name: string, displayName: string, isGamificationEnabled: boolean, pinCode?: number | null, accessMode: SessionAccessMode, status: SessionStatus, pointsMultiplier: number, createdAt: any, numOfBlocks?: number | null, numOfQuestions?: number | null }> | null, practiceQuizzes?: Array<{ __typename?: 'PracticeQuiz', id: string, name: string, displayName: string, status: PublicationStatus, availableFrom?: any | null, orderType: ElementOrderType, pointsMultiplier: number, resetTimeDays: number, numOfStacks?: number | null }> | null, groupActivities?: Array<{ __typename?: 'GroupActivity', id: string, name: string, displayName: string, status: GroupActivityStatus, scheduledStartAt: any, scheduledEndAt: any, numOfQuestions?: number | null }> | null, microLearnings?: Array<{ __typename?: 'MicroLearning', id: string, name: string, displayName: string, status: PublicationStatus, scheduledStartAt: any, scheduledEndAt: any, pointsMultiplier: number, numOfStacks?: number | null }> | null, leaderboard?: Array<{ __typename?: 'LeaderboardEntry', id: number, score: number, rank: number, username: string, email?: string | null, avatar?: string | null }> | null } | null };

export type GetSingleLiveSessionQueryVariables = Exact<{
  sessionId: Scalars['String']['input'];
}>;


export type GetSingleLiveSessionQuery = { __typename?: 'Query', liveSession?: { __typename?: 'Session', id: string, name: string, displayName: string, description?: string | null, pointsMultiplier: number, maxBonusPoints: number, timeToZeroBonus: number, isGamificationEnabled: boolean, isLiveQAEnabled: boolean, isConfusionFeedbackEnabled: boolean, isModerationEnabled: boolean, blocks?: Array<{ __typename?: 'SessionBlock', id: number, status: SessionBlockStatus, timeLimit?: number | null, instances?: Array<{ __typename?: 'QuestionInstance', id: number, questionData?: { __typename: 'ChoicesQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null, options: { __typename?: 'ChoiceQuestionOptions', hasSampleSolution?: boolean | null, hasAnswerFeedbacks?: boolean | null, displayMode: ElementDisplayMode, choices: Array<{ __typename?: 'Choice', ix: number, correct?: boolean | null, feedback?: string | null, value: string }> } } | { __typename?: 'ContentQuestionData' } | { __typename?: 'FlashcardQuestionData' } | { __typename: 'FreeTextQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null, options: { __typename?: 'FreeTextQuestionOptions', hasSampleSolution?: boolean | null, solutions?: Array<string> | null, restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename: 'NumericalQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null, options: { __typename?: 'NumericalQuestionOptions', hasSampleSolution?: boolean | null, accuracy?: number | null, placeholder?: string | null, unit?: string | null, restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null, solutionRanges?: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> | null } } | null }> | null }> | null, course?: { __typename?: 'Course', id: string } | null } | null };

export type GetSingleMicroLearningQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetSingleMicroLearningQuery = { __typename?: 'Query', getSingleMicroLearning?: { __typename?: 'MicroLearning', id: string, name: string, status: PublicationStatus, displayName: string, description?: string | null, pointsMultiplier: number, scheduledStartAt: any, scheduledEndAt: any, course?: { __typename?: 'Course', id: string, displayName: string, color: string } | null, stacks?: Array<{ __typename?: 'ElementStack', id: number, type: ElementStackType, displayName?: string | null, description?: string | null, order?: number | null, elements?: Array<{ __typename?: 'ElementInstance', id: number, type: ElementInstanceType, elementType: ElementType, elementData: { __typename: 'ChoicesElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'ChoiceQuestionOptions', hasSampleSolution?: boolean | null, displayMode: ElementDisplayMode, choices: Array<{ __typename?: 'Choice', ix: number, correct?: boolean | null, feedback?: string | null, value: string }> } } | { __typename: 'ContentElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename: 'FlashcardElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename: 'FreeTextElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'FreeTextQuestionOptions', hasSampleSolution?: boolean | null, solutions?: Array<string> | null, restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename: 'NumericalElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'NumericalQuestionOptions', hasSampleSolution?: boolean | null, accuracy?: number | null, placeholder?: string | null, unit?: string | null, restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null, solutionRanges?: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> | null } } }> | null }> | null } | null };

export type GetSinglePracticeQuizQueryVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type GetSinglePracticeQuizQuery = { __typename?: 'Query', getSinglePracticeQuiz?: { __typename?: 'PracticeQuiz', id: string, status: PublicationStatus, name: string, displayName: string, description?: string | null, pointsMultiplier: number, resetTimeDays: number, availableFrom?: any | null, orderType: ElementOrderType, numOfStacks?: number | null, course?: { __typename?: 'Course', id: string, displayName: string, color: string } | null, stacks?: Array<{ __typename?: 'ElementStack', id: number, type: ElementStackType, displayName?: string | null, description?: string | null, order?: number | null, elements?: Array<{ __typename?: 'ElementInstance', id: number, type: ElementInstanceType, elementType: ElementType, elementData: { __typename: 'ChoicesElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'ChoiceQuestionOptions', hasSampleSolution?: boolean | null, displayMode: ElementDisplayMode, choices: Array<{ __typename?: 'Choice', ix: number, correct?: boolean | null, feedback?: string | null, value: string }> } } | { __typename: 'ContentElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename: 'FlashcardElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename: 'FreeTextElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'FreeTextQuestionOptions', hasSampleSolution?: boolean | null, solutions?: Array<string> | null, restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename: 'NumericalElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'NumericalQuestionOptions', hasSampleSolution?: boolean | null, accuracy?: number | null, placeholder?: string | null, unit?: string | null, restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null, solutionRanges?: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> | null } } }> | null }> | null } | null };

export type GetSingleQuestionQueryVariables = Exact<{
  id: Scalars['Int']['input'];
}>;


export type GetSingleQuestionQuery = { __typename?: 'Query', question?: { __typename: 'ChoicesElement', id: number, version: number, name: string, status: ElementStatus, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename: 'ChoiceQuestionOptions', hasSampleSolution?: boolean | null, hasAnswerFeedbacks?: boolean | null, displayMode: ElementDisplayMode, choices: Array<{ __typename?: 'Choice', ix: number, correct?: boolean | null, feedback?: string | null, value: string }> }, tags?: Array<{ __typename?: 'Tag', id: number, name: string, order: number }> | null } | { __typename: 'ContentElement', id: number, version: number, name: string, status: ElementStatus, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, tags?: Array<{ __typename?: 'Tag', id: number, name: string, order: number }> | null } | { __typename: 'FlashcardElement', id: number, version: number, name: string, status: ElementStatus, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, tags?: Array<{ __typename?: 'Tag', id: number, name: string, order: number }> | null } | { __typename: 'FreeTextElement', id: number, version: number, name: string, status: ElementStatus, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'FreeTextQuestionOptions', hasSampleSolution?: boolean | null, solutions?: Array<string> | null, restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null }, tags?: Array<{ __typename?: 'Tag', id: number, name: string, order: number }> | null } | { __typename: 'NumericalElement', id: number, version: number, name: string, status: ElementStatus, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'NumericalQuestionOptions', hasSampleSolution?: boolean | null, accuracy?: number | null, placeholder?: string | null, unit?: string | null, restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null, solutionRanges?: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> | null }, tags?: Array<{ __typename?: 'Tag', id: number, name: string, order: number }> | null } | null };

export type GetStackElementFeedbacksQueryVariables = Exact<{
  instanceIds: Array<Scalars['Int']['input']> | Scalars['Int']['input'];
}>;


export type GetStackElementFeedbacksQuery = { __typename?: 'Query', getStackElementFeedbacks?: Array<{ __typename?: 'ElementFeedback', id: number, upvote: boolean, downvote: boolean, feedback?: string | null, elementInstanceId: number }> | null };

export type GetUnassignedSessionsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetUnassignedSessionsQuery = { __typename?: 'Query', unassignedSessions?: Array<{ __typename?: 'Session', id: string, name: string, status: SessionStatus }> | null };

export type GetUserCoursesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetUserCoursesQuery = { __typename?: 'Query', userCourses?: Array<{ __typename?: 'Course', id: string, name: string, displayName: string, color: string, pinCode?: number | null, isArchived: boolean, isGamificationEnabled: boolean, isGroupCreationEnabled: boolean, description?: string | null, startDate: any, endDate: any, createdAt?: any | null, updatedAt?: any | null }> | null };

export type GetUserLoginsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetUserLoginsQuery = { __typename?: 'Query', userScope?: UserLoginScope | null, userLogins?: Array<{ __typename?: 'UserLogin', id: string, name: string, scope: UserLoginScope, lastLoginAt?: any | null, user?: { __typename?: 'User', id: string, shortname: string } | null }> | null };

export type GetUserMediaFilesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetUserMediaFilesQuery = { __typename?: 'Query', userMediaFiles?: Array<{ __typename?: 'MediaFile', id: string, name: string, type: string, href: string }> | null };

export type GetUserQuestionsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetUserQuestionsQuery = { __typename?: 'Query', userQuestions?: Array<{ __typename: 'ChoicesElement', id: number, name: string, status: ElementStatus, type: ElementType, content: string, pointsMultiplier: number, version: number, isArchived?: boolean | null, isDeleted?: boolean | null, createdAt?: any | null, updatedAt?: any | null, options: { __typename: 'ChoiceQuestionOptions', hasSampleSolution?: boolean | null, hasAnswerFeedbacks?: boolean | null, displayMode: ElementDisplayMode, choices: Array<{ __typename?: 'Choice', ix: number, correct?: boolean | null, feedback?: string | null, value: string }> }, tags?: Array<{ __typename?: 'Tag', id: number, name: string, order: number }> | null } | { __typename: 'ContentElement', id: number, name: string, status: ElementStatus, type: ElementType, content: string, pointsMultiplier: number, version: number, isArchived?: boolean | null, isDeleted?: boolean | null, createdAt?: any | null, updatedAt?: any | null, tags?: Array<{ __typename?: 'Tag', id: number, name: string, order: number }> | null } | { __typename: 'FlashcardElement', id: number, name: string, status: ElementStatus, type: ElementType, content: string, pointsMultiplier: number, version: number, isArchived?: boolean | null, isDeleted?: boolean | null, createdAt?: any | null, updatedAt?: any | null, tags?: Array<{ __typename?: 'Tag', id: number, name: string, order: number }> | null } | { __typename: 'FreeTextElement', id: number, name: string, status: ElementStatus, type: ElementType, content: string, pointsMultiplier: number, version: number, isArchived?: boolean | null, isDeleted?: boolean | null, createdAt?: any | null, updatedAt?: any | null, options: { __typename: 'FreeTextQuestionOptions', hasSampleSolution?: boolean | null, hasAnswerFeedbacks?: boolean | null, solutions?: Array<string> | null, restrictions?: { __typename: 'FreeTextRestrictions', maxLength?: number | null } | null }, tags?: Array<{ __typename?: 'Tag', id: number, name: string, order: number }> | null } | { __typename: 'NumericalElement', id: number, name: string, status: ElementStatus, type: ElementType, content: string, pointsMultiplier: number, version: number, isArchived?: boolean | null, isDeleted?: boolean | null, createdAt?: any | null, updatedAt?: any | null, options: { __typename: 'NumericalQuestionOptions', hasSampleSolution?: boolean | null, hasAnswerFeedbacks?: boolean | null, placeholder?: string | null, accuracy?: number | null, unit?: string | null, solutionRanges?: Array<{ __typename: 'NumericalSolutionRange', min?: number | null, max?: number | null }> | null, restrictions?: { __typename: 'NumericalRestrictions', min?: number | null, max?: number | null } | null }, tags?: Array<{ __typename?: 'Tag', id: number, name: string, order: number }> | null }> | null };

export type GetUserRunningSessionsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetUserRunningSessionsQuery = { __typename?: 'Query', userRunningSessions?: Array<{ __typename?: 'Session', id: string, name: string, displayName: string, linkTo?: string | null, course?: { __typename?: 'Course', id: string, displayName: string } | null }> | null };

export type GetUserSessionsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetUserSessionsQuery = { __typename?: 'Query', userSessions?: Array<{ __typename?: 'Session', id: string, name: string, displayName: string, namespace: string, pointsMultiplier: number, accessMode: SessionAccessMode, status: SessionStatus, createdAt: any, updatedAt?: any | null, startedAt?: any | null, finishedAt?: any | null, numOfBlocks?: number | null, numOfQuestions?: number | null, isGamificationEnabled: boolean, isConfusionFeedbackEnabled: boolean, isLiveQAEnabled: boolean, isModerationEnabled: boolean, blocks?: Array<{ __typename?: 'SessionBlock', id: number, numOfParticipants?: number | null, instances?: Array<{ __typename?: 'QuestionInstance', id: number, questionData?: { __typename: 'ChoicesQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'ContentQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'FlashcardQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'FreeTextQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'NumericalQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | null }> | null }> | null, course?: { __typename?: 'Course', id: string, name: string, displayName: string } | null }> | null };

export type GetUserTagsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetUserTagsQuery = { __typename?: 'Query', userTags?: Array<{ __typename?: 'Tag', id: number, name: string, order: number }> | null };

export type GroupActivityDetailsQueryVariables = Exact<{
  activityId: Scalars['String']['input'];
  groupId: Scalars['String']['input'];
}>;


export type GroupActivityDetailsQuery = { __typename?: 'Query', groupActivityDetails?: { __typename?: 'GroupActivityDetails', id: string, displayName: string, status: GroupActivityStatus, description?: string | null, scheduledStartAt?: any | null, scheduledEndAt?: any | null, clues: Array<{ __typename?: 'GroupActivityClue', id: number, displayName: string }>, stacks: Array<{ __typename?: 'ElementStack', id: number, type: ElementStackType, displayName?: string | null, description?: string | null, order?: number | null, elements?: Array<{ __typename?: 'ElementInstance', id: number, type: ElementInstanceType, elementType: ElementType, elementData: { __typename: 'ChoicesElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'ChoiceQuestionOptions', displayMode: ElementDisplayMode, choices: Array<{ __typename?: 'Choice', ix: number, value: string }> } } | { __typename: 'ContentElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename?: 'FlashcardElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number } | { __typename: 'FreeTextElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'FreeTextQuestionOptions', restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename: 'NumericalElementData', id: string, elementId: number, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier: number, options: { __typename?: 'NumericalQuestionOptions', accuracy?: number | null, placeholder?: string | null, unit?: string | null, restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null } } }> | null }>, course: { __typename?: 'Course', id: string, displayName: string, color: string }, group: { __typename?: 'ParticipantGroup', id: string, name: string, participants?: Array<{ __typename?: 'Participant', id: string, username: string, avatar?: string | null, isSelf?: boolean | null }> | null }, activityInstance?: { __typename?: 'GroupActivityInstance', id: number, decisionsSubmittedAt?: any | null, resultsComputedAt?: any | null, clues?: Array<{ __typename?: 'GroupActivityClueInstance', id: number, displayName: string, type: ParameterType, unit?: string | null, value?: string | null, participant: { __typename?: 'Participant', id: string, username: string, avatar?: string | null, isSelf?: boolean | null } }> | null, decisions?: Array<{ __typename?: 'GroupActivityDecision', instanceId: number, type: ElementType, freeTextResponse?: string | null, choicesResponse?: Array<number> | null, numericalResponse?: number | null, contentResponse?: boolean | null }> | null, results?: { __typename?: 'GroupActivityResults', passed: boolean, points: number, comment?: string | null, grading: Array<{ __typename?: 'GroupActivityGrading', instanceId: number, score: number, maxPoints: number, feedback?: string | null }> } | null } | null } | null };

export type ParticipationsQueryVariables = Exact<{
  endpoint?: InputMaybe<Scalars['String']['input']>;
}>;


export type ParticipationsQuery = { __typename?: 'Query', participations?: Array<{ __typename?: 'Participation', id: number, completedMicroLearnings: Array<string>, subscriptions?: Array<{ __typename?: 'PushSubscription', id: number, endpoint: string }> | null, course?: { __typename?: 'Course', id: string, displayName: string, startDate: any, endDate: any, description?: string | null, isGamificationEnabled: boolean, microLearnings?: Array<{ __typename?: 'MicroLearning', id: string, displayName: string, scheduledStartAt: any, scheduledEndAt: any }> | null, sessions?: Array<{ __typename?: 'Session', id: string, displayName: string, linkTo?: string | null }> | null } | null }> | null };

export type SelfQueryVariables = Exact<{ [key: string]: never; }>;


export type SelfQuery = { __typename?: 'Query', self?: { __typename?: 'Participant', id: string, email?: string | null, username: string, avatar?: string | null, isActive: boolean, isProfilePublic?: boolean | null, xp: number, level?: number | null, avatarSettings?: { __typename?: 'AvatarSettings', skinTone: string, eyes: string, mouth: string, hair: string, facialHair: string, accessory: string, hairColor: string, clothing: string, clothingColor: string } | null, levelData?: { __typename?: 'Level', id: number, index: number, name?: string | null, avatar?: string | null, requiredXp: number, nextLevel?: { __typename?: 'Level', id: number, index: number, requiredXp: number, avatar?: string | null, name?: string | null } | null } | null } | null };

export type SelfWithAchievementsQueryVariables = Exact<{ [key: string]: never; }>;


export type SelfWithAchievementsQuery = { __typename?: 'Query', selfWithAchievements?: { __typename?: 'ParticipantWithAchievements', participant: { __typename?: 'Participant', id: string, username: string, avatar?: string | null, xp: number, level?: number | null, avatarSettings?: { __typename?: 'AvatarSettings', skinTone: string, eyes: string, mouth: string, hair: string, facialHair: string, accessory: string, hairColor: string, clothing: string, clothingColor: string } | null, levelData?: { __typename?: 'Level', id: number, index: number, name?: string | null, avatar?: string | null, requiredXp: number, nextLevel?: { __typename?: 'Level', id: number, index: number, requiredXp: number, avatar?: string | null, name?: string | null } | null } | null, achievements?: Array<{ __typename?: 'ParticipantAchievementInstance', id: number, achievedAt: any, achievedCount: number, achievement: { __typename?: 'Achievement', id: number, nameDE?: string | null, nameEN?: string | null, descriptionDE?: string | null, descriptionEN?: string | null, icon: string, iconColor?: string | null } }> | null }, achievements: Array<{ __typename?: 'Achievement', id: number, nameDE?: string | null, nameEN?: string | null, descriptionDE?: string | null, descriptionEN?: string | null, icon: string, iconColor?: string | null }> } | null };

export type UserProfileQueryVariables = Exact<{ [key: string]: never; }>;


export type UserProfileQuery = { __typename?: 'Query', userProfile?: { __typename?: 'User', id: string, email: string, sendProjectUpdates: boolean, shortname: string, locale: LocaleType, firstLogin: boolean, catalyst: boolean, catalystTier?: string | null } | null };

export type FeedbackAddedSubscriptionVariables = Exact<{
  sessionId: Scalars['String']['input'];
}>;


export type FeedbackAddedSubscription = { __typename?: 'Subscription', feedbackAdded: { __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number, resolvedAt?: any | null, createdAt: any, responses?: Array<{ __typename?: 'FeedbackResponse', id: number, content: string, positiveReactions: number, negativeReactions: number }> | null } };

export type FeedbackCreatedSubscriptionVariables = Exact<{
  sessionId: Scalars['String']['input'];
}>;


export type FeedbackCreatedSubscription = { __typename?: 'Subscription', feedbackCreated: { __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number, resolvedAt?: any | null, createdAt: any, responses?: Array<{ __typename?: 'FeedbackResponse', id: number, content: string, positiveReactions: number, negativeReactions: number }> | null } };

export type FeedbackRemovedSubscriptionVariables = Exact<{
  sessionId: Scalars['String']['input'];
}>;


export type FeedbackRemovedSubscription = { __typename?: 'Subscription', feedbackRemoved: string };

export type FeedbackUpdatedSubscriptionVariables = Exact<{
  sessionId: Scalars['String']['input'];
}>;


export type FeedbackUpdatedSubscription = { __typename?: 'Subscription', feedbackUpdated: { __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number, resolvedAt?: any | null, createdAt: any, responses?: Array<{ __typename?: 'FeedbackResponse', id: number, content: string, positiveReactions: number, negativeReactions: number }> | null } };

export type GroupActivityEndedSubscriptionVariables = Exact<{
  courseId: Scalars['String']['input'];
}>;


export type GroupActivityEndedSubscription = { __typename?: 'Subscription', groupActivityEnded: { __typename?: 'GroupActivity', id: string, displayName: string, status: GroupActivityStatus, description?: string | null, scheduledStartAt: any, scheduledEndAt: any } };

export type GroupActivityStartedSubscriptionVariables = Exact<{
  courseId: Scalars['String']['input'];
}>;


export type GroupActivityStartedSubscription = { __typename?: 'Subscription', groupActivityStarted: { __typename?: 'GroupActivity', id: string, displayName: string, status: GroupActivityStatus, description?: string | null, scheduledStartAt: any, scheduledEndAt: any } };

export type MicroLearningEndedSubscriptionVariables = Exact<{
  activityId: Scalars['String']['input'];
}>;


export type MicroLearningEndedSubscription = { __typename?: 'Subscription', microLearningEnded: { __typename?: 'MicroLearning', id: string, displayName: string, scheduledStartAt: any, scheduledEndAt: any } };

export type RunningSessionUpdatedSubscriptionVariables = Exact<{
  sessionId: Scalars['String']['input'];
}>;


export type RunningSessionUpdatedSubscription = { __typename?: 'Subscription', runningSessionUpdated?: { __typename?: 'SessionBlock', id: number, status: SessionBlockStatus, expiresAt?: any | null, timeLimit?: number | null, randomSelection?: number | null, execution?: number | null, instances?: Array<{ __typename?: 'QuestionInstance', id: number, questionData?: { __typename: 'ChoicesQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null, options: { __typename?: 'ChoiceQuestionOptions', displayMode: ElementDisplayMode, choices: Array<{ __typename?: 'Choice', ix: number, value: string }> } } | { __typename: 'ContentQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'FlashcardQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null } | { __typename: 'FreeTextQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null, options: { __typename?: 'FreeTextQuestionOptions', restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename: 'NumericalQuestionData', id: string, questionId?: number | null, name: string, type: ElementType, content: string, explanation?: string | null, pointsMultiplier?: number | null, options: { __typename?: 'NumericalQuestionOptions', unit?: string | null, accuracy?: number | null, placeholder?: string | null, restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null } } | null }> | null } | null };

export type SingleGroupActivityEndedSubscriptionVariables = Exact<{
  activityId: Scalars['String']['input'];
}>;


export type SingleGroupActivityEndedSubscription = { __typename?: 'Subscription', singleGroupActivityEnded: { __typename?: 'GroupActivity', id: string, displayName: string, status: GroupActivityStatus, description?: string | null, scheduledStartAt: any, scheduledEndAt: any } };

export type UpdateParticipantAvatarMutationVariables = Exact<{
  avatar: Scalars['String']['input'];
  avatarSettings: AvatarSettingsInput;
}>;


export type UpdateParticipantAvatarMutation = { __typename?: 'Mutation', updateParticipantAvatar?: { __typename?: 'Participant', avatar?: string | null, avatarSettings?: { __typename?: 'AvatarSettings', skinTone: string, eyes: string, mouth: string, hair: string, facialHair: string, accessory: string, hairColor: string, clothing: string, clothingColor: string } | null } | null };

export const EvaluationResultsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EvaluationResults"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ActivityEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"stackId"}},{"kind":"Field","name":{"kind":"Name","value":"stackName"}},{"kind":"Field","name":{"kind":"Name","value":"stackDescription"}},{"kind":"Field","name":{"kind":"Name","value":"stackOrder"}},{"kind":"Field","name":{"kind":"Name","value":"instances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesElementInstanceEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"hasAnswerFeedbacks"}},{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"anonymousAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"count"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeElementInstanceEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"hasAnswerFeedbacks"}},{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"anonymousAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"maxLength"}},{"kind":"Field","name":{"kind":"Name","value":"solutions"}},{"kind":"Field","name":{"kind":"Name","value":"responses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalElementInstanceEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"hasAnswerFeedbacks"}},{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"anonymousAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"maxValue"}},{"kind":"Field","name":{"kind":"Name","value":"minValue"}},{"kind":"Field","name":{"kind":"Name","value":"solutionRanges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"responseValues"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardElementInstanceEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"hasAnswerFeedbacks"}},{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"anonymousAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"correctCount"}},{"kind":"Field","name":{"kind":"Name","value":"partialCount"}},{"kind":"Field","name":{"kind":"Name","value":"incorrectCount"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentElementInstanceEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"hasAnswerFeedbacks"}},{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"anonymousAnswers"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<EvaluationResultsFragment, unknown>;
export const ElementDataFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ElementData"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ElementInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"elementData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"displayMode"}},{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"accuracy"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutionRanges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutions"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}}]}}]}}]} as unknown as DocumentNode<ElementDataFragment, unknown>;
export const MicroLearningDataFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MicroLearningData"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MicroLearning"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStartAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledEndAt"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"color"}}]}},{"kind":"Field","name":{"kind":"Name","value":"stacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"order"}},{"kind":"Field","name":{"kind":"Name","value":"elements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"elementType"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"ElementData"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ElementData"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ElementInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"elementData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"displayMode"}},{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"accuracy"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutionRanges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutions"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}}]}}]}}]} as unknown as DocumentNode<MicroLearningDataFragment, unknown>;
export const ElementDataWithoutSolutionsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ElementDataWithoutSolutions"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ElementInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"elementData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"displayMode"}},{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accuracy"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}}]}}]}}]} as unknown as DocumentNode<ElementDataWithoutSolutionsFragment, unknown>;
export const MicroLearningDataWithoutSolutionsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MicroLearningDataWithoutSolutions"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MicroLearning"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStartAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledEndAt"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"color"}}]}},{"kind":"Field","name":{"kind":"Name","value":"stacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"order"}},{"kind":"Field","name":{"kind":"Name","value":"elements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"elementType"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"ElementDataWithoutSolutions"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ElementDataWithoutSolutions"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ElementInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"elementData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"displayMode"}},{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accuracy"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}}]}}]}}]} as unknown as DocumentNode<MicroLearningDataWithoutSolutionsFragment, unknown>;
export const PracticeQuizDataFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PracticeQuizData"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PracticeQuiz"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"resetTimeDays"}},{"kind":"Field","name":{"kind":"Name","value":"availableFrom"}},{"kind":"Field","name":{"kind":"Name","value":"orderType"}},{"kind":"Field","name":{"kind":"Name","value":"numOfStacks"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"color"}}]}},{"kind":"Field","name":{"kind":"Name","value":"stacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"order"}},{"kind":"Field","name":{"kind":"Name","value":"elements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"elementType"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"ElementData"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ElementData"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ElementInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"elementData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"displayMode"}},{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"accuracy"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutionRanges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutions"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}}]}}]}}]} as unknown as DocumentNode<PracticeQuizDataFragment, unknown>;
export const PracticeQuizDataWithoutSolutionsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PracticeQuizDataWithoutSolutions"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PracticeQuiz"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"resetTimeDays"}},{"kind":"Field","name":{"kind":"Name","value":"availableFrom"}},{"kind":"Field","name":{"kind":"Name","value":"orderType"}},{"kind":"Field","name":{"kind":"Name","value":"numOfStacks"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"color"}}]}},{"kind":"Field","name":{"kind":"Name","value":"stacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"order"}},{"kind":"Field","name":{"kind":"Name","value":"elements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"elementType"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"ElementDataWithoutSolutions"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ElementDataWithoutSolutions"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ElementInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"elementData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"displayMode"}},{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accuracy"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}}]}}]}}]} as unknown as DocumentNode<PracticeQuizDataWithoutSolutionsFragment, unknown>;
export const QuestionDataFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QuestionData"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QuestionInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"hasAnswerFeedbacks"}},{"kind":"Field","name":{"kind":"Name","value":"displayMode"}},{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"accuracy"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutionRanges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutions"}}]}}]}}]}}]}}]} as unknown as DocumentNode<QuestionDataFragment, unknown>;
export const QuestionDataInfoFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QuestionDataInfo"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QuestionInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}}]}}]}}]} as unknown as DocumentNode<QuestionDataInfoFragment, unknown>;
export const QuestionDataWithoutSolutionsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QuestionDataWithoutSolutions"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QuestionInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"displayMode"}},{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"accuracy"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}}]}}]}}]} as unknown as DocumentNode<QuestionDataWithoutSolutionsFragment, unknown>;
export const StackFeedbackEvaluationsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"StackFeedbackEvaluations"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"StackFeedback"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"evaluations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesInstanceEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"elementType"}},{"kind":"Field","name":{"kind":"Name","value":"instanceId"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"choices"}},{"kind":"Field","name":{"kind":"Name","value":"numAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"xp"}},{"kind":"Field","name":{"kind":"Name","value":"pointsAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"percentile"}},{"kind":"Field","name":{"kind":"Name","value":"newPointsFrom"}},{"kind":"Field","name":{"kind":"Name","value":"xpAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"newXpFrom"}},{"kind":"Field","name":{"kind":"Name","value":"correctness"}},{"kind":"Field","name":{"kind":"Name","value":"lastResponse"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"choices"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalInstanceEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"elementType"}},{"kind":"Field","name":{"kind":"Name","value":"instanceId"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"numAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"answers"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"xp"}},{"kind":"Field","name":{"kind":"Name","value":"pointsAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"percentile"}},{"kind":"Field","name":{"kind":"Name","value":"newPointsFrom"}},{"kind":"Field","name":{"kind":"Name","value":"xpAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"newXpFrom"}},{"kind":"Field","name":{"kind":"Name","value":"solutionRanges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"lastResponse"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"correctness"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextInstanceEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"instanceId"}},{"kind":"Field","name":{"kind":"Name","value":"elementType"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"numAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"answers"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"xp"}},{"kind":"Field","name":{"kind":"Name","value":"pointsAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"percentile"}},{"kind":"Field","name":{"kind":"Name","value":"newPointsFrom"}},{"kind":"Field","name":{"kind":"Name","value":"xpAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"newXpFrom"}},{"kind":"Field","name":{"kind":"Name","value":"solutions"}},{"kind":"Field","name":{"kind":"Name","value":"lastResponse"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"correctness"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardInstanceEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"instanceId"}},{"kind":"Field","name":{"kind":"Name","value":"elementType"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"numAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"xp"}},{"kind":"Field","name":{"kind":"Name","value":"pointsAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"percentile"}},{"kind":"Field","name":{"kind":"Name","value":"newPointsFrom"}},{"kind":"Field","name":{"kind":"Name","value":"xpAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"newXpFrom"}},{"kind":"Field","name":{"kind":"Name","value":"lastResponse"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"correctness"}}]}},{"kind":"Field","name":{"kind":"Name","value":"correctness"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentInstanceEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"instanceId"}},{"kind":"Field","name":{"kind":"Name","value":"elementType"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"numAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"xp"}},{"kind":"Field","name":{"kind":"Name","value":"pointsAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"percentile"}},{"kind":"Field","name":{"kind":"Name","value":"newPointsFrom"}},{"kind":"Field","name":{"kind":"Name","value":"xpAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"newXpFrom"}},{"kind":"Field","name":{"kind":"Name","value":"lastResponse"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"viewed"}}]}},{"kind":"Field","name":{"kind":"Name","value":"correctness"}}]}}]}}]}}]} as unknown as DocumentNode<StackFeedbackEvaluationsFragment, unknown>;
export const ActivateParticipantAccountDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ActivateParticipantAccount"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"token"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"activateParticipantAccount"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"token"},"value":{"kind":"Variable","name":{"kind":"Name","value":"token"}}}]}]}}]} as unknown as DocumentNode<ActivateParticipantAccountMutation, ActivateParticipantAccountMutationVariables>;
export const ActivateSessionBlockDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ActivateSessionBlock"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionBlockId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"activateSessionBlock"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"sessionBlockId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionBlockId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"blocks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]}}]} as unknown as DocumentNode<ActivateSessionBlockMutation, ActivateSessionBlockMutationVariables>;
export const AddConfusionTimestepDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddConfusionTimestep"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"difficulty"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"speed"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addConfusionTimestep"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"difficulty"},"value":{"kind":"Variable","name":{"kind":"Name","value":"difficulty"}}},{"kind":"Argument","name":{"kind":"Name","value":"speed"},"value":{"kind":"Variable","name":{"kind":"Name","value":"speed"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"speed"}}]}}]}}]} as unknown as DocumentNode<AddConfusionTimestepMutation, AddConfusionTimestepMutationVariables>;
export const AddMessageToGroupDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddMessageToGroup"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"groupId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"content"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addMessageToGroup"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"groupId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"groupId"}}},{"kind":"Argument","name":{"kind":"Name","value":"content"},"value":{"kind":"Variable","name":{"kind":"Name","value":"content"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"participant"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}}]}}]}}]} as unknown as DocumentNode<AddMessageToGroupMutation, AddMessageToGroupMutationVariables>;
export const BookmarkElementStackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"BookmarkElementStack"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"stackId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"bookmarked"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"bookmarkElementStack"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"stackId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"stackId"}}},{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"bookmarked"},"value":{"kind":"Variable","name":{"kind":"Name","value":"bookmarked"}}}]}]}}]} as unknown as DocumentNode<BookmarkElementStackMutation, BookmarkElementStackMutationVariables>;
export const CancelSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CancelSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cancelSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<CancelSessionMutation, CancelSessionMutationVariables>;
export const ChangeEmailSettingsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ChangeEmailSettings"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"projectUpdates"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"changeEmailSettings"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"projectUpdates"},"value":{"kind":"Variable","name":{"kind":"Name","value":"projectUpdates"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"sendProjectUpdates"}}]}}]}}]} as unknown as DocumentNode<ChangeEmailSettingsMutation, ChangeEmailSettingsMutationVariables>;
export const ChangeInitialSettingsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ChangeInitialSettings"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shortname"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"locale"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LocaleType"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sendUpdates"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"changeInitialSettings"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"shortname"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shortname"}}},{"kind":"Argument","name":{"kind":"Name","value":"locale"},"value":{"kind":"Variable","name":{"kind":"Name","value":"locale"}}},{"kind":"Argument","name":{"kind":"Name","value":"sendUpdates"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sendUpdates"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"shortname"}},{"kind":"Field","name":{"kind":"Name","value":"locale"}},{"kind":"Field","name":{"kind":"Name","value":"firstLogin"}},{"kind":"Field","name":{"kind":"Name","value":"catalyst"}},{"kind":"Field","name":{"kind":"Name","value":"catalystTier"}}]}}]}}]} as unknown as DocumentNode<ChangeInitialSettingsMutation, ChangeInitialSettingsMutationVariables>;
export const ChangeLiveQuizNameDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ChangeLiveQuizName"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"displayName"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"changeLiveQuizName"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"displayName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"displayName"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]} as unknown as DocumentNode<ChangeLiveQuizNameMutation, ChangeLiveQuizNameMutationVariables>;
export const ChangeParticipantLocaleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ChangeParticipantLocale"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"locale"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LocaleType"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"changeParticipantLocale"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"locale"},"value":{"kind":"Variable","name":{"kind":"Name","value":"locale"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"locale"}}]}}]}}]} as unknown as DocumentNode<ChangeParticipantLocaleMutation, ChangeParticipantLocaleMutationVariables>;
export const ChangeSessionSettingsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ChangeSessionSettings"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isLiveQAEnabled"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isConfusionFeedbackEnabled"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isModerationEnabled"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isGamificationEnabled"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"changeSessionSettings"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"isLiveQAEnabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isLiveQAEnabled"}}},{"kind":"Argument","name":{"kind":"Name","value":"isConfusionFeedbackEnabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isConfusionFeedbackEnabled"}}},{"kind":"Argument","name":{"kind":"Name","value":"isModerationEnabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isModerationEnabled"}}},{"kind":"Argument","name":{"kind":"Name","value":"isGamificationEnabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isGamificationEnabled"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isLiveQAEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isConfusionFeedbackEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isModerationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isGamificationEnabled"}}]}}]}}]} as unknown as DocumentNode<ChangeSessionSettingsMutation, ChangeSessionSettingsMutationVariables>;
export const ChangeShortnameDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ChangeShortname"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shortname"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"changeShortname"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"shortname"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shortname"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"shortname"}}]}}]}}]} as unknown as DocumentNode<ChangeShortnameMutation, ChangeShortnameMutationVariables>;
export const ChangeUserLocaleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ChangeUserLocale"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"locale"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LocaleType"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"changeUserLocale"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"locale"},"value":{"kind":"Variable","name":{"kind":"Name","value":"locale"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"locale"}}]}}]}}]} as unknown as DocumentNode<ChangeUserLocaleMutation, ChangeUserLocaleMutationVariables>;
export const CreateCourseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateCourse"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"displayName"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"color"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"startDate"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"endDate"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isGroupCreationEnabled"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"groupDeadlineDate"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"maxGroupSize"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"preferredGroupSize"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"notificationEmail"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isGamificationEnabled"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createCourse"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"displayName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"displayName"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}},{"kind":"Argument","name":{"kind":"Name","value":"color"},"value":{"kind":"Variable","name":{"kind":"Name","value":"color"}}},{"kind":"Argument","name":{"kind":"Name","value":"startDate"},"value":{"kind":"Variable","name":{"kind":"Name","value":"startDate"}}},{"kind":"Argument","name":{"kind":"Name","value":"endDate"},"value":{"kind":"Variable","name":{"kind":"Name","value":"endDate"}}},{"kind":"Argument","name":{"kind":"Name","value":"isGroupCreationEnabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isGroupCreationEnabled"}}},{"kind":"Argument","name":{"kind":"Name","value":"groupDeadlineDate"},"value":{"kind":"Variable","name":{"kind":"Name","value":"groupDeadlineDate"}}},{"kind":"Argument","name":{"kind":"Name","value":"maxGroupSize"},"value":{"kind":"Variable","name":{"kind":"Name","value":"maxGroupSize"}}},{"kind":"Argument","name":{"kind":"Name","value":"preferredGroupSize"},"value":{"kind":"Variable","name":{"kind":"Name","value":"preferredGroupSize"}}},{"kind":"Argument","name":{"kind":"Name","value":"notificationEmail"},"value":{"kind":"Variable","name":{"kind":"Name","value":"notificationEmail"}}},{"kind":"Argument","name":{"kind":"Name","value":"isGamificationEnabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isGamificationEnabled"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"color"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"isGroupCreationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"groupDeadlineDate"}},{"kind":"Field","name":{"kind":"Name","value":"maxGroupSize"}},{"kind":"Field","name":{"kind":"Name","value":"preferredGroupSize"}},{"kind":"Field","name":{"kind":"Name","value":"notificationEmail"}},{"kind":"Field","name":{"kind":"Name","value":"isGamificationEnabled"}}]}}]}}]} as unknown as DocumentNode<CreateCourseMutation, CreateCourseMutationVariables>;
export const CreateFeedbackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateFeedback"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"content"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createFeedback"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"content"},"value":{"kind":"Variable","name":{"kind":"Name","value":"content"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}}]}}]}}]} as unknown as DocumentNode<CreateFeedbackMutation, CreateFeedbackMutationVariables>;
export const CreateGroupActivityDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateGroupActivity"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"displayName"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"multiplier"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"startDate"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"endDate"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"clues"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"GroupActivityClueInput"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"stack"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ElementStackInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createGroupActivity"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"displayName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"displayName"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}},{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"multiplier"},"value":{"kind":"Variable","name":{"kind":"Name","value":"multiplier"}}},{"kind":"Argument","name":{"kind":"Name","value":"startDate"},"value":{"kind":"Variable","name":{"kind":"Name","value":"startDate"}}},{"kind":"Argument","name":{"kind":"Name","value":"endDate"},"value":{"kind":"Variable","name":{"kind":"Name","value":"endDate"}}},{"kind":"Argument","name":{"kind":"Name","value":"clues"},"value":{"kind":"Variable","name":{"kind":"Name","value":"clues"}}},{"kind":"Argument","name":{"kind":"Name","value":"stack"},"value":{"kind":"Variable","name":{"kind":"Name","value":"stack"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStartAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledEndAt"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}}]}}]} as unknown as DocumentNode<CreateGroupActivityMutation, CreateGroupActivityMutationVariables>;
export const CreateMicroLearningDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateMicroLearning"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"displayName"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"stacks"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ElementStackInput"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"multiplier"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"startDate"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"endDate"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createMicroLearning"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"displayName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"displayName"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}},{"kind":"Argument","name":{"kind":"Name","value":"stacks"},"value":{"kind":"Variable","name":{"kind":"Name","value":"stacks"}}},{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"multiplier"},"value":{"kind":"Variable","name":{"kind":"Name","value":"multiplier"}}},{"kind":"Argument","name":{"kind":"Name","value":"startDate"},"value":{"kind":"Variable","name":{"kind":"Name","value":"startDate"}}},{"kind":"Argument","name":{"kind":"Name","value":"endDate"},"value":{"kind":"Variable","name":{"kind":"Name","value":"endDate"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStartAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledEndAt"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"stacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"elements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"ElementData"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ElementData"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ElementInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"elementData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"displayMode"}},{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"accuracy"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutionRanges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutions"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}}]}}]}}]} as unknown as DocumentNode<CreateMicroLearningMutation, CreateMicroLearningMutationVariables>;
export const CreateParticipantAccountDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateParticipantAccount"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"username"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isProfilePublic"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"signedLtiData"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createParticipantAccount"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}},{"kind":"Argument","name":{"kind":"Name","value":"username"},"value":{"kind":"Variable","name":{"kind":"Name","value":"username"}}},{"kind":"Argument","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}},{"kind":"Argument","name":{"kind":"Name","value":"isProfilePublic"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isProfilePublic"}}},{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"signedLtiData"},"value":{"kind":"Variable","name":{"kind":"Name","value":"signedLtiData"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"participantToken"}},{"kind":"Field","name":{"kind":"Name","value":"participant"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"username"}}]}}]}}]}}]} as unknown as DocumentNode<CreateParticipantAccountMutation, CreateParticipantAccountMutationVariables>;
export const CreateParticipantGroupDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateParticipantGroup"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createParticipantGroup"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"participants"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}}]}}]}}]}}]} as unknown as DocumentNode<CreateParticipantGroupMutation, CreateParticipantGroupMutationVariables>;
export const CreatePracticeQuizDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreatePracticeQuiz"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"displayName"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"stacks"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ElementStackInput"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"multiplier"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"order"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ElementOrderType"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"availableFrom"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"resetTimeDays"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createPracticeQuiz"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"displayName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"displayName"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}},{"kind":"Argument","name":{"kind":"Name","value":"stacks"},"value":{"kind":"Variable","name":{"kind":"Name","value":"stacks"}}},{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"multiplier"},"value":{"kind":"Variable","name":{"kind":"Name","value":"multiplier"}}},{"kind":"Argument","name":{"kind":"Name","value":"order"},"value":{"kind":"Variable","name":{"kind":"Name","value":"order"}}},{"kind":"Argument","name":{"kind":"Name","value":"availableFrom"},"value":{"kind":"Variable","name":{"kind":"Name","value":"availableFrom"}}},{"kind":"Argument","name":{"kind":"Name","value":"resetTimeDays"},"value":{"kind":"Variable","name":{"kind":"Name","value":"resetTimeDays"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"resetTimeDays"}},{"kind":"Field","name":{"kind":"Name","value":"orderType"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"stacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"elements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"ElementData"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ElementData"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ElementInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"elementData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"displayMode"}},{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"accuracy"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutionRanges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutions"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}}]}}]}}]} as unknown as DocumentNode<CreatePracticeQuizMutation, CreatePracticeQuizMutationVariables>;
export const CreateSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"displayName"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"blocks"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"BlockInput"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"multiplier"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"maxBonusPoints"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"timeToZeroBonus"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isGamificationEnabled"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isConfusionFeedbackEnabled"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isLiveQAEnabled"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isModerationEnabled"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"displayName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"displayName"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}},{"kind":"Argument","name":{"kind":"Name","value":"blocks"},"value":{"kind":"Variable","name":{"kind":"Name","value":"blocks"}}},{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"multiplier"},"value":{"kind":"Variable","name":{"kind":"Name","value":"multiplier"}}},{"kind":"Argument","name":{"kind":"Name","value":"maxBonusPoints"},"value":{"kind":"Variable","name":{"kind":"Name","value":"maxBonusPoints"}}},{"kind":"Argument","name":{"kind":"Name","value":"timeToZeroBonus"},"value":{"kind":"Variable","name":{"kind":"Name","value":"timeToZeroBonus"}}},{"kind":"Argument","name":{"kind":"Name","value":"isGamificationEnabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isGamificationEnabled"}}},{"kind":"Argument","name":{"kind":"Name","value":"isConfusionFeedbackEnabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isConfusionFeedbackEnabled"}}},{"kind":"Argument","name":{"kind":"Name","value":"isLiveQAEnabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isLiveQAEnabled"}}},{"kind":"Argument","name":{"kind":"Name","value":"isModerationEnabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isModerationEnabled"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"blocks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"timeLimit"}},{"kind":"Field","name":{"kind":"Name","value":"instances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"QuestionDataInfo"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"isGamificationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isConfusionFeedbackEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isLiveQAEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isModerationEnabled"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QuestionDataInfo"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QuestionInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}}]}}]}}]} as unknown as DocumentNode<CreateSessionMutation, CreateSessionMutationVariables>;
export const CreateUserLoginDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateUserLogin"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"scope"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UserLoginScope"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createUserLogin"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"scope"},"value":{"kind":"Variable","name":{"kind":"Name","value":"scope"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"scope"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"shortname"}}]}}]}}]}}]} as unknown as DocumentNode<CreateUserLoginMutation, CreateUserLoginMutationVariables>;
export const DeactivateSessionBlockDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeactivateSessionBlock"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionBlockId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deactivateSessionBlock"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"sessionBlockId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionBlockId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"activeBlock"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"blocks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]}}]} as unknown as DocumentNode<DeactivateSessionBlockMutation, DeactivateSessionBlockMutationVariables>;
export const DeleteCourseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteCourse"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteCourse"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteCourseMutation, DeleteCourseMutationVariables>;
export const DeleteFeedbackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteFeedback"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteFeedback"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteFeedbackMutation, DeleteFeedbackMutationVariables>;
export const DeleteFeedbackResponseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteFeedbackResponse"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteFeedbackResponse"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"responses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"positiveReactions"}},{"kind":"Field","name":{"kind":"Name","value":"negativeReactions"}}]}}]}}]}}]} as unknown as DocumentNode<DeleteFeedbackResponseMutation, DeleteFeedbackResponseMutationVariables>;
export const DeleteGroupActivityDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteGroupActivity"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteGroupActivity"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteGroupActivityMutation, DeleteGroupActivityMutationVariables>;
export const DeleteLiveQuizDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteLiveQuiz"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteLiveQuiz"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteLiveQuizMutation, DeleteLiveQuizMutationVariables>;
export const DeleteMicroLearningDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteMicroLearning"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteMicroLearning"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteMicroLearningMutation, DeleteMicroLearningMutationVariables>;
export const DeleteParticipantAccountDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteParticipantAccount"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteParticipantAccount"}}]}}]} as unknown as DocumentNode<DeleteParticipantAccountMutation, DeleteParticipantAccountMutationVariables>;
export const DeletePracticeQuizDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeletePracticeQuiz"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deletePracticeQuiz"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeletePracticeQuizMutation, DeletePracticeQuizMutationVariables>;
export const DeleteQuestionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteQuestion"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteQuestion"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesElement"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalElement"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextElement"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardElement"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentElement"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode<DeleteQuestionMutation, DeleteQuestionMutationVariables>;
export const DeleteTagDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteTag"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteTag"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteTagMutation, DeleteTagMutationVariables>;
export const DeleteUserLoginDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteUserLogin"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteUserLogin"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteUserLoginMutation, DeleteUserLoginMutationVariables>;
export const EditGroupActivityDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"EditGroupActivity"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"displayName"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"multiplier"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"startDate"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"endDate"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"clues"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"GroupActivityClueInput"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"stack"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ElementStackInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"editGroupActivity"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"displayName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"displayName"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}},{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"multiplier"},"value":{"kind":"Variable","name":{"kind":"Name","value":"multiplier"}}},{"kind":"Argument","name":{"kind":"Name","value":"startDate"},"value":{"kind":"Variable","name":{"kind":"Name","value":"startDate"}}},{"kind":"Argument","name":{"kind":"Name","value":"endDate"},"value":{"kind":"Variable","name":{"kind":"Name","value":"endDate"}}},{"kind":"Argument","name":{"kind":"Name","value":"clues"},"value":{"kind":"Variable","name":{"kind":"Name","value":"clues"}}},{"kind":"Argument","name":{"kind":"Name","value":"stack"},"value":{"kind":"Variable","name":{"kind":"Name","value":"stack"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStartAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledEndAt"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}}]}}]} as unknown as DocumentNode<EditGroupActivityMutation, EditGroupActivityMutationVariables>;
export const EditMicroLearningDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"EditMicroLearning"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"displayName"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"stacks"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ElementStackInput"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"multiplier"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"startDate"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"endDate"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"editMicroLearning"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"displayName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"displayName"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}},{"kind":"Argument","name":{"kind":"Name","value":"stacks"},"value":{"kind":"Variable","name":{"kind":"Name","value":"stacks"}}},{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"multiplier"},"value":{"kind":"Variable","name":{"kind":"Name","value":"multiplier"}}},{"kind":"Argument","name":{"kind":"Name","value":"startDate"},"value":{"kind":"Variable","name":{"kind":"Name","value":"startDate"}}},{"kind":"Argument","name":{"kind":"Name","value":"endDate"},"value":{"kind":"Variable","name":{"kind":"Name","value":"endDate"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStartAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledEndAt"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"stacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"elements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"ElementData"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ElementData"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ElementInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"elementData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"displayMode"}},{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"accuracy"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutionRanges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutions"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}}]}}]}}]} as unknown as DocumentNode<EditMicroLearningMutation, EditMicroLearningMutationVariables>;
export const EditPracticeQuizDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"EditPracticeQuiz"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"displayName"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"stacks"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ElementStackInput"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"multiplier"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"order"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ElementOrderType"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"availableFrom"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"resetTimeDays"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"editPracticeQuiz"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"displayName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"displayName"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}},{"kind":"Argument","name":{"kind":"Name","value":"stacks"},"value":{"kind":"Variable","name":{"kind":"Name","value":"stacks"}}},{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"multiplier"},"value":{"kind":"Variable","name":{"kind":"Name","value":"multiplier"}}},{"kind":"Argument","name":{"kind":"Name","value":"order"},"value":{"kind":"Variable","name":{"kind":"Name","value":"order"}}},{"kind":"Argument","name":{"kind":"Name","value":"availableFrom"},"value":{"kind":"Variable","name":{"kind":"Name","value":"availableFrom"}}},{"kind":"Argument","name":{"kind":"Name","value":"resetTimeDays"},"value":{"kind":"Variable","name":{"kind":"Name","value":"resetTimeDays"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"resetTimeDays"}},{"kind":"Field","name":{"kind":"Name","value":"orderType"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"stacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"order"}},{"kind":"Field","name":{"kind":"Name","value":"elements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"ElementData"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ElementData"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ElementInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"elementData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"displayMode"}},{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"accuracy"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutionRanges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutions"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}}]}}]}}]} as unknown as DocumentNode<EditPracticeQuizMutation, EditPracticeQuizMutationVariables>;
export const EditSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"EditSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"displayName"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"blocks"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"BlockInput"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"multiplier"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"maxBonusPoints"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"timeToZeroBonus"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isGamificationEnabled"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isConfusionFeedbackEnabled"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isLiveQAEnabled"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isModerationEnabled"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"editSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"displayName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"displayName"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}},{"kind":"Argument","name":{"kind":"Name","value":"blocks"},"value":{"kind":"Variable","name":{"kind":"Name","value":"blocks"}}},{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"multiplier"},"value":{"kind":"Variable","name":{"kind":"Name","value":"multiplier"}}},{"kind":"Argument","name":{"kind":"Name","value":"maxBonusPoints"},"value":{"kind":"Variable","name":{"kind":"Name","value":"maxBonusPoints"}}},{"kind":"Argument","name":{"kind":"Name","value":"timeToZeroBonus"},"value":{"kind":"Variable","name":{"kind":"Name","value":"timeToZeroBonus"}}},{"kind":"Argument","name":{"kind":"Name","value":"isGamificationEnabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isGamificationEnabled"}}},{"kind":"Argument","name":{"kind":"Name","value":"isConfusionFeedbackEnabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isConfusionFeedbackEnabled"}}},{"kind":"Argument","name":{"kind":"Name","value":"isLiveQAEnabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isLiveQAEnabled"}}},{"kind":"Argument","name":{"kind":"Name","value":"isModerationEnabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isModerationEnabled"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"blocks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"timeLimit"}},{"kind":"Field","name":{"kind":"Name","value":"instances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"QuestionDataInfo"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"isGamificationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isConfusionFeedbackEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isLiveQAEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isModerationEnabled"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QuestionDataInfo"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QuestionInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}}]}}]}}]} as unknown as DocumentNode<EditSessionMutation, EditSessionMutationVariables>;
export const EditTagDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"EditTag"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"editTag"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<EditTagMutation, EditTagMutationVariables>;
export const EnableCourseGamificationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"EnableCourseGamification"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"enableCourseGamification"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isGamificationEnabled"}}]}}]}}]} as unknown as DocumentNode<EnableCourseGamificationMutation, EnableCourseGamificationMutationVariables>;
export const EndGroupActivityDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"EndGroupActivity"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"endGroupActivity"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledEndAt"}}]}}]}}]} as unknown as DocumentNode<EndGroupActivityMutation, EndGroupActivityMutationVariables>;
export const EndMicroLearningDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"EndMicroLearning"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"endMicroLearning"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledEndAt"}}]}}]}}]} as unknown as DocumentNode<EndMicroLearningMutation, EndMicroLearningMutationVariables>;
export const EndSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"EndSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"endSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<EndSessionMutation, EndSessionMutationVariables>;
export const ExtendGroupActivityDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ExtendGroupActivity"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"endDate"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"extendGroupActivity"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"endDate"},"value":{"kind":"Variable","name":{"kind":"Name","value":"endDate"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledEndAt"}}]}}]}}]} as unknown as DocumentNode<ExtendGroupActivityMutation, ExtendGroupActivityMutationVariables>;
export const ExtendMicroLearningDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ExtendMicroLearning"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"endDate"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"extendMicroLearning"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"endDate"},"value":{"kind":"Variable","name":{"kind":"Name","value":"endDate"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledEndAt"}}]}}]}}]} as unknown as DocumentNode<ExtendMicroLearningMutation, ExtendMicroLearningMutationVariables>;
export const FinalRandomGroupAssignmentsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"FinalRandomGroupAssignments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"finalRandomGroupAssignments"}}]}}]} as unknown as DocumentNode<FinalRandomGroupAssignmentsMutation, FinalRandomGroupAssignmentsMutationVariables>;
export const FinalizeGroupActivityGradingDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"FinalizeGroupActivityGrading"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"finalizeGroupActivityGrading"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<FinalizeGroupActivityGradingMutation, FinalizeGroupActivityGradingMutationVariables>;
export const FlagElementDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"FlagElement"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"elementInstanceId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"elementId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"content"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"flagElement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"elementInstanceId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"elementInstanceId"}}},{"kind":"Argument","name":{"kind":"Name","value":"elementId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"elementId"}}},{"kind":"Argument","name":{"kind":"Name","value":"content"},"value":{"kind":"Variable","name":{"kind":"Name","value":"content"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"upvote"}},{"kind":"Field","name":{"kind":"Name","value":"downvote"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}}]}}]}}]} as unknown as DocumentNode<FlagElementMutation, FlagElementMutationVariables>;
export const GenerateLoginTokenDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"GenerateLoginToken"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"generateLoginToken"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"loginToken"}},{"kind":"Field","name":{"kind":"Name","value":"loginTokenExpiresAt"}}]}}]}}]} as unknown as DocumentNode<GenerateLoginTokenMutation, GenerateLoginTokenMutationVariables>;
export const GetFileUploadSasDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"GetFileUploadSas"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"fileName"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"contentType"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getFileUploadSas"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"fileName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"fileName"}}},{"kind":"Argument","name":{"kind":"Name","value":"contentType"},"value":{"kind":"Variable","name":{"kind":"Name","value":"contentType"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"uploadSasURL"}},{"kind":"Field","name":{"kind":"Name","value":"uploadHref"}},{"kind":"Field","name":{"kind":"Name","value":"containerName"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}}]}}]}}]} as unknown as DocumentNode<GetFileUploadSasMutation, GetFileUploadSasMutationVariables>;
export const GradeGroupActivitySubmissionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"GradeGroupActivitySubmission"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"gradingDecisions"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"GroupActivityGradingInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"gradeGroupActivitySubmission"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"gradingDecisions"},"value":{"kind":"Variable","name":{"kind":"Name","value":"gradingDecisions"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"decisionsSubmittedAt"}},{"kind":"Field","name":{"kind":"Name","value":"decisions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"instanceId"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"freeTextResponse"}},{"kind":"Field","name":{"kind":"Name","value":"choicesResponse"}},{"kind":"Field","name":{"kind":"Name","value":"numericalResponse"}},{"kind":"Field","name":{"kind":"Name","value":"contentResponse"}}]}},{"kind":"Field","name":{"kind":"Name","value":"resultsComputedAt"}},{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"passed"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"comment"}},{"kind":"Field","name":{"kind":"Name","value":"grading"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"instanceId"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"maxPoints"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GradeGroupActivitySubmissionMutation, GradeGroupActivitySubmissionMutationVariables>;
export const JoinCourseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"JoinCourse"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"joinCourse"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"participation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}}]}}]}}]}}]} as unknown as DocumentNode<JoinCourseMutation, JoinCourseMutationVariables>;
export const JoinCourseWithPinDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"JoinCourseWithPin"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pin"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"joinCourseWithPin"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pin"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<JoinCourseWithPinMutation, JoinCourseWithPinMutationVariables>;
export const JoinParticipantGroupDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"JoinParticipantGroup"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"code"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"joinParticipantGroup"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"code"},"value":{"kind":"Variable","name":{"kind":"Name","value":"code"}}}]}]}}]} as unknown as DocumentNode<JoinParticipantGroupMutation, JoinParticipantGroupMutationVariables>;
export const JoinRandomCourseGroupPoolDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"JoinRandomCourseGroupPool"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"joinRandomCourseGroupPool"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}]}]}}]} as unknown as DocumentNode<JoinRandomCourseGroupPoolMutation, JoinRandomCourseGroupPoolMutationVariables>;
export const LeaveCourseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LeaveCourse"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"leaveCourse"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"participation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}}]}}]}}]}}]} as unknown as DocumentNode<LeaveCourseMutation, LeaveCourseMutationVariables>;
export const LeaveParticipantGroupDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LeaveParticipantGroup"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"groupId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"leaveParticipantGroup"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"groupId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"groupId"}}},{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"participants"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}}]}}]}}]}}]} as unknown as DocumentNode<LeaveParticipantGroupMutation, LeaveParticipantGroupMutationVariables>;
export const LeaveRandomCourseGroupPoolDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LeaveRandomCourseGroupPool"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"leaveRandomCourseGroupPool"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}]}]}}]} as unknown as DocumentNode<LeaveRandomCourseGroupPoolMutation, LeaveRandomCourseGroupPoolMutationVariables>;
export const LoginParticipantDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LoginParticipant"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"usernameOrEmail"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"loginParticipant"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"usernameOrEmail"},"value":{"kind":"Variable","name":{"kind":"Name","value":"usernameOrEmail"}}},{"kind":"Argument","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}}]}]}}]} as unknown as DocumentNode<LoginParticipantMutation, LoginParticipantMutationVariables>;
export const LoginParticipantMagicLinkDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LoginParticipantMagicLink"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"token"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"loginParticipantMagicLink"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"token"},"value":{"kind":"Variable","name":{"kind":"Name","value":"token"}}}]}]}}]} as unknown as DocumentNode<LoginParticipantMagicLinkMutation, LoginParticipantMagicLinkMutationVariables>;
export const LoginParticipantWithLtiDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LoginParticipantWithLti"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"signedLtiData"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"loginParticipantWithLti"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"signedLtiData"},"value":{"kind":"Variable","name":{"kind":"Name","value":"signedLtiData"}}},{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"participant"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"participantToken"}}]}}]}}]} as unknown as DocumentNode<LoginParticipantWithLtiMutation, LoginParticipantWithLtiMutationVariables>;
export const LoginUserTokenDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LoginUserToken"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shortname"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"token"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"loginUserToken"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"shortname"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shortname"}}},{"kind":"Argument","name":{"kind":"Name","value":"token"},"value":{"kind":"Variable","name":{"kind":"Name","value":"token"}}}]}]}}]} as unknown as DocumentNode<LoginUserTokenMutation, LoginUserTokenMutationVariables>;
export const LogoutParticipantDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LogoutParticipant"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"logoutParticipant"}}]}}]} as unknown as DocumentNode<LogoutParticipantMutation, LogoutParticipantMutationVariables>;
export const LogoutUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LogoutUser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"logoutUser"}}]}}]} as unknown as DocumentNode<LogoutUserMutation, LogoutUserMutationVariables>;
export const ManipulateChoicesQuestionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ManipulateChoicesQuestion"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"status"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ElementStatus"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"type"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ElementType"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"content"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"explanation"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"options"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"OptionsChoicesInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pointsMultiplier"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tags"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"manipulateChoicesQuestion"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"status"},"value":{"kind":"Variable","name":{"kind":"Name","value":"status"}}},{"kind":"Argument","name":{"kind":"Name","value":"type"},"value":{"kind":"Variable","name":{"kind":"Name","value":"type"}}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"content"},"value":{"kind":"Variable","name":{"kind":"Name","value":"content"}}},{"kind":"Argument","name":{"kind":"Name","value":"explanation"},"value":{"kind":"Variable","name":{"kind":"Name","value":"explanation"}}},{"kind":"Argument","name":{"kind":"Name","value":"options"},"value":{"kind":"Variable","name":{"kind":"Name","value":"options"}}},{"kind":"Argument","name":{"kind":"Name","value":"pointsMultiplier"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pointsMultiplier"}}},{"kind":"Argument","name":{"kind":"Name","value":"tags"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tags"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesElement"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"displayMode"}},{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"hasAnswerFeedbacks"}},{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"tags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]} as unknown as DocumentNode<ManipulateChoicesQuestionMutation, ManipulateChoicesQuestionMutationVariables>;
export const ManipulateContentElementDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ManipulateContentElement"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"status"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ElementStatus"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"content"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pointsMultiplier"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tags"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"manipulateContentElement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"status"},"value":{"kind":"Variable","name":{"kind":"Name","value":"status"}}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"content"},"value":{"kind":"Variable","name":{"kind":"Name","value":"content"}}},{"kind":"Argument","name":{"kind":"Name","value":"pointsMultiplier"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pointsMultiplier"}}},{"kind":"Argument","name":{"kind":"Name","value":"tags"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tags"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentElement"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"tags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]} as unknown as DocumentNode<ManipulateContentElementMutation, ManipulateContentElementMutationVariables>;
export const ManipulateFlashcardElementDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ManipulateFlashcardElement"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"status"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ElementStatus"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"content"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"explanation"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pointsMultiplier"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tags"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"manipulateFlashcardElement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"status"},"value":{"kind":"Variable","name":{"kind":"Name","value":"status"}}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"content"},"value":{"kind":"Variable","name":{"kind":"Name","value":"content"}}},{"kind":"Argument","name":{"kind":"Name","value":"explanation"},"value":{"kind":"Variable","name":{"kind":"Name","value":"explanation"}}},{"kind":"Argument","name":{"kind":"Name","value":"pointsMultiplier"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pointsMultiplier"}}},{"kind":"Argument","name":{"kind":"Name","value":"tags"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tags"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardElement"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"tags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]} as unknown as DocumentNode<ManipulateFlashcardElementMutation, ManipulateFlashcardElementMutationVariables>;
export const ManipulateFreeTextQuestionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ManipulateFreeTextQuestion"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"status"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ElementStatus"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"content"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"explanation"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"options"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"OptionsFreeTextInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pointsMultiplier"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tags"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"manipulateFreeTextQuestion"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"status"},"value":{"kind":"Variable","name":{"kind":"Name","value":"status"}}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"content"},"value":{"kind":"Variable","name":{"kind":"Name","value":"content"}}},{"kind":"Argument","name":{"kind":"Name","value":"explanation"},"value":{"kind":"Variable","name":{"kind":"Name","value":"explanation"}}},{"kind":"Argument","name":{"kind":"Name","value":"options"},"value":{"kind":"Variable","name":{"kind":"Name","value":"options"}}},{"kind":"Argument","name":{"kind":"Name","value":"pointsMultiplier"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pointsMultiplier"}}},{"kind":"Argument","name":{"kind":"Name","value":"tags"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tags"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextElement"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutions"}}]}},{"kind":"Field","name":{"kind":"Name","value":"tags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]} as unknown as DocumentNode<ManipulateFreeTextQuestionMutation, ManipulateFreeTextQuestionMutationVariables>;
export const ManipulateNumericalQuestionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ManipulateNumericalQuestion"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"status"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ElementStatus"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"content"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"explanation"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"options"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"OptionsNumericalInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pointsMultiplier"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tags"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"manipulateNumericalQuestion"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"status"},"value":{"kind":"Variable","name":{"kind":"Name","value":"status"}}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"content"},"value":{"kind":"Variable","name":{"kind":"Name","value":"content"}}},{"kind":"Argument","name":{"kind":"Name","value":"explanation"},"value":{"kind":"Variable","name":{"kind":"Name","value":"explanation"}}},{"kind":"Argument","name":{"kind":"Name","value":"options"},"value":{"kind":"Variable","name":{"kind":"Name","value":"options"}}},{"kind":"Argument","name":{"kind":"Name","value":"pointsMultiplier"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pointsMultiplier"}}},{"kind":"Argument","name":{"kind":"Name","value":"tags"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tags"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalElement"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"accuracy"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutionRanges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"tags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]} as unknown as DocumentNode<ManipulateNumericalQuestionMutation, ManipulateNumericalQuestionMutationVariables>;
export const ManualRandomGroupAssignmentsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ManualRandomGroupAssignments"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"manualRandomGroupAssignments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"groupDeadlineDate"}},{"kind":"Field","name":{"kind":"Name","value":"randomAssignmentFinalized"}},{"kind":"Field","name":{"kind":"Name","value":"participantGroups"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"averageMemberScore"}},{"kind":"Field","name":{"kind":"Name","value":"groupActivityScore"}},{"kind":"Field","name":{"kind":"Name","value":"participants"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}}]}}]}}]}}]} as unknown as DocumentNode<ManualRandomGroupAssignmentsMutation, ManualRandomGroupAssignmentsMutationVariables>;
export const MarkMicroLearningCompletedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"MarkMicroLearningCompleted"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"markMicroLearningCompleted"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"completedMicroLearnings"}}]}}]}}]} as unknown as DocumentNode<MarkMicroLearningCompletedMutation, MarkMicroLearningCompletedMutationVariables>;
export const OpenGroupActivityDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"OpenGroupActivity"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"openGroupActivity"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStartAt"}}]}}]}}]} as unknown as DocumentNode<OpenGroupActivityMutation, OpenGroupActivityMutationVariables>;
export const PinFeedbackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"PinFeedback"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isPinned"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pinFeedback"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"isPinned"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isPinned"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}}]}}]}}]} as unknown as DocumentNode<PinFeedbackMutation, PinFeedbackMutationVariables>;
export const PublishFeedbackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"PublishFeedback"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isPublished"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"publishFeedback"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"isPublished"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isPublished"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}}]}}]}}]} as unknown as DocumentNode<PublishFeedbackMutation, PublishFeedbackMutationVariables>;
export const PublishGroupActivityDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"PublishGroupActivity"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"publishGroupActivity"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<PublishGroupActivityMutation, PublishGroupActivityMutationVariables>;
export const PublishMicroLearningDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"PublishMicroLearning"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"publishMicroLearning"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<PublishMicroLearningMutation, PublishMicroLearningMutationVariables>;
export const PublishPracticeQuizDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"PublishPracticeQuiz"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"publishPracticeQuiz"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<PublishPracticeQuizMutation, PublishPracticeQuizMutationVariables>;
export const RateElementDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RateElement"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"elementInstanceId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"elementId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"rating"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rateElement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"elementInstanceId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"elementInstanceId"}}},{"kind":"Argument","name":{"kind":"Name","value":"elementId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"elementId"}}},{"kind":"Argument","name":{"kind":"Name","value":"rating"},"value":{"kind":"Variable","name":{"kind":"Name","value":"rating"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"upvote"}},{"kind":"Field","name":{"kind":"Name","value":"downvote"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}}]}}]}}]} as unknown as DocumentNode<RateElementMutation, RateElementMutationVariables>;
export const RenameParticipantGroupDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RenameParticipantGroup"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"groupId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"renameParticipantGroup"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"groupId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"groupId"}}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<RenameParticipantGroupMutation, RenameParticipantGroupMutationVariables>;
export const RequestMigrationTokenDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RequestMigrationToken"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"requestMigrationToken"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}}]}]}}]} as unknown as DocumentNode<RequestMigrationTokenMutation, RequestMigrationTokenMutationVariables>;
export const ResolveFeedbackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResolveFeedback"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isResolved"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resolveFeedback"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"isResolved"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isResolved"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}}]}}]}}]} as unknown as DocumentNode<ResolveFeedbackMutation, ResolveFeedbackMutationVariables>;
export const RespondToElementStackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RespondToElementStack"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"stackId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"responses"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StackResponseInput"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"stackAnswerTime"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"respondToElementStack"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"stackId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"stackId"}}},{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"responses"},"value":{"kind":"Variable","name":{"kind":"Name","value":"responses"}}},{"kind":"Argument","name":{"kind":"Name","value":"stackAnswerTime"},"value":{"kind":"Variable","name":{"kind":"Name","value":"stackAnswerTime"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"StackFeedbackEvaluations"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"StackFeedbackEvaluations"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"StackFeedback"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"evaluations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesInstanceEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"elementType"}},{"kind":"Field","name":{"kind":"Name","value":"instanceId"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"choices"}},{"kind":"Field","name":{"kind":"Name","value":"numAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"xp"}},{"kind":"Field","name":{"kind":"Name","value":"pointsAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"percentile"}},{"kind":"Field","name":{"kind":"Name","value":"newPointsFrom"}},{"kind":"Field","name":{"kind":"Name","value":"xpAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"newXpFrom"}},{"kind":"Field","name":{"kind":"Name","value":"correctness"}},{"kind":"Field","name":{"kind":"Name","value":"lastResponse"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"choices"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalInstanceEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"elementType"}},{"kind":"Field","name":{"kind":"Name","value":"instanceId"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"numAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"answers"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"xp"}},{"kind":"Field","name":{"kind":"Name","value":"pointsAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"percentile"}},{"kind":"Field","name":{"kind":"Name","value":"newPointsFrom"}},{"kind":"Field","name":{"kind":"Name","value":"xpAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"newXpFrom"}},{"kind":"Field","name":{"kind":"Name","value":"solutionRanges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"lastResponse"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"correctness"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextInstanceEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"instanceId"}},{"kind":"Field","name":{"kind":"Name","value":"elementType"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"numAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"answers"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"xp"}},{"kind":"Field","name":{"kind":"Name","value":"pointsAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"percentile"}},{"kind":"Field","name":{"kind":"Name","value":"newPointsFrom"}},{"kind":"Field","name":{"kind":"Name","value":"xpAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"newXpFrom"}},{"kind":"Field","name":{"kind":"Name","value":"solutions"}},{"kind":"Field","name":{"kind":"Name","value":"lastResponse"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"correctness"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardInstanceEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"instanceId"}},{"kind":"Field","name":{"kind":"Name","value":"elementType"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"numAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"xp"}},{"kind":"Field","name":{"kind":"Name","value":"pointsAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"percentile"}},{"kind":"Field","name":{"kind":"Name","value":"newPointsFrom"}},{"kind":"Field","name":{"kind":"Name","value":"xpAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"newXpFrom"}},{"kind":"Field","name":{"kind":"Name","value":"lastResponse"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"correctness"}}]}},{"kind":"Field","name":{"kind":"Name","value":"correctness"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentInstanceEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"instanceId"}},{"kind":"Field","name":{"kind":"Name","value":"elementType"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"numAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"xp"}},{"kind":"Field","name":{"kind":"Name","value":"pointsAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"percentile"}},{"kind":"Field","name":{"kind":"Name","value":"newPointsFrom"}},{"kind":"Field","name":{"kind":"Name","value":"xpAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"newXpFrom"}},{"kind":"Field","name":{"kind":"Name","value":"lastResponse"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"viewed"}}]}},{"kind":"Field","name":{"kind":"Name","value":"correctness"}}]}}]}}]}}]} as unknown as DocumentNode<RespondToElementStackMutation, RespondToElementStackMutationVariables>;
export const RespondToFeedbackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RespondToFeedback"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"responseContent"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"respondToFeedback"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"responseContent"},"value":{"kind":"Variable","name":{"kind":"Name","value":"responseContent"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"responses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"positiveReactions"}},{"kind":"Field","name":{"kind":"Name","value":"negativeReactions"}}]}}]}}]}}]} as unknown as DocumentNode<RespondToFeedbackMutation, RespondToFeedbackMutationVariables>;
export const RunningRandomGroupAssignmentsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RunningRandomGroupAssignments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"runningRandomGroupAssignments"}}]}}]} as unknown as DocumentNode<RunningRandomGroupAssignmentsMutation, RunningRandomGroupAssignmentsMutationVariables>;
export const SendMagicLinkDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SendMagicLink"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"usernameOrEmail"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sendMagicLink"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"usernameOrEmail"},"value":{"kind":"Variable","name":{"kind":"Name","value":"usernameOrEmail"}}}]}]}}]} as unknown as DocumentNode<SendMagicLinkMutation, SendMagicLinkMutationVariables>;
export const SendPushNotificationsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SendPushNotifications"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sendPushNotifications"}}]}}]} as unknown as DocumentNode<SendPushNotificationsMutation, SendPushNotificationsMutationVariables>;
export const StartGroupActivityDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StartGroupActivity"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activityId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"groupId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startGroupActivity"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activityId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activityId"}}},{"kind":"Argument","name":{"kind":"Name","value":"groupId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"groupId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<StartGroupActivityMutation, StartGroupActivityMutationVariables>;
export const StartSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StartSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<StartSessionMutation, StartSessionMutationVariables>;
export const SubmitGroupActivityDecisionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SubmitGroupActivityDecisions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activityId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"responses"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"StackResponseInput"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"submitGroupActivityDecisions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activityId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activityId"}}},{"kind":"Argument","name":{"kind":"Name","value":"responses"},"value":{"kind":"Variable","name":{"kind":"Name","value":"responses"}}}]}]}}]} as unknown as DocumentNode<SubmitGroupActivityDecisionsMutation, SubmitGroupActivityDecisionsMutationVariables>;
export const SubscribeToPushDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SubscribeToPush"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"subscriptionObject"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SubscriptionObjectInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"subscribeToPush"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"subscriptionObject"},"value":{"kind":"Variable","name":{"kind":"Name","value":"subscriptionObject"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"subscriptions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"endpoint"}}]}}]}}]}}]} as unknown as DocumentNode<SubscribeToPushMutation, SubscribeToPushMutationVariables>;
export const ToggleArchiveCourseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ToggleArchiveCourse"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isArchived"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"toggleArchiveCourse"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"isArchived"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isArchived"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isArchived"}}]}}]}}]} as unknown as DocumentNode<ToggleArchiveCourseMutation, ToggleArchiveCourseMutationVariables>;
export const ToggleIsArchivedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ToggleIsArchived"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"questionIds"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isArchived"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"toggleIsArchived"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"questionIds"},"value":{"kind":"Variable","name":{"kind":"Name","value":"questionIds"}}},{"kind":"Argument","name":{"kind":"Name","value":"isArchived"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isArchived"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isArchived"}}]}}]}}]} as unknown as DocumentNode<ToggleIsArchivedMutation, ToggleIsArchivedMutationVariables>;
export const TriggerMigrationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"TriggerMigration"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"token"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"triggerMigration"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"token"},"value":{"kind":"Variable","name":{"kind":"Name","value":"token"}}}]}]}}]} as unknown as DocumentNode<TriggerMigrationMutation, TriggerMigrationMutationVariables>;
export const UnpublishGroupActivityDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UnpublishGroupActivity"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unpublishGroupActivity"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<UnpublishGroupActivityMutation, UnpublishGroupActivityMutationVariables>;
export const UnpublishMicroLearningDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UnpublishMicroLearning"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unpublishMicroLearning"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"numOfStacks"}}]}}]}}]} as unknown as DocumentNode<UnpublishMicroLearningMutation, UnpublishMicroLearningMutationVariables>;
export const UnpublishPracticeQuizDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UnpublishPracticeQuiz"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unpublishPracticeQuiz"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"numOfStacks"}}]}}]}}]} as unknown as DocumentNode<UnpublishPracticeQuizMutation, UnpublishPracticeQuizMutationVariables>;
export const UnsubscribeFromPushDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UnsubscribeFromPush"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"endpoint"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unsubscribeFromPush"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"endpoint"},"value":{"kind":"Variable","name":{"kind":"Name","value":"endpoint"}}}]}]}}]} as unknown as DocumentNode<UnsubscribeFromPushMutation, UnsubscribeFromPushMutationVariables>;
export const UpdateCourseSettingsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateCourseSettings"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"displayName"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"color"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"startDate"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"endDate"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isGroupCreationEnabled"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"groupDeadlineDate"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"notificationEmail"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isGamificationEnabled"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateCourseSettings"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"displayName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"displayName"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}},{"kind":"Argument","name":{"kind":"Name","value":"color"},"value":{"kind":"Variable","name":{"kind":"Name","value":"color"}}},{"kind":"Argument","name":{"kind":"Name","value":"startDate"},"value":{"kind":"Variable","name":{"kind":"Name","value":"startDate"}}},{"kind":"Argument","name":{"kind":"Name","value":"endDate"},"value":{"kind":"Variable","name":{"kind":"Name","value":"endDate"}}},{"kind":"Argument","name":{"kind":"Name","value":"isGroupCreationEnabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isGroupCreationEnabled"}}},{"kind":"Argument","name":{"kind":"Name","value":"groupDeadlineDate"},"value":{"kind":"Variable","name":{"kind":"Name","value":"groupDeadlineDate"}}},{"kind":"Argument","name":{"kind":"Name","value":"notificationEmail"},"value":{"kind":"Variable","name":{"kind":"Name","value":"notificationEmail"}}},{"kind":"Argument","name":{"kind":"Name","value":"isGamificationEnabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isGamificationEnabled"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"color"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"isGroupCreationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"groupDeadlineDate"}},{"kind":"Field","name":{"kind":"Name","value":"notificationEmail"}},{"kind":"Field","name":{"kind":"Name","value":"isGamificationEnabled"}}]}}]}}]} as unknown as DocumentNode<UpdateCourseSettingsMutation, UpdateCourseSettingsMutationVariables>;
export const UpdateGroupAverageScoresDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateGroupAverageScores"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateGroupAverageScores"}}]}}]} as unknown as DocumentNode<UpdateGroupAverageScoresMutation, UpdateGroupAverageScoresMutationVariables>;
export const UpdateParticipantProfileDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateParticipantProfile"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"username"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isProfilePublic"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateParticipantProfile"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"username"},"value":{"kind":"Variable","name":{"kind":"Name","value":"username"}}},{"kind":"Argument","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}},{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}},{"kind":"Argument","name":{"kind":"Name","value":"isProfilePublic"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isProfilePublic"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"isProfilePublic"}}]}}]}}]} as unknown as DocumentNode<UpdateParticipantProfileMutation, UpdateParticipantProfileMutationVariables>;
export const UpdateQuestionInstancesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateQuestionInstances"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"questionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateQuestionInstances"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"questionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"questionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionInstance"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"QuestionDataInfo"}}]}},{"kind":"Field","name":{"kind":"Name","value":"elementInstance"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"ElementDataWithoutSolutions"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QuestionDataInfo"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QuestionInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ElementDataWithoutSolutions"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ElementInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"elementData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"displayMode"}},{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accuracy"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}}]}}]}}]} as unknown as DocumentNode<UpdateQuestionInstancesMutation, UpdateQuestionInstancesMutationVariables>;
export const UpdateTagOrderingDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateTagOrdering"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"originIx"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"targetIx"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateTagOrdering"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"originIx"},"value":{"kind":"Variable","name":{"kind":"Name","value":"originIx"}}},{"kind":"Argument","name":{"kind":"Name","value":"targetIx"},"value":{"kind":"Variable","name":{"kind":"Name","value":"targetIx"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"order"}}]}}]}}]} as unknown as DocumentNode<UpdateTagOrderingMutation, UpdateTagOrderingMutationVariables>;
export const UpvoteFeedbackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpvoteFeedback"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"feedbackId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"increment"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"upvoteFeedback"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"feedbackId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"feedbackId"}}},{"kind":"Argument","name":{"kind":"Name","value":"increment"},"value":{"kind":"Variable","name":{"kind":"Name","value":"increment"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}}]}}]}}]} as unknown as DocumentNode<UpvoteFeedbackMutation, UpvoteFeedbackMutationVariables>;
export const VoteFeedbackResponseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"VoteFeedbackResponse"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"incrementUpvote"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"incrementDownvote"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"voteFeedbackResponse"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"incrementUpvote"},"value":{"kind":"Variable","name":{"kind":"Name","value":"incrementUpvote"}}},{"kind":"Argument","name":{"kind":"Name","value":"incrementDownvote"},"value":{"kind":"Variable","name":{"kind":"Name","value":"incrementDownvote"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"positiveReactions"}},{"kind":"Field","name":{"kind":"Name","value":"negativeReactions"}}]}}]}}]} as unknown as DocumentNode<VoteFeedbackResponseMutation, VoteFeedbackResponseMutationVariables>;
export const PublishScheduledActivitiesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"PublishScheduledActivities"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"publishScheduledActivities"}}]}}]} as unknown as DocumentNode<PublishScheduledActivitiesMutation, PublishScheduledActivitiesMutationVariables>;
export const CheckParticipantNameAvailableDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"CheckParticipantNameAvailable"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"username"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"checkParticipantNameAvailable"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"username"},"value":{"kind":"Variable","name":{"kind":"Name","value":"username"}}}]}]}}]} as unknown as DocumentNode<CheckParticipantNameAvailableQuery, CheckParticipantNameAvailableQueryVariables>;
export const CheckShortnameAvailableDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"CheckShortnameAvailable"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shortname"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"checkShortnameAvailable"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"shortname"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shortname"}}}]}]}}]} as unknown as DocumentNode<CheckShortnameAvailableQuery, CheckShortnameAvailableQueryVariables>;
export const CheckValidCoursePinDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"CheckValidCoursePin"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pin"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"checkValidCoursePin"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pin"}}}]}]}}]} as unknown as DocumentNode<CheckValidCoursePinQuery, CheckValidCoursePinQueryVariables>;
export const GetActiveUserCoursesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetActiveUserCourses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getActiveUserCourses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"color"}},{"kind":"Field","name":{"kind":"Name","value":"pinCode"}},{"kind":"Field","name":{"kind":"Name","value":"isArchived"}},{"kind":"Field","name":{"kind":"Name","value":"isGamificationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isGroupCreationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"groupDeadlineDate"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<GetActiveUserCoursesQuery, GetActiveUserCoursesQueryVariables>;
export const GetBasicCourseInformationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetBasicCourseInformation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"basicCourseInformation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"color"}},{"kind":"Field","name":{"kind":"Name","value":"owner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shortname"}}]}}]}}]}}]} as unknown as DocumentNode<GetBasicCourseInformationQuery, GetBasicCourseInformationQueryVariables>;
export const GetBookmarkedElementStacksDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetBookmarkedElementStacks"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getBookmarkedElementStacks"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"order"}},{"kind":"Field","name":{"kind":"Name","value":"elements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"elementType"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"ElementDataWithoutSolutions"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ElementDataWithoutSolutions"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ElementInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"elementData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"displayMode"}},{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accuracy"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}}]}}]}}]} as unknown as DocumentNode<GetBookmarkedElementStacksQuery, GetBookmarkedElementStacksQueryVariables>;
export const GetBookmarksPracticeQuizDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetBookmarksPracticeQuiz"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"quizId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getBookmarksPracticeQuiz"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"quizId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"quizId"}}},{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}]}]}}]} as unknown as DocumentNode<GetBookmarksPracticeQuizQuery, GetBookmarksPracticeQuizQueryVariables>;
export const GetCockpitSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetCockpitSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cockpitSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isLiveQAEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isConfusionFeedbackEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isModerationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isGamificationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"namespace"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"blocks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"numOfParticipants"}},{"kind":"Field","name":{"kind":"Name","value":"order"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"timeLimit"}},{"kind":"Field","name":{"kind":"Name","value":"randomSelection"}},{"kind":"Field","name":{"kind":"Name","value":"execution"}},{"kind":"Field","name":{"kind":"Name","value":"instances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"QuestionDataInfo"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"activeBlock"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"confusionSummary"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"speed"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"numberOfParticipants"}}]}},{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"responses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"positiveReactions"}},{"kind":"Field","name":{"kind":"Name","value":"negativeReactions"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QuestionDataInfo"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QuestionInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}}]}}]}}]} as unknown as DocumentNode<GetCockpitSessionQuery, GetCockpitSessionQueryVariables>;
export const GetControlCourseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetControlCourse"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"controlCourse"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"sessions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]}}]} as unknown as DocumentNode<GetControlCourseQuery, GetControlCourseQueryVariables>;
export const GetControlCoursesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetControlCourses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"controlCourses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"isArchived"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}}]}}]}}]} as unknown as DocumentNode<GetControlCoursesQuery, GetControlCoursesQueryVariables>;
export const GetControlSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetControlSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"controlSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"blocks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"order"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"timeLimit"}},{"kind":"Field","name":{"kind":"Name","value":"randomSelection"}},{"kind":"Field","name":{"kind":"Name","value":"execution"}},{"kind":"Field","name":{"kind":"Name","value":"instances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"QuestionDataInfo"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"activeBlock"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"order"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QuestionDataInfo"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QuestionInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}}]}}]}}]} as unknown as DocumentNode<GetControlSessionQuery, GetControlSessionQueryVariables>;
export const GetCourseGroupActivitiesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetCourseGroupActivities"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"groupActivities"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStartAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledEndAt"}}]}}]}}]} as unknown as DocumentNode<GetCourseGroupActivitiesQuery, GetCourseGroupActivitiesQueryVariables>;
export const GetCourseGroupsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetCourseGroups"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getCourseGroups"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"participantGroups"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"averageMemberScore"}},{"kind":"Field","name":{"kind":"Name","value":"groupActivityScore"}},{"kind":"Field","name":{"kind":"Name","value":"participants"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"groupAssignmentPoolEntries"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"participant"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetCourseGroupsQuery, GetCourseGroupsQueryVariables>;
export const GetCourseOverviewDataDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetCourseOverviewData"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getCourseOverviewData"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"inRandomGroupPool"}},{"kind":"Field","name":{"kind":"Name","value":"participant"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"xp"}},{"kind":"Field","name":{"kind":"Name","value":"level"}},{"kind":"Field","name":{"kind":"Name","value":"participantGroups"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"participation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}}]}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"color"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"isGamificationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"groupDeadlineDate"}},{"kind":"Field","name":{"kind":"Name","value":"isGroupDeadlinePassed"}},{"kind":"Field","name":{"kind":"Name","value":"isGroupCreationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"maxGroupSize"}},{"kind":"Field","name":{"kind":"Name","value":"preferredGroupSize"}},{"kind":"Field","name":{"kind":"Name","value":"awards"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"order"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"participant"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}},{"kind":"Field","name":{"kind":"Name","value":"participantGroup"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"leaderboard"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"participantId"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"isSelf"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}},{"kind":"Field","name":{"kind":"Name","value":"level"}}]}},{"kind":"Field","name":{"kind":"Name","value":"leaderboardStatistics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"participantCount"}},{"kind":"Field","name":{"kind":"Name","value":"averageScore"}}]}},{"kind":"Field","name":{"kind":"Name","value":"groupLeaderboard"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}},{"kind":"Field","name":{"kind":"Name","value":"isMember"}}]}},{"kind":"Field","name":{"kind":"Name","value":"groupLeaderboardStatistics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"participantCount"}},{"kind":"Field","name":{"kind":"Name","value":"averageScore"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"participantGroups"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"averageMemberScore"}},{"kind":"Field","name":{"kind":"Name","value":"groupActivityScore"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"messages"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"participant"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"participants"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"isSelf"}},{"kind":"Field","name":{"kind":"Name","value":"level"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}}]}}]}}]}}]} as unknown as DocumentNode<GetCourseOverviewDataQuery, GetCourseOverviewDataQueryVariables>;
export const GetCoursePracticeQuizDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetCoursePracticeQuiz"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"coursePracticeQuiz"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PracticeQuizData"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ElementData"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ElementInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"elementData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"displayMode"}},{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"accuracy"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutionRanges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutions"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PracticeQuizData"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PracticeQuiz"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"resetTimeDays"}},{"kind":"Field","name":{"kind":"Name","value":"availableFrom"}},{"kind":"Field","name":{"kind":"Name","value":"orderType"}},{"kind":"Field","name":{"kind":"Name","value":"numOfStacks"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"color"}}]}},{"kind":"Field","name":{"kind":"Name","value":"stacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"order"}},{"kind":"Field","name":{"kind":"Name","value":"elements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"elementType"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"ElementData"}}]}}]}}]}}]} as unknown as DocumentNode<GetCoursePracticeQuizQuery, GetCoursePracticeQuizQueryVariables>;
export const GetCourseSummaryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetCourseSummary"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getCourseSummary"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"numOfParticipations"}},{"kind":"Field","name":{"kind":"Name","value":"numOfLiveQuizzes"}},{"kind":"Field","name":{"kind":"Name","value":"numOfPracticeQuizzes"}},{"kind":"Field","name":{"kind":"Name","value":"numOfMicroLearnings"}},{"kind":"Field","name":{"kind":"Name","value":"numOfGroupActivities"}},{"kind":"Field","name":{"kind":"Name","value":"numOfLeaderboardEntries"}},{"kind":"Field","name":{"kind":"Name","value":"numOfParticipantGroups"}}]}}]}}]} as unknown as DocumentNode<GetCourseSummaryQuery, GetCourseSummaryQueryVariables>;
export const GetFeedbacksDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetFeedbacks"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"responses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"positiveReactions"}},{"kind":"Field","name":{"kind":"Name","value":"negativeReactions"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]}}]} as unknown as DocumentNode<GetFeedbacksQuery, GetFeedbacksQueryVariables>;
export const GetGradingGroupActivityDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetGradingGroupActivity"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getGradingGroupActivity"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStartAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledEndAt"}},{"kind":"Field","name":{"kind":"Name","value":"clues"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}}]}},{"kind":"Field","name":{"kind":"Name","value":"stacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"elements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"elementType"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"ElementData"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"activityInstances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"groupActivityId"}},{"kind":"Field","name":{"kind":"Name","value":"decisionsSubmittedAt"}},{"kind":"Field","name":{"kind":"Name","value":"decisions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"instanceId"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"freeTextResponse"}},{"kind":"Field","name":{"kind":"Name","value":"choicesResponse"}},{"kind":"Field","name":{"kind":"Name","value":"numericalResponse"}},{"kind":"Field","name":{"kind":"Name","value":"contentResponse"}}]}},{"kind":"Field","name":{"kind":"Name","value":"resultsComputedAt"}},{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"passed"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"comment"}},{"kind":"Field","name":{"kind":"Name","value":"grading"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"instanceId"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"maxPoints"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"groupName"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ElementData"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ElementInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"elementData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"displayMode"}},{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"accuracy"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutionRanges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutions"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}}]}}]}}]} as unknown as DocumentNode<GetGradingGroupActivityQuery, GetGradingGroupActivityQueryVariables>;
export const GetGroupActivityDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetGroupActivity"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"groupActivity"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStartAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledEndAt"}},{"kind":"Field","name":{"kind":"Name","value":"clues"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}}]}},{"kind":"Field","name":{"kind":"Name","value":"stacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"elements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"elementType"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"ElementDataWithoutSolutions"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ElementDataWithoutSolutions"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ElementInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"elementData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"displayMode"}},{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accuracy"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}}]}}]}}]} as unknown as DocumentNode<GetGroupActivityQuery, GetGroupActivityQueryVariables>;
export const GetGroupActivityInstancesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetGroupActivityInstances"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"groupId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"groupActivityInstances"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"groupId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"groupId"}}},{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"decisionsSubmittedAt"}},{"kind":"Field","name":{"kind":"Name","value":"resultsComputedAt"}},{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"passed"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"comment"}},{"kind":"Field","name":{"kind":"Name","value":"grading"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"instanceId"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"maxPoints"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"groupActivityId"}}]}}]}}]} as unknown as DocumentNode<GetGroupActivityInstancesQuery, GetGroupActivityInstancesQueryVariables>;
export const GetGroupActivitySummaryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetGroupActivitySummary"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getGroupActivitySummary"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"numOfStartedInstances"}},{"kind":"Field","name":{"kind":"Name","value":"numOfSubmissions"}}]}}]}}]} as unknown as DocumentNode<GetGroupActivitySummaryQuery, GetGroupActivitySummaryQueryVariables>;
export const GetLiveQuizSummaryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetLiveQuizSummary"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"quizId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getLiveQuizSummary"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"quizId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"quizId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"numOfResponses"}},{"kind":"Field","name":{"kind":"Name","value":"numOfFeedbacks"}},{"kind":"Field","name":{"kind":"Name","value":"numOfConfusionFeedbacks"}},{"kind":"Field","name":{"kind":"Name","value":"numOfLeaderboardEntries"}}]}}]}}]} as unknown as DocumentNode<GetLiveQuizSummaryQuery, GetLiveQuizSummaryQueryVariables>;
export const GetLoginTokenDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetLoginToken"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getLoginToken"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"loginToken"}},{"kind":"Field","name":{"kind":"Name","value":"loginTokenExpiresAt"}}]}}]}}]} as unknown as DocumentNode<GetLoginTokenQuery, GetLoginTokenQueryVariables>;
export const GetMicroLearningEvaluationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetMicroLearningEvaluation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getMicroLearningEvaluation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"EvaluationResults"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EvaluationResults"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ActivityEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"stackId"}},{"kind":"Field","name":{"kind":"Name","value":"stackName"}},{"kind":"Field","name":{"kind":"Name","value":"stackDescription"}},{"kind":"Field","name":{"kind":"Name","value":"stackOrder"}},{"kind":"Field","name":{"kind":"Name","value":"instances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesElementInstanceEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"hasAnswerFeedbacks"}},{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"anonymousAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"count"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeElementInstanceEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"hasAnswerFeedbacks"}},{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"anonymousAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"maxLength"}},{"kind":"Field","name":{"kind":"Name","value":"solutions"}},{"kind":"Field","name":{"kind":"Name","value":"responses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalElementInstanceEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"hasAnswerFeedbacks"}},{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"anonymousAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"maxValue"}},{"kind":"Field","name":{"kind":"Name","value":"minValue"}},{"kind":"Field","name":{"kind":"Name","value":"solutionRanges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"responseValues"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardElementInstanceEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"hasAnswerFeedbacks"}},{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"anonymousAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"correctCount"}},{"kind":"Field","name":{"kind":"Name","value":"partialCount"}},{"kind":"Field","name":{"kind":"Name","value":"incorrectCount"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentElementInstanceEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"hasAnswerFeedbacks"}},{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"anonymousAnswers"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetMicroLearningEvaluationQuery, GetMicroLearningEvaluationQueryVariables>;
export const GetMicroLearningSummaryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetMicroLearningSummary"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getMicroLearningSummary"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"numOfResponses"}},{"kind":"Field","name":{"kind":"Name","value":"numOfAnonymousResponses"}}]}}]}}]} as unknown as DocumentNode<GetMicroLearningSummaryQuery, GetMicroLearningSummaryQueryVariables>;
export const GetMicroLearningDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetMicroLearning"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"microLearning"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MicroLearningDataWithoutSolutions"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ElementDataWithoutSolutions"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ElementInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"elementData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"displayMode"}},{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accuracy"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MicroLearningDataWithoutSolutions"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MicroLearning"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStartAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledEndAt"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"color"}}]}},{"kind":"Field","name":{"kind":"Name","value":"stacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"order"}},{"kind":"Field","name":{"kind":"Name","value":"elements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"elementType"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"ElementDataWithoutSolutions"}}]}}]}}]}}]} as unknown as DocumentNode<GetMicroLearningQuery, GetMicroLearningQueryVariables>;
export const GetParticipantCoursesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetParticipantCourses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"participantCourses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isArchived"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}}]}}]}}]} as unknown as DocumentNode<GetParticipantCoursesQuery, GetParticipantCoursesQueryVariables>;
export const GetParticipantGroupsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetParticipantGroups"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"participantGroups"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"participants"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"isSelf"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}}]}}]}}]}}]} as unknown as DocumentNode<GetParticipantGroupsQuery, GetParticipantGroupsQueryVariables>;
export const GetParticipationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetParticipation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getParticipation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}}]}}]}}]} as unknown as DocumentNode<GetParticipationQuery, GetParticipationQueryVariables>;
export const GetPinnedFeedbacksDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetPinnedFeedbacks"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pinnedFeedbacks"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isLiveQAEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isConfusionFeedbackEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isModerationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isGamificationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"confusionSummary"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"speed"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"numberOfParticipants"}}]}},{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"responses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"positiveReactions"}},{"kind":"Field","name":{"kind":"Name","value":"negativeReactions"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetPinnedFeedbacksQuery, GetPinnedFeedbacksQueryVariables>;
export const GetPracticeCoursesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetPracticeCourses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getPracticeCourses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]} as unknown as DocumentNode<GetPracticeCoursesQuery, GetPracticeCoursesQueryVariables>;
export const GetPracticeQuizDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetPracticeQuiz"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"practiceQuiz"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PracticeQuizDataWithoutSolutions"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ElementDataWithoutSolutions"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ElementInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"elementData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"displayMode"}},{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accuracy"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PracticeQuizDataWithoutSolutions"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PracticeQuiz"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"resetTimeDays"}},{"kind":"Field","name":{"kind":"Name","value":"availableFrom"}},{"kind":"Field","name":{"kind":"Name","value":"orderType"}},{"kind":"Field","name":{"kind":"Name","value":"numOfStacks"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"color"}}]}},{"kind":"Field","name":{"kind":"Name","value":"stacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"order"}},{"kind":"Field","name":{"kind":"Name","value":"elements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"elementType"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"ElementDataWithoutSolutions"}}]}}]}}]}}]} as unknown as DocumentNode<GetPracticeQuizQuery, GetPracticeQuizQueryVariables>;
export const GetPracticeQuizEvaluationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetPracticeQuizEvaluation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getPracticeQuizEvaluation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"EvaluationResults"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EvaluationResults"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ActivityEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"stackId"}},{"kind":"Field","name":{"kind":"Name","value":"stackName"}},{"kind":"Field","name":{"kind":"Name","value":"stackDescription"}},{"kind":"Field","name":{"kind":"Name","value":"stackOrder"}},{"kind":"Field","name":{"kind":"Name","value":"instances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesElementInstanceEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"hasAnswerFeedbacks"}},{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"anonymousAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"count"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeElementInstanceEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"hasAnswerFeedbacks"}},{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"anonymousAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"maxLength"}},{"kind":"Field","name":{"kind":"Name","value":"solutions"}},{"kind":"Field","name":{"kind":"Name","value":"responses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalElementInstanceEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"hasAnswerFeedbacks"}},{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"anonymousAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"maxValue"}},{"kind":"Field","name":{"kind":"Name","value":"minValue"}},{"kind":"Field","name":{"kind":"Name","value":"solutionRanges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"responseValues"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardElementInstanceEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"hasAnswerFeedbacks"}},{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"anonymousAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"correctCount"}},{"kind":"Field","name":{"kind":"Name","value":"partialCount"}},{"kind":"Field","name":{"kind":"Name","value":"incorrectCount"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentElementInstanceEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"hasAnswerFeedbacks"}},{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"anonymousAnswers"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetPracticeQuizEvaluationQuery, GetPracticeQuizEvaluationQueryVariables>;
export const GetPracticeQuizListDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetPracticeQuizList"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getPracticeQuizList"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"practiceQuizzes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]}}]} as unknown as DocumentNode<GetPracticeQuizListQuery, GetPracticeQuizListQueryVariables>;
export const GetPracticeQuizSummaryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetPracticeQuizSummary"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getPracticeQuizSummary"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"numOfResponses"}},{"kind":"Field","name":{"kind":"Name","value":"numOfAnonymousResponses"}}]}}]}}]} as unknown as DocumentNode<GetPracticeQuizSummaryQuery, GetPracticeQuizSummaryQueryVariables>;
export const GetPreviousStackEvaluationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetPreviousStackEvaluation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"stackId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getPreviousStackEvaluation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"stackId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"stackId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"StackFeedbackEvaluations"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"StackFeedbackEvaluations"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"StackFeedback"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"evaluations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesInstanceEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"elementType"}},{"kind":"Field","name":{"kind":"Name","value":"instanceId"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"choices"}},{"kind":"Field","name":{"kind":"Name","value":"numAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"xp"}},{"kind":"Field","name":{"kind":"Name","value":"pointsAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"percentile"}},{"kind":"Field","name":{"kind":"Name","value":"newPointsFrom"}},{"kind":"Field","name":{"kind":"Name","value":"xpAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"newXpFrom"}},{"kind":"Field","name":{"kind":"Name","value":"correctness"}},{"kind":"Field","name":{"kind":"Name","value":"lastResponse"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"choices"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalInstanceEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"elementType"}},{"kind":"Field","name":{"kind":"Name","value":"instanceId"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"numAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"answers"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"xp"}},{"kind":"Field","name":{"kind":"Name","value":"pointsAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"percentile"}},{"kind":"Field","name":{"kind":"Name","value":"newPointsFrom"}},{"kind":"Field","name":{"kind":"Name","value":"xpAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"newXpFrom"}},{"kind":"Field","name":{"kind":"Name","value":"solutionRanges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"lastResponse"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"correctness"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextInstanceEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"instanceId"}},{"kind":"Field","name":{"kind":"Name","value":"elementType"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"numAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"answers"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"xp"}},{"kind":"Field","name":{"kind":"Name","value":"pointsAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"percentile"}},{"kind":"Field","name":{"kind":"Name","value":"newPointsFrom"}},{"kind":"Field","name":{"kind":"Name","value":"xpAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"newXpFrom"}},{"kind":"Field","name":{"kind":"Name","value":"solutions"}},{"kind":"Field","name":{"kind":"Name","value":"lastResponse"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"correctness"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardInstanceEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"instanceId"}},{"kind":"Field","name":{"kind":"Name","value":"elementType"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"numAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"xp"}},{"kind":"Field","name":{"kind":"Name","value":"pointsAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"percentile"}},{"kind":"Field","name":{"kind":"Name","value":"newPointsFrom"}},{"kind":"Field","name":{"kind":"Name","value":"xpAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"newXpFrom"}},{"kind":"Field","name":{"kind":"Name","value":"lastResponse"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"correctness"}}]}},{"kind":"Field","name":{"kind":"Name","value":"correctness"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentInstanceEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"instanceId"}},{"kind":"Field","name":{"kind":"Name","value":"elementType"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"numAnswers"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"xp"}},{"kind":"Field","name":{"kind":"Name","value":"pointsAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"percentile"}},{"kind":"Field","name":{"kind":"Name","value":"newPointsFrom"}},{"kind":"Field","name":{"kind":"Name","value":"xpAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"newXpFrom"}},{"kind":"Field","name":{"kind":"Name","value":"lastResponse"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"viewed"}}]}},{"kind":"Field","name":{"kind":"Name","value":"correctness"}}]}}]}}]}}]} as unknown as DocumentNode<GetPreviousStackEvaluationQuery, GetPreviousStackEvaluationQueryVariables>;
export const GetPublicParticipantProfileDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetPublicParticipantProfile"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"publicParticipantProfile"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"participantId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"avatarSettings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"skinTone"}},{"kind":"Field","name":{"kind":"Name","value":"eyes"}},{"kind":"Field","name":{"kind":"Name","value":"mouth"}},{"kind":"Field","name":{"kind":"Name","value":"hair"}},{"kind":"Field","name":{"kind":"Name","value":"facialHair"}},{"kind":"Field","name":{"kind":"Name","value":"accessory"}},{"kind":"Field","name":{"kind":"Name","value":"hairColor"}},{"kind":"Field","name":{"kind":"Name","value":"clothing"}},{"kind":"Field","name":{"kind":"Name","value":"clothingColor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"isProfilePublic"}},{"kind":"Field","name":{"kind":"Name","value":"isSelf"}},{"kind":"Field","name":{"kind":"Name","value":"level"}},{"kind":"Field","name":{"kind":"Name","value":"levelData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"index"}},{"kind":"Field","name":{"kind":"Name","value":"requiredXp"}},{"kind":"Field","name":{"kind":"Name","value":"nextLevel"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"index"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"requiredXp"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"xp"}},{"kind":"Field","name":{"kind":"Name","value":"achievements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"achievedAt"}},{"kind":"Field","name":{"kind":"Name","value":"achievedCount"}},{"kind":"Field","name":{"kind":"Name","value":"achievement"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nameDE"}},{"kind":"Field","name":{"kind":"Name","value":"nameEN"}},{"kind":"Field","name":{"kind":"Name","value":"descriptionDE"}},{"kind":"Field","name":{"kind":"Name","value":"descriptionEN"}},{"kind":"Field","name":{"kind":"Name","value":"icon"}},{"kind":"Field","name":{"kind":"Name","value":"iconColor"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetPublicParticipantProfileQuery, GetPublicParticipantProfileQueryVariables>;
export const GetRunningSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetRunningSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"session"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isLiveQAEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isConfusionFeedbackEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isModerationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isGamificationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"namespace"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"color"}}]}},{"kind":"Field","name":{"kind":"Name","value":"activeBlock"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"timeLimit"}},{"kind":"Field","name":{"kind":"Name","value":"randomSelection"}},{"kind":"Field","name":{"kind":"Name","value":"execution"}},{"kind":"Field","name":{"kind":"Name","value":"instances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"QuestionDataWithoutSolutions"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QuestionDataWithoutSolutions"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QuestionInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"displayMode"}},{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"accuracy"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}}]}}]}}]} as unknown as DocumentNode<GetRunningSessionQuery, GetRunningSessionQueryVariables>;
export const GetRunningSessionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetRunningSessions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shortname"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"runningSessions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"shortname"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shortname"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"linkTo"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]}}]} as unknown as DocumentNode<GetRunningSessionsQuery, GetRunningSessionsQueryVariables>;
export const GetRunningSessionsCourseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetRunningSessionsCourse"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"runningSessionsCourse"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"linkTo"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]}}]} as unknown as DocumentNode<GetRunningSessionsCourseQuery, GetRunningSessionsCourseQueryVariables>;
export const GetSessionEvaluationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetSessionEvaluation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"hmac"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sessionEvaluation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"hmac"},"value":{"kind":"Variable","name":{"kind":"Name","value":"hmac"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"isGamificationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"blocks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"blockIx"}},{"kind":"Field","name":{"kind":"Name","value":"blockStatus"}},{"kind":"Field","name":{"kind":"Name","value":"tabData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionIx"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"instanceResults"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"blockIx"}},{"kind":"Field","name":{"kind":"Name","value":"instanceIx"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"questionData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"hasAnswerFeedbacks"}},{"kind":"Field","name":{"kind":"Name","value":"displayMode"}},{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutionRanges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutions"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"participants"}},{"kind":"Field","name":{"kind":"Name","value":"results"}},{"kind":"Field","name":{"kind":"Name","value":"statistics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"max"}},{"kind":"Field","name":{"kind":"Name","value":"mean"}},{"kind":"Field","name":{"kind":"Name","value":"median"}},{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"q1"}},{"kind":"Field","name":{"kind":"Name","value":"q3"}},{"kind":"Field","name":{"kind":"Name","value":"sd"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"responses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"positiveReactions"}},{"kind":"Field","name":{"kind":"Name","value":"negativeReactions"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"confusionFeedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"speed"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"sessionLeaderboard"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"participantId"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"score"}}]}}]}}]} as unknown as DocumentNode<GetSessionEvaluationQuery, GetSessionEvaluationQueryVariables>;
export const GetSessionHmacDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetSessionHMAC"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sessionHMAC"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<GetSessionHmacQuery, GetSessionHmacQueryVariables>;
export const GetSessionLeaderboardDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetSessionLeaderboard"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sessionLeaderboard"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"participantId"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"isSelf"}},{"kind":"Field","name":{"kind":"Name","value":"lastBlockOrder"}}]}}]}}]} as unknown as DocumentNode<GetSessionLeaderboardQuery, GetSessionLeaderboardQueryVariables>;
export const GetSingleCourseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetSingleCourse"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"course"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isArchived"}},{"kind":"Field","name":{"kind":"Name","value":"isGamificationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"pinCode"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"color"}},{"kind":"Field","name":{"kind":"Name","value":"numOfParticipants"}},{"kind":"Field","name":{"kind":"Name","value":"numOfActiveParticipants"}},{"kind":"Field","name":{"kind":"Name","value":"numOfParticipantGroups"}},{"kind":"Field","name":{"kind":"Name","value":"averageScore"}},{"kind":"Field","name":{"kind":"Name","value":"averageActiveScore"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"isGroupCreationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"groupDeadlineDate"}},{"kind":"Field","name":{"kind":"Name","value":"maxGroupSize"}},{"kind":"Field","name":{"kind":"Name","value":"preferredGroupSize"}},{"kind":"Field","name":{"kind":"Name","value":"randomAssignmentFinalized"}},{"kind":"Field","name":{"kind":"Name","value":"sessions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"isGamificationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"pinCode"}},{"kind":"Field","name":{"kind":"Name","value":"accessMode"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"numOfBlocks"}},{"kind":"Field","name":{"kind":"Name","value":"numOfQuestions"}}]}},{"kind":"Field","name":{"kind":"Name","value":"practiceQuizzes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"availableFrom"}},{"kind":"Field","name":{"kind":"Name","value":"orderType"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"resetTimeDays"}},{"kind":"Field","name":{"kind":"Name","value":"numOfStacks"}}]}},{"kind":"Field","name":{"kind":"Name","value":"groupActivities"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStartAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledEndAt"}},{"kind":"Field","name":{"kind":"Name","value":"numOfQuestions"}}]}},{"kind":"Field","name":{"kind":"Name","value":"microLearnings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStartAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledEndAt"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"numOfStacks"}}]}},{"kind":"Field","name":{"kind":"Name","value":"leaderboard"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}}]}}]}}]} as unknown as DocumentNode<GetSingleCourseQuery, GetSingleCourseQueryVariables>;
export const GetSingleLiveSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetSingleLiveSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"liveSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"blocks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"timeLimit"}},{"kind":"Field","name":{"kind":"Name","value":"instances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"QuestionData"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"maxBonusPoints"}},{"kind":"Field","name":{"kind":"Name","value":"timeToZeroBonus"}},{"kind":"Field","name":{"kind":"Name","value":"isGamificationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isLiveQAEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isConfusionFeedbackEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isModerationEnabled"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QuestionData"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QuestionInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"hasAnswerFeedbacks"}},{"kind":"Field","name":{"kind":"Name","value":"displayMode"}},{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"accuracy"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutionRanges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutions"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetSingleLiveSessionQuery, GetSingleLiveSessionQueryVariables>;
export const GetSingleMicroLearningDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetSingleMicroLearning"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getSingleMicroLearning"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MicroLearningData"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ElementData"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ElementInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"elementData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"displayMode"}},{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"accuracy"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutionRanges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutions"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MicroLearningData"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MicroLearning"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStartAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledEndAt"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"color"}}]}},{"kind":"Field","name":{"kind":"Name","value":"stacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"order"}},{"kind":"Field","name":{"kind":"Name","value":"elements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"elementType"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"ElementData"}}]}}]}}]}}]} as unknown as DocumentNode<GetSingleMicroLearningQuery, GetSingleMicroLearningQueryVariables>;
export const GetSinglePracticeQuizDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetSinglePracticeQuiz"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getSinglePracticeQuiz"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PracticeQuizData"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ElementData"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ElementInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"elementData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"displayMode"}},{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"accuracy"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutionRanges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutions"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PracticeQuizData"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PracticeQuiz"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"resetTimeDays"}},{"kind":"Field","name":{"kind":"Name","value":"availableFrom"}},{"kind":"Field","name":{"kind":"Name","value":"orderType"}},{"kind":"Field","name":{"kind":"Name","value":"numOfStacks"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"color"}}]}},{"kind":"Field","name":{"kind":"Name","value":"stacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"order"}},{"kind":"Field","name":{"kind":"Name","value":"elements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"elementType"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"ElementData"}}]}}]}}]}}]} as unknown as DocumentNode<GetSinglePracticeQuizQuery, GetSinglePracticeQuizQueryVariables>;
export const GetSingleQuestionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetSingleQuestion"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"question"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesElement"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"hasAnswerFeedbacks"}},{"kind":"Field","name":{"kind":"Name","value":"displayMode"}},{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"tags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"order"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalElement"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"accuracy"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutionRanges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"tags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"order"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextElement"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutions"}}]}},{"kind":"Field","name":{"kind":"Name","value":"tags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"order"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardElement"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"tags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"order"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentElement"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"tags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"order"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetSingleQuestionQuery, GetSingleQuestionQueryVariables>;
export const GetStackElementFeedbacksDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetStackElementFeedbacks"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"instanceIds"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getStackElementFeedbacks"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"elementInstanceIds"},"value":{"kind":"Variable","name":{"kind":"Name","value":"instanceIds"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"upvote"}},{"kind":"Field","name":{"kind":"Name","value":"downvote"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"elementInstanceId"}}]}}]}}]} as unknown as DocumentNode<GetStackElementFeedbacksQuery, GetStackElementFeedbacksQueryVariables>;
export const GetUnassignedSessionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetUnassignedSessions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unassignedSessions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<GetUnassignedSessionsQuery, GetUnassignedSessionsQueryVariables>;
export const GetUserCoursesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetUserCourses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userCourses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"color"}},{"kind":"Field","name":{"kind":"Name","value":"pinCode"}},{"kind":"Field","name":{"kind":"Name","value":"isArchived"}},{"kind":"Field","name":{"kind":"Name","value":"isGamificationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isGroupCreationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<GetUserCoursesQuery, GetUserCoursesQueryVariables>;
export const GetUserLoginsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetUserLogins"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userLogins"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"scope"}},{"kind":"Field","name":{"kind":"Name","value":"lastLoginAt"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"shortname"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"userScope"}}]}}]} as unknown as DocumentNode<GetUserLoginsQuery, GetUserLoginsQueryVariables>;
export const GetUserMediaFilesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetUserMediaFiles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userMediaFiles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"href"}}]}}]}}]} as unknown as DocumentNode<GetUserMediaFilesQuery, GetUserMediaFilesQueryVariables>;
export const GetUserQuestionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetUserQuestions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userQuestions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesElement"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"isArchived"}},{"kind":"Field","name":{"kind":"Name","value":"isDeleted"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"hasAnswerFeedbacks"}},{"kind":"Field","name":{"kind":"Name","value":"displayMode"}},{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"tags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"order"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalElement"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"isArchived"}},{"kind":"Field","name":{"kind":"Name","value":"isDeleted"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"hasAnswerFeedbacks"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"accuracy"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"solutionRanges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"tags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"order"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextElement"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"isArchived"}},{"kind":"Field","name":{"kind":"Name","value":"isDeleted"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"hasAnswerFeedbacks"}},{"kind":"Field","name":{"kind":"Name","value":"solutions"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"tags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"order"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardElement"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"isArchived"}},{"kind":"Field","name":{"kind":"Name","value":"isDeleted"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"tags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"order"}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentElement"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"isArchived"}},{"kind":"Field","name":{"kind":"Name","value":"isDeleted"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"tags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"order"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetUserQuestionsQuery, GetUserQuestionsQueryVariables>;
export const GetUserRunningSessionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetUserRunningSessions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userRunningSessions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"linkTo"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]}}]} as unknown as DocumentNode<GetUserRunningSessionsQuery, GetUserRunningSessionsQueryVariables>;
export const GetUserSessionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetUserSessions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userSessions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"namespace"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"accessMode"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"finishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"numOfBlocks"}},{"kind":"Field","name":{"kind":"Name","value":"numOfQuestions"}},{"kind":"Field","name":{"kind":"Name","value":"isGamificationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isConfusionFeedbackEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isLiveQAEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isModerationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"blocks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"numOfParticipants"}},{"kind":"Field","name":{"kind":"Name","value":"instances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"QuestionDataInfo"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QuestionDataInfo"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QuestionInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}}]}}]}}]} as unknown as DocumentNode<GetUserSessionsQuery, GetUserSessionsQueryVariables>;
export const GetUserTagsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetUserTags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userTags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"order"}}]}}]}}]} as unknown as DocumentNode<GetUserTagsQuery, GetUserTagsQueryVariables>;
export const GroupActivityDetailsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GroupActivityDetails"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activityId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"groupId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"groupActivityDetails"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activityId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activityId"}}},{"kind":"Argument","name":{"kind":"Name","value":"groupId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"groupId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStartAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledEndAt"}},{"kind":"Field","name":{"kind":"Name","value":"clues"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"stacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"order"}},{"kind":"Field","name":{"kind":"Name","value":"elements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"elementType"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"ElementDataWithoutSolutions"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"color"}}]}},{"kind":"Field","name":{"kind":"Name","value":"group"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"participants"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"isSelf"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"activityInstance"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"clues"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"participant"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"isSelf"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"decisionsSubmittedAt"}},{"kind":"Field","name":{"kind":"Name","value":"decisions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"instanceId"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"freeTextResponse"}},{"kind":"Field","name":{"kind":"Name","value":"choicesResponse"}},{"kind":"Field","name":{"kind":"Name","value":"numericalResponse"}},{"kind":"Field","name":{"kind":"Name","value":"contentResponse"}}]}},{"kind":"Field","name":{"kind":"Name","value":"resultsComputedAt"}},{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"passed"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"comment"}},{"kind":"Field","name":{"kind":"Name","value":"grading"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"instanceId"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"maxPoints"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}}]}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ElementDataWithoutSolutions"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ElementInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"elementData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"displayMode"}},{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accuracy"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentElementData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"elementId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}}]}}]}}]} as unknown as DocumentNode<GroupActivityDetailsQuery, GroupActivityDetailsQueryVariables>;
export const ParticipationsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Participations"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"endpoint"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"participations"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"endpoint"},"value":{"kind":"Variable","name":{"kind":"Name","value":"endpoint"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"completedMicroLearnings"}},{"kind":"Field","name":{"kind":"Name","value":"subscriptions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"endpoint"}}]}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"isGamificationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"microLearnings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStartAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledEndAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"sessions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"linkTo"}}]}}]}}]}}]}}]} as unknown as DocumentNode<ParticipationsQuery, ParticipationsQueryVariables>;
export const SelfDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Self"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"self"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"avatarSettings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"skinTone"}},{"kind":"Field","name":{"kind":"Name","value":"eyes"}},{"kind":"Field","name":{"kind":"Name","value":"mouth"}},{"kind":"Field","name":{"kind":"Name","value":"hair"}},{"kind":"Field","name":{"kind":"Name","value":"facialHair"}},{"kind":"Field","name":{"kind":"Name","value":"accessory"}},{"kind":"Field","name":{"kind":"Name","value":"hairColor"}},{"kind":"Field","name":{"kind":"Name","value":"clothing"}},{"kind":"Field","name":{"kind":"Name","value":"clothingColor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"isProfilePublic"}},{"kind":"Field","name":{"kind":"Name","value":"xp"}},{"kind":"Field","name":{"kind":"Name","value":"level"}},{"kind":"Field","name":{"kind":"Name","value":"levelData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"index"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"requiredXp"}},{"kind":"Field","name":{"kind":"Name","value":"nextLevel"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"index"}},{"kind":"Field","name":{"kind":"Name","value":"requiredXp"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]} as unknown as DocumentNode<SelfQuery, SelfQueryVariables>;
export const SelfWithAchievementsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SelfWithAchievements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"selfWithAchievements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"participant"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"avatarSettings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"skinTone"}},{"kind":"Field","name":{"kind":"Name","value":"eyes"}},{"kind":"Field","name":{"kind":"Name","value":"mouth"}},{"kind":"Field","name":{"kind":"Name","value":"hair"}},{"kind":"Field","name":{"kind":"Name","value":"facialHair"}},{"kind":"Field","name":{"kind":"Name","value":"accessory"}},{"kind":"Field","name":{"kind":"Name","value":"hairColor"}},{"kind":"Field","name":{"kind":"Name","value":"clothing"}},{"kind":"Field","name":{"kind":"Name","value":"clothingColor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"xp"}},{"kind":"Field","name":{"kind":"Name","value":"level"}},{"kind":"Field","name":{"kind":"Name","value":"levelData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"index"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"requiredXp"}},{"kind":"Field","name":{"kind":"Name","value":"nextLevel"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"index"}},{"kind":"Field","name":{"kind":"Name","value":"requiredXp"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"achievements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"achievedAt"}},{"kind":"Field","name":{"kind":"Name","value":"achievedCount"}},{"kind":"Field","name":{"kind":"Name","value":"achievement"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nameDE"}},{"kind":"Field","name":{"kind":"Name","value":"nameEN"}},{"kind":"Field","name":{"kind":"Name","value":"descriptionDE"}},{"kind":"Field","name":{"kind":"Name","value":"descriptionEN"}},{"kind":"Field","name":{"kind":"Name","value":"icon"}},{"kind":"Field","name":{"kind":"Name","value":"iconColor"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"achievements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nameDE"}},{"kind":"Field","name":{"kind":"Name","value":"nameEN"}},{"kind":"Field","name":{"kind":"Name","value":"descriptionDE"}},{"kind":"Field","name":{"kind":"Name","value":"descriptionEN"}},{"kind":"Field","name":{"kind":"Name","value":"icon"}},{"kind":"Field","name":{"kind":"Name","value":"iconColor"}}]}}]}}]}}]} as unknown as DocumentNode<SelfWithAchievementsQuery, SelfWithAchievementsQueryVariables>;
export const UserProfileDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"UserProfile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userProfile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"sendProjectUpdates"}},{"kind":"Field","name":{"kind":"Name","value":"shortname"}},{"kind":"Field","name":{"kind":"Name","value":"locale"}},{"kind":"Field","name":{"kind":"Name","value":"firstLogin"}},{"kind":"Field","name":{"kind":"Name","value":"catalyst"}},{"kind":"Field","name":{"kind":"Name","value":"catalystTier"}}]}}]}}]} as unknown as DocumentNode<UserProfileQuery, UserProfileQueryVariables>;
export const FeedbackAddedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"FeedbackAdded"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"feedbackAdded"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"responses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"positiveReactions"}},{"kind":"Field","name":{"kind":"Name","value":"negativeReactions"}}]}}]}}]}}]} as unknown as DocumentNode<FeedbackAddedSubscription, FeedbackAddedSubscriptionVariables>;
export const FeedbackCreatedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"FeedbackCreated"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"feedbackCreated"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"responses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"positiveReactions"}},{"kind":"Field","name":{"kind":"Name","value":"negativeReactions"}}]}}]}}]}}]} as unknown as DocumentNode<FeedbackCreatedSubscription, FeedbackCreatedSubscriptionVariables>;
export const FeedbackRemovedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"FeedbackRemoved"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"feedbackRemoved"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}]}]}}]} as unknown as DocumentNode<FeedbackRemovedSubscription, FeedbackRemovedSubscriptionVariables>;
export const FeedbackUpdatedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"FeedbackUpdated"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"feedbackUpdated"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"responses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"positiveReactions"}},{"kind":"Field","name":{"kind":"Name","value":"negativeReactions"}}]}}]}}]}}]} as unknown as DocumentNode<FeedbackUpdatedSubscription, FeedbackUpdatedSubscriptionVariables>;
export const GroupActivityEndedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"GroupActivityEnded"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"groupActivityEnded"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStartAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledEndAt"}}]}}]}}]} as unknown as DocumentNode<GroupActivityEndedSubscription, GroupActivityEndedSubscriptionVariables>;
export const GroupActivityStartedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"GroupActivityStarted"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"groupActivityStarted"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStartAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledEndAt"}}]}}]}}]} as unknown as DocumentNode<GroupActivityStartedSubscription, GroupActivityStartedSubscriptionVariables>;
export const MicroLearningEndedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"MicroLearningEnded"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activityId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"microLearningEnded"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activityId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activityId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStartAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledEndAt"}}]}}]}}]} as unknown as DocumentNode<MicroLearningEndedSubscription, MicroLearningEndedSubscriptionVariables>;
export const RunningSessionUpdatedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"RunningSessionUpdated"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"runningSessionUpdated"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"timeLimit"}},{"kind":"Field","name":{"kind":"Name","value":"randomSelection"}},{"kind":"Field","name":{"kind":"Name","value":"execution"}},{"kind":"Field","name":{"kind":"Name","value":"instances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"QuestionDataWithoutSolutions"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QuestionDataWithoutSolutions"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QuestionInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"displayMode"}},{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"accuracy"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FlashcardQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ContentQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}}]}}]}}]}}]} as unknown as DocumentNode<RunningSessionUpdatedSubscription, RunningSessionUpdatedSubscriptionVariables>;
export const SingleGroupActivityEndedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"SingleGroupActivityEnded"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activityId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"singleGroupActivityEnded"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activityId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activityId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStartAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledEndAt"}}]}}]}}]} as unknown as DocumentNode<SingleGroupActivityEndedSubscription, SingleGroupActivityEndedSubscriptionVariables>;
export const UpdateParticipantAvatarDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateParticipantAvatar"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"avatar"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"avatarSettings"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AvatarSettingsInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateParticipantAvatar"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"avatar"},"value":{"kind":"Variable","name":{"kind":"Name","value":"avatar"}}},{"kind":"Argument","name":{"kind":"Name","value":"avatarSettings"},"value":{"kind":"Variable","name":{"kind":"Name","value":"avatarSettings"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"avatarSettings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"skinTone"}},{"kind":"Field","name":{"kind":"Name","value":"eyes"}},{"kind":"Field","name":{"kind":"Name","value":"mouth"}},{"kind":"Field","name":{"kind":"Name","value":"hair"}},{"kind":"Field","name":{"kind":"Name","value":"facialHair"}},{"kind":"Field","name":{"kind":"Name","value":"accessory"}},{"kind":"Field","name":{"kind":"Name","value":"hairColor"}},{"kind":"Field","name":{"kind":"Name","value":"clothing"}},{"kind":"Field","name":{"kind":"Name","value":"clothingColor"}}]}}]}}]}}]} as unknown as DocumentNode<UpdateParticipantAvatarMutation, UpdateParticipantAvatarMutationVariables>;

      export interface PossibleTypesResultData {
        possibleTypes: {
          [key: string]: string[]
        }
      }
      const result: PossibleTypesResultData = {
  "possibleTypes": {
    "Element": [
      "ChoicesElement",
      "ContentElement",
      "FlashcardElement",
      "FreeTextElement",
      "NumericalElement"
    ],
    "ElementData": [
      "ChoicesElementData",
      "ContentElementData",
      "FlashcardElementData",
      "FreeTextElementData",
      "NumericalElementData"
    ],
    "ElementInstanceEvaluation": [
      "ChoicesElementInstanceEvaluation",
      "ContentElementInstanceEvaluation",
      "FlashcardElementInstanceEvaluation",
      "FreeElementInstanceEvaluation",
      "NumericalElementInstanceEvaluation"
    ],
    "InstanceEvaluation": [
      "ChoicesInstanceEvaluation",
      "ContentInstanceEvaluation",
      "FlashcardInstanceEvaluation",
      "FreeTextInstanceEvaluation",
      "NumericalInstanceEvaluation"
    ],
    "QuestionData": [
      "ChoicesQuestionData",
      "ContentQuestionData",
      "FlashcardQuestionData",
      "FreeTextQuestionData",
      "NumericalQuestionData"
    ],
    "QuestionResponse": [
      "ChoicesQuestionResponse",
      "ContentQuestionResponse",
      "FlashcardQuestionResponse",
      "OpenQuestionResponse"
    ]
  }
};
      export default result;
    