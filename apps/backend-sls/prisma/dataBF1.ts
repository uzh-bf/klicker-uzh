import Prisma from '@klicker-uzh/prisma'
const { AttachmentType, QuestionType, SessionStatus } = Prisma

export const PARTICIPANT_IDS = []

export const ATTACHMENTS = []

export const QUESTIONS = [
  {
    id: 0,
    name: 'Modul 1.1 Zieldreieck',
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
    name: 'Modul 1.1 Organisation des Finanzwesens',
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
    name: 'Modul 1.1 Stakeholder',
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
        feedback: 'Kunden',
        value: 'Falsch! Bei den Kunden handelt es sich um Stakeholder.',
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
    name: 'Modul 1.1 Bilanz',
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
    name: 'Modul 1.1 Grundfunktionen des Fremdkapitals',
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
    id: 10,
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

    name: 'Microlearning 1.2',
    content:
      'Welcher der folgenden Entscheidungsbereiche ist **nicht** Teil in der **Corporate Finance**?',
    contentPlain:
      'Welcher der folgenden Entscheidungsbereiche ist nicht Teil in der Corporate Finance?',
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
    id: 12,
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
    id: 13,
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
    id: 14,
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
    id: 
    name: 'Modul 2.1 Investitionsrechenverfahren',
    content:
      'Beurteile die folgenden Aussagen zu den **Investitionsrechenverfahren** auf ihre Richtigkeit.',
    contentPlain:
      'Beurteile die folgenden Aussagen zu den Investitionsrechenverfahren auf ihre Richtigkeit.',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value: 'Kosten, die unabhängig von der Ausbringungsmenge anfallen, nennt man fixe Kosten.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Mit der Rentabilitätsrechnung können sowohl mehrere Investitionsmöglichkeiten mit unterschiedlichem Kapitaleinsatz, als auch ein einzelnes Projekt beurteilt werden.',
        value: 'Der Einsatz der Rentabilitätsrechnung ist nur dann sinnvoll, wenn Investitionsvorhaben gleiche Kapitaleinsätze benötigen.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Es sind die dynamischen Verfahren, welche die zeitlich unterschiedlich anfallenden Zahlungsströme erfassen.',
        value: 'Der Unterschied zwischen den statischen und den dynamischen Investitionsrechenverfahren besteht darin, dass die statischen Verfahren die zeitlich unterschiedlich anfallenden Zahlungsströme der Nutzungsdauer zu erfassen versuchen.',
      },
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value: 'Die dynamischen Investitionsrechenverfahren versuchen einige Schwächen der statischen Methoden, wie z.B. die Periodenbegrenzung, zu beseitigen.',
      },
    ],
  },
  {

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
        value: 'Alte Anlagen werden durch neue ersetzt, um anstelle der alten neue Produkte herzustellen.',
        feedback:
          'Diese Aussage ist nicht korrekt! Diese Art von Investition wird Umstellungsinvestition genannt.',
      },
      {
        value: 'Neue Anlagen werden beschafft, um das Leistungspotential in quantitativer Hinsicht zu vergrössern.',
        feedback:
          'Diese Aussage ist nicht korrekt! Diese Art von Investition wird Erweiterungsinvestition genannt.',
      },
      {
        value: 'Zusätzlich zu den bisherigen Leistungen werden neue erbracht, die in das bestehende Produktionsprogramm passen.',
        feedback:
          'Diese Aussage ist nicht korrekt! Diese Art von Investition wird Diversifikationsinvestition genannt.',
      },
      {
        correct: true,
        value: 'Noch funktionierende Anlagen werden ausgewechselt um beispielsweise Kosten zu sparen.',
        feedback:
          'Diese Aussage ist korrekt! Des Weiteren besteht die Möglichkeit, mit neuen Maschinen qualitativ bessere Produkte herzustellen und so die Verkaufspreise zu erhöhen.',
      },
    ],
  },
  {

    name: 'Modul 2.1 Rentabilitätsberechnung',
    content:
      'Man erwartet, dass ein Projekt einen Gewinn von insgesamt 50`000 CHF generieren wird. Für den Kauf einer dazu benötigten Maschine müssen 600`000 CHF aufgewendet werden. Am Ende der Nutzungsdauer wird diese Maschine wieder verkauft. Man erwartet daraus einen Erlös von 300`000 CHF.
      Wie hoch ist die **(Gesamtkapital-)** Rentabilität dieses Projektes?',
    contentPlain:
      'Man erwartet, dass ein Projekt einen Gewinn von insgesamt 50`000 CHF generieren wird. Für den Kauf einer dazu benötigten Maschine müssen 600`000 CHF aufgewendet werden. Am Ende der Nutzungsdauer wird diese Maschine wieder verkauft. Man erwartet daraus einen Erlös von 300`000 CHF.
      Wie hoch ist die (Gesamtkapital-) Rentabilität dieses Projektes?',
    type: QuestionType.SC,
    choices: [
      {
        value: '3,7 %',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      {
        correct: true, 
        value: '11,1 %',
        feedback:
          'Diese Aussage ist korrekt!',
      },
      {
        value: '26,8 %',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      {
        value: '34,5 %',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      {
        value: '79,6 %',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
    ],
  },
  {
    id: 
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
        value: 'Mit Hilfe der Amortisationsrechnung kann man die Grösse der jährlichen Zahlungsströme ermitteln, die notwendig sind, um ein betrachtetes Investitionsprojekt bis zum Ende seiner Nutzungsdauer vollständig zu amortisieren.',
      },
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value: 'Mit Hilfe der Amortisationsrechnung kann man die Anzahl der Jahre bestimmen, die es dauert, bis ein Projekt bei gegebener Rendite vollständig amortisiert wird.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Mit Hilfe der Amortisationsrechnung kann die Anzahl Jahre bestimmt werden, die es braucht, bis der Investitionsbetrag durch die jährlichen Einzahlungsüberschüsse zurückbezahlt werden kann.',
        value: 'Mit Hilfe der Amortisationsrechnung kann man die Anzahl der Projekte bestimmen, die es braucht, um eine von der Unternehmung vorgegebene Gewinnschwelle (Break-Even-Punkt) zu überschreiten.',
      },
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value: 'Mit Hilfe der Amortisationsrechnung kann man das Risiko mitberücksichtigen: Je länger die Wiedergewinnungszeit, umso grösser ist das Risiko, dass sich die Investition nicht bezahlt macht.',
      },
    ],
  },
  {

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
        value: 'CHF 100 sind morgen gleich viel wert wie heute, sowohl real wie auch nominal.',
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
        feedback:
          'Diese Aussage ist korrekt! Diskontieren nicht vergessen!',
      },
      {
        value: 'CHF 100 sind morgen nominal mehr wert als heute.',
        feedback:
          'Diese Aussage ist nicht korrekt! Die zentrale Annahme der NPV-Methode ist, dass CHF 100 heute real mehr wert sind als CHF 100 morgen.',
      },
    ],
  },
  {

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
        feedback:
          'Diese Aussage ist korrekt!',
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
    id: 
    name: 'Modul 2.2 Unterjährige Verzinsung 1',
    content:
      'Du sollst ein Vermögen von 10000 CHF für ein Jahr anlegen und hast die Auswahl zwischen folgenden Anlagen:

      A) Anlage zu 4.8%, vierteljährliche Verzinsung
      
      B) Anlage zu 5%, jährliche Verzinsung
      
      C) Anlage zu 5%, halbjährliche Verzinsung
      
      D) Anlage zu 4.8%, halbjährliche Verzinsung
      
      Beurteile **folgende Aussagen** zu den verschiedenen Anlagen auf ihre **Richtigkeit**.',
    contentPlain:
      'Du sollst ein Vermögen von 10000 CHF für ein Jahr anlegen und hast die Auswahl zwischen folgenden Anlagen:

      A) Anlage zu 4.8%, vierteljährliche Verzinsung
      
      B) Anlage zu 5%, jährliche Verzinsung
      
      C) Anlage zu 5%, halbjährliche Verzinsung
      
      D) Anlage zu 4.8%, halbjährliche Verzinsung
      
      Beurteile folgende Aussagen zu den verschiedenen Anlagen auf ihre Richtigkeit.',
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
        feedback:
          'Diese Aussage ist nicht korrekt!',
        value: 'Anlage A) ist die rentabelste Anlage.',
      },
    ],
  },
  {

    name: 'Modul 2.2 Unterjährige Verzinsung 2',
    content:
      'Deine Bank zahlt Dir einen halbjährlich festgelegten Zinssatz von 4% per annum.

      Was ist der äquivalente **effektive Jahreszins**?',
    contentPlain:
      'Deine Bank zahlt Dir einen halbjährlich festgelegten Zinssatz von 4% per annum.

      Was ist der äquivalente effektive Jahreszins?',
    type: QuestionType.SC,
    choices: [
      {
        value: '8.16%',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      { 
        value: '2.00%',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      {
        correct: true,
        value: '4.04%',
        feedback:
          'Diese Aussage ist korrekt!',
      },
      {
        value: '4.00%',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
    ],
  },
  {

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

    name: 'Modul 2.3 Dynamische Methode',
    content:
      'Vier ehemalige Jus-Studenten gründen zusammen eine Anwaltskanzlei. In 5 Jahren wird einer von ihnen auf eine Weltreise gehen und deshalb die Kanzlei verlassen. Der austretende Gesellschafter bekommt dafür in 5 Jahren vertraglich zugesicherte 125'000 CHF. Wie gross ist sein **heutiger Anteil am Unternehmen** bzw. muss er zum Gründungskapital beitragen, wenn wir von einem jährlich konstanten Zinssatz von 10% ausgehen?
      (Gerundet auf ganze Franken)',
    contentPlain:
      'Vier ehemalige Jus-Studenten gründen zusammen eine Anwaltskanzlei. In 5 Jahren wird einer von ihnen auf eine Weltreise gehen und deshalb die Kanzlei verlassen. Der austretende Gesellschafter bekommt dafür in 5 Jahren vertraglich zugesicherte 125'000 CHF. Wie gross ist sein heutiger Anteil am Unternehmen bzw. muss er zum Gründungskapital beitragen, wenn wir von einem jährlich konstanten Zinssatz von 10% ausgehen?
      (Gerundet auf ganze Franken)',
    type: QuestionType.SC,
    choices: [
      {
        value: '70 559 CHF',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      { 
        correct: true,
        value: '77 615 CHF',
        feedback:
          'Diese Aussage ist korrekt! Der korrekte Lösungsweg ist: K0 = CHF 125 000 / ((1+0,1)^5) = 77 615 CHF',
      },
      {
        value: '85 377 CHF',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      {
        value: '183 013 CHF',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      {
        value: '201 313 CHF',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
    ],
  },
  {

    name: 'Modul 2.3 Dynamische Methode (Faktoren)',
    content:
      'Der ………… multipliziert mit dem Endwert K n  ermittelt den Barwert K 0  des Endkapitals K n , d.h. der spätere Wert K n  wird auf den früheren Wert K 0  um n Jahre unter Abzug von Zinseszinsen zurückdatiert.',
    contentPlain:
      'Der ………… multipliziert mit dem Endwert K n  ermittelt den Barwert K 0  des Endkapitals K n , d.h. der spätere Wert K n  wird auf den früheren Wert K 0  um n Jahre unter Abzug von Zinseszinsen zurückdatiert.',
    type: QuestionType.SC,
    choices: [
      {
        value: 'Rentenbarwertfaktor',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      { 
        value: 'Annuitätenfaktor',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      {
        value: 'Aufzinsungsfaktor',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      {
        correct: true,
        value: 'Abzinsungsfaktor',
        feedback:
          'Diese Aussage ist korrekt!',
      },
      {
        value: 'Wiedergewinnungsfaktor',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
    ],
  },
  {
    id: 
    name: 'Modul 2.3 Dynamische Verfahren',
    content:
      'Beurteile die folgenden Aussagen zum **dynamischen Verfahren** auf ihre Richtigkeit.',
    contentPlain:
      'Beurteile die folgenden Aussagen zum dynamischen Verfahren auf ihre Richtigkeit.',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist korrekt!',
          correct: true,
        value: 'Die dynamischen Verfahren setzen mathematische Grundkenntnisse voraus, da sie auf der Rechentechnik des Auf- und Abzinsens basieren.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Dies ist bei den statischen Verfahren der Fall. Bei den dynamischen Verfahren werden Aus- und Einzahlungen als Rechnungselemente verwendet.',
        value: 'Die dynamischen Verfahren benutzen meist Kosten und Leistungen statt Aufwendungen und Erträge als Rechnungselemente.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Gerade umgekehrt, sie werden heute vorwiegend in Grossunternehmen eingesetzt, im Gegensatz zu den statischen Verfahren.',
        value: 'Die dynamischen Verfahren werden heutzutage bei Grossunternehmen immer seltener angewendet.',
      },
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value: 'Bei den dynamischen Verfahren wird nicht mit Durchschnittswerten gerechnet, sondern mit Zahlungsströmen, die während der ganzen Nutzungsdauer der Investition auftreten.',
      },
    ],
  },
  {
    id: 
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
        value: 'Die dynamische Investitionsrechnung betrachtet nur einen Teil der Nutzungsdauer eines Investitionsobjektes.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Das macht die Kostenrechnung. Die Investitionsrechnung betrachtet nur einzelne Objekte.',
        value: 'Die dynamische Investitionsrechnung bezieht sich auf den Betrieb als Ganzes.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Das macht die Kostenrechnung. Die Investitionsrechnung dient der Vorteilhaftigkeitsbestimmung eines Investitionsobjektes.',
        value: 'Die dynamische Investitionsrechnung dient der Steuerung und Kontrolle des ganzen Betriebes.',
      },
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value: 'Die dynamische Investitionsrechnung basiert auf Ein- und Auszahlungen.',
      },
    ],
  },
  {
    id: 
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
        value: 'Eine Investition ist stets dann vorteilhaft, wenn sie sich zum internen Zinssatz i verzinst.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Erst wenn die Summe aller diskontierten Zahlungsströme positiv ist, lohnt sich eine Investition in dieses Objekt.',
        value: 'Eine Investition ist stets dann vorteilhaft, wenn die Anschaffungsauszahlung wieder gewonnen wird.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Erst wenn die Summe aller diskontierten Zahlungsströme positiv ist, lohnt sich eine Investition in dieses Objekt.',
        value: 'Eine Investition ist stets dann vorteilhaft, wenn alle Auszahlungen wieder eingenommen werden.',
      },
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value: 'Eine Investition ist stets dann vorteilhaft, wenn der Kalkulationszinsfuss unter dem internen Zinssatz liegt.',
      },
    ],
  },
  {

    name: 'Modul 2.3 Net Present Value I',
    content:
      'Was stellt der **Net Present Value (NPV)** einer Investition dar?',
    contentPlain:
      'Was stellt der Net Present Value (NPV) einer Investition dar?',
    type: QuestionType.SC,
    choices: [
      {
        value: 'Differenz aus den abgezinsten Erträgen und Aufwendungen einer Investition.',
        feedback:
          'Diese Aussage ist nicht korrekt! Es stellt die Differenz aus den abgezinsten Einzahlungen und Auszahlungen einer Investition dar.',
      },
      { 
        value: 'Differenz der aufgezinsten Erträge und Aufwendungen einer Investition.',
        feedback:
          'Diese Aussage ist nicht korrekt! Es stellt die Differenz aus den abgezinsten Einzahlungen und Auszahlungen einer Investition dar.',
      },
      {
        correct: true, 
        value: 'Differenz aus den abgezinsten Einzahlungen und Auszahlungen einer Investition.',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      {
        value: 'Differenz aus dem abgezinsten Reingewinn und den stillen Reserven einer Investition.',
        feedback:
          'Diese Aussage ist nicht korrekt! Es stellt die Differenz aus den abgezinsten Einzahlungen und Auszahlungen einer Investition dar.',
      },
      {
        value: 'Differenz aus dem aufgezinsten Reingewinn und den stillen Reserven einer Investition.',
        feedback:
          'Diese Aussage ist nicht korrekt! Es stellt die Differenz aus den abgezinsten Einzahlungen und Auszahlungen einer Investition dar.',
      },
    ],
  },
  {

    name: 'Modul 2.3 Net Present Value II',
    content:
      'Sie wollen eine neue Stanzmaschine kaufen, dabei stehen drei verschiedene Typen zur Auswahl. Alle drei Maschinen kosten gleich viel (Kaufpreis CHF 230000) und werden total in 5 Jahren gleich viel Gewinn erwirtschaften (CHF 300000). Nur fallen die einzelnen Jahresgewinne der einzelnen Maschinen unterschiedlich an. Nach 5 Jahren müssen alle Maschinen wieder ersetzt werden.
      Welche Maschine hat den **höchsten Kapitalwert (Net Present Value)**? Nehmen Sie an, es herrscht ein jährlich konstanter Zins von 10%.
      (gerundet auf ganze Franken)?',
    contentPlain:
      'Sie wollen eine neue Stanzmaschine kaufen, dabei stehen drei verschiedene Typen zur Auswahl. Alle drei Maschinen kosten gleich viel (Kaufpreis CHF 230000) und werden total in 5 Jahren gleich viel Gewinn erwirtschaften (CHF 300000). Nur fallen die einzelnen Jahresgewinne der einzelnen Maschinen unterschiedlich an. Nach 5 Jahren müssen alle Maschinen wieder ersetzt werden.
      Welche Maschine hat den höchsten Kapitalwert (Net Present Value)? Nehmen Sie an, es herrscht ein jährlich konstanter Zins von 10%.
      (gerundet auf ganze Franken)',
    type: QuestionType.SC,
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

    name: 'Modul 2.3 Net Present Value III',
    content:
      'Wie **hoch** ist der **Net Present Value** der folgenden Cash-flows bei einem Zinssatz von 5%?',
    contentPlain:
      'Wie **hoch** ist der **Net Present Value** der folgenden Cash-flows bei einem Zinssatz von 5%?',
    type: QuestionType.SC,
    choices: [
      {
        value: '88.19 CHF',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      { 
        value: '39.21 CHF',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      {
        value: '83.99 CHF',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      {
        correct: true,
        value: '41.18 CHF',
        feedback:
          'Diese Aussage ist korrekt!',
      },
      {
        value: 'Die Angaben reichen für die Berechnung nicht aus.',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
    ],
  },
  {

    name: 'Modul 2.3 Interner Zinssatz I',
    content:
      'Die **IRR** (Methode des internen Zinssatzes) stellt …',
    contentPlain:
      'Die IRR (Methode des internen Zinssatzes) stellt …',
    type: QuestionType.SC,
    choices: [
      {
        value: '… die maximale Rendite dar, die mit einem Projekt erzielt werden kann.',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      { 
        value: '… die langfristig erzielte Gesamtkapitalrendite einer Unternehmung dar.',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      {
        value: '… den durchschnittlichen Zins dar, zu dem eine Unternehmung Kapital für ein Projekt aufnehmen kann.',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      {
        correct: true,
        value: '… den maximalen Kapitalkostensatz dar, bei dem ein Projekt gerade noch einen NPV von 0 generiert.',
        feedback:
          'Diese Aussage ist korrekt! Mit Hilfe der IRR kann bestimmt werden, welches der maximale Kapitalkostensatz ist, bei dem ein Projekt gerade noch einen NPV von 0 generiert.',
      },
      {
        value: '… die maximale Rendite dar, die ein Projekt erzielen muss, um gerade noch einen NPV von Null zu generieren.',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
    ],
  },
  {
    id: 
    name: 'Modul 2.3 Interner Zinssatz II',
    content:
      'Beurteile folgende Aussagen zum **internen Zinssatz** auf Ihre Richtigkeit:',
    contentPlain:
      'Beurteile folgende Aussagen zum internen Zinssatz auf Ihre Richtigkeit:',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value: 'Der interne Zinssatz einer Investition unterscheidet sich in aller Regel von der statisch ermittelten Rentabilität, weil das Auf- und Abzinsen berücksichtigt wird.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Der interne Zinssatz ist derjenige Zinssatz, bei dem sich gerade ein Kapitalwert von K=0 ergibt.',
        value: 'Der interne Zinssatz einer Investition ist gleich Null, falls der Kapitalwert der Investition Null ist.',
      },
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value: 'Im Rahmen der Annuitätenmethode ermittelt man die durchschnittlich jährlichen Ein- und Auszahlungen und/oder den durchschnittlich jährlichen Überschuss.',
      },
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value: 'Wenn der durchschnittlich jährliche Überschuss einer Investition gleich Null ist, dann stimmen Kalkulationszinssatz und interner Zinssatz überein.',
      },
    ],
  },
  {

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
        feedback:
          'Diese Aussage ist korrekt!',
      },
      {
        value: 'Die Angaben reichen für die Berechnung der IRR nicht aus.',
        feedback:
          'Diese Aussage ist nicht korrekt! Die Angaben reichen aus, um die IRR schätzen zu können.',
      },
    ],
  },
  {

    name: 'Modul 3.1 Beteiligungsfinanzierung',
    content:
      'Die **Beteiligungsfinanzierung** ist eine Form der …',
    contentPlain:
      'Die Beteiligungsfinanzierung ist eine Form der …',
    type: QuestionType.SC,
    choices: [
      {
        correct: true,
        value: '… Aussenfinanzierung.',
        feedback:
          'Diese Aussage ist korrekt! Bei der Beteiligungsfinanzierung wird das Kapital durch die Eigentümer als Beteiligungskapital zur Verfügung gestellt.',
      },
      { 
        value: '… Selbstfinanzierung.',
        feedback:
          'Diese Aussage ist nicht korrekt! Die Selbstfinanzierung ist eine Form der Innenfinanzierung. Dabei findet eine Finanzierung über die Zurückbehaltung von erzielten Gewinnen statt.',
      },
      {
        value: '… Innenfinanzierung.',
        feedback:
          'Diese Aussage ist nicht korrekt! Die Beteiligungsfinanzierung zählt zur Aussenfinanzierung.',
      },
      {
        value: '… Kreditfinanzierung.',
        feedback:
          'Diese Aussage ist nicht korrekt! Die Kredifinanzierung ist eine Form der Fremdfinanzierung und die Beteiligungsfinanzierung gehört zum Eigenkapital.',
      },
      {
        value: '… Finanzierung aus Abschreibungsrückflüssen.',
        feedback:
          'Diese Aussage ist nicht korrekt! Die Finanzierung aus Abschreibrückflüssen ist eine Form der Verflüssigungsfinanzierung.',
      },
    ],
  },
  {

    name: 'Modul 3.1 Eigenfinanzierungsgrad',
    content:
      'Was bezeichnet der sogenannte **Eigenfinanzierungsgrad**?',
    contentPlain:
      'Was bezeichnet der sogenannte Eigenfinanzierungsgrad?',
    type: QuestionType.SC,
    choices: [
      {
        value: 'Die Zuwachsquote des Eigenkapitals im Vergleich zum Vorjahr.',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      { 
        value: 'Der Anteil an Investitionen, der durch den erwirtschafteten Gewinn des Unternehmens bestritten wird.',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      {
        value: 'Der Anteil des Fremdkapitals zum Eigenkapital.',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      {
        correct: true,
        value: 'Der Anteil des Eigenkapitals am gesamten Kapital, mit dem ein Unternehmen arbeitet.',
        feedback:
          'Diese Aussage ist korrekt!',
      },
      {
        value: 'Der Anteil des Gewinnes am durchschnittlichen Eigenkapital.',
        feedback:
          'Diese Aussage ist nicht korrekt! Das ist die Eigenkapitalrentabilität.',
      },
    ],
  },
  {

    name: 'Modul 3.1 Aktienkapitalerhöhung',
    content:
      'Das Aktienkapital einer Unternehmung wird von bisher 7.5 Mio. CHF auf 10 Mio. CHF erhöht. Der Nennwert der neuen Aktien beträgt wie bei den alten Aktien CHF 25. Der Emissionspreis wird bei CHF 1500 festgesetzt. Vor der Aktienkapitalerhöhung notierten die alten Aktien bei CHF 1600. Bei welchem Preis wird die Aktie nach der Erhöhung notieren?',
    contentPlain:
      'Das Aktienkapital einer Unternehmung wird von bisher 7.5 Mio. CHF auf 10 Mio. CHF erhöht. Der Nennwert der neuen Aktien beträgt wie bei den alten Aktien CHF 25. Der Emissionspreis wird bei CHF 1500 festgesetzt. Vor der Aktienkapitalerhöhung notierten die alten Aktien bei CHF 1600. Bei welchem Preis wird die Aktie nach der Erhöhung notieren?',
    type: QuestionType.SC,
    choices: [
      {
        value: 'CHF 1475',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      { 
        value: 'CHF 1500',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      {
        correct: true,
        value: 'CHF 1575',
        feedback:
          'Diese Aussage ist korrekt!',
      },
      {
        value: 'CHF 1625',
        feedback:
          'Diese Aussage ist korrekt!',
      },
      {
        value: 'CHF 1650',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
    ],
  },
  {

    name: 'Modul 3.1 Mindestnominalwert von Aktien',
    content:
      'Der Nominalwert einer Aktie muss in der Schweiz mindestens …',
    contentPlain:
      'Der Nominalwert einer Aktie muss in der Schweiz mindestens …',
    type: QuestionType.SC,
    choices: [
      {
        correct: true,
        value: '… 1 Rappen betragen.',
        feedback:
          'Diese Aussage ist korrekt! Seit Mai 2001 muss der minimale Nominalwert einer Aktie nur noch einen Rappen betragen.',
      },
      { 
        value: '… 10 Rappen betragen.',
        feedback:
          'Diese Aussage ist nicht korrekt! Seit Mai 2001 liegt der minimale Nominalwert einer Aktie bei einem Rappen. Zuvor lag dieser Betrag bei CHF 10.',
      },
      {
        value: '… CHF 1 betragen.',
        feedback:
          'Diese Aussage ist nicht korrekt! Seit Mai 2001 liegt der minimale Nominalwert einer Aktie bei einem Rappen. Zuvor lag dieser Betrag bei CHF 10.',
      },
      {
        value: '… CH 10 betragen.',
        feedback:
          'Diese Aussage ist nicht korrekt! Seit Mai 2001 liegt der minimale Nominalwert einer Aktie bei einem Rappen. Zuvor lag dieser Betrag bei CHF 10.',
      },
      {
        value: '… CHF 100 betragen.',
        feedback:
          'Diese Aussage ist nicht korrekt! Seit Mai 2001 liegt der minimale Nominalwert einer Aktie bei einem Rappen. Zuvor lag dieser Betrag bei CHF 10.',
      },
    ],
  },
  {

    name: 'Modul 3.1 Vinkulierung',
    content:
      'Durch Vinkulierung können unerwünschte Aktionäre von der Ausübung der Mitgliedschaftsrechte ausgeschlossen werden. Die Vinkulierung kann angewendet werden auf …',
    contentPlain:
      'Durch Vinkulierung können unerwünschte Aktionäre von der Ausübung der Mitgliedschaftsrechte ausgeschlossen werden. Die Vinkulierung kann angewendet werden auf …',
    type: QuestionType.SC,
    choices: [
      {
        correct: true,
        value: '… Namenaktien.',
        feedback:
          'Diese Aussage ist korrekt!',
      },
      { 
        value: '… Inhaberaktien.',
        feedback:
          'Diese Aussage ist nicht korrekt! Nur Namenaktien können vinkuliert werden. Inhaberaktien können durch blosse Übergabe übertragen werden.',
      },
      {
        value: '… Optionen.',
        feedback:
          'Diese Aussage ist nicht korrekt! Nur Namenaktien können vinkuliert werden.',
      },
      {
        value: '… Partizipationsscheine.',
        feedback:
          'Diese Aussage ist nicht korrekt! Nur Namenaktien können vinkuliert werden. Partizipationsscheine beinhalten ohnehin kein Stimmrecht.',
      },
      {
        value: '… Bezugsrechte.',
        feedback:
          'Diese Aussage ist nicht korrekt! Nur Namenaktien können vinkuliert werden.',
      },
    ],
  },
  {

    name: 'Modul 3.1 Kapitalerhöhung',
    content:
      'Die Anwaltskanzlei AG hat einen Unternehmenswert (netto) von 10 Millionen CHF. Diese Aktiengesellschaft hat 10000 Aktien, auf welchen eine Dividende von 30 CHF pro Titel ausbezahlt wird. Die Anwaltskanzlei AG möchte die Dividendenzahlung vollumfänglich über eine Aktienkapitalerhöhung finanzieren (neue Aktien bekommen noch keine Dividenden). Der Emissionspreis ist gleich dem Marktpreis und es herrscht ein perfekter Kapitalmarkt. Wie viele neue Aktien müssen emittiert werden?',
    contentPlain:
      'Die Anwaltskanzlei AG hat einen Unternehmenswert (netto) von 10 Millionen CHF. Diese Aktiengesellschaft hat 10000 Aktien, auf welchen eine Dividende von 30 CHF pro Titel ausbezahlt wird. Die Anwaltskanzlei AG möchte die Dividendenzahlung vollumfänglich über eine Aktienkapitalerhöhung finanzieren (neue Aktien bekommen noch keine Dividenden). Der Emissionspreis ist gleich dem Marktpreis und es herrscht ein perfekter Kapitalmarkt. Wie viele neue Aktien müssen emittiert werden?',
    type: QuestionType.SC,
    choices: [
      {
        value: '300 Stück',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      { 
        correct: true, 
        value: '309 Stück',
        feedback:
          'Diese Aussage ist korrekt! Der Wert der Aktie nach der Dividendenzahlung = (10 Mio./10000 Stück)- 30 CHF = 970 CHF. Zur Finanzierung der Dividendenzahlungen von 300000 CHF braucht es 309 neue Aktien = (300000 CHF / 970 CHF) = 309 Stück.',
      },
      {
        value: '400 Stück',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      {
        value: '570 Stück',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      {
        value: '638 Stück',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
    ],
  },
  {

    name: 'Modul 3.1 Agio',
    content:
      'Was versteht man im Zusammenhang mit Aktien unter einem **Agio**?',
    contentPlain:
      'Was versteht man im Zusammenhang mit Aktien unter einem Agio?',
    type: QuestionType.SC,
    choices: [
      {
        correct: true, 
        value: 'Differenz zwischen dem Ausgabekurs und dem Nennwert einer Aktie.',
        feedback:
          'Diese Aussage ist korrekt! Daher bezeichnet man das Agio auch als Emissionsagio.',
      },
      {  
        value: 'Differenz zwischen dem Nennwert einer Aktie und dem Börsenkurs.',
        feedback:
          'Diese Aussage ist nicht korrekt! Als Agio bezeichnet man die Differenz zwischen dem Ausgabekurs und dem Nennwert einer Aktie.',
      },
      {
        value: 'Differenz zwischen dem Ausgabekurs und dem Börsenkurs.',
        feedback:
          'Diese Aussage ist nicht korrekt! Als Agio bezeichnet man die Differenz zwischen dem Ausgabekurs und dem Nennwert einer Aktie.',
      },
      {
        value: 'Differenz zwischen dem Ausgabekurs und dem Schlusskurs der Aktie an deren ersten Handelstag an der Börse.',
        feedback:
          'Diese Aussage ist nicht korrekt! Als Agio bezeichnet man die Differenz zwischen dem Ausgabekurs und dem Nennwert einer Aktie.',
      },
      {
        value: 'Differenz zwischen dem höchsten und tiefsten Aktienkurs.',
        feedback:
          'Diese Aussage ist nicht korrekt! Als Agio bezeichnet man die Differenz zwischen dem Ausgabekurs und dem Nennwert einer Aktie.',
      },
    ],
  },
  {

    name: 'Modul 3.1 genehmigte Kapitalerhöhung',
    content:
      'Innerhalb welcher Zeitspanne muss eine genehmigte Kapitalerhöhung durchgeführt werden?',
    contentPlain:
      'Innerhalb welcher Zeitspanne muss eine genehmigte Kapitalerhöhung durchgeführt werden?',
    type: QuestionType.SC,
    choices: [
      {
        value: 'Es existiert keine „Deadline“, in welcher eine Kapitalerhöhung durchführt werden muss.',
        feedback:
          'Diese Aussage ist nicht korrekt! Die genehmigte Kapitalerhöhung ist innert einer Frist von maximal 2 Jahren durchzuführen. Das genehmigte Kapital ist auf die Hälfte des bisherigen Aktienkapitals limitiert (OR 651 ff.).',
      },
      {  
        value: 'Innerhalb 30 Tagen.',
        feedback:
          'Diese Aussage ist nicht korrekt! Die genehmigte Kapitalerhöhung ist innert einer Frist von maximal 2 Jahren durchzuführen. Das genehmigte Kapital ist auf die Hälfte des bisherigen Aktienkapitals limitiert (OR 651 ff.).',
      },
      {
        value: 'Innerhalb eines Jahres.',
        feedback:
          'Diese Aussage ist nicht korrekt! Die genehmigte Kapitalerhöhung ist innert einer Frist von maximal 2 Jahren durchzuführen. Das genehmigte Kapital ist auf die Hälfte des bisherigen Aktienkapitals limitiert (OR 651 ff.).',
      },
      {
        correct: true, 
        value: 'Innerhalb der nächsten 2 Jahre.',
        feedback:
          'Diese Aussage ist korrekt! Das genehmigte Kapital ist auf die Hälfte des bisherigen Aktienkapitals limitiert (OR 651 ff.).',
      },
      {
        value: 'Innerhalb der nächsten 3 Jahre.',
        feedback:
          'Diese Aussage ist nicht korrekt! Die genehmigte Kapitalerhöhung ist innert einer Frist von maximal 2 Jahren durchzuführen. Das genehmigte Kapital ist auf die Hälfte des bisherigen Aktienkapitals limitiert (OR 651 ff.).',
      },
    ],
  },
  {

    name: 'Modul 3.1 Bezugsrecht I',
    content:
      'Die Anwaltskanzlei AG möchte pro acht alte Aktien eine neue Aktie emittieren: Börsenkurs der alten beträgt 178 CHF und der Ausgabepreis der neuen Aktie beträgt 160 CHF. Welchen Wert hat das Bezugsrecht?',
    contentPlain:
      'Die Anwaltskanzlei AG möchte pro acht alte Aktien eine neue Aktie emittieren: Börsenkurs der alten beträgt 178 CHF und der Ausgabepreis der neuen Aktie beträgt 160 CHF. Welchen Wert hat das Bezugsrecht?',
    type: QuestionType.SC,
    choices: [
      {
        correct: true, 
        value: '2 CHF',
        feedback:
          'Diese Aussage ist korrekt! Lösungsweg: S = Börsenkurs alt, X = Ausgabepreis der Aktien, a = Anz. alte Aktien, n = Anz. neue Aktien. Bezugsrecht = (S-X) / ((a/j)+1) = (178-160) / ((8/1)+1) = 2.0',
      },
      {  
        value: '2.1 CHF',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      {
        value: '2.2 CHF',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      {
        value: '2.3 CHF',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      {
        value: '2.5 CHF',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
    ],
  },
  {

    name: 'Modul 3.1 Bezugsrecht II',
    content:
      'Ein Unternehmen führt eine Kapitalerhöhung durch und gibt dabei 100000 neue Aktien aus. Nach der Kapitalerhöhung sind insgesamt 500000 Aktien ausstehend. Der Emissionspreis für die neuen Aktien beträgt 325 CHF, während der Kurs vor der Kapitalerhöhung 364 CHF war. Welchen  **Wert**  hat das  **Bezugsrecht**?',
    contentPlain:
      'Ein Unternehmen führt eine Kapitalerhöhung durch und gibt dabei 100000 neue Aktien aus. Nach der Kapitalerhöhung sind insgesamt 500000 Aktien ausstehend. Der Emissionspreis für die neuen Aktien beträgt 325 CHF, während der Kurs vor der Kapitalerhöhung 364 CHF war. Welchen  Wert  hat das  Bezugsrecht?',
    type: QuestionType.SC,
    choices: [
      {
        value: '6.50 CHF',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      {  
        value: '31.20 CHF',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      {
        value: '39.00 CHF',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      {
        correct: true, 
        value: '7.80 CHF',
        feedback:
          'Diese Aussage ist korrekt! Lösungsweg: Wert Bezugsrecht = (364-325)/((4/1)+1) = 7.8',
      },
      {
        value: 'Die Angaben reichen für die Berechnung nicht aus.',
        feedback:
          'Diese Aussage ist nicht korrekt! Die Angaben reichen aus.',
      },
    ],
  },
  {
     
    name: 'Modul 3.1 Selbstfinanzierung',
    content:
      'Beurteile die folgenden Aussagen zur **Selbstfinanzierung** auf ihre Richtigkeit.',
    contentPlain:
      'Beurteile die folgenden Aussagen zur Selbstfinanzierung auf ihre Richtigkeit.',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Die Selbstfinanzierung wirkt sich nicht auf das Aktienkapital einer Unternehmung aus. Finanziert sich eine Unternehmung selbst, so wirkt sich dies auf ihr Eigenkapital aus: Der Verzicht auf die Gewinnausschüttung erhöht die Reserven.',
        value: 'Durch Selbstfinanzierung erhöht sich das Aktienkapital einer Unternehmung.',
      },
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true, 
        value: 'Ohne Selbstfinanzierung kann eine Unternehmung langfristig nicht wachsen.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Unter Selbstfinanzierung versteht man die Kapitalbeschaffung mittels Verzicht auf Gewinnausschüttung. Abschreibungsgegenwerte dienen der Finanzierung von Ersatzinvestitionen.',
        value: 'Eine Unternehmung kann sich anhand von Abschreibungsgegenwerten selbst finanzieren.',
      },
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value: 'Werden Dividenden ausgeschüttet, so stehen der Unternehmung weniger Mittel zur Verfügung, sich selbst zu finanzieren.',
      },
    ],
  },
  {
     
    name: 'Modul 3.1 Kreditfinanzierung',
    content:
      'Beurteile die folgenden Aussagen zur **Kreditfinanzierung** bzw. zum **langfristigen Fremdkapital** auf ihre Richtigkeit.',
    contentPlain:
      'Beurteile die folgenden Aussagen zur Kreditfinanzierung bzw. zum langfristigen Fremdkapital auf ihre Richtigkeit.',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Bei einer Wandelanleihe besteht dieses Recht und nicht bei einer gewöhnlichen Anleihe.',
        value: 'Eine gewöhnliche Anleihe beinhaltet das Recht, während einer bestimmten Zeit zu einem festgelegten Verhältnis eine Obligation in Beteiligungspapiere umzuwandeln.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Die Kreditfinanzierung gehört zwar zur Außenfinanzierung, stärkt aber weder die Eigenkapitalbasis noch vermindert es den Leverage. Dies würde man durch die Selbstfinanzierung erreichen.',
        value: 'Die Kreditfinanzierung gehört zur Aussenfinanzierung. Diese stärkt die Eigenkapitalbasis und vermindert den Leverage.',
      },
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true, 
        value: 'Eine Anleihensobligation ist eine Teilschuldverschreibung einer grösseren, in der Regel langfristigen Anleihe.',
      },
      {
        feedback:
          'Diese Aussage ist korrekt!',
        correct: true,
        value: 'Die Höhe des Zinssatzes ist abhängig von der Bonität des Schuldners, der Laufzeit der Obligation und den Kapitalmarktverhältnissen im Zeitpunkt der Ausgabe einer Obligationenanleihe.',
      },
    ],
  },
  {

    name: 'Modul 3.1 Kapitalbindung',
    content:
      'Welche der folgenden Aussagen zur **Kapitalbedarfsrechnung für das Umlaufvermögen** ist **richtig**?',
    contentPlain:
      'Welche der folgenden Aussagen zur Kapitalbedarfsrechnung für das Umlaufvermögen ist richtig?',
    type: QuestionType.SC,
    choices: [
      {
        correct: true, 
        value: 'Je länger die Kreditorenfrist ist, desto kürzer wird der Kapitalbedarf ausfallen, da das Rohmaterial später bezahlt werden muss.',
        feedback:
          'Diese Aussage ist korrekt!',
      },
      {  
        value: 'Je kürzer die Debitorenfrist ist, desto länger wird der Kapitalbedarf ausfallen, da die Kunden ihre Rechnung später bezahlen.',
        feedback:
          'Diese Aussage ist nicht korrekt! Bei einer kürzeren Debitorenfrist müssen die Kunden ihre Rechnungen früher begleichen, was den Kapitalbedarf senkt.',
      },
      {
        value: 'Wenn die Produktionszeit um die Hälfte gekürzt werden kann, verringert sich auch der Kapitalbedarf um die Hälfte.',
        feedback:
          'Diese Aussage ist nicht korrekt! Bei der Ermittlung des Kapitalbedarfs für das Umlaufvermögen beeinflussen mehrere Faktoren wie zum Beispiel die durchschnittliche Lagerzeit, Produktionszeit, Lagerzeit der Fertiggüter, die Debitorenfrist sowie die Kreditorenfrist den Kapitalbedarf. Wird die Produktionszeit um die Hälfte gekürzt, kann der Kapitalbedarf nicht so stark verringert werden.',
      },
      {
        value: 'Die Lohnkosten spielen für die Berechnung des Kapitalbedarfs keine Rolle, wenn die Kreditorenfrist länger als die Zahlungsfrist der Löhne ist.',
        feedback:
          'Diese Aussage ist nicht korrekt! Zwischen der Kreditorenfrist und der Zahlungsfrist der Löhne besteht kein direkter Zusammenhang.',
      },
      {
        value: 'Keine der Aussagen ist korrekt.',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
    ],
  },
  {

    name: 'Modul 3.1 Bondpreis',
    content:
      'Folgende Werte einer Obligation sind gegeben: <BILD HIER> Wie **hoch** ist der heutige **Bondpreis**?',
    contentPlain:
      'Folgende Werte einer Obligation sind gegeben: <BILD HIER> Wie hoch ist der heutige Bondpreis?',
    type: QuestionType.SC,
    choices: [
      {
        value: '55.4%',
        feedback:
          'Diese Aussage ist nicht korrekt! Der theoretische Wert einer Obligation lässt sich durch die Diskontierung aller zukünftig anfallenden Coupon- und Tilgungszahlungen berechnen. Damit der Bondpreis unter 100% liegt, müsste der Marktzins über dem Coupon liegen.',
      },
      {  
        correct: true, 
        value: '100%',
        feedback:
          'Diese Aussage ist korrekt! Entspricht der Coupon gerade dem Marktzins, so ist der heutige Bondpreis genau 100%.',
      },
      {
        value: '180.6%',
        feedback:
          'Diese Aussage ist nicht korrekt! Der theoretische Wert einer Obligation lässt sich durch die Diskontierung aller zukünftig anfallenden Coupon- und Tilgungszahlungen berechnen.  Damit der Bondpreis über 100% liegt, müsste der Marktzins unter dem Coupon liegen.',
      },
      {
        value: '0%',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      {
        value: 'Die Angaben reichen nicht aus, um den Bondpreis zu berechnen.',
        feedback:
          'Diese Aussage ist nicht korrekt! Die Angaben reichen aus, um den Bondpreis zu berechnen.',
      },
    ],
  },
  {

    name: 'Modul 3.2 Leverage-Effekt I',
    content:
      'Aus unserer Bilanz der Anwaltskanzlei AG kann man folgende Zahlen entnehmen: Gesamtkapital von 1.5 Mio. CHF, Eigenkapital von 800000 CHF, Gesamtkapitalrendite von 10 % und einen Fremdkapitalzinssatz von 5 %. Wie gross ist die **Eigenkapitalrentabilität** der Anwaltskanzlei AG?',
    contentPlain:
      'Aus unserer Bilanz der Anwaltskanzlei AG kann man folgende Zahlen entnehmen: Gesamtkapital von 1.5 Mio. CHF, Eigenkapital von 800000 CHF, Gesamtkapitalrendite von 10 % und einen Fremdkapitalzinssatz von 5 %. Wie gross ist die Eigenkapitalrentabilität der Anwaltskanzlei AG?',
    type: QuestionType.SC,
    choices: [
      {
        value: '5 %',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      {  
        value: '7 %',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      {
        correct: true, 
        value: '14.4 %',
        feedback:
          'Diese Aussage ist korrekt! Lösungsweg: rEK = rGK + (FK/EK) * (rGK-rFK) = 0.1 + (700000/800000)*(0.1-0.05) = 14.4%.',
      },
      {
        value: '15.7 %',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
      {
        value: '19.4 %',
        feedback:
          'Diese Aussage ist nicht korrekt!',
      },
    ],
  },
  {

    name: 'Modul 3.2 Leverage-Effekt II',
    content:
      'Welche der folgenden Aussagen zum **Leverage Effekt** ist **falsch**?',
    contentPlain:
      'Welche der folgenden Aussagen zum Leverage Effekt ist falsch?',
    type: QuestionType.SC,
    choices: [
      {
        value: 'Wenn die Gesamtkapitalrendite den Fremdkapitalkosten entspricht, ist die Eigenkapitalrendite gleich der Gesamtkapitalrendite.',
        feedback:
          'Diese Aussage ist nicht korrekt! Aus der Formel des Rendite Leverage Effekts wird ersichtlich, dass der Wert in der Klammer null wird, wenn die Gesamtkapitalrendite den Fremdkapitalkosten entspricht und somit die Eigenkapitalrendite der Gesamtkapitalrendite entspricht.',
      },
      {  
        value: 'Die Gesamtkapitalrendite muss immer zwischen den Fremdkapitalkosten und der Eigenkapitalrendite liegen oder diesen entsprechen.',
        feedback:
          'Diese Aussage ist nicht korrekt! Die Gesamtkapitalrendite ist ein gewichteter Durchschnitt der Eigenkapitalrendite und der Fremdkapitalkosten und liegt damit immer zwischen oder ist gleich den beiden.',
      },
      {
        value: 'Auch wenn die Fremdkapitalkosten 0% betragen, tritt der Leverage Effekt auf.',
        feedback:
          'Diese Aussage ist nicht korrekt!  Falls die Fremdkapitalkosten 0% betragen, reduziert sich die Formel des Rendite Leverage Effekts und auch dann kann durch die Veränderung des FK/EK-Verhältnisses die Eigenkapitalrendite beeinflusst werden, der Leverage Effekt tritt also in diesem Fall auf.',
      },
      {
        correct: true, 
        value: 'Die Eigenkapitalrendite liegt immer über den Fremdkapitalkosten.',
        feedback:
          'Diese Aussage ist korrekt!',
      },
      {
        value: 'Solange die Gesamtkapitalrendite über den Fremdkapitalkosten liegt, kann mit zunehmender Verschuldung die Rendite des Eigenkapitals gesteigert werden.',
        feedback:
          'Diese Aussage ist nicht korrekt! Wenn die Gesamtkapitalrendite höher wie die Fremdkapitalkosten sind, wird die Klammer in der Formel positiv. Deshalb nimmt bei einen grösseren FK/EK-Verhältnis auch die Eigenkapitalrendite zu.',
      },
    ],
  },
  {
     
    name: 'Modul 3.2 Eigenkapitalrendite I',
    content:
      'Beurteile die folgenden Aussagen zur **Eigenkapitalrendite (ROE)** auf ihre Richtigkeit.',
    contentPlain:
      'Beurteile die folgenden Aussagen zur Eigenkapitalrendite (ROE) auf ihre Richtigkeit.',
    type: QuestionType.KPRIM,
    choices: [
      {
        feedback:
          'Diese Aussage ist korrekt! Bei erhöhtem Financial Leverage (FK/EK wird grösser) steigt die erwartete (also die von den Eigenkapitalgebern verlangte) Rendite.',
        correct: true, 
        value: 'Die Eigenkapitalgeber fordern vom Unternehmen für die Übernahme von finanziellem Risiko (Zunahme der Fremdkapitalquote) eine Entschädigung in Form von erhöhtem ROE.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Wenn die Rendite des Fremdkapitals (Fremdkapitalkosten, rFK) grösser ist als die Rendite des Gesamtkapitals (rGK) wird der Term (rGK-rFK) negativ und die Rendite des Eigenkapitals nimmt ab. rEK = rGK + (FK/EK) * (rGK-rFK)',
        value: 'Die Rendite des Eigenkapitals kann mit Erhöhung des Leverage gesteigert werden, wenn die Rendite des Fremdkapitals über der Rendite des Gesamtkapitals liegt.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! ', 
        value: 'Die Eigenkapitalgeber haben einen vertaglich fixierten Anspruch auf die geforderte Eigenkapitalrendite.',
      },
      {
        feedback:
          'Diese Aussage ist nicht korrekt! Wenn die Rendite des Fremdkapitals (Fremdkapitalkosten, rFK) grösser ist als die Rendite des Gesamtkapitals (rGK) wird der Term (rGK-rFK) negativ und die Rendite des Eigenkapitals nimmt ab.',
        value: 'Ein erhöhter Leverage führt immer zu einer höheren Eigenkapitalrendite.',
      },
    ],
  },
  {

    name: 'Modul 3.2 Eigenkapitalrendite II',
    content:
      '<BILD HIER> Wie **hoch** ist die **Eigenkapitalrendite**?',
    contentPlain:
      '<BILD HIER> Wie hoch ist die Eigenkapitalrendite?',
    type: QuestionType.SC,
    choices: [
      {
        value: '7.5%',
        feedback:
          'Diese Aussage ist nicht korrekt! Da die Fremdkapitalkosten in diesem Beispiel nicht bekannt sind, reichen die Angaben nicht aus, um die Eigenkapitalrendite zu berechnen. Die Formel zur Eigenkapitalrendite lautet: <BILD HIER>',
      },
      {  
        value: '12%',
        feedback:
          'Diese Aussage ist nicht korrekt! Da die Fremdkapitalkosten in diesem Beispiel nicht bekannt sind, reichen die Angaben nicht aus, um die Eigenkapitalrendite zu berechnen. Die Formel zur Eigenkapitalrendite lautet: <BILD HIER>',
      },
      {
        value: '13.5%',
        feedback:
          'Diese Aussage ist nicht korrekt! Da die Fremdkapitalkosten in diesem Beispiel nicht bekannt sind, reichen die Angaben nicht aus, um die Eigenkapitalrendite zu berechnen. Die Formel zur Eigenkapitalrendite lautet: <BILD HIER>',
      },
      {
        value: '0%',
        feedback:
          'Diese Aussage ist nicht korrekt! Da die Fremdkapitalkosten in diesem Beispiel nicht bekannt sind, reichen die Angaben nicht aus, um die Eigenkapitalrendite zu berechnen. Die Formel zur Eigenkapitalrendite lautet: <BILD HIER>',
      },
      {
        correct: true, 
        value: 'Die Angaben reichen für die Berechnung nicht aus.',
        feedback:
          'Diese Aussage ist korrekt!',
      },
    ],
  },
]

export const LEARNING_ELEMENTS = [
  {
    id: '1f8178ab-a69a-4994-b292-5c56bea6defa',
    name: 'BF1 MC 1.1',
    displayName: 'BF1 - Test Modul 1.1',
    questions: [0, 1, 2, 3, 4],
  },
]

export const SESSIONS = [
  {
    id: 'd18dfa3b-a965-4dc3-985f-6695e8a43113',
    name: 'BF1 VL Woche 01',
    displayName: 'BF1 - Woche 01',
    status: SessionStatus.PREPARED,
    blocks: [{ questions: [14] }],
  },
]

export const MICRO_SESSIONS = [
  {
    id: 'e3c71b0b-a8cf-43e9-8373-85a31673b178',
    name: 'BF1 Micro Woche 01',
    displayName: 'BF1 - Woche 01',
    scheduledStartAt: new Date('2022-09-14T07:00:00.000Z'),
    scheduledEndAt: new Date('2022-09-22T09:00:00.000Z'),
    description: `
### Einführung

![](https://sos-ch-dk-2.exo.io/klicker-prod/img/microlearning_bf1_1.png)

Was ist Corporate Finance? Gemäss Damodaran umfasst die Corporate Finance alle Entscheidungen von Unternehmen, die finanzielle Auswirkungen haben. Diese umfassen u.a. Investitionsentscheide, Finanzierungsentscheide oder Dividendenentscheide.

Du lernst zudem das finanzwirtschaftliche Zieldreieck kennen, bei dem sich die Rentabilität, Liquidität und Sicherheit einander gegenüber stehen. Zudem lernst du das oberste Ziel der unternehmerischen Tätigkeit kennen, nämlich die langfristige Maximierung des Unternehmenswertes.
`,
    questions: [10, 11, 12, 13],
  },
]

