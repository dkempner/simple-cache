import type { NextPage } from "next";
import { useQuery, gql } from "@apollo/client";
import { useEffect, useState } from "react";

export type Job = {
  __typename: string;
  id: string;
  title: string;
  postedAt: Date;
};

export const JOB_FULL = gql`
  query Jobs {
    jobs {
      id
      title
      postedAt
    }
  }
`;

export const JOB_ID = gql`
  query Jobs {
    jobs {
      id
    }
  }
`;

export const JOB_TITLE = gql`
  query Jobs {
    jobs {
      title
    }
  }
`;

const Home: NextPage = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  // if (!mounted) return null;
  return (
    <>
      <JobsFullCount />
      <JobsFullCount />
      <JobsFullCount />
      <JobsFullCount />
      <JobsFullCount />

      <JobsIdCount />
      <JobsIdCount />
      <JobsIdCount />
      <JobsIdCount />
      <JobsIdCount />

      <JobsTitleCount />
      <JobsTitleCount />
      <JobsTitleCount />
      <JobsTitleCount />
      <JobsTitleCount />
    </>
  );
};

function JobsFullCount() {
  const { data, loading, error } = useQuery<{ jobs: Job[] }>(JOB_FULL);
  return <pre>{loading ? "Loading..." : data?.jobs?.length}</pre>;
}

function JobsIdCount() {
  const { data, loading, error } = useQuery<{ jobs: Job[] }>(JOB_ID);
  return <pre>{loading ? "Loading..." : data?.jobs?.length}</pre>;
}

function JobsTitleCount() {
  const { data, loading, error } = useQuery<{ jobs: Job[] }>(JOB_TITLE);
  return <pre>{loading ? "Loading..." : data?.jobs?.length}</pre>;
}

export default Home;
