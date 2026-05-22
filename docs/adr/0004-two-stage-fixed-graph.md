# ADR 0004: Two-Stage Fixed Graph Architecture

## Context
In ADR 0002, we implemented a single-shot execution model to drastically reduce API costs. However, this prevented Radlee from executing "Look, Think, Act" workflows where it needed to read context (e.g., a calendar or vault document) before deciding whether to take an action (e.g., draft an email).

A pure ReAct (`while`) loop was proposed to solve this, but industry best practices show that ReAct loops are expensive "slot machines" that frequently hallucinate, skip steps, and fail at deterministic tasks.

## Decision
We are moving from the Single-Shot array approach to a **Two-Stage Fixed Graph (DAG)** pipeline:
1. **Node 1: Intent Router (LLM):** Parses the email and decides what data to fetch (Reads).
2. **Node 2: Data Fetcher (Apps Script):** Deterministically fetches the data and adds it to the State.
3. **Node 3: Synthesizer (LLM):** Reads the data and the user request to decide what actions to take (Writes).
4. **Node 4: Actuator (Apps Script):** Deterministically executes the writes.

## Consequences
- **Positive:** We unlock complex conditional logic (e.g., "Check my calendar and if X, do Y").
- **Positive:** Cost is strictly capped at exactly 2 LLM calls per request, rather than an unbounded `while` loop.
- **Positive:** Reliability increases because deterministic facts (like the exact date/time) are pre-computed outside the LLM.
- **Negative:** Latency per request will roughly double (from ~3s to ~6s) since two sequential LLM calls must be made.
