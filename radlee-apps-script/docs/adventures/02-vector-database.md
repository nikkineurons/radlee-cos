# Adventure 2: Build a Vector Database

Right now, Radlee reads full plain-text Google Docs when it needs context. If your Vault grows to thousands of pages, stuffing entire documents into the LLM prompt will become slow and expensive. 

**The Challenge:** Replace the simple document reading logic with a semantic Vector Search implementation, giving Radlee infinite, low-cost memory.

## Deep Dive: Why Vector Databases?

When Radlee reads a document today, it essentially copies the entire text and pastes it into the LLM prompt. LLMs charge by the "token" (word). If you have a 100-page document, you pay to read all 100 pages every single time you ask a question.

A **Vector Database** solves this using "Embeddings":
1. **Chunking:** We break the document into small paragraphs.
2. **Embedding:** We ask an AI to turn each paragraph into a massive array of numbers (a vector) that mathematically represents the *meaning* of that text.
3. **Searching:** When you ask a question, we turn your question into a vector too. The Vector Database mathematically calculates which paragraphs are closest in meaning to your question and returns only those few paragraphs!

Instead of reading 100 pages, Radlee only reads the 3 most relevant paragraphs, saving time and money while giving the LLM perfectly targeted context.

## AI-Assisted Implementation Guide

Building a vector database from scratch in Apps Script is an advanced topic, but an AI coding assistant can scaffold the entire integration for you. We will use Pinecone (a popular Vector DB) and the Gemini Embeddings API.

Open your preferred AI coding tool (like Claude Code, Cursor, GitHub Copilot, or ChatGPT) and feed it the following prompt.

### The Prompt

Copy and paste this into your AI assistant:

> I am working on an Apps Script project called Radlee. Currently, it uses a `READ_DOC` action to fetch the entire plain-text contents of Google Docs from a Vault folder to provide context to an LLM.
> 
> I want to upgrade this to use a Vector Database (Pinecone) for semantic similarity search. 
> 
> Please read `Code.gs`. Act as an expert pair-programming teacher. Do not just output the final code. Walk me through the implementation step-by-step, explaining the concepts as we go:
> 
> 1. **Data Ingestion:** Explain how we can write a function `updateEmbeddings()` to chunk document text and generate embeddings using the Gemini `text-embedding-004` model API. Give me the code for this step first and wait for me to say "Next".
> 2. **Vector Search:** Walk me through writing an `execVectorSearch(query)` function. Explain how to embed the user's query and send a similarity search request to Pinecone using `UrlFetchApp`. Wait for me to say "Next".
> 3. **Routing Integration:** Explain how to update `ACTION_REGISTRY` to change the `READ_DOC` action to `SEARCH_MEMORY` (with `type: "READ"` and taking a `query` parameter), and how to update `handleStructuredRouting` to use the new function. 
> 
> Throughout the process, ensure we fetch the Pinecone API key securely using `PropertiesService.getScriptProperties().getProperty('PINECONE_API_KEY')` and do not hardcode any secrets.

### Review & Integrate

As the AI teaches you and generates the code:

1. **Review the Pinecone API calls:** Ensure `muteHttpExceptions: true` is used in `UrlFetchApp` calls so you can debug API errors.
2. **Setup Pinecone:** You will need to create a free account at Pinecone.io, create an Index (set the dimensions to match Gemini's embedding model, which is 768 dimensions), and get an API key.
3. **Secure Your Keys:** Add `PINECONE_API_KEY` to the Apps Script **Project Settings -> Script Properties**. Never hardcode it in `Code.gs`.
