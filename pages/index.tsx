import type { NextPage } from "next";
import { useQuery } from "@apollo/client";
import { QUERY, Job } from "../lib/apollo";
import { useEffect, useState } from "react";

const Home: NextPage = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return (
    <>
      <JobsCount />
      <JobsCount />
      <JobsCount />
      <JobsCount />
      <JobsCount />
    </>
  );
};

function JobsCount() {
  const { data, loading, error } = useQuery<{ jobs: Job[] }>(QUERY);
  return <pre>{data?.jobs?.length}</pre>;
}

export default Home;
