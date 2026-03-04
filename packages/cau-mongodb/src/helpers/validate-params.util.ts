import type { ZodType, ZodIssue } from "zod";
import type { ValidationContext } from "../types";

import { ZodError } from "zod";

import { MongoDbValidationError } from "../errors";

const validateWithSchema = <T>(
  data: unknown,
  schema: ZodType<T>,
  context: ValidationContext,
): T => {
  let result: T;

  try {
    result = schema.parse(data);
  } catch (err) {
    const zodError = err as ZodError;
    const message = `Validation failed for "${context.collection}.${context.operation}": ${zodError.issues.map((i) => i.message).join(", ")}`;
    context.logger.warn(message, {
      collection: context.collection,
      operation: context.operation,
      issues: zodError.issues as unknown as Record<string, unknown>[],
    });
    throw new MongoDbValidationError(
      message,
      zodError.issues,
      context.collection,
      context.operation,
    );
  }

  return result;
};

const validateManyWithSchema = <T>(
  docs: unknown[],
  schema: ZodType<T>,
  context: ValidationContext,
): T[] => {
  const allIssues: ZodIssue[] = [];
  const validated: T[] = [];

  docs.forEach((doc, index) => {
    try {
      validated.push(schema.parse(doc));
    } catch (err) {
      const zodError = err as ZodError;
      zodError.issues.forEach((issue) => {
        allIssues.push({
          ...issue,
          path: [index, ...issue.path],
        });
      });
    }
  });

  const hasErrors = allIssues.length > 0;

  if (hasErrors) {
    const message = `Validation failed for "${context.collection}.${context.operation}": ${allIssues.map((i) => i.message).join(", ")}`;
    context.logger.warn(message, {
      collection: context.collection,
      operation: context.operation,
      issues: allIssues as unknown as Record<string, unknown>[],
    });
    throw new MongoDbValidationError(
      message,
      allIssues,
      context.collection,
      context.operation,
    );
  }

  return validated;
};

export { validateWithSchema, validateManyWithSchema };
