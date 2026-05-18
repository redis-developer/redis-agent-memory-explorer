import { HTTPError } from 'ky';
import {
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  APIError,
} from './errors';
import {
  ContextSurfaceSchema,
  ListContextSurfacesResponseSchema,
  AdminAPIKeySchema,
  AgentAPIKeySchema,
  ListAgentKeysResponseSchema,
  RedisInstanceSchema,
  ListRedisInstancesResponseSchema,
  TestConnectionResponseSchema,
  HealthResponseSchema,
  AuthResponseSchema,
  UserSchema,
  type ContextSurface,
  type AdminAPIKey,
  type AgentAPIKey,
  type RedisInstance,
  type HealthResponse,
  type AuthResponse,
  type User,
  type TestConnectionResponse,
  type RedisConnectionConfig,
} from './schemas';
import { createHttpClient, type HttpClient } from './utils/fetch';

export interface ClientConfig {
  baseUrl: string;
  apiKey?: string;
  accessToken?: string;
  timeout?: number;
  retries?: number;
}

export class CloudContextSurfaceClient {
  private config: ClientConfig;
  private httpClient: HttpClient;

  constructor(config: ClientConfig) {
    this.config = config;
    this.httpClient = createHttpClient({
      baseUrl: config.baseUrl,
      timeout: config.timeout ?? 30000,
      retries: config.retries ?? 3,
    });
  }

  private getAuthHeaders(): Record<string, string> {
    if (this.config.accessToken) {
      return { Authorization: `Bearer ${this.config.accessToken}` };
    }
    if (this.config.apiKey) {
      return { 'X-API-Key': this.config.apiKey };
    }
    return {};
  }

  private async handleError(error: unknown): Promise<never> {
    if (error instanceof HTTPError) {
      const response = error.response;
      const status = response.status;
      let body: Record<string, unknown> = {};

      try {
        body = await response.json() as Record<string, unknown>;
      } catch {
        // Response body is not JSON
      }

      const message = (body.message as string) || (body.error as string) || response.statusText;

      switch (status) {
        case 401:
          throw new AuthenticationError(message);
        case 403:
          throw new ForbiddenError(message);
        case 404:
          throw new NotFoundError(message);
        case 400:
        case 422:
          throw new ValidationError(message, body);
        case 429: {
          const retryAfter = response.headers.get('Retry-After');
          throw new RateLimitError(message, retryAfter ? parseInt(retryAfter, 10) : undefined);
        }
        default:
          throw new APIError(message, status, body);
      }
    }
    throw error;
  }

  setAccessToken(token: string): void {
    this.config.accessToken = token;
  }

  // Context Surface methods
  async listContextSurfaces(params?: { page?: number; page_size?: number }) {
    try {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.page_size) searchParams.set('page_size', String(params.page_size));

      const response = await this.httpClient
        .get('api/v1/context-surfaces', {
          headers: this.getAuthHeaders(),
          searchParams,
        })
        .json();

      return ListContextSurfacesResponseSchema.parse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getContextSurface(id: string): Promise<ContextSurface> {
    try {
      const response = await this.httpClient
        .get(`api/v1/context-surfaces/${id}`, { headers: this.getAuthHeaders() })
        .json();

      return ContextSurfaceSchema.parse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async createContextSurface(data: {
    name: string;
    description?: string;
    redis_instance_id?: string;
    metadata?: Record<string, string>;
  }): Promise<ContextSurface> {
    try {
      const response = await this.httpClient
        .post('api/v1/context-surfaces', { headers: this.getAuthHeaders(), json: data })
        .json();

      return ContextSurfaceSchema.parse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async updateContextSurface(
    id: string,
    data: { name?: string; description?: string; metadata?: Record<string, string> }
  ): Promise<ContextSurface> {
    try {
      const response = await this.httpClient
        .put(`api/v1/context-surfaces/${id}`, { headers: this.getAuthHeaders(), json: data })
        .json();

      return ContextSurfaceSchema.parse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async deleteContextSurface(id: string): Promise<void> {
    try {
      await this.httpClient.delete(`api/v1/context-surfaces/${id}`, { headers: this.getAuthHeaders() });
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Agent Key methods
  async listAgentKeys(contextSurfaceId: string, params?: { page?: number; page_size?: number }) {
    try {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.page_size) searchParams.set('page_size', String(params.page_size));

      const response = await this.httpClient
        .get(`api/v1/context-surfaces/${contextSurfaceId}/agent-keys`, {
          headers: this.getAuthHeaders(),
          searchParams,
        })
        .json();

      return ListAgentKeysResponseSchema.parse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async createAgentKey(
    contextSurfaceId: string,
    data: {
      name: string;
      description?: string;
      expires_at?: string;
      metadata?: Record<string, string>;
    }
  ): Promise<AgentAPIKey> {
    try {
      const response = await this.httpClient
        .post(`api/v1/context-surfaces/${contextSurfaceId}/agent-keys`, {
          headers: this.getAuthHeaders(),
          json: data,
        })
        .json();

      return AgentAPIKeySchema.parse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Admin Key methods
  async createAdminKey(data: {
    name: string;
    owner: string;
    description?: string;
    metadata?: Record<string, string>;
  }): Promise<AdminAPIKey> {
    try {
      const response = await this.httpClient
        .post('api/v1/keys', { headers: this.getAuthHeaders(), json: data })
        .json();

      return AdminAPIKeySchema.parse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async validateAdminKey(): Promise<AdminAPIKey> {
    try {
      const response = await this.httpClient
        .post('api/v1/keys/validate', { headers: this.getAuthHeaders() })
        .json();

      return AdminAPIKeySchema.parse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Redis Instance methods
  async listRedisInstances() {
    try {
      const response = await this.httpClient
        .get('api/v1/redis-instances', { headers: this.getAuthHeaders() })
        .json();

      return ListRedisInstancesResponseSchema.parse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getRedisInstance(id: string): Promise<RedisInstance> {
    try {
      const response = await this.httpClient
        .get(`api/v1/redis-instances/${id}`, { headers: this.getAuthHeaders() })
        .json();

      return RedisInstanceSchema.parse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async createRedisInstance(data: {
    name: string;
    description?: string;
    connection_config: RedisConnectionConfig;
    metadata?: Record<string, string>;
  }): Promise<RedisInstance> {
    try {
      const response = await this.httpClient
        .post('api/v1/redis-instances', { headers: this.getAuthHeaders(), json: data })
        .json();

      return RedisInstanceSchema.parse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async deleteRedisInstance(id: string): Promise<void> {
    try {
      await this.httpClient.delete(`api/v1/redis-instances/${id}`, { headers: this.getAuthHeaders() });
    } catch (error) {
      return this.handleError(error);
    }
  }

  async testRedisConnection(config: RedisConnectionConfig): Promise<TestConnectionResponse> {
    try {
      const response = await this.httpClient
        .post('api/v1/redis-instances/test-connection', {
          headers: this.getAuthHeaders(),
          json: config,
        })
        .json();

      return TestConnectionResponseSchema.parse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Auth methods (JWT only)
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await this.httpClient
        .post('api/v1/auth/login', { json: { email, password } })
        .json();

      return AuthResponseSchema.parse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async register(email: string, password: string, name: string): Promise<AuthResponse> {
    try {
      const response = await this.httpClient
        .post('api/v1/auth/register', { json: { email, password, name } })
        .json();

      return AuthResponseSchema.parse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      const response = await this.httpClient
        .post('api/v1/auth/refresh', { json: { refresh_token: refreshToken } })
        .json();

      return AuthResponseSchema.parse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getCurrentUser(): Promise<User> {
    try {
      const response = await this.httpClient
        .get('api/v1/auth/me', { headers: this.getAuthHeaders() })
        .json();

      return UserSchema.parse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async updateProfile(data: { name: string }): Promise<User> {
    try {
      const response = await this.httpClient
        .patch('api/v1/auth/me', { headers: this.getAuthHeaders(), json: data })
        .json();

      return UserSchema.parse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      await this.httpClient.post('api/v1/auth/change-password', {
        headers: this.getAuthHeaders(),
        json: { current_password: currentPassword, new_password: newPassword },
      });
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Health methods
  async getHealth(): Promise<HealthResponse> {
    try {
      const response = await this.httpClient.get('health').json();
      return HealthResponseSchema.parse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getLiveness(): Promise<HealthResponse> {
    try {
      const response = await this.httpClient.get('liveness').json();
      return HealthResponseSchema.parse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getReadiness(): Promise<HealthResponse> {
    try {
      const response = await this.httpClient.get('readiness').json();
      return HealthResponseSchema.parse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }
}
