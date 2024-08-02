import {
  Choice,
  Element,
  ElementDisplayMode,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'

// TODO: export separate functions to separate files
// TODO: implement SC quesiton type
// TODO: implement MC quesiton type
// TODO: implement KPRIM question type
// TODO: implement NR question type
// TODO: implement FT question type

function exportToQTI(elements: Element[]) {
  let xmlStrings: string[] = []
  elements.forEach((element) => {
    const xmlString = exportSingleElement(element)
    if (xmlString) {
      xmlStrings.push(xmlString)
    }
  })

  //   const combinedXmlString = createCombineFiles(xmlStrings)
  //   triggerDownload(combinedXmlString)
}

function exportSingleElement(element: Element) {
  const options = {
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  }

  let convertedElement: string = ''
  switch (element.type) {
    case ElementType.Sc:
      convertedElement = convertSC(element)
      break
    case ElementType.Mc:
      convertedElement = convertMC(element)
      break
    case ElementType.Kprim:
      convertedElement = convertKPRIM(element)
      break
    case ElementType.Numerical:
      convertedElement = convertNR(element)
      break
    case ElementType.FreeText:
      convertedElement = convertFT(element)
      break
    case ElementType.Flashcard:
      convertedElement = convertFlashcard(element)
      break
    case ElementType.Content:
      convertedElement = convertContent(element)
    default:
      break
  }

  const xmlString =
    `<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1" identifier="${element.id}" title="${element.name}" adaptive="false" timeDependent="false" toolName="KlickerUZH">` +
    convertedElement +
    '</assessmentItem>'

  // TODO: remove logging
  console.log(element)
  console.log(xmlString)

  return xmlString
}

function convertSC(element: Element) {
  let question = `<itemBody><prompt>${element.content}</prompt>`
  question += `<choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1" orientation="${
    element.options.displayMode === ElementDisplayMode.Grid
      ? 'horizontal'
      : 'vertical'
  }">`
  element.options.choices.forEach((option: Choice) => {
    question += `<simpleChoice identifier="ANSWER-${option.ix}">${option.value}</simpleChoice>`
  })
  question += '</choiceInteraction></itemBody>'

  if (element.options.hasSampleSolution) {
    const correctIx = element.options.choices.findIndex(
      (option: Choice) => option.correct
    )
    question += `<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"><correctResponse><value>ANSWER-${correctIx}</value></correctResponse></responseDeclaration>`
  } else {
    question += `<responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier"/>`
  }

  return question
}

function convertMC(element: Element) {
  return ''
}

function convertKPRIM(element: Element) {
  return ''
}

function convertNR(element: Element) {
  return ''
}

function convertFT(element: Element) {
  return ''
}

function convertFlashcard(element: Element) {
  return ''
}

function convertContent(element: Element) {
  return ''
}

// function createCombineFiles(xmlStrings: string[]):  {
//   return null
// }

// function triggerDownload(combinedXmlString: string) {
//   return null
// }

export default exportToQTI
