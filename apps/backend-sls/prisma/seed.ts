import 'dotenv/config'

import Prisma from '@klicker-uzh/prisma'
import bcrypt from 'bcryptjs'

async function main(prisma: Prisma.PrismaClient) {
  const hash = await bcrypt.hash('abcd', 12)

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

  const question = await prisma.question.upsert({
    where: {
      id: '996f208b-d567-4f1e-8c57-6f555866c33a',
    },
    create: {
      id: '996f208b-d567-4f1e-8c57-6f555866c33a',
      name: 'Zieldreieck',
      content: 'Welche der folgenden Aussagen ist **falsch**?',
      contentPlain: 'Welche der folgenden Aussagen ist falsch?',
      type: 'SC',
      options: {
        choices: [
          {
            feedback:
              'Falsch! Zwischen den Zielsetzungen des klassischen finanziellen Zieldreiecks gibt es sowohl Zielkonflikte als auch Zielharmonien.',
            correct: false,
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
            correct: false,
            value:
              'Unabhängigkeit ist *kein* Ziel des klassischen Zieldreiecks.',
          },
          {
            feedback:
              'Falsch! Eine hohe Liquidität steht im Zielkonflikt mit der Rentabilität, da Liquidität meist teuer ist.',
            correct: false,
            value:
              'Eine hohe Liquidität steht im Zielkonflikt mit der Rentabilität, da Liquidität meist teuer ist.',
          },
          {
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
      id: '996f208b-d567-4f1e-8c57-6f555866c33b',
    },
    create: {
      id: '996f208b-d567-4f1e-8c57-6f555866c33b',
      name: 'Organisation des Finanzwesens',
      content: 'Welche der folgenden Aussagen ist **falsch**?',
      contentPlain: 'Welche der folgenden Aussagen ist falsch?',
      type: 'SC',
      options: {
        choices: [
          {
            feedback: 'Diese Aussage ist nicht korrekt!',
            correct: false,
            value:
              'Die zentralen Tätigkeiten einer Finanzabteilung lassen sich in Finanzplanung, Finanzdisposition (d.h. die Realisierung der Finanzplanung) und Finanzcontrolling einteilen.',
          },
          {
            feedback: 'Diese Aussage ist nicht korrekt!',
            correct: false,
            value:
              'Beim Controlling geht es grundsätzlich um die Überwachung des finanziellen Geschehens. Dies wird mit Hilfe eines Soll/Ist-Vergleichs der Finanzplanung gemacht.',
          },
          {
            feedback: 'Diese Aussage ist nicht korrekt!',
            correct: false,
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
      id: '996f208b-d567-4f1e-8c57-6f555866c33c',
    },
    create: {
      id: '996f208b-d567-4f1e-8c57-6f555866c33c',
      name: 'Stakeholder',
      content:
        'Welche der folgenden Personen/Gruppen sind **keine** Stakeholder?',
      contentPlain:
        'Welche der folgenden Personen/Gruppen sind keine Stakeholder?',
      type: 'SC',
      options: {
        choices: [
          {
            feedback:
              'Falsch! Beim Staat handelt es sich um einen Stakeholder.',
            correct: false,
            value: 'Staat',
          },
          {
            feedback:
              'Falsch! Bei den Arbeitnehmern handelt es sich um Stakeholder.',
            correct: false,
            value: 'Arbeitnehmer',
          },
          {
            feedback:
              'Falsch! Bei den Fremdkapitalgebern handelt es sich um Stakeholder.',
            correct: false,
            value: 'Fremdkapitalgeber',
          },
          {
            feedback: 'Kunden',
            correct: false,
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
      ownerId: user.id,
    },
    update: {},
  })

  const question4 = await prisma.question.upsert({
    where: {
      id: '996f208b-d567-4f1e-8c57-6f555866c33d',
    },
    create: {
      id: '996f208b-d567-4f1e-8c57-6f555866c33d',
      name: 'Bilanz',
      content:
        'Beurteile die folgenden Aussagen zur Bilanz auf ihre Richtigkeit:',
      contentPlain:
        'Beurteile die folgenden Aussagen zur Bilanz auf ihre Richtigkeit:',
      type: 'MC',
      options: {
        choices: [
          {
            feedback:
              'Diese Aussage ist nicht korrekt! Die Aktivseite zeigt die Mittelverwendung auf.',
            correct: false,
            value: 'Die Aktivseite zeigt die Mittelherkunft auf.',
          },
          {
            feedback:
              'Diese Aussage ist nicht korrekt! Die Passivseite zeigt die Mittelherkunft auf.',
            correct: false,
            value: 'Die Passivseite der Bilanz zeigt die Mittelverwendung auf.',
          },
          {
            feedback:
              'Diese Aussage ist nicht korrekt! Das EK zeigt zwar die Mittelherkunft auf, diese wird aber auf der Passivseite der Bilanz abgebildet.',
            correct: false,
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
      ownerId: user.id,
    },
    update: {},
  })

  const question5 = await prisma.question.upsert({
    where: {
      id: '996f208b-d567-4f1e-8c57-6f555866c33e',
    },
    create: {
      id: '996f208b-d567-4f1e-8c57-6f555866c33e',
      name: 'Grundfunktionen des Fremdkapitals',
      content:
        'Welches sind Merkmale des Fremdkapitals? Beurteile die folgenden Aussagen auf ihre Richtigkeit:',
      contentPlain:
        'Welches sind Merkmale des Fremdkapitals? Beurteile die folgenden Aussagen auf ihre Richtigkeit:',
      type: 'MC',
      options: {
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
            correct: false,
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
      ownerId: user.id,
    },
    update: {},
  })

  const question6 = await prisma.question.upsert({
    where: {
      id: '996f208b-d567-4f1e-8c57-6f555866c33f',
    },
    create: {
      id: '996f208b-d567-4f1e-8c57-6f555866c33f',
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

  const question7 = await prisma.question.upsert({
    where: {
      id: '996f208b-d567-4f1e-8c57-6f555866c341',
    },
    create: {
      id: '996f208b-d567-4f1e-8c57-6f555866c341',
      name: 'Soziale Marktwirtschaft',
      content: 'Beschreibe die Hauptprinzipien einer sozialen Marktwirtschaft.',
      contentPlain:
        'Beschreibe die Hauptprinzipien einer sozialen Marktwirtschaft.',
      type: 'FREE_TEXT',
      options: {
        restrictions: {
          maxLength: 100,
        },
      },
      ownerId: user.id,
    },
    update: {},
  })

  const instance = await prisma.questionInstance.upsert({
    where: {
      id: '6a44d3a8-c24f-4f48-90e6-acf81a73781e',
    },
    create: {
      id: '6a44d3a8-c24f-4f48-90e6-acf81a73781e',
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
      id: '6a44d3a8-c24f-4f48-90e6-acf81a73781f',
    },
    create: {
      id: '6a44d3a8-c24f-4f48-90e6-acf81a73781f',
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
      id: '6a44d3a8-c24f-4f48-90e6-acf81a73782a',
    },
    create: {
      id: '6a44d3a8-c24f-4f48-90e6-acf81a73782a',
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
      id: '6a44d3a8-c24f-4f48-90e6-acf81a73782b',
    },
    create: {
      id: '6a44d3a8-c24f-4f48-90e6-acf81a73782b',
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
      id: '6a44d3a8-c24f-4f48-90e6-acf81a73782c',
    },
    create: {
      id: '6a44d3a8-c24f-4f48-90e6-acf81a73782c',
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
      id: '6a44d3a8-c24f-4f48-90e6-acf81a73751a',
    },
    create: {
      id: '6a44d3a8-c24f-4f48-90e6-acf81a73751a',
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
      id: '6a44d3a8-c24f-4f48-90e6-acf81a73751b',
    },
    create: {
      id: '6a44d3a8-c24f-4f48-90e6-acf81a73751b',
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
      id: '6a44d3a8-c24f-4f48-90e6-acf81a73782d',
    },
    create: {
      id: '6a44d3a8-c24f-4f48-90e6-acf81a73782d',
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
      id: '6a44d3a8-c24f-4f48-90e6-acf81a73782e',
    },
    create: {
      id: '6a44d3a8-c24f-4f48-90e6-acf81a73782e',
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
      id: '6a44d3a8-c24f-4f48-90e6-acf81a73782f',
    },
    create: {
      id: '6a44d3a8-c24f-4f48-90e6-acf81a73782f',
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
      id: '6a44d3a8-c24f-4f48-90e6-acf81a73783a',
    },
    create: {
      id: '6a44d3a8-c24f-4f48-90e6-acf81a73783a',
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
      id: '6a44d3a8-c24f-4f48-90e6-acf81a73783b',
    },
    create: {
      id: '6a44d3a8-c24f-4f48-90e6-acf81a73783b',
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
      id: '6a44d3a8-c24f-4f48-90e6-acf81a73783c',
    },
    create: {
      id: '6a44d3a8-c24f-4f48-90e6-acf81a73783c',
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
      name: 'BF1 VL1',
      displayName: 'Banking und Finance I - VL1',
      status: 'PLANNED',
      blocks: {
        create: [
          {
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
      name: 'BF1 VL2',
      displayName: 'Banking und Finance I - VL1',
      status: 'RUNNING',
      activeBlock: 1,
      blocks: {
        create: [
          {
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
      name: 'BF1 VL3',
      displayName: 'Banking und Finance I - VL3',
      status: 'RUNNING',
      activeBlock: 0,
      blocks: {
        create: [
          {
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
