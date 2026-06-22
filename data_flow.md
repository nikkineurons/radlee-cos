# Radlee Data Flow Architecture

Here is the data flow map for the Radlee AI Chief of Staff project. 

## High-Level Architecture Flow

This diagram illustrates how data enters the system, is processed by the Gemini engine, interacts with Google Workspace APIs via Tool Calling, and returns to the user.

```mermaid
graph TD
    %% Entities
    User((User))
    Gmail[Gmail Inbox]
    
    %% Core Components
    Poller[Email Poller processEmailInbox]
    History[(User History Cache)]
    Agent[Agent Core processAgentRequest]
    Gemini[Gemini API Native Tool Calling]
    Router[Action Router handleStructuredRouting]
    
    %% External Services
    GWorkspace[Google Workspace APIs Drive, Calendar, Tasks]
    Vault[(Long-term Vault Google Drive)]

    %% Flow
    User -- "Sends Email/Audio" --> Gmail
    Gmail -- "Cron Trigger (1 min)" --> Poller
    Poller -- "Fetches Unread & Labels" --> Gmail
    Poller -- "Extracts Text/Audio" --> Agent
    
    Agent -- "Fetches recent turns" --> History
    Agent -- "System Prompt +\nHistory + Tools" --> Gemini
    
    Gemini -- "Returns Function Call" --> Router
    Router -- "Executes Action" --> GWorkspace
    Router -- "Reads/Writes Context" --> Vault
    GWorkspace -- "Returns Observation" --> Router
    Router -- "Appends Observation" --> Agent
    Agent -- "Sends Context back" --> Gemini
    
    Gemini -- "Returns Final Text" --> Agent
    Agent -- "Saves new turns" --> History
    Agent -- "Replies to Thread" --> Gmail
    Gmail -- "Sends Notification" --> User
```

---

## Detailed Execution Sequence

This sequence diagram breaks down the multi-turn Tool Calling loop that occurs when Radlee receives a complex request.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Poller as Email Poller
    participant Agent as Agent Core
    participant Gemini as Gemini API
    participant Router as Tool Router
    participant Workspace as Google Apps Script APIs

    User->>Poller: Email (e.g., "Schedule lunch and draft a memo")
    activate Poller
    Poller->>Poller: Quarantine (Archive & Label)
    Poller->>Agent: processAgentRequest(rawText)
    activate Agent
    
    loop Cognitive Loop (Max 5 iterations)
        Agent->>Gemini: Send Conversation + Available Tools
        activate Gemini
        
        alt Model decides to use a tool
            Gemini-->>Agent: FunctionCall(name: "CALENDAR", args: {...})
            Agent->>Router: handleStructuredRouting("CALENDAR", args)
            activate Router
            Router->>Workspace: execIdempotent(CalendarApp.createEvent)
            Workspace-->>Router: Success / Event ID
            Router-->>Agent: Observation String
            deactivate Router
            Agent->>Agent: Append observation to conversation context
        else Model decides it is done
            Gemini-->>Agent: Final Text Response
        end
        deactivate Gemini
    end

    Agent-->>Poller: Final Text Response
    deactivate Agent
    Poller->>User: Reply to email thread
    deactivate Poller
```
