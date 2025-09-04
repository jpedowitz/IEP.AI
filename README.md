# IEP.AI Demo (Backend + Frontend)

Run a simple Express backend with a vanilla JS frontend.

## Quickstart

```bash
npm install
npm run start
# open http://localhost:3000
```

## Features
- Mock login (single user)
- Dashboard with mock stats and recent activity
- Create New IEP (student name, parent name, additional info)
  - After creation, you are navigated to Meeting Coordination
- Resources library with:
  - Upload (multipart), list (most recent first), search (string contains), rename title, delete
- Meeting Coordination:
  - Emails (comma-separated), meeting type, duration (default 45)
  - Backend returns a scheduled time (tomorrow 2pm) and "Add to Google Calendar" link
- Calendar view lists scheduled meetings (Google/Outlook/Apple integrations can be added later)

## Storage for Resources
Currently files are saved to `backend/uploads/` and metadata in `backend/data/resources.json`.

For production, store files in a cloud bucket (recommended: Amazon S3) and keep metadata in a database.
- **S3 bucket**: upload via pre-signed URLs from the backend; store `s3://bucket/key` and a public or signed `https` URL
- **Access control**: use least-privilege IAM policy limited to the bucket and prefixes
- **Metadata**: keep titles, uploadedAt, uploader, tags in your DB

## API Endpoints (brief)
- `POST /api/login` -> `{ token, user }`
- `GET /api/dashboard` -> stats + recentActivity
- `POST /api/ieps` -> create IEP
- `GET /api/resources?search=` -> list
- `POST /api/resources` (multipart: `file`, optional `title`) -> upload
- `PATCH /api/resources/:id` -> rename title
- `DELETE /api/resources/:id` -> delete
- `GET /api/meetings` -> list meetings
- `POST /api/meetings` -> schedule meeting and return Google add link

## Notes
- This is a simple SPA served statically by Express. No real authentication.
- Data is persisted to JSON files under `backend/data/` for convenience.
- Replace the mock meeting scheduler with your availability email workflow when ready. 