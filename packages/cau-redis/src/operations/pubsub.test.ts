import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { RedisDb } from "../index";
import { ENV } from "../config";

describe("pubsub operations", () => {
  let publisher: RedisDb;
  let subscriber: RedisDb;

  beforeAll(async () => {
    publisher = RedisDb.create({ url: ENV.REDIS_URL });
    await publisher.connect();

    subscriber = RedisDb.create({ url: ENV.REDIS_URL });
    await subscriber.connect();
  });

  afterAll(async () => {
    await subscriber.close();
    await publisher.close();
  });

  it("should publish and receive a message", async () => {
    const channel = "cauRedisTest:pubsub:ch1";
    const testMessage = "hello-pubsub";
    let receivedMessage = "";

    await subscriber.subscribe({
      channel,
      onMessage: (message) => {
        receivedMessage = message;
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    await publisher.publish({ channel, message: testMessage });

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(receivedMessage).toBe(testMessage);

    await subscriber.unsubscribe({ channel });
  });

  it("should return receiver count from publish", async () => {
    const channel = "cauRedisTest:pubsub:ch2";

    await subscriber.subscribe({
      channel,
      onMessage: () => {},
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    const receivers = await publisher.publish({
      channel,
      message: "count-test",
    });

    expect(receivers).toBeGreaterThanOrEqual(1);

    await subscriber.unsubscribe({ channel });
  });

  it("should return 0 receivers when no subscribers", async () => {
    const channel = "cauRedisTest:pubsub:noSubs";

    const receivers = await publisher.publish({
      channel,
      message: "nobody-listening",
    });

    expect(receivers).toBe(0);
  });

  it("should unsubscribe from a channel", async () => {
    const channel = "cauRedisTest:pubsub:ch3";
    let messageCount = 0;

    await subscriber.subscribe({
      channel,
      onMessage: () => {
        messageCount++;
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 200));
    await publisher.publish({ channel, message: "before-unsub" });
    await new Promise((resolve) => setTimeout(resolve, 300));

    const countBeforeUnsub = messageCount;

    await subscriber.unsubscribe({ channel });
    await new Promise((resolve) => setTimeout(resolve, 200));

    await publisher.publish({ channel, message: "after-unsub" });
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(countBeforeUnsub).toBe(1);
    expect(messageCount).toBe(1);
  });
});
