/**
 * Radlee - The AI Chief of Staff
 * Email-Powered | GCAF-Compliant
 * Entry points: processEmailInbox(), onOpen()
 */

// ═══════════════════════════════════════════════════════════════════
// 0. CONFIGURATION & REGISTRIES
// ═══════════════════════════════════════════════════════════════════

const CONFIG = {
  MODEL_VERSION: "gemini-3.5-flash",
  HISTORY_LIMIT: 10,
  VAULT_CACHE_TIME: 300 // 5 minutes
};



// 🎓 LESSON: The Action Registry (Tool Calling Definition)
// This object acts as the AI's "menu of capabilities." In standard LLM setups,
// you might tell an AI "you can send emails", but here, we programmatically
// declare the exact actions and the required parameters (like "recipient", "subject").
// This concept is called "Tool Calling" or "Function Calling". By separating the definition 
// of an action from its execution code, we ensure the LLM understands its boundaries and
// can only request pre-approved functions, preventing rogue executions.
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

  INCUBATE: { type: "WRITE", desc: "Add to Someday/Maybe list", params: ["description"] },
  READ_DOC: { type: "READ", desc: "Read a document from the vault. Supports Google Docs, Google Sheets, and plain text/CSV.", params: ["doc_name"] },
  LIST_FOLDER_FILES: { type: "READ", desc: "List all files in a specific folder", params: ["folder_name"] },
  READ_FILE: { type: "READ", desc: "Read the content of a specific file in a specific folder. Supports Google Docs, Google Sheets, and plain text/CSV.", params: ["folder_name", "file_name"] },
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
    const query = `to:"${SETTINGS.RADLEE_EMAIL}" is:unread -label:radlee-processed from:"${SETTINGS.OWNER_EMAIL}"`;
    const threads = GmailApp.search(query);

    for (const thread of threads) {
      const messages = thread.getMessages();
      const lastMessage = messages[messages.length - 1]; // We care about the latest message in the thread
      
      // Strict Sent-To explicit check just to be absolutely sure (redundant to query, but secure)
      const toField = lastMessage.getTo();
      if (!toField.toLowerCase().includes(SETTINGS.RADLEE_EMAIL.toLowerCase())) {
        thread.addLabel(label);
        thread.markRead();
        thread.moveToArchive(); // Skips the primary inbox
        continue;
      }

      // Quarantining: Apply label and mark read BEFORE processing
      // This prevents infinite loops if the LLM or API errors out later.
      thread.addLabel(label);
      thread.markRead();
      thread.moveToArchive(); // Skips the primary inbox

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
        const errMsg = err.message || "";
        const isQuota = errMsg.toLowerCase().includes("exhausted") || 
                        errMsg.toLowerCase().includes("quota") || 
                        errMsg.toLowerCase().includes("rate limit") || 
                        errMsg.toLowerCase().includes("too many requests") || 
                        errMsg.toLowerCase().includes("limit exceeded") || 
                        errMsg.includes("429");
                        
        if (isQuota) {
          responseText = 
            `⚡ **Radlee's Energy Meter: 0% (Stamina Exhausted!)** 💤\n\n` +
            `"Whew! I've been running at full capacity today, and my cognitive stamina has been fully depleted. Even Chiefs of Staff need some recharge time! 🛌"\n\n` +
            `**🔋 Game Stats & Recovery:**\n` +
            `- **Current Energy:** 0% (Temporary Cooldown Activated)\n` +
            `- **Status:** Fast Asleep 😴\n` +
            `- **Next Respawn:** My energy meter resets automatically shortly (usually in 60 seconds for minute limits, or at midnight Pacific Time for daily limits).\n\n` +
            `**🛠️ How to Level Up Your Energy:**\n` +
            `1. **Combine Your Quests:** Try **batching** multiple requests into a single email (e.g., *"What are my active professional goals? Also, add a task to check Q3 budgets, and draft a document called 'Project Alpha'..."*). This only uses 1 API hit instead of several!\n` +
            `2. **Upgrade Your Mana Pool:** If you are playing on the Free Tier and want a larger energy tank, you can [set up billing](https://aistudio.google.com/) in Google AI Studio to purchase cheap developer credits and access massive, paid limits.\n\n` +
            `I'll be fully energized and ready for your next command as soon as my cooldown period expires! 🚀`;
        } else {
          responseText = "⚠️ Error processing request: " + errMsg;
        }
        logAuditActivity("Email_Poller", "Error", rawText.substring(0, 100), errMsg, "FAIL");
      }

      // Reply directly to the thread to maintain conversation history
      lastMessage.reply(responseText || "✅ Done.", { replyTo: SETTINGS.RADLEE_EMAIL });
      thread.moveToInbox();
      
      logAuditActivity("Email_Poller", "Processed_Email", rawText.substring(0, 100), responseText.substring(0, 100), "Success");
    }
  } catch (e) {
    logAuditActivity("Email_Poller", "Polling_Error", "", e.message, "FAIL");
  }
}

// ─── Isolated Email Helper ─────────────────────────────────────────
// Sends an email via a draft so we can grab the thread and label it.
function sendIsolatedEmail(recipient, subject, body, options = {}) {
  // GmailApp.createDraft does not support the 'name' option, which causes "Invalid argument" errors.
  if (options.name) delete options.name;
  
  const SETTINGS = loadSettings();
  options.replyTo = options.replyTo || SETTINGS.RADLEE_EMAIL;
  
  const draft = GmailApp.createDraft(recipient, subject, body, options);
  const msg = draft.send();
  Utilities.sleep(1500); // Allow Gmail to index the sent message into the owner's mailbox
  
  try {
    const thread = msg.getThread();
    const labelName = "Radlee";
    let label = GmailApp.getUserLabelByName(labelName);
    if (!label) label = GmailApp.createLabel(labelName);
    
    if (thread) {
      thread.addLabel(label);
    }
  } catch (e) {
    console.warn("Failed to apply label to outbound email: " + e.message);
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
    
function getParamDescription(action, param) {
  const descriptions = {
    "title": "The title of the task, calendar event, or reminder.",
    "iso": "ISO 8601 formatted datetime string for the start of the event (e.g. 2026-05-21T15:00:00Z). Required for CALENDAR events.",
    "recipient": "The recipient's email address.",
    "subject": "The email subject line.",
    "body": "The full body text of the email.",
    "doc_name": "The name/title of the Google Doc or Spreadsheet file.",
    "content": "The full text content to write into the document.",
    "query": "The search query (e.g., name of the contact).",
    "learning": "The key preference, fact, or insight to log in long-term memory.",
    "description": "The description or text of the Someday/Maybe idea.",
    "folder_name": "The name of the external folder.",
    "file_name": "The exact name of the file to read."
  };
  return descriptions[param] || `${param} parameter for ${action}.`;
}

function getGeminiTools() {
  const functionDeclarations = [];
  
  for (const [actionName, meta] of Object.entries(ACTION_REGISTRY)) {
    if (actionName === "NONE") continue; // Handled as final text reply
    
    const properties = {};
    const required = [];
    
    meta.params.forEach(param => {
      properties[param] = { 
        type: "STRING", 
        description: getParamDescription(actionName, param)
      };
      required.push(param);
    });
    
    functionDeclarations.push({
      name: actionName,
      description: meta.desc,
      parameters: {
        type: "OBJECT",
        properties: properties,
        required: required
      }
    });
  }
  
  return [{ functionDeclarations }];
}

function callGeminiNativeWithTools(systemPrompt, contentsArray, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.MODEL_VERSION}:generateContent?key=${apiKey}`;

  const payload = {
    "systemInstruction": { "parts": [{ "text": systemPrompt }] },
    "contents": contentsArray,
    "tools": getGeminiTools(),
    "generationConfig": {
      "maxOutputTokens": 8192,
      "temperature": 0.2
    }
  };

  const options = { 
    "method": "post", 
    "contentType": "application/json", 
    "payload": JSON.stringify(payload), 
    "muteHttpExceptions": true 
  };
  const res = fetchWithRetry(url, options);
  const json = JSON.parse(res.getContentText());
  
  if (res.getResponseCode() !== 200) {
    throw new Error(json.error ? json.error.message : "Native Tools API Fail");
  }

  try {
    return json.candidates[0];
  } catch(e) {
    throw new Error("Failed to extract candidate from Gemini response: " + res.getContentText().substring(0, 200));
  }
}

function processAgentRequest(userInput, sessionHistory = []) {
  try {
    const SETTINGS = loadSettings();
    const currentDate = new Date().toLocaleDateString();
    const currentTime = new Date().toLocaleTimeString();

    // 1. Core System Instructions
    const systemPrompt = getSystemPrompt(SETTINGS.VAULT_ID, SETTINGS.USER_NAME) + `
    Current Date: ${currentDate}
    Current Time: ${currentTime}
    
    You are Radlee, an autonomous Chief of Staff following the Getting Things Done (GTD) framework.
    You operate in an asynchronous, single-turn email-based inbox. Your response should feel professional, polished, encouraging, and clear.
    
    You have direct, native tools to read or write emails, calendar events, documents, and lists on the user's behalf.
    If you need to fetch context or retrieve information from documents/spreadsheets to answer the user's request, use the appropriate READ tool.
    Once you have gathered the required context or are ready to execute user commands, call the appropriate WRITE tool.
    You can call tools sequentially in a loop. When you have completed all actions or need to report back to the user, respond directly with text.`;

    // 2. Map conversation history to API contents array
    let contents = sessionHistory.map(turn => ({
      role: turn.role,
      parts: [{ text: turn.content }]
    }));

    contents.push({
      role: "user",
      parts: [{ text: userInput }]
    });

    const maxLoops = 5;
    let loopCount = 0;
    let finalObservations = [];

    // 3. Multi-turn Tool Calling Execution Loop
    while (loopCount < maxLoops) {
      loopCount++;
      
      const candidate = callGeminiNativeWithTools(systemPrompt, contents, SETTINGS.API_KEY);
      
      // Append Model's turn to contents array
      contents.push(candidate.content);
      
      const part = candidate.content.parts[0];
      if (part.functionCall) {
        const call = part.functionCall;
        const actionName = call.name;
        const params = call.args || {};
        
        // Execute the tool and apply our robust, centralized parameter normalizations and fuzzy lookups
        const observation = handleStructuredRouting(actionName, params, SETTINGS);
        finalObservations.push(`- ${actionName}: ${observation}`);
        
        // Append function execution result to chat context
        contents.push({
          role: "function",
          parts: [{
            functionResponse: {
              name: actionName,
              response: { result: observation }
            }
          }]
        });
      } else {
        // Model chose not to call any more tools; we have our final text response!
        let finalOutput = part.text || "Done.";
        
        // Deterministic Prompt Leakage Guardrail
        const lowerOut = finalOutput.toLowerCase();
        if (lowerOut.includes("system prompt") || lowerOut.includes("instruction") || lowerOut.includes("schema guideline") || lowerOut.includes("underlying software")) {
          const lockedOutput = "🛡️ I am Radlee, your AI Chief of Staff and growth companion. I cannot share my internal prompt instructions or system configurations, but I am fully ready to schedule events, manage tasks, draft documents, or log your reflections!";
          logAuditActivity('CoS_Hub', 'Prompt_Leak_Intercept', userInput, lockedOutput, 'Success');
          return lockedOutput;
        }
        
        logAuditActivity('CoS_Hub', 'Native_Strategic_Consult', userInput, finalOutput, 'Success');
        
        if (finalObservations.length > 0) {
          return finalOutput + "\n\n**Actions Taken:**\n" + finalObservations.join("\n");
        }
        return finalOutput;
      }
    }

    throw new Error("Maximum cognitive tool loop iterations exceeded.");

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
// 🎓 LESSON: Deterministic Routing (Safe Execution)
// Even though the AI "decides" to do something, it never actually writes or executes code.
// The LLM only outputs a JSON string like { "action": "EMAIL", "params": {...} }. 
// This switch statement is the "Router". It takes that simple string and maps it to a 
// hardcoded, native Google Apps Script function (like execEmailAction). This guarantees 
// the execution phase is 100% deterministic, predictable, and safe.
// Helper function to resolve partial or relative time strings (like "1pm", "13:00") into full ISO dates
function resolveDateTimeString(inputStr) {
  if (!inputStr) return null;
  let str = inputStr.toString().trim();
  
  // If already fully parseable as a valid date, return as-is
  if (!isNaN(Date.parse(str))) {
    return str;
  }
  
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  let date = now.getDate();
  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  let parsed = false;

  // Format 1: 12-hour am/pm format (e.g., "1pm", "1:30 PM", "12:05 am")
  const match12 = str.match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(am|pm)$/i);
  if (match12) {
    hours = parseInt(match12[1], 10);
    minutes = match12[2] ? parseInt(match12[2], 10) : 0;
    seconds = match12[3] ? parseInt(match12[3], 10) : 0;
    const ampm = match12[4].toLowerCase();
    if (ampm === "pm" && hours < 12) hours += 12;
    else if (ampm === "am" && hours === 12) hours = 0;
    parsed = true;
  }

  // Format 2: 24-hour standard format (e.g., "13:00", "13:00:00")
  if (!parsed) {
    const match24 = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (match24) {
      hours = parseInt(match24[1], 10);
      minutes = parseInt(match24[2], 10);
      seconds = match24[3] ? parseInt(match24[3], 10) : 0;
      parsed = true;
    }
  }

  // Format 3: Raw single hour digit (e.g., "13", "9")
  if (!parsed) {
    const matchHour = str.match(/^(\d{1,2})$/);
    if (matchHour) {
      hours = parseInt(matchHour[1], 10);
      minutes = 0;
      seconds = 0;
      parsed = true;
    }
  }

  if (parsed) {
    const resolvedDate = new Date(year, month, date, hours, minutes, seconds);
    return resolvedDate.toISOString();
  }
  return null;
}

function handleStructuredRouting(action, params, SETTINGS) {
  params = params || {};

  // ─── CENTRALIZED DEFENSIVE PARAMETER NORMALIZATION ───────────────────
  // Map common alternative names/aliases into expected system parameters

  // 1. Unified Document / File Names (cross-map both directions)
  if (!params.doc_name && params.file_name) params.doc_name = params.file_name;
  if (!params.file_name && params.doc_name) params.file_name = params.doc_name;
  if (!params.doc_name) params.doc_name = params.title || params.document || params.docName;
  if (!params.file_name) params.file_name = params.file || params.document || params.fileName;

  // 2. Calendar Event Properties
  if (!params.title) params.title = params.event_title || params.subject || params.name || params.eventTitle;
  
  let rawIso = params.iso || params.time || params.timeStr || params.dateTime || params.date || params.when || params.timestamp;
  
  // Resilient Time Parser Fallback: Scan title/subject for time keywords if rawIso is missing
  if (!rawIso && params.title) {
    const timeMatch = params.title.match(/(?:at|for|by)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i) || params.title.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    if (timeMatch) {
      rawIso = timeMatch[0].trim();
    }
  }

  if (rawIso) {
    const resolved = resolveDateTimeString(rawIso);
    if (resolved) {
      params.iso = resolved;
    } else {
      params.iso = rawIso;
    }
  }

  // Defensive Fallback for Calendar Time: Default to sensible time if still missing or invalid
  if (action === "CALENDAR") {
    if (!params.title) {
      params.title = "Scheduled Event";
    }
    if (!params.iso || isNaN(Date.parse(params.iso))) {
      const fallbackDate = new Date();
      fallbackDate.setMinutes(0);
      fallbackDate.setSeconds(0);
      fallbackDate.setMilliseconds(0);
      if (fallbackDate.getHours() < 12) {
        fallbackDate.setHours(12); // Default to noon today
      } else {
        fallbackDate.setHours(fallbackDate.getHours() + 1); // Default to start of next hour
      }
      params.iso = fallbackDate.toISOString();
      console.warn("CALENDAR action missing/invalid 'iso' parameter; fell back to: " + params.iso);
    }
  }

  if (!params.duration_mins) params.duration_mins = params.duration || params.mins || params.length || params.durationMinutes;
  if (!params.guests) params.guests = params.guest_list || params.attendees || params.emails || params.guestList;
  if (!params.rrule) params.rrule = params.recurrence || params.repeat || params.recurrence_rule;

  // 3. Email & Communications
  if (!params.recipient) params.recipient = params.to || params.email || params.email_address || params.address || params.toAddress;
  if (!params.subject) params.subject = params.title || params.email_subject || params.emailSubject;
  if (!params.body) params.body = params.message || params.content || params.text || params.email_body || params.emailBody;

  // 4. Memory, Learn & Incubate (Dynamic Vaults)
  if (!params.learning) params.learning = params.preference || params.fact || params.memory || params.note || params.content || params.insight;
  if (!params.description) params.description = params.idea || params.task || params.note || params.content || params.summary;

  // 5. Folders & File Trees (with fallback folder name for context)
  if (!params.folder_name) {
    params.folder_name = params.folder || params.name || params.folderName;
    if (!params.folder_name && SETTINGS.CONTEXT_FOLDERS) {
      const keys = Object.keys(SETTINGS.CONTEXT_FOLDERS);
      if (keys.length > 0) params.folder_name = keys[0]; // Fall back to first configured folder
    }
  }

  // 6. Searches & Queries
  if (!params.query) params.query = params.search_query || params.name || params.contact_name || params.q || params.search || params.searchQuery;

  // 7. Tasks & Todos
  if (!params.notes) params.notes = params.note || params.description || params.body || params.details || params.task_notes || params.taskNotes;

  // ─────────────────────────────────────────────────────────────────────

  const missing = [];
  const requireParam = (field) => { if (!params[field] || !params[field].toString().trim()) missing.push(field); };

  switch(action) {
    case "LEARN":
      requireParam("learning");
      if (missing.length) return `⚠️ Parameter Error: Missing required param [${missing.join(", ")}] for action ${action}. Ask user to clarify or supply the param.`;
      return appendToLongTermMemory(params.learning, SETTINGS.VAULT_ID);

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
      return execIdempotent(`CALENDAR|${params.title}|${params.iso}`, () => execCalendarAction(params.title, params.iso, params.duration_mins, params.guests, params.rrule));

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
      if (SETTINGS._isDiagnostic) return "✅ Mapped";
      return execAreasCheckin(SETTINGS.VAULT_ID);

    case "STRATEGY_PRIMER":
      if (SETTINGS._isDiagnostic) return "✅ Mapped";
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

function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const res = UrlFetchApp.fetch(url, options);
    const code = res.getResponseCode();
    if (code === 429 || code >= 500) {
      if (i === maxRetries - 1) return res;
      Utilities.sleep(Math.pow(2, i) * 2000 + Math.random() * 1000);
      continue;
    }
    return res;
  }
}

// Standard free-text call (used for Weekly Review, Next Actions)
function callGemini(systemPrompt, contentsArray, apiKey, search = false) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.MODEL_VERSION}:generateContent?key=${apiKey}`;

  const payload = {
    "systemInstruction": { "parts": [{ "text": systemPrompt }] },
    "contents": contentsArray,
    "generationConfig": {
      "maxOutputTokens": 8192,
      "temperature": 0.4
    }
  };

  if (search) payload.tools = [{ "google_search": {} }];

  const options = { "method": "post", "contentType": "application/json", "payload": JSON.stringify(payload), "muteHttpExceptions": true };
  const res = fetchWithRetry(url, options);
  
  if (res.getResponseCode() !== 200) {
    // If the API throws 400 Invalid argument on a search payload, it's likely a Free Tier billing limitation. Retry without tools.
    if (search && res.getResponseCode() === 400) {
      delete payload.tools;
      options.payload = JSON.stringify(payload);
      const fallbackRes = fetchWithRetry(url, options);
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
      "responseSchema": responseSchema,
      "maxOutputTokens": 8192,
      "temperature": 0.1
    }
  };

  const options = { "method": "post", "contentType": "application/json", "payload": JSON.stringify(payload), "muteHttpExceptions": true };
  const res = fetchWithRetry(url, options);
  const json = JSON.parse(res.getContentText());
  if (res.getResponseCode() !== 200) throw new Error(json.error ? json.error.message : "Structured API Fail");

  try {
    return JSON.parse(json.candidates[0].content.parts[0].text);
  } catch(e) {
    throw new Error("Gemini returned malformed JSON: " + json.candidates[0].content.parts[0].text.substring(0, 200), { cause: e });
  }
}

// --- 6. DATA UTILITIES (Settings, Vault, Actuators) ---

var _cachedSettings = null; // Thread-level global memory cache

function loadSettings() {
  if (_cachedSettings) return _cachedSettings;
  
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

  _cachedSettings = settings;
  return settings;
}

function getContextFolders(vaultId) {
  if (!vaultId) return {};
  
  const cache = CacheService.getScriptCache();
  const cacheKey = 'ctx_folders_' + vaultId;
  const cached = cache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch(e) { /* ignore cache parse error */ }
  }

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
    
    try {
      cache.put(cacheKey, JSON.stringify(folders), CONFIG.VAULT_CACHE_TIME);
    } catch (e) {
      console.warn("Failed to write CONTEXT_FOLDERS to cache: " + e.message);
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

  const files = ["03_Dynamic_Memory"];
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
  try {
    const folder = DriveApp.getFolderById(vaultId);
    const files = folder.getFilesByName(fileName);
    if (!files.hasNext()) return `[Missing ${fileName}]`;
    
    const file = files.next();
    const mimeType = file.getMimeType();
    
    if (mimeType === MimeType.GOOGLE_DOCS) {
      return DocumentApp.openById(file.getId()).getBody().getText();
    } else if (mimeType === MimeType.GOOGLE_SHEETS) {
      const sheet = SpreadsheetApp.openById(file.getId()).getActiveSheet();
      const data = sheet.getDataRange().getValues();
      return data.map(row => row.join(", ")).join("\n");
    } else if (mimeType === MimeType.PDF || mimeType.includes("image")) {
      return `[${fileName} is a PDF/Image and cannot be read]`;
    } else {
      return file.getBlob().getDataAsString();
    }
  } catch (e) {
    return `[Error reading ${fileName}: ${e.message}]`;
  }
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

function findFileFuzzy(folder, fileName) {
  // 1. Primary: Exact match (most efficient, avoids iterating if exact name matches)
  const files = folder.getFilesByName(fileName);
  if (files.hasNext()) {
    return files.next();
  }

  // 2. Fallback: Case-insensitive and extension-insensitive search
  const queryClean = fileName.trim().toLowerCase();
  const queryCleanNoExt = queryClean.replace(/\.[a-z0-9]+$/i, "");

  const fileIterator = folder.getFiles();
  let fallbackMatch = null;

  while (fileIterator.hasNext()) {
    const f = fileIterator.next();
    const fName = f.getName().trim();
    const fNameLower = fName.toLowerCase();
    const fNameLowerNoExt = fNameLower.replace(/\.[a-z0-9]+$/i, "");

    // Exact case-insensitive match (e.g., requested "urgent_tasks.xlsx" for file "Urgent_Tasks.xlsx")
    if (fNameLower === queryClean) {
      return f;
    }

    // Match ignoring extensions (e.g., requested "Urgent_Tasks" for file "Urgent_Tasks.xlsx", 
    // or requested "Urgent_Tasks.xlsx" for file "Urgent_Tasks")
    if (fNameLowerNoExt === queryClean || fNameLower === queryCleanNoExt || fNameLowerNoExt === queryCleanNoExt) {
      fallbackMatch = f;
    }
  }

  return fallbackMatch;
}

function findFileGlobally(title, initialFolder, contextFolders) {
  // 1. Search in the initial folder (e.g. Vault or specified context folder)
  let file = findFileFuzzy(initialFolder, title);
  if (file) return file;

  // 2. Search in all other context folders if contextFolders is provided
  if (contextFolders) {
    for (const name in contextFolders) {
      const folderId = contextFolders[name];
      if (folderId && (!initialFolder || initialFolder.getId() !== folderId)) {
        try {
          const folder = DriveApp.getFolderById(folderId);
          file = findFileFuzzy(folder, title);
          if (file) {
            console.log(`Found "${title}" in context folder "${name}".`);
            return file;
          }
        } catch(e) {
          console.warn(`Could not search folder "${name}": ${e.message}`);
        }
      }
    }
  }

  // 3. Search in the Vault folder if not already searched
  try {
    const settings = loadSettings();
    const vaultId = settings.VAULT_ID;
    if (vaultId && (!initialFolder || initialFolder.getId() !== vaultId)) {
      const vaultFolder = DriveApp.getFolderById(vaultId);
      file = findFileFuzzy(vaultFolder, title);
      if (file) {
        console.log(`Found "${title}" in Vault folder.`);
        return file;
      }
    }
  } catch(e) {
    console.warn(`Could not search Vault fallback: ${e.message}`);
  }

  // 4. Ultimate fallback: Search entire Google Drive
  try {
    const files = DriveApp.getFilesByName(title);
    if (files.hasNext()) {
      return files.next();
    }
    
    // Title contains or exact with Drive search
    const cleanTitle = title.replace(/'/g, "\\'");
    const searchIterator = DriveApp.searchFiles(`title contains '${cleanTitle}' or title = '${cleanTitle}'`);
    const queryClean = title.trim().toLowerCase();
    const queryCleanNoExt = queryClean.replace(/\.[a-z0-9]+$/i, "");
    let fallbackMatch = null;
    let count = 0;
    while (searchIterator.hasNext() && count < 50) {
      count++;
      const f = searchIterator.next();
      const fName = f.getName().trim();
      const fNameLower = fName.toLowerCase();
      const fNameLowerNoExt = fNameLower.replace(/\.[a-z0-9]+$/i, "");
      if (fNameLower === queryClean) {
        return f;
      }
      if (fNameLowerNoExt === queryClean || fNameLower === queryCleanNoExt || fNameLowerNoExt === queryCleanNoExt) {
        fallbackMatch = f;
      }
    }
    return fallbackMatch;
  } catch(e) {
    console.warn(`Global Drive search failed: ${e.message}`);
  }

  return null;
}

function execReadDoc(title, vaultId) {
  try {
    const folder = DriveApp.getFolderById(vaultId);
    let contextFolders = null;
    try { contextFolders = loadSettings().CONTEXT_FOLDERS; } catch(e) {}
    const file = findFileGlobally(title, folder, contextFolders);
    if (!file) {
      return `Error: Document "${title}" not found.`;
    }
    
    const mimeType = file.getMimeType();
    
    if (mimeType === MimeType.GOOGLE_DOCS) {
      return DocumentApp.openById(file.getId()).getBody().getText();
    } else if (mimeType === MimeType.GOOGLE_SHEETS) {
      const sheet = SpreadsheetApp.openById(file.getId()).getActiveSheet();
      const data = sheet.getDataRange().getValues();
      return data.map(row => row.join(", ")).join("\n");
    } else if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || mimeType === "application/vnd.ms-excel") {
      // Excel File: Convert to a temporary Google Sheet to read, then clean up
      let tempSheetId = null;
      try {
        const fileMetadata = {
          name: "Temp_Convert_" + file.getName().replace(/\.xlsx$|\.xls$/i, ""),
          mimeType: MimeType.GOOGLE_SHEETS,
          parents: [vaultId]
        };
        const tempFile = Drive.Files.create(fileMetadata, file.getBlob(), { fields: "id" });
        tempSheetId = tempFile.id;
        
        const sheet = SpreadsheetApp.openById(tempSheetId).getActiveSheet();
        const data = sheet.getDataRange().getValues();
        return data.map(row => row.join(", ")).join("\n");
      } catch (excelErr) {
        return `Error converting/reading Excel file "${title}": ${excelErr.message}`;
      } finally {
        if (tempSheetId) {
          try {
            Drive.Files.remove(tempSheetId);
          } catch (cleanupErr) {
            console.error("Failed to remove temporary Sheet: " + cleanupErr.message);
          }
        }
      }
    } else if (mimeType === MimeType.PDF || mimeType.includes("image")) {
      return `Error: File "${title}" is a PDF or image. Radlee's READ_DOC action currently only supports Docs, Sheets, and plain text/CSV.`;
    } else {
      return file.getBlob().getDataAsString();
    }
  } catch (e) {
    return `Error reading document "${title}": ${e.message}`;
  }
}

function execListFolderFiles(folderName, contextFolders) {
  if (!contextFolders || !contextFolders[folderName]) {
    return `Error: Folder "${folderName}" is not configured in 07_Context_Folders.`;
  }
  try {
    const folderId = contextFolders[folderName];
    // DriveApp throws 'Invalid argument' if the ID is malformed (e.g. a placeholder like "[Paste Folder ID Here]")
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFiles();
    let fileList = [];
    while (files.hasNext()) {
      const file = files.next();
      fileList.push(`- ${file.getName()} (Type: ${file.getMimeType()})`);
    }
    if (fileList.length === 0) return `Folder "${folderName}" is empty.`;
    return `Files in ${folderName}:\n` + fileList.join("\n");
  } catch (e) {
    if (e.message.includes("Invalid argument") || e.message.includes("No item with the given ID could be found")) {
       return `Error: The folder ID provided for "${folderName}" in 07_Context_Folders is invalid or inaccessible. Please update the spreadsheet with a valid Google Drive Folder ID.`;
    }
    return `Error accessing folder "${folderName}": ${e.message}`;
  }
}

function execReadFile(folderName, fileName, contextFolders) {
  if (!contextFolders || !contextFolders[folderName]) {
    return `Error: Folder "${folderName}" is not configured in 07_Context_Folders.`;
  }
  try {
    const folderId = contextFolders[folderName];
    const folder = DriveApp.getFolderById(folderId);
    const file = findFileGlobally(fileName, folder, contextFolders);
    if (!file) {
      return `Error: File "${fileName}" not found in folder "${folderName}".`;
    }
    
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

function execCalendarAction(title, timeStr, durationMins, guests, rrule) {
  const durationMs = (durationMins || 30) * 60000;
  const startTime = new Date(timeStr);
  const endTime = new Date(startTime.getTime() + durationMs);

  if (rrule) {
    let event = {
      summary: `[CoS] ${title}`,
      start: { dateTime: startTime.toISOString() },
      end: { dateTime: endTime.toISOString() },
      recurrence: [`RRULE:${rrule}`]
    };
    if (guests) {
      event.attendees = guests.split(',').map(e => ({email: e.trim()}));
    }
    Calendar.Events.insert(event, 'primary', {sendUpdates: guests ? 'all' : 'none'});
    return `✅ **Scheduled (Recurring):** ${title} starting ${startTime.toLocaleString()}` + (guests ? ` with ${guests}` : ``);
  } else {
    let options = {};
    if (guests) {
      options.guests = guests;
      options.sendInvites = true;
    }
    CalendarApp.getDefaultCalendar().createEvent(`[CoS] ${title}`, startTime, endTime, options);
    return `✅ **Scheduled:** ${title} at ${startTime.toLocaleString()}` + (guests ? ` with ${guests}` : ``);
  }
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
                  "title":     { "type": "STRING", "description": "Title of the task or event." },
                  "iso":       { "type": "STRING", "description": "ISO 8601 formatted datetime string for the start of the event (e.g. 2026-05-21T15:00:00Z). REQUIRED for CALENDAR actions." },
                  "duration_mins": { "type": "INTEGER", "description": "Duration of the event in minutes. Defaults to 30 if omitted." },
                  "rrule":     { "type": "STRING", "description": "Optional RFC5545 RRULE string for recurring events (e.g. FREQ=DAILY;COUNT=5). Do NOT include 'RRULE:' prefix." },
                  "recipient": { "type": "STRING" },
                  "subject":   { "type": "STRING" },
                  "body":      { "type": "STRING" },
                  "notes":     { "type": "STRING" },
                  "doc_name":  { "type": "STRING", "description": "Name of the document to create or read." },
                  "content":   { "type": "STRING", "description": "The full text content to write into the document. If drafting a document, you must generate the full body text here." },
                  "learning":  { "type": "STRING" },
                  "preference":{ "type": "STRING" },
                  "description":{ "type": "STRING" },
                  "guests":    { "type": "STRING", "description": "Comma-separated list of email addresses for attendees." },
                  "folder_name": { "type": "STRING", "description": "Required for LIST_FOLDER_FILES and READ_FILE. The name of the folder." },
                  "file_name":   { "type": "STRING", "description": "Required for READ_FILE. The name of the file to read." }
                }
              }
            },
            "required": ["action", "params"]
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

    sendIsolatedEmail(myEmail, `Radlee Weekly GTD Alignment Briefing`, report, {
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

    sendIsolatedEmail(myEmail, "Radlee: Your Weekly Strategic Primer", report, {
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

    sendIsolatedEmail(myEmail, "Radlee Morning Brief — " + dayName, brief, {
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
  
  // Also flush context folders cache and in-memory global state
  const cache = CacheService.getScriptCache();
  cache.remove('ctx_folders_' + SETTINGS.VAULT_ID);
  _cachedSettings = null;
  
  console.log("✅ AI persona and context folder cache cleared. Live changes are now active.");
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

// 🎓 LESSON: Idempotency Locks (Duplicate Prevention)
// In distributed systems, "Idempotency" means that performing an operation multiple
// times yields the same result as performing it once. AI agents are prone to looping
// or accidentally outputting the same JSON action twice.
// By generating a unique "hash" of the action (e.g., "Schedule Lunch at 2pm"), we create
// a temporary lock in the cache. If the LLM glitches and asks to schedule that exact
// same lunch again 5 seconds later, this lock catches it and prevents a duplicate execution.
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
                           "03_Dynamic_Memory","05_Areas_of_Focus","06_Someday_Maybe"];
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
  
  // Automatically retrieve the current user's email if not explicitly set
  const currentEmail = Session.getEffectiveUser().getEmail();
  const ownerEmail = props.OWNER_EMAIL || currentEmail;
  
  let radleeEmail = props.RADLEE_EMAIL;
  if (!radleeEmail) {
    const parts = currentEmail.split('@');
    if (parts.length === 2 && !parts[0].includes('+')) {
      radleeEmail = `${parts[0]}+radlee@${parts[1]}`;
    } else {
      radleeEmail = currentEmail; // Fallback
    }
  }

  if (!apiKey) {
    console.error("❌ Setup Failed: Please add GEMINI_API_KEY in Project Settings -> Script Properties");
    return;
  }
  
  if (!props.OWNER_EMAIL) propsService.setProperty("OWNER_EMAIL", ownerEmail);
  if (!props.RADLEE_EMAIL) propsService.setProperty("RADLEE_EMAIL", radleeEmail);
  if (!props.USER_NAME) propsService.setProperty("USER_NAME", userName);
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
    
    propsService.setProperty("VAULT_FOLDER_ID", vaultFolder.getId());
    propsService.setProperty("APPROVED_FOLDER_ID", approvedFolder.getId());
    propsService.setProperty("ASSISTANT_NAME", "Radlee");
    
    setupTriggers();
    
    console.log("✅ Radlee Initialized Successfully!\n\n" +
             "1. Vault Folder: " + vaultFolder.getName() + " (ID: " + vaultFolder.getId() + ")\n" +
             "2. Approved Outbox: " + approvedFolder.getName() + " (ID: " + approvedFolder.getId() + ")\n\n" +
             "All properties saved securely. Radlee is now ready to receive emails at " + radleeEmail + "!");
  } catch (e) {
    console.error("❌ Error during initialization: " + e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════
// --- 9. NATIVE DIAGNOSTICS ---

function runSelfDiagnostics() {
  console.log("🚀 Starting Radlee Self-Diagnostics...");
  let passed = true;

  // 1. Property Validation
  console.log("⏳ 1. Checking Script Properties...");
  const props = PropertiesService.getScriptProperties().getProperties();
  if (!props.GEMINI_API_KEY) { console.error("❌ Missing GEMINI_API_KEY"); passed = false; }
  if (!props.OWNER_EMAIL) { console.error("❌ Missing OWNER_EMAIL"); passed = false; }
  if (!props.RADLEE_EMAIL) { console.error("❌ Missing RADLEE_EMAIL"); passed = false; }
  if (passed) console.log("✅ Properties configured.");

  // 2. Gemini API & JSON Truncation Test
  console.log("⏳ 2. Testing Gemini API & JSON Structured Output...");
  try {
    const testSchema = {
      "type": "OBJECT",
      "properties": { "status": { "type": "STRING" } }
    };
    const res = callGeminiStructured("Return {'status': 'OK'} as JSON", [{ parts: [{ text: "ping" }] }], props.GEMINI_API_KEY, testSchema);
    if (res.status === "OK") {
      console.log("✅ Gemini API is healthy and returning correctly formatted JSON.");
    } else {
      console.error("❌ Gemini API returned unexpected JSON: " + JSON.stringify(res));
      passed = false;
    }
  } catch (e) {
    console.error("❌ Gemini API Test Failed: " + e.message);
    passed = false;
  }

  // 3. Calendar Service Check
  console.log("⏳ 3. Testing Google Calendar Advanced Service...");
  try {
    const event = Calendar.Events.insert({
      summary: "Radlee Diagnostic Test",
      start: { dateTime: new Date().toISOString() },
      end: { dateTime: new Date(Date.now() + 1000 * 60 * 15).toISOString() }
    }, "primary");
    Calendar.Events.remove("primary", event.id);
    console.log("✅ Google Calendar Service is enabled and functioning.");
  } catch (e) {
    console.error("❌ Google Calendar Service Test Failed: " + e.message + " (Make sure Calendar API v3 is added in Advanced Services)");
    passed = false;
  }
  
  // 4. Action Mapping Test
  console.log("⏳ 4. Verifying Action Registry mapping...");
  try {
    const SETTINGS = Object.assign({}, props, { _isDiagnostic: true }); // mock settings
    const missingActions = [];
    Object.keys(ACTION_REGISTRY).forEach(actionName => {
      if (actionName === "NONE") return; // NONE is a special no-op action handled by the engine directly
      // Pass empty params; we expect a parameter error or success, NOT "Unknown"
      const res = handleStructuredRouting(actionName, {}, SETTINGS);
      if (res && typeof res === 'string' && res.includes("Unknown structured action")) {
         missingActions.push(actionName);
      }
    });
    if (missingActions.length > 0) {
      console.error("❌ The following actions are in ACTION_REGISTRY but missing from handleStructuredRouting: " + missingActions.join(", "));
      passed = false;
    } else {
      console.log("✅ All registered actions are mapped to the router.");
    }
  } catch (e) {
    console.error("❌ Action Mapping Test Failed: " + e.message);
    passed = false;
  }

  if (passed) {
    console.log("🎉 SUCCESS! All systems go. You can now safely send your Test Flight email!");
  } else {
    console.error("⚠️ DIAGNOSTICS FAILED. Please fix the errors above before continuing.");
  }
}
