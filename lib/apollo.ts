import { ApolloClient, InMemoryCache, gql } from "@apollo/client";
import { SimpleCache } from "./SimpleCache";

const isServer = typeof window === "undefined";
// @ts-ignore
const windowApolloState = !isServer && window.__NEXT_DATA__.apolloState;

let CLIENT: any;

export function getApolloClient(forceNew?: boolean) {
  if (!CLIENT || forceNew) {
    CLIENT = new ApolloClient({
      ssrMode: isServer,
      uri: "https://api.graphql.jobs/",
      cache: new SimpleCache().restore(windowApolloState || {}),
    });
  }

  return CLIENT;
}

export type Job = {
  __typename: string;
  id: string;
  title: string;
  postedAt: Date;
};

export const QUERY = gql`
  query Jobs {
    jobs {
      id
      title
      postedAt
    }
  }
`;
