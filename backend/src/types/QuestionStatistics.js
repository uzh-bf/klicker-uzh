module.exports = `
  union QuestionStatistics_StatisticsData = QuestionStatistics_StatisticsCHOICES | QuestionStatistics_StatisticsFREE

  type QuestionStatistics {
    id: ID!

    title: String!
    usageTotal: Int!

    type: Question_Type!

    usageDetails: [QuestionStatistics_UsageCount]!
    statistics: [QuestionStatistics_Statistics!]!

    createdAt: DateTime!
    updatedAt: DateTime
  }

  type QuestionStatistics_UsageCount {
    count: Int!
    version: Int!
  }

  type QuestionStatistics_Statistics {
    version: Int!
    CHOICES: [QuestionStatistics_StatisticsCHOICES!]
    FREE: [QuestionStatistics_StatisticsFREE!]
  }

  type QuestionStatistics_StatisticsCHOICES {
    correct: Boolean!
    name: String!
    chosen: Int!
    total: Int!
    percentageChosen: Float!
  }

  type QuestionStatistics_StatisticsFREE {
    chosen: Int!
    percentageChosen: Float!
    total: Int!
    key: String!
    value: String!
  }

`
