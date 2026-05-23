# Radlee — The CYOA AI Enablement Project

**An autonomous, email-based AI Chief of Staff that lives in your inbox and executes tasks using the Getting Things Done (GTD) methodology.**

Radlee is both an AI Chief of Staff that helps manage your daily tasks and a **choose-your-own-adventure style AI project** designed for anyone who wants hands-on experience building Agentic AI.

Underneath the hood, Radlee follows the [**Getting Things Done**(GTD)](https://www.amazon.com/Getting-Things-Done-Stress-Free-Productivity/dp/0143126563) methodology created by personal productivity expert, David Allen. It is pre-programmed to align your daily execution with your "Horizons of Focus" (your long-term purpose, vision, and goals) and conduct proactive Weekly Reviews to keep your life organized.

You can set Radlee up in about 20 minutes to get a fully functional, zero-cost, email-based AI assistant. Radlee lives entirely inside **your Email inbox**—where you already work. There are no new apps to open, and no dashboards to learn. Just email it, and things get done.

From there, you can explore **The Radlee Curriculum** to learn how Agentic AI works under the hood. You'll progress from No-Code Prompt Engineering up to Pro-Code integrations 🤖

---

## ✨ Core Features & Benefits

- 🔒 **Secure, Email-Only Interface:** Radlee only talks to you. It securely checks every incoming email to ensure it came from your approved address. If anyone else tries to email it, Radlee ignores them.
- 💸 **Ultra Low-Cost:** Radlee is designed to be incredibly cheap to run. By carefully managing how it thinks and reads your documents, it keeps API costs well under $1 a day and typically within free quota limits.
- 📅 **Takes Real Action:** Radlee doesn't just chat. It can schedule meetings on your Google Calendar, create Google Tasks, draft Gmail replies, and write Google Docs.
- 🎯 **Understands Your Goals (GTD Alignment):** Radlee reads your "Vault" documents to understand your professional goals and GTD Horizons, ensuring its advice actually helps you succeed.

- 🌅 **Proactive Briefings:** Radlee sends *you* emails. You'll get a morning operational brief, a curated event digest on Mondays, and a GTD weekly review on Sundays—all automatically.
- 🎙️ **Voice Command Support:** Too busy to type? Send Radlee an audio voice memo attachment. It will transcribe your voice, understand what you need, and get it done.

---

## 🎓 Core Concepts You Will Learn

By using and modifying Radlee, you will learn how to build reliable AI systems:

- 🧠 **ReAct (Reason and Act) Pipeline:** Learn how to build a strict two-step pipeline. Radlee first determines what context it needs and reads it, and only then does it reason and act. You'll learn how this eliminates hallucinations and reduces the high costs associated with open-ended AI reasoning loops.
- 🚦 **Rule-Based Guardrails:** Discover how to blend AI autonomy with deterministic safety. Radlee scores its own confidence; if it drops below 85% on a high-stakes action (like sending an email), a hardcoded safety rule safely downgrades the action to a draft task for human review.
- 🔁 **RAG (Retrieval-Augmented Generation) & Long-Term Memory:** Learn how AI can "remember" things. When you correct Radlee, it programmatically writes your preference to a Google Doc, and retrieves that doc on the next run, creating a continuous learning loop.
- 🛡️ **Idempotency (Duplicate-Proof Execution):** Ever worry an AI might glitch and send the same email 100 times? You will learn how to build "Idempotency locks" to guarantee an LLM can never double-book a meeting or create duplicate tasks, even if it loops.
- 🚦 **Concurrency (Safe Memory Writing):** Learn how to manage Race Conditions. If you email Radlee three thoughts at the exact same time, it uses a "LockService" to politely queue them up and write them to your memory documents one by one without scrambling data.

---



# 👤 User Guide & Setup

*Everything you need to set up and use Radlee. No coding experience required.*

## ⚠️ The "Unsafe" Warning

When you authorize Radlee for the first time, Google shows a warning: **"Google hasn't verified this app."**

This is **expected and completely normal.** Because you are setting this up on your own personal account, Google hasn't reviewed it as a public app. It is perfectly safe because *you* are the only person who controls the code.

**How to get past it:** Click **"Advanced"** → **"Go to [Project Name] (unsafe)"**.

---

## 🛠️ Phase 1: Core Installation (~5 Minutes)

### Step 1: Prepare Your Google Account
Radlee should be installed on your **active Google account**. This ensures that when Radlee creates Calendar events or Google Tasks, they appear natively on calendar and task lists that are already in your workflow.

To keep Radlee's emails from cluttering your inbox, we use an **Email Alias**. If your email is `jane@gmail.com`, you will communicate with Radlee by emailing `jane+radlee@gmail.com`. Radlee will automatically detect and configure this alias during setup.

### Step 2: Create a Google Apps Script Project
1. Go to [script.google.com](https://script.google.com) and click **New Project**.
2. Delete any default code you see on the screen.
3. Copy the full text from the **`Code.gs`** file in this repository and paste it into the editor.
4. Click the ⚙️ **Project Settings** icon (gear icon) on the left sidebar.
5. Check the box that says **"Show 'appsscript.json' manifest file in editor"**.
6. Go back to the Editor (the `< >` icon), click `appsscript.json` in the file list, and replace its contents with the text from the **`appsscript.json`** file in this repository.
7. Click the **Save** icon (looks like a floppy disk).

### Step 3: Initialize the Engine
1. Click the ⚙️ **Project Settings** icon (gear icon) on the left sidebar.
2. Scroll down to **Script Properties** and click **Add script property**. Add the following property (case-sensitive):
   - `GEMINI_API_KEY`: Your Gemini API key.
   > [!TIP]
   > **Need an API key?** It's free and easy to get. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) and generate one.
3. Click **Save script properties**.
4. Go back to the Editor (the `< >` icon). Look for the dropdown menu at the top center. Select `initializeAgent` and click **Run**.
5. Click through the Google authorization prompts. *(This is where you will see the "unsafe" warning mentioned above.)*
6. At the bottom of the screen, you will see an "Execution Log". Wait until it says "✅ Radlee Initialized Successfully!".

Radlee will automatically create a **`Radlee Vault`** and a **`Radlee Approved Outbox`** folder in your Google Drive. It will also create 7 initial documents for you...

---

## 🗺️ Phase 2: Choose Your Own Adventure

Now that the core Radlee engine is installed, your adventure begins. You can stop at Level 1 to just use Radlee as a powerful productivity tool, or you can continue to level up your skills by extending its code.

### 🟢 Level 1: The Prompt Engineer (No-Code)
*(Estimated time: 15 minutes)*

To use Radlee, you first need to program its brain. You will do this without writing any code, using a technique called "Context Injection".

**Task 1: Configure the Vault**
Open the **`Radlee Vault`** folder in your Google Drive. You'll find 7 documents. These documents are injected directly into Radlee's "Context Window" every time you email it. 

By filling out these Mad Libs exercises, you are practicing **System Prompting** and **Context Injection**. You are literally programming the AI's brain using plain English.

| Document | What to write |
|---|---|
| `00_System_Prompt` | *(Mad Libs Exercise)* Fill in the blanks to define Radlee's personality and tone. |
| `01_Strategic_Context` | *(Mad Libs Exercise)* Fill in the blanks to define your GTD Horizons of Focus (Purpose, Vision, Goals). |
| `02_Operating_Principles` | *(Mad Libs Exercise)* Fill in the blanks to set rules for your energy, boundaries, and communication. |
| `03_Dynamic_Memory` | Leave blank—Radlee writes here automatically when it learns something. |

| `05_Areas_of_Focus` | *(Mad Libs Exercise)* Fill in the blanks to define the key domains of your life and work. |
| `06_Someday_Maybe` | Leave blank—Radlee adds items here when you say "save this for later." |
| `07_Context_Folders` | *(Configuration)* Add the names and IDs of other Google Drive folders you want Radlee to be able to read (e.g. project folders or team drives). |

> [!NOTE]
> **Note on Context Folders:** Radlee can list all files in external folders and read the text contents of Google Docs, Google Sheets, and plain text/CSV files. **It cannot currently extract text from PDFs or images.**

> [!TIP]
> **Tip:** Start with `01_Strategic_Context` and `05_Areas_of_Focus`. Those two documents are the most important for helping Radlee understand your goals.

**Task 2: Turn On Automatic Emails**
Let's turn on Radlee's automated schedules:
- **In the Apps Script editor:** Select `setupTriggers` from the dropdown menu at the top and click **Run**.

This sets up Radlee's internal timer so it checks your inbox every minute. It also schedules three proactive emails:

| Email | When | What's in it |
|---|---|---|
| 🌅 Morning Brief | Mon–Fri, 7am | 3 next actions aligned to your schedule and open tasks. |
| 🧭 Strategy Primer | Every Monday, 7am | Connects your recent learnings (Dynamic Memory) to your Life Purpose and suggests a macro focus for the week. |
| 🌱 Weekly Review | Every Sunday, 6pm | A review of your week and GTD alignment suggestions for the week ahead. |

**Task 3: Run Self-Diagnostics**
Before you start emailing Radlee, let's verify that the Google Apps Script environment is perfectly healthy.
1. **In the Apps Script editor:** Select `runSelfDiagnostics` from the dropdown menu at the top center and click **Run**.
2. Look at the Execution Log at the bottom of the screen. 
3. If it outputs `🎉 SUCCESS! All systems go`, you are guaranteed a smooth experience! If it throws any red `❌` errors, read the error message carefully to fix your API key or permissions before proceeding.

**Task 4: The Multi-Action Test Flight ✈️**
1. Open Gmail.
2. Compose a new email to your Radlee email alias (e.g., `jane+radlee@gmail.com`).
3. **Always include a subject line** (e.g., "Radlee Request" or "Tasks") so your mail client doesn't complain. Put your actual instructions in the body of the email.
4. When you send an email to Radlee, it will automatically bypass your inbox and be archived to keep your workspace clean.
5. Radlee will process your request and send its response back directly to your primary inbox within a minute or two!

As soon as Radlee is set up, try sending it a single email with multiple instructions to see its batch-processing power in action. 

Send Radlee an email that says exactly this:
*"What are my current professional goals? Also, add a task for me to review the Q3 budget tomorrow, send me my strategic alignment primer, and draft a new document called 'Project Alpha' with a brief outline for a new mobile app."*

Radlee will process all of these instructions simultaneously and reply with a summary of its actions!

---

### 🟡 Level 2: The Co-Pilot (No-Code)
*(Estimated time: 5 minutes)*

Now that Radlee is set up, you can start using it as an autonomous email assistant. Just email it like you'd email a person! 

Because Radlee is powered by **Google Gemini**, it possesses the full reasoning, brainstorming, analytical, and writing capabilities of a state-of-the-art Large Language Model. You can ask it to help you brainstorm ideas, plan events, write code...the choice is yours!

Radlee is also equipped with an **Action Registry** that allows it to execute specific tasks inside your Google Workspace and read files in its "Vault" to understand your personal context.

**Execution & Integration Examples:**
| Say... | Radlee does... |
|---|---|
| *"Schedule lunch with Reginald on Tuesday at 2pm"* | Creates a Google Calendar event |
| *"Add a task: follow up with contacts from the Sony event"* | Adds to Google Tasks |
| *"Draft an email to Sarah about the new book club announcement"* | Creates a Gmail draft |
| *"Review my strategic focus"* | Analyzes your Vault and sends an alignment brief |

**Vault Memory & Alignment Examples:**
| Say... | Radlee does... |
|---|---|
| *"What is my professional focus right now?"* | Reads your strategic objectives doc |
| *"Which areas of my responsibilities need attention?"*| Reviews your Areas of Focus |
| *"Add to someday/maybe: explore building an integration"*| Adds to your Someday/Maybe vault document |
| *"Save to vault: notes from today's partnership talk..."* | Updates your Dynamic Memory/Learnings |

**Open-Ended Gemini Capabilities:**
| Say... | Radlee does... |
|---|---|
| *"Write a Python script to scrape a website."* | Uses Gemini's coding knowledge to write the script |
| *"Help me brainstorm 10 titles for my new sci-fi novel."* | Uses Gemini's creative writing abilities |
| *"Recommend some Focus music Spotify playlists."* | Curates music recommendations tailored to your taste |
| *"Explain quantum computing to me like I'm 5."* | Synthesizes complex information simply |
| *"Rewrite this paragraph to sound more professional."* | Edits and refines your text |

---

### 🟠 Level 3: The Tinkerer (Low-Code)
*Adventures for those who want to look at the code and extend what Radlee can do.*

- 🔍 **Read the Codebase Lessons** — Open `Code.gs` and search for `🎓 LESSON`. The codebase is heavily commented with inline tutorials explaining how the Action Registry, Deterministic Routing, and Idempotency Locks actually work under the hood.
- 🧩 **[Add a New Action](docs/adventures/01-add-new-action.md)** — Learn how to give Radlee a new native Google Workspace skill, like reading your Calendar or logging to Google Sheets.

### 🔴 Level 4: The Engineer (Pro-Code)

- 🧠 **[Build a Vector Database](docs/adventures/02-vector-database.md)** — Learn how to replace document reading with semantic similarity search for infinite memory.
- 🔄 **[Trigger External Webhooks Safely](docs/adventures/03-external-api-webhooks.md)** — Learn how to build a highly secure, deterministic webhook architecture to trigger workflows in tools like Zapier, Make.com, or Vercel.

---

## Repository Structure

```
radlee-apps-script/
├── Code.gs           — All the logic for Radlee (single-file Apps Script)
├── appsscript.json   — Configuration file (tells Google what permissions are needed)
└── docs/             — CYOA adventure tutorials
```
