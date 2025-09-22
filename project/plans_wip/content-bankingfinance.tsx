import { Fragment } from 'react'

export const BankingFinanceDisclaimer = () => (
  <Fragment>
    <div className="flex flex-col items-center gap-8 md:flex-row md:items-start">
      <div className="md:w-82 order-1 flex-none md:order-2">
        <iframe
          style={{ borderRadius: '1rem' }}
          id="kmsembed-0_vfk2yyvo"
          width="300"
          height="300"
          src="https://api.cast.switch.ch/p/106/embedPlaykitJs/uiconf_id/23449004/partner_id/106?iframeembed=true&playerId=kaltura_player&entry_id=0_vfk2yyvo"
          className="kmsembed"
          allow="autoplay *; fullscreen *; encrypted-media *"
          referrerPolicy="no-referrer-when-downgrade"
          sandbox="allow-downloads allow-forms allow-same-origin allow-scripts allow-top-navigation allow-pointer-lock allow-popups allow-modals allow-orientation-lock allow-popups-to-escape-sandbox allow-presentation allow-top-navigation-by-user-activation"
          frameBorder="1"
          title="Benibot Intro"
        ></iframe>
        KI-generierter Avatar (Benibot)
      </div>
      <div className="order-2 flex-1 md:order-1">
        <p>
          Wir möchten Dich herzlich zu unserem Chatbot (Spitzname "Benibot")
          begrüssen. Der Chatbot soll Dein <strong>persönlicher Tutor</strong>{' '}
          im Fachbereich Banking und Finance sein.
        </p>
        <ul className="mb-4 mt-4 list-disc space-y-2 pl-5 text-left">
          <li>
            Das Wissen des Chatbots enthält Kursmaterialien wie{' '}
            <strong>Vorlesungsskripte, FAQs, Vorlesungsaufzeichnungen</strong>{' '}
            und das <strong>Financewiki</strong>. Tausche Dich mit dem Chatbot
            einfach darüber aus, stelle konkrete Fragen, oder sei kreativ und
            lass Dir z.B. Übungsfragen generieren.
          </li>
          <li>
            Es ist möglich, die <strong>Chat-Engine</strong> auszuwählen, die
            für die Generierung der Chatbot-Antworten verwendet wird (über die
            Auswahl in der oberen rechten Ecke). Die Modelle haben
            unterschiedliche Fähigkeiten und Kosten (markiert mit $ bis drei $).
          </li>
          <li>
            Die <strong>Nutzung ist begrenzt</strong> auf eine Anzahl von{' '}
            <strong>Credits</strong>, um einen fairen Zugang für alle Nutzenden
            zu gewährleisten. Sobald der Saldo null erreicht, kannst Du immer
            noch mit den günstigsten Modellen chatten.
          </li>
          <li>
            Der Chatbot soll <strong>kursbezogene Fragen</strong> im Kurs
            "Banking and Finance I/II" beantworten. Bitte vermeide Fragen
            ausserhalb dieses Rahmens, um die Relevanz zu wahren. Gib keinerlei
            persönliche Informationen in den Chatbot ein.
          </li>
          <li>
            Bitte gib uns <strong>Feedback</strong> zu den Antworten über die
            Daumen hoch/runter und Kommentarschaltflächen. Dies wird uns enorm
            helfen, den Chatbot für zukünftige Tests und Anwendungsfälle zu
            verbessern.
          </li>
        </ul>
      </div>
    </div>
    <div className="mb-4 rounded-lg bg-slate-100 p-4">
      <h3 className="mb-2 text-lg font-semibold">
        Eigenverantwortung der Nutzer
      </h3>
      <p>
        Die gegebenen Antworten können mehr oder weniger Informationen
        enthalten, als für das Bestehen des Kurses erforderlich sind, und die
        Chatbot-Antworten allein sind daher nicht prüfungsrelevant (nur die
        zugrundeliegenden Inhalte). Während wir uns bemühen, durch den
        KI-Chatbot genaue Informationen bereitzustellen, garantieren wir nicht
        die Richtigkeit, Vollständigkeit oder Aktualität der bereitgestellten
        Informationen. Es liegt in Deiner eigenen Verantwortung, die Antworten
        anhand von Kursmaterialien und Referenzen zu überprüfen.
      </p>
    </div>
    <div className="rounded-lg bg-slate-100 p-4">
      <h3 className="mb-2 text-lg font-semibold">Datenschutz</h3>
      <p className="mb-4">
        Gib keinerlei persönliche Informationen an den Chatbot weiter. Die von
        Dir gestellten Fragen werden je nach ausgewählter Chat-Engine an OpenAI
        (GPT-Modelle), Anthropic (Claude-Modelle), Google (Gemini-Modelle), oder
        TogetherAI (Llama und andere Modelle) gesendet. Gespräche können in
        anonymisierter Form von unserem Team überprüft werden, um die Leistung
        des Chatbots zu verbessern und unsere Kurse zu optimieren.
      </p>
      <p>
        Durch die Interaktion mit dem Chatbot erkennst Du die oben dargelegten
        Bedingungen an und akzeptierst diese. Wenn Du Feedback oder Bedenken
        hast, kontaktiere uns bitte über das Forum in OLAT.
      </p>
    </div>
  </Fragment>
)
