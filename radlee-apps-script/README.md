# Radlee — The "Choose Your Own Adventure" AI Enablement Project

**An autonomous, email-based AI Chief of Staff that lives in your inbox and executes tasks using the Getting Things Done (GTD) methodology.**

Radlee is both an AI Chief of Staff that helps manage your daily tasks and a **"Choose Your Own Adventure" AI project** designed for anyone who wants to learn how AI works under the hood.

Underneath the hood, Radlee strictly follows the [**Getting Things Done**(GTD)](https://www.amazon.com/Getting-Things-Done-Stress-Free-Productivity/dp/0143126563) methodology. It is pre-programmed to align your daily execution with your "Horizons of Focus" (your long-term purpose, vision, and goals) and conduct proactive Weekly Reviews to keep your life organized.

You can set Radlee up in about 20 minutes to get a fully functional, zero-cost, email-based AI assistant. From there, your adventure begins:

- **Level 1 (No-Code Explorer):** You don't need to write a single line of code to make Radlee yours. By simply filling out the Mad Libs-style "Vault" documents in Google Drive, you can:
  - Redesign Radlee's personality, tone, and decision-making framework.
  - Define your GTD Horizons of Focus so Radlee knows what truly matters to you.
  - Set strict operating principles (e.g., "Don't let me schedule meetings before 10 AM").
  - Establish your Areas of Focus so Radlee can warn you if a key life domain is being neglected.
- **Level 2 (Low-Code Tinkerer):** Modify the underlying `Code.gs` script to add new scheduled emails, adjust the prompts, or give Radlee new native Google Workspace skills (like reading your Calendar or logging to Sheets).
- **Level 3 (Pro-Code Engineer):** Build advanced integrations like a Vector Database for infinite memory, or trigger external webhooks securely (like Zapier, Make.com, or Vercel).

Radlee lives entirely inside **your Email inbox**—where you already work. There are no new apps to open, and no dashboards to learn. Just email it, and things get done.

---

## ✨ Core Features & Benefits

- 🔒 **Secure, Email-Only Interface:** Radlee only talks to you. It securely checks every incoming email to ensure it came from your approved address. If anyone else tries to email it, Radlee ignores them.
- 💸 **Ultra Low-Cost:** Radlee is designed to be incredibly cheap to run. By carefully managing how it thinks and reads your documents, it keeps API costs well under $5 a day—often just pennies!
- 📅 **Takes Real Action:** Radlee doesn't just chat. It can schedule meetings on your Google Calendar, create Google Tasks, draft Gmail replies, and write Google Docs.
- 🎯 **Understands Your Goals (GTD Alignment):** Radlee reads your "Vault" documents to understand your professional goals and GTD Horizons, ensuring its advice actually helps you succeed.

- 🌅 **Proactive Briefings:** Radlee sends *you* emails. You'll get a morning operational brief, a curated event digest on Mondays, and a GTD weekly review on Sundays—all automatically.
- 🎙️ **Voice Command Support:** Too busy to type? Send Radlee an audio voice memo attachment. It will transcribe your voice, understand what you need, and get it done.

---

## 🎓 Core Concepts You Will Learn

Radlee isn't magic; it's a collection of robust engineering patterns. By using and modifying Radlee, you will learn how to build reliable AI systems:

- 🧠 **ReAct (Reason and Act) Pipeline:** Learn how to build a strict two-step pipeline. Radlee first determines what context it needs and reads it, and only then does it reason and act. You'll learn how this eliminates hallucinations and reduces the high costs associated with open-ended AI reasoning loops.
- 🚦 **Rule-Based Guardrails:** Discover how to blend AI autonomy with deterministic safety. Radlee scores its own confidence; if it drops below 85% on a high-stakes action (like sending an email), a hardcoded safety rule safely downgrades the action to a draft task for human review.
- 🔁 **RAG (Retrieval-Augmented Generation) & Long-Term Memory:** Learn how AI can "remember" things. When you correct Radlee, it programmatically writes your preference to a Google Doc, and retrieves that doc on the next run, creating a continuous learning loop.
- 📝 **Deterministic Webhooks & Native Integrations:** Learn how to securely map LLM outputs to native API calls (like drafting Gmails or converting Docs to PDFs) without letting the LLM hallucinate external URLs.
- 🛡️ **Idempotency (Duplicate-Proof Execution):** Ever worry an AI might glitch and send the same email 100 times? You will learn how to build "Idempotency locks" to guarantee an LLM can never double-book a meeting or create duplicate tasks, even if it loops.
- 🚦 **Concurrency (Safe Memory Writing):** Learn how to manage Race Conditions. If you email Radlee three thoughts at the exact same time, it uses a "LockService" to politely queue them up and write them to your memory documents one by one without scrambling data.

---

## What Radlee Does

Once set up, Radlee acts as an autonomous email assistant. Just email it like you'd email a person.

**Execution Examples:**
| Say... | Radlee does... |
|---|---|
| *"Schedule a lunch with Regina on Tuesday at 2pm"* | Creates a Google Calendar event |
| *"Add a task: follow up with contacts from the Sony event"* | Adds to Google Tasks |
| *"Draft an email to Sarah about the new book club announcement"* | Creates a Gmail draft |
| *"What should I be focused on right now?"* | Sends 3 aligned next actions |
| *"Review my strategic focus"* | Analyzes your Vault and sends an alignment brief |

**Vault & Alignment Examples:**
| Say... | Radlee does... |
|---|---|
| *"What is my professional focus right now?"* | Reads your strategic objectives doc |
| *"Which areas of my responsibilities need attention?"*| Reviews your Areas of Focus |
| *"Add to someday/maybe: explore building an integration"*| Adds to your Someday/Maybe vault document |
| *"Save to vault: notes from today's partnership talk..."* | Updates your Dynamic Memory/Learnings |

---

# 👤 User Guide & Setup

*Everything you need to set up and use Radlee. No coding experience required.*

## ⚠️ The "Unsafe" Warning

When you authorize Radlee for the first time, Google shows a warning: **"Google hasn't verified this app."**

This is **expected and completely normal.** Because you are setting this up on your own personal account, Google hasn't reviewed it as a public app. It is perfectly safe because *you* are the only person who controls the code.

**How to get past it:** Click **"Advanced"** → **"Go to [Project Name] (unsafe)"**.

---

## 🛠️ Step-by-Step Setup (~20 Minutes)

### Step 1: Set Up Your Google Account
We recommend running Radlee in a dedicated Google Workspace account (or creating a fresh, free personal Gmail account) if you want to keep the AI's files, tasks, and calendar events separate from your personal life. This account's email address will be the "Radlee email address" you communicate with.

### Step 2: Create a Google Apps Script Project
1. Go to [script.google.com](https://script.google.com) and click **New Project**.
2. Delete any default code you see on the screen.
3. Copy the full text from the **`Code.gs`** file in this repository and paste it into the editor.
4. Click the ⚙️ **Project Settings** icon (gear icon) on the left sidebar.
5. Check the box that says **"Show 'appsscript.json' manifest file in editor"**.
6. Go back to the Editor (the `< >` icon), click `appsscript.json` in the file list, and replace its contents with the text from the **`appsscript.json`** file in this repository.
7. Click the **Save** icon (looks like a floppy disk).

### Step 3: Run the Setup Wizard
1. Click the ⚙️ **Project Settings** icon (gear icon) on the left sidebar.
2. Scroll down to **Script Properties** and click **Add script property**. Add the following property (case-sensitive):
   - `GEMINI_API_KEY`: Your Gemini API key.
   > [!TIP]
   > **Need an API key?** It's free and easy to get. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) and generate one.
3. Click **Save script properties**.
4. Go back to the Editor (the `< >` icon). Look for the dropdown menu at the top center. Select `initializeAgent` and click **Run**.
5. Click through the Google authorization prompts. *(This is where you will see the "unsafe" warning mentioned above.)*
6. At the bottom of the screen, you will see an "Execution Log". Wait until it says "✅ Radlee Initialized Successfully!".

Radlee will automatically create a **`Radlee Vault`** and a **`Radlee Approved Outbox`** folder in your Google Drive. It will also create 7 initial documents for you!

### Step 4: Prompt Engineering 101 (Fill In Your Vault)
Open the **`Radlee Vault`** folder in your Google Drive. You'll find 7 documents. These documents are injected directly into Radlee's "Context Window" every time you email it. 

By filling out these Mad Libs exercises, you are practicing **System Prompting** and **Context Injection**. You are literally programming the AI's brain using plain English.

| Document | What to write |
|---|---|
| `00_System_Prompt` | *(Mad Libs Exercise)* Fill in the blanks to define Radlee's personality and tone. |
| `01_Strategic_Context` | *(Mad Libs Exercise)* Fill in the blanks to define your GTD Horizons of Focus (Purpose, Vision, Goals). |
| `02_Operating_Principles` | *(Mad Libs Exercise)* Fill in the blanks to set rules for your energy, boundaries, and communication. |
| `03_Dynamic_Memory` | Leave blank—Radlee writes here automatically when it learns something. |

| `05_Areas_of_Focus` | *(Mad Libs Exercise)* Fill in the blanks to define the key domains of your life and work (GTD Horizon 2). |
| `06_Someday_Maybe` | Leave blank—Radlee adds items here when you say "save this for later." |
| `07_Context_Folders` | *(Configuration)* Add the names and IDs of other Google Drive folders you want Radlee to be able to read (e.g. project folders or team drives). |

> [!NOTE]
> **Note on Context Folders:** Radlee can list all files in external folders and read the text contents of Google Docs, Google Sheets, and plain text/CSV files. **It cannot currently extract text from PDFs or images.**

> [!TIP]
> **Tip:** Start with `01_Strategic_Context` and `05_Areas_of_Focus`. Those two documents are the most important for helping Radlee understand your goals.

### Step 5: Turn On Automatic Emails
Let's turn on Radlee's automated schedules:
- **In the Apps Script editor:** Select `setupTriggers` from the dropdown menu at the top and click **Run**.

This sets up Radlee's internal timer so it checks your inbox every minute. It also schedules three proactive emails:

| Email | When | What's in it |
|---|---|---|
| 🌅 Morning Brief | Mon–Fri, 7am | 3 next actions aligned to your schedule and open tasks. |
| 🧭 Strategy Primer | Every Monday, 7am | Connects your recent learnings (Dynamic Memory) to your Life Purpose and suggests a macro focus for the week. |
| 🌱 Weekly Review | Every Sunday, 6pm | A review of your week and GTD alignment suggestions for the week ahead. |

### Step 6: Start Emailing!
1. Open Gmail.
2. Compose a new email to the Radlee email address you configured during setup.
3. Ask it to do something, and Radlee will reply within a minute or two!

### Step 7: The "Test Flight" Checklist ✈️
As soon as Radlee is set up, try sending it these exact emails one by one to verify everything is working properly. Wait for Radlee to reply to each before sending the next.


- [ ] **Test the context router:** Email Radlee and say: *"What are my current professional goals?"* (Verify it successfully reads your `01_Strategic_Context` document and replies with your goals).
- [ ] **Test taking action:** Email Radlee and say: *"Add a task for me to review the Q3 budget tomorrow."* (Verify it replies confirming the task, and check that it appears in your Google Tasks).
- [ ] **Test strategy primer:** Email Radlee and say: *"Send me my strategic alignment primer."* (Verify it analyzes your Vault and sends a strategic brief).
- [ ] **Test document drafting:** Email Radlee and say: *"Draft a new document called 'Project Alpha' with a brief outline for a new mobile app."* (Verify it creates the document in your Vault).
- [ ] **Test external context folders:** Add a new Folder Name and Folder ID to the `07_Context_Folders` sheet in your Vault. Email Radlee and say: *"What are the contents of the [Folder Name] folder?"* or *"Summarize the file [File Name] in the [Folder Name] folder."* (Verify Radlee successfully accesses the external folder and reads the file).

---

# 💻 Developer Guide (Choose Your Own Adventure)

*For those who want to look at the code and extend what Radlee can do.*

Radlee is built to be broken, extended, and improved. Because it relies on raw API calls rather than a complex framework, you have complete control over how it works. 

We have prepared three specific "Adventures" designed to teach you how to level up the project using AI-assisted coding tools. You do not need to be a senior software engineer to complete these—the guides will teach you how to use AI to write the code for you!

Choose your path based on your Level:

- 🧩 **[Level 2 (Low-Code Tinkerer): Add a New Action](docs/adventures/01-add-new-action.md)** — Learn how to give Radlee a new native Google Workspace skill, like reading your Calendar or logging to Google Sheets.
- 🧠 **[Level 3 (Pro-Code Engineer): Build a Vector Database](docs/adventures/02-vector-database.md)** — Learn how to replace document reading with semantic similarity search for infinite memory.
- 🔄 **[Level 3 (Pro-Code Engineer): Trigger External Webhooks Safely](docs/adventures/03-external-api-webhooks.md)** — Learn how to build a highly secure, deterministic webhook architecture to trigger workflows in tools like Zapier, Make.com, or Vercel.

## Repository Structure

```
radlee-apps-script/
├── Code.gs           — All the logic for Radlee (single-file Apps Script)
├── appsscript.json   — Configuration file (tells Google what permissions are needed)
└── README.md
```
