/* eslint-disable */
import type { Prisma, Account, Session, VerificationToken, UserLogin, User, MediaFile, Question, Tag, QuestionInstance, QuestionStack, StackElement, Course, LeaderboardEntry, SessionBlock, LiveSession, LearningElement, MicroSession, GroupActivityParameter, GroupActivityClue, GroupActivityClueInstance, GroupActivity, GroupActivityClueAssignment, GroupActivityInstance, Feedback, FeedbackResponse, ConfusionTimestep, ParticipantAccount, Participant, ParticipantGroup, Participation, Title, Achievement, ParticipantAchievementInstance, GroupAchievementInstance, ClassAchievementInstance, QuestionResponse, QuestionResponseDetail, PushSubscription, AwardEntry, Level } from "@klicker-uzh/prisma";
export default interface PrismaTypes {
    Account: {
        Name: "Account";
        Shape: Account;
        Include: Prisma.AccountInclude;
        Select: Prisma.AccountSelect;
        OrderBy: Prisma.AccountOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.AccountWhereUniqueInput;
        Where: Prisma.AccountWhereInput;
        Create: {};
        Update: {};
        RelationName: "user";
        ListRelations: never;
        Relations: {
            user: {
                Shape: User;
                Name: "User";
            };
        };
    };
    Session: {
        Name: "Session";
        Shape: Session;
        Include: Prisma.SessionInclude;
        Select: Prisma.SessionSelect;
        OrderBy: Prisma.SessionOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.SessionWhereUniqueInput;
        Where: Prisma.SessionWhereInput;
        Create: {};
        Update: {};
        RelationName: "user";
        ListRelations: never;
        Relations: {
            user: {
                Shape: User;
                Name: "User";
            };
        };
    };
    VerificationToken: {
        Name: "VerificationToken";
        Shape: VerificationToken;
        Include: never;
        Select: Prisma.VerificationTokenSelect;
        OrderBy: Prisma.VerificationTokenOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.VerificationTokenWhereUniqueInput;
        Where: Prisma.VerificationTokenWhereInput;
        Create: {};
        Update: {};
        RelationName: never;
        ListRelations: never;
        Relations: {};
    };
    UserLogin: {
        Name: "UserLogin";
        Shape: UserLogin;
        Include: Prisma.UserLoginInclude;
        Select: Prisma.UserLoginSelect;
        OrderBy: Prisma.UserLoginOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.UserLoginWhereUniqueInput;
        Where: Prisma.UserLoginWhereInput;
        Create: {};
        Update: {};
        RelationName: "user";
        ListRelations: never;
        Relations: {
            user: {
                Shape: User;
                Name: "User";
            };
        };
    };
    User: {
        Name: "User";
        Shape: User;
        Include: Prisma.UserInclude;
        Select: Prisma.UserSelect;
        OrderBy: Prisma.UserOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.UserWhereUniqueInput;
        Where: Prisma.UserWhereInput;
        Create: {};
        Update: {};
        RelationName: "logins" | "session" | "accounts" | "courses" | "questions" | "mediaFiles" | "tags" | "questionInstances" | "sessions" | "learningElements" | "microSessions" | "groupActivities";
        ListRelations: "logins" | "session" | "accounts" | "courses" | "questions" | "mediaFiles" | "tags" | "questionInstances" | "sessions" | "learningElements" | "microSessions" | "groupActivities";
        Relations: {
            logins: {
                Shape: UserLogin[];
                Name: "UserLogin";
            };
            session: {
                Shape: Session[];
                Name: "Session";
            };
            accounts: {
                Shape: Account[];
                Name: "Account";
            };
            courses: {
                Shape: Course[];
                Name: "Course";
            };
            questions: {
                Shape: Question[];
                Name: "Question";
            };
            mediaFiles: {
                Shape: MediaFile[];
                Name: "MediaFile";
            };
            tags: {
                Shape: Tag[];
                Name: "Tag";
            };
            questionInstances: {
                Shape: QuestionInstance[];
                Name: "QuestionInstance";
            };
            sessions: {
                Shape: LiveSession[];
                Name: "LiveSession";
            };
            learningElements: {
                Shape: LearningElement[];
                Name: "LearningElement";
            };
            microSessions: {
                Shape: MicroSession[];
                Name: "MicroSession";
            };
            groupActivities: {
                Shape: GroupActivity[];
                Name: "GroupActivity";
            };
        };
    };
    MediaFile: {
        Name: "MediaFile";
        Shape: MediaFile;
        Include: Prisma.MediaFileInclude;
        Select: Prisma.MediaFileSelect;
        OrderBy: Prisma.MediaFileOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.MediaFileWhereUniqueInput;
        Where: Prisma.MediaFileWhereInput;
        Create: {};
        Update: {};
        RelationName: "owner";
        ListRelations: never;
        Relations: {
            owner: {
                Shape: User;
                Name: "User";
            };
        };
    };
    Question: {
        Name: "Question";
        Shape: Question;
        Include: Prisma.QuestionInclude;
        Select: Prisma.QuestionSelect;
        OrderBy: Prisma.QuestionOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.QuestionWhereUniqueInput;
        Where: Prisma.QuestionWhereInput;
        Create: {};
        Update: {};
        RelationName: "tags" | "instances" | "owner";
        ListRelations: "tags" | "instances";
        Relations: {
            tags: {
                Shape: Tag[];
                Name: "Tag";
            };
            instances: {
                Shape: QuestionInstance[];
                Name: "QuestionInstance";
            };
            owner: {
                Shape: User;
                Name: "User";
            };
        };
    };
    Tag: {
        Name: "Tag";
        Shape: Tag;
        Include: Prisma.TagInclude;
        Select: Prisma.TagSelect;
        OrderBy: Prisma.TagOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.TagWhereUniqueInput;
        Where: Prisma.TagWhereInput;
        Create: {};
        Update: {};
        RelationName: "questions" | "owner";
        ListRelations: "questions";
        Relations: {
            questions: {
                Shape: Question[];
                Name: "Question";
            };
            owner: {
                Shape: User;
                Name: "User";
            };
        };
    };
    QuestionInstance: {
        Name: "QuestionInstance";
        Shape: QuestionInstance;
        Include: Prisma.QuestionInstanceInclude;
        Select: Prisma.QuestionInstanceSelect;
        OrderBy: Prisma.QuestionInstanceOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.QuestionInstanceWhereUniqueInput;
        Where: Prisma.QuestionInstanceWhereInput;
        Create: {};
        Update: {};
        RelationName: "responses" | "detailResponses" | "sessionBlock" | "stackElement" | "microSession" | "groupActivity" | "bookmarkedBy" | "question" | "owner";
        ListRelations: "responses" | "detailResponses" | "bookmarkedBy";
        Relations: {
            responses: {
                Shape: QuestionResponse[];
                Name: "QuestionResponse";
            };
            detailResponses: {
                Shape: QuestionResponseDetail[];
                Name: "QuestionResponseDetail";
            };
            sessionBlock: {
                Shape: SessionBlock | null;
                Name: "SessionBlock";
            };
            stackElement: {
                Shape: StackElement | null;
                Name: "StackElement";
            };
            microSession: {
                Shape: MicroSession | null;
                Name: "MicroSession";
            };
            groupActivity: {
                Shape: GroupActivity | null;
                Name: "GroupActivity";
            };
            bookmarkedBy: {
                Shape: Participation[];
                Name: "Participation";
            };
            question: {
                Shape: Question | null;
                Name: "Question";
            };
            owner: {
                Shape: User;
                Name: "User";
            };
        };
    };
    QuestionStack: {
        Name: "QuestionStack";
        Shape: QuestionStack;
        Include: Prisma.QuestionStackInclude;
        Select: Prisma.QuestionStackSelect;
        OrderBy: Prisma.QuestionStackOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.QuestionStackWhereUniqueInput;
        Where: Prisma.QuestionStackWhereInput;
        Create: {};
        Update: {};
        RelationName: "elements" | "learningElement" | "groupActivity" | "bookmarkedBy";
        ListRelations: "elements" | "bookmarkedBy";
        Relations: {
            elements: {
                Shape: StackElement[];
                Name: "StackElement";
            };
            learningElement: {
                Shape: LearningElement | null;
                Name: "LearningElement";
            };
            groupActivity: {
                Shape: GroupActivity | null;
                Name: "GroupActivity";
            };
            bookmarkedBy: {
                Shape: Participation[];
                Name: "Participation";
            };
        };
    };
    StackElement: {
        Name: "StackElement";
        Shape: StackElement;
        Include: Prisma.StackElementInclude;
        Select: Prisma.StackElementSelect;
        OrderBy: Prisma.StackElementOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.StackElementWhereUniqueInput;
        Where: Prisma.StackElementWhereInput;
        Create: {};
        Update: {};
        RelationName: "stack" | "questionInstance";
        ListRelations: never;
        Relations: {
            stack: {
                Shape: QuestionStack;
                Name: "QuestionStack";
            };
            questionInstance: {
                Shape: QuestionInstance | null;
                Name: "QuestionInstance";
            };
        };
    };
    Course: {
        Name: "Course";
        Shape: Course;
        Include: Prisma.CourseInclude;
        Select: Prisma.CourseSelect;
        OrderBy: Prisma.CourseOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.CourseWhereUniqueInput;
        Where: Prisma.CourseWhereInput;
        Create: {};
        Update: {};
        RelationName: "sessions" | "learningElements" | "microSessions" | "leaderboard" | "groupActivities" | "awards" | "classAchievements" | "achievements" | "titles" | "owner" | "participations" | "subscriptions" | "participantGroups";
        ListRelations: "sessions" | "learningElements" | "microSessions" | "leaderboard" | "groupActivities" | "awards" | "classAchievements" | "achievements" | "titles" | "participations" | "subscriptions" | "participantGroups";
        Relations: {
            sessions: {
                Shape: LiveSession[];
                Name: "LiveSession";
            };
            learningElements: {
                Shape: LearningElement[];
                Name: "LearningElement";
            };
            microSessions: {
                Shape: MicroSession[];
                Name: "MicroSession";
            };
            leaderboard: {
                Shape: LeaderboardEntry[];
                Name: "LeaderboardEntry";
            };
            groupActivities: {
                Shape: GroupActivity[];
                Name: "GroupActivity";
            };
            awards: {
                Shape: AwardEntry[];
                Name: "AwardEntry";
            };
            classAchievements: {
                Shape: ClassAchievementInstance[];
                Name: "ClassAchievementInstance";
            };
            achievements: {
                Shape: Achievement[];
                Name: "Achievement";
            };
            titles: {
                Shape: Title[];
                Name: "Title";
            };
            owner: {
                Shape: User;
                Name: "User";
            };
            participations: {
                Shape: Participation[];
                Name: "Participation";
            };
            subscriptions: {
                Shape: PushSubscription[];
                Name: "PushSubscription";
            };
            participantGroups: {
                Shape: ParticipantGroup[];
                Name: "ParticipantGroup";
            };
        };
    };
    LeaderboardEntry: {
        Name: "LeaderboardEntry";
        Shape: LeaderboardEntry;
        Include: Prisma.LeaderboardEntryInclude;
        Select: Prisma.LeaderboardEntrySelect;
        OrderBy: Prisma.LeaderboardEntryOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.LeaderboardEntryWhereUniqueInput;
        Where: Prisma.LeaderboardEntryWhereInput;
        Create: {};
        Update: {};
        RelationName: "participant" | "participation" | "sessionParticipation" | "sessionBlock" | "session" | "course";
        ListRelations: never;
        Relations: {
            participant: {
                Shape: Participant;
                Name: "Participant";
            };
            participation: {
                Shape: Participation | null;
                Name: "Participation";
            };
            sessionParticipation: {
                Shape: Participation | null;
                Name: "Participation";
            };
            sessionBlock: {
                Shape: SessionBlock | null;
                Name: "SessionBlock";
            };
            session: {
                Shape: LiveSession | null;
                Name: "LiveSession";
            };
            course: {
                Shape: Course | null;
                Name: "Course";
            };
        };
    };
    SessionBlock: {
        Name: "SessionBlock";
        Shape: SessionBlock;
        Include: Prisma.SessionBlockInclude;
        Select: Prisma.SessionBlockSelect;
        OrderBy: Prisma.SessionBlockOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.SessionBlockWhereUniqueInput;
        Where: Prisma.SessionBlockWhereInput;
        Create: {};
        Update: {};
        RelationName: "instances" | "leaderboard" | "activeInSession" | "session";
        ListRelations: "instances" | "leaderboard" | "activeInSession";
        Relations: {
            instances: {
                Shape: QuestionInstance[];
                Name: "QuestionInstance";
            };
            leaderboard: {
                Shape: LeaderboardEntry[];
                Name: "LeaderboardEntry";
            };
            activeInSession: {
                Shape: LiveSession[];
                Name: "LiveSession";
            };
            session: {
                Shape: LiveSession;
                Name: "LiveSession";
            };
        };
    };
    LiveSession: {
        Name: "LiveSession";
        Shape: LiveSession;
        Include: Prisma.LiveSessionInclude;
        Select: Prisma.LiveSessionSelect;
        OrderBy: Prisma.LiveSessionOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.LiveSessionWhereUniqueInput;
        Where: Prisma.LiveSessionWhereInput;
        Create: {};
        Update: {};
        RelationName: "activeBlock" | "blocks" | "leaderboard" | "feedbacks" | "confusionFeedbacks" | "owner" | "course";
        ListRelations: "blocks" | "leaderboard" | "feedbacks" | "confusionFeedbacks";
        Relations: {
            activeBlock: {
                Shape: SessionBlock | null;
                Name: "SessionBlock";
            };
            blocks: {
                Shape: SessionBlock[];
                Name: "SessionBlock";
            };
            leaderboard: {
                Shape: LeaderboardEntry[];
                Name: "LeaderboardEntry";
            };
            feedbacks: {
                Shape: Feedback[];
                Name: "Feedback";
            };
            confusionFeedbacks: {
                Shape: ConfusionTimestep[];
                Name: "ConfusionTimestep";
            };
            owner: {
                Shape: User;
                Name: "User";
            };
            course: {
                Shape: Course | null;
                Name: "Course";
            };
        };
    };
    LearningElement: {
        Name: "LearningElement";
        Shape: LearningElement;
        Include: Prisma.LearningElementInclude;
        Select: Prisma.LearningElementSelect;
        OrderBy: Prisma.LearningElementOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.LearningElementWhereUniqueInput;
        Where: Prisma.LearningElementWhereInput;
        Create: {};
        Update: {};
        RelationName: "stacks" | "owner" | "course";
        ListRelations: "stacks";
        Relations: {
            stacks: {
                Shape: QuestionStack[];
                Name: "QuestionStack";
            };
            owner: {
                Shape: User;
                Name: "User";
            };
            course: {
                Shape: Course | null;
                Name: "Course";
            };
        };
    };
    MicroSession: {
        Name: "MicroSession";
        Shape: MicroSession;
        Include: Prisma.MicroSessionInclude;
        Select: Prisma.MicroSessionSelect;
        OrderBy: Prisma.MicroSessionOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.MicroSessionWhereUniqueInput;
        Where: Prisma.MicroSessionWhereInput;
        Create: {};
        Update: {};
        RelationName: "instances" | "owner" | "course";
        ListRelations: "instances";
        Relations: {
            instances: {
                Shape: QuestionInstance[];
                Name: "QuestionInstance";
            };
            owner: {
                Shape: User;
                Name: "User";
            };
            course: {
                Shape: Course | null;
                Name: "Course";
            };
        };
    };
    GroupActivityParameter: {
        Name: "GroupActivityParameter";
        Shape: GroupActivityParameter;
        Include: Prisma.GroupActivityParameterInclude;
        Select: Prisma.GroupActivityParameterSelect;
        OrderBy: Prisma.GroupActivityParameterOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.GroupActivityParameterWhereUniqueInput;
        Where: Prisma.GroupActivityParameterWhereInput;
        Create: {};
        Update: {};
        RelationName: "groupActivity";
        ListRelations: never;
        Relations: {
            groupActivity: {
                Shape: GroupActivity;
                Name: "GroupActivity";
            };
        };
    };
    GroupActivityClue: {
        Name: "GroupActivityClue";
        Shape: GroupActivityClue;
        Include: Prisma.GroupActivityClueInclude;
        Select: Prisma.GroupActivityClueSelect;
        OrderBy: Prisma.GroupActivityClueOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.GroupActivityClueWhereUniqueInput;
        Where: Prisma.GroupActivityClueWhereInput;
        Create: {};
        Update: {};
        RelationName: "groupActivity";
        ListRelations: never;
        Relations: {
            groupActivity: {
                Shape: GroupActivity;
                Name: "GroupActivity";
            };
        };
    };
    GroupActivityClueInstance: {
        Name: "GroupActivityClueInstance";
        Shape: GroupActivityClueInstance;
        Include: Prisma.GroupActivityClueInstanceInclude;
        Select: Prisma.GroupActivityClueInstanceSelect;
        OrderBy: Prisma.GroupActivityClueInstanceOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.GroupActivityClueInstanceWhereUniqueInput;
        Where: Prisma.GroupActivityClueInstanceWhereInput;
        Create: {};
        Update: {};
        RelationName: "assignments" | "groupActivityInstance";
        ListRelations: "assignments";
        Relations: {
            assignments: {
                Shape: GroupActivityClueAssignment[];
                Name: "GroupActivityClueAssignment";
            };
            groupActivityInstance: {
                Shape: GroupActivityInstance;
                Name: "GroupActivityInstance";
            };
        };
    };
    GroupActivity: {
        Name: "GroupActivity";
        Shape: GroupActivity;
        Include: Prisma.GroupActivityInclude;
        Select: Prisma.GroupActivitySelect;
        OrderBy: Prisma.GroupActivityOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.GroupActivityWhereUniqueInput;
        Where: Prisma.GroupActivityWhereInput;
        Create: {};
        Update: {};
        RelationName: "questionStack" | "parameters" | "clues" | "instances" | "activityInstances" | "owner" | "course";
        ListRelations: "parameters" | "clues" | "instances" | "activityInstances";
        Relations: {
            questionStack: {
                Shape: QuestionStack | null;
                Name: "QuestionStack";
            };
            parameters: {
                Shape: GroupActivityParameter[];
                Name: "GroupActivityParameter";
            };
            clues: {
                Shape: GroupActivityClue[];
                Name: "GroupActivityClue";
            };
            instances: {
                Shape: QuestionInstance[];
                Name: "QuestionInstance";
            };
            activityInstances: {
                Shape: GroupActivityInstance[];
                Name: "GroupActivityInstance";
            };
            owner: {
                Shape: User;
                Name: "User";
            };
            course: {
                Shape: Course;
                Name: "Course";
            };
        };
    };
    GroupActivityClueAssignment: {
        Name: "GroupActivityClueAssignment";
        Shape: GroupActivityClueAssignment;
        Include: Prisma.GroupActivityClueAssignmentInclude;
        Select: Prisma.GroupActivityClueAssignmentSelect;
        OrderBy: Prisma.GroupActivityClueAssignmentOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.GroupActivityClueAssignmentWhereUniqueInput;
        Where: Prisma.GroupActivityClueAssignmentWhereInput;
        Create: {};
        Update: {};
        RelationName: "groupActivityClueInstance" | "groupActivityInstance" | "participant";
        ListRelations: never;
        Relations: {
            groupActivityClueInstance: {
                Shape: GroupActivityClueInstance;
                Name: "GroupActivityClueInstance";
            };
            groupActivityInstance: {
                Shape: GroupActivityInstance;
                Name: "GroupActivityInstance";
            };
            participant: {
                Shape: Participant;
                Name: "Participant";
            };
        };
    };
    GroupActivityInstance: {
        Name: "GroupActivityInstance";
        Shape: GroupActivityInstance;
        Include: Prisma.GroupActivityInstanceInclude;
        Select: Prisma.GroupActivityInstanceSelect;
        OrderBy: Prisma.GroupActivityInstanceOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.GroupActivityInstanceWhereUniqueInput;
        Where: Prisma.GroupActivityInstanceWhereInput;
        Create: {};
        Update: {};
        RelationName: "clues" | "clueInstanceAssignment" | "groupActivity" | "group";
        ListRelations: "clues" | "clueInstanceAssignment";
        Relations: {
            clues: {
                Shape: GroupActivityClueInstance[];
                Name: "GroupActivityClueInstance";
            };
            clueInstanceAssignment: {
                Shape: GroupActivityClueAssignment[];
                Name: "GroupActivityClueAssignment";
            };
            groupActivity: {
                Shape: GroupActivity;
                Name: "GroupActivity";
            };
            group: {
                Shape: ParticipantGroup;
                Name: "ParticipantGroup";
            };
        };
    };
    Feedback: {
        Name: "Feedback";
        Shape: Feedback;
        Include: Prisma.FeedbackInclude;
        Select: Prisma.FeedbackSelect;
        OrderBy: Prisma.FeedbackOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.FeedbackWhereUniqueInput;
        Where: Prisma.FeedbackWhereInput;
        Create: {};
        Update: {};
        RelationName: "responses" | "session" | "participant";
        ListRelations: "responses";
        Relations: {
            responses: {
                Shape: FeedbackResponse[];
                Name: "FeedbackResponse";
            };
            session: {
                Shape: LiveSession;
                Name: "LiveSession";
            };
            participant: {
                Shape: Participant | null;
                Name: "Participant";
            };
        };
    };
    FeedbackResponse: {
        Name: "FeedbackResponse";
        Shape: FeedbackResponse;
        Include: Prisma.FeedbackResponseInclude;
        Select: Prisma.FeedbackResponseSelect;
        OrderBy: Prisma.FeedbackResponseOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.FeedbackResponseWhereUniqueInput;
        Where: Prisma.FeedbackResponseWhereInput;
        Create: {};
        Update: {};
        RelationName: "feedback";
        ListRelations: never;
        Relations: {
            feedback: {
                Shape: Feedback;
                Name: "Feedback";
            };
        };
    };
    ConfusionTimestep: {
        Name: "ConfusionTimestep";
        Shape: ConfusionTimestep;
        Include: Prisma.ConfusionTimestepInclude;
        Select: Prisma.ConfusionTimestepSelect;
        OrderBy: Prisma.ConfusionTimestepOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.ConfusionTimestepWhereUniqueInput;
        Where: Prisma.ConfusionTimestepWhereInput;
        Create: {};
        Update: {};
        RelationName: "session";
        ListRelations: never;
        Relations: {
            session: {
                Shape: LiveSession;
                Name: "LiveSession";
            };
        };
    };
    ParticipantAccount: {
        Name: "ParticipantAccount";
        Shape: ParticipantAccount;
        Include: Prisma.ParticipantAccountInclude;
        Select: Prisma.ParticipantAccountSelect;
        OrderBy: Prisma.ParticipantAccountOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.ParticipantAccountWhereUniqueInput;
        Where: Prisma.ParticipantAccountWhereInput;
        Create: {};
        Update: {};
        RelationName: "participant";
        ListRelations: never;
        Relations: {
            participant: {
                Shape: Participant;
                Name: "Participant";
            };
        };
    };
    Participant: {
        Name: "Participant";
        Shape: Participant;
        Include: Prisma.ParticipantInclude;
        Select: Prisma.ParticipantSelect;
        OrderBy: Prisma.ParticipantOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.ParticipantWhereUniqueInput;
        Where: Prisma.ParticipantWhereInput;
        Create: {};
        Update: {};
        RelationName: "participantGroups" | "accounts" | "participations" | "questionResponses" | "detailQuestionResponses" | "feedbacks" | "leaderboards" | "subscriptions" | "clueAssignments" | "awards" | "achievements" | "titles";
        ListRelations: "participantGroups" | "accounts" | "participations" | "questionResponses" | "detailQuestionResponses" | "feedbacks" | "leaderboards" | "subscriptions" | "clueAssignments" | "awards" | "achievements" | "titles";
        Relations: {
            participantGroups: {
                Shape: ParticipantGroup[];
                Name: "ParticipantGroup";
            };
            accounts: {
                Shape: ParticipantAccount[];
                Name: "ParticipantAccount";
            };
            participations: {
                Shape: Participation[];
                Name: "Participation";
            };
            questionResponses: {
                Shape: QuestionResponse[];
                Name: "QuestionResponse";
            };
            detailQuestionResponses: {
                Shape: QuestionResponseDetail[];
                Name: "QuestionResponseDetail";
            };
            feedbacks: {
                Shape: Feedback[];
                Name: "Feedback";
            };
            leaderboards: {
                Shape: LeaderboardEntry[];
                Name: "LeaderboardEntry";
            };
            subscriptions: {
                Shape: PushSubscription[];
                Name: "PushSubscription";
            };
            clueAssignments: {
                Shape: GroupActivityClueAssignment[];
                Name: "GroupActivityClueAssignment";
            };
            awards: {
                Shape: AwardEntry[];
                Name: "AwardEntry";
            };
            achievements: {
                Shape: ParticipantAchievementInstance[];
                Name: "ParticipantAchievementInstance";
            };
            titles: {
                Shape: Title[];
                Name: "Title";
            };
        };
    };
    ParticipantGroup: {
        Name: "ParticipantGroup";
        Shape: ParticipantGroup;
        Include: Prisma.ParticipantGroupInclude;
        Select: Prisma.ParticipantGroupSelect;
        OrderBy: Prisma.ParticipantGroupOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.ParticipantGroupWhereUniqueInput;
        Where: Prisma.ParticipantGroupWhereInput;
        Create: {};
        Update: {};
        RelationName: "participants" | "groupActivities" | "awards" | "achievements" | "course";
        ListRelations: "participants" | "groupActivities" | "awards" | "achievements";
        Relations: {
            participants: {
                Shape: Participant[];
                Name: "Participant";
            };
            groupActivities: {
                Shape: GroupActivityInstance[];
                Name: "GroupActivityInstance";
            };
            awards: {
                Shape: AwardEntry[];
                Name: "AwardEntry";
            };
            achievements: {
                Shape: GroupAchievementInstance[];
                Name: "GroupAchievementInstance";
            };
            course: {
                Shape: Course | null;
                Name: "Course";
            };
        };
    };
    Participation: {
        Name: "Participation";
        Shape: Participation;
        Include: Prisma.ParticipationInclude;
        Select: Prisma.ParticipationSelect;
        OrderBy: Prisma.ParticipationOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.ParticipationWhereUniqueInput;
        Where: Prisma.ParticipationWhereInput;
        Create: {};
        Update: {};
        RelationName: "course" | "participant" | "courseLeaderboard" | "sessionLeaderboards" | "responses" | "detailResponses" | "subscriptions" | "bookmarkedQuestions" | "bookmarkedStacks";
        ListRelations: "sessionLeaderboards" | "responses" | "detailResponses" | "subscriptions" | "bookmarkedQuestions" | "bookmarkedStacks";
        Relations: {
            course: {
                Shape: Course;
                Name: "Course";
            };
            participant: {
                Shape: Participant;
                Name: "Participant";
            };
            courseLeaderboard: {
                Shape: LeaderboardEntry | null;
                Name: "LeaderboardEntry";
            };
            sessionLeaderboards: {
                Shape: LeaderboardEntry[];
                Name: "LeaderboardEntry";
            };
            responses: {
                Shape: QuestionResponse[];
                Name: "QuestionResponse";
            };
            detailResponses: {
                Shape: QuestionResponseDetail[];
                Name: "QuestionResponseDetail";
            };
            subscriptions: {
                Shape: PushSubscription[];
                Name: "PushSubscription";
            };
            bookmarkedQuestions: {
                Shape: QuestionInstance[];
                Name: "QuestionInstance";
            };
            bookmarkedStacks: {
                Shape: QuestionStack[];
                Name: "QuestionStack";
            };
        };
    };
    Title: {
        Name: "Title";
        Shape: Title;
        Include: Prisma.TitleInclude;
        Select: Prisma.TitleSelect;
        OrderBy: Prisma.TitleOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.TitleWhereUniqueInput;
        Where: Prisma.TitleWhereInput;
        Create: {};
        Update: {};
        RelationName: "awardedBy" | "awardedTo" | "course";
        ListRelations: "awardedBy" | "awardedTo";
        Relations: {
            awardedBy: {
                Shape: Achievement[];
                Name: "Achievement";
            };
            awardedTo: {
                Shape: Participant[];
                Name: "Participant";
            };
            course: {
                Shape: Course;
                Name: "Course";
            };
        };
    };
    Achievement: {
        Name: "Achievement";
        Shape: Achievement;
        Include: Prisma.AchievementInclude;
        Select: Prisma.AchievementSelect;
        OrderBy: Prisma.AchievementOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.AchievementWhereUniqueInput;
        Where: Prisma.AchievementWhereInput;
        Create: {};
        Update: {};
        RelationName: "rewardedTitles" | "course" | "participantInstances" | "groupInstances" | "classInstances";
        ListRelations: "rewardedTitles" | "participantInstances" | "groupInstances" | "classInstances";
        Relations: {
            rewardedTitles: {
                Shape: Title[];
                Name: "Title";
            };
            course: {
                Shape: Course | null;
                Name: "Course";
            };
            participantInstances: {
                Shape: ParticipantAchievementInstance[];
                Name: "ParticipantAchievementInstance";
            };
            groupInstances: {
                Shape: GroupAchievementInstance[];
                Name: "GroupAchievementInstance";
            };
            classInstances: {
                Shape: ClassAchievementInstance[];
                Name: "ClassAchievementInstance";
            };
        };
    };
    ParticipantAchievementInstance: {
        Name: "ParticipantAchievementInstance";
        Shape: ParticipantAchievementInstance;
        Include: Prisma.ParticipantAchievementInstanceInclude;
        Select: Prisma.ParticipantAchievementInstanceSelect;
        OrderBy: Prisma.ParticipantAchievementInstanceOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.ParticipantAchievementInstanceWhereUniqueInput;
        Where: Prisma.ParticipantAchievementInstanceWhereInput;
        Create: {};
        Update: {};
        RelationName: "achievement" | "participant";
        ListRelations: never;
        Relations: {
            achievement: {
                Shape: Achievement;
                Name: "Achievement";
            };
            participant: {
                Shape: Participant;
                Name: "Participant";
            };
        };
    };
    GroupAchievementInstance: {
        Name: "GroupAchievementInstance";
        Shape: GroupAchievementInstance;
        Include: Prisma.GroupAchievementInstanceInclude;
        Select: Prisma.GroupAchievementInstanceSelect;
        OrderBy: Prisma.GroupAchievementInstanceOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.GroupAchievementInstanceWhereUniqueInput;
        Where: Prisma.GroupAchievementInstanceWhereInput;
        Create: {};
        Update: {};
        RelationName: "achievement" | "group";
        ListRelations: never;
        Relations: {
            achievement: {
                Shape: Achievement;
                Name: "Achievement";
            };
            group: {
                Shape: ParticipantGroup;
                Name: "ParticipantGroup";
            };
        };
    };
    ClassAchievementInstance: {
        Name: "ClassAchievementInstance";
        Shape: ClassAchievementInstance;
        Include: Prisma.ClassAchievementInstanceInclude;
        Select: Prisma.ClassAchievementInstanceSelect;
        OrderBy: Prisma.ClassAchievementInstanceOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.ClassAchievementInstanceWhereUniqueInput;
        Where: Prisma.ClassAchievementInstanceWhereInput;
        Create: {};
        Update: {};
        RelationName: "achievement" | "course";
        ListRelations: never;
        Relations: {
            achievement: {
                Shape: Achievement;
                Name: "Achievement";
            };
            course: {
                Shape: Course;
                Name: "Course";
            };
        };
    };
    QuestionResponse: {
        Name: "QuestionResponse";
        Shape: QuestionResponse;
        Include: Prisma.QuestionResponseInclude;
        Select: Prisma.QuestionResponseSelect;
        OrderBy: Prisma.QuestionResponseOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.QuestionResponseWhereUniqueInput;
        Where: Prisma.QuestionResponseWhereInput;
        Create: {};
        Update: {};
        RelationName: "participant" | "participation" | "questionInstance";
        ListRelations: never;
        Relations: {
            participant: {
                Shape: Participant;
                Name: "Participant";
            };
            participation: {
                Shape: Participation;
                Name: "Participation";
            };
            questionInstance: {
                Shape: QuestionInstance;
                Name: "QuestionInstance";
            };
        };
    };
    QuestionResponseDetail: {
        Name: "QuestionResponseDetail";
        Shape: QuestionResponseDetail;
        Include: Prisma.QuestionResponseDetailInclude;
        Select: Prisma.QuestionResponseDetailSelect;
        OrderBy: Prisma.QuestionResponseDetailOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.QuestionResponseDetailWhereUniqueInput;
        Where: Prisma.QuestionResponseDetailWhereInput;
        Create: {};
        Update: {};
        RelationName: "participant" | "participation" | "questionInstance";
        ListRelations: never;
        Relations: {
            participant: {
                Shape: Participant;
                Name: "Participant";
            };
            participation: {
                Shape: Participation;
                Name: "Participation";
            };
            questionInstance: {
                Shape: QuestionInstance;
                Name: "QuestionInstance";
            };
        };
    };
    PushSubscription: {
        Name: "PushSubscription";
        Shape: PushSubscription;
        Include: Prisma.PushSubscriptionInclude;
        Select: Prisma.PushSubscriptionSelect;
        OrderBy: Prisma.PushSubscriptionOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.PushSubscriptionWhereUniqueInput;
        Where: Prisma.PushSubscriptionWhereInput;
        Create: {};
        Update: {};
        RelationName: "course" | "participation" | "participant";
        ListRelations: never;
        Relations: {
            course: {
                Shape: Course;
                Name: "Course";
            };
            participation: {
                Shape: Participation;
                Name: "Participation";
            };
            participant: {
                Shape: Participant;
                Name: "Participant";
            };
        };
    };
    AwardEntry: {
        Name: "AwardEntry";
        Shape: AwardEntry;
        Include: Prisma.AwardEntryInclude;
        Select: Prisma.AwardEntrySelect;
        OrderBy: Prisma.AwardEntryOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.AwardEntryWhereUniqueInput;
        Where: Prisma.AwardEntryWhereInput;
        Create: {};
        Update: {};
        RelationName: "course" | "participant" | "participantGroup";
        ListRelations: never;
        Relations: {
            course: {
                Shape: Course;
                Name: "Course";
            };
            participant: {
                Shape: Participant | null;
                Name: "Participant";
            };
            participantGroup: {
                Shape: ParticipantGroup | null;
                Name: "ParticipantGroup";
            };
        };
    };
    Level: {
        Name: "Level";
        Shape: Level;
        Include: Prisma.LevelInclude;
        Select: Prisma.LevelSelect;
        OrderBy: Prisma.LevelOrderByWithRelationAndSearchRelevanceInput;
        WhereUnique: Prisma.LevelWhereUniqueInput;
        Where: Prisma.LevelWhereInput;
        Create: {};
        Update: {};
        RelationName: "nextLevel" | "prevLevel";
        ListRelations: "prevLevel";
        Relations: {
            nextLevel: {
                Shape: Level | null;
                Name: "Level";
            };
            prevLevel: {
                Shape: Level[];
                Name: "Level";
            };
        };
    };
}