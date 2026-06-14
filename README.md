# Radlee (v0.1.0-beta) — The Open-Source Chief of Staff AI Enablement Project

**An autonomous, email-based Chief of Staff powered by Google Gemini. Radlee lives in your Gmail inbox and helps you execute tasks using the Getting Things Done (GTD) methodology.**

Radlee is both an active AI Agent that helps manage your daily tasks and a **choose-your-own-adventure style educational curriculum** designed to give you hands-on experience building Agentic AI. 

Under the hood, Radlee follows David Allen's [**Getting Things Done®** (GTD)](https://gettingthingsdone.com/) system. It aligns your daily execution with your "Horizons of Focus" (your long-term purpose, vision, and goals) and conducts proactive Weekly Reviews.

You can set Radlee up in about 20 minutes to get a fully functional, zero-cost, email-based AI assistant. No new apps to download, and no dashboards to learn. Just email it, and things get done.

---

## Your Onboarding Roadmap

```
┌──────────────────────────┐     ┌──────────────────────────┐     ┌──────────────────────────┐
│    1. CORE ONBOARDING    │ ──> │    2. CONFIGURE VAULT    │ ──> │    3. FIRST TEST RUN     │
│  Install Apps Script &   │     │  Provide Context docs in │     │   Send a multi-action    │
│   Gemini Key (~5 min)    │     │   your Google Drive (10m)│     │     email (~5 min)       │
└──────────────────────────┘     └──────────────────────────┘     └──────────────────────────┘
```

---

## Core Features & Benefits

- **Secure Email Interface:** Radlee only responds to your approved email address and completely ignores unauthorized senders.
- **Workspace Actions:** Radlee schedules Google Calendar events, creates Google Tasks, drafts Gmail replies, and creates Google Docs natively.
- **Goal Alignment:** Radlee parses your custom context "Radlee Vault" documents to align every action with your high-level priorities and values.
- **Automated Briefings:** Receive morning operational digests (daily), strategic primers (Mondays), and structured GTD Weekly Reviews (Sundays) from Radlee automatically.
- **Voice Commands:** Send an audio file attachment (voice note). Radlee transcribes your speech, understands your request, and runs the appropriate workspace action.
- **Highly Accessible:** Operates purely via email text and audio attachments. It integrates natively with your existing assistive technologies (like screen readers or voice dictation) without any new layouts or dashboards to navigate.
- **Global Language Support:** Powered by Gemini, Radlee understands and communicates in dozens of languages (Spanish, Japanese, French, Portuguese, etc.).

---

## 🎓 Core Concepts You Will Learn

You will build and understand the folllowing real-world Agentic AI techniques:

- **Prompt Engineering:** The Vault uses an interactive "Mad Libs" format to help you notice how specific word choices affect an AI's behavior. By filling templates, you'll learn how to inject rules, constraints, and custom styles into an LLM.
- **The ReAct Framework:** Learn how Radlee decides what context it needs, reads it, and reasons before acting to minimize hallucinations and control costs associated with open-ended AI loops.
- **Rule-Based Guardrails:** Discover how to blend AI autonomy with safety. If Radlee's confidence score drops below 85% on high-stakes actions, a guardrail automatically downgrades it to a draft for human approval.
- **Long-Term Memory & RAG:** When you tell Radlee a preference, it programmatically writes it to a Google Doc and reads it on future runs, building a continuous learning loop.
  
---

# 👤 User Guide & Setup

*No coding experience required. Follow these steps to onboard your Chief of Staff.*

## Phase 1: Core Installation (~5 Minutes)

### Step 1: Choose Your Email Alias
You will talk to Radlee using a Gmail **Email Alias** to keep your inbox clean. If your email is `jane@gmail.com`, you will communicate with Radlee by emailing **`jane+radlee@gmail.com`**. Radlee will auto-detect and register this during setup.

### Step 2: Create a Google Apps Script Project
1. Go to [script.google.com](https://script.google.com) and click **New Project**.
2. Delete any default code in the editor.
3. Copy the full text from the [**`Code.gs`**](radlee-apps-script/Code.gs) file in this repository and paste it into your editor.
4. Click the ⚙️ **Project Settings** (gear icon) on the left sidebar.
5. Check the box **"Show 'appsscript.json' manifest file in editor"**.
6. Return to the Editor (`< >` icon), click on `appsscript.json` in the file list, and replace its contents with the text from [**`appsscript.json`**](radlee-apps-script/appsscript.json) in this repository.
7. Click the **Save** (floppy disk) icon.

### Step 3: Initialize the Engine
1. Click the ⚙️ **Project Settings** (gear icon) on the left sidebar.
2. Scroll down to **Script Properties** and click **Add script property**. Add:
   - **Property (Key):** `GEMINI_API_KEY`
   - **Value:** Your personal Gemini API key.
   > [!TIP]
   > **Get a free API key instantly** at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
3. Click **Save script properties**.
4. Go back to the Editor (`< >` icon). Select `initializeAgent` from the top-center function dropdown and click **Run**.
5. Approve the Google authorization permissions.
   > [!TIP]
   > **⚠️ Google's "Unsafe App" Warning (Expected & Normal)**
   > <details>
   > <summary><b>Click here to see why this appears and how to proceed...</b></summary>
   > 
   > Since you are running this custom script on your own personal Google Account, Google hasn't verified it publicly. It is 100% safe because you are the only person who controls and has access to the code.
   >
   > **How to bypass:** Click **"Advanced"** ➔ **"Go to [Project Name] (unsafe)"** ➔ **Allow**.
   > </details>
6. Confirm the Execution Log at the bottom completes with: `✅ Radlee Initialized Successfully!`.

### Step 4: Verify Your Folders
Radlee will automatically create your vault directories. Open your Google Drive and verify:
- [ ] A folder named **`Radlee Vault`** exists, containing exactly 7 config documents:
  `00_System_Prompt`, `01_Strategic_Context`, `02_Operating_Principles`, `03_Dynamic_Memory`, `05_Areas_of_Focus`, `06_Someday_Maybe`, `07_Context_Folders`.
- [ ] A folder named **`Radlee Approved Outbox`** exists.

---

> [!NOTE]
> **⚡ Gemini Free Tier Energy Meter**
> <details>
> <summary><b>How to manage your daily API limits...</b></summary>
> 
> The free Gemini API tier has strict requests-per-minute and daily limits. Think of this as Radlee's energy meter.
> 
> To maximize your daily workflow, try **batching your instructions** into a single email (e.g. *"Review my goals, add a task to check Q3 budgets, and draft an outline for Project Alpha"*). You can also set up billing in Google AI Studio to increase capacity.
> </details>

---

## Phase 2: Choose Your Own Adventure (CYOA)

### Level 1: The Prompt Engineer (No-Code)
*Customize Radlee's brain and turn on automatic schedules. (~15 minutes)*

#### 1. Fill in Your Vault "Mad Libs"
Open the **`Radlee Vault`** folder in Google Drive. By filling out the blanks in these template documents, you are performing **Context Injection** and **System Prompting** to program Radlee's personality and goals in plain English:

| Document | Purpose & Action |
|---|---|
| `00_System_Prompt` | Define Radlee's personality, vocabulary, and communication tone. |
| `01_Strategic_Context` | Set your GTD Horizons of Focus (your life purpose, vision, and active goals). |
| `02_Operating_Principles` | Set rules regarding your work hours, energy levels, and preferred communication. |
| `05_Areas_of_Focus` | Document active operational areas (e.g., career, health, family, finances). |
| `07_Context_Folders` | Map the folder names and IDs of Google Drive directories you want Radlee to read. |

*Note: `03_Dynamic_Memory` and `06_Someday_Maybe` should be left blank; Radlee writes to them programmatically!*

#### 2. Turn On Automatic Emails
In your Google Apps Script editor, select **`setupTriggers`** from the top function dropdown and click **Run**. This schedules Radlee to check emails every 60 seconds and activates your automatic briefings:
- **Morning Brief** (Mon-Fri, 7am): Your top 3 next actions aligned with your schedule and open tasks.
- **Strategy Primer** (Mondays, 7am): Connects recent memory and learnings to your life goals.
- **Weekly Review** (Sundays, 6pm): A structured guided review of your week and planning for the next.

#### 3. Run Self-Diagnostics
Select **`runSelfDiagnostics`** from the function dropdown in Apps Script and click **Run**. Check the Execution Log at the bottom. If it displays `🎉 SUCCESS! All systems go`, you are ready!

#### 4. The First Flight & Memory Test
1. Open Gmail and send a new email to your alias (e.g. `jane+radlee@gmail.com`) with a subject line (e.g. "Radlee Test").
2. **Short-Term Memory Test:** Ask: *"I'm thinking of the secret code 'Alpha Tango 42'."* Wait for its response, then reply to the same thread: *"What was my secret code?"* Radlee will remember it!
3. **Long-Term Memory Test:** Send a new email: *"Learn this preference: I never take meetings before 11:00 AM."* Check `03_Dynamic_Memory` in Google Drive to see it written! Now, ask Radlee to schedule a meeting at 9:00 AM—it will read the Vault and push back.

<details>
<summary>📨 <b>Optional: Keep Your Inbox Clean Instantly (Gmail Filter Setup)</b></summary>

When you email your own alias, Gmail delivers it to your Inbox immediately. If you want to automatically archive these outbound emails so they don't clutter your inbox:
1. Go to Gmail **Settings > Filters and Blocked Addresses > Create a new filter**.
2. In the **To** field, type your exact Radlee email (e.g., `jane+radlee@gmail.com`).
3. Click **Create filter**, check **Skip the Inbox (Archive it)**, and click **Create filter** again.
</details>

> **Want to learn how to manage Radlee effectively?** Read the [Operations Manual](docs/adventures/00-managing-radlee.md) to learn how to edit memories, grant folder access, or purge saved data.

---

### Level 2: The Co-Pilot (No-Code)
*Interact with Radlee like a teammate. Radlee is equpped with the latest LLM capabilties and understanding*

#### Interactive Actions

| What you write | What Radlee does |
|---|---|
| *"Schedule lunch with Sarah on Tuesday at 1pm."* | Creates a Google Calendar event |
| *"Add task: buy groceries tomorrow."* | Adds a task directly to Google Tasks |
| *"Draft an email to Mark about the final Q3 proposal."* | Populates a Gmail draft in your Outbox |
| *"What are my active professional goals?"* | Reads `01_Strategic_Context` and responds |
| *"Save to vault: notes from today's meeting..."* | Programmatically writes to your Dynamic Memory |
| *"Help me brainstorm 5 title ideas for a sci-fi novel."* | Leverages Gemini's raw creative writing capabilities |

<details>
<summary>🔍 <b>See Expanded List of Commands & Capabilities</b></summary>

#### Vault Memory & Alignment
- *"Which areas of my life need attention right now?"* ➔ Reviews your `05_Areas_of_Focus` file.
- *"Add to someday/maybe: explore building a home gym."* ➔ Appends to your `06_Someday_Maybe` file.
- *"What preferences have you learned about me?"* ➔ Retrieves current learnings from `03_Dynamic_Memory`.

#### Open-Ended Gemini Reasoning
- *"Write a Python script to scrape a weather API."* ➔ Uses Gemini's technical coding knowledge.
- *"Explain quantum physics like I'm five years old."* ➔ Leverages pedagogical synthesis.
- *"Rewrite this paragraph to sound more professional..."* ➔ Performs copy-editing and refinement.
</details>

---

### Level 3: The Tinkerer (Low-Code)
*Look under the hood and extend Radlee's core code.*

- **Read the Codebase Lessons** — Open `Code.gs` and search for `🎓 LESSON`. The script is heavily documented with inline tutorials explaining the action registry, guardrails, and lock systems.
- **[Add a New Action](docs/adventures/01-add-new-action.md)** — Give Radlee new native workspace skills, like reading your Calendar or logging to Google Sheets.

### Level 4: The Engineer (Pro-Code)
*Integrate production-grade developer patterns.*

- **[Build a Vector Database](docs/adventures/02-vector-database.md)** — Replace full-file scans with semantic similarity search to scale Radlee's long-term memory.
- **[Trigger External Webhooks Safely](docs/adventures/03-external-api-webhooks.md)** — Construct a deterministic webhook architecture to trigger actions in tools like Zapier, Make, or Vercel.

---

## Repository Structure

```
radlee-apps-script/
├── Code.gs           — Single-file Apps Script logic (all core AI/action code)
├── appsscript.json   — Project configuration and Google API authorization scopes
└── docs/             — CYOA tutorials and operation manuals
```

---

## Legal Disclaimer & Trademarks
Radlee is an independent, open-source educational project and is **not** affiliated with, endorsed by, or sponsored by any of the trademark holders mentioned:
- **Getting Things Done®** and **GTD®** are registered trademarks of the David Allen Company.
- **Choose Your Own Adventure®** is a registered trademark of Chooseco LLC.
- **Mad Libs®** is a registered trademark of Penguin Random House LLC.

*Any use of these terms is for descriptive and educational purposes only (nominative fair use).*
