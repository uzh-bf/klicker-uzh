import 'dotenv/config'

import Prisma from '@klicker-uzh/prisma'
import bcrypt from 'bcryptjs'
import { omit } from 'ramda'
import { PARTICIPANT_IDS } from './constants.js'

async function prepareUser({
  password,
  ...args
}: {
  id: string
  email: string
  password: string
  shortname: string
}) {
  const hashedPassword = await bcrypt.hash(password, 12)

  const data = {
    ...args,
    password: hashedPassword,
    isActive: true,
  }

  return {
    where: { id: args.id },
    create: data,
    update: data,
  }
}

function prepareCourse({
  ownerId,
  ...args
}: {
  id: string
  name: string
  displayName: string
  ownerId: string
}) {
  const data = {
    ...args,
    owner: {
      connect: {
        id: ownerId,
      },
    },
  }

  return {
    where: { id: args.id },
    create: data,
    update: data,
  }
}

async function prepareParticipant({
  password,
  courseId,
  ...args
}: {
  id: string
  email: string
  password: string
  username: string
  courseId: string
}) {
  const hashedPassword = await bcrypt.hash(password, 12)

  const data = {
    ...args,
    password: hashedPassword,
    avatar: '41b98856a8c221db667cf066f34b931eff048c32',
  }

  return {
    where: { id: args.id },
    create: {
      ...data,
      participations: {
        create: {
          course: {
            connect: {
              id: courseId,
            },
          },
        },
      },
    },
    update: data,
  }
}

function prepareAttachment({
  ownerId,
  ...args
}: {
  id: string
  ownerId: string
  name: string
  href: string
  type: Prisma.AttachmentType
}) {
  const data = {
    ...args,
    owner: {
      connect: {
        id: ownerId,
      },
    },
  }

  return {
    where: {
      id: args.id,
    },
    create: data,
    update: data,
  }
}

function prepareQuestion({
  choices,
  options,
  ...args
}: {
  id: number
  name: string
  content: string
  contentPlain: string
  type: Prisma.QuestionType
  ownerId: string
  choices?: {
    value: string
    feedback: string
    correct?: boolean
  }[]
  options?: any
}) {
  if (choices) {
    const preparedChoices = choices.map((choice, ix) => ({
      ix,
      value: choice.value,
      feedback: choice.feedback,
      correct: choice.correct ?? false,
    }))

    const data = {
      ...args,
      options: {
        choices: preparedChoices,
      },
    }

    return {
      where: {
        id: args.id,
      },
      create: data,
      update: data,
    }
  }

  const data = {
    ...args,
    options: options ?? {},
  }

  return {
    where: {
      id: args.id,
    },
    create: data,
    update: data,
  }
}

function prepareQuestionInstance({
  question,
  id,
}: {
  id: number
  question: Prisma.Question
}) {
  switch (question.type) {
    case Prisma.QuestionType.SC:
    case Prisma.QuestionType.MC:
    case Prisma.QuestionType.KPRIM: {
      const questionOptions = question.options?.valueOf() as {
        choices: {
          ix: number
          value: string
          feedback: string
          correct: boolean
        }[]
      }

      const data = {
        id,
        questionData: omit(['createdAt', 'updatedAt', 'attachments'], question),
        results: {
          choices: questionOptions.choices.reduce(
            (acc, choice) => ({
              [choice.ix]: 0,
            }),
            {}
          ),
        },
        questionId: question.id,
        ownerId: question.ownerId,
      }

      return {
        where: {
          id,
        },
        create: data,
        update: data,
      }
    }

    case Prisma.QuestionType.NUMERICAL: {
      const data = {
        id,
        questionData: omit(['createdAt', 'updatedAt', 'attachments'], question),
        questionId: question.id,
        ownerId: question.ownerId,
        results: {
          answers: [],
        },
      }

      return {
        where: {
          id,
        },
        create: data,
        update: data,
      }
    }

    case Prisma.QuestionType.FREE_TEXT: {
      const data = {
        id,
        questionData: omit(['createdAt', 'updatedAt', 'attachments'], question),
        questionId: question.id,
        ownerId: question.ownerId,
        results: {},
      }

      return {
        where: {
          id,
        },
        create: data,
        update: data,
      }
    }
  }
}

function prepareLearningElement({
  instanceIds,
  ...args
}: {
  id: string
  ownerId: string
  courseId: string
  instanceIds: number[]
}) {
  return {
    where: {
      id: args.id,
    },
    create: {
      ...args,
      instances: {
        connect: instanceIds.map((id) => ({ id })),
      },
    },
    update: args,
  }
}

function prepareSession({
  blocks,
  ...args
}: {
  blocks: {
    instances: number[]
    expiresAt?: Date
    timeLimit?: number
  }[]
  id: string
  name: string
  displayName: string
  courseId: string
  ownerId: string
  status: Prisma.SessionStatus
  isModerationEnabled?: boolean
  isAudienceInteractionActive?: boolean
  isGamificationEnabled?: boolean
}) {
  return {
    where: {
      id: args.id,
    },
    create: {
      ...args,
      blocks: {
        create: blocks.map(({ instances }) => ({
          instances: {
            connect: instances.map((id) => ({ id })),
          },
        })),
      },
    },
    update: args,
  }
}

function prepareMicroSession({
  instanceIds,
  ...args
}: {
  id: string
  name: string
  displayName: string
  scheduledStartAt: Date
  scheduledEndAt: Date
  description: string
  courseId: string
  ownerId: string
  instanceIds: number[]
}) {
  return {
    where: {
      id: args.id,
    },
    create: {
      ...args,
      instances: {
        connect: instanceIds.map((id) => ({ id })),
      },
    },
    update: args,
  }
}

async function main(prisma: Prisma.PrismaClient) {
  const user = await prisma.user.upsert(
    await prepareUser({
      id: '6f45065c-447f-4259-818c-c6f6b477eb48',
      email: 'roland.schlaefli@bf.uzh.ch',
      shortname: 'rschlaefli',
      password: 'testing',
    })
  )

  const course = await prisma.course.upsert(
    prepareCourse({
      id: '064ef09b-07b9-4bfd-b657-5c77d7123e93',
      name: 'Test Course 1',
      displayName: 'Test Course 1',
      ownerId: user.id,
    })
  )

  const courseBF1 = await prisma.course.upsert(
    prepareCourse({
      id: '064ef09b-07b9-4bfd-b657-5c77d7123e93',
      name: 'Banking und Finance 1',
      displayName: 'Banking und Finance 1',
      ownerId: user.id,
    })
  )

  const participants = await Promise.all(
    PARTICIPANT_IDS.map(async (id, ix) => {
      return prisma.participant.upsert(
        await prepareParticipant({
          id: PARTICIPANT_IDS[ix],
          email: `testuser${ix + 1}@bf.uzh.ch`,
          password: 'testing',
          username: `testuser${ix + 1}`,
          courseId: course.id,
        })
      )
    })
  )

  const attachments = await Promise.all(
    [
      {
        id: 'b0b9c0c0-0b0b-4b4b-0b0b-0b0b0b0b0b0b',
        href: 'https://sos-ch-dk-2.exo.io/klicker-uzh-dev/avatars/41b98856a8c221db667cf066f34b931eff048c32.svg',
        name: 'Test Attachment 1',
        type: Prisma.AttachmentType.SVG,
        ownerId: user.id,
      },
      {
        id: 'b0b9c0c0-0b0b-4b4b-0b0b-0b0b0b0b0b0c',
        href: 'https://sos-ch-dk-2.exo.io/klicker-uzh-dev/avatars/41b98856a8c221db667cf066f34b931eff048c32.webp',
        name: 'Test Attachment 2',
        type: Prisma.AttachmentType.WEBP,
        ownerId: user.id,
      },
    ].map((data) => prisma.attachment.upsert(prepareAttachment(data)))
  )

  const questions = await Promise.all(
    [
      {
        id: 0,
        name: 'Zieldreieck',
        content: 'Welche der folgenden Aussagen ist **falsch**?',
        contentPlain: 'Welche der folgenden Aussagen ist falsch?',
        type: Prisma.QuestionType.SC,
        choices: [
          {
            feedback:
              'Falsch! Zwischen den Zielsetzungen des klassischen finanziellen Zieldreiecks gibt es sowohl Zielkonflikte als auch Zielharmonien.',
            value:
              'Zwischen den Zielsetzungen des klassischen Zieldreiecks gibt es sowohl Zielkonflikte als auch Zielharmonien.',
          },
          {
            feedback:
              'Korrekt! Je höher die angestrebte Sicherheit, desto weniger Risiko wird eingegangen, was wiederum die Rentabilität senkt.',
            correct: true,
            value:
              'Das Ziel einer hohen Rentabilität erhöht auch die Sicherheit eines Unternehmens.',
          },
          {
            feedback:
              'Falsch! Die Unabhängigkeit ist kein Ziel des klassischen Zieldreiecks.',
            value:
              'Unabhängigkeit ist *kein* Ziel des klassischen Zieldreiecks.',
          },
          {
            feedback:
              'Falsch! Eine hohe Liquidität steht im Zielkonflikt mit der Rentabilität, da Liquidität meist teuer ist.',
            value:
              'Eine hohe Liquidität steht im Zielkonflikt mit der Rentabilität, da Liquidität meist teuer ist.',
          },
          {
            feedback:
              'Falsch! Der Shareholder Value ist kein Ziel des klassischen Zieldreiecks.',
            value:
              'Der Shareholder Value ist *kein* Ziel des klassischen Zieldreiecks.',
          },
        ],
      },
      {
        id: 1,
        name: 'Organisation des Finanzwesens',
        content: 'Welche der folgenden Aussagen ist **falsch**?',
        contentPlain: 'Welche der folgenden Aussagen ist falsch?',
        type: Prisma.QuestionType.SC,
        choices: [
          {
            feedback: 'Diese Aussage ist nicht korrekt!',
            value:
              'Die zentralen Tätigkeiten einer Finanzabteilung lassen sich in Finanzplanung, Finanzdisposition (d.h. die Realisierung der Finanzplanung) und Finanzcontrolling einteilen.',
          },
          {
            feedback: 'Diese Aussage ist nicht korrekt!',
            value:
              'Beim Controlling geht es grundsätzlich um die Überwachung des finanziellen Geschehens. Dies wird mit Hilfe eines Soll/Ist-Vergleichs der Finanzplanung gemacht.',
          },
          {
            feedback: 'Diese Aussage ist nicht korrekt!',
            value:
              'In grossen Firmen gibt es normalerweise neben dem CFO jeweils einen Controller und einen Treasurer.',
          },
          {
            feedback:
              'Diese Aussage ist korrekt! Die Kapitalbeschaffung ist Aufgabe des Treasurers.',
            correct: true,
            value:
              'Der Controller ist unter anderem für die Regelung der Ausgabe von Wertpapieren verantwortlich.',
          },
          {
            feedback: 'Diese Aussage ist nicht korrekt!',
            value:
              'Der Treasurer kümmert sich um das ganze Cash- und Credit-Management.',
          },
        ],
      },
      {
        id: 2,
        name: 'Stakeholder',
        content:
          'Welche der folgenden Personen/Gruppen sind **keine** Stakeholder?',
        contentPlain:
          'Welche der folgenden Personen/Gruppen sind keine Stakeholder?',
        type: Prisma.QuestionType.SC,
        attachments: {
          connect: [
            {
              id: attachments[0].id,
            },
            {
              id: attachments[1].id,
            },
          ],
        },
        choices: [
          {
            feedback:
              'Falsch! Beim Staat handelt es sich um einen Stakeholder.',
            value: 'Staat',
          },
          {
            feedback:
              'Falsch! Bei den Arbeitnehmern handelt es sich um Stakeholder.',
            value: 'Arbeitnehmer',
          },
          {
            feedback:
              'Falsch! Bei den Fremdkapitalgebern handelt es sich um Stakeholder.',
            value: 'Fremdkapitalgeber',
          },
          {
            feedback: 'Kunden',
            value: 'Falsch! Bei den Kunden handelt es sich um Stakeholder.',
          },
          {
            feedback:
              'Korrekt! Alle genannten Personen/Gruppen sind Stakeholder.',
            correct: true,
            value:
              'Es handelt sich bei allen oben genannten Personen/Gruppen um Stakeholder.',
          },
        ],
      },
      {
        id: 3,
        name: 'Bilanz',
        content:
          'Beurteile die folgenden Aussagen zur Bilanz auf ihre Richtigkeit:',
        contentPlain:
          'Beurteile die folgenden Aussagen zur Bilanz auf ihre Richtigkeit:',
        type: Prisma.QuestionType.KPRIM,
        choices: [
          {
            feedback:
              'Diese Aussage ist nicht korrekt! Die Aktivseite zeigt die Mittelverwendung auf.',
            value: 'Die Aktivseite zeigt die Mittelherkunft auf.',
          },
          {
            feedback:
              'Diese Aussage ist nicht korrekt! Die Passivseite zeigt die Mittelherkunft auf.',
            value: 'Die Passivseite der Bilanz zeigt die Mittelverwendung auf.',
          },
          {
            feedback:
              'Diese Aussage ist nicht korrekt! Das EK zeigt zwar die Mittelherkunft auf, diese wird aber auf der Passivseite der Bilanz abgebildet.',
            value:
              'Das EK zeigt die Mittelherkunft auf und steht somit auf der Aktivseite der Bilanz.',
          },
          {
            feedback: 'Diese Aussage ist korrekt!',
            correct: true,
            value:
              'Das Konto Flüssige Mittel zeigt die Mittelverwendung auf und steht somit auf der Aktivseite der Bilanz.',
          },
        ],
      },
      {
        id: 4,
        name: 'Grundfunktionen des Fremdkapitals',
        content:
          'Welches sind Merkmale des Fremdkapitals? Beurteile die folgenden Aussagen auf ihre Richtigkeit:',
        contentPlain:
          'Welches sind Merkmale des Fremdkapitals? Beurteile die folgenden Aussagen auf ihre Richtigkeit:',
        type: Prisma.QuestionType.KPRIM,
        choices: [
          {
            feedback:
              'Diese Aussage ist korrekt! Dritte stellen für eine bestimmte Zeitdauer Fremdkapital zur Verfügung.',
            correct: true,
            value: 'Gläubigerkapital',
          },
          {
            feedback:
              'Diese Aussage ist nicht korrekt! Dies ist eine Grundfunktion des Eigenkapitals.',
            value: 'Liquiditätssicherungsfunktion',
          },
          {
            feedback:
              'Diese Aussage ist korrekt! Fremdkapitalgeber haben in der Regel Anspruch auf Verzinsung und Rückzahlung des Kapitals zu einem vereinbarten Termin.',
            correct: true,
            value: 'Gewinnunabhängiges Kapitalentgelt',
          },
          {
            feedback:
              'Diese Aussage ist korrekt! Es gehört zur Außenfinanzierung bzw. Fremdfinazierung.',
            correct: true,
            value: 'Finanzierungsfunktion',
          },
        ],
      },
      {
        id: 5,
        name: 'Numerische Testfrage',
        content: 'Was ist richtig?',
        contentPlain: 'Was ist richtig?',
        type: Prisma.QuestionType.NUMERICAL,
        options: {
          restrictions: {
            min: 0,
            max: 10,
          },
          solutionRanges: [
            {
              min: 0.5,
              max: 0.6,
            },
            {
              min: 2,
            },
            {
              max: 4,
            },
            {
              min: 5,
            },
            {
              max: 5,
            },
          ],
        },
      },
      {
        id: 6,
        name: 'Freitext Testfrage',
        content: 'Was ist richtig?',
        contentPlain: 'Was ist richtig?',
        type: Prisma.QuestionType.FREE_TEXT,
        options: {
          restrictions: {
            maxLength: 200,
          },
          solutions: ['Schweiz', 'CH'],
        },
      },
      {
        id: 7,
        name: 'RDWachstum',
        content:
          'Wie hoch schätzt du das durchschnittliche Wachstum der Forschung- und Entwicklungskosten in den nächsten fünf Jahren?',
        contentPlain:
          'Wie hoch schätzt du das durchschnittliche Wachstum der Forschung- und Entwicklungskosten in den nächsten fünf Jahren?',
        type: Prisma.QuestionType.NUMERICAL,
        options: {
          restrictions: {
            min: 0,
            max: 100,
          },
          solutionRanges: [
            {
              min: 0,
              max: 5,
            },
            {
              min: 95,
              max: 100,
            },
          ],
        },
      },
      {
        id: 8,
        name: 'Soziale Marktwirtschaft',
        content:
          'Beschreibe die Hauptprinzipien einer sozialen Marktwirtschaft.',
        contentPlain:
          'Beschreibe die Hauptprinzipien einer sozialen Marktwirtschaft.',
        type: Prisma.QuestionType.FREE_TEXT,
        options: {
          restrictions: {
            maxLength: 100,
          },
          solutions: [
            'Freie Marktwirtschaft mit Ausgleichsfunktionen',
            'Beispiele sind die meisten Länder in Europa',
          ],
        },
      },
      {
        id: 9,
        name: 'Zieldreieck',
        content: 'Welche der folgenden Aussagen ist **falsch**?',
        contentPlain: 'Welche der folgenden Aussagen ist falsch?',
        type: Prisma.QuestionType.SC,
        choices: [
          {
            feedback:
              'Falsch! Zwischen den Zielsetzungen des klassischen finanziellen Zieldreiecks gibt es sowohl Zielkonflikte als auch Zielharmonien.',
            value:
              'Zwischen den Zielsetzungen des klassischen Zieldreiecks gibt es sowohl Zielkonflikte als auch Zielharmonien.',
          },
          {
            feedback:
              'Korrekt! Je höher die angestrebte Sicherheit, desto weniger Risiko wird eingegangen, was wiederum die Rentabilität senkt.',
            correct: true,
            value:
              'Das Ziel einer hohen Rentabilität erhöht auch die Sicherheit eines Unternehmens.',
          },
          {
            feedback:
              'Falsch! Die Unabhängigkeit ist kein Ziel des klassischen Zieldreiecks.',
            value:
              'Unabhängigkeit ist *kein* Ziel des klassischen Zieldreiecks.',
          },
          {
            feedback:
              'Falsch! Eine hohe Liquidität steht im Zielkonflikt mit der Rentabilität, da Liquidität meist teuer ist.',
            value:
              'Eine hohe Liquidität steht im Zielkonflikt mit der Rentabilität, da Liquidität meist teuer ist.',
          },
          {
            feedback:
              'Falsch! Der Shareholder Value ist kein Ziel des klassischen Zieldreiecks.',
            value:
              'Der Shareholder Value ist *kein* Ziel des klassischen Zieldreiecks.',
          },
        ],
      },
      {
        id: 10,
        name: 'Microlearning 1.1',
        content:
          'Welche der folgenden Aussagen zur **Interaktion zwischen Kapitalnehmer:innen und Kapitalgeber:innen** ist korrekt?',
        contentPlain:
          'Welche der folgenden Aussagen zur Interaktion zwischen Kapitalnehmer:innen und Kapitalgeber:innen ist korrekt?',
        type: Prisma.QuestionType.SC,
        choices: [
          {
            correct: true,
            value:
              'Kapitalnehmer:innen und Kapitalgeber:innen interagieren via Finanzmärkte oder Finanzintermediäre miteinander.',
            feedback: 'Diese Aussage ist korrekt.',
          },
          {
            value:
              'Haushalte gehören typischerweise zu den Kapitalnehmer:innen.',
            feedback:
              'Diese Aussage ist nicht korrekt. Haushalte gehören typischerweise zu den Kapitalgeber:innen, die sparen und ihr Erspartes bei Finanzintermediären anlegen oder via Finanzmärkte direkt in Kapitalnehmer:innen investieren.',
          },
          {
            value:
              'Kapitalgeber:innen haben typischerweise einen Finanzierungsbedarf, den sie selber nicht decken können.',
            feedback:
              'Diese Aussage ist nicht korrekt. Kapitalgeber:innen decken ihren eigenen Finanzierungsbedarf und leihen zusätzlich ihre Ersparnisse aus.',
          },
          {
            value:
              'Finanzintermediäre treten gegenüber Kapitalgeber:innen auf, nicht aber gegenüber Kapitalnehmer:innen.',
            feedback:
              'Diese Aussage ist nicht korrekt. Finanzintermediäre treten sowohl gegenüber Kapitalgeber:innen als auch Kapitalnehmer:innen auf.',
          },
          {
            value: 'Keine der Aussagen ist korrekt.',
            feedback:
              'Diese Aussage ist nicht korrekt. Eine der anderen Aussagen ist korrekt.',
          },
        ],
      },
      {
        id: 11,
        name: 'Microlearning 1.2',
        content:
          'Welcher der folgenden Entscheidungsbereiche ist **nicht** Teil in der **Corporate Finance**?',
        contentPlain:
          'Welcher der folgenden Entscheidungsbereiche ist nicht Teil in der Corporate Finance?',
        type: Prisma.QuestionType.SC,
        choices: [
          {
            value: 'Investitionsfragen',
            feedback:
              'Diese Aussage ist nicht korrekt. Investitionsfragen gehören zur Corporate Finance.',
          },
          {
            value: 'Rückzahlung von Kapital',
            feedback:
              'Diese Aussage ist nicht korrekt. Die Rückzahlung von Kapital gehört zur Corporate Finance.',
          },
          {
            value: 'Finanzierungsfragen',
            feedback:
              'Diese Aussage ist nicht korrekt. Finanzierungsfragen gehören zur Corporate Finance.',
          },
          {
            value: 'Dividendenpolitik',
            feedback:
              'Diese Aussage ist nicht korrekt. Die Dividendenpolitik gehört zur Corporate Finance.',
          },
          {
            correct: true,
            value: 'Führung von Mitarbeiter:innen',
            feedback:
              'Diese Aussage ist korrekt. Die Führung von Mitarbeiter:innen ist traditionell Teil des Human Ressource Managements. Die Corporate Finance beschäftigt sich eher mit Fragestellungen im Bereich Finanzierung und Investitionen.',
          },
        ],
      },
      {
        id: 12,
        name: 'Microlearning 1.3',
        content:
          'Welche der folgenden Aussagen zum Aufbau einer **Bilanz** ist **korrekt**?',
        contentPlain:
          'Welche der folgenden Aussagen zum Aufbau einer Bilanz ist korrekt?',
        type: Prisma.QuestionType.SC,
        choices: [
          {
            value:
              'Konten, welche die Kapitalbewirtschaftung zeigen, sind auf der Passivseite einer Bilanz zu finden.',
            feedback:
              'Diese Aussage ist nicht korrekt. Konten, welche die Kapitalbewirtschaftung zeigen, sind auf der Aktivseite der Bilanz abgebildet.',
          },
          {
            value: 'Eine Bilanz besteht aus einer Ertrags- und Passivseite.',
            feedback:
              'Diese Aussage ist nicht korrekt. Eine Bilanz besteht aus einer Aktiv- und Passivseite. Die Ertragskonten hingegen sind in der Erfolgsrechnung zu finden.',
          },
          {
            value:
              'Auf der Passivseite der Bilanz werden die Aktiven eines Unternehmens abgebildet.',
            feedback:
              'Diese Aussage ist nicht korrekt. Die Aktiven sind auf der Aktivseite der Bilanz zu finden.',
          },
          {
            correct: true,
            value: 'Das sogenannte Anlagevermögen zeigt den Kapitaleinsatz.',
            feedback: 'Diese Aussage ist korrekt.',
          },
          {
            value: 'Keine der Aussagen ist korrekt.',
            feedback:
              'Diese Aussage ist nicht korrekt. Eine der anderen Aussagen ist korrekt.',
          },
        ],
      },
      {
        id: 13,
        name: 'Microlearning 1.4',
        content:
          'Welche der folgenden Aussagen bezüglich des **finanzwirtschaftlichen Zieldreiecks** ist **korrekt**?',
        contentPlain:
          'Welche der folgenden Aussagen bezüglich des finanzwirtschaftlichen Zieldreiecks ist korrekt?',
        type: Prisma.QuestionType.SC,
        choices: [
          {
            value:
              'Es kann nie mehr als eine Dimension des finanzwirtschaftlichen Zieldreiecks erfolgreich umgesetzt werden.',
            feedback:
              'Diese Aussage ist nicht korrekt. Den Zielen der Liquidität und Sicherheit kann beispielsweise gleichzeitig nachgegangen werden.',
          },
          {
            value:
              'Die Ziele des finanzwirtschaftlichen Zieldreiecks sind Liquidität, Sicherheit und Stabilität.',
            feedback:
              'Diese Aussage ist nicht korrekt. Die Ziele des finanzwirtschaftlichen Zieldreiecks sind Liquidität, Sicherheit und Rentabilität.',
          },
          {
            value:
              'Das Ziel der Sicherheit stellt die Priorität jedes Unternehmens dar.',
            feedback:
              'Diese Aussage ist nicht korrekt. Es gibt keine allgemeingültige Priorität, die für jedes Unternehmen gilt.',
          },
          {
            correct: true,
            value:
              'Die Liquidität und Sicherheit begünstigen sich gegenseitig.',
            feedback: 'Diese Aussage ist korrekt.',
          },
          {
            value: 'Keine der Aussagen ist korrekt.',
            feedback:
              'Diese Aussage ist nicht korrekt. Eine der anderen Aussagen ist korrekt.',
          },
        ],
      },
    ].map((data) =>
      prisma.question.upsert(prepareQuestion({ ownerId: user.id, ...data }))
    )
  )

  const instances = await Promise.all(
    [...questions, ...questions, ...questions].map((data, ix) =>
      prisma.questionInstance.upsert(
        prepareQuestionInstance({ id: ix, question: data })
      )
    )
  )

  const learningElement = await prisma.learningElement.upsert(
    prepareLearningElement({
      id: 'a3bb4ae9-5acc-4e66-99d9-a9df1d4d0c08',
      courseId: course.id,
      ownerId: user.id,
      instanceIds: [0, 1, 2, 3, 4, 5],
    })
  )

  const session = await prisma.session.upsert(
    prepareSession({
      id: 'a3bb4ae9-5acc-4e66-99d9-a9df1d4d0c08',
      name: 'BF1 VL1',
      displayName: 'Banking und Finance I - VL1',
      status: Prisma.SessionStatus.PREPARED,
      blocks: [{ instances: [6, 7, 8] }, { instances: [9, 10, 11] }],
      ownerId: user.id,
      courseId: course.id,
    })
  )

  const session2 = await prisma.session.upsert(
    prepareSession({
      id: 'a3bb4ae9-5acc-4e66-99d9-a9df1d4d0c09',
      name: 'BF1 VL2',
      displayName: 'Banking und Finance I - VL2',
      isModerationEnabled: false,
      isAudienceInteractionActive: true,
      isGamificationEnabled: true,
      status: Prisma.SessionStatus.PREPARED,
      blocks: [
        {
          instances: [6, 7, 8],
          expiresAt: new Date('2022-12-31T23:59:59.999Z'),
          timeLimit: 20,
        },
        {
          instances: [9, 10, 11],
          expiresAt: new Date('2022-12-31T23:59:59.999Z'),
          timeLimit: 30,
        },
      ],
      ownerId: user.id,
      courseId: course.id,
    })
  )

  const session3 = await prisma.session.upsert(
    prepareSession({
      id: 'a3bb4ae9-5acc-4e66-99d9-a9df1d4d0c0a',
      name: 'BF1 VL3',
      displayName: 'Banking und Finance I - VL3',
      isModerationEnabled: false,
      isAudienceInteractionActive: true,
      isGamificationEnabled: true,
      status: Prisma.SessionStatus.PREPARED,
      blocks: [
        {
          instances: [12, 13],
          expiresAt: new Date('2022-12-31T23:59:59.999Z'),
          timeLimit: 20,
        },
        {
          instances: [14, 15, 16],
          expiresAt: new Date('2022-12-31T23:59:59.999Z'),
          timeLimit: 30,
        },
      ],
      ownerId: user.id,
      courseId: course.id,
    })
  )

  const microSession = await prisma.microSession.upsert(
    prepareMicroSession({
      id: '0ce58914-efaa-4ee5-9693-db497f7e5d46',
      name: 'BF1 VL1',
      displayName: 'Banking und Finance I - VL1',
      scheduledStartAt: new Date('2022-09-12T20:00:00.000Z'),
      scheduledEndAt: new Date('2022-09-17:00:00.000Z'),
      description: `
Diese Woche lernen wir...

![Alt text](https://sos-ch-dk-2.exo.io/klicker-uzh-dev/avatars/41b98856a8c221db667cf066f34b931eff048c32.webp)

Mehr bla bla...
            `,
      instanceIds: [17, 18, 19, 20],
      courseId: course.id,
      ownerId: user.id,
    })
  )

  const microSession1BF1 = await prisma.microSession.upsert(
    prepareMicroSession({
      id: 'e3c71b0b-a8cf-43e9-8373-85a31673b178',
      name: 'BF1 Microlearning 1',
      displayName: 'Vorlesung 1',
      scheduledStartAt: new Date('2022-09-14T07:00:00.000Z'),
      scheduledEndAt: new Date('2022-09-22T09:00:00.000Z'),
      description: `
### Einführung

![](https://sos-ch-dk-2.exo.io/klicker-prod/img/microlearning_bf1_1.png)

Was ist Corporate Finance? Gemäss Damodaran umfasst die Corporate Finance alle Entscheidungen von Unternehmen, die finanzielle Auswirkungen haben. Diese umfassen u.a. Investitionsentscheide, Finanzierungsentscheide oder Dividendenentscheide.

Du lernst zudem das finanzwirtschaftliche Zieldreieck kennen, bei dem sich die Rentabilität, Liquidität und Sicherheit einander gegenüber stehen. Zudem lernst du das oberste Ziel der unternehmerischen Tätigkeit kennen, nämlich die langfristige Maximierung des Unternehmenswertes.
`,
      instanceIds: [10, 11, 12, 13],
      courseId: course.id,
      ownerId: user.id,
    })
  )

  await prisma.$executeRawUnsafe(
    `ALTER SEQUENCE "Question_id_seq" RESTART WITH ${questions.length + 1}`
  )
  await prisma.$executeRawUnsafe(
    `ALTER SEQUENCE "QuestionInstance_id_seq" RESTART WITH ${
      instances.length + 1
    }`
  )
}

const prismaClient = new Prisma.PrismaClient()

main(prismaClient)
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prismaClient.$disconnect()
  })
