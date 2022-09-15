import "../styles/globals.css";
import { ApolloProvider } from "@apollo/client";
import { getApolloClient } from "../lib/apollo";

import type { AppProps } from "next/app";

function MyApp({ Component, pageProps }: AppProps) {
  const client = getApolloClient();

  return (
    <ApolloProvider client={client}>
      <Component {...pageProps} />
    </ApolloProvider>
  );
}

export default MyApp;
