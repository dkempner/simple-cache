import type { NextPage } from "next";
import { useQuery } from "@apollo/client";
import { QUERY, Job } from "../lib/apollo";

const Home: NextPage = () => {
  const { data, loading, error } = useQuery<{ jobs: Job[] }>(QUERY);
  return <pre>{data?.jobs?.length}</pre>;
};

export default Home;
