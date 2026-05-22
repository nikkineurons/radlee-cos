# 0001. Email-Only Interface

## Status
Accepted

## Context
Radlee was originally designed with a Google Chat bot interface for user interaction. This presented potential security and privacy risks if the chat application was accessed or misconfigured, and it added unnecessary complexity to the system. The goal was to restrict communication to a highly secure and controlled medium while maintaining functionality.

## Decision
We decided to remove the Google Chat integration and migrate Radlee entirely to an Email-Only interface.
- All requests to Radlee must be sent via email.
- The system now strictly verifies that emails are sent *from* the authenticated owner's email address and *to* the Radlee email address.
- A `radlee-processed` Gmail label is applied to successfully processed threads (or quarantined threads that encounter an error) to ensure that emails are not redundantly processed by the 1-minute poller.

## Consequences
- **Security Improved:** The attack surface is reduced. Only the explicit owner can communicate with the system.
- **Simplicity:** The deployment process no longer requires configuring a Google Chat App.
- **Asynchronous Workflow:** Users must adapt to a slightly more asynchronous interaction pattern (polling takes up to 1 minute), which is an acceptable tradeoff for the security gains.
