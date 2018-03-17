/* eslint-disable react/no-danger */

import Document, { Head, Main, NextScript } from 'next/document'
import Helmet from 'react-helmet'
import React from 'react'

// The document (which is SSR-only) needs to be customized to expose the locale
// data for the user's locale for React Intl to work in the browser.
export default class IntlDocument extends Document {
  static async getInitialProps(context) {
    const props = await super.getInitialProps(context)
    const { req: { locale, localeDataScript } } = context

    return {
      ...props,
      helmet: Helmet.renderStatic(),
      locale,
      localeDataScript,
    }
  }

  // should render on <html>
  get helmetHtmlAttrComponents() {
    return this.props.helmet.htmlAttributes.toComponent()
  }

  // should render on <body>
  get helmetBodyAttrComponents() {
    return this.props.helmet.bodyAttributes.toComponent()
  }

  // should render on <head>
  get helmetHeadComponents() {
    return Object.keys(this.props.helmet)
      .filter(el => el !== 'htmlAttributes' && el !== 'bodyAttributes')
      .map(el => this.props.helmet[el].toComponent())
  }

  render() {
    // Polyfill Intl API for older browsers
    const polyfill = `https://cdn.polyfill.io/v2/polyfill.min.js
      ?features=Intl.~locale.${this.props.locale}`

    const chatlio = `
      window._chatlio = window._chatlio||[];
      !function(){ var t=document.getElementById("chatlio-widget-embed");if(t&&window.ChatlioReact&&_chatlio.init)return void _chatlio.init(t,ChatlioReact);for(var e=function(t){return function(){_chatlio.push([t].concat(arguments)) }},i=["configure","identify","track","show","hide","isShown","isOnline", "page", "open", "showOrHide"],a=0;a<i.length;a++)_chatlio[i[a]]||(_chatlio[i[a]]=e(i[a]));var n=document.createElement("script"),c=document.getElementsByTagName("script")[0];n.id="chatlio-widget-embed",n.src="https://w.chatlio.com/w.chatlio-widget.js",n.async=!0,n.setAttribute("data-embed-version","2.3");
        n.setAttribute('data-widget-id','d4ec6614-f2cb-4d8a-621d-3d2d1ff2f70c');
        c.parentNode.insertBefore(n,c);
      }();
    `

    return (
      <html lang={this.props.locale} {...this.helmetHtmlAttrComponents}>
        <Head>
          <meta content="text/html; charset=utf-8" httpEquiv="Content-type" />
          <meta content="width=device-width, initial-scale=1" name="viewport" />
          <meta content="IE=Edge" httpEquiv="X-UA-Compatible" />

          <link
            crossOrigin="anonymous"
            href="https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css"
            integrity="sha384-wvfXpqpZZVQGK6TAh5PVlGOfQNHSoD2xbE+QkPxCAFlNEevoEH3Sl0sibVcOQVnN"
            rel="stylesheet"
          />

          {this.helmetHeadComponents}
        </Head>
        <body {...this.helmetBodyAttrComponents}>
          <Main />
          <script src={polyfill} />
          <script
            dangerouslySetInnerHTML={{
              __html: this.props.localeDataScript,
            }}
          />
          <NextScript />
        </body>
      </html>
    )
  }
}
