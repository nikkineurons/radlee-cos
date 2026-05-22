---
trigger: manual
---

# GLOBAL ARCHITECTURE CONSTRAINTS (GCAF Baseline)
All agents in this workspace must strictly adhere to the following Google Cloud Architecture Framework (GCAF) principles. These rules are absolute and supersede any default agent behaviors.

## 1. System Design & Application Architecture
* **Absolute Statelessness:** All generated application code and agentic reasoning processes MUST be strictly stateless. NEVER rely on local file system persistence or long-term memory for state across sessions.
* **Loose Coupling:** Microservices and Worker Agents must operate independently. Sharing databases or local memory contexts between discrete services is strictly prohibited.
* **Agentic Idempotency:** All generated API endpoints, database mutations, and tool executions MUST be strictly idempotent. Safely handle retry logic without duplicating state.

## 2. Security, Identity & Compliance
* **Zero Hardcoded Secrets:** NEVER generate code that hardcodes API keys, passwords, or connection strings. All secrets must be dynamically fetched at runtime.
* **Strict Least Privilege:** Agents must only use the specific tools provisioned to them for their immediate task. 

## 3. Reliability & Resilience (Self-Healing)
* **Token Budgeting & Infinite Loop Prevention:** All agents operate under a strict step budget. Bounded self-correction (e.g., retrying a failed Pydantic validation) MUST be hard-capped at a maximum of 3 attempts before explicitly routing to the Dead Letter Queue.

## 6. Tooling & Context 
* **Zero-Trust MCP Allowlist:** You must ONLY orchestrate MCP servers that are explicitly listed in the `approved_mcp_packages` array of the project manifest. Do not attempt to use unverified NPM packages.
* **Context Retrieval Before Execution:** Before proposing a `code_diff` for an existing feature, you MUST query the repository map tool to understand the current Abstract Syntax Tree (AST). Do not guess file paths.
* **Strict Contract Adherence:** When building web application components, all agents MUST read the shared `openapi.yaml` file using the provided file reading tool to ensure perfect alignment with the API contract.