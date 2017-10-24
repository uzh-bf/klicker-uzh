const questionSerializer = {
  test: val => val.id && val.instances && val.tags && val.title && val.type && val.versions,
  print: val => `
    QUESTION

    Title: ${val.title}
    Type: ${val.type}

    Instances: [${val.instances}]
    Tags: [${val.tags.map(tag => tag.name)}]
    Versions: [${val.versions.map(({ description, instances, options }) => `
      Description: ${description}
      Instances: [${instances}]
      Options: {
        Choices: ${options.choices &&
          `[${options.choices.map(({ correct, name }) => `{
            Correct: ${correct}
            Name: ${name}
          }`)}
        ]`}
        Randomized: ${options.randomized}
        Restrictions: ${options.restrictions &&
          `{
          Max: ${options.restrictions.max}
          Min: ${options.restrictions.min}
          Type: ${options.restrictions.type}
        }`}
      }
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
      ip: ${response.ip}
      fingerprint: ${response.fingerprint}
      value: {
        choices: ${response.value.choices}
        text: ${response.value.text}
        value: ${response.value.value}
      }
    `)}]

    results: ${val.results &&
      `{
      choices: [${val.results.choices}]
      free: ${val.results.free}
    }`}
  `,
}

module.exports = {
  questionSerializer,
  sessionSerializer,
  questionInstanceSerializer,
}
