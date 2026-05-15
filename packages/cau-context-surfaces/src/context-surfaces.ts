import type {
  ContextSurfacesConfig,
  CreateSurfaceInput,
  UpdateSurfaceInput,
  Surface,
  ListSurfacesResult,
  CreateAgentKeyInput,
  AgentKey,
  ListAgentKeysResult,
  McpInitResult,
  McpTool,
  McpToolResult,
  LoadRecordsInput,
  LoadRecordsResult,
  ListOptions,
  KeyValidation,
  HealthResult,
} from "./types";
import type { McpOperationConfig } from "./operations/mcp";
import type { DataLoaderConfig } from "./operations/data-loader";

import { CloudContextSurfaceClient } from "@cloud-context-engine/client";

import { DEFAULT_ADMIN_API_URL, DEFAULT_MCP_URL, DEFAULT_TIMEOUT_MS, DEFAULT_MAX_RETRIES } from "./constants";
import { ENV } from "./config";
import { fetchAdminApi } from "./http";
import { initializeMcp, listTools, callTool } from "./operations/mcp";
import { loadRecords } from "./operations/data-loader";

const resolveConfig = (config?: ContextSurfacesConfig): Required<ContextSurfacesConfig> => {
  return {
    adminApiUrl: config?.adminApiUrl || ENV.CTX_ADMIN_API_URL || DEFAULT_ADMIN_API_URL,
    mcpUrl: config?.mcpUrl || ENV.CTX_MCP_URL || DEFAULT_MCP_URL,
    adminKey: config?.adminKey || ENV.CTX_ADMIN_KEY,
    agentKey: config?.agentKey || ENV.MCP_AGENT_KEY,
    timeout: config?.timeout ?? DEFAULT_TIMEOUT_MS,
    retries: config?.retries ?? DEFAULT_MAX_RETRIES,
  };
};

const mapSdkSurfaceToSurface = (sdkSurface: Record<string, unknown>): Surface => {
  return {
    id: sdkSurface.id as string,
    name: sdkSurface.name as string,
    description: sdkSurface.description as string | undefined,
    owner: sdkSurface.owner as string,
    status: sdkSurface.status as string | undefined,
    statusReason: sdkSurface.status_reason as string | undefined,
    tools: sdkSurface.tools as string[] | undefined,
    dataModel: sdkSurface.data_model as Surface["dataModel"],
    metadata: sdkSurface.metadata as Record<string, string> | undefined,
    createdAt: sdkSurface.created_at as string,
    updatedAt: sdkSurface.updated_at as string,
  };
};

const mapSdkAgentKeyToAgentKey = (sdkKey: Record<string, unknown>): AgentKey => {
  return {
    id: sdkKey.id as string,
    key: sdkKey.key as string,
    name: sdkKey.name as string,
    contextSurfaceId: sdkKey.context_surface_id as string,
    description: sdkKey.description as string | undefined,
    metadata: sdkKey.metadata as Record<string, string> | undefined,
    createdAt: sdkKey.created_at as string,
    expiresAt: (sdkKey.expires_at as string | null) ?? undefined,
  };
};

const buildSnakeCaseDataModel = (dataModel: CreateSurfaceInput["dataModel"]): Record<string, unknown> | undefined => {
  const hasNoModel = dataModel === undefined;
  if (hasNoModel) {
    return undefined;
  }

  return {
    title: dataModel.title,
    description: dataModel.description,
    entity_count: dataModel.entityCount,
    entities: dataModel.entities.map((entity) => ({
      name: entity.name,
      description: entity.description,
      redis_key_template: entity.redisKeyTemplate,
      fields: entity.fields?.map((field) => ({
        name: field.name,
        type: field.type,
        description: field.description,
        mutable: field.mutable,
        is_key_component: field.isKeyComponent,
        redis_indices: field.redisIndices?.map((idx) => ({
          type: idx.type,
          weight: idx.weight,
          no_stem: idx.noStem,
          sortable: idx.sortable,
          vector_dim: idx.vectorDim,
          distance_metric: idx.distanceMetric,
        })),
      })),
      relationships: entity.relationships?.map((rel) => ({
        name: rel.name,
        target: rel.target,
        description: rel.description,
        source_field: rel.sourceField,
      })),
    })),
  };
};

const buildSnakeCaseDataSource = (dataSource: CreateSurfaceInput["dataSource"]): Record<string, unknown> | undefined => {
  const hasNoSource = dataSource === undefined;
  if (hasNoSource) {
    return undefined;
  }

  return {
    type: dataSource.type,
    name: dataSource.name,
    connection_config: {
      addr: dataSource.connectionConfig.addr,
      username: dataSource.connectionConfig.username,
      password: dataSource.connectionConfig.password,
      db: dataSource.connectionConfig.db,
      tls_enabled: dataSource.connectionConfig.tlsEnabled,
      pool_size: dataSource.connectionConfig.poolSize,
      min_idle_conns: dataSource.connectionConfig.minIdleConns,
    },
  };
};

const createSurfaceViaApi = async (
  adminApiUrl: string,
  adminKey: string,
  timeout: number,
  input: CreateSurfaceInput,
): Promise<Surface> => {
  const body: Record<string, unknown> = {
    name: input.name,
    description: input.description,
    metadata: input.metadata,
    data_model: buildSnakeCaseDataModel(input.dataModel),
    data_source: buildSnakeCaseDataSource(input.dataSource),
  };

  const responseBody = await fetchAdminApi({
    adminApiUrl,
    adminKey,
    timeout,
    path: "/api/v1/context-surfaces",
    method: "POST",
    body,
  });

  return mapSdkSurfaceToSurface(responseBody);
};

class ContextSurfaces {
  static #instance: ContextSurfaces | null = null;

  #sdkClient: CloudContextSurfaceClient;
  #config: Required<ContextSurfacesConfig>;
  #agentKey: string;

  private constructor(
    sdkClient: CloudContextSurfaceClient,
    config: Required<ContextSurfacesConfig>,
  ) {
    this.#sdkClient = sdkClient;
    this.#config = config;
    this.#agentKey = config.agentKey;
  }

  static create = (config?: ContextSurfacesConfig): ContextSurfaces => {
    const resolved = resolveConfig(config);

    const sdkClient = new CloudContextSurfaceClient({
      baseUrl: resolved.adminApiUrl,
      apiKey: resolved.adminKey,
      timeout: resolved.timeout,
      retries: resolved.retries,
    });

    const instance = new ContextSurfaces(sdkClient, resolved);
    ContextSurfaces.#instance = instance;

    return instance;
  };

  static getInstance = (): ContextSurfaces => {
    const isNotInitialized = ContextSurfaces.#instance === null;
    if (isNotInitialized) {
      throw new Error("ContextSurfaces not initialized. Call ContextSurfaces.create() first.");
    }

    return ContextSurfaces.#instance!;
  };

  // ── Surface Management (Admin Key) ──

  createSurface = async (input: CreateSurfaceInput): Promise<Surface> => {
    return createSurfaceViaApi(
      this.#config.adminApiUrl,
      this.#config.adminKey,
      this.#config.timeout,
      input,
    );
  };

  getSurface = async (surfaceId: string): Promise<Surface> => {
    const sdkResult = await this.#sdkClient.getContextSurface(surfaceId);

    return mapSdkSurfaceToSurface(sdkResult as unknown as Record<string, unknown>);
  };

  listSurfaces = async (options?: ListOptions): Promise<ListSurfacesResult> => {
    const sdkResult = await this.#sdkClient.listContextSurfaces({
      page: options?.page,
      page_size: options?.pageSize,
    });

    const result = sdkResult as unknown as Record<string, unknown>;
    const surfaces = (result.context_surfaces as Array<Record<string, unknown>>) ?? [];

    return {
      surfaces: surfaces.map(mapSdkSurfaceToSurface),
      pagination: result.pagination as ListSurfacesResult["pagination"],
    };
  };

  updateSurface = async (surfaceId: string, input: UpdateSurfaceInput): Promise<Surface> => {
    const sdkResult = await this.#sdkClient.updateContextSurface(surfaceId, {
      name: input.name,
      description: input.description,
      metadata: input.metadata,
    });

    return mapSdkSurfaceToSurface(sdkResult as unknown as Record<string, unknown>);
  };

  deleteSurface = async (surfaceId: string): Promise<void> => {
    await this.#sdkClient.deleteContextSurface(surfaceId);
  };

  // ── Agent Key Management (Admin Key) ──

  createAgentKey = async (surfaceId: string, input: CreateAgentKeyInput): Promise<AgentKey> => {
    const sdkResult = await this.#sdkClient.createAgentKey(surfaceId, {
      name: input.name,
      description: input.description,
      expires_at: input.expiresAt,
      metadata: input.metadata,
    });

    return mapSdkAgentKeyToAgentKey(sdkResult as unknown as Record<string, unknown>);
  };

  listAgentKeys = async (surfaceId: string, options?: ListOptions): Promise<ListAgentKeysResult> => {
    const sdkResult = await this.#sdkClient.listAgentKeys(surfaceId, {
      page: options?.page,
      page_size: options?.pageSize,
    });

    const result = sdkResult as unknown as Record<string, unknown>;
    const agentKeys = (result.agent_keys as Array<Record<string, unknown>>) ?? [];

    return {
      agentKeys: agentKeys.map(mapSdkAgentKeyToAgentKey),
      pagination: result.pagination as ListAgentKeysResult["pagination"],
    };
  };

  setAgentKey = (agentKey: string): void => {
    this.#agentKey = agentKey;
  };

  // ── MCP Tools (Agent Key) ──

  #getMcpConfig = (): McpOperationConfig => {
    const hasNoAgentKey = !this.#agentKey;
    if (hasNoAgentKey) {
      throw new Error("Agent key is required for MCP operations. Call setAgentKey() first.");
    }

    return {
      mcpUrl: this.#config.mcpUrl,
      agentKey: this.#agentKey,
      timeout: this.#config.timeout,
    };
  };

  initializeMcp = async (): Promise<McpInitResult> => {
    const config = this.#getMcpConfig();

    return initializeMcp(config);
  };

  listTools = async (): Promise<McpTool[]> => {
    const config = this.#getMcpConfig();

    return listTools(config);
  };

  callTool = async (name: string, args?: Record<string, unknown>): Promise<McpToolResult> => {
    const config = this.#getMcpConfig();

    return callTool(config, name, args);
  };

  // ── Data Loading (Admin Key) ──

  #getDataLoaderConfig = (): DataLoaderConfig => {
    return {
      adminApiUrl: this.#config.adminApiUrl,
      adminKey: this.#config.adminKey,
      timeout: this.#config.timeout,
    };
  };

  loadRecords = async (surfaceId: string, input: LoadRecordsInput): Promise<LoadRecordsResult> => {
    const config = this.#getDataLoaderConfig();

    return loadRecords(config, surfaceId, input);
  };

  // ── Utility ──

  validateKey = async (): Promise<KeyValidation> => {
    const sdkResult = await this.#sdkClient.validateAdminKey();
    const result = sdkResult as unknown as Record<string, unknown>;

    return {
      valid: (result.valid as boolean) ?? true,
      owner: result.owner as string | undefined,
    };
  };

  health = async (): Promise<HealthResult> => {
    const sdkResult = await this.#sdkClient.getHealth();
    const result = sdkResult as unknown as Record<string, unknown>;

    return {
      status: result.status as string,
      version: result.version as string | undefined,
    };
  };

  close = async (): Promise<void> => {
    const isSingleton = ContextSurfaces.#instance === this;
    if (isSingleton) {
      ContextSurfaces.#instance = null;
    }
  };
}

export { ContextSurfaces };
