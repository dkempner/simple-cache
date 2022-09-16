import {
  ApolloCache,
  Cache,
  DataProxy,
  DocumentNode,
  InMemoryCache,
  MissingFieldError,
  Reference,
  Transaction,
} from "@apollo/client";
import fastStringify from "fast-json-stable-stringify";

export type SimpleCacheObject = Record<string, Record<string, any>>;

export class SimpleCache extends ApolloCache<SimpleCacheObject> {
  private cache: SimpleCacheObject;
  constructor() {
    super();
    this.cache = {};
    this.imc = new InMemoryCache();
  }

  __type = "SimpleCache";

  imc: InMemoryCache;

  read<TData = any, TVariables = any>(
    query: Cache.ReadOptions<TVariables, TData>
  ): TData | null {
    console.log({ fashionEvent: "read" });
    const queryCacheKey = JSON.stringify(query.query);
    const queryCache = this.cache[queryCacheKey];
    if (!queryCache) return null;
    console.log({ fashionEvent: "read:foundQueryCache" });
    const data = queryCache[fastStringify(query.variables)];
    if (!data) return null;
    console.log({ fashionEvent: "read:foundData" });
    return data;
  }
  write<TData = any, TVariables = any>(
    write: Cache.WriteOptions<TData, TVariables>
  ): Reference | undefined {
    console.log({ fashionEvent: "write" });
    const queryCacheKey = JSON.stringify(write.query);
    const queryCache = this.cache[queryCacheKey] || {};
    queryCache[fastStringify(write.variables)] = write.result;
    this.cache[queryCacheKey] = queryCache;
    return {
      __ref: "",
    };
  }
  diff<T>(query: Cache.DiffOptions<any, any>): DataProxy.DiffResult<T> {
    console.log({ fashionEvent: "diff" });
    const queryCacheKey = JSON.stringify(query.query);
    const queryCache = this.cache[queryCacheKey];

    if (!queryCache) {
      return {
        result: {} as T,
        complete: false,
        missing: [new MissingFieldError("", {}, query.query, query.variables)],
      };
    }

    const result = queryCache[fastStringify(query.variables)];
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
  watch<TData = any, TVariables = any>(
    watch: Cache.WatchOptions<TData, TVariables>
  ): () => void {
    console.log({ fashionEvent: "watch" });
    return () => {};
  }
  reset(options?: Cache.ResetOptions): Promise<void> {
    console.log({ fashionEvent: "reset" });
    this.cache = {};
    return Promise.resolve();
  }
  evict(options: Cache.EvictOptions): boolean {
    console.log({ fashionEvent: "evict" });
    return false;
  }
  restore(serializedState: any): ApolloCache<SimpleCacheObject> {
    console.log({ fashionEvent: "restore" });
    this.cache = serializedState;
    return this;
  }
  extract(optimistic?: boolean): SimpleCacheObject {
    console.log({ fashionEvent: "extract" });
    console.log(this.cache);
    return this.cache;
  }
  removeOptimistic(id: string): void {
    console.log({ fashionEvent: "removeOptimistic" });
  }
  performTransaction(
    transaction: Transaction<any>,
    optimisticId?: string | null
  ): void {
    console.log({ fashionEvent: "performTransaction" });
    console.log({ transaction });
    transaction(this);
  }
  transformDocument(document: DocumentNode): DocumentNode {
    return this.imc.transformDocument(document);
  }
}
