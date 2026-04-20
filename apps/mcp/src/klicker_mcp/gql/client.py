"""Thin async GraphQL client over the KlickerUZH persisted-ops API."""

from __future__ import annotations

from typing import Any, cast

import httpx

from klicker_mcp.gql.ops import OPERATIONS
from klicker_mcp.settings import get_settings

# Module-level shared httpx client. Reused across tool calls so the TCP +
# TLS connection pool survives between invocations — without this, every
# tool call was paying the handshake cost anew. Lives for the lifetime of
# the process; httpx closes its sockets on interpreter shutdown.
_shared_client: httpx.AsyncClient | None = None


def _get_shared_client() -> httpx.AsyncClient:
    global _shared_client
    if _shared_client is None:
        _shared_client = httpx.AsyncClient(timeout=30.0)
    return _shared_client


class GraphQLError(Exception):
    """Raised when the GraphQL response contains a non-empty `errors` array."""

    def __init__(self, errors: list[dict[str, Any]]):
        self.errors = errors
        super().__init__(errors)


class UnknownOperationError(GraphQLError):
    """Raised when a tool asks for an operation that isn't in the persisted manifest."""

    def __init__(self, operation_name: str):
        self.operation_name = operation_name
        super().__init__(
            [
                {
                    "message": (
                        f"Operation {operation_name!r} is not registered as a persisted "
                        "query. Add a .graphql op under packages/graphql/src/graphql/ops/, "
                        "regenerate the graphql package, and run `uv run poe gen-ops`."
                    )
                }
            ]
        )


class AsyncGraphQLClient:
    """Calls operations by name using the APQ persisted-query shape.

    Every request carries the sha256 hash, so the backend's
    `usePersistedOperations` plugin accepts it even in production where ad-hoc
    GraphQL is blocked. Bearer tokens, when provided, are forwarded as the
    `Authorization` header — the backend's `jwtMiddleware` picks them up.
    """

    def __init__(
        self,
        *,
        endpoint: str | None = None,
        client: httpx.AsyncClient | None = None,
        timeout: float = 30.0,  # retained for API compat; shared client has its own timeout
    ) -> None:
        settings = get_settings()
        origin = settings.api_origin.rstrip("/")
        self._endpoint = endpoint or f"{origin}/api/graphql"
        self._client = client or _get_shared_client()
        self._owns_client = False

    @property
    def endpoint(self) -> str:
        return self._endpoint

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def __aenter__(self) -> AsyncGraphQLClient:
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.aclose()

    async def execute(
        self,
        operation_name: str,
        variables: dict[str, Any] | None = None,
        *,
        bearer_token: str | None = None,
    ) -> dict[str, Any]:
        """Execute an operation by name. Returns the `data` object on success."""
        sha = OPERATIONS.get(operation_name)
        if sha is None:
            raise UnknownOperationError(operation_name)

        body: dict[str, Any] = {
            "operationName": operation_name,
            "variables": variables or {},
            "extensions": {"persistedQuery": {"version": 1, "sha256Hash": sha}},
        }

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "x-graphql-yoga-csrf": "true",
        }
        if bearer_token:
            headers["Authorization"] = f"Bearer {bearer_token}"

        resp = await self._client.post(self._endpoint, json=body, headers=headers)
        resp.raise_for_status()
        payload: dict[str, Any] = resp.json()

        if payload.get("errors"):
            raise GraphQLError(payload["errors"])
        data_raw = payload.get("data")
        if isinstance(data_raw, dict):
            return cast(dict[str, Any], data_raw)
        empty: dict[str, Any] = {}
        return empty
