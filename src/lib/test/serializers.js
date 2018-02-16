const questionSerializer = {
  test: val => val.id && val.instances && val.tags && val.title && val.type && val.versions,
  print: val => `
    QUESTION

    Title: ${val.title}
    Type: ${val.type}

    Instances: [${val.instances}]
    Tags: [${val.tags.map(tag => tag.name)}]
    Versions: [${val.versions.map(({
    description, instances, options, solution,
  }) => `
      Description: ${description}
      Instances: [${instances}]
      Options: {
        SC: ${options.SC &&
          `{
          Choices: ${options.SC.choices &&
            `[${options.SC.choices.map(({ correct, name }) => `{
              Correct: ${correct}
              Name: ${name}
            }`)}
          ]`}
          Randomized: ${options.SC.randomized}
        }`}
        MC: ${options.MC &&
          `{
          Choices: ${options.MC.choices &&
            `[${options.MC.choices.map(({ correct, name }) => `{
              Correct: ${correct}
              Name: ${name}
            }`)}
          ]`}
          Randomized: ${options.MC.randomized}
        }`}
        FREE_RANGE: ${options.FREE_RANGE &&
          `
          Restrictions: ${options.FREE_RANGE.restrictions &&
            `{
            Max: ${options.FREE_RANGE.restrictions.max}
            Min: ${options.FREE_RANGE.restrictions.min}
          }`}
        `}
      }
      Solution: ${solution &&
        `{
        SC: ${solution.SC && JSON.stringify(solution.SC)}
        MC: ${solution.SC && JSON.stringify(solution.SC)}
        FREE: ${solution.SC && solution.FREE}
        FREE_RANGE: ${solution.SC && solution.FREE_RANGE}
      }
      `}
    `)}]
  `,
}

const sessionSerializer = {
  test: val => val.id && val.blocks && val.name && val.status && val.settings && val.user,
  print: val => `
    SESSION

    Name: ${val.name}
    Status: ${val.status}

    ActiveBlock: ${val.activeBlock}
    ActiveStep: ${val.activeStep}
    ActiveInstances: ${val.activeInstances.length}

    Blocks: [${val.blocks.map(block => `{
      Show solutions: ${block.showSolutions}
      Status: ${block.status}
      Time limit: ${block.timeLimit}
      Number of instances: ${block.instances.length}
    }`)}]

    ConfusionTS: [${val.confusionTS.map(TS => `{
      Difficulty: ${TS.difficulty}
      Speed: ${TS.speed}
    }`)}]

    Feedbacks: [${val.feedbacks.map(feedback => `{
      Content: ${feedback.content}
      Votes: ${feedback.votes}
    }`)}]

    Settings: {
      ConfusionActive: ${val.settings.isConfusionBarometerActive}
      FeedbacksActive: ${val.settings.isFeedbackChannelActive}
      FeedbacksPublic: ${val.settings.isFeedbackChannelPublic}
    }`,
}

const questionInstanceSerializer = {
  test: val => val.id && val.responses && val.version >= 0,
  print: val => `
    QUESTION_INSTANCE

    isOpen: ${val.isOpen}
    version: ${val.version}

    responses: [${val.responses.map(response => `
      ipUnique: ${response.ipUnique}
      fpUnique: ${response.fpUnique}
      value: {
        choices: ${response.value.choices}
        text: ${response.value.text}
        value: ${response.value.value}
      }
    `)}]

    results: ${val.results &&
      `{
      CHOICES: [${val.results.CHOICES}]
      FREE: ${val.results.FREE}
    }`}
  `,
}

module.exports = {
  questionSerializer,
  sessionSerializer,
  questionInstanceSerializer,
}
