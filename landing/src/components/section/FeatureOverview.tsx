import React from 'react'
import { Icon } from 'semantic-ui-react'

function FeatureOverview({ icon, title, children }) {
  return (
    <div>
      <h2 className="flex items-center mb-6 text-3xl">
        {icon && <Icon className="mr-8" name={icon} size="big" />}
        {title}
      </h2>
      <div>{children}</div>
    </div>
  )
}

FeatureOverview.Item = function FunctionOverviewItem({ title, children }) {
  return (
    <div className="py-2">
      {title && <h3 className="mb-2 text-xl">{title}</h3>}
      <p className="m-0">{children}</p>
    </div>
  )
}

export default FeatureOverview
