require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const nodemailer = require('nodemailer');

const app = express();
const database = new Database(process.env.DATABASE_PATH || path.join(__dirname, 'reviews.db'));
database.pragma('journal_mode = WAL');
database.exec(`CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5), text TEXT NOT NULL,
  submitted_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Pending'
)`);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '20kb' }));
if(process.env.NODE_ENV === 'production' && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) throw new Error('SESSION_SECRET must be set to at least 32 characters in production.');
app.use(cookieSession({ name:'admin_session', keys:[process.env.SESSION_SECRET || 'development-only-session-secret'], httpOnly:true, sameSite:'lax', secure:process.env.NODE_ENV === 'production', maxAge:8 * 60 * 60 * 1000 }));
const submitLimit = rateLimit({ windowMs:15 * 60 * 1000, limit:5, standardHeaders:true, legacyHeaders:false });
const clean = value => String(value || '').trim();
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

app.get('/api/reviews', (req, res) => res.json(database.prepare("SELECT id, name, rating, text, submitted_at AS submittedAt FROM reviews WHERE status = 'Approved' ORDER BY submitted_at DESC").all()));
app.post('/api/reviews', submitLimit, async (req, res) => {
  const name = clean(req.body.name), email = clean(req.body.email).toLowerCase(), text = clean(req.body.text), rating = Number(req.body.rating);
  if(req.body.website || name.length < 2 || name.length > 100 || !validEmail(email) || email.length > 254 || !Number.isInteger(rating) || rating < 1 || rating > 5 || text.length < 10 || text.length > 2000) return res.status(400).json({ error:'Please complete all fields with valid information.' });
  const submittedAt = new Date().toISOString();
  const result = database.prepare('INSERT INTO reviews (name, email, rating, text, submitted_at) VALUES (?, ?, ?, ?, ?)').run(name, email, rating, text, submittedAt);
  try{
    if(process.env.SMTP_HOST && process.env.AGENCY_EMAIL){
      const transporter = nodemailer.createTransport({ host:process.env.SMTP_HOST, port:Number(process.env.SMTP_PORT || 587), secure:process.env.SMTP_SECURE === 'true', auth:{ user:process.env.SMTP_USER, pass:process.env.SMTP_PASSWORD } });
      await transporter.sendMail({ from:process.env.SMTP_FROM || process.env.SMTP_USER, to:process.env.AGENCY_EMAIL, subject:'New website review awaiting approval', text:`New review #${result.lastInsertRowid} from ${name} (${email})\n\nRating: ${rating}/5\n\n${text}\n\nReview it at ${process.env.SITE_URL || ''}/admin.html` });
    } else console.warn('Review saved, but SMTP_HOST or AGENCY_EMAIL is not configured.');
  }catch(error){ console.error('Review notification failed:', error.message); }
  res.status(201).json({ ok:true });
});
function adminOnly(req, res, next){ if(req.session && req.session.authenticated) return next(); res.status(401).json({ error:'Authentication required.' }); }
app.post('/api/admin/login', submitLimit, async (req, res) => { const valid = process.env.ADMIN_PASSWORD_HASH && await bcrypt.compare(clean(req.body.password), process.env.ADMIN_PASSWORD_HASH); if(!valid) return res.status(401).json({ error:'Incorrect password.' }); req.session = { authenticated:true }; res.json({ ok:true }); });
app.post('/api/admin/logout', adminOnly, (req, res) => { req.session = null; res.json({ ok:true }); });
app.get('/api/admin/reviews', adminOnly, (req, res) => res.json(database.prepare('SELECT id, name, email, rating, text, submitted_at AS submittedAt, status FROM reviews ORDER BY submitted_at DESC').all()));
app.patch('/api/admin/reviews/:id', adminOnly, (req, res) => { if(!['Approved','Rejected'].includes(req.body.status)) return res.status(400).json({ error:'Invalid status.' }); const result = database.prepare('UPDATE reviews SET status = ? WHERE id = ?').run(req.body.status, Number(req.params.id)); if(!result.changes) return res.status(404).json({ error:'Review not found.' }); res.json({ ok:true }); });
app.use(express.static(__dirname));
const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Website running at http://localhost:${port}`));