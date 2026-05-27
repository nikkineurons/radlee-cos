# Adventure 3: Trigger External Webhooks Safely

Sometimes you want Radlee to trigger a workflow in another tool—like starting a Vercel deployment, triggering a Zapier scenario, or sending data to Make.com. 

You could teach Radlee to make open-ended HTTP requests, but that is dangerous. If the LLM hallucinates, it could send a POST request to the wrong URL. This guide will teach you how to build a highly secure, deterministic Webhook architecture.

## Deep Dive: The Integration Registry Pattern

Instead of letting the LLM output raw URLs like `https://my-api.com/deploy`, we force the LLM to output a simple, pre-approved name, like `VERCEL_DEPLOY`. 

In our code, we create an `INTEGRATION_REGISTRY` that hardcodes the mapping:
```javascript
const INTEGRATION_REGISTRY = {
  "VERCEL_DEPLOY": { urlProp: "VERCEL_WEBHOOK_URL" },
  "ZAPIER_INVOICE": { urlProp: "ZAPIER_INVOICE_URL" }
}
```

This provides three massive benefits:
1. **Zero Hallucinations:** The LLM can only select from the predefined list of allowed integrations.
2. **Deterministic Routing:** The code looks up the exact URL mapping based on the name.
3. **Total Security:** The actual URLs (which often contain secret tokens in the query string) are stored securely in `PropertiesService` and are never exposed to the LLM or stored in the codebase.

## AI-Assisted Implementation Guide

Let's have an AI assistant teach us how to build this secure webhook dispatcher.

Open your preferred AI coding tool (like Claude Code, Cursor, GitHub Copilot, or ChatGPT) and feed it the following prompt:

### The Prompt

> I am working on an Apps Script project called Radlee. It uses a "ReAct Pipeline" architecture where an LLM outputs structured JSON actions that are executed by a Context Planner and Action Executor.
> 
> I want to add a new generic action called `TRIGGER_INTEGRATION` that safely fires webhooks without letting the LLM hallucinate URLs. 
> 
> Please read `Code.gs`. Act as an expert pair-programming teacher. Walk me through the implementation step-by-step, explaining the concepts as we go:
> 
> 1. **The Registry Pattern:** Explain why we should create an `INTEGRATION_REGISTRY` object at the top of the file mapping simple keys (e.g. `VERCEL_DEPLOY`) to `PropertiesService` keys. Give me the code for this registry and wait for me to say "Next".
> 2. **Action Registration:** Walk me through adding `TRIGGER_INTEGRATION` (with `type: "WRITE"` and parameters `integration_name` and `payload`) to the `ACTION_REGISTRY`. Explain how the schema dynamically picks this up, but we still need to update the `synthesizerSchema` to ensure the `integration_name` property uses an `enum` restricted to the keys of the `INTEGRATION_REGISTRY`. Wait for me to say "Next".
> 3. **Execution Logic:** Help me write the `execTriggerIntegration(integrationName, payload)` function. It should look up the `urlProp` from the registry, fetch the actual URL using `PropertiesService.getScriptProperties()`, and make a `UrlFetchApp` POST request. Explain how to use `execIdempotent` to prevent double-firing in the Action Executor.
> 
> Guide me interactively. Don't dump all the code at once!

### Review & Integrate

As you follow along with the AI, pay attention to these key details:

- **The Enum Restriction:** The most important part of this adventure is ensuring the `synthesizerSchema` restricts `integration_name` to be an `enum` of `Object.keys(INTEGRATION_REGISTRY)`. This guarantees the LLM *cannot* output a rogue webhook name.
- **The Payload:** Webhooks usually expect a JSON body. Ensure the `UrlFetchApp` request sets `contentType: 'application/json'` and uses `JSON.stringify(payload)`.
- **Script Properties:** Don't forget to open your Apps Script **Project Settings -> Script Properties** and add the actual webhook URLs!
