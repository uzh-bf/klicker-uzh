import builder from '../builder.js'
import type {
  QuestionPoolLabelPreview as Preview,
  QuestionPoolAiLabels,
  QuestionPoolObservedLabels,
} from '../services/questionPoolLabelPreview.js'

const QuestionPoolObservedLabelsRef =
  builder.objectRef<QuestionPoolObservedLabels>('QuestionPoolObservedLabels')
builder.objectType(QuestionPoolObservedLabelsRef, {
  fields: (t) => ({
    fullCreditCount: t.exposeInt('fullCreditCount'),
    denominator: t.exposeInt('denominator'),
    rate: t.exposeFloat('rate'),
    band: t.exposeInt('band'),
  }),
})

const QuestionPoolAiLabelsRef = builder.objectRef<QuestionPoolAiLabels>(
  'QuestionPoolAiLabels'
)
builder.objectType(QuestionPoolAiLabelsRef, {
  fields: (t) => ({
    rawRate: t.exposeFloat('rawRate'),
    rawBand: t.exposeInt('rawBand'),
    calibratedRate: t.exposeFloat('calibratedRate', { nullable: true }),
    calibratedBand: t.exposeInt('calibratedBand', { nullable: true }),
    bloom: t.exposeString('bloom'),
  }),
})

const QuestionPoolLabelPreviewRef = builder.objectRef<Preview>(
  'QuestionPoolLabelPreview'
)
export const QuestionPoolLabelPreview = builder.objectType(
  QuestionPoolLabelPreviewRef,
  {
    fields: (t) => ({
      elementVersion: t.exposeInt('elementVersion'),
      observed: t.expose('observed', {
        type: QuestionPoolObservedLabelsRef,
        nullable: true,
      }),
      ai: t.expose('ai', {
        type: QuestionPoolAiLabelsRef,
        nullable: true,
      }),
    }),
  }
)
