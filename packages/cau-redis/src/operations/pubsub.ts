import type { Logger } from "cau-logger";
import type { RedisClientType } from "redis";
import type {
  RedisDbState,
  SubscribeParams,
  PublishParams,
  UnsubscribeParams,
} from "../types";

import { buildClient } from "./connect";

const ensureSubscriberClient = async (
  state: RedisDbState,
): Promise<RedisClientType> => {
  const hasSubscriber =
    state.subscriberClient !== null && state.subscriberClient.isOpen;

  if (!hasSubscriber) {
    const subscriberClient = buildClient(state.config);

    subscriberClient.on("error", (err: Error) => {
      state.logger.error("Redis subscriber client error", {
        error: err.message,
      });
    });

    await subscriberClient.connect();

    state.subscriberClient = subscriberClient;

    state.logger.info("Redis subscriber connection opened");
  }

  return state.subscriberClient!;
};

const subscribe = async (
  state: RedisDbState,
  params: SubscribeParams,
): Promise<void> => {
  const subscriberClient = await ensureSubscriberClient(state);

  await subscriberClient.subscribe(params.channel, (message, channel) => {
    params.onMessage(message, channel);
  });

  state.logger.debug("redis SUBSCRIBE", { channel: params.channel });
};

const publish = async (
  client: RedisClientType,
  logger: Logger,
  params: PublishParams,
): Promise<number> => {
  const result = await client.publish(params.channel, params.message);
  logger.debug("redis PUBLISH", { channel: params.channel });

  return result;
};

const unsubscribe = async (
  state: RedisDbState,
  params: UnsubscribeParams,
): Promise<void> => {
  const hasSubscriber =
    state.subscriberClient !== null && state.subscriberClient.isOpen;

  if (hasSubscriber) {
    await state.subscriberClient!.unsubscribe(params.channel);
    state.logger.debug("redis UNSUBSCRIBE", { channel: params.channel });
  }
};

export { subscribe, publish, unsubscribe };
