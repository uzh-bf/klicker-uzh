import React from 'react'
import Helmet from 'react-helmet'

import 'fomantic-ui-css/semantic.css'

import Header from '../common/Header'
import Footer from '../common/Footer'

function Layout({ children }) {
  return (
    <div className="klicker-main">
      <Helmet>
        <meta charset="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"
        />
      </Helmet>

      <div className="klicker-stickyHeader">
        <Header />
      </div>

      <main className="klicker-content">{children}</main>

      <div className="klicker-footer">
        <Footer />
      </div>

      <style jsx global>{`
        body,
        #___gatsby,
        .klicker-main {
          height: 100%;
        }

        h1,
        h2,
        h3,
        h4 {
          color: #375164;
        }

        h1 {
          font-size: 2rem;
        }

        h2 {
          font-size: 1.8rem;
        }

        h3 {
          font-size: 1.6rem;
        }

        h4 {
          font-size: 1.4rem;
        }
      `}</style>

      <style jsx>{`
        .klicker-main {
          display: flex;
          flex-direction: column;
        }

        .klicker-stickyHeader {
          flex: 0 0 auto;
          top: 0;
          z-index: 1;
        }

        .klicker-content {
          flex: 1;
          height: 100%;
        }

        .klicker-footer {
          flex: 0 0 auto;
        }

        @media all and (min-width: 968px) {
          .klicker-stickyHeader {
            position: -webkit-sticky;
            position: sticky;
          }
        }
      `}</style>
    </div>
  )
}

export default Layout
