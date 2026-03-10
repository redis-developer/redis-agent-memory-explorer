import { describe, it, expect } from "vitest";

import {
  applyCreateFields,
  applyCreateFieldsMany,
  applyUpdateFields,
  applyActiveFilter,
  buildSoftDeleteUpdate,
} from "./auto-fields.util";
import { DocumentStatus } from "../constants";

describe("applyCreateFields", () => {
  it("should inject status, createdAt, and updatedAt", () => {
    const doc = { name: "Alice" };
    const result = applyCreateFields(doc);

    expect(result.status).toBe(DocumentStatus.ACTIVE);
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
    expect(result.name).toBe("Alice");
  });

  it("should preserve consumer-supplied auto-field values (consumer wins)", () => {
    const customDate = new Date("2020-01-01");
    const doc = { name: "Bob", createdAt: customDate, updatedAt: customDate, status: 0 as const };
    const result = applyCreateFields(doc);

    expect(result.createdAt).toBe(customDate);
    expect(result.updatedAt).toBe(customDate);
    expect(result.status).toBe(0);
  });
});

describe("applyCreateFieldsMany", () => {
  it("should apply auto-fields to every document in the array", () => {
    const docs = [{ name: "Alice" }, { name: "Bob" }];
    const results = applyCreateFieldsMany(docs);

    expect(results).toHaveLength(2);
    results.forEach((doc) => {
      expect(doc.status).toBe(DocumentStatus.ACTIVE);
      expect(doc.createdAt).toBeInstanceOf(Date);
      expect(doc.updatedAt).toBeInstanceOf(Date);
    });
  });
});

describe("applyUpdateFields", () => {
  it("should inject updatedAt into the $set portion", () => {
    const update = { $set: { name: "Updated" } };
    const result = applyUpdateFields(update);

    const $set = result.$set as Record<string, unknown>;
    expect($set.updatedAt).toBeInstanceOf(Date);
    expect($set.name).toBe("Updated");
  });

  it("should create $set if not present", () => {
    const update = { $inc: { count: 1 } };
    const result = applyUpdateFields(update);

    const $set = result.$set as Record<string, unknown>;
    expect($set.updatedAt).toBeInstanceOf(Date);
    expect(result.$inc).toEqual({ count: 1 });
  });

  it("should preserve consumer-supplied updatedAt (consumer wins)", () => {
    const customDate = new Date("2020-01-01");
    const update = { $set: { name: "Updated", updatedAt: customDate } };
    const result = applyUpdateFields(update);

    const $set = result.$set as Record<string, unknown>;
    expect($set.updatedAt).toBe(customDate);
  });
});

describe("applyActiveFilter", () => {
  it("should inject status ACTIVE into the filter", () => {
    const filter = { name: "Alice" };
    const result = applyActiveFilter(filter);

    expect(result.status).toBe(DocumentStatus.ACTIVE);
    expect(result.name).toBe("Alice");
  });

  it("should preserve consumer-supplied status (consumer wins)", () => {
    const filter = { name: "Alice", status: DocumentStatus.INACTIVE };
    const result = applyActiveFilter(filter);

    expect(result.status).toBe(DocumentStatus.INACTIVE);
  });
});

describe("buildSoftDeleteUpdate", () => {
  it("should return an update setting status to INACTIVE and updatedAt to now", () => {
    const before = new Date();
    const result = buildSoftDeleteUpdate();
    const after = new Date();

    const $set = result.$set as Record<string, unknown>;
    expect($set.status).toBe(DocumentStatus.INACTIVE);
    expect($set.updatedAt).toBeInstanceOf(Date);
    expect(($set.updatedAt as Date).getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(($set.updatedAt as Date).getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
