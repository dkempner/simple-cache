import {
  ApolloCache,
  ApolloClient,
  Cache,
  DataProxy,
  DocumentNode,
  InMemoryCache,
  InMemoryCacheConfig,
  MissingFieldError,
  Reference,
  Transaction,
} from "@apollo/client";
import fastStringify from "fast-json-stable-stringify";
import { equal } from "@wry/equality";
import sha256 from "hash.js/lib/hash/sha/256";

/**
 * QueryPlusVariablesMap[query][variables] = data
 */
type QueryPlusVariablesMap<T> = Record<string, Record<string, T>>;

/**
 * Primary, serializable data structure of DocumentCache.
 * We add the __META.type property to identify this as a DocumentCache.
 * __META is also a property in InMemoryCache.
 */
export type DocumentCacheObject = QueryPlusVariablesMap<any> & {
  __META: { type?: "DocumentCache"; extraRootIds: [] };
};

type DocumentCacheWatches = QueryPlusVariablesMap<Set<Cache.WatchOptions>>;

type WriteQuerySubscriber<TData = any, TVariables = any> = (
  options: Cache.WriteQueryOptions<TData, TVariables>
) => void;

type DocumentCacheSubscriptions = {
  writeQuery: Array<WriteQuerySubscriber>;
};

type QueryToQueryCacheKeyMap = Map<DocumentNode, string>;

/** A stripped down version of Apollo's `InMemoryCache` which caches whole queries instead of entities.
 * The premise of DocumentCache is that we can do a cache of query + variables and save all of
 * the runtime work of maintaining a normalized cache of entities.
 *
 * What doesn't work:
 * 1. Querying for list of Items, and then retrieving single Item from cache.
 * 2. `cache.modify` is not implemented. You must modify entire queries with `cache.writeQuery` instead.
 */
export class DocumentCache extends ApolloCache<DocumentCacheObject> {
  /** Internal cache. Same naming convention and function as InMemoryCache */
  private data: DocumentCacheObject;
  private watches: DocumentCacheWatches;

  /** This is optional, but allows us to do need only one `JSON.stringify` per `DocumentNode`. */
  private queryToQueryCacheKeyMap: Map<DocumentNode, string>;

  /** Cache operation subscribers */
  private operationSubscriptions: DocumentCacheSubscriptions = {
    writeQuery: [],
  };

  /** Takes the same config as InMemoryCache so we can pass those options to our internal IMC
   * The only real option of note would be setting `addTypeName` to `false`. By default it's `true`.
   */
  constructor(config: InMemoryCacheConfig = {}) {
    super();
    this.data = makeDocumentCacheObject();
    this.watches = makeDocumentCacheWatches();
    this.queryToQueryCacheKeyMap = makeQueryToQueryCacheKeyMap();
    this.imc = new InMemoryCache(config);
  }

  imc: InMemoryCache;

  /** Uses fast-json-stable-stringify to ensure order of properties doesn't affect hashing */
  private makeVariablesCacheKey<TVariables>(variables: TVariables) {
    return fastStringify(variables);
  }

  private getCachedData<TData = any, TVariables = any>(
    query: DocumentNode,
    variables: TVariables
  ): TData | null {
    const queryCacheKey = this.makeQueryCacheKey(query);
    const queryCache = this.data[queryCacheKey];
    if (!queryCache) return null;
    const data = queryCache[this.makeVariablesCacheKey(variables)];
    if (!data) return null;
    return data;
  }

  /**
   * Stringifies and hashes the query
   */
  makeQueryCacheKey(query: DocumentNode) {
    const existing = this.queryToQueryCacheKeyMap.get(query);
    if (existing) return existing;

    // Must call `transformDocument` to ensure `__typename`s are added.
    const hash = sha256()
      .update(JSON.stringify(this.transformDocument(query)))
      .digest("hex");

    this.queryToQueryCacheKeyMap.set(query, hash);

    return hash;
  }

  read<TData = any, TVariables = any>(
    query: Cache.ReadOptions<TVariables, TData>
  ): TData | null {
    return this.getCachedData(query.query, query.variables);
  }

  write<TData = any, TVariables = any>(
    write: Cache.WriteOptions<TData, TVariables>
  ): Reference | undefined {
    const queryCacheKey = this.makeQueryCacheKey(write.query);
    const queryCache = this.data[queryCacheKey] || {};
    queryCache[this.makeVariablesCacheKey(write.variables)] = write.result;
    this.data[queryCacheKey] = queryCache;
    return {
      __ref: "",
    };
  }

  /**
   * Adds or updates the data for a query/variables combination and
   * broadcast to watchers.
   */
  writeQuery<TData = any, TVariables = any>(
    options: Cache.WriteQueryOptions<TData, TVariables>
  ): Reference | undefined {
    const { data, query, variables } = options;
    // lookup existing cachedData
    const queryCacheKey = this.makeQueryCacheKey(query);
    const variablesCacheKey = this.makeVariablesCacheKey(variables);
    const queryCache = this.data[queryCacheKey] || {};
    const cachedData = queryCache[variablesCacheKey];

    // do we need to update watches?
    const isDiff = !equal(cachedData, data);

    // persist the new data
    const writeQueryResult = super.writeQuery(options);

    // update watches
    if (isDiff) {
      const queryLevel = this.watches[queryCacheKey] || {};
      const variablesLevel = queryLevel[variablesCacheKey] || new Set();
      variablesLevel.forEach((w) => {
        w.callback({
          result: data,
          complete: true,
        });
      });
    }

    this.operationSubscriptions.writeQuery.forEach((callback) => {
      callback(options);
    });

    return writeQueryResult;
  }

  /**
   * InMemoryCache doesn't implement updateQuery, instead it falls back to the base class (ApolloCache).
   * We only add the `super` invocation here so readers of this file know it exists. */
  updateQuery<TData = any, TVariables = any>(
    options: Cache.UpdateQueryOptions<TData, TVariables>,
    update: (data: TData | null) => TData | null | void
  ): TData | null {
    return super.updateQuery(options, update);
  }

  /**
   * All or nothing diff. Either we have the entire query or none of it.
   */
  diff<T>(query: Cache.DiffOptions<any, any>): DataProxy.DiffResult<T> {
    const result = this.getCachedData(query.query, query.variables);

    if (result) {
      return {
        result,
        complete: true,
      };
    }

    return {
      result: {} as T,
      complete: false,
      missing: [new MissingFieldError("", {}, query.query, query.variables)],
    };
  }

  /**
   * Watch changes on this exact query/variable combination.
   * @returns an unsubscribe function
   */
  watch<TData = any, TVariables = any>(
    watch: Cache.WatchOptions<TData, TVariables>
  ): () => void {
    const { query, variables } = watch;

    // get or create watchesSet for this query/variables combo
    const queryCacheKey = this.makeQueryCacheKey(query);
    const variablesCacheKey = this.makeVariablesCacheKey(variables);
    const queryCache = this.watches[queryCacheKey] || {};
    const watchesSet = queryCache[variablesCacheKey] || new Set();

    // add and save
    watchesSet.add(watch);
    queryCache[variablesCacheKey] = watchesSet;
    this.watches[queryCacheKey] = queryCache;

    return () => {
      // TODO: dkempner - is there more cleanup we should do here if all watches have been removed?
      watchesSet.delete(watch);
    };
  }

  reset(_options?: Cache.ResetOptions): Promise<void> {
    this.data = makeDocumentCacheObject();
    this.watches = makeDocumentCacheWatches();
    this.queryToQueryCacheKeyMap = makeQueryToQueryCacheKeyMap();
    return Promise.resolve();
  }

  evict(_options: Cache.EvictOptions): boolean {
    return false;
  }

  restore(serializedState: any): ApolloCache<DocumentCacheObject> {
    this.data = serializedState;
    return this;
  }

  extract(_optimistic?: boolean): DocumentCacheObject {
    return this.data;
  }

  removeOptimistic(_id: string): void {}

  performTransaction(
    transaction: Transaction<any>,
    _optimisticId?: string | null
  ): void {
    transaction(this);
  }

  /** This method is what adds __typename to all objects, so we just steal that function from a real InMemoryCache */
  transformDocument(document: DocumentNode): DocumentNode {
    return this.imc.transformDocument(document);
  }

  /**
   * Subscribe to cache operations
   * @returns unsubscribe function
   */
  subscribe(operation: "writeQuery", callback: WriteQuerySubscriber) {
    this.operationSubscriptions[operation].push(callback);

    return () => {
      this.operationSubscriptions[operation] = this.operationSubscriptions[
        operation
      ].filter((cb) => cb !== callback);
    };
  }

  /** Begin unimplemented methods */
  /** Should be a noop in this cache, but doesn't need to throw */
  modify(options: Cache.ModifyOptions): boolean {
    return super.modify(options);
  }

  readFragment<FragmentType, TVariables = any>(
    _options: Cache.ReadFragmentOptions<FragmentType, TVariables>,
    _optimistic?: boolean
  ): FragmentType | null {
    throw new Error("DocumentCache: cache.readFragment is not implemented");
  }

  writeFragment<TData = any, TVariables = any>(
    _options: Cache.WriteFragmentOptions<TData, TVariables>
  ): Reference | undefined {
    throw new Error("DocumentCache: cache.writeFragment is not implemented");
  }

  updateFragment<TData = any, TVariables = any>(
    _options: Cache.UpdateFragmentOptions<TData, TVariables>,
    _update: (data: TData | null) => TData | null | void
  ): TData | null {
    throw new Error("DocumentCache: cache.updateFragment is not implemented");
  }
  /** End unimplemented methods */
}

export function isDocumentCache(shape: CacheShape) {
  return (
    shape.__META &&
    "type" in shape.__META &&
    shape.__META.type === "DocumentCache"
  );
}

export function isUsingDocumentCache(client: ApolloClient<CacheShape>) {
  return isDocumentCache(client.cache.extract());
}

function makeDocumentCacheObject() {
  return {
    __META: { type: "DocumentCache", extraRootIds: [] },
  } as DocumentCacheObject;
}

function makeDocumentCacheWatches() {
  return {} as DocumentCacheWatches;
}

function makeQueryToQueryCacheKeyMap() {
  return new Map() as QueryToQueryCacheKeyMap;
}
