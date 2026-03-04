# Skills Index -- custom-agent-utils

This index maps capabilities to packages in the monorepo. Agents consult this file to decide which package(s) to vendor into a target project.

## How to use

1. Read the user's request.
2. Find the matching capability below.
3. Vendor the listed package(s) into the target project's `packages/` folder using **sparse checkout + copy** (see each package's `SKILL.md` for exact commands).
4. Use a **git tag** (preferred) or `main` as the `--branch` ref. Git tags are added to this repo on major changes and serve as version pins.
5. After copying, create a `.vendor.json` provenance file in each vendored package recording the tag and date.
6. Follow the `SKILL.md` inside each package for post-vendoring steps (install, build, optional deps), usage, and rules.

## Packages

| Capability | Package | Path | Vendor to |
|---|---|---|---|
| Structured logging (console, file, MongoDB, SQL) | cau-logger | `packages/cau-logger` | `packages/cau-logger` |
| Zero-boilerplate API server (security, error handling, graceful shutdown) | cau-api-server | `packages/cau-api-server` | `packages/cau-api-server` |

## Capability -> Package Mapping

### Logging

**When the user asks for:** structured logging, request logging, file logging, database logging, log rotation, log redaction, child loggers, multi-transport logging.

**Vendor:** `packages/cau-logger`

**Pairs well with:** Express/Fastify request-id middleware (generate `requestId` for child loggers).

---

### API Server

**When the user asks for:** API server, Express server, REST API, POST endpoints, server setup, server boilerplate, CORS setup, rate limiting, graceful shutdown, health endpoint.

**Vendor:** `packages/cau-api-server`

**Pairs well with:** `cau-logger` (used internally for structured logging and per-request child loggers).

---

*More packages will be added here as they are built (e.g. cau-redis, cau-queue, cau-auth).*
