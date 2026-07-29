"""Curated SQLAlchemy models for the tables used by Learning Analytics.

After a Prisma migration, generate an introspected reference:

    pnpm run prisma:setup
    pnpm --filter @klicker-uzh/analytics run generate

That command writes ``src/models.generated.py`` and never overwrites this
curated runtime surface. Reconcile relevant field, enum, relationship, and
constraint changes here, then delete or leave the ignored reference file.
Tables not touched by Analytics remain owned by Prisma migrations and do not
need mappings in this module.

Keep this file in sync with ``packages/prisma/src/prisma/schema/*.prisma``.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    LargeBinary,
    Numeric,
    SmallInteger,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY, ENUM, JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

Uuid = UUID(as_uuid=False)


class Base(DeclarativeBase):
    pass


# ----- Enums ---------------------------------------------------------------

AnalyticsType = ENUM(
    "DAILY", "WEEKLY", "MONTHLY", "COURSE", name="AnalyticsType", create_type=False
)
ActivityLevel = ENUM("LOW", "MEDIUM", "HIGH", name="ActivityLevel", create_type=False)
PerformanceLevel = ENUM(
    "LOW", "MEDIUM", "HIGH", name="PerformanceLevel", create_type=False
)
ChatDoseBucket = ENUM(
    "NONE", "LOW", "MED", "HIGH", name="ChatDoseBucket", create_type=False
)
ResponseCorrectness = ENUM(
    "CORRECT", "PARTIAL", "WRONG", name="ResponseCorrectness", create_type=False
)
Locale = ENUM("en", "de", name="Locale", create_type=False)
CourseAuthType = ENUM("SSO", "PIN", name="CourseAuthType", create_type=False)
ElementType = ENUM(
    "SC",
    "MC",
    "KPRIM",
    "FREE_TEXT",
    "NUMERICAL",
    "CONTENT",
    "FLASHCARD",
    "SELECTION",
    "CASE_STUDY",
    name="ElementType",
    create_type=False,
)
ElementInstanceType = ENUM(
    "LIVE_QUIZ",
    "PRACTICE_QUIZ",
    "MICROLEARNING",
    "GROUP_ACTIVITY",
    name="ElementInstanceType",
    create_type=False,
)
ElementStackType = ENUM(
    "PRACTICE_QUIZ",
    "MICROLEARNING",
    "GROUP_ACTIVITY",
    name="ElementStackType",
    create_type=False,
)
PublicationStatus = ENUM(
    "DRAFT",
    "SCHEDULED",
    "PUBLISHED",
    "ENDED",
    "GRADED",
    "TEMPLATE",
    name="PublicationStatus",
    create_type=False,
)


# ----- Core user / course / participant -------------------------------------


class User(Base):
    __tablename__ = "User"

    id: Mapped[str] = mapped_column(Uuid, primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True)
    shortname: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[Optional[str]] = mapped_column(String)
    locale: Mapped[str] = mapped_column(Locale, default="en")


class Course(Base):
    __tablename__ = "Course"

    id: Mapped[str] = mapped_column(Uuid, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    displayName: Mapped[str] = mapped_column(String)
    description: Mapped[Optional[str]] = mapped_column(String)
    language: Mapped[str] = mapped_column(Locale, default="en")
    color: Mapped[str] = mapped_column(String)
    startDate: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    endDate: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    notificationEmail: Mapped[Optional[str]] = mapped_column(String)
    areAnalyticsValid: Mapped[bool] = mapped_column(Boolean, default=False)
    analyticsLastComputedAt: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True)
    )
    chatAnalyticsValidAt: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True)
    )
    analyticsFinalizedAt: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True)
    )
    isArchived: Mapped[bool] = mapped_column(Boolean, default=False)
    authType: Mapped[str] = mapped_column(CourseAuthType, default="PIN")
    pinCode: Mapped[Optional[int]] = mapped_column(Integer)
    isGamificationEnabled: Mapped[bool] = mapped_column(Boolean, default=True)
    isGroupCreationEnabled: Mapped[bool] = mapped_column(Boolean, default=True)
    isAssessmentEnabled: Mapped[bool] = mapped_column(Boolean, default=False)
    ownerId: Mapped[str] = mapped_column(Uuid, ForeignKey("User.id"))
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    participations: Mapped[list["Participation"]] = relationship(back_populates="course")
    practiceQuizzes: Mapped[list["PracticeQuiz"]] = relationship(back_populates="course")
    microLearnings: Mapped[list["MicroLearning"]] = relationship(back_populates="course")


class Participant(Base):
    __tablename__ = "Participant"

    id: Mapped[str] = mapped_column(Uuid, primary_key=True)
    email: Mapped[Optional[str]] = mapped_column(String)
    isEmailValid: Mapped[bool] = mapped_column(Boolean, default=False)
    username: Mapped[str] = mapped_column(String, unique=True)
    password: Mapped[str] = mapped_column(String)
    avatar: Mapped[Optional[str]] = mapped_column(String)
    xp: Mapped[int] = mapped_column(Integer, default=0)
    isActive: Mapped[bool] = mapped_column(Boolean, default=True)
    isProfilePublic: Mapped[bool] = mapped_column(Boolean, default=True)
    isSSOAccount: Mapped[bool] = mapped_column(Boolean, default=False)
    locale: Mapped[str] = mapped_column(Locale, default="en")
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    participations: Mapped[list["Participation"]] = relationship(back_populates="participant")
    detailQuestionResponses: Mapped[list["QuestionResponseDetail"]] = relationship(
        back_populates="participant"
    )


class Participation(Base):
    __tablename__ = "Participation"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    isActive: Mapped[bool] = mapped_column(Boolean, default=False)
    courseId: Mapped[str] = mapped_column(Uuid, ForeignKey("Course.id"))
    participantId: Mapped[str] = mapped_column(Uuid, ForeignKey("Participant.id"))
    courseLeaderboardId: Mapped[Optional[int]] = mapped_column(Integer)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    course: Mapped[Course] = relationship(back_populates="participations")
    participant: Mapped[Participant] = relationship(back_populates="participations")
    responses: Mapped[list["QuestionResponse"]] = relationship(
        back_populates="participation"
    )
    detailResponses: Mapped[list["QuestionResponseDetail"]] = relationship(
        back_populates="participation"
    )


# ----- Element & quiz models ------------------------------------------------


class Element(Base):
    __tablename__ = "Element"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    originalId: Mapped[Optional[str]] = mapped_column(String)
    isArchived: Mapped[bool] = mapped_column(Boolean, default=False)
    isDeleted: Mapped[bool] = mapped_column(Boolean, default=False)
    name: Mapped[str] = mapped_column(String)
    content: Mapped[str] = mapped_column(String)
    explanation: Mapped[Optional[str]] = mapped_column(String)
    basePoints: Mapped[bool] = mapped_column(Boolean, default=True)
    pointsMultiplier: Mapped[int] = mapped_column(Integer, default=1)
    options: Mapped[dict] = mapped_column(JSONB)
    type: Mapped[str] = mapped_column(ElementType)
    ownerId: Mapped[str] = mapped_column(Uuid, ForeignKey("User.id"))
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ElementInstance(Base):
    __tablename__ = "ElementInstance"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type: Mapped[str] = mapped_column(ElementInstanceType)
    elementType: Mapped[str] = mapped_column(ElementType)
    order: Mapped[int] = mapped_column(Integer)
    options: Mapped[dict] = mapped_column(JSONB)
    elementData: Mapped[dict] = mapped_column(JSONB)
    results: Mapped[dict] = mapped_column(JSONB)
    anonymousResults: Mapped[dict] = mapped_column(JSONB)
    isVersionOutdated: Mapped[bool] = mapped_column(Boolean, default=False)
    elementId: Mapped[int] = mapped_column(Integer, ForeignKey("Element.id"))
    elementStackId: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("ElementStack.id"))
    elementBlockId: Mapped[Optional[int]] = mapped_column(Integer)
    ownerId: Mapped[str] = mapped_column(Uuid, ForeignKey("User.id"))
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    stack: Mapped[Optional["ElementStack"]] = relationship(back_populates="elements")
    responses: Mapped[list["QuestionResponse"]] = relationship(
        back_populates="elementInstance"
    )


class ElementStack(Base):
    __tablename__ = "ElementStack"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type: Mapped[str] = mapped_column(ElementStackType)
    order: Mapped[int] = mapped_column(Integer)
    displayName: Mapped[Optional[str]] = mapped_column(String)
    description: Mapped[Optional[str]] = mapped_column(String)
    practiceQuizId: Mapped[Optional[str]] = mapped_column(
        Uuid, ForeignKey("PracticeQuiz.id")
    )
    microLearningId: Mapped[Optional[str]] = mapped_column(
        Uuid, ForeignKey("MicroLearning.id")
    )
    groupActivityId: Mapped[Optional[str]] = mapped_column(Uuid)
    courseId: Mapped[Optional[str]] = mapped_column(Uuid, ForeignKey("Course.id"))

    elements: Mapped[list[ElementInstance]] = relationship(back_populates="stack")
    practiceQuiz: Mapped[Optional["PracticeQuiz"]] = relationship(
        back_populates="stacks"
    )
    microLearning: Mapped[Optional["MicroLearning"]] = relationship(
        back_populates="stacks"
    )


class PracticeQuiz(Base):
    __tablename__ = "PracticeQuiz"

    id: Mapped[str] = mapped_column(Uuid, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    displayName: Mapped[str] = mapped_column(String)
    description: Mapped[Optional[str]] = mapped_column(String)
    pointsMultiplier: Mapped[int] = mapped_column(Integer, default=1)
    resetTimeDays: Mapped[int] = mapped_column(Integer, default=6)
    status: Mapped[str] = mapped_column(PublicationStatus, default="DRAFT")
    isGamificationEnabled: Mapped[bool] = mapped_column(Boolean, default=False)
    isAssessmentEnabled: Mapped[bool] = mapped_column(Boolean, default=False)
    isDeleted: Mapped[bool] = mapped_column(Boolean, default=False)
    ownerId: Mapped[str] = mapped_column(Uuid, ForeignKey("User.id"))
    courseId: Mapped[str] = mapped_column(Uuid, ForeignKey("Course.id"))
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    course: Mapped[Course] = relationship(back_populates="practiceQuizzes")
    stacks: Mapped[list[ElementStack]] = relationship(back_populates="practiceQuiz")
    responses: Mapped[list["QuestionResponse"]] = relationship(
        back_populates="practiceQuiz"
    )


class MicroLearning(Base):
    __tablename__ = "MicroLearning"

    id: Mapped[str] = mapped_column(Uuid, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    displayName: Mapped[str] = mapped_column(String)
    pointsMultiplier: Mapped[int] = mapped_column(Integer, default=1)
    description: Mapped[Optional[str]] = mapped_column(String)
    status: Mapped[str] = mapped_column(PublicationStatus, default="DRAFT")
    scheduledStartAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    scheduledEndAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    isGamificationEnabled: Mapped[bool] = mapped_column(Boolean, default=False)
    isAssessmentEnabled: Mapped[bool] = mapped_column(Boolean, default=False)
    isDeleted: Mapped[bool] = mapped_column(Boolean, default=False)
    ownerId: Mapped[str] = mapped_column(Uuid, ForeignKey("User.id"))
    courseId: Mapped[str] = mapped_column(Uuid, ForeignKey("Course.id"))
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    course: Mapped[Course] = relationship(back_populates="microLearnings")
    stacks: Mapped[list[ElementStack]] = relationship(back_populates="microLearning")
    responses: Mapped[list["QuestionResponse"]] = relationship(
        back_populates="microLearning"
    )


class LiveQuiz(Base):
    __tablename__ = "LiveQuiz"

    id: Mapped[str] = mapped_column(Uuid, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    displayName: Mapped[str] = mapped_column(String)
    description: Mapped[Optional[str]] = mapped_column(String)
    isAssessmentEnabled: Mapped[bool] = mapped_column(Boolean, default=False)
    isDeleted: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(PublicationStatus, default="DRAFT")
    namespace: Mapped[str] = mapped_column(Uuid)
    pinCode: Mapped[Optional[str]] = mapped_column(String)
    startedAt: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    finishedAt: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    ownerId: Mapped[str] = mapped_column(Uuid, ForeignKey("User.id"))
    courseId: Mapped[Optional[str]] = mapped_column(Uuid, ForeignKey("Course.id"))
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))


# ----- Responses ------------------------------------------------------------


class QuestionResponse(Base):
    __tablename__ = "QuestionResponse"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    trialsCount: Mapped[int] = mapped_column(Integer, default=0)
    totalScore: Mapped[float] = mapped_column(Float, default=0)
    totalPointsAwarded: Mapped[Optional[float]] = mapped_column(Float, default=0)
    totalXpAwarded: Mapped[float] = mapped_column(Float, default=0)
    averageTimeSpent: Mapped[float] = mapped_column(Float)
    lastAwardedAt: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    lastXpAwardedAt: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    lastAnsweredAt: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    correctCount: Mapped[int] = mapped_column(Integer, default=0)
    correctCountStreak: Mapped[int] = mapped_column(Integer, default=0)
    lastCorrectAt: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    partialCorrectCount: Mapped[int] = mapped_column(Integer, default=0)
    lastPartialCorrectAt: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True)
    )
    wrongCount: Mapped[int] = mapped_column(Integer, default=0)
    lastWrongAt: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    eFactor: Mapped[float] = mapped_column(Float, default=2.5)
    interval: Mapped[int] = mapped_column(Integer, default=1)
    nextDueAt: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    firstResponse: Mapped[dict] = mapped_column(JSONB)
    firstResponseCorrectness: Mapped[str] = mapped_column(ResponseCorrectness)
    lastResponse: Mapped[dict] = mapped_column(JSONB)
    lastResponseCorrectness: Mapped[str] = mapped_column(ResponseCorrectness)
    aggregatedResponses: Mapped[Optional[dict]] = mapped_column(JSONB)
    participantId: Mapped[str] = mapped_column(Uuid, ForeignKey("Participant.id"))
    participationId: Mapped[int] = mapped_column(Integer, ForeignKey("Participation.id"))
    elementInstanceId: Mapped[int] = mapped_column(
        Integer, ForeignKey("ElementInstance.id")
    )
    practiceQuizId: Mapped[Optional[str]] = mapped_column(
        Uuid, ForeignKey("PracticeQuiz.id")
    )
    microLearningId: Mapped[Optional[str]] = mapped_column(
        Uuid, ForeignKey("MicroLearning.id")
    )
    courseId: Mapped[str] = mapped_column(Uuid, ForeignKey("Course.id"))
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    isMigrated: Mapped[bool] = mapped_column(Boolean, default=False)

    participation: Mapped[Participation] = relationship(back_populates="responses")
    elementInstance: Mapped[ElementInstance] = relationship(back_populates="responses")
    practiceQuiz: Mapped[Optional[PracticeQuiz]] = relationship(back_populates="responses")
    microLearning: Mapped[Optional[MicroLearning]] = relationship(back_populates="responses")


class QuestionResponseDetail(Base):
    __tablename__ = "QuestionResponseDetail"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    score: Mapped[float] = mapped_column(Float, default=0)
    pointsAwarded: Mapped[Optional[float]] = mapped_column(Float, default=0)
    xpAwarded: Mapped[float] = mapped_column(Float, default=0)
    timeSpent: Mapped[float] = mapped_column(Float)
    response: Mapped[dict] = mapped_column(JSONB)
    participantId: Mapped[str] = mapped_column(Uuid, ForeignKey("Participant.id"))
    participationId: Mapped[int] = mapped_column(Integer, ForeignKey("Participation.id"))
    elementInstanceId: Mapped[int] = mapped_column(
        Integer, ForeignKey("ElementInstance.id")
    )
    practiceQuizId: Mapped[Optional[str]] = mapped_column(
        Uuid, ForeignKey("PracticeQuiz.id")
    )
    microLearningId: Mapped[Optional[str]] = mapped_column(
        Uuid, ForeignKey("MicroLearning.id")
    )
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    participant: Mapped[Participant] = relationship(back_populates="detailQuestionResponses")
    participation: Mapped[Participation] = relationship(back_populates="detailResponses")
    elementInstance: Mapped[ElementInstance] = relationship()
    practiceQuiz: Mapped[Optional[PracticeQuiz]] = relationship()
    microLearning: Mapped[Optional[MicroLearning]] = relationship()


class LiveQuizResponse(Base):
    __tablename__ = "LiveQuizResponse"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    submittedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    response: Mapped[Optional[dict]] = mapped_column(JSONB)
    timeSpent: Mapped[float] = mapped_column(Float)
    correctness: Mapped[str] = mapped_column(ResponseCorrectness)
    basePoints: Mapped[float] = mapped_column(Float)
    correctnessPoints: Mapped[float] = mapped_column(Float)
    bonusPoints: Mapped[float] = mapped_column(Float)
    instanceId: Mapped[int] = mapped_column(Integer, ForeignKey("ElementInstance.id"))
    elementBlockExecution: Mapped[int] = mapped_column(Integer)
    participantId: Mapped[str] = mapped_column(Uuid, ForeignKey("Participant.id"))
    correctionOnly: Mapped[bool] = mapped_column(Boolean, default=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))


# ----- Chat -----------------------------------------------------------------


class Chatbot(Base):
    __tablename__ = "Chatbot"

    id: Mapped[str] = mapped_column(Uuid, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    description: Mapped[Optional[str]] = mapped_column(String)
    avatar: Mapped[Optional[str]] = mapped_column(String)
    courseId: Mapped[str] = mapped_column(Uuid, ForeignKey("Course.id"))
    ownerId: Mapped[str] = mapped_column(Uuid, ForeignKey("User.id"))
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ChatThread(Base):
    __tablename__ = "ChatThread"

    id: Mapped[str] = mapped_column(Uuid, primary_key=True)
    title: Mapped[Optional[str]] = mapped_column(String)
    participantId: Mapped[str] = mapped_column(Uuid, ForeignKey("Participant.id"))
    chatbotId: Mapped[str] = mapped_column(Uuid, ForeignKey("Chatbot.id"))
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ChatMessage(Base):
    __tablename__ = "ChatMessage"

    id: Mapped[str] = mapped_column(Uuid, primary_key=True)
    threadId: Mapped[str] = mapped_column(Uuid, ForeignKey("ChatThread.id"))
    parentId: Mapped[Optional[str]] = mapped_column(Uuid)
    role: Mapped[str] = mapped_column(String)
    content: Mapped[Any] = mapped_column(JSONB)
    chatMode: Mapped[Optional[str]] = mapped_column(String)
    modelId: Mapped[Optional[str]] = mapped_column(String)
    reasoningEffort: Mapped[Optional[str]] = mapped_column(String)
    reasoningContent: Mapped[Optional[str]] = mapped_column(Text)
    creditsUsed: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 6))
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ChatAttachment(Base):
    __tablename__ = "ChatAttachment"

    id: Mapped[str] = mapped_column(Uuid, primary_key=True)
    type: Mapped[str] = mapped_column(String)
    position: Mapped[int] = mapped_column(Integer)
    imageBase64: Mapped[Optional[str]] = mapped_column(Text)
    imagePreviewBase64: Mapped[Optional[str]] = mapped_column(Text)
    imageDescription: Mapped[Optional[str]] = mapped_column(Text)
    messageId: Mapped[str] = mapped_column(Uuid, ForeignKey("ChatMessage.id"))
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ChatUsageCredits(Base):
    __tablename__ = "ChatUsageCredits"

    total: Mapped[Decimal] = mapped_column(Numeric(18, 6), default=0)
    current: Mapped[Decimal] = mapped_column(Numeric(18, 6), default=0)
    participantId: Mapped[str] = mapped_column(
        Uuid, ForeignKey("Participant.id"), primary_key=True
    )
    chatbotId: Mapped[str] = mapped_column(
        Uuid, ForeignKey("Chatbot.id"), primary_key=True
    )
    periodStartedAt: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    lastResetAt: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    resetCount: Mapped[int] = mapped_column(Integer, default=0)
    acceptedDisclaimerId: Mapped[Optional[str]] = mapped_column(Uuid)
    disclaimerAcceptedAt: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True)
    )
    disclaimerDeclined: Mapped[bool] = mapped_column(Boolean, default=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))


# ----- Analytics outputs ----------------------------------------------------


class ParticipantAnalytics(Base):
    __tablename__ = "ParticipantAnalytics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type: Mapped[str] = mapped_column(AnalyticsType)
    timestamp: Mapped[date] = mapped_column(Date)
    computedAt: Mapped[date] = mapped_column(Date)
    trialsCount: Mapped[int] = mapped_column(Integer)
    responseCount: Mapped[int] = mapped_column(Integer)
    totalScore: Mapped[int] = mapped_column(Integer)
    totalPoints: Mapped[int] = mapped_column(Integer)
    totalXp: Mapped[int] = mapped_column(Integer)
    meanCorrectCount: Mapped[float] = mapped_column(Float)
    meanPartialCorrectCount: Mapped[float] = mapped_column(Float)
    meanWrongCount: Mapped[float] = mapped_column(Float)
    firstCorrectCount: Mapped[Optional[float]] = mapped_column(Float)
    lastCorrectCount: Mapped[Optional[float]] = mapped_column(Float)
    firstWrongCount: Mapped[Optional[float]] = mapped_column(Float)
    lastWrongCount: Mapped[Optional[float]] = mapped_column(Float)
    participantId: Mapped[str] = mapped_column(Uuid, ForeignKey("Participant.id"))
    courseId: Mapped[str] = mapped_column(Uuid, ForeignKey("Course.id"))
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class AggregatedAnalytics(Base):
    __tablename__ = "AggregatedAnalytics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type: Mapped[str] = mapped_column(AnalyticsType)
    timestamp: Mapped[date] = mapped_column(Date)
    computedAt: Mapped[date] = mapped_column(Date)
    responseCount: Mapped[int] = mapped_column(Integer)
    participantCount: Mapped[int] = mapped_column(Integer)
    totalScore: Mapped[int] = mapped_column(Integer)
    totalPoints: Mapped[int] = mapped_column(Integer)
    totalXp: Mapped[int] = mapped_column(Integer)
    totalElementsAvailable: Mapped[int] = mapped_column(Integer)
    courseId: Mapped[str] = mapped_column(Uuid, ForeignKey("Course.id"))
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ParticipantCourseAnalytics(Base):
    __tablename__ = "ParticipantCourseAnalytics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    activeWeeks: Mapped[int] = mapped_column(Integer)
    activeDaysPerWeek: Mapped[float] = mapped_column(Float)
    meanElementsPerDay: Mapped[float] = mapped_column(Float)
    activityLevel: Mapped[str] = mapped_column(ActivityLevel)
    hasChatActivity: Mapped[bool] = mapped_column(Boolean, default=False)
    courseId: Mapped[str] = mapped_column(Uuid, ForeignKey("Course.id"))
    participantId: Mapped[str] = mapped_column(Uuid, ForeignKey("Participant.id"))
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class AggregatedCourseAnalytics(Base):
    __tablename__ = "AggregatedCourseAnalytics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    courseParticipantCount: Mapped[int] = mapped_column(Integer)
    activityMonday: Mapped[float] = mapped_column(Float)
    activityTuesday: Mapped[float] = mapped_column(Float)
    activityWednesday: Mapped[float] = mapped_column(Float)
    activityThursday: Mapped[float] = mapped_column(Float)
    activityFriday: Mapped[float] = mapped_column(Float)
    activitySaturday: Mapped[float] = mapped_column(Float)
    activitySunday: Mapped[float] = mapped_column(Float)
    chatbotCount: Mapped[int] = mapped_column(Integer, default=0)
    practiceQuizCount: Mapped[int] = mapped_column(Integer, default=0)
    microLearningCount: Mapped[int] = mapped_column(Integer, default=0)
    liveQuizCount: Mapped[int] = mapped_column(Integer, default=0)
    chatParticipantCount: Mapped[int] = mapped_column(Integer, default=0)
    quizParticipantCount: Mapped[int] = mapped_column(Integer, default=0)
    bothChatAndQuizCount: Mapped[int] = mapped_column(Integer, default=0)
    courseId: Mapped[str] = mapped_column(
        Uuid, ForeignKey("Course.id"), unique=True
    )
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ParticipantPerformance(Base):
    __tablename__ = "ParticipantPerformance"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    firstErrorRate: Mapped[float] = mapped_column(Float)
    firstPerformance: Mapped[str] = mapped_column(PerformanceLevel)
    lastErrorRate: Mapped[float] = mapped_column(Float)
    lastPerformance: Mapped[str] = mapped_column(PerformanceLevel)
    totalErrorRate: Mapped[float] = mapped_column(Float)
    totalPerformance: Mapped[str] = mapped_column(PerformanceLevel)
    participantId: Mapped[str] = mapped_column(Uuid, ForeignKey("Participant.id"))
    courseId: Mapped[str] = mapped_column(Uuid, ForeignKey("Course.id"))
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class InstancePerformance(Base):
    __tablename__ = "InstancePerformance"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    responseCount: Mapped[int] = mapped_column(Integer)
    averageTimeSpent: Mapped[float] = mapped_column(Float)
    firstErrorRate: Mapped[Optional[float]] = mapped_column(Float)
    firstPartialRate: Mapped[Optional[float]] = mapped_column(Float)
    firstCorrectRate: Mapped[Optional[float]] = mapped_column(Float)
    lastErrorRate: Mapped[Optional[float]] = mapped_column(Float)
    lastPartialRate: Mapped[Optional[float]] = mapped_column(Float)
    lastCorrectRate: Mapped[Optional[float]] = mapped_column(Float)
    totalErrorRate: Mapped[float] = mapped_column(Float)
    totalPartialRate: Mapped[float] = mapped_column(Float)
    totalCorrectRate: Mapped[float] = mapped_column(Float)
    instanceId: Mapped[int] = mapped_column(
        Integer, ForeignKey("ElementInstance.id"), unique=True
    )
    courseId: Mapped[str] = mapped_column(Uuid, ForeignKey("Course.id"))
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ActivityPerformance(Base):
    __tablename__ = "ActivityPerformance"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    firstErrorRate: Mapped[Optional[float]] = mapped_column(Float)
    firstPartialRate: Mapped[Optional[float]] = mapped_column(Float)
    firstCorrectRate: Mapped[Optional[float]] = mapped_column(Float)
    lastErrorRate: Mapped[Optional[float]] = mapped_column(Float)
    lastPartialRate: Mapped[Optional[float]] = mapped_column(Float)
    lastCorrectRate: Mapped[Optional[float]] = mapped_column(Float)
    totalErrorRate: Mapped[float] = mapped_column(Float)
    totalPartialRate: Mapped[float] = mapped_column(Float)
    totalCorrectRate: Mapped[float] = mapped_column(Float)
    practiceQuizId: Mapped[Optional[str]] = mapped_column(
        Uuid, ForeignKey("PracticeQuiz.id"), unique=True
    )
    microLearningId: Mapped[Optional[str]] = mapped_column(
        Uuid, ForeignKey("MicroLearning.id"), unique=True
    )
    courseId: Mapped[str] = mapped_column(Uuid, ForeignKey("Course.id"))
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ParticipantActivityPerformance(Base):
    __tablename__ = "ParticipantActivityPerformance"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    totalScore: Mapped[int] = mapped_column(Integer)
    completion: Mapped[float] = mapped_column(Float)
    participantId: Mapped[str] = mapped_column(Uuid, ForeignKey("Participant.id"))
    practiceQuizId: Mapped[Optional[str]] = mapped_column(
        Uuid, ForeignKey("PracticeQuiz.id")
    )
    microLearningId: Mapped[Optional[str]] = mapped_column(
        Uuid, ForeignKey("MicroLearning.id")
    )


class ActivityProgress(Base):
    __tablename__ = "ActivityProgress"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    totalCourseParticipants: Mapped[int] = mapped_column(Integer)
    startedCount: Mapped[int] = mapped_column(Integer)
    completedCount: Mapped[int] = mapped_column(Integer)
    repeatedCount: Mapped[Optional[int]] = mapped_column(Integer)
    practiceQuizId: Mapped[Optional[str]] = mapped_column(
        Uuid, ForeignKey("PracticeQuiz.id"), unique=True
    )
    microLearningId: Mapped[Optional[str]] = mapped_column(
        Uuid, ForeignKey("MicroLearning.id"), unique=True
    )
    courseId: Mapped[str] = mapped_column(Uuid, ForeignKey("Course.id"))
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ParticipantChatAnalytics(Base):
    __tablename__ = "ParticipantChatAnalytics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type: Mapped[str] = mapped_column(AnalyticsType)
    timestamp: Mapped[date] = mapped_column(Date)
    participantId: Mapped[str] = mapped_column(Uuid, ForeignKey("Participant.id"))
    chatbotId: Mapped[str] = mapped_column(Uuid, ForeignKey("Chatbot.id"))
    courseId: Mapped[str] = mapped_column(Uuid, ForeignKey("Course.id"))
    userMessages: Mapped[int] = mapped_column(Integer, default=0)
    assistantMessages: Mapped[int] = mapped_column(Integer, default=0)
    threads: Mapped[int] = mapped_column(Integer, default=0)
    distinctDays: Mapped[int] = mapped_column(Integer, default=0)
    firstMessageAt: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    lastMessageAt: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    msgLenMedian: Mapped[Optional[float]] = mapped_column(Float)
    msgLenP90: Mapped[Optional[float]] = mapped_column(Float)
    msgLenP99: Mapped[Optional[float]] = mapped_column(Float)
    messagesPerThreadP50: Mapped[Optional[float]] = mapped_column(Float)
    messagesPerThreadP90: Mapped[Optional[float]] = mapped_column(Float)
    chatModeCounts: Mapped[dict] = mapped_column(JSONB, default=dict)
    reasoningEffortCounts: Mapped[dict] = mapped_column(JSONB, default=dict)
    attachmentCount: Mapped[int] = mapped_column(Integer, default=0)
    toolCallCount: Mapped[int] = mapped_column(Integer, default=0)
    totalCreditsUsed: Mapped[Decimal] = mapped_column(Numeric(18, 6), default=0)
    creditsExhausted: Mapped[bool] = mapped_column(Boolean, default=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class AggregatedChatbotAnalytics(Base):
    __tablename__ = "AggregatedChatbotAnalytics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type: Mapped[str] = mapped_column(AnalyticsType)
    timestamp: Mapped[date] = mapped_column(Date)
    chatbotId: Mapped[str] = mapped_column(Uuid, ForeignKey("Chatbot.id"))
    courseId: Mapped[str] = mapped_column(Uuid, ForeignKey("Course.id"))
    activeParticipants: Mapped[int] = mapped_column(Integer, default=0)
    newParticipants: Mapped[int] = mapped_column(Integer, default=0)
    returningParticipants: Mapped[int] = mapped_column(Integer, default=0)
    threads: Mapped[int] = mapped_column(Integer, default=0)
    userMessages: Mapped[int] = mapped_column(Integer, default=0)
    assistantMessages: Mapped[int] = mapped_column(Integer, default=0)
    totalCreditsUsed: Mapped[Decimal] = mapped_column(Numeric(18, 6), default=0)
    creditExhaustionRate: Mapped[Optional[float]] = mapped_column(Float)
    disclaimerAcceptedCount: Mapped[int] = mapped_column(Integer, default=0)
    disclaimerDeclinedCount: Mapped[int] = mapped_column(Integer, default=0)
    hourOfDayDistribution: Mapped[dict] = mapped_column(JSONB, default=dict)
    modelDistribution: Mapped[dict] = mapped_column(JSONB, default=dict)
    modeDistribution: Mapped[dict] = mapped_column(JSONB, default=dict)
    reasoningEffortDistribution: Mapped[dict] = mapped_column(JSONB, default=dict)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ChatTopicCluster(Base):
    __tablename__ = "ChatTopicCluster"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type: Mapped[str] = mapped_column(AnalyticsType)
    timestamp: Mapped[date] = mapped_column(Date)
    chatbotId: Mapped[str] = mapped_column(Uuid, ForeignKey("Chatbot.id"))
    clusterIndex: Mapped[int] = mapped_column(Integer)
    clusterLabel: Mapped[str] = mapped_column(String)
    messageCount: Mapped[int] = mapped_column(Integer)
    participantCount: Mapped[int] = mapped_column(Integer)
    representativeParaphrase: Mapped[Optional[str]] = mapped_column(String)
    embeddingCentroid: Mapped[Optional[bytes]] = mapped_column(LargeBinary)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ParticipantChatOutcome(Base):
    __tablename__ = "ParticipantChatOutcome"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    participantId: Mapped[str] = mapped_column(Uuid, ForeignKey("Participant.id"))
    courseId: Mapped[str] = mapped_column(Uuid, ForeignKey("Course.id"))
    chatMessagesInCourse: Mapped[int] = mapped_column(Integer, default=0)
    chatDoseBucket: Mapped[str] = mapped_column(ChatDoseBucket)
    firstErrorRate: Mapped[Optional[float]] = mapped_column(Float)
    lastErrorRate: Mapped[Optional[float]] = mapped_column(Float)
    errorRateDelta: Mapped[Optional[float]] = mapped_column(Float)
    hasBothModalities: Mapped[bool] = mapped_column(Boolean, default=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ParticipantLiveQuizAnalytics(Base):
    __tablename__ = "ParticipantLiveQuizAnalytics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    participantId: Mapped[str] = mapped_column(Uuid, ForeignKey("Participant.id"))
    liveQuizId: Mapped[str] = mapped_column(Uuid, ForeignKey("LiveQuiz.id"))
    courseId: Mapped[str] = mapped_column(Uuid, ForeignKey("Course.id"))
    totalResponses: Mapped[int] = mapped_column(Integer, default=0)
    firstCorrectCount: Mapped[int] = mapped_column(Integer, default=0)
    lastCorrectCount: Mapped[int] = mapped_column(Integer, default=0)
    averageTimeSpent: Mapped[Optional[float]] = mapped_column(Float)
    totalBasePoints: Mapped[int] = mapped_column(Integer, default=0)
    totalCorrectnessPoints: Mapped[int] = mapped_column(Integer, default=0)
    totalBonusPoints: Mapped[int] = mapped_column(Integer, default=0)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class AggregatedLiveQuizAnalytics(Base):
    __tablename__ = "AggregatedLiveQuizAnalytics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    liveQuizId: Mapped[str] = mapped_column(
        Uuid, ForeignKey("LiveQuiz.id"), unique=True
    )
    courseId: Mapped[str] = mapped_column(Uuid, ForeignKey("Course.id"))
    participantCount: Mapped[int] = mapped_column(Integer, default=0)
    responseCount: Mapped[int] = mapped_column(Integer, default=0)
    meanFirstCorrectness: Mapped[Optional[float]] = mapped_column(Float)
    meanLastCorrectness: Mapped[Optional[float]] = mapped_column(Float)
    lateSubmitterRate: Mapped[Optional[float]] = mapped_column(Float)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class PlatformSemesterAnalytics(Base):
    __tablename__ = "PlatformSemesterAnalytics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    semesterLabel: Mapped[str] = mapped_column(String, unique=True)
    semesterStart: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    semesterEnd: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    quizResponseRows: Mapped[int] = mapped_column(Integer, default=0)
    quizTrials: Mapped[int] = mapped_column(Integer, default=0)
    quizDistinctParticipants: Mapped[int] = mapped_column(Integer, default=0)
    liveQuizResponses: Mapped[int] = mapped_column(Integer, default=0)
    liveQuizDistinctParticipants: Mapped[int] = mapped_column(Integer, default=0)
    chatMessages: Mapped[int] = mapped_column(Integer, default=0)
    chatDistinctParticipants: Mapped[int] = mapped_column(Integer, default=0)
    activeCourses: Mapped[int] = mapped_column(Integer, default=0)
    coursesWithChatbot: Mapped[int] = mapped_column(Integer, default=0)
    coursesWithLiveQuiz: Mapped[int] = mapped_column(Integer, default=0)
    coursesWithQuizActivity: Mapped[int] = mapped_column(Integer, default=0)
    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True))
