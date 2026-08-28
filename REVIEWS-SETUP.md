# Review approvals setup

The review workflow requires the Node server in `server.js`. Opening the HTML files directly will not provide secure submissions or approvals.

1. Install Node.js 20 or newer, then run `npm install` and `npm start`.
2. Copy `.env.example` to `.env` and set a long random `SESSION_SECRET`.
3. Set `AGENCY_EMAIL` to the address that should receive notifications. Keep SMTP credentials in environment variables only.
4. Set `ADMIN_PASSWORD_HASH` to a bcrypt hash for the private admin password. With dependencies installed, generate one with:

   `node -e "require('bcryptjs').hash(process.argv[1], 12).then(console.log)" "your-password"`

5. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` and `SMTP_FROM`, then set `SITE_URL` to the live website URL.

Open `/admin.html` after starting the server. New reviews are stored as `Pending`, are never returned by the public API, and only appear publicly after an administrator selects **Approve**. Rejected reviews remain hidden. The local SQLite database is excluded from version control.
