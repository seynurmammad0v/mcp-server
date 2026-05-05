/**
 * IcePanel API client
 */

import type { ModelObjectsResponse, ModelObjectResponse, CatalogTechnologyResponse, TeamsResponse, ModelConnectionsResponse } from "./types.js";

// Base URL for the IcePanel API
// Use environment variable if set, otherwise default to production URL
const API_BASE_URL = process.env.ICEPANEL_API_BASE_URL || "https://api.icepanel.io/v1";

// Auth: prefer a short-lived Bearer JWT (sourced from the IcePanel SPA) if available,
// otherwise fall back to a long-lived API key.
//   ICEPANEL_BEARER_TOKEN_FILE — path to a file whose contents are a JWT (re-read each request)
//   ICEPANEL_BEARER_TOKEN      — JWT directly in env
//   API_KEY                    — IcePanel API key (existing upstream behaviour)
import { readFileSync } from "node:fs";

const API_KEY = process.env.API_KEY;
const BEARER_TOKEN_INLINE = process.env.ICEPANEL_BEARER_TOKEN;
const BEARER_TOKEN_FILE = process.env.ICEPANEL_BEARER_TOKEN_FILE;

function authHeader(): string {
  if (BEARER_TOKEN_FILE) {
    const t = readFileSync(BEARER_TOKEN_FILE, "utf8").trim();
    if (t) return `Bearer ${t}`;
  }
  if (BEARER_TOKEN_INLINE) return `Bearer ${BEARER_TOKEN_INLINE}`;
  if (API_KEY) return `ApiKey ${API_KEY}`;
  throw new Error("No IcePanel auth configured: set ICEPANEL_BEARER_TOKEN_FILE, ICEPANEL_BEARER_TOKEN, or API_KEY");
}

/**
 * Make an authenticated request to the IcePanel API
 */
async function apiRequest(path: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${path}`;

  const headers = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Authorization": authHeader(),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`IcePanel API error: ${response.status} ${response.statusText}${errBody ? ` — ${errBody}` : ""}`);
  }

  if (response.status === 204) return {};
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

/**
 * Get all landscapes
 */
export async function getLandscapes(organizationId: string) {
  return apiRequest(`/organizations/${organizationId}/landscapes`);
}

/**
 * Get a specific landscape
 */
export async function getLandscape(organizationId: string, landscapeId: string) {
  return apiRequest(`/organizations/${organizationId}/landscapes/${landscapeId}`);
}

/**
 * Get a specific version
 */
export async function getVersion(landscapeId: string, versionId: string = "latest") {
  return apiRequest(`/landscapes/${landscapeId}/versions/${versionId}`);
}

/**
 * Get catalog technologies
 *
 * Retrieves a list of technologies from the IcePanel catalog
 *
 * @param options - Filter options for the catalog technologies
 * @param options.filter.provider - Filter by provider (aws, azure, gcp, etc.)
 * @param options.filter.type - Filter by technology type (data-storage, deployment, etc.)
 * @param options.filter.restrictions - Filter by restrictions (actor, app, component, etc.)
 * @param options.filter.status - Filter by status (approved, pending-review, rejected)
 * @returns Promise with catalog technologies response
 */
export async function getCatalogTechnologies(
  options: {
    filter?: {
      provider?: string | string[] | null,
      type?: string | string[] | null,
      restrictions?: string | string[],
      status?: string | string[]
    }
  } = {}
) {
  const params = new URLSearchParams();

  if (options.filter) {
    const filter = options.filter;

    // Convert filter object to query parameters
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          // Handle array values
          value.forEach(item => {
            params.append(`filter[${key}][]`, item);
          });
        } else if (value === null) {
          // Handle null values
          params.append(`filter[${key}]`, 'null');
        } else {
          // Handle simple values
          params.append(`filter[${key}]`, String(value));
        }
      }
    });
  }

  const queryString = params.toString();
  const url = `/catalog/technologies${queryString ? `?${queryString}` : ''}`;

  return apiRequest(url) as Promise<CatalogTechnologyResponse>;
}

/**
 * Get organization technologies
 *
 * Retrieves a list of technologies from an organization
 *
 * @param organizationId - The ID of the organization
 * @param options - Filter options for the organization technologies
 * @param options.filter.provider - Filter by provider (aws, azure, gcp, etc.)
 * @param options.filter.type - Filter by technology type (data-storage, deployment, etc.)
 * @param options.filter.restrictions - Filter by restrictions (actor, app, component, etc.)
 * @param options.filter.status - Filter by status (approved, pending-review, rejected)
 * @returns Promise with catalog technologies response
 */
export async function getOrganizationTechnologies(
  organizationId: string,
  options: {
    filter?: {
      provider?: string | string[] | null,
      type?: string | string[] | null,
      restrictions?: string | string[],
      status?: string | string[]
    }
  } = {}
) {
  const params = new URLSearchParams();

  if (options.filter) {
    const filter = options.filter;

    // Convert filter object to query parameters
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          // Handle array values
          value.forEach(item => {
            params.append(`filter[${key}][]`, item);
          });
        } else if (value === null) {
          // Handle null values
          params.append(`filter[${key}]`, 'null');
        } else {
          // Handle simple values
          params.append(`filter[${key}]`, String(value));
        }
      }
    });
  }

  const queryString = params.toString();
  const url = `/organizations/${organizationId}/technologies${queryString ? `?${queryString}` : ''}`;

  return apiRequest(url) as Promise<CatalogTechnologyResponse>;
}

/**
 * Get teams for an organization
 *
 * Retrieves a list of teams from an organization
 *
 * @param organizationId - The ID of the organization
 * @returns Promise with teams response
 */
export async function getTeams(organizationId: string) {
  return apiRequest(`/organizations/${organizationId}/teams`) as Promise<TeamsResponse>;
}

/**
 * Get all model objects for a landscape version
 */
export async function getModelObjects(
  landscapeId: string,
  versionId: string = "latest",
  options: { filter?: {
    domainId?: string | string[],
    external?: boolean,
    handleId?: string | string[],
    labels?: Record<string, string>,
    name?: string,
    parentId?: string | null,
    status?: string | string[],
    type?: string | string[]
  }} = {}
): Promise<ModelObjectsResponse> {
  const params = new URLSearchParams();

  if (options.filter) {
    const filter = options.filter;

    // Convert filter object to query parameters
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'labels' && typeof value === 'object') {
          // Handle labels object
          Object.entries(value as Record<string, string>).forEach(([labelKey, labelValue]) => {
            params.append(`filter[labels][${labelKey}]`, labelValue);
          });
        } else if (Array.isArray(value)) {
          // Handle array values
          value.forEach(item => {
            params.append(`filter[${key}][]`, item);
          });
        } else if (value === null) {
          // Handle null values
          params.append(`filter[${key}]`, 'null');
        } else {
          // Handle simple values
          params.append(`filter[${key}]`, String(value));
        }
      }
    });
  }

  const queryString = params.toString();
  const url = `/landscapes/${landscapeId}/versions/${versionId}/model/objects${queryString ? `?${queryString}` : ''}`;

  return apiRequest(url) as Promise<ModelObjectsResponse>;
}

/**
 * Get a specific model object
 */
export async function getModelObject(landscapeId: string, modelObjectId: string, versionId: string = "latest") {
  return apiRequest(`/landscapes/${landscapeId}/versions/${versionId}/model/objects/${modelObjectId}`) as Promise<ModelObjectResponse>;
}

/**
 * Get all model connections
 *
 * Retrieves a list of connections between model objects
 *
 * @param landscapeId - The ID of the landscape
 * @param versionId - The ID of the version (defaults to "latest")
 * @param options - Filter options for the model connections
 * @param options.filter.direction - Filter by connection direction (outgoing, bidirectional)
 * @param options.filter.handleId - Filter by handle ID
 * @param options.filter.labels - Filter by labels
 * @param options.filter.name - Filter by name
 * @param options.filter.originId - Filter by origin ID
 * @param options.filter.status - Filter by status (deprecated, future, live, removed)
 * @param options.filter.targetId - Filter by target ID
 * @returns Promise with model connections response
 */
export async function getModelConnections(
  landscapeId: string,
  versionId: string = "latest",
  options: {
    filter?: {
      direction?: 'outgoing' | 'bidirectional' | null,
      handleId?: string | string[],
      labels?: Record<string, string>,
      name?: string,
      originId?: string | string[],
      status?: ('deprecated' | 'future' | 'live' | 'removed') | ('deprecated' | 'future' | 'live' | 'removed')[],
      targetId?: string | string[]
    }
  } = {}
): Promise<ModelConnectionsResponse> {
  const params = new URLSearchParams();

  if (options.filter) {
    const filter = options.filter;

    // Convert filter object to query parameters
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'labels' && typeof value === 'object') {
          // Handle labels object
          Object.entries(value as Record<string, string>).forEach(([labelKey, labelValue]) => {
            params.append(`filter[labels][${labelKey}]`, labelValue);
          });
        } else if (Array.isArray(value)) {
          // Handle array values
          value.forEach(item => {
            params.append(`filter[${key}][]`, item);
          });
        } else if (value === null) {
          // Handle null values
          params.append(`filter[${key}]`, 'null');
        } else {
          // Handle simple values
          params.append(`filter[${key}]`, String(value));
        }
      }
    });
  }

  const queryString = params.toString();
  const url = `/landscapes/${landscapeId}/versions/${versionId}/model/connections${queryString ? `?${queryString}` : ''}`;

  return apiRequest(url) as Promise<ModelConnectionsResponse>;
}

/**
 * Get a specific connection
 */
export async function getConnection(landscapeId: string, versionId: string, connectionId: string) {
  return apiRequest(`/landscapes/${landscapeId}/versions/${versionId}/model/connections/${connectionId}`);
}

// ---------------------------------------------------------------------------
// Write endpoints (fork additions: diagrams, flows, domains)
// ---------------------------------------------------------------------------

export type CreateDiagramBody = {
  index: number;
  modelId: string;
  name: string;
  type: "app-diagram" | "component-diagram" | "context-diagram";
  description?: string;
  groupId?: string | null;
  parentId?: string | null;
  labels?: Record<string, string>;
  pinned?: boolean;
  handleId?: string;
};

export async function createDiagram(
  landscapeId: string,
  versionId: string,
  body: CreateDiagramBody,
) {
  return apiRequest(
    `/landscapes/${landscapeId}/versions/${versionId}/diagrams`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function deleteDiagram(
  landscapeId: string,
  versionId: string,
  diagramId: string,
) {
  return apiRequest(
    `/landscapes/${landscapeId}/versions/${versionId}/diagrams/${diagramId}`,
    { method: "DELETE" },
  );
}

export type CreateFlowBody = {
  name: string;
  diagramId: string;
  index?: number;
  labels?: Record<string, string>;
  showAllSteps?: boolean;
  showConnectionNames?: boolean;
  pinned?: boolean;
  handleId?: string;
};

export async function createFlow(
  landscapeId: string,
  versionId: string,
  body: CreateFlowBody,
) {
  return apiRequest(
    `/landscapes/${landscapeId}/versions/${versionId}/flows`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function deleteFlow(
  landscapeId: string,
  versionId: string,
  flowId: string,
) {
  return apiRequest(
    `/landscapes/${landscapeId}/versions/${versionId}/flows/${flowId}`,
    { method: "DELETE" },
  );
}

export type CreateDomainBody = {
  name: string;
  index?: number;
  labels?: Record<string, string>;
  handleId?: string;
};

export async function createDomain(
  landscapeId: string,
  versionId: string,
  body: CreateDomainBody,
) {
  return apiRequest(
    `/landscapes/${landscapeId}/versions/${versionId}/domains`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function deleteDomain(
  landscapeId: string,
  versionId: string,
  domainId: string,
) {
  return apiRequest(
    `/landscapes/${landscapeId}/versions/${versionId}/domains/${domainId}`,
    { method: "DELETE" },
  );
}
