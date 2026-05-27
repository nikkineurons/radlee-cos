# Adventure 0: Managing Radlee (The Operations Manual)

Welcome to the Chief of Staff operations manual! Since Radlee runs entirely inside your Google Drive, you have full transparency and control over its "brain". There are no hidden databases—everything is just a Google Doc or Sheet.

Here is how you can effectively manage Radlee day-to-day.

## 🧠 Managing Memories (`03_Dynamic_Memory`)

When you email Radlee and say *"remember this for later"* or *"learn this preference"*, it executes a `LEARN` action and writes that thought down in the `03_Dynamic_Memory` document inside your Radlee Vault. 

Because this memory is literally just a Google Doc, managing it is incredibly simple and fun:
- **To delete a memory:** Open the document and delete the line! Radlee won't know it ever existed.
- **To edit a memory:** If Radlee slightly misunderstood your preference, just fix the wording yourself.
- **To add a memory manually:** You can type directly into the document yourself. Radlee reads this document fresh every time it processes an email, so it will instantly adopt whatever rules you type in!

## 📁 Granting Folder Access (`07_Context_Folders`)

You can teach Radlee to read files (Google Docs, Google Sheets, and plain text/CSV files) from other project folders in your Google Drive by adding them to the `07_Context_Folders` spreadsheet.

### How to find a Google Drive Folder ID:
1. Open the folder you want Radlee to access in Google Drive.
2. Look at the URL in your browser's address bar. It will look something like this:
   `https://drive.google.com/drive/folders/1A2b3C4d5E6f7G8h9I0jK?usp=sharing`
3. The **Folder ID** is the long string of letters and numbers between `/folders/` and `?`. In this example, it is `1A2b3C4d5E6f7G8h9I0jK`.
4. Open the `07_Context_Folders` Google Sheet in your Vault.
5. In Column A, type a memorable, single-word name (e.g., `Marketing_Q3`).
6. In Column B, paste the Folder ID.

Now, you can email Radlee and say: *"Read the Q3 Roadmap in the Marketing_Q3 folder and summarize it for me."*

## 💡 Incubating Ideas (`06_Someday_Maybe`)

The `06_Someday_Maybe` document is your dumping ground for half-baked ideas. When you email Radlee a random thought while waiting in line for coffee and say *"incubate this"*, it will append it here. 

Review this document during your **Weekly Review** (which Radlee automatically emails you every Sunday at 6pm) to see if any of those ideas are ready to become active projects!
