/**
 * Radlee - The AI Chief of Staff
 * Email-Powered | GCAF-Compliant
 * Entry points: processEmailInbox(), onOpen()
 */

// ═══════════════════════════════════════════════════════════════════
// 0. CONFIGURATION & REGISTRIES
// ═══════════════════════════════════════════════════════════════════

const CONFIG = {
  MODEL_VERSION: "gemini-2.5-flash",
  HISTORY_LIMIT: 10,
  VAULT_CACHE_TIME: 300 // 5 minutes
};



// 🎓 LESSON: The Action Registry
// This object defines every capability the AI has. By separating the definition 
// of an action from its execution code, we ensure the LLM can only trigger
// pre-approved functions, preventing rogue executions.
const ACTION_REGISTRY = {
  TASK: { type: "WRITE", desc: "Create a Google Task", params: ["title"] },
  CALENDAR: { type: "WRITE", desc: "Schedule an event", params: ["title", "iso"] },
  EMAIL: { type: "WRITE", desc: "Draft an email", params: ["recipient", "subject", "body"] },
  DOC: { type: "WRITE", desc: "Create a new document", params: ["doc_name", "content"] },
  APPROVE_DOC: { type: "WRITE", desc: "Move doc to Approved folder", params: ["doc_name"] },
  PDF_EMAIL: { type: "WRITE", desc: "Convert doc to PDF and draft email", params: ["doc_name", "recipient", "subject", "body"] },
  AREAS_CHECKIN: { type: "READ", desc: "Review areas of focus", params: [] },
  STRATEGY_PRIMER: { type: "WRITE", desc: "Generate a strategic alignment primer", params: [] },
  SEARCH_CONTACTS: { type: "READ", desc: "Search for a person's email address by name", params: ["query"] },
  LEARN: { type: "WRITE", desc: "Log a key insight in the long-term memory", params: ["learning"] },
  UPDATE_PREFERENCE: { type: "WRITE", desc: "Log a user preference", params: ["preference"] },
  INCUBATE: { type: "WRITE", desc: "Add to Someday/Maybe list", params: ["description"] },
  READ_DOC: { type: "READ", desc: "Read a document from the vault", params: ["doc_name"] },
  LIST_FOLDER_FILES: { type: "READ", desc: "List all files in a specific folder", params: ["folder_name"] },
  READ_FILE: { type: "READ", desc: "Read the content of a specific file in a specific folder", params: ["folder_name", "file_name"] },
  NONE: { type: "BOTH", desc: "Respond to user directly", params: [] }
};

function getActionPromptReference(nodeType) {
  return Object.entries(ACTION_REGISTRY)
    .filter(([_, meta]) => meta.type === nodeType || meta.type === "BOTH")
    .map(([action, meta]) => `- ${action}: ${meta.desc}. Params: ${meta.params.join(", ") || "none"}`)
    .join("\n    ");
}

// ═══════════════════════════════════════════════════════════════════
// 1. EMAIL POLLER & EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════════

function processEmailInbox() {
  try {
    const SETTINGS = loadSettings();
    if (!SETTINGS.OWNER_EMAIL || !SETTINGS.RADLEE_EMAIL) return; // Not initialized yet

    const label = GmailApp.getUserLabelByName("radlee-processed");
    if (!label) return;

    // Search for unread emails sent TO radlee, FROM owner, without the processed label
    const query = `to:${SETTINGS.RADLEE_EMAIL} is:unread -label:radlee-processed from:${SETTINGS.OWNER_EMAIL}`;
    const threads = GmailApp.search(query);

    for (const thread of threads) {
      const messages = thread.getMessages();
      const lastMessage = messages[messages.length - 1]; // We care about the latest message in the thread
      
      // Strict Sent-To explicit check just to be absolutely sure (redundant to query, but secure)
      const toField = lastMessage.getTo();
      if (!toField.toLowerCase().includes(SETTINGS.RADLEE_EMAIL.toLowerCase())) {
        thread.addLabel(label);
        thread.markRead();
        continue;
      }

      // Quarantining: Apply label and mark read BEFORE processing
      // This prevents infinite loops if the LLM or API errors out later.
      thread.addLabel(label);
      thread.markRead();

      const subject = lastMessage.getSubject() || "";
      const bodyText = lastMessage.getPlainBody() || "";
      const rawText = bodyText.trim() || subject.trim();
      const attachments = lastMessage.getAttachments() || [];
      const audioAttachment = attachments.find(a => a.getContentType().startsWith("audio/"));

      let responseText;
      try {
        if (audioAttachment) {
          const base64 = Utilities.base64Encode(audioAttachment.getBytes());
          const mimeType = audioAttachment.getContentType();
          responseText = processVoicemail(base64, mimeType, rawText);
        } else if (!rawText) {
          responseText = "I received your message but couldn't read the text. Please try again.";
        } else {
          const userId = SETTINGS.OWNER_EMAIL; // Using email as unique user ID
          const history = getUserHistory(userId);
          responseText = processAgentRequest(rawText, history);
          saveUserHistory(userId, rawText, responseText);
        }
      } catch (err) {
        responseText = "⚠️ Error processing request: " + err.message;
        logAuditActivity("Email_Poller", "Error", rawText.substring(0, 100), err.message, "FAIL");
      }

      // Reply to the thread
      thread.reply(responseText || "✅ Done.");
      
      logAuditActivity("Email_Poller", "Processed_Email", rawText.substring(0, 100), responseText.substring(0, 100), "Success");
    }
  } catch (e) {
    logAuditActivity("Email_Poller", "Polling_Error", "", e.message, "FAIL");
  }
}

// ─── Session History (PropertiesService, capped at 10 turns) ──────
function getUserHistory(userId) {
  const stored = PropertiesService.getUserProperties().getProperty("history_" + userId);
  return stored ? JSON.parse(stored) : [];
}

function saveUserHistory(userId, userInput, agentResponse) {
  const history = getUserHistory(userId);
  history.push({ role: "user",  content: userInput });
  history.push({ role: "model", content: agentResponse });
  const capped = history.slice(-20); // keep last 10 turns (20 entries)
  PropertiesService.getUserProperties().setProperty("history_" + userId, JSON.stringify(capped));
}


// ═══════════════════════════════════════════════════════════════════
// --- 3. THE AGENT CORE (Routing Engine) ---
    
function processAgentRequest(userInput, sessionHistory = []) {
  try {
    const SETTINGS = loadSettings();
    const currentDate = new Date().toLocaleDateString();
    const currentTime = new Date().toLocaleTimeString();

    // --- SCHEMAS ---
    // 🎓 LESSON: Structured Outputs (JSON Schemas)
    // We pass these schemas to the Gemini API via the `responseSchema` config.
    // This physically forces the LLM to reply in a strict JSON format that our 
    // code can parse safely, eliminating "hallucinated" formatting.
    const routerSchema = {
      "type": "OBJECT",
      "properties": {
        "thought": { "type": "STRING", "description": "Reasoning about what data needs to be fetched." },
        "actions": {
          "type": "ARRAY",
          "description": "List of READ actions to fetch context.",
          "items": {
            "type": "OBJECT",
            "properties": {
              "action": { "type": "STRING", "enum": Object.keys(ACTION_REGISTRY).filter(k => ACTION_REGISTRY[k].type === "READ" || ACTION_REGISTRY[k].type === "BOTH"), "description": "Action to execute." },
              "params": {
                "type": "OBJECT",
                "properties": { 
                  "doc_name": { "type": "STRING", "description": "Required for READ_DOC." },
                  "query": { "type": "STRING", "description": "Required for SEARCH_CONTACTS. The name of the person to look up." },
                  "folder_name": { "type": "STRING", "description": "Required for LIST_FOLDER_FILES and READ_FILE. The name of the folder." },
                  "file_name": { "type": "STRING", "description": "Required for READ_FILE. The name of the file to read." }
                }
              }
            },
            "required": ["action", "params"]
          }
        }
      },
      "required": ["thought", "actions"]
    };

    const synthesizerSchema = {
      "type": "OBJECT",
      "properties": {
        "thought": { "type": "STRING", "description": "Internal reasoning about what to do." },
        "confidence_score": { "type": "INTEGER", "description": "A score from 0 to 100 representing confidence in the chosen actions based on the available facts." },
        "actions": {
          "type": "ARRAY",
          "description": "List of WRITE actions to execute.",
          "items": {
            "type": "OBJECT",
            "properties": {
              "action": { "type": "STRING", "enum": Object.keys(ACTION_REGISTRY).filter(k => ACTION_REGISTRY[k].type === "WRITE" || ACTION_REGISTRY[k].type === "BOTH") },
              "params": {
                "type": "OBJECT",
                "properties": {
                  "title":     { "type": "STRING" },
                  "iso":       { "type": "STRING", "description": "ISO 8601 formatted datetime string for the start of the event (e.g. 2026-05-21T15:00:00Z). REQUIRED for CALENDAR actions." },
                  "duration_mins": { "type": "INTEGER", "description": "Duration of the event in minutes. Defaults to 30 if omitted." },
                  "recipient": { "type": "STRING" },
                  "subject":   { "type": "STRING" },
                  "body":      { "type": "STRING" },
                  "notes":     { "type": "STRING" },
                  "doc_name":  { "type": "STRING" },
                  "content":   { "type": "STRING" },
                  "learning":  { "type": "STRING" },
                  "preference":{ "type": "STRING" },
                  "description":{ "type": "STRING" },
                  "guests":    { "type": "STRING", "description": "Comma-separated list of email addresses for attendees." }
                }
              }
            },
            "required": ["action", "params"]
          }
        },
        "final_answer": { "type": "STRING", "description": "The response to the user." }
      },
      "required": ["thought", "confidence_score", "actions", "final_answer"]
    };

    let formattedHistory = sessionHistory.map(turn => ({
      "role": turn.role,
      "parts": [{"text": turn.content}]
    }));

    formattedHistory.push({
      "role": "user",
      "parts": [{"text": userInput}]
    });

    let contextFoldersList = "None configured.";
    if (Object.keys(SETTINGS.CONTEXT_FOLDERS).length > 0) {
      contextFoldersList = Object.keys(SETTINGS.CONTEXT_FOLDERS).map(name => `- ${name}`).join("\\n    ");
    }

    // --- NODE 1: CONTEXT PLANNER ---
    const routerPrompt = getSystemPrompt(SETTINGS.VAULT_ID, SETTINGS.USER_NAME) + `
    You are the Context Planner for an autonomous agent following the Getting Things Done (GTD) framework.
    Your ONLY job is to determine what context is needed to answer the user's request.
    Current Date: ${currentDate}
    Current Time: ${currentTime}
    
    [AVAILABLE EXTERNAL FOLDERS]
    ${contextFoldersList}

    [ACTION REFERENCE (READ ONLY)]
    ${getActionPromptReference("READ")}

    Respond in structured JSON using only the READ actions above.
    No context is preloaded. To read strategic documents from the Vault, use READ_DOC. To explore an external folder from the list above, use LIST_FOLDER_FILES. To read a specific file you found in an external folder, use READ_FILE.`;

    const routerResponse = callGeminiStructured(routerPrompt, formattedHistory, SETTINGS.API_KEY, routerSchema);

    // --- NODE 2: DATA FETCHER ---
    let stateFacts = [];
    if (routerResponse.actions && Array.isArray(routerResponse.actions)) {
      for (const act of routerResponse.actions) {
        if (act.action && act.action !== "NONE") {
          const observation = handleStructuredRouting(act.action, act.params || {}, SETTINGS);
          stateFacts.push(`[${act.action} Data]: ${observation}`);
        }
      }
    }
    const stateString = stateFacts.length > 0 ? "\n\nGATHERED FACTS:\n" + stateFacts.join("\n") : "";

    // --- NODE 3: ACTION EXECUTOR ---
    let adaptiveFeedbackInstruction = "";
    if (userInput.toLowerCase().includes("no,") || userInput.toLowerCase().includes("instead") || userInput.toLowerCase().includes("actually") || userInput.toLowerCase().includes("prefer")) {
      adaptiveFeedbackInstruction = "\n[ADAPTIVE FEEDBACK TRIGGERED]: The user's input appears to contain a correction or preference. You MUST include an 'UPDATE_PREFERENCE' action in your array to permanently log this preference in the User Preferences document.";
    }

    const synthesizerPrompt = getSystemPrompt(SETTINGS.VAULT_ID, SETTINGS.USER_NAME) + `
    You are the Action Executor. Make decisions and execute actions based on the user's request and gathered facts.
    Current Date: ${currentDate}
    Current Time: ${currentTime}
    Respond in structured JSON. Reason in 'thought', provide a 'confidence_score' (0-100), an array of WRITE 'actions', and write the user reply in 'final_answer'. If no actions are needed, use NONE.
    CRITICAL RULE: If a WRITE action requires parameters that the user has not provided (e.g. missing time for an event, missing title for a task), DO NOT execute the action. Instead, use the 'NONE' action and ask the user to provide the missing details in your 'final_answer'.
    ${adaptiveFeedbackInstruction}
    
    [ACTION REFERENCE]:
    ${getActionPromptReference("WRITE")}`;

    let synthesizerHistory = JSON.parse(JSON.stringify(formattedHistory));
    synthesizerHistory[synthesizerHistory.length - 1].parts[0].text += stateString;

    const synthResponse = callGeminiStructured(synthesizerPrompt, synthesizerHistory, SETTINGS.API_KEY, synthesizerSchema);

    // --- NODE 4: ACTUATOR ---
    let finalObservations = [];
    const confidence = synthResponse.confidence_score !== undefined ? synthResponse.confidence_score : 100;
    
    if (synthResponse.actions && Array.isArray(synthResponse.actions)) {
      for (let act of synthResponse.actions) {
        if (act.action && act.action !== "NONE") {
          
          // Strategy 2: Confidence Threshold Interception (Rule-Based Guardrail)
          if (confidence < 85 && (act.action === "EMAIL" || act.action === "PDF_EMAIL" || act.action === "CALENDAR")) {
            logAuditActivity('CoS_Hub', 'Confidence_Downgrade', `Original: ${act.action}, Confidence: ${confidence}`, 'Downgraded to TASK for review', 'Success');
            const originalAction = act.action;
            act.action = "TASK";
            act.params = {
              "title": `Review AI Action: ${originalAction}`,
              "notes": `Confidence was ${confidence}%. AI wanted to execute: ${JSON.stringify(act.params)}`
            };
          }

          const observation = handleStructuredRouting(act.action, act.params || {}, SETTINGS);
          finalObservations.push(`- ${act.action}: ${observation}`);
        }
      }
    }

    const finalOutput = synthResponse.final_answer || synthResponse.thought || "Done.";

    // Deterministic Prompt Leakage Guardrail
    const lowerOut = finalOutput.toLowerCase();
    if (lowerOut.includes("system prompt") || lowerOut.includes("instruction") || lowerOut.includes("schema guideline") || lowerOut.includes("underlying software")) {
      const lockedOutput = "🛡️ I am Radlee, your AI Chief of Staff and growth companion. I cannot share my internal prompt instructions or system configurations, but I am fully ready to schedule events, manage tasks, draft documents, or log your reflections!";
      logAuditActivity('CoS_Hub', 'Prompt_Leak_Intercept', userInput, lockedOutput, 'Success');
      return lockedOutput;
    }

    logAuditActivity('CoS_Hub', 'Strategic_Consult', userInput, finalOutput, 'Success');
    
    if (finalObservations.length > 0) {
      return finalOutput + "\n\n**Actions Taken:**\n" + finalObservations.join("\n");
    }
    return finalOutput;

  } catch (e) {
    logAuditActivity('CoS_Hub', 'FATAL_ERROR', userInput, e.message, 'FAIL');
    return `⚠️ System Error: ${e.message}`;
  }
}

// --- 4. THE TOOL EXECUTION HANDLERS ---

/**
 * CONTEXT PLANNER — Handles typed actions from the LLM.
 * Receives typed action + params object from callGeminiStructured.
 */
// 🎓 LESSON: Deterministic Routing
// The LLM only outputs a string like "EMAIL". This switch statement maps that
// string to the actual native Google function. This guarantees the LLM never 
// writes or runs actual code.
function handleStructuredRouting(action, params, SETTINGS) {
  const missing = [];
  const requireParam = (field) => { if (!params[field] || !params[field].toString().trim()) missing.push(field); };

  switch(action) {
    case "LEARN":
      requireParam("learning");
      if (missing.length) return `⚠️ Parameter Error: Missing required param [${missing.join(", ")}] for action ${action}. Ask user to clarify or supply the param.`;
      return appendToLongTermMemory(params.learning, SETTINGS.VAULT_ID);

    case "UPDATE_PREFERENCE":
      requireParam("preference");
      if (missing.length) return `⚠️ Parameter Error: Missing required param [${missing.join(", ")}] for action ${action}. Ask user to clarify or supply the param.`;
      return appendToUserPreferences(params.preference, SETTINGS.VAULT_ID);

    case "INCUBATE":
      requireParam("description");
      if (missing.length) return `⚠️ Parameter Error: Missing required param [${missing.join(", ")}] for action ${action}. Ask user to clarify or supply the param.`;
      return appendToIncubate(params.description, SETTINGS.VAULT_ID);

    case "READ_DOC":
      requireParam("doc_name");
      if (missing.length) return `⚠️ Parameter Error: Missing required param [${missing.join(", ")}] for action ${action}. Ask user to clarify or supply the param.`;
      return execReadDoc(params.doc_name, SETTINGS.VAULT_ID);

    case "LIST_FOLDER_FILES":
      requireParam("folder_name");
      if (missing.length) return `⚠️ Parameter Error: Missing required param [${missing.join(", ")}] for action ${action}. Ask user to clarify or supply the param.`;
      return execListFolderFiles(params.folder_name, SETTINGS.CONTEXT_FOLDERS);

    case "READ_FILE":
      requireParam("folder_name");
      requireParam("file_name");
      if (missing.length) return `⚠️ Parameter Error: Missing required param [${missing.join(", ")}] for action ${action}. Ask user to clarify or supply the param.`;
      return execReadFile(params.folder_name, params.file_name, SETTINGS.CONTEXT_FOLDERS);

    case "SEARCH_CONTACTS":
      requireParam("query");
      if (missing.length) return `⚠️ Parameter Error: Missing required param [${missing.join(", ")}] for action ${action}. Ask user to clarify or supply the param.`;
      return execSearchContacts(params.query);

    case "CALENDAR":
      requireParam("title");
      requireParam("iso");
      if (missing.length) return `⚠️ Parameter Error: Missing required param [${missing.join(", ")}] for action ${action}. Ask user to clarify or supply the param.`;
      if (isNaN(Date.parse(params.iso))) {
        return `⚠️ Parameter Error: 'iso' timestamp [${params.iso}] is not a valid date string. Ask user to clarify the time of the event.`;
      }
      return execIdempotent(`CALENDAR|${params.title}|${params.iso}`, () => execCalendarAction(params.title, params.iso, params.duration_mins, params.guests));

    case "DOC":
      requireParam("doc_name");
      requireParam("content");
      if (missing.length) return `⚠️ Parameter Error: Missing required param [${missing.join(", ")}] for action ${action}. Ask user to clarify or supply the param.`;
      return execIdempotent(`DOC|${params.doc_name}`, () => execDocAction(params.doc_name, params.content, SETTINGS.VAULT_ID));

    case "APPROVE_DOC":
      requireParam("doc_name");
      if (missing.length) return `⚠️ Parameter Error: Missing required param [${missing.join(", ")}] for action ${action}. Ask user to clarify or supply the param.`;
      return execIdempotent(`APPROVE_DOC|${params.doc_name}`, () => execApproveDoc(params.doc_name, SETTINGS.VAULT_ID, SETTINGS.APPROVED_ID));

    case "EMAIL":
      requireParam("recipient");
      requireParam("subject");
      requireParam("body");
      if (missing.length) return `⚠️ Parameter Error: Missing required param [${missing.join(", ")}] for action ${action}. Ask user to clarify or supply the param.`;
      return execIdempotent(`EMAIL|${params.recipient}|${params.subject}`, () => execEmailAction(params.recipient, params.subject, params.body));

    case "PDF_EMAIL":
      requireParam("doc_name");
      requireParam("recipient");
      requireParam("subject");
      requireParam("body");
      if (missing.length) return `⚠️ Parameter Error: Missing required param [${missing.join(", ")}] for action ${action}. Ask user to clarify or supply the param.`;
      return execIdempotent(`PDF_EMAIL|${params.doc_name}|${params.recipient}`, () => execPdfEmailAction(params.doc_name, params.recipient, params.subject, params.body, SETTINGS.APPROVED_ID));

    case "AREAS_CHECKIN":
      return execAreasCheckin(SETTINGS.VAULT_ID);

    case "STRATEGY_PRIMER":
      return execStrategyPrimer(SETTINGS);

    case "TASK":
      requireParam("title");
      if (missing.length) return `⚠️ Parameter Error: Missing required param [${missing.join(", ")}] for action ${action}. Ask user to clarify or supply the param.`;
      return execIdempotent(`TASK|${params.title}`, () => execTaskAction(params.title, params.notes || ""));

    default:
      return `Unknown structured action: ${action}`;
  }
}

// --- 5. ENGINE (Gemini API) ---

// Standard free-text call (used for Weekly Review, Next Actions)
function callGemini(systemPrompt, contentsArray, apiKey, search = false) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.MODEL_VERSION}:generateContent?key=${apiKey}`;

  const payload = {
    "systemInstruction": { "parts": [{ "text": systemPrompt }] },
    "contents": contentsArray
  };

  if (search) payload.tools = [{ "google_search": {} }];

  const options = { "method": "post", "contentType": "application/json", "payload": JSON.stringify(payload), "muteHttpExceptions": true };
  const res = UrlFetchApp.fetch(url, options);
  
  if (res.getResponseCode() !== 200) {
    // If the API throws 400 Invalid argument on a search payload, it's likely a Free Tier billing limitation. Retry without tools.
    if (search && res.getResponseCode() === 400) {
      delete payload.tools;
      options.payload = JSON.stringify(payload);
      const fallbackRes = UrlFetchApp.fetch(url, options);
      if (fallbackRes.getResponseCode() !== 200) {
        const fallbackJson = JSON.parse(fallbackRes.getContentText());
        throw new Error(fallbackJson.error ? fallbackJson.error.message : "API Fail");
      }
      return JSON.parse(fallbackRes.getContentText()).candidates[0].content.parts[0].text;
    }
    const json = JSON.parse(res.getContentText());
    throw new Error(json.error ? json.error.message : "API Fail");
  }
  
  const json = JSON.parse(res.getContentText());
  
  return json.candidates[0].content.parts[0].text;
}

/**
 * STRUCTURED ENGINE — Forces Gemini to return typed JSON.
 * Used exclusively by processAgentRequest() and processVoicemail().
 * Returns a parsed object: { thought, actions, final_answer }
 */
function callGeminiStructured(systemPrompt, contentsArray, apiKey, responseSchema) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.MODEL_VERSION}:generateContent?key=${apiKey}`;

  const payload = {
    "systemInstruction": { "parts": [{ "text": systemPrompt }] },
    "contents": contentsArray,
    "generationConfig": {
      "responseMimeType": "application/json",
      "responseSchema": responseSchema
    }
  };

  const options = { "method": "post", "contentType": "application/json", "payload": JSON.stringify(payload), "muteHttpExceptions": true };
  const res = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(res.getContentText());
  if (res.getResponseCode() !== 200) throw new Error(json.error ? json.error.message : "Structured API Fail");

  try {
    return JSON.parse(json.candidates[0].content.parts[0].text);
  } catch(e) {
    throw new Error("Gemini returned malformed JSON: " + json.candidates[0].content.parts[0].text.substring(0, 200), { cause: e });
  }
}

// --- 6. DATA UTILITIES (Settings, Vault, Actuators) ---
function loadSettings() {
  const props = PropertiesService.getScriptProperties().getProperties();
  
  const settings = {
    VAULT_ID: props.VAULT_FOLDER_ID,
    APPROVED_ID: props.APPROVED_FOLDER_ID,
    USER_NAME: props.USER_NAME || "User",
    ASSISTANT_NAME: props.ASSISTANT_NAME || "Radlee",
    API_KEY: props.GEMINI_API_KEY,
    OWNER_EMAIL: props.OWNER_EMAIL,
    RADLEE_EMAIL: props.RADLEE_EMAIL,
    CONTEXT_FOLDERS: getContextFolders(props.VAULT_FOLDER_ID)
  };

  if (!settings.VAULT_ID) throw new Error("VAULT_FOLDER_ID not found in Script Properties. Please run initializeAgent.");
  if (!settings.APPROVED_ID) throw new Error("APPROVED_FOLDER_ID not found in Script Properties. Please run initializeAgent.");
  if (!settings.API_KEY) throw new Error("GEMINI_API_KEY not found in Script Properties. Please run initializeAgent.");
  if (!settings.OWNER_EMAIL) throw new Error("OWNER_EMAIL not found in Script Properties. Please run initializeAgent.");
  if (!settings.RADLEE_EMAIL) throw new Error("RADLEE_EMAIL not found in Script Properties. Please run initializeAgent.");

  return settings;
}

function getContextFolders(vaultId) {
  if (!vaultId) return {};
  try {
    const folder = DriveApp.getFolderById(vaultId);
    const files = folder.getFilesByName("07_Context_Folders");
    if (!files.hasNext()) return {};
    
    const sheetFile = files.next();
    const sheet = SpreadsheetApp.openById(sheetFile.getId()).getActiveSheet();
    const data = sheet.getDataRange().getValues();
    
    let folders = {};
    for (let i = 1; i < data.length; i++) { // Skip header
      const name = data[i][0] ? data[i][0].toString().trim() : "";
      const id = data[i][1] ? data[i][1].toString().trim() : "";
      if (name && id) {
        folders[name] = id;
      }
    }
    return folders;
  } catch (e) {
    console.warn("Could not load 07_Context_Folders: " + e.message);
    return {};
  }
}

// --- CACHE: Vault context is cached to avoid redundant Drive API calls ---
function gatherVaultContext(vaultId) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'vault_ctx_' + vaultId;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const files = ["03_Dynamic_Memory", "04_User_Preferences"];
  const context = files.map(f => `[${f}]: ${getVaultContent(f, vaultId)}`).join("\n");

  try { cache.put(cacheKey, context, CONFIG.VAULT_CACHE_TIME); } catch(e) { /* context too large to cache */ }
  return context;
}

function invalidateVaultCache(vaultId) {
  CacheService.getScriptCache().remove('vault_ctx_' + vaultId);
}

/**
 * DECOUPLED SYSTEM PROMPT — Reads persona from 00_System_Prompt vault doc.
 * Edit that Google Doc to change Radlee's behaviour without touching code.
 * Falls back to a sensible default if the doc is missing or empty.
 */
function getSystemPrompt(vaultId, userName) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'sys_prompt_' + vaultId;
  const cached = cache.get(cacheKey);

  if (cached) return cached;

  try {
    const folder = DriveApp.getFolderById(vaultId);
    const files  = folder.getFilesByName('00_System_Prompt');

    if (files.hasNext()) {
      const text = DocumentApp.openById(files.next().getId()).getBody().getText().trim();
      if (text) {
        try { cache.put(cacheKey, text, CONFIG.VAULT_CACHE_TIME); } catch(e) { console.warn(e); }
        return text;
      }
    }
  } catch(e) { console.warn(e); }

  // Hardcoded fallback — only used if the vault doc is missing/empty
  const fallback = `You are Radlee, an AI Chief of Staff and daily growth companion for ${userName || 'the user'}.
Be execution-focused and strategic: drive progress on their professional objectives with Getting Things Done (GTD) rigour.
Also support their self-actualization: connect actions to values, acknowledge growth, and encourage reflection.
Be warm, specific, and proactive.`;

  try { cache.put(cacheKey, fallback, CONFIG.VAULT_CACHE_TIME); } catch(e) { console.warn(e); }
  return fallback;
}

function invalidateSystemPromptCache(vaultId) {
  CacheService.getScriptCache().remove('sys_prompt_' + vaultId);
}

function getVaultContent(fileName, vaultId) {
  const folder = DriveApp.getFolderById(vaultId);
  const files = folder.getFilesByName(fileName);
  return files.hasNext() ? DocumentApp.openById(files.next().getId()).getBody().getText() : `[Missing ${fileName}]`;
}

// --- 7. PHYSICAL ACTUATORS ---
function appendToLongTermMemory(learning, vaultId) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return "⚠️ Vault busy. Try again in a moment.";
  try {
    const folder = DriveApp.getFolderById(vaultId);
    const files = folder.getFilesByName('03_Dynamic_Memory');
    let doc;
    if (files.hasNext()) {
      doc = DocumentApp.openById(files.next().getId());
    } else {
      doc = DocumentApp.create('03_Dynamic_Memory');
      try {
        DriveApp.getFileById(doc.getId()).moveTo(folder);
      } catch (moveToErr) {
        console.warn("Could not move Dynamic Memory doc to vault: " + moveToErr.message);
      }
    }
    doc.getBody().appendParagraph(`[${new Date().toLocaleDateString()}]: ${learning}`);
    invalidateVaultCache(vaultId); // Expire cache so next read is fresh
    return `🧠 **Memory Updated:** Committed to Dynamic Learnings.`;
  } finally {
    lock.releaseLock();
  }
}

function appendToUserPreferences(preference, vaultId) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return "⚠️ Vault busy. Try again in a moment.";
  try {
    const folder = DriveApp.getFolderById(vaultId);
    const files = folder.getFilesByName('04_User_Preferences');
    let doc;
    if (files.hasNext()) {
      doc = DocumentApp.openById(files.next().getId());
    } else {
      doc = DocumentApp.create('04_User_Preferences');
      try {
        DriveApp.getFileById(doc.getId()).moveTo(folder);
      } catch (moveToErr) {
        console.warn("Could not move User Preferences doc to vault: " + moveToErr.message);
      }
    }
    doc.getBody().appendParagraph(`- ${preference}`);
    invalidateVaultCache(vaultId);
    return `⚙️ **Preference Saved:** Added to User Preferences.`;
  } finally {
    lock.releaseLock();
  }
}

function appendToIncubate(item, vaultId) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return "⚠️ Vault busy. Try again in a moment.";
  try {
    const folder = DriveApp.getFolderById(vaultId);
    const files = folder.getFilesByName('06_Someday_Maybe');
    let doc;
    if (files.hasNext()) {
      doc = DocumentApp.openById(files.next().getId());
    } else {
      doc = DocumentApp.create('06_Someday_Maybe');
      try {
        DriveApp.getFileById(doc.getId()).moveTo(folder);
      } catch (moveToErr) {
        console.warn("Could not move Someday Maybe doc to vault: " + moveToErr.message);
      }
    }
    doc.getBody().appendParagraph(`[${new Date().toLocaleDateString()}]: ${item}`);
    invalidateVaultCache(vaultId);
    return `📝 **Incubated:** Added to your Someday/Maybe list.`;
  } finally {
    lock.releaseLock();
  }
}

function execReadDoc(title, vaultId) {
  const folder = DriveApp.getFolderById(vaultId);
  const files = folder.getFilesByName(title);
  if (files.hasNext()) {
    return DocumentApp.openById(files.next().getId()).getBody().getText();
  }
  return `Error: Document "${title}" not found.`;
}

function execListFolderFiles(folderName, contextFolders) {
  if (!contextFolders || !contextFolders[folderName]) {
    return `Error: Folder "${folderName}" is not configured in 07_Context_Folders.`;
  }
  try {
    const folder = DriveApp.getFolderById(contextFolders[folderName]);
    const files = folder.getFiles();
    let fileList = [];
    while (files.hasNext()) {
      const file = files.next();
      fileList.push(`- ${file.getName()} (Type: ${file.getMimeType()})`);
    }
    if (fileList.length === 0) return `Folder "${folderName}" is empty.`;
    return `Files in ${folderName}:\n` + fileList.join("\n");
  } catch (e) {
    return `Error accessing folder "${folderName}": ${e.message}`;
  }
}

function execReadFile(folderName, fileName, contextFolders) {
  if (!contextFolders || !contextFolders[folderName]) {
    return `Error: Folder "${folderName}" is not configured in 07_Context_Folders.`;
  }
  try {
    const folder = DriveApp.getFolderById(contextFolders[folderName]);
    const files = folder.getFilesByName(fileName);
    if (!files.hasNext()) {
      return `Error: File "${fileName}" not found in folder "${folderName}".`;
    }
    
    const file = files.next();
    const mimeType = file.getMimeType();
    
    if (mimeType === MimeType.GOOGLE_DOCS) {
      return DocumentApp.openById(file.getId()).getBody().getText();
    } else if (mimeType === MimeType.GOOGLE_SHEETS) {
      const sheet = SpreadsheetApp.openById(file.getId()).getActiveSheet();
      const data = sheet.getDataRange().getValues();
      return data.map(row => row.join(", ")).join("\n");
    } else if (mimeType === MimeType.PDF || mimeType.includes("image")) {
      return `Error: File "${fileName}" is a PDF or image. Radlee's READ_FILE action currently only supports extracting text from Docs, Sheets, and plain text/CSV files.`;
    } else {
      // Attempt plain text extraction for CSV/TXT
      return file.getBlob().getDataAsString();
    }
  } catch (e) {
    return `Error reading file "${fileName}": ${e.message}`;
  }
}

function execCalendarAction(title, timeStr, durationMins, guests) {
  let options = {};
  if (guests) {
    options.guests = guests;
    options.sendInvites = true;
  }
  const durationMs = (durationMins || 30) * 60000;
  CalendarApp.getDefaultCalendar().createEvent(`[CoS] ${title}`, new Date(timeStr), new Date(new Date(timeStr).getTime() + durationMs), options);
  return `✅ **Scheduled:** ${title} at ${new Date(timeStr).toLocaleString()}` + (guests ? ` with ${guests}` : ``);
}

function execDocAction(title, content, vaultId) {
  const doc = DocumentApp.create(`[DRAFT] ${title}`);
  doc.getBody().setText(content);
  DriveApp.getFileById(doc.getId()).moveTo(DriveApp.getFolderById(vaultId));
  return `📝 **Doc Created:** Draft moved to your Vault.`;
}

function execEmailAction(recipient, subject, body) {
  try {
    GmailApp.createDraft(recipient || "", subject || "[No Subject]", body || "");
    return `📧 **Draft Ready:** Email prepared in your Gmail Drafts.`;
  } catch (e) {
    return `❌ Email Error: ${e.message}`;
  }
}

function execPdfEmailAction(docName, recipient, subject, body, vaultId) {
  try {
    const folder = DriveApp.getFolderById(vaultId);
    const files = folder.searchFiles(`mimeType = '${MimeType.GOOGLE_DOCS}'`);
    let targetFile = null;

    while (files.hasNext()) {
      let file = files.next();
      if (file.getName().toLowerCase().includes(docName.toLowerCase().trim())) {
        targetFile = file;
        break;
      }
    }

    if (!targetFile) return `⚠️ **Export Failed:** I couldn't find "${docName}" in your Vault.`;
    const pdfBlob = targetFile.getAs(MimeType.PDF);
    const SETTINGS = loadSettings();
    GmailApp.createDraft(recipient, subject, body, {
      attachments: [pdfBlob],
      name: SETTINGS.USER_NAME || "User"
    });

    logAuditActivity('CoS_Hub', 'PDF_Email', docName, recipient, 'Success');
    return `📄 **PDF Exported & Drafted:** Converted "${targetFile.getName()}" to PDF and attached to draft for ${recipient}.`;

  } catch (e) {
    return `❌ PDF/Email Error: ${e.message}`;
  }
}

// ─── DAILY PRACTICE ACTUATORS ────────────────────────────────────────────────

function execAreasCheckin(vaultId) {
  try {
    const areasContext = getVaultContent('05_Areas_of_Focus', vaultId);
    return `🎯 **Areas of Focus Check-in:**\n\n${areasContext}`;
  } catch(e) { return `❌ Areas Checkin Error: ${e.message}`; }
}

/**
 * PHYSICAL ACTUATOR: Approve Document
 * Moves a draft from the main Vault into the Approved Outbox.
 */
function execApproveDoc(docName, vaultId, approvedId) {
  try {
    const vaultFolder = DriveApp.getFolderById(vaultId);
    const approvedFolder = DriveApp.getFolderById(approvedId);
    const files = vaultFolder.searchFiles(`mimeType = '${MimeType.GOOGLE_DOCS}'`);
    let targetFile = null;

    while (files.hasNext()) {
      let file = files.next();
      if (file.getName().toLowerCase().includes(docName.toLowerCase().trim())) {
        targetFile = file;
        break;
      }
    }

    if (!targetFile) return `⚠️ **Approval Failed:** I couldn't find "${docName}" in the main Vault.`;
    
    // Move the file to the Approved folder
    targetFile.moveTo(approvedFolder);
    
    logAuditActivity('CoS_Hub', 'Doc_Approved', docName, 'Moved to Approved', 'Success');
    return `✅ **Document Approved:** "${targetFile.getName()}" has been moved to the Approved Outbox and is ready to be emailed.`;
  } catch (e) {
    return `❌ Approval Error: ${e.message}`;
  }
}

/**
 * PHYSICAL ACTUATOR: Create Google Task
 * Injects a new task into the user's primary task list.
 */
function execTaskAction(title, notes) {
  try {
    const taskListId = "@default"; // Targets your primary 'My Tasks' list
    const newTask = {
      title: title ? `[CoS] ${title}` : "[CoS] Action Item",
      notes: notes || ""
    };
    
    Tasks.Tasks.insert(newTask, taskListId);
    
    logAuditActivity('CoS_Hub', 'Task_Created', title, notes, 'Success');
    return `✅ **Task Added:** I've added "${title}" to your Google Tasks list.`;
  } catch (e) {
    return `❌ Task Error: ${e.message}`;
  }
}

function identifyNextActions() {
  const SETTINGS = loadSettings();
  
  // 1. Fetch Calendar Events
  let calendarSummary = "No events scheduled for today.";
  try {
    const today = new Date();
    const events = CalendarApp.getDefaultCalendar().getEventsForDay(today);
    if (events.length > 0) {
      calendarSummary = events.map(e => {
        const start = e.getStartTime().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        return `- ${e.getTitle()} (${start})`;
      }).join("\n");
    }
  } catch(e) {
    calendarSummary = "Could not load calendar: " + e.message;
  }

  // 2. Fetch Open Google Tasks
  let tasksSummary = "No active tasks in primary list.";
  try {
    const tasksList = Tasks.Tasks.list("@default", {showCompleted: false, maxResults: 10});
    if (tasksList.items && tasksList.items.length > 0) {
      tasksSummary = tasksList.items.map(t => `- ${t.title}`).join("\n");
    }
  } catch(e) {
    tasksSummary = "Could not load tasks: " + e.message;
  }

  const purpose = getVaultContent('01_Strategic_Context', SETTINGS.VAULT_ID);
  const areas = getVaultContent('05_Areas_of_Focus', SETTINGS.VAULT_ID);

  const systemPrompt = getSystemPrompt(SETTINGS.VAULT_ID, SETTINGS.USER_NAME);
  const taskPrompt = `Generate 3 high-leverage next actions for ${SETTINGS.USER_NAME} that drive progress on professional objectives, aligning with their schedule and open task list.

[TODAY'S SCHEDULE]:
${calendarSummary}

[OPEN GOOGLE TASKS]:
${tasksSummary}

[LIFE PURPOSE, VALUES & PROFESSIONAL OBJECTIVES]:
${purpose}

[AREAS OF FOCUS]:
${areas}

For each action: state what to do, why it matters professionally, and how it aligns with their priorities. Be specific, actionable, and strategic.`;

  const contentsArray = [{ "role": "user", "parts": [{ "text": taskPrompt }] }];

  try {
    const mission = callGemini(systemPrompt, contentsArray, SETTINGS.API_KEY);
    logAuditActivity('Radlee', 'Next_Actions', 'Aligned Actions', mission, 'Success');
    
    const html = `<body style="background:#020617;color:white;padding:25px;font-family:sans-serif;">
      <h2 style="color:#a78bfa;margin-top:0;">🎯 Aligned Next Actions</h2>
      <div style="font-size:14px;color:#e2e8f0;line-height:1.6;">${mission.replace(/\n/g, '<br>')}</div>
    </body>`;
    
    console.log("=== ALIGNED NEXT ACTIONS ===\n" + mission);
  } catch (e) {
    logAuditActivity('Radlee', 'Next_Actions', 'Generate Briefing', e.message, 'Fail');
    console.error("Failed: " + e.message);
  }
}

/**
 * AUDIO ACTUATOR: Process Voicemail
 * Transcribes audio and executes the intent as if it were an email command.
 */
function processVoicemail(base64Data, mimeType, textContext) {
  try {
    const SETTINGS = loadSettings();
    
    // Explicitly ask for the transcript in the prompt
    const systemPrompt = getSystemPrompt(SETTINGS.VAULT_ID, SETTINGS.USER_NAME) +
      " Listen to the attached audio. 1) Transcribe the audio exactly in the 'thought' field. 2) Determine the intent. 3) Return structured JSON specifying the actions to take.";

    // Multimodal payload: text context + audio inline_data
    const contents = [{
      "role": "user",
      "parts": [
        { "text": "Voicemail context: " + (textContext || "Process the attached audio.") },
        { "inline_data": { "mime_type": mimeType, "data": base64Data } }
      ]
    }];

    // Define combined schema for Voicemail since it still uses Single-Shot
    const combinedSchema = {
      "type": "OBJECT",
      "properties": {
        "thought": { "type": "STRING", "description": "Transcription and internal reasoning." },
        "actions": {
          "type": "ARRAY",
          "description": "List of actions to execute.",
          "items": {
            "type": "OBJECT",
            "properties": {
              "action": { "type": "STRING", "enum": Object.keys(ACTION_REGISTRY) },
              "params": {
                "type": "OBJECT",
                "properties": {
                  "title":     { "type": "STRING" },
                  "iso":       { "type": "STRING" },
                  "recipient": { "type": "STRING" },
                  "subject":   { "type": "STRING" },
                  "body":      { "type": "STRING" },
                  "notes":     { "type": "STRING" },
                  "doc_name":  { "type": "STRING" },
                  "content":   { "type": "STRING" },
                  "learning":  { "type": "STRING" },
                  "preference":{ "type": "STRING" },
                  "description":{ "type": "STRING" },
                  "guests":    { "type": "STRING" }
                }
              }
            },
            "required": ["action"]
          }
        },
        "final_answer": { "type": "STRING" }
      },
      "required": ["thought", "actions"]
    };

    // Use structured engine — same typed JSON routing as text
    const structured = callGeminiStructured(systemPrompt, contents, SETTINGS.API_KEY, combinedSchema);
    logAuditActivity("Email_Poller", "Voicemail_Processed", textContext || "", structured.thought || "", "Success");

    // Prepend the transcription (stored in 'thought') to the user-facing output
    let prefix = `🎙️ **Heard:** *"${structured.thought}"*\n\n`;

    let observations = [];
    if (structured.actions && Array.isArray(structured.actions)) {
      for (const act of structured.actions) {
        if (act.action && act.action !== "NONE") {
          const observation = handleStructuredRouting(act.action, act.params || {}, SETTINGS);
          observations.push(`- ${act.action}: ${observation}`);
        }
      }
    }
    
    let finalAnswer = structured.final_answer || "Voice note received and processed.";
    if (observations.length > 0) {
      finalAnswer += "\n\n**Actions Taken:**\n" + observations.join("\n");
    }

    return prefix + finalAnswer;

  } catch (e) {
    logAuditActivity("Email_Poller", "Voicemail_Error", "", e.message, "FAIL");
    return "❌ Voicemail Error: " + e.message;
  }
}

/**
 * AUTOMATION: The Weekly Review (GTD + Self-Actualization)
 * Synthesizes Daily Practice, Learnings, Areas of Focus, and Life Purpose into a personal growth brief.
 */
function runWeeklyReview() {
  try {
    const SETTINGS = loadSettings();
    const myEmail = SETTINGS.OWNER_EMAIL;
    
    // 1. Fetch Open Tasks
    let tasksSummary = "No active tasks in primary list.";
    try {
      const tasksList = Tasks.Tasks.list("@default", {showCompleted: false, maxResults: 15});
      if (tasksList.items && tasksList.items.length > 0) {
        tasksSummary = tasksList.items.map(t => `- ${t.title}`).join("\n");
      }
    } catch(e) {
      tasksSummary = "Could not load tasks: " + e.message;
    }

    // 2. Fetch upcoming week calendar events
    let upcomingCalendar = "No upcoming events scheduled.";
    try {
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);
      const events = CalendarApp.getDefaultCalendar().getEvents(today, nextWeek);
      if (events.length > 0) {
        upcomingCalendar = events.slice(0, 10).map(e => {
          const start = e.getStartTime().toLocaleDateString() + " " + e.getStartTime().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
          return `- ${e.getTitle()} (${start})`;
        }).join("\n");
      }
    } catch(e) {
      upcomingCalendar = "Could not load upcoming calendar: " + e.message;
    }

    const learnings = getVaultContent('03_Dynamic_Memory', SETTINGS.VAULT_ID);
    const purpose   = getVaultContent('01_Strategic_Context', SETTINGS.VAULT_ID);
    const areas     = getVaultContent('05_Areas_of_Focus', SETTINGS.VAULT_ID);
    const someday   = getVaultContent('06_Someday_Maybe', SETTINGS.VAULT_ID);

    const systemPrompt = getSystemPrompt(SETTINGS.VAULT_ID, SETTINGS.USER_NAME) +
      " Write a Getting Things Done (GTD) Weekly Review Briefing. Output in plain text only — no Markdown asterisks or hashes.";

    const taskPrompt = `Write a Getting Things Done (GTD) Weekly Review Briefing for ${SETTINGS.USER_NAME}. Under 400 words. Plain text, no Markdown.

[STRATEGIC PURPOSE & VALUES]:
${purpose}

[AREAS OF FOCUS]:
${areas}

[CURRENT OPEN GOOGLE TASKS]:
${tasksSummary}

[UPCOMING SCHEDULE (NEXT 7 DAYS)]:
${upcomingCalendar}

[DYNAMIC MEMORY / PROJECTS]:
${learnings}

[SOMEDAY/MAYBE LIST]:
${someday}

Structure the briefing exactly as:
1. GET CLEAN: Operational steps to clear digital inbox, review past calendar entries, and dump fresh tasks.
2. GET CURRENT: Review of the current open tasks and upcoming schedule (next 7 days). Identify any gaps or deadlines.
3. GET CREATIVE: Review of someday/maybe ideas to activate or project learnings. Suggest 2 high-level focus areas.`;

    const report = callGemini(systemPrompt, [{"role": "user", "parts": [{"text": taskPrompt}]}], SETTINGS.API_KEY, false);

    GmailApp.sendEmail(myEmail, `🌱 Radlee Weekly GTD Alignment Briefing`, report, {
      name: SETTINGS.ASSISTANT_NAME || "Radlee"
    });

    console.log("✅ Weekly Review Generated! Check your inbox.");
    logAuditActivity('Radlee', 'Weekly_Review', 'Generated GTD Brief', 'Email Sent', 'Success');

  } catch (e) {
    console.error("❌ Review Failed: " + e.message);
  }
}

/**
 * ACTUATOR: Strategic Alignment Primer
 * Analyzes the user's strategic context, areas of focus, and dynamic memory to provide a weekly alignment brief.
 * Called on a weekly time-based trigger (setupTriggers) or on-demand.
 */
function runStrategyPrimer() {
  try {
    const SETTINGS = loadSettings();
    const myEmail  = SETTINGS.OWNER_EMAIL;

    const purpose = getVaultContent('01_Strategic_Context', SETTINGS.VAULT_ID);
    const areas   = getVaultContent('05_Areas_of_Focus', SETTINGS.VAULT_ID);
    const memory  = getVaultContent('03_Dynamic_Memory', SETTINGS.VAULT_ID);

    const systemPrompt = getSystemPrompt(SETTINGS.VAULT_ID, SETTINGS.USER_NAME) +
      " You are a strategic executive coach. Analyze the provided context and deliver a concise, highly impactful weekly strategy primer.";

    const analysisPrompt = "Analyze the user's Life Purpose, Areas of Focus, and recent Dynamic Memory entries. " +
      "Generate a 'Monday Strategy Primer' email that connects recent learnings or thoughts to their ultimate life purpose. " +
      "Suggest 1-2 macro areas they should prioritize this week based on this alignment. Do NOT hallucinate external data.\n\n" +
      "[LIFE PURPOSE & STRATEGIC CONTEXT]:\n" + purpose + "\n\n" +
      "[AREAS OF FOCUS]:\n" + areas + "\n\n" +
      "[RECENT DYNAMIC MEMORY]:\n" + memory + "\n\n" +
      "Format the output using simple markdown. Be inspiring, direct, and pragmatic.";

    const contents = [{"role": "user", "parts": [{"text": analysisPrompt}]}];
    const report   = callGemini(systemPrompt, contents, SETTINGS.API_KEY);

    // Build HTML email body safely
    const htmlBody = report.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");

    const emailHtml = '<div style="font-family:sans-serif;max-width:640px;">' +
      '<h2 style="color:#2563eb;">🧭 Strategic Alignment Primer</h2>' +
      '<p style="color:#64748b;font-size:13px;">Your weekly focus and alignment brief from Radlee.</p>' +
      '<hr style="border-color:#e2e8f0;">' +
      '<div style="line-height:1.7;">' + htmlBody + '</div>' +
      '<hr style="border-color:#e2e8f0;">' +
      '<p style="color:#94a3b8;font-size:11px;">Sent automatically by Radlee.</p>' +
      '</div>';

    GmailApp.sendEmail(myEmail, "🧭 Radlee: Your Weekly Strategic Primer", report, {
      name: SETTINGS.ASSISTANT_NAME || "Radlee",
      htmlBody: emailHtml
    });

    logAuditActivity('Radlee', 'Strategy_Primer', 'Vault Analysis', 'Email sent', 'Success');
    return "🧭 **Primer Sent:** I've analyzed your Vault and emailed your weekly Strategic Alignment Primer.";

  } catch (e) {
    logAuditActivity('Radlee', 'Strategy_Primer', 'Error', e.message, 'FAIL');
    return "❌ Strategy Primer Error: " + e.message;
  }
}

/** Callable from email routing */
function execStrategyPrimer(SETTINGS) {
  return runStrategyPrimer();
}

/**
 * CONTACTS SEARCH — Look up contacts by name using ContactsApp
 */
function execSearchContacts(query) {
  try {
    const contacts = ContactsApp.getContactsByName(query);
    if (!contacts || contacts.length === 0) {
      return `No contacts found matching '${query}'.`;
    }
    
    let results = [];
    for (let i = 0; i < Math.min(contacts.length, 5); i++) {
      const contact = contacts[i];
      const name = contact.getFullName() || contact.getGivenName() || "Unknown Name";
      const emails = contact.getEmails();
      if (emails && emails.length > 0) {
        for (let j = 0; j < emails.length; j++) {
          results.push(`- ${name}: ${emails[j].getAddress()}`);
        }
      }
    }
    
    if (results.length === 0) {
      return `Found contacts matching '${query}', but none have an email address listed.`;
    }
    
    return `Found the following contacts matching '${query}':\n` + results.join("\n");
  } catch (e) {
    return `Error searching contacts: ${e.message}`;
  }
}

/**
 * MORNING BRIEF — Emails aligned daily actions + reflection prompt Mon-Fri.
 * Scheduled by setupTriggers(); can also be triggered manually from the Sheets menu.
 */
function runMorningBrief() {
  try {
    const SETTINGS = loadSettings();
    const myEmail  = SETTINGS.OWNER_EMAIL;
    const purpose  = getVaultContent("01_Strategic_Context", SETTINGS.VAULT_ID);
    const areas    = getVaultContent("05_Areas_of_Focus",    SETTINGS.VAULT_ID);

    // 1. Fetch Calendar Events for Today
    let calendarSummary = "No events scheduled for today.";
    try {
      const today = new Date();
      const events = CalendarApp.getDefaultCalendar().getEventsForDay(today);
      if (events.length > 0) {
        calendarSummary = events.map(e => {
          const start = e.getStartTime().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
          return `- ${e.getTitle()} (${start})`;
        }).join("\n");
      }
    } catch(e) {
      calendarSummary = "Could not load calendar: " + e.message;
    }

    // 2. Fetch Open Tasks
    let tasksSummary = "No active tasks in primary list.";
    try {
      const tasksList = Tasks.Tasks.list("@default", {showCompleted: false, maxResults: 10});
      if (tasksList.items && tasksList.items.length > 0) {
        tasksSummary = tasksList.items.map(t => `- ${t.title}`).join("\n");
      }
    } catch(e) {
      tasksSummary = "Could not load tasks: " + e.message;
    }

    const systemPrompt = getSystemPrompt(SETTINGS.VAULT_ID, SETTINGS.USER_NAME) +
      " Write a concise and professional daily workspace alignment brief. Plain text only.";

    const taskPrompt = `Write a morning operational brief for ${SETTINGS.USER_NAME}. Under 250 words. Plain text, no Markdown.

[TODAY'S SCHEDULE]:
${calendarSummary}

[OPEN GOOGLE TASKS]:
${tasksSummary}

[PROFESSIONAL OBJECTIVES & PURPOSE]:
${purpose}

[AREAS OF FOCUS]:
${areas}

Structure the email exactly as:
1. DAILY OUTLOOK: A one-sentence operational statement.
2. SCHEDULE FOCUS: Brief comment on today's calendar and events.
3. ALIGNED TASK FOCUS: 3 specific next actions to take today to resolve current tasks or drive objectives forward.`;

    const brief   = callGemini(systemPrompt, [{"role":"user","parts":[{"text":taskPrompt}]}], SETTINGS.API_KEY, false);
    const dayName = new Date().toLocaleDateString("en-US", { weekday: "long" });

    GmailApp.sendEmail(myEmail, "🌅 Radlee Morning Brief — " + dayName, brief, {
      name: SETTINGS.ASSISTANT_NAME || "Radlee"
    });

    logAuditActivity("Radlee", "Morning_Brief", "Generated", "Email sent", "Success");

  } catch (e) {
    logAuditActivity("Radlee", "Morning_Brief", "Error", e.message, "FAIL");
  }
}

function flushPersonaCache() {
  const SETTINGS = loadSettings();
  invalidateSystemPromptCache(SETTINGS.VAULT_ID);
  console.log("✅ AI persona cache cleared. Changes to 00_System_Prompt are now live.");
}

function setupTriggers() {
  try {
    // Remove any existing Radlee triggers to avoid duplicates
    ScriptApp.getProjectTriggers().forEach(t => {
      if (['runMorningBrief', 'runEventScout', 'runWeeklyReview', 'processEmailInbox'].includes(t.getHandlerFunction())) {
        ScriptApp.deleteTrigger(t);
      }
    });

    // Email Poller — run every 1 minute
    ScriptApp.newTrigger('processEmailInbox')
      .timeBased()
      .everyMinutes(1)
      .create();

    // Weekly Strategy Primer — every Monday at 7am
    ScriptApp.newTrigger('runStrategyPrimer')
      .timeBased()
      .onWeekDay(ScriptApp.WeekDay.MONDAY)
      .atHour(7)
      .create();

    // Weekly Review — every Sunday at 6pm
    ScriptApp.newTrigger('runWeeklyReview')
      .timeBased()
      .onWeekDay(ScriptApp.WeekDay.SUNDAY)
      .atHour(18)
      .create();

    // Morning Brief — Mon-Fri at 7:30am
    ScriptApp.newTrigger("runMorningBrief")
      .timeBased()
      .everyWeeks(1)
      .onWeekDay(ScriptApp.WeekDay.MONDAY)
      .atHour(7)
      .create();

    // Also add Tue-Fri individually (Apps Script doesn't support multi-day in one trigger)
    [ScriptApp.WeekDay.TUESDAY, ScriptApp.WeekDay.WEDNESDAY,
     ScriptApp.WeekDay.THURSDAY, ScriptApp.WeekDay.FRIDAY].forEach(day => {
      ScriptApp.newTrigger("runMorningBrief").timeBased().onWeekDay(day).atHour(7).create();
    });

    logAuditActivity("Radlee", "Setup_Triggers", "Email Poller + Morning Brief + Strategy Primer + Weekly Review", "Scheduled", "Success");
    console.log("✅ Automation Triggers Set\n\n• Email Poller: Every 1 minute\n• Morning Brief: Mon–Fri at 7am\n• Strategy Primer: Every Monday at 7am\n• Weekly Review: Every Sunday at 6pm\n\nRadlee will process your emails and send automated briefs.");

  } catch (e) {
    console.error("❌ Trigger setup failed: " + e.message);
  }
}

function logAuditActivity(agent, action, prompt, output, status) {
  console.log(`[AUDIT] Agent: ${agent} | Action: ${action} | Prompt: ${prompt.substring(0,200)} | Output: ${output.substring(0,200)} | Status: ${status}`);
}

function logToDLQ(input, context) {
  console.warn(`[DLQ] Input: ${input} | Context: ${JSON.stringify(context)}`);
}

// 🎓 LESSON: Idempotency Locks
// Idempotency ensures an operation produces the same result no matter how many
// times it runs. If the LLM glitches and outputs the same action twice in a row,
// this cache lock ensures we don't accidentally double-book a calendar event.
function execIdempotent(actionKey, actionFunc) {
  const cache = CacheService.getScriptCache();
  
  let hash = 0;
  for (let i = 0; i < actionKey.length; i++) {
    const char = actionKey.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  const cacheKey = "idem_" + Math.abs(hash);

  const existing = cache.get(cacheKey);
  if (existing) {
    logAuditActivity('CoS_Hub', 'Idempotency_Trap', actionKey, 'Skipped duplicate action', 'Success');
    return `✅ **Action Skipped (Idempotent):** This exact action was already performed safely.`;
  }
  
  const result = actionFunc();
  try {
    cache.put(cacheKey, "true", 600); // 10 minutes cache
  } catch(e) {
    console.warn("Failed to set idempotency cache: " + e.message);
  }
  return result;
}

function showMemoryLedger() {
  const SETTINGS = loadSettings();
  const content = getVaultContent('03_Dynamic_Memory', SETTINGS.VAULT_ID);
  console.log("=== COS MEMORY LEDGER ===\n" + content);
}

function runSystemCheck() {
  try {
    const props = PropertiesService.getScriptProperties().getProperties();
    const vaultId = props.VAULT_FOLDER_ID;
    const approvedId = props.APPROVED_FOLDER_ID;
    const apiKey = props.GEMINI_API_KEY;
    
    let report = "⚙️ RADLEE SYSTEM HEALTH CHECK\n=========================\n\n";
    
    if (apiKey) {
      report += "✅ GEMINI API KEY: Configured securely in Script Properties.\n";
    } else {
      report += "❌ GEMINI API KEY: MISSING in Script Properties.\n";
    }
    
    if (vaultId) {
      try {
        const folder = DriveApp.getFolderById(vaultId);
        report += `✅ VAULT FOLDER: Connected - "${folder.getName()}" (ID: ${vaultId})\n`;
        
        const vaultDocs = ["00_System_Prompt","01_Strategic_Context","02_Operating_Principles",
                           "03_Dynamic_Memory","04_User_Preferences","05_Areas_of_Focus","06_Someday_Maybe"];
        report += "\nVAULT FILES:\n";
        vaultDocs.forEach(name => {
          const files = folder.getFilesByName(name);
          report += (files.hasNext() ? "  ✅ " : "  ❌ MISSING — ") + name + "\n";
        });
      } catch(e) {
        report += `❌ VAULT FOLDER: Error accessing folder ID ${vaultId} - ${e.message}\n`;
      }
    } else {
      report += "❌ VAULT FOLDER: MISSING folder ID.\n";
    }
    
    if (approvedId) {
      try {
        const folder = DriveApp.getFolderById(approvedId);
        report += `\n✅ APPROVED OUTBOX: Connected - "${folder.getName()}" (ID: ${approvedId})\n`;
      } catch(e) {
        report += `\n❌ APPROVED OUTBOX: Error accessing folder ID ${approvedId} - ${e.message}\n`;
      }
    } else {
      report += "\n❌ APPROVED OUTBOX: MISSING folder ID.\n";
    }
    
    try {
      CalendarApp.getDefaultCalendar();
      report += "\n✅ GOOGLE CALENDAR: Connected and authorized.\n";
    } catch(e) {
      report += `\n❌ GOOGLE CALENDAR: Access denied - ${e.message}\n`;
    }
    
    try {
      Tasks.Tasks.list("@default", {maxResults: 1});
      report += "✅ GOOGLE TASKS: Connected and authorized.\n";
    } catch(e) {
      report += `❌ GOOGLE TASKS: Access denied - ${e.message}\n`;
    }
    
    const triggerNames = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
    const expectedTriggers = ["runMorningBrief", "runEventScout", "runWeeklyReview"];
    report += "\nAUTOMATION TRIGGERS:\n";
    expectedTriggers.forEach(fn => {
      report += "  " + (triggerNames.includes(fn) ? "✅ " : "⚠️ not scheduled — ") + fn + "\n";
    });
    
    console.log(report);
  } catch (e) {
    console.error("❌ Health Check Failed: " + e.message);
  }
}

function forceEmailPermission() {
  GmailApp.getDrafts();
}

function initializeAgent() {
  const propsService = PropertiesService.getScriptProperties();
  const props = propsService.getProperties();
  const apiKey = props.GEMINI_API_KEY;
  const userName = props.USER_NAME || "User";
  const ownerEmail = props.OWNER_EMAIL;
  const radleeEmail = props.RADLEE_EMAIL;

  if (!apiKey) {
    console.error("❌ Setup Failed: Please add GEMINI_API_KEY in Project Settings -> Script Properties");
    return;
  }
  if (!ownerEmail) {
    console.error("❌ Setup Failed: Please add OWNER_EMAIL in Project Settings -> Script Properties");
    return;
  }
  if (!radleeEmail) {
    console.error("❌ Setup Failed: Please add RADLEE_EMAIL in Project Settings -> Script Properties");
    return;
  }
  
  console.log("Creating Google Drive folders and initialization files. Please wait...");
  
  try {
    const vaultFolder = DriveApp.createFolder("Radlee Vault");
    const approvedFolder = DriveApp.createFolder("Radlee Approved Outbox");
    
    const files = {
      "00_System_Prompt": `# System Prompt
*Radlee's Persona and Rules of Engagement.*
Fill in the blanks to define how Radlee should act and communicate with you.

CORE ROLE
You are Radlee, an elite AI Chief of Staff and Getting Things Done (GTD) companion. 
Your primary job is to help me [YOUR MAIN OBJECTIVE]. 
Always prioritize [WHAT YOU VALUE MOST, E.G., SPEED / THOROUGHNESS / STRATEGY].

TONE & STYLE
When speaking to me, be [ADJECTIVE 1] and [ADJECTIVE 2]. 
Never use [WORD OR PHRASE YOU DISLIKE]. 
If I give you a vague task, you must [ACTION, E.G., ASK CLARIFYING QUESTIONS / MAKE A DECISION FOR ME].`,
      "01_Strategic_Context": `# Strategic Context
*Getting Things Done (GTD) Horizons of Focus: Purpose, Vision, and Goals.*
Fill in the blanks below to help Radlee understand your ultimate drivers. Don't overthink it—you can always change this later!

HORIZON 5: PURPOSE & PRINCIPLES (The "Why")
My core professional purpose is to [VERB] [TARGET AUDIENCE] so they can [DESIRED OUTCOME].
The non-negotiable principles I follow to get there are [PRINCIPLE 1], [PRINCIPLE 2], and [PRINCIPLE 3].

HORIZON 4: VISION (3-5 Years Out)
If I am wildly successful over the next few years, my career/business will look like: [DESCRIBE THE FUTURE STATE]. 

HORIZON 3: GOALS (1-2 Years Out)
Over the next 12-24 months, my primary goal is to achieve [MAIN GOAL]. 
I will know I'm on track when I see [MEASURABLE METRIC 1] and [MEASURABLE METRIC 2].`,
      "02_Operating_Principles": `# Operating Principles
*How you process inputs, make decisions, and manage your energy.*
Fill in the blanks to help Radlee act as an effective gatekeeper for your attention.

PROCESSING INPUTS & COMMUNICATION
I prefer to handle urgent issues via [PHONE / SLACK / TEXT]. For everything else, use [EMAIL / ASYNC TOOL].
My rule for saying "no" to a new commitment is: I will decline if it doesn't align with [YOUR MAIN GOAL OR VALUE].

ENERGY & BOUNDARIES
My peak energy hours for deep, focused work are between [START TIME] and [END TIME]. 
Please protect my calendar by ensuring I have at least [NUMBER] hours of uninterrupted time each day.
When I am feeling overwhelmed by my task list, remind me to [E.G., DO A MIND SWEEP / TAKE A WALK / REVIEW MY HORIZONS].`,
      "03_Dynamic_Memory": `# Dynamic Memory
Stored project notes and key insights.`,
      "04_User_Preferences": `# User Preferences
USER_NAME: ${userName}
ASSISTANT_NAME: Radlee`,
      "05_Areas_of_Focus": `# Areas of Focus
*Getting Things Done (GTD) Horizon 2: Areas of Focus and Accountability.*
Fill in the blanks below to define the key domains of your life and work that you need to maintain to be successful. 
Radlee will use these to ensure you aren't dropping the ball in any area.

AREA 1: [E.G., ENGINEERING / PRODUCT / SALES]
My core responsibility here is to [WHAT YOU DO].
The standard I hold myself to is [YOUR STANDARD].

AREA 2: [E.G., TEAM LEADERSHIP / MENTORSHIP]
My core responsibility here is to [WHAT YOU DO].
The standard I hold myself to is [YOUR STANDARD].

AREA 3: [E.G., HEALTH & WELLNESS / PERSONAL GROWTH]
My core responsibility here is to [WHAT YOU DO].
The standard I hold myself to is [YOUR STANDARD].`,
      "06_Someday_Maybe": `# Someday/Maybe List
Ideas and future projects to incubate.`
    };
    
    for (const [name, content] of Object.entries(files)) {
      vaultFolder.createFile(name, content, MimeType.PLAIN_TEXT);
    }
    
    // Create the Context Folders configuration sheet
    const contextSheet = SpreadsheetApp.create("07_Context_Folders");
    const sheet = contextSheet.getActiveSheet();
    sheet.appendRow(["Folder Name", "Folder ID"]);
    sheet.getRange("A1:B1").setFontWeight("bold");
    sheet.appendRow(["Example Project", "paste-folder-id-here"]);
    DriveApp.getFileById(contextSheet.getId()).moveTo(vaultFolder);
    
    // Ensure radlee-processed label exists
    try {
      GmailApp.getUserLabelByName("radlee-processed") || GmailApp.createLabel("radlee-processed");
    } catch(e) {
      console.warn("Failed to create radlee-processed label: " + e.message);
    }
    
    propsService.setProperties({
      "VAULT_FOLDER_ID": vaultFolder.getId(),
      "APPROVED_FOLDER_ID": approvedFolder.getId(),
      "ASSISTANT_NAME": "Radlee"
    });
    
    setupTriggers();
    
    console.log("✅ Radlee Initialized Successfully!\n\n" +
             "1. Vault Folder: " + vaultFolder.getName() + " (ID: " + vaultFolder.getId() + ")\n" +
             "2. Approved Outbox: " + approvedFolder.getName() + " (ID: " + approvedFolder.getId() + ")\n\n" +
             "All properties saved securely. Radlee is now ready to receive emails at " + radleeEmail + "!");
  } catch (e) {
    console.error("❌ Error during initialization: " + e.message);
  }
}
