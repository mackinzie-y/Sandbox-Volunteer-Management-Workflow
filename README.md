# RiseUp PH

AI-powered volunteer management MVP for NGO operations. The prototype covers onboarding, role matching, event recommendations, reminder generation, and an FAQ chatbot.

## Folder Structure

```text
.
|-- admin.html
|-- database.json
|-- index.html
|-- script.js
|-- server.js
|-- styles.css
|-- test-server.js
|-- .env.example
|-- package.json
```

## Key Files

- `server.js`: Express API, sample event seeding, optional Firestore integration, OpenAI calls, local JSON fallback.
- `index.html`: App shell that loads the React frontend.
- `script.js`: React MVP UI for onboarding, recommendations, reminders, and chatbot.
- `admin.html`: Lightweight admin dashboard for profiles, events, and sign-ups.
- `database.json`: Local fallback datastore used when Firebase credentials are not configured.

## Firebase Schema

### `volunteers`

```json
{
  "id": "vol_123",
  "name": "Maria Cruz",
  "availability": "weekends",
  "interests": ["environment", "education"],
  "skills": ["organizing", "public speaking"],
  "motivation": "I want to help communities while improving my leadership skills.",
  "aiRecommendation": {
    "bestRole": "Community Organizer",
    "explanation": "..."
  },
  "createdAt": "2026-04-02T10:00:00.000Z"
}
```

### `events`

```json
{
  "id": "beach-cleanup",
  "name": "Beach Cleanup",
  "description": "Help remove waste from the shoreline and sort collected materials.",
  "date": "2026-04-12",
  "tags": ["environment"]
}
```

### `signups`

```json
{
  "id": "signup_123",
  "userId": "vol_123",
  "eventId": "beach-cleanup",
  "eventName": "Beach Cleanup",
  "createdAt": "2026-04-02T10:15:00.000Z"
}
```

### `chatLogs`

```json
{
  "id": "chat_123",
  "volunteerId": "vol_123",
  "userMessage": "What events are available?",
  "assistantMessage": "Current events: ...",
  "createdAt": "2026-04-02T10:20:00.000Z"
}
```

## OpenAI Integration

The backend uses server-side OpenAI requests for:

- onboarding role matching
- top-3 event recommendations
- simulated volunteer reminders
- chatbot answers

If `OPENAI_API_KEY` is missing, the app falls back to deterministic local logic so the prototype still works.

## Run Locally

1. Install Node.js 18+.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set:
   - `ADMIN_PASSWORD`
   - `OPENAI_API_KEY`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`
4. Run `npm run dev`.
5. Open `http://localhost:3001`.
6. Open `http://localhost:3001/admin` for the admin overview.

## Notes

- Firestore is used when Firebase Admin credentials are available and `firebase-admin` is installed.
- Without Firebase credentials, the app stores data in `database.json` so the demo remains functional.
- The frontend uses React via CDN to keep the MVP setup simple and avoid a bundler.
- The admin dashboard at `/admin` is protected by a password cookie flow backed by `ADMIN_PASSWORD`.
