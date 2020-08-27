import React from 'react'
import { Icon } from 'semantic-ui-react'

const FeatureOverview = ({ icon, title, children }) => (
  <div className="featureOverview">
    <h3 className="title">
      {icon && <Icon name={icon} size="big" />}
      {title}
    </h3>
    <div className="features">{children}</div>

    <style jsx>{`
      .featureOverview > h3 {
        display: flex;
        align-items: center;

        margin-bottom: 0.5rem;
      }

      .featureOverview > .title i {
        margin-right: 1rem;
      }
    `}</style>
  </div>
)

FeatureOverview.Item = ({ title, children }) => (
  <div className="feature">
    {title && <h4>{title}</h4>}
    <p>{children}</p>

    <style jsx>{`
      .feature {
        padding: 1rem 0;
      }

      .feature:not(:last-child) {
        border-bottom: 1px solid lightgrey;
      }

      .feature > h4 {
        margin-bottom: 0.5rem;
        font-size: 1.2rem;
      }

      .feature > p {
        margin: 0;
      }
    `}</style>
  </div>
)

export default FeatureOverview
