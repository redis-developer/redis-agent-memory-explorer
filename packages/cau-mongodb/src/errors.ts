import type { ZodIssue } from "zod";

class MongoDbValidationError extends Error {
  issues: ZodIssue[];
  collection: string;
  operation: string;

  constructor(
    message: string,
    issues: ZodIssue[],
    collection: string,
    operation: string,
  ) {
    super(message);
    this.name = "MongoDbValidationError";
    this.issues = issues;
    this.collection = collection;
    this.operation = operation;
  }
}

class MongoDbConflictError extends Error {
  collection: string;
  operation: string;
  filter: Record<string, unknown>;

  constructor(
    collection: string,
    operation: string,
    filter: Record<string, unknown>,
  ) {
    super(
      `Conflict detected on "${collection}.${operation}": the document was modified by another process since last read. Re-read the document and retry.`,
    );
    this.name = "MongoDbConflictError";
    this.collection = collection;
    this.operation = operation;
    this.filter = filter;
  }
}

export { MongoDbValidationError, MongoDbConflictError };
