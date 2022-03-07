import Script from 'next/script'
import getConfig from 'next/config'
import { useRouter } from 'next/router'

const { publicRuntimeConfig } = getConfig()

const CHATWOOT_PAGES = ['/404', '/questions', '/sessions', '/sessions/running', '/user/settings']

function Chatwoot() {
  const router = useRouter()

  if (!CHATWOOT_PAGES.includes(router.pathname)) {
    return null
  }

  return (
    <>
      <Script
        dangerouslySetInnerHTML={{
          __html: `
            (function(d,t) {
              var g=d.createElement(t),s=d.getElementsByTagName(t)[0];
              g.src='${publicRuntimeConfig.chatwootBaseUrl}'+"/packs/js/sdk.js";
              g.defer = true;
              g.async = true;
              s.parentNode.insertBefore(g,s);
              g.onload=function(){
                window.chatwootSDK.run({
                  websiteToken: '${publicRuntimeConfig.chatwootToken}',
                  baseUrl: '${publicRuntimeConfig.chatwootBaseUrl}'
                })
              }
            })(document,"script");
          `,
        }}
        id="chatwoot-init"
        strategy="afterInteractive"
      />
    </>
  )
}

export default Chatwoot
