import ky from 'ky';

export interface HttpClientOptions {
  baseUrl: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
}

export type HttpClient = ReturnType<typeof ky.create>;

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const {
    baseUrl,
    timeout = 30000,
    retries = 3,
    retryDelay = 1000,
    headers = {},
  } = options;

  return ky.create({
    prefixUrl: baseUrl,
    timeout,
    retry: {
      limit: retries,
      methods: ['get', 'post', 'put', 'patch', 'delete'],
      statusCodes: [408, 429, 500, 502, 503, 504],
      backoffLimit: 10000,
    },
    hooks: {
      beforeRetry: [
        async ({ retryCount }) => {
          const delay = retryDelay * Math.pow(2, retryCount - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        },
      ],
    },
    headers,
  });
}
