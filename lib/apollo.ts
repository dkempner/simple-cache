import { ApolloClient, InMemoryCache, gql } from "@apollo/client";
import { DocumentCache } from "./DocumentCache";

const isServer = typeof window === "undefined";
// @ts-ignore
const windowApolloState = !isServer && window.__NEXT_DATA__.apolloState;

let CLIENT: any;

export function getApolloClient(forceNew?: boolean) {
  if (!CLIENT || forceNew) {
    CLIENT = new ApolloClient({
      ssrMode: isServer,
      uri: "https://api.graphql.jobs/",
      cache: new DocumentCache().restore(windowApolloState || {}),
    });
  }

  return CLIENT;
}
