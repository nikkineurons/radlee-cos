# Adventure 1: Add a New Action

Want Radlee to interact with a new tool (like Google Sheets, Google Drive, Google Slides, or even external tools like Slack)? This guide will show you how to use an AI coding assistant as a pair-programming partner to build a new integration. 

You won't just copy-paste code; you will learn how the "ReAct Pipeline" architecture routes LLM outputs to real-world execution.

## Deep Dive: How It Works Under the Hood

To give Radlee a new capability, you generally need to touch four specific places in `Code.gs`. Here is *why* we separate these concepts:

1. **`ACTION_REGISTRY`**: This is the source of truth for all actions. It maps an action name (e.g., `CHECK_SCHEDULE`) to its `type` (READ or WRITE), a description, and a list of required parameters.
2. **`synthesizerSchema`**: Radlee's LLM is forced to output structured JSON. By adding your new action and its parameters to this schema, you are teaching the LLM's "brain" that this new tool exists and what data it requires to use it.
3. **`handleStructuredRouting`**: This is the central nervous system. When the LLM outputs a JSON action, this `switch` statement reads the action name and routes it to the correct execution function.
4. **Execution Function**: This is where the magic happens! A function like `execCreateDriveFolder(folderName)` makes the actual native API call to the Google service.

By keeping the schema (the LLM's brain) strictly separated from the execution logic (the code), we guarantee that the LLM cannot run rogue code—it can only trigger the specific, hardcoded functions we give it access to.

## AI-Assisted Implementation Guide

Let's have an AI assistant teach us how to build this step-by-step. Open your preferred AI coding tool (like Claude Code, Cursor, GitHub Copilot, or ChatGPT) and feed it one of the following prompts depending on what you want to build.

### Option A: Teach Radlee to Read Your Schedule (Google Calendar)

A Chief of Staff needs to know what meetings you have coming up! Let's add an action that allows Radlee to read your Google Calendar so it can summarize your day. 

*Note: Because this is a **READ** action (fetching data), we will add it to the `routerSchema` instead of the `synthesizerSchema`. The Context Planner fetches data and passes it down to the Action Executor!*

#### The "Fast Track" Prompt (Just give me the code)
Copy and paste this if you just want to get it done quickly:
> I am working on an Apps Script project called Radlee. It uses a "ReAct Pipeline" architecture where an LLM outputs structured JSON actions. The Context Planner handles READ actions and passes the data to the Action Executor.
> I want to add a new READ action called `CHECK_SCHEDULE` so Radlee can check my meetings. It should take one parameter: `dateString` (an ISO date string).
> Please read `Code.gs` and do the following:
> 1. Add `CHECK_SCHEDULE` (with `type: "READ"`) to the `ACTION_REGISTRY`.
> 2. Update the `routerSchema` to include `CHECK_SCHEDULE` in its enum, and add `dateString` to its parameters.
> 3. Add a case for `CHECK_SCHEDULE` in the `handleStructuredRouting` switch statement. 
> 4. Create an `execCheckSchedule(dateString)` function that uses `CalendarApp.getDefaultCalendar().getEventsForDay(new Date(dateString))`. It should map over the events and return a formatted string of event titles and start times. 

#### The "Learning Track" Prompt (Teach me how this works)
Copy and paste this if you want the AI to teach you step-by-step:
> I am working on an Apps Script project called Radlee. It uses a "ReAct Pipeline" architecture.
> 
> I want to learn how to add a new READ action called `CHECK_SCHEDULE` (taking parameter `dateString`) so Radlee can read my calendar.
> 
> Please read `Code.gs`. Act as an expert pair-programming teacher. Do not just output the final code. Instead, explain the architecture to me and walk me through the four steps required to implement this:
> 1. Updating the `ACTION_REGISTRY` (making sure to include `type: "READ"`).
> 2. Updating the `routerSchema` (explain why READ actions go in the Context Planner and how the data gets passed to the Action Executor).
> 3. Updating the `handleStructuredRouting` switch statement.
> 4. Writing an `execCheckSchedule` function using the native `CalendarApp.getDefaultCalendar().getEventsForDay()` service to return a list of meeting titles and times.
> 
> Give me the code for step 1, explain it, and wait for me to say "Next" before moving to step 2.

### Option B: Build a Native Google Integration (Google Sheets)

Because Radlee runs in Google Apps Script, it has native access to all Google Workspace tools. Let's add the ability for Radlee to log data to a Google Sheet.

#### The "Fast Track" Prompt (Just give me the code)
Copy and paste this if you just want to get it done quickly:
> I am working on an Apps Script project called Radlee. It uses a "ReAct Pipeline" architecture where an LLM outputs structured JSON actions that are executed by a router.
> I want to add a new action called `APPEND_TO_SHEET` that allows Radlee to log data into a specific Google Sheet. It should take two parameters: `sheetName` (the name of the tab) and `rowValues` (an array of strings to append).
> Please read `Code.gs` and do the following:
> 1. Add `APPEND_TO_SHEET` (with `type: "WRITE"`) to the `ACTION_REGISTRY`.
> 2. Update the `synthesizerSchema` to include `APPEND_TO_SHEET` and its parameters in the `enum` and `properties`.
> 3. Add a case for `APPEND_TO_SHEET` in the `handleStructuredRouting` switch statement. Ensure it validates the required parameters.
> 4. Create an `execAppendToSheet(sheetName, rowValues)` function. This function should use `SpreadsheetApp.openById(spreadsheetId)` to open the spreadsheet, select the given `sheetName`, and append the `rowValues`. Fetch the `spreadsheetId` securely using `PropertiesService.getScriptProperties().getProperty('TARGET_SPREADSHEET_ID')`. Use `execIdempotent` to prevent double-posting.

#### The "Learning Track" Prompt (Teach me how this works)
Copy and paste this if you want the AI to teach you step-by-step:
> I am working on an Apps Script project called Radlee. It uses a "ReAct Pipeline" architecture where an LLM outputs structured JSON actions that are executed by a router.
> 
> I want to learn how to add a new action called `APPEND_TO_SHEET` (taking parameters `sheetName` and `rowValues`).
> 
> Please read `Code.gs`. Act as an expert pair-programming teacher. Do not just output the final code. Instead, explain the architecture to me and walk me through the steps required to implement this:
> 1. Updating the `ACTION_REGISTRY` (making sure to include `type: "WRITE"`).
> 2. Updating the `synthesizerSchema`.
> 3. Updating the `handleStructuredRouting` switch statement.
> 4. Writing an `execAppendToSheet` function using the native `SpreadsheetApp.openById()` service. Explain how to fetch the spreadsheet ID securely via `PropertiesService.getScriptProperties().getProperty('TARGET_SPREADSHEET_ID')`.
> 
> Give me the code for step 1, explain it, and wait for me to say "Next" before moving to the next step.

## Review & Integrate

As the AI walks you through the steps, carefully review the code before pasting it into `Code.gs`:

- **Verify Schemas:** Does the JSON schema exactly match the parameters you need?
- **Check Security:** If you ever build an integration with an external tool (like Slack), did the AI use `PropertiesService` to fetch keys? Never hardcode API keys! (Note: Native Google Apps Script services like `DriveApp` and `SpreadsheetApp` run under your account and do not require API keys).
- **Check Idempotency:** Did the AI wrap your execution function in `execIdempotent` in the router? (This ensures that if the script crashes halfway and restarts, it won't perform the action twice).

Once you have implemented and deployed the changes, add any required Spreadsheet IDs or API keys to the Apps Script **Project Settings -> Script Properties**, and you are ready to test your new action!
