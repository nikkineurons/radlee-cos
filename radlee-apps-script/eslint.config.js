const js = require("@eslint/js");
module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      globals: { Logger: 'readonly', CalendarApp: 'readonly', DocumentApp: 'readonly', DriveApp: 'readonly', GmailApp: 'readonly', PropertiesService: 'readonly', SpreadsheetApp: 'readonly', CacheService: 'readonly', UrlFetchApp: 'readonly', Utilities: 'readonly', MimeType: 'readonly', console: 'readonly', Session: 'readonly', fetch: 'readonly' }
    },
    rules: { 'no-undef': 'warn', 'no-unused-vars': 'warn' }
  }
];
