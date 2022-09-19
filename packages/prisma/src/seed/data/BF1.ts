import Prisma from '@klicker-uzh/prisma'
import { range } from 'ramda'

const { AttachmentType, QuestionType, SessionStatus } = Prisma

export const PARTICIPANT_IDS = []

export const ATTACHMENTS = []

export const QUESTIONS = [
  {
    id: 0,
    name: 'Modul 1 Zieldreieck',
    content: 'Welche der folgenden Aussagen ist **falsch**?',
    contentPlain: 'Welche der folgenden Aussagen ist falsch?',
    type: QuestionType.SC,
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
        value: 'Unabhängigkeit ist *kein* Ziel des klassischen Zieldreiecks.',
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
    name: 'Modul 1 Organisation des Finanzwesens',
    content: 'Welche der folgenden Aussagen ist **falsch**?',
    contentPlain: 'Welche der folgenden Aussagen ist falsch?',
    type: QuestionType.SC,
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
    name: 'Modul 1 Stakeholder',
    content:
      'Welche der folgenden Personen/Gruppen sind **keine** Stakeholder?',
    contentPlain:
      'Welche der folgenden Personen/Gruppen sind keine Stakeholder?',
    type: QuestionType.SC,
    choices: [
      {
        feedback: 'Falsch! Beim Staat handelt es sich um einen Stakeholder.',
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
        feedback: 'Falsch! Bei den Kunden handelt es sich um Stakeholder.',
        value: 'Kunden',
      },
      {
        feedback: 'Korrekt! Alle genannten Personen/Gruppen sind Stakeholder.',
        correct: true,
        value:
          'Es handelt sich bei allen oben genannten Personen/Gruppen um Stakeholder.',
      },
    ],
  },
  {
    id: 3,
    name: 'Modul 1 Bilanz',
    content:
      'Beurteile die folgenden Aussagen zur Bilanz auf ihre Richtigkeit:',
    contentPlain:
      'Beurteile die folgenden Aussagen zur Bilanz auf ihre Richtigkeit:',
    type: QuestionType.KPRIM,
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
    name: 'Modul 1 Grundfunktionen des Fremdkapitals',
    content:
      'Welches sind Merkmale des Fremdkapitals? Beurteile die folgenden Aussagen auf ihre Richtigkeit:',
    contentPlain:
      'Welches sind Merkmale des Fremdkapitals? Beurteile die folgenden Aussagen auf ihre Richtigkeit:',
    type: QuestionType.KPRIM,
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
    name: 'Microlearning 1.1',
    content:
      'Welche der folgenden Aussagen zur **Interaktion zwischen Kapitalnehmer:innen und Kapitalgeber:innen** ist korrekt?',
    contentPlain:
      'Welche der folgenden Aussagen zur Interaktion zwischen Kapitalnehmer:innen und Kapitalgeber:innen ist korrekt?',
    type: QuestionType.SC,
    choices: [
      {
        correct: true,
        value:
          'Kapitalnehmer:innen und Kapitalgeber:innen interagieren via Finanzmärkte oder Finanzintermediäre miteinander.',
        feedback: 'Diese Aussage ist korrekt.',
      },
      {
        value: 'Haushalte gehören typischerweise zu den Kapitalnehmer:innen.',
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
    id: 6,
    name: 'Microlearning 1.2',
    content:
      'Welcher der folgenden Entscheidungsbereiche ist **nicht** Teil der **Corporate Finance**?',
    contentPlain:
      'Welcher der folgenden Entscheidungsbereiche ist nicht Teil der Corporate Finance?',
    type: QuestionType.SC,
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
    id: 7,
    name: 'Microlearning 1.3',
    content:
      'Welche der folgenden Aussagen zum Aufbau einer **Bilanz** ist **korrekt**?',
    contentPlain:
      'Welche der folgenden Aussagen zum Aufbau einer Bilanz ist korrekt?',
    type: QuestionType.SC,
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
    id: 8,
    name: 'Microlearning 1.4',
    content:
      'Welche der folgenden Aussagen bezüglich des **finanzwirtschaftlichen Zieldreiecks** ist **korrekt**?',
    contentPlain:
      'Welche der folgenden Aussagen bezüglich des finanzwirtschaftlichen Zieldreiecks ist korrekt?',
    type: QuestionType.SC,
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
        value: 'Die Liquidität und Sicherheit begünstigen sich gegenseitig.',
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
    id: 9,
    name: 'Jodel Woche 01',
    content: 'Wie oft benutzt du Jodel?',
    contentPlain: 'Wie oft benutzt du Jodel?',
    type: QuestionType.SC,
    choices: [
      {
        value: 'Ich schaue täglich rein und schreibe ab und zu einen Post.',
      },
      {
        value: 'Ich schaue täglich rein, aber poste nie selber.',
      },
      {
        value: 'Ab und zu.',
      },
      {
        value: 'Selten.',
      },
      {
        value: 'Was ist Jodel?',
      },
    ],
  },
  {
    id: 10,
    name: 'Modul 2.1 Investitionsrechenverfahren',
    content:
      'Beurteile die folgenden Aussagen zu den **Investitionsrechenverfahren** auf ihre Richtigkeit.',
    contentPlain:
      'Beurteile die folgenden Aussagen zu den Investitionsrechenverfahren auf ihre Richtigkeit.',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Kosten, die unabhängig von der Ausbringungsmenge anfallen, nennt man fixe Kosten.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Mit der Rentabilitätsrechnung können sowohl mehrere Investitionsmöglichkeiten mit unterschiedlichem Kapitaleinsatz, als auch ein einzelnes Projekt beurteilt werden.',
        value:
          'Der Einsatz der Rentabilitätsrechnung ist nur dann sinnvoll, wenn Investitionsvorhaben gleiche Kapitaleinsätze benötigen.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Es sind die dynamischen Verfahren, welche die zeitlich unterschiedlich anfallenden Zahlungsströme erfassen.',
        value:
          'Der Unterschied zwischen den statischen und den dynamischen Investitionsrechenverfahren besteht darin, dass die statischen Verfahren die zeitlich unterschiedlich anfallenden Zahlungsströme der Nutzungsdauer zu erfassen versuchen.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Die dynamischen Investitionsrechenverfahren versuchen einige Schwächen der statischen Methoden, wie z.B. die Periodenbegrenzung, zu beseitigen.',
      },
    ],
  },
  {
    id: 11,
    name: 'Modul 2.1 Rationalisierungsinvestition',
    content:
      'Es werden diverse Arten von Investitionen unterschieden. Eine davon ist die **Rationalisierungsinvestition**. Was versteht man unter dieser Investitionsart?',
    contentPlain:
      'Es werden diverse Arten von Investitionen unterschieden. Eine davon ist die Rationalisierungsinvestition. Was versteht man unter dieser Investitionsart?',
    type: QuestionType.SC,
    choices: [
      {
        value: 'Alte oder verbrauchte Anlagen werden durch eine neue ersetzt.',
        feedback:
          'Diese Aussage ist nicht korrekt! Diese Art von Investition wird Ersatzinvestition genannt.',
      },
      {
        value:
          'Alte Anlagen werden durch neue ersetzt, um anstelle der alten neue Produkte herzustellen.',
        feedback:
          'Diese Aussage ist nicht korrekt! Diese Art von Investition wird Umstellungsinvestition genannt.',
      },
      {
        value:
          'Neue Anlagen werden beschafft, um das Leistungspotential in quantitativer Hinsicht zu vergrössern.',
        feedback:
          'Diese Aussage ist nicht korrekt! Diese Art von Investition wird Erweiterungsinvestition genannt.',
      },
      {
        value:
          'Zusätzlich zu den bisherigen Leistungen werden neue erbracht, die in das bestehende Produktionsprogramm passen.',
        feedback:
          'Diese Aussage ist nicht korrekt! Diese Art von Investition wird Diversifikationsinvestition genannt.',
      },
      {
        correct: true,
        value:
          'Noch funktionierende Anlagen werden ausgewechselt um beispielsweise Kosten zu sparen.',
        feedback:
          'Diese Aussage ist korrekt! Des Weiteren besteht die Möglichkeit, mit neuen Maschinen qualitativ bessere Produkte herzustellen und so die Verkaufspreise zu erhöhen.',
      },
    ],
  },
  {
    id: 12,
    name: 'Modul 2.1 Rentabilitätsberechnung',
    content: `Man erwartet, dass ein Projekt einen Gewinn von insgesamt 50'000 CHF generieren wird. Für den Kauf einer dazu benötigten Maschine müssen 600'000 CHF aufgewendet werden. Am Ende der Nutzungsdauer wird diese Maschine wieder verkauft. Man erwartet daraus einen Erlös von 300'000 CHF.

      Wie hoch ist die **(Gesamtkapital-)** Rentabilität dieses Projektes?`,
    contentPlain: `Man erwartet, dass ein Projekt einen Gewinn von insgesamt 50'000 CHF generieren wird. Für den Kauf einer dazu benötigten Maschine müssen 600'000 CHF aufgewendet werden. Am Ende der Nutzungsdauer wird diese Maschine wieder verkauft. Man erwartet daraus einen Erlös von 300'000 CHF.

      Wie hoch ist die (Gesamtkapital-) Rentabilität dieses Projektes?`,
    type: QuestionType.SC,
    choices: [
      {
        value: '3,7 %',
        feedback: 'Diese Aussage ist nicht korrekt!',
      },
      {
        correct: true,
        value: '11,1 %',
        feedback: 'Diese Aussage ist korrekt!',
      },
      {
        value: '26,8 %',
        feedback: 'Diese Aussage ist nicht korrekt!',
      },
      {
        value: '34,5 %',
        feedback: 'Diese Aussage ist nicht korrekt!',
      },
      {
        value: '79,6 %',
        feedback: 'Diese Aussage ist nicht korrekt!',
      },
    ],
  },
  {
    id: 13,
    name: 'Modul 2.1 Amortisationsrechnung',
    content:
      'Beurteile die folgenden Aussagen zur **Amortisationsrechnung** auf ihre Richtigkeit.',
    contentPlain:
      'Beurteile die folgenden Aussagen zur Amortisationsrechnung auf ihre Richtigkeit.',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Mit Hilfe der Amortisationsrechnung kann die Anzahl Jahre bestimmt werden, die es braucht, bis der Investitionsbetrag durch die jährlichen Einzahlungsüberschüsse zurückbezahlt werden kann.',
        value:
          'Mit Hilfe der Amortisationsrechnung kann man die Grösse der jährlichen Zahlungsströme ermitteln, die notwendig sind, um ein betrachtetes Investitionsprojekt bis zum Ende seiner Nutzungsdauer vollständig zu amortisieren.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Mit Hilfe der Amortisationsrechnung kann man die Anzahl der Jahre bestimmen, die es dauert, bis ein Projekt bei gegebener Rendite vollständig amortisiert wird.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Mit Hilfe der Amortisationsrechnung kann die Anzahl Jahre bestimmt werden, die es braucht, bis der Investitionsbetrag durch die jährlichen Einzahlungsüberschüsse zurückbezahlt werden kann.',
        value:
          'Mit Hilfe der Amortisationsrechnung kann man die Anzahl der Projekte bestimmen, die es braucht, um eine von der Unternehmung vorgegebene Gewinnschwelle (Break-Even-Punkt) zu überschreiten.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Mit Hilfe der Amortisationsrechnung kann man das Risiko mitberücksichtigen: Je länger die Wiedergewinnungszeit, umso grösser ist das Risiko, dass sich die Investition nicht bezahlt macht.',
      },
    ],
  },
  {
    id: 14,
    name: 'Modul 2.2 Zeitwert des Geldes',
    content:
      'Welches ist die zentrale Annahme, die hinter der **NPV-Methode** (Kapitalwertmethode) steht?',
    contentPlain:
      'Welches ist die zentrale Annahme, die hinter der NPV-Methode (Kapitalwertmethode) steht?',
    type: QuestionType.SC,
    choices: [
      {
        value: 'CHF 100 sind morgen real mehr wert als heute.',
        feedback:
          'Diese Aussage ist nicht korrekt! Die zentrale Annahme der NPV-Methode ist, dass CHF 100 heute real mehr wert sind als CHF 100 morgen.',
      },
      {
        value:
          'CHF 100 sind morgen gleich viel wert wie heute, sowohl real wie auch nominal.',
        feedback:
          'Diese Aussage ist nicht korrekt! Die zentrale Annahme der NPV-Methode ist, dass CHF 100 heute real mehr wert sind als CHF 100 morgen.',
      },
      {
        value: 'CHF 100 sind morgen nominal weniger wert als heute.',
        feedback:
          'Diese Aussage ist nicht korrekt! Die zentrale Annahme der NPV-Methode ist, dass CHF 100 heute real mehr wert sind als CHF 100 morgen.',
      },
      {
        correct: true,
        value: 'CHF 100 sind heute real mehr wert als morgen.',
        feedback: 'Diese Aussage ist korrekt! Diskontieren nicht vergessen!',
      },
      {
        value: 'CHF 100 sind morgen nominal mehr wert als heute.',
        feedback:
          'Diese Aussage ist nicht korrekt! Die zentrale Annahme der NPV-Methode ist, dass CHF 100 heute real mehr wert sind als CHF 100 morgen.',
      },
    ],
  },
  {
    id: 15,
    name: 'Modul 2.2 Kapitalwert einer Investition',
    content:
      'Der **Kapitalwert** einer Investition ist definiert als Summe aller auf den Zeitpunkt 0 mit dem Kalkulationszinssatz i …',
    contentPlain:
      'Der Kapitalwert einer Investition ist definiert als Summe aller auf den Zeitpunkt 0 mit dem Kalkulationszinssatz i …',
    type: QuestionType.SC,
    choices: [
      {
        correct: true,
        value: '… abgezinsten Ein- und Auszahlungen.',
        feedback: 'Diese Aussage ist korrekt!',
      },
      {
        value: '… abgezinsten Einzahlungen.',
        feedback:
          'Diese Aussage ist nicht korrekt! Nicht nur Einzahlungen sondern die Differenz der Einzahlungen und Auszahlungen.',
      },
      {
        value: '… aufgezinsten Auszahlungen.',
        feedback:
          'Diese Aussage ist nicht korrekt! Nicht nur Auszahlungen, sondern die abgezinste Differenz der Einzahlungen und Auszahlungen.',
      },
      {
        value: '… aufgezinsten Einzahlungen.',
        feedback:
          'Diese Aussage ist nicht korrekt! Nicht nur Einzahlungen, sondern die abgezinste Differenz der Einzahlungen und Auszahlungen.',
      },
      {
        value: '… aufgezinsten Ein- und Auszahlungen.',
        feedback:
          'Diese Aussage ist nicht korrekt! Nicht aufgezinsten sondern abgezinsten Ein- und Auszahlungen.',
      },
    ],
  },
  {
    id: 16,
    name: 'Modul 2.2 Unterjährige Verzinsung 1',
    content: `Du sollst ein Vermögen von 10000 CHF für ein Jahr anlegen und hast die Auswahl zwischen folgenden Anlagen:

      A) Anlage zu 4.8%, vierteljährliche Verzinsung

      B) Anlage zu 5%, jährliche Verzinsung

      C) Anlage zu 5%, halbjährliche Verzinsung

      D) Anlage zu 4.8%, halbjährliche Verzinsung

      Beurteile **folgende Aussagen** zu den verschiedenen Anlagen auf ihre **Richtigkeit**.`,
    contentPlain: `Du sollst ein Vermögen von 10000 CHF für ein Jahr anlegen und hast die Auswahl zwischen folgenden Anlagen:

      A) Anlage zu 4.8%, vierteljährliche Verzinsung

      B) Anlage zu 5%, jährliche Verzinsung

      C) Anlage zu 5%, halbjährliche Verzinsung

      D) Anlage zu 4.8%, halbjährliche Verzinsung

      Beurteile folgende Aussagen zu den verschiedenen Anlagen auf ihre Richtigkeit.`,
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Die Anlage A) zu 4.8% bei vierteljährlicher Verzinsung entspricht einer viermaligen Verzinsung zu 1.2%, was einem effektiven Jahreszins von ca. 4.89% entspricht. Zur Berechnung benötigst du folgende Formel:',
        value: 'Anlage A) ist rentabler als Anlage B)',
      },
      {
        feedback:
          'Diese Aussage ist korrekt! Der effektive Jahreszins der Anlage C) beträgt 5.06%.',
        correct: true,
        value: 'Anlage C) ist rentabler als Anlage B)',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Der effektive Jahreszins der Anlage A) ist mit ca. 4.89% höher als der effektive Jahreszins der Anlage D). (ca. 4.86%)',
        value: 'Anlage D) ist rentabler als Anlage A)',
      },
      {
        feedback: 'Diese Aussage ist nicht korrekt!',
        value: 'Anlage A) ist die rentabelste Anlage.',
      },
    ],
  },
  {
    id: 17,
    name: 'Modul 2.2 Unterjährige Verzinsung 2',
    content: `Deine Bank zahlt Dir einen halbjährlich festgelegten Zinssatz von 4% per annum.

      Was ist der äquivalente **effektive Jahreszins**?`,
    contentPlain: `Deine Bank zahlt Dir einen halbjährlich festgelegten Zinssatz von 4% per annum.

      Was ist der äquivalente effektive Jahreszins?`,
    type: QuestionType.SC,
    choices: [
      {
        value: '8.16%',
        feedback: 'Diese Aussage ist nicht korrekt!',
      },
      {
        value: '2.00%',
        feedback: 'Diese Aussage ist nicht korrekt!',
      },
      {
        correct: true,
        value: '4.04%',
        feedback: 'Diese Aussage ist korrekt!',
      },
      {
        value: '4.00%',
        feedback: 'Diese Aussage ist nicht korrekt!',
      },
    ],
  },
  {
    id: 18,
    name: 'Modul 2.3 Annuitätenmethode',
    content:
      'Zu welchen Investitionsrechenverfahren gehört die **Annuitätenmethode**?',
    contentPlain:
      'Zu welchen Investitionsrechenverfahren gehört die Annuitätenmethode?',
    type: QuestionType.SC,
    choices: [
      {
        value: 'Statisches Verfahren',
        feedback:
          'Diese Aussage ist nicht korrekt! Die Annuitätenmethode ist ein dynamisches Investitionsrechenverfahren, welches den Kapitalwert in gleich grosse jährliche Einzahlungsüberschüsse umwandelt.',
      },
      {
        value: 'Verfahren der Kostenvergleichsrechnung',
        feedback:
          'Diese Aussage ist nicht korrekt! Die Kostenvergleichsrechnung ist ein Verfahren der statischen Investitionsrechnung. Dabei werden die Kosten von zwei oder mehreren Investitionsprojekten ermittelt und einander gegenübergestellt.',
      },
      {
        correct: true,
        value: 'Dynamisches Verfahren',
        feedback:
          'Diese Aussage ist korrekt! Im Gegensatz zur Kapitalwertmethode (NPV) wandelt die Annuitätenmethode die Ein- und Auszahlungen einer Investition in gleich grosse jährliche Einzahlungsüberschüsse um.',
      },
      {
        value: 'Verfahren der Kapitalwertmethode',
        feedback:
          'Diese Aussage ist nicht korrekt! Die Kapitalwertmethode ist ein dynamisches Verfahren der Investitionsrechnung, bei dem alle durch eine Investition verursachten Ein- und Auszahlungen auf einen bestimmten Zeitpunkt abgezinst werden.',
      },
      {
        value: 'Rentabilitätsrechnung',
        feedback:
          'Diese Aussage ist nicht korrekt! Die Rentabilitätsrechnung ist ein statisches Verfahren der Investitionsrechnung, bei dem der durchschnittlich erzielte Jahresgewinn in Beziehung zum durchschnittlich eingesetzten Kapital gesetzt wird.',
      },
    ],
  },
  {
    id: 19,
    name: 'Modul 2.3 Dynamische Methode',
    content: `Vier ehemalige Jus-Studenten gründen zusammen eine Anwaltskanzlei. In 5 Jahren wird einer von ihnen auf eine Weltreise gehen und deshalb die Kanzlei verlassen. Der austretende Gesellschafter bekommt dafür in 5 Jahren vertraglich zugesicherte 125'000 CHF. Wie gross ist sein **heutiger Anteil am Unternehmen** bzw. muss er zum Gründungskapital beitragen, wenn wir von einem jährlich konstanten Zinssatz von 10% ausgehen?
      (Gerundet auf ganze Franken)`,
    contentPlain: `Vier ehemalige Jus-Studenten gründen zusammen eine Anwaltskanzlei. In 5 Jahren wird einer von ihnen auf eine Weltreise gehen und deshalb die Kanzlei verlassen. Der austretende Gesellschafter bekommt dafür in 5 Jahren vertraglich zugesicherte 125'000 CHF. Wie gross ist sein heutiger Anteil am Unternehmen bzw. muss er zum Gründungskapital beitragen, wenn wir von einem jährlich konstanten Zinssatz von 10% ausgehen?
      (Gerundet auf ganze Franken)`,
    type: QuestionType.SC,
    choices: [
      {
        value: '70 559 CHF',
        feedback: 'Diese Aussage ist nicht korrekt!',
      },
      // TODO: formel
      {
        correct: true,
        value: '77 615 CHF',
        feedback:
          'Diese Aussage ist korrekt! Der korrekte Lösungsweg ist: K0 = CHF 125 000 / ((1+0,1)^5) = 77 615 CHF',
      },
      {
        value: '85 377 CHF',
        feedback: 'Diese Aussage ist nicht korrekt!',
      },
      {
        value: '183 013 CHF',
        feedback: 'Diese Aussage ist nicht korrekt!',
      },
      {
        value: '201 313 CHF',
        feedback: 'Diese Aussage ist nicht korrekt!',
      },
    ],
  },
  // TODO: formel
  {
    id: 20,
    name: 'Modul 2.3 Dynamische Methode (Faktoren)',
    content:
      'Der ………… multipliziert mit dem Endwert K n  ermittelt den Barwert K 0  des Endkapitals K n , d.h. der spätere Wert K n  wird auf den früheren Wert K 0  um n Jahre unter Abzug von Zinseszinsen zurückdatiert.',
    contentPlain:
      'Der ………… multipliziert mit dem Endwert K n  ermittelt den Barwert K 0  des Endkapitals K n , d.h. der spätere Wert K n  wird auf den früheren Wert K 0  um n Jahre unter Abzug von Zinseszinsen zurückdatiert.',
    type: QuestionType.SC,
    choices: [
      {
        value: 'Rentenbarwertfaktor',
        feedback: 'Diese Aussage ist nicht korrekt!',
      },
      {
        value: 'Annuitätenfaktor',
        feedback: 'Diese Aussage ist nicht korrekt!',
      },
      {
        value: 'Aufzinsungsfaktor',
        feedback: 'Diese Aussage ist nicht korrekt!',
      },
      {
        correct: true,
        value: 'Abzinsungsfaktor',
        feedback: 'Diese Aussage ist korrekt!',
      },
      {
        value: 'Wiedergewinnungsfaktor',
        feedback: 'Diese Aussage ist nicht korrekt!',
      },
    ],
  },
  {
    id: 21,
    name: 'Modul 2.3 Dynamische Verfahren',
    content:
      'Beurteile die folgenden Aussagen zum **dynamischen Verfahren** auf ihre Richtigkeit.',
    contentPlain:
      'Beurteile die folgenden Aussagen zum dynamischen Verfahren auf ihre Richtigkeit.',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Die dynamischen Verfahren setzen mathematische Grundkenntnisse voraus, da sie auf der Rechentechnik des Auf- und Abzinsens basieren.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Dies ist bei den statischen Verfahren der Fall. Bei den dynamischen Verfahren werden Aus- und Einzahlungen als Rechnungselemente verwendet.',
        value:
          'Die dynamischen Verfahren benutzen meist Kosten und Leistungen statt Aufwendungen und Erträge als Rechnungselemente.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Gerade umgekehrt, sie werden heute vorwiegend in Grossunternehmen eingesetzt, im Gegensatz zu den statischen Verfahren.',
        value:
          'Die dynamischen Verfahren werden heutzutage bei Grossunternehmen immer seltener angewendet.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Bei den dynamischen Verfahren wird nicht mit Durchschnittswerten gerechnet, sondern mit Zahlungsströmen, die während der ganzen Nutzungsdauer der Investition auftreten.',
      },
    ],
  },
  {
    id: 22,
    name: 'Modul 2.3 Investitionsrechnung',
    content:
      'Beurteile die folgenden Aussagen zur **Investitionsrechnung** auf ihre Richtigkeit.',
    contentPlain:
      'Beurteile die folgenden Aussagen zur Investitionsrechnung auf ihre Richtigkeit.',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Die Investitionsrechnung betrachtet die ganze Nutzungsdauer eines Investitionsobjektes.',
        value:
          'Die dynamische Investitionsrechnung betrachtet nur einen Teil der Nutzungsdauer eines Investitionsobjektes.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Das macht die Kostenrechnung. Die Investitionsrechnung betrachtet nur einzelne Objekte.',
        value:
          'Die dynamische Investitionsrechnung bezieht sich auf den Betrieb als Ganzes.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Das macht die Kostenrechnung. Die Investitionsrechnung dient der Vorteilhaftigkeitsbestimmung eines Investitionsobjektes.',
        value:
          'Die dynamische Investitionsrechnung dient der Steuerung und Kontrolle des ganzen Betriebes.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Die dynamische Investitionsrechnung basiert auf Ein- und Auszahlungen.',
      },
    ],
  },
  {
    id: 23,
    name: 'Modul 2.3 Vorteilhafte Investition',
    content:
      'Beurteile die folgenden Aussagen zur **vorteilhaften Investition** auf ihre Richtigkeit.',
    contentPlain:
      'Beurteile die folgenden Aussagen zur vorteilhaften Investition auf ihre Richtigkeit.',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Wenn der Diskontierungsfaktor gleich dem internen Zinssatz ist, erhält man einen Net Present Value von 0.',
        value:
          'Eine Investition ist stets dann vorteilhaft, wenn sie sich zum internen Zinssatz i verzinst.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Erst wenn die Summe aller diskontierten Zahlungsströme positiv ist, lohnt sich eine Investition in dieses Objekt.',
        value:
          'Eine Investition ist stets dann vorteilhaft, wenn die Anschaffungsauszahlung wieder gewonnen wird.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Erst wenn die Summe aller diskontierten Zahlungsströme positiv ist, lohnt sich eine Investition in dieses Objekt.',
        value:
          'Eine Investition ist stets dann vorteilhaft, wenn alle Auszahlungen wieder eingenommen werden.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Eine Investition ist stets dann vorteilhaft, wenn der Kalkulationszinsfuss unter dem internen Zinssatz liegt.',
      },
    ],
  },
  {
    id: 24,
    name: 'Modul 2.3 Net Present Value I',
    content:
      'Was stellt der **Net Present Value (NPV)** einer Investition dar?',
    contentPlain:
      'Was stellt der Net Present Value (NPV) einer Investition dar?',
    type: QuestionType.SC,
    choices: [
      {
        value:
          'Differenz aus den abgezinsten Erträgen und Aufwendungen einer Investition.',
        feedback:
          'Diese Aussage ist nicht korrekt! Es stellt die Differenz aus den abgezinsten Einzahlungen und Auszahlungen einer Investition dar.',
      },
      {
        value:
          'Differenz der aufgezinsten Erträge und Aufwendungen einer Investition.',
        feedback:
          'Diese Aussage ist nicht korrekt! Es stellt die Differenz aus den abgezinsten Einzahlungen und Auszahlungen einer Investition dar.',
      },
      {
        correct: true,
        value:
          'Differenz aus den abgezinsten Einzahlungen und Auszahlungen einer Investition.',
        feedback: 'Diese Aussage ist nicht korrekt!',
      },
      {
        value:
          'Differenz aus dem abgezinsten Reingewinn und den stillen Reserven einer Investition.',
        feedback:
          'Diese Aussage ist nicht korrekt! Es stellt die Differenz aus den abgezinsten Einzahlungen und Auszahlungen einer Investition dar.',
      },
      {
        value:
          'Differenz aus dem aufgezinsten Reingewinn und den stillen Reserven einer Investition.',
        feedback:
          'Diese Aussage ist nicht korrekt! Es stellt die Differenz aus den abgezinsten Einzahlungen und Auszahlungen einer Investition dar.',
      },
    ],
  },
  {
    id: 25,
    name: 'Modul 2.3 Net Present Value II',
    content: `Sie wollen eine neue Stanzmaschine kaufen, dabei stehen drei verschiedene Typen zur Auswahl. Alle drei Maschinen kosten gleich viel (Kaufpreis CHF 230000) und werden total in 5 Jahren gleich viel Gewinn erwirtschaften (CHF 300000). Nur fallen die einzelnen Jahresgewinne der einzelnen Maschinen unterschiedlich an. Nach 5 Jahren müssen alle Maschinen wieder ersetzt werden.
      Welche Maschine hat den **höchsten Kapitalwert (Net Present Value)**? Nehmen Sie an, es herrscht ein jährlich konstanter Zins von 10% (gerundet auf ganze Franken)?`,
    contentPlain: `Sie wollen eine neue Stanzmaschine kaufen, dabei stehen drei verschiedene Typen zur Auswahl. Alle drei Maschinen kosten gleich viel (Kaufpreis CHF 230000) und werden total in 5 Jahren gleich viel Gewinn erwirtschaften (CHF 300000). Nur fallen die einzelnen Jahresgewinne der einzelnen Maschinen unterschiedlich an. Nach 5 Jahren müssen alle Maschinen wieder ersetzt werden.
      Welche Maschine hat den höchsten Kapitalwert (Net Present Value)? Nehmen Sie an, es herrscht ein jährlich konstanter Zins von 10% (gerundet auf ganze Franken)?`,
    type: QuestionType.SC,
    // TODO: formel
    choices: [
      {
        value: 'Maschinentyp A',
        feedback:
          'Diese Aussage ist nicht korrekt! Maschinentyp A mit einem Net Present Value = 20000 * (1.1)^-1 + 40000 * (1.1)^-2 + 60000 * (1.1)^-3 + 80000 * (1.1)^-4 + 100000 * (1.1)^-5 - 230000 =-16948',
      },
      {
        value: 'Maschinentyp B',
        feedback:
          'Diese Aussage ist nicht korrekt! Maschinentyp B mit einem Net Present Value = 60000 * (1.1)^-1 + 60000 * (1.1)^-2 + 60000 * (1.1)^-3 + 60000 * (1.1)^-4 + 60000 * (1.1)^-5 - 230000 = -2553',
      },
      {
        correct: true,
        value: 'Maschinentyp C',
        feedback:
          'Diese Aussage ist korrekt! Maschinentyp C mit einem Net Present Value = 100000 * (1.1)^-1 + 80000 * (1.1)^-2 + 60000 * (1.1)^-3 + 40000 * (1.1)^-4 + 20000 * (1.1)^-5 - 230000 =11843',
      },
    ],
  },
  {
    id: 26,
    name: 'Modul 2.3 Net Present Value III',
    content:
      'Wie **hoch** ist der **Net Present Value** der folgenden Cash-flows bei einem Zinssatz von 5%?',
    contentPlain:
      'Wie **hoch** ist der **Net Present Value** der folgenden Cash-flows bei einem Zinssatz von 5%?',
    type: QuestionType.SC,
    choices: [
      {
        value: '88.19 CHF',
        feedback: 'Diese Aussage ist nicht korrekt!',
      },
      {
        value: '39.21 CHF',
        feedback: 'Diese Aussage ist nicht korrekt!',
      },
      {
        value: '83.99 CHF',
        feedback: 'Diese Aussage ist nicht korrekt!',
      },
      {
        correct: true,
        value: '41.18 CHF',
        feedback: 'Diese Aussage ist korrekt!',
      },
      {
        value: 'Die Angaben reichen für die Berechnung nicht aus.',
        feedback: 'Diese Aussage ist nicht korrekt!',
      },
    ],
  },
  {
    id: 27,
    name: 'Modul 2.3 Interner Zinssatz I',
    content: 'Die **IRR** (Methode des internen Zinssatzes) stellt …',
    contentPlain: 'Die IRR (Methode des internen Zinssatzes) stellt …',
    type: QuestionType.SC,
    choices: [
      {
        value:
          '… die maximale Rendite dar, die mit einem Projekt erzielt werden kann.',
        feedback: 'Diese Aussage ist nicht korrekt!',
      },
      {
        value:
          '… die langfristig erzielte Gesamtkapitalrendite einer Unternehmung dar.',
        feedback: 'Diese Aussage ist nicht korrekt!',
      },
      {
        value:
          '… den durchschnittlichen Zins dar, zu dem eine Unternehmung Kapital für ein Projekt aufnehmen kann.',
        feedback: 'Diese Aussage ist nicht korrekt!',
      },
      {
        correct: true,
        value:
          '… den maximalen Kapitalkostensatz dar, bei dem ein Projekt gerade noch einen NPV von 0 generiert.',
        feedback:
          'Diese Aussage ist korrekt! Mit Hilfe der IRR kann bestimmt werden, welches der maximale Kapitalkostensatz ist, bei dem ein Projekt gerade noch einen NPV von 0 generiert.',
      },
      {
        value:
          '… die maximale Rendite dar, die ein Projekt erzielen muss, um gerade noch einen NPV von Null zu generieren.',
        feedback: 'Diese Aussage ist nicht korrekt!',
      },
    ],
  },
  {
    id: 28,
    name: 'Modul 2.3 Interner Zinssatz II',
    content:
      'Beurteile folgende Aussagen zum **internen Zinssatz** auf Ihre Richtigkeit:',
    contentPlain:
      'Beurteile folgende Aussagen zum internen Zinssatz auf Ihre Richtigkeit:',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Der interne Zinssatz einer Investition unterscheidet sich in aller Regel von der statisch ermittelten Rentabilität, weil das Auf- und Abzinsen berücksichtigt wird.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Der interne Zinssatz ist derjenige Zinssatz, bei dem sich gerade ein Kapitalwert von K=0 ergibt.',
        value:
          'Der interne Zinssatz einer Investition ist gleich Null, falls der Kapitalwert der Investition Null ist.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Im Rahmen der Annuitätenmethode ermittelt man die durchschnittlich jährlichen Ein- und Auszahlungen und/oder den durchschnittlich jährlichen Überschuss.',
      },
      {
        feedback: 'Diese Aussage ist korrekt!',
        correct: true,
        value:
          'Wenn der durchschnittlich jährliche Überschuss einer Investition gleich Null ist, dann stimmen Kalkulationszinssatz und interner Zinssatz überein.',
      },
    ],
  },
  {
    id: 29,
    name: 'Modul 2.3 Interner Zinssatz III',
    content:
      'Die Cash-flows einer Investition werden wie folgt geschätzt: Der NPV bei einem Zinssatz von 5% entspricht 13.01 CHF. Die geschätze **IRR** liegt zwischen …',
    contentPlain:
      'Die Cash-flows einer Investition werden wie folgt geschätzt: Der NPV bei einem Zinssatz von 5% entspricht 13.01 CHF. Die geschätze IRR liegt zwischen …',
    type: QuestionType.SC,
    choices: [
      {
        value: '-5% und 0%.',
        feedback:
          'Diese Aussage ist nicht korrekt! Die IRR ist derjenige Zinssatz, bei welchem sich ein NPV von 0 ergibt. Bei einem Zinssatz von 5% ist der NPV bereits positiv, also wird der NPV noch grösser werden, falls die IRR zwischen -5% und 0% liegen würde. Die IRR muss grösser sein als 5%.',
      },
      {
        value: '0% und 5%.',
        feedback:
          'Diese Aussage ist nicht korrekt!  Die IRR ist derjenige Zinssatz, bei welchem sich ein NPV von 0 ergibt. Bei einem Zinssatz von 5% ist der NPV bereits positiv, also wird der NPV noch grösser werden, falls die IRR zwischen 0% und 5% liegen würde. Die IRR muss grösser sein als 5%.',
      },
      {
        value: '5% und 10%.',
        feedback:
          'Diese Aussage ist nicht korrekt! Die IRR ist derjenige Zinssatz, bei welchem sich ein NPV von 0 ergibt. Bei einem Zinssatz von 10% beträgt der NPV 2.78. Die IRR muss also grösser sein als 10%.',
      },
      {
        correct: true,
        value: '10% und 15%.',
        feedback: 'Diese Aussage ist korrekt!',
      },
      {
        value: 'Die Angaben reichen für die Berechnung der IRR nicht aus.',
        feedback:
          'Diese Aussage ist nicht korrekt! Die Angaben reichen aus, um die IRR schätzen zu können.',
      },
    ],
  },
]

export const LEARNING_ELEMENTS = [
  {
    id: '1f8178ab-a69a-4994-b292-5c56bea6defa',
    name: 'BFI MC 1',
    displayName: 'BFI Modul 1 - Lernfragen',
    questions: [0, 1, 2, 3, 4],
  },
  {
    id: 'c35cf70c-2ff0-4568-84b3-00dbadadd68b',
    name: 'BFI MC 2',
    displayName: 'BFI Modul 2 - Lernfragen',
    questions: range(10, 30),
  },
]

export const SESSIONS = [
  {
    id: 'd18dfa3b-a965-4dc3-985f-6695e8a43113',
    name: 'BFI VL Woche 01',
    displayName: 'BFI Vorlesung - Woche 01',
    status: SessionStatus.RUNNING,
    blocks: [],
    linkTo: 'https://app.klicker.uzh.ch/join/bf1hs22',
  },
]

export const MICRO_SESSIONS = [
  {
    id: 'e3c71b0b-a8cf-43e9-8373-85a31673b178',
    name: 'BFI Micro Woche 01',
    displayName: 'BFI Microlearning - Woche 01',
    scheduledStartAt: new Date('2022-09-21T07:00:00.000Z'),
    scheduledEndAt: new Date('2022-09-22T09:00:00.000Z'),
    description: `
### Einführung

![](https://sos-ch-dk-2.exo.io/klicker-prod/img/microlearning_bf1_1.png)

Was ist Corporate Finance? Gemäss Damodaran umfasst die Corporate Finance alle Entscheidungen von Unternehmen, die finanzielle Auswirkungen haben. Diese umfassen u.a. Investitionsentscheide, Finanzierungsentscheide oder Dividendenentscheide.

Du lernst zudem das finanzwirtschaftliche Zieldreieck kennen, bei dem sich die Rentabilität, Liquidität und Sicherheit einander gegenüber stehen. Zudem lernst du das oberste Ziel der unternehmerischen Tätigkeit kennen, nämlich die langfristige Maximierung des Unternehmenswertes.
`,
    questions: [5, 6, 7, 8],
  },
]
