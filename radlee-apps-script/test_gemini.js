const https = require('https');
const API_KEY = process.env.GEMINI_API_KEY || "AIzaFakeKey"; 

// Let's test the responseSchema
const payload = {
  contents: [{ parts: [{ text: "reply ok" }] }],
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: {
      type: "OBJECT",
      properties: {
        actions: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              action: { type: "STRING" },
              params: {
                type: "OBJECT",
                properties: {
                  title: { type: "STRING" }
                }
              }
            },
            required: ["action", "params"]
          }
        }
      },
      required: ["actions"]
    }
  }
};

const req = https.request(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
  { method: 'POST', headers: { 'Content-Type': 'application/json' } },
  (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => console.log(res.statusCode, body));
  }
);
req.write(JSON.stringify(payload));
req.end();
