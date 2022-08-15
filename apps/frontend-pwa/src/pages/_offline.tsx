import Head from "next/head";

const fallback = () => (
  <>
    <Head>
      <title>Klicker UZH PWA</title>
    </Head>
    <h1>It seems that you are currently offline.</h1>
    <h2>Connect your device to the internet in order to use Klicker UZH.</h2>
  </>
);

export default fallback;
