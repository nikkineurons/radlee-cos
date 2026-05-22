# 0002. Single-Shot Multi-Action Execution (Cost Optimization)

## Status
Accepted

## Context
The previous architecture used a recursive ReAct loop for the agent to determine actions. The agent would receive a prompt, take a single action, and then the system would append the observation and send the entire history back to the LLM. 
Additionally, large strategic documents from the "Vault" were preloaded into the base system prompt on every execution. 
This resulted in extremely high API costs (approx. $40/day) due to excessive API calls and massive input token consumption per call.

## Decision
We decided to completely eliminate the recursive ReAct loop and implement a Single-Shot Multi-Action Execution model.
- **Single Prompt:** The LLM receives the user request and returns a structured JSON array of multiple `actions` to execute.
- **Sequential Local Execution:** Apps Script iterates over the actions array and executes the functions locally without querying the LLM again.
- **Lazy-Loading Context:** We removed pre-loaded context from the base prompt. The agent must now explicitly use the `READ_DOC` action to query vault documents when needed (Strict RAG).
- **Safe Quarantining:** The email poller now applies the `radlee-processed` label *before* processing the email, preventing an infinite API loop if the LLM fails or times out.

## Consequences
- **Cost Reduction:** Token consumption and total API calls are reduced by up to 80%, successfully bringing operational costs well under the $5/day target.
- **Speed:** Requests execute significantly faster because they no longer wait on multiple sequential LLM round-trips.
- **Complexity:** The routing logic is simplified by removing the recursion guardrails previously required for the ReAct loop.
