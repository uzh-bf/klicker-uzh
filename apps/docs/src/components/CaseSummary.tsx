import React from 'react'

export default function CaseSummary({ goals, tags, children }) {
  return (
    <div className="flex flex-col gap-4 md:gap-8 md:items-start md:flex-row">
      <div className="flex-1 md:px-4 md:py-2 md:border-gray-300 md:border md:border-solid md:rounded md:shadow md:flex-initial md:w-64">
        <div className="font-bold">Goals</div>
        <ul className="pl-4 mt-2 text-sm">
          {goals.map((goal) => (
            <li>{goal}</li>
          ))}
        </ul>
      </div>
      <div className="flex-1">
        <div className="mt-2 font-bold">Scenario Description</div>

        <div className="flex flex-row flex-wrap gap-1 mt-2">
          {tags.map((tag) => (
            <div className="px-2 py-1 text-xs border border-gray-300 border-solid rounded shadow-sm">
              {tag}
            </div>
          ))}
        </div>

        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}
