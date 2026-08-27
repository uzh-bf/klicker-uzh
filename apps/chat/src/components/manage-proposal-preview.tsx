'use client'

import { Markdown } from '@klicker-uzh/markdown'
import { CheckCircle2Icon, XCircleIcon } from 'lucide-react'
import type { FC } from 'react'
import { buildManageProposalReview } from '../services/manageProposalReview'
import type { ManageProposalPayload } from '../services/proposalToElementInstance'

type ManageProposalPreviewProps = {
  payload: ManageProposalPayload
}

export const ManageProposalPreview: FC<ManageProposalPreviewProps> = ({
  payload,
}) => {
  const review = buildManageProposalReview(payload)

  return (
    <section
      aria-label="Question draft review"
      data-cy="chat-manage-proposal-review"
      className="space-y-4 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-900"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
          {review.typeLabel}
        </span>
        <span className="text-xs text-slate-500">Draft question</span>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Question
        </h3>
        <div
          className="mt-1 text-base font-medium"
          data-cy="chat-manage-proposal-question"
        >
          <Markdown content={review.content} withModal={false} />
        </div>
      </div>

      {review.kind === 'choices' ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {review.correctAnswerLabel}
          </h3>
          <ol className="mt-2 space-y-2">
            {review.choices.map((choice) => (
              <li
                key={choice.value}
                data-cy="chat-manage-proposal-option"
                className={
                  choice.correct
                    ? 'rounded-md border border-emerald-200 bg-emerald-50 p-2.5'
                    : 'rounded-md border border-slate-200 bg-slate-50 p-2.5'
                }
              >
                <div className="flex items-start gap-2">
                  {choice.correct ? (
                    <CheckCircle2Icon
                      className="mt-0.5 size-4 shrink-0 text-emerald-700"
                      aria-hidden
                    />
                  ) : (
                    <XCircleIcon
                      className="mt-0.5 size-4 shrink-0 text-slate-500"
                      aria-hidden
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                      <div className="font-medium">
                        <Markdown content={choice.value} withModal={false} />
                      </div>
                      <span className="text-xs font-semibold">
                        {choice.correct ? 'Correct' : 'Incorrect'}
                      </span>
                    </div>
                    <div className="mt-2 border-t border-current/10 pt-2 text-xs text-slate-700">
                      <span className="font-semibold">Answer feedback: </span>
                      {choice.feedback ? (
                        <Markdown content={choice.feedback} withModal={false} />
                      ) : (
                        <span className="text-slate-500">Not provided</span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Sample solution
          </h3>
          {review.solutions.length > 0 ? (
            <ol className="mt-2 list-decimal space-y-2 pl-5">
              {review.solutions.map((solution) => (
                <li key={solution}>
                  <Markdown content={solution} withModal={false} />
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-1 text-slate-500">Not provided</p>
          )}
          {review.maxLength ? (
            <p className="mt-2 text-xs text-slate-600">
              Maximum response length: {review.maxLength} characters
            </p>
          ) : null}
        </div>
      )}

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          General explanation
        </h3>
        {review.explanation ? (
          <div className="mt-1 text-slate-700">
            <Markdown content={review.explanation} withModal={false} />
          </div>
        ) : (
          <p className="mt-1 text-slate-500">Not provided</p>
        )}
      </div>
    </section>
  )
}
