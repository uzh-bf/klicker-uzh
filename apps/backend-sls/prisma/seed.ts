import 'dotenv/config'

import Prisma from '@klicker-uzh/prisma'
import bcrypt from 'bcryptjs'
import { PARTICIPANT_IDS } from './constants.js'

async function main(prisma: Prisma.PrismaClient) {
  const hash = await bcrypt.hash('abcd', 12)
  const hash2 = await bcrypt.hash('testing', 12)

  const user = await prisma.user.upsert({
    where: {
      id: '6f45065c-447f-4259-818c-c6f6b477eb48',
    },
    create: {
      id: '6f45065c-447f-4259-818c-c6f6b477eb48',
      email: 'roland.schlaefli@bf.uzh.ch',
      password: hash,
      shortname: 'rschlaefli',
      isActive: true,
    },
    update: {
      password: hash,
      isActive: true,
    },
  })

  const course = await prisma.course.upsert({
    where: {
      id: '064ef09b-07b9-4bfd-b657-5c77d7123e93',
    },
    create: {
      id: '064ef09b-07b9-4bfd-b657-5c77d7123e93',
      name: 'Banking and Finance I',
      displayName: 'Banking and Finance I',
      ownerId: user.id,
    },
    update: {},
  })

  const participants = await Promise.all(
    PARTICIPANT_IDS.map((id, ix) => {
      return prisma.participant.upsert({
        where: {
          id,
        },
        create: {
          id,
          email: `testuser${ix + 1}@bf.uzh.ch`,
          password: hash2,
          username: `testuser${ix + 1}`,
          avatar: 'apple-icon-180.png',
          participations: {
            create: {
              course: {
                connect: {
                  id: course.id,
                },
              },
            },
          },
        },
        update: {
          password: hash2,
        },
      })
    })
  )

  const attachment = await prisma.attachment.upsert({
    where: {
      id: 'b0b9c0c0-0b0b-4b4b-0b0b-0b0b0b0b0b0b',
    },
    create: {
      id: 'b0b9c0c0-0b0b-4b4b-0b0b-0b0b0b0b0b0b',
      name: 'Test Attachment 1',
      type: 'SVG',
      href: 'https://sos-ch-dk-2.exo.io/klicker-uzh-dev/avatars/41b98856a8c221db667cf066f34b931eff048c32.svg',
      owner: {
        connect: {
          id: user.id,
        },
      },
    },
    update: {},
  })

  const attachment2 = await prisma.attachment.upsert({
    where: {
      id: 'b0b9c0c0-0b0b-4b4b-0b0b-0b0b0b0b0b0c',
    },
    create: {
      id: 'b0b9c0c0-0b0b-4b4b-0b0b-0b0b0b0b0b0c',
      name: 'Test Attachment 2',
      type: 'WEBP',
      href: 'https://sos-ch-dk-2.exo.io/klicker-uzh-dev/avatars/41b98856a8c221db667cf066f34b931eff048c32.webp',
      owner: {
        connect: {
          id: user.id,
        },
      },
    },
    update: {},
  })

  const question = await prisma.question.upsert({
    where: {
      id: 0,
    },
    create: {
      id: 0,
      name: 'Zieldreieck',
      content: 'Welche der folgenden Aussagen ist **falsch**?',
      contentPlain: 'Welche der folgenden Aussagen ist falsch?',
      type: 'SC',
      options: {
        choices: [
          {
            ix: 0,
            feedback:
              'Falsch! Zwischen den Zielsetzungen des klassischen finanziellen Zieldreiecks gibt es sowohl Zielkonflikte als auch Zielharmonien.',
            correct: false,
            value:
              'Zwischen den Zielsetzungen des klassischen Zieldreiecks gibt es sowohl Zielkonflikte als auch Zielharmonien.',
          },
          {
            ix: 1,
            feedback:
              'Korrekt! Je höher die angestrebte Sicherheit, desto weniger Risiko wird eingegangen, was wiederum die Rentabilität senkt.',
            correct: true,
            value:
              'Das Ziel einer hohen Rentabilität erhöht auch die Sicherheit eines Unternehmens.',
          },
          {
            ix: 2,
            feedback:
              'Falsch! Die Unabhängigkeit ist kein Ziel des klassischen Zieldreiecks.',
            correct: false,
            value:
              'Unabhängigkeit ist *kein* Ziel des klassischen Zieldreiecks.',
          },
          {
            ix: 3,
            feedback:
              'Falsch! Eine hohe Liquidität steht im Zielkonflikt mit der Rentabilität, da Liquidität meist teuer ist.',
            correct: false,
            value:
              'Eine hohe Liquidität steht im Zielkonflikt mit der Rentabilität, da Liquidität meist teuer ist.',
          },
          {
            ix: 4,
            feedback:
              'Falsch! Der Shareholder Value ist kein Ziel des klassischen Zieldreiecks.',
            correct: false,
            value:
              'Der Shareholder Value ist *kein* Ziel des klassischen Zieldreiecks.',
          },
        ],
      },
      ownerId: user.id,
    },
    update: {},
  })

  const question2 = await prisma.question.upsert({
    where: {
      id: 1,
    },
    create: {
      id: 1,
      name: 'Organisation des Finanzwesens',
      content: 'Welche der folgenden Aussagen ist **falsch**?',
      contentPlain: 'Welche der folgenden Aussagen ist falsch?',
      type: 'SC',
      options: {
        choices: [
          {
            ix: 0,
            feedback: 'Diese Aussage ist nicht korrekt!',
            correct: false,
            value:
              'Die zentralen Tätigkeiten einer Finanzabteilung lassen sich in Finanzplanung, Finanzdisposition (d.h. die Realisierung der Finanzplanung) und Finanzcontrolling einteilen.',
          },
          {
            ix: 1,
            feedback: 'Diese Aussage ist nicht korrekt!',
            correct: false,
            value:
              'Beim Controlling geht es grundsätzlich um die Überwachung des finanziellen Geschehens. Dies wird mit Hilfe eines Soll/Ist-Vergleichs der Finanzplanung gemacht.',
          },
          {
            ix: 2,
            feedback: 'Diese Aussage ist nicht korrekt!',
            correct: false,
            value:
              'In grossen Firmen gibt es normalerweise neben dem CFO jeweils einen Controller und einen Treasurer.',
          },
          {
            ix: 3,
            feedback:
              'Diese Aussage ist korrekt! Die Kapitalbeschaffung ist Aufgabe des Treasurers.',
            correct: true,
            value:
              'Der Controller ist unter anderem für die Regelung der Ausgabe von Wertpapieren verantwortlich.',
          },
          {
            ix: 4,
            feedback: 'Diese Aussage ist nicht korrekt!',
            correct: false,
            value:
              'Der Treasurer kümmert sich um das ganze Cash- und Credit-Management.',
          },
        ],
      },
      ownerId: user.id,
    },
    update: {},
  })

  const question3 = await prisma.question.upsert({
    where: {
      id: 2,
    },
    create: {
      id: 2,
      name: 'Stakeholder',
      content:
        'Welche der folgenden Personen/Gruppen sind **keine** Stakeholder?',
      contentPlain:
        'Welche der folgenden Personen/Gruppen sind keine Stakeholder?',
      type: 'SC',
      attachments: {
        connect: [
          {
            id: attachment.id,
          },
          {
            id: attachment2.id,
          },
        ],
      },
      options: {
        choices: [
          {
            ix: 0,
            feedback:
              'Falsch! Beim Staat handelt es sich um einen Stakeholder.',
            correct: false,
            value: 'Staat',
          },
          {
            ix: 1,
            feedback:
              'Falsch! Bei den Arbeitnehmern handelt es sich um Stakeholder.',
            correct: false,
            value: 'Arbeitnehmer',
          },
          {
            ix: 2,
            feedback:
              'Falsch! Bei den Fremdkapitalgebern handelt es sich um Stakeholder.',
            correct: false,
            value: 'Fremdkapitalgeber',
          },
          {
            ix: 3,
            feedback: 'Kunden',
            correct: false,
            value: 'Falsch! Bei den Kunden handelt es sich um Stakeholder.',
          },
          {
            ix: 4,
            feedback:
              'Korrekt! Alle genannten Personen/Gruppen sind Stakeholder.',
            correct: true,
            value:
              'Es handelt sich bei allen oben genannten Personen/Gruppen um Stakeholder.',
          },
        ],
      },
      ownerId: user.id,
    },
    update: {},
  })

  const question4 = await prisma.question.upsert({
    where: {
      id: 3,
    },
    create: {
      id: 3,
      name: 'Bilanz',
      content:
        'Beurteile die folgenden Aussagen zur Bilanz auf ihre Richtigkeit:',
      contentPlain:
        'Beurteile die folgenden Aussagen zur Bilanz auf ihre Richtigkeit:',
      type: 'MC',
      options: {
        choices: [
          {
            ix: 0,
            feedback:
              'Diese Aussage ist nicht korrekt! Die Aktivseite zeigt die Mittelverwendung auf.',
            correct: false,
            value: 'Die Aktivseite zeigt die Mittelherkunft auf.',
          },
          {
            ix: 1,
            feedback:
              'Diese Aussage ist nicht korrekt! Die Passivseite zeigt die Mittelherkunft auf.',
            correct: false,
            value: 'Die Passivseite der Bilanz zeigt die Mittelverwendung auf.',
          },
          {
            ix: 2,
            feedback:
              'Diese Aussage ist nicht korrekt! Das EK zeigt zwar die Mittelherkunft auf, diese wird aber auf der Passivseite der Bilanz abgebildet.',
            correct: false,
            value:
              'Das EK zeigt die Mittelherkunft auf und steht somit auf der Aktivseite der Bilanz.',
          },
          {
            ix: 3,
            feedback: 'Diese Aussage ist korrekt!',
            correct: true,
            value:
              'Das Konto Flüssige Mittel zeigt die Mittelverwendung auf und steht somit auf der Aktivseite der Bilanz.',
          },
        ],
      },
      ownerId: user.id,
    },
    update: {},
  })

  const question5 = await prisma.question.upsert({
    where: {
      id: 4,
    },
    create: {
      id: 4,
      name: 'Grundfunktionen des Fremdkapitals',
      content:
        'Welches sind Merkmale des Fremdkapitals? Beurteile die folgenden Aussagen auf ihre Richtigkeit:',
      contentPlain:
        'Welches sind Merkmale des Fremdkapitals? Beurteile die folgenden Aussagen auf ihre Richtigkeit:',
      type: 'MC',
      options: {
        choices: [
          {
            ix: 0,
            feedback:
              'Diese Aussage ist korrekt! Dritte stellen für eine bestimmte Zeitdauer Fremdkapital zur Verfügung.',
            correct: true,
            value: 'Gläubigerkapital',
          },
          {
            ix: 1,
            feedback:
              'Diese Aussage ist nicht korrekt! Dies ist eine Grundfunktion des Eigenkapitals.',
            correct: false,
            value: 'Liquiditätssicherungsfunktion',
          },
          {
            ix: 2,
            feedback:
              'Diese Aussage ist korrekt! Fremdkapitalgeber haben in der Regel Anspruch auf Verzinsung und Rückzahlung des Kapitals zu einem vereinbarten Termin.',
            correct: true,
            value: 'Gewinnunabhängiges Kapitalentgelt',
          },
          {
            ix: 3,
            feedback:
              'Diese Aussage ist korrekt! Es gehört zur Außenfinanzierung bzw. Fremdfinazierung.',
            correct: true,
            value: 'Finanzierungsfunktion',
          },
        ],
      },
      ownerId: user.id,
    },
    update: {},
  })

  const question6 = await prisma.question.upsert({
    where: {
      id: 5,
    },
    create: {
      id: 5,
      name: 'Numerische Testfrage',
      content: 'Was ist richtig?',
      contentPlain: 'Was ist richtig?',
      type: 'NUMERICAL',
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
      ownerId: user.id,
    },
    update: {},
  })

  const question7 = await prisma.question.upsert({
    where: {
      id: 6,
    },
    create: {
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
      ownerId: user.id,
    },
    update: {},
  })

  const question8 = await prisma.question.upsert({
    where: {
      id: 7,
    },
    create: {
      id: 7,
      name: 'RDWachstum',
      content:
        'Wie hoch schätzt du das durchschnittliche Wachstum der Forschung- und Entwicklungskosten in den nächsten fünf Jahren?',
      contentPlain:
        'Wie hoch schätzt du das durchschnittliche Wachstum der Forschung- und Entwicklungskosten in den nächsten fünf Jahren?',
      type: 'NUMERICAL',
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
      ownerId: user.id,
    },
    update: {},
  })

  const question9 = await prisma.question.upsert({
    where: {
      id: 8,
    },
    create: {
      id: 8,
      name: 'Soziale Marktwirtschaft',
      content: 'Beschreibe die Hauptprinzipien einer sozialen Marktwirtschaft.',
      contentPlain:
        'Beschreibe die Hauptprinzipien einer sozialen Marktwirtschaft.',
      type: 'FREE_TEXT',
      options: {
        restrictions: {
          maxLength: 100,
        },
        solutions: [
          'Freie Marktwirtschaft mit Ausgleichsfunktionen',
          'Beispiele sind die meisten Länder in Europa',
        ],
      },
      ownerId: user.id,
    },
    update: {},
  })

  const instance = await prisma.questionInstance.upsert({
    where: {
      id: 0,
    },
    create: {
      id: 0,
      questionData: {
        ...question,
        createdAt: null,
        updatedAt: null,
      },
      results: {
        choices: {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
          4: 0,
        },
      },
      questionId: question.id,
      ownerId: user.id,
    },
    update: {
      results: {
        choices: {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
          4: 0,
        },
      },
    },
  })

  const instance2 = await prisma.questionInstance.upsert({
    where: {
      id: 1,
    },
    create: {
      id: 1,
      questionData: {
        ...question2,
        createdAt: null,
        updatedAt: null,
      },
      results: {
        choices: {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
          4: 0,
        },
      },
      questionId: question2.id,
      ownerId: user.id,
    },
    update: {
      results: {
        choices: {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
          4: 0,
        },
      },
    },
  })

  const instance3 = await prisma.questionInstance.upsert({
    where: {
      id: 2,
    },
    create: {
      id: 2,
      questionData: {
        ...question3,
        createdAt: null,
        updatedAt: null,
      },
      results: {
        choices: {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
          4: 0,
        },
      },
      questionId: question3.id,
      ownerId: user.id,
    },
    update: {
      results: {
        choices: {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
          4: 0,
        },
      },
    },
  })

  const instance4 = await prisma.questionInstance.upsert({
    where: {
      id: 3,
    },
    create: {
      id: 3,
      questionData: {
        ...question4,
        createdAt: null,
        updatedAt: null,
      },
      results: {
        choices: {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
        },
      },
      questionId: question4.id,
      ownerId: user.id,
    },
    update: {
      results: {
        choices: {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
        },
      },
    },
  })

  const instance5 = await prisma.questionInstance.upsert({
    where: {
      id: 4,
    },
    create: {
      id: 4,
      questionData: {
        ...question5,
        createdAt: null,
        updatedAt: null,
      },
      results: {
        choices: {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
        },
      },
      questionId: question5.id,
      ownerId: user.id,
    },
    update: {
      results: {
        choices: {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
        },
      },
    },
  })

  const learningElement = await prisma.learningElement.upsert({
    where: {
      id: 'a3bb4ae9-5acc-4e66-99d9-a9df1d4d0c08',
    },
    create: {
      id: 'a3bb4ae9-5acc-4e66-99d9-a9df1d4d0c08',
      courseId: course.id,
      ownerId: user.id,
      instances: {
        connect: [
          {
            id: instance.id,
          },
          {
            id: instance2.id,
          },
          {
            id: instance3.id,
          },
          {
            id: instance4.id,
          },
          {
            id: instance5.id,
          },
        ],
      },
    },
    update: {
      instances: {
        connect: [
          {
            id: instance.id,
          },
          {
            id: instance2.id,
          },
          {
            id: instance3.id,
          },
          {
            id: instance4.id,
          },
          {
            id: instance5.id,
          },
        ],
      },
    },
  })

  const instance6 = await prisma.questionInstance.upsert({
    where: {
      id: 5,
    },
    create: {
      id: 5,
      questionData: {
        ...question,
        createdAt: null,
        updatedAt: null,
      },
      results: {
        choices: {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
          4: 0,
        },
      },
      questionId: question.id,
      ownerId: user.id,
    },
    update: {
      results: {
        choices: {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
          4: 0,
        },
      },
    },
  })

  const instance7 = await prisma.questionInstance.upsert({
    where: {
      id: 6,
    },
    create: {
      id: 6,
      questionData: {
        ...question2,
        createdAt: null,
        updatedAt: null,
      },
      results: {
        choices: {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
          4: 0,
        },
      },
      questionId: question2.id,
      ownerId: user.id,
    },
    update: {
      results: {
        choices: {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
          4: 0,
        },
      },
    },
  })

  const instance8 = await prisma.questionInstance.upsert({
    where: {
      id: 7,
    },
    create: {
      id: 7,
      questionData: {
        ...question2,
        createdAt: null,
        updatedAt: null,
      },
      results: {
        choices: {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
        },
      },
      questionId: question2.id,
      ownerId: user.id,
    },
    update: {
      results: {
        choices: {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
        },
      },
    },
  })

  const instance9 = await prisma.questionInstance.upsert({
    where: {
      id: 8,
    },
    create: {
      id: 8,
      questionData: {
        ...question3,
        createdAt: null,
        updatedAt: null,
      },
      results: {
        choices: {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
        },
      },
      questionId: question3.id,
      ownerId: user.id,
    },
    update: {
      results: {
        choices: {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
        },
      },
    },
  })

  const instance10 = await prisma.questionInstance.upsert({
    where: {
      id: 9,
    },
    create: {
      id: 9,
      questionData: {
        ...question4,
        createdAt: null,
        updatedAt: null,
      },
      results: {
        choices: {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
        },
      },
      questionId: question4.id,
      ownerId: user.id,
    },
    update: {
      results: {
        choices: {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
        },
      },
    },
  })

  const instance11 = await prisma.questionInstance.upsert({
    where: {
      id: 10,
    },
    create: {
      id: 10,
      questionData: {
        ...question5,
        createdAt: null,
        updatedAt: null,
      },
      results: {
        choices: {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
        },
      },
      questionId: question5.id,
      ownerId: user.id,
    },
    update: {
      results: {
        choices: {
          0: 0,
          1: 0,
          2: 0,
          3: 0,
        },
      },
    },
  })

  const instance12 = await prisma.questionInstance.upsert({
    where: {
      id: 11,
    },
    create: {
      id: 11,
      questionData: {
        ...question6,
        createdAt: null,
        updatedAt: null,
      },
      results: {
        answers: [],
      },
      questionId: question6.id,
      ownerId: user.id,
    },
    update: {
      results: {
        answers: [],
      },
    },
  })

  const instance13 = await prisma.questionInstance.upsert({
    where: {
      id: 12,
    },
    create: {
      id: 12,
      questionData: {
        ...question7,
        createdAt: null,
        updatedAt: null,
      },
      results: {
        answers: [],
      },
      questionId: question7.id,
      ownerId: user.id,
    },
    update: {
      results: {
        answers: [],
      },
    },
  })

  const session = await prisma.session.upsert({
    where: {
      id: 'a3bb4ae9-5acc-4e66-99d9-a9df1d4d0c08',
    },
    create: {
      id: 'a3bb4ae9-5acc-4e66-99d9-a9df1d4d0c08',
      name: 'BF1 VL1',
      displayName: 'Banking und Finance I - VL1',
      status: Prisma.SessionStatus.PREPARED,
      blocks: {
        create: [
          {
            execution: 0,
            instances: {
              connect: [
                {
                  id: instance6.id,
                },
                {
                  id: instance7.id,
                },
              ],
            },
          },
        ],
      },
      course: {
        connect: {
          id: course.id,
        },
      },
      owner: {
        connect: {
          id: user.id,
        },
      },
    },
    update: {},
  })

  const session2 = await prisma.session.upsert({
    where: {
      id: 'a3bb4ae9-5acc-4e66-99d9-a9df1d4d0c09',
    },
    create: {
      id: 'a3bb4ae9-5acc-4e66-99d9-a9df1d4d0c09',
      name: 'BF1 VL2',
      displayName: 'Banking und Finance I - VL1',
      isModerationEnabled: false,
      isAudienceInteractionActive: true,
      isGamificationEnabled: true,
      status: Prisma.SessionStatus.PREPARED,
      blocks: {
        create: [
          {
            execution: 0,
            instances: {
              connect: [
                {
                  id: instance8.id,
                },
              ],
            },
            expiresAt: new Date('2022-12-31T23:59:59.999Z'),
            timeLimit: 20,
          },
          {
            execution: 0,
            instances: {
              connect: [
                {
                  id: instance9.id,
                },
                {
                  id: instance10.id,
                },
                {
                  id: instance11.id,
                },
              ],
            },
            expiresAt: new Date('2022-12-31T23:59:59.999Z'),
            timeLimit: 30,
          },
        ],
      },
      course: {
        connect: {
          id: course.id,
        },
      },
      owner: {
        connect: {
          id: user.id,
        },
      },
    },
    update: {},
  })

  const session3 = await prisma.session.upsert({
    where: {
      id: 'a3bb4ae9-5acc-4e66-99d9-a9df1d4d0c0a',
    },
    create: {
      id: 'a3bb4ae9-5acc-4e66-99d9-a9df1d4d0c0a',
      name: 'BF1 VL3',
      displayName: 'Banking und Finance I - VL3',
      isModerationEnabled: false,
      isAudienceInteractionActive: true,
      isGamificationEnabled: true,
      status: Prisma.SessionStatus.PREPARED,
      blocks: {
        create: [
          {
            execution: 0,
            instances: {
              connect: [
                {
                  id: instance12.id,
                },
                {
                  id: instance13.id,
                },
              ],
            },
          },
        ],
      },
      course: {
        connect: {
          id: course.id,
        },
      },
      owner: {
        connect: {
          id: user.id,
        },
      },
    },
    update: {},
  })

  const microSession = await prisma.microSession.upsert({
    where: {
      id: '0ce58914-efaa-4ee5-9693-db497f7e5d46',
    },
    create: {
      id: '0ce58914-efaa-4ee5-9693-db497f7e5d46',
    },
    update: {},
  })

  await prisma.$executeRaw`ALTER SEQUENCE "Question_id_seq" RESTART WITH 9`
  await prisma.$executeRaw`ALTER SEQUENCE "QuestionInstance_id_seq" RESTART WITH 13`
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
