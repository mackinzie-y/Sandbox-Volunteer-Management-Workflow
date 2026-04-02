const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

loadEnvFile();

const app = express();
const PORT = process.env.PORT || 3001;
const dbFilePath = path.join(__dirname, 'database.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'riseupph-admin';
const ADMIN_SESSION_COOKIE = 'riseup_admin_session';

const SAMPLE_EVENTS = [
  {
    id: 'beach-cleanup',
    name: 'Beach Cleanup',
    description: 'Help remove waste from the shoreline and sort collected materials.',
    date: '2026-04-12',
    time: '8:00 AM - 11:30 AM',
    location: 'Manila Baywalk, Manila',
    tags: ['environment']
  },
  {
    id: 'feeding-program',
    name: 'Feeding Program',
    description: 'Assist with food packing, distribution, and volunteer coordination.',
    date: '2026-04-16',
    time: '1:00 PM - 4:00 PM',
    location: 'Barangay 654 Covered Court, Paco',
    tags: ['community', 'healthcare']
  },
  {
    id: 'donation-drive',
    name: 'Donation Drive',
    description: 'Support inventory, pickup scheduling, and donation booth operations.',
    date: '2026-04-20',
    time: '9:30 AM - 3:00 PM',
    location: 'RiseUp PH Logistics Hub, Quezon City',
    tags: ['logistics']
  },
  {
    id: 'tutoring-session',
    name: 'Tutoring Session',
    description: 'Guide students through reading and basic learning activities.',
    date: '2026-04-24',
    time: '3:00 PM - 5:30 PM',
    location: 'San Andres Learning Center, Manila',
    tags: ['education']
  },
  {
    id: 'community-health-day',
    name: 'Community Health Day',
    description: 'Welcome families, manage queues, and assist partner staff during consultations.',
    date: '2026-04-27',
    time: '8:30 AM - 2:00 PM',
    location: 'Tondo Community Clinic, Manila',
    tags: ['healthcare', 'community']
  }
];

app.use(cors());
app.use(express.json());

function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }

  const contents = fs.readFileSync(envPath, 'utf8');
  contents.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

function ensureLocalDb() {
  if (!fs.existsSync(dbFilePath)) {
    writeLocalDb({
      volunteers: [],
      events: SAMPLE_EVENTS,
      signups: [],
      chats: []
    });
    return;
  }

  const db = readLocalDb();
  db.volunteers = Array.isArray(db.volunteers) ? db.volunteers : [];
  db.events = Array.isArray(db.events) && db.events.length
    ? db.events.map((event) => {
        const sample = SAMPLE_EVENTS.find((item) => item.id === event.id);
        return sample ? { ...sample, ...event } : event;
      })
    : SAMPLE_EVENTS;
  db.signups = Array.isArray(db.signups) ? db.signups : [];
  db.chats = Array.isArray(db.chats) ? db.chats : [];
  writeLocalDb(db);
}

function readLocalDb() {
  return JSON.parse(fs.readFileSync(dbFilePath, 'utf8'));
}

function writeLocalDb(data) {
  fs.writeFileSync(dbFilePath, JSON.stringify(data, null, 2));
}

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((cookies, part) => {
    const [rawKey, ...rest] = part.trim().split('=');
    if (!rawKey) {
      return cookies;
    }
    cookies[rawKey] = decodeURIComponent(rest.join('='));
    return cookies;
  }, {});
}

function isAdminAuthenticated(req) {
  const cookies = parseCookies(req);
  return cookies[ADMIN_SESSION_COOKIE] === ADMIN_PASSWORD;
}

function requireAdminAuth(req, res, next) {
  if (isAdminAuthenticated(req)) {
    return next();
  }
  return res.status(401).json({ error: 'Admin authentication required' });
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function parseJsonFromText(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) {
      throw error;
    }
    return JSON.parse(match[0]);
  }
}

function scoreRole(profile, role) {
  let score = 0;
  const interests = profile.interests.map(normalizeText);
  const skills = profile.skills.map(normalizeText);
  const motivation = normalizeText(profile.motivation);
  const availability = normalizeText(profile.availability);

  if (role.keywords.some((item) => interests.includes(item))) {
    score += 3;
  }

  role.skillKeywords.forEach((item) => {
    if (skills.includes(item)) {
      score += 2;
    }
  });

  if (role.availability.includes(availability)) {
    score += 1;
  }

  role.motivationKeywords.forEach((item) => {
    if (motivation.includes(item)) {
      score += 1;
    }
  });

  return score;
}

function getFallbackRoleRecommendation(profile) {
  const roles = [
    {
      name: 'Community Organizer',
      keywords: ['education', 'healthcare'],
      skillKeywords: ['organizing', 'public speaking'],
      availability: ['weekdays', 'flexible'],
      motivationKeywords: ['community', 'people', 'help']
    },
    {
      name: 'Social Media Volunteer',
      keywords: ['environment', 'education'],
      skillKeywords: ['social media', 'public speaking'],
      availability: ['flexible', 'weekends'],
      motivationKeywords: ['story', 'awareness', 'share']
    },
    {
      name: 'Logistics Support',
      keywords: ['healthcare', 'environment'],
      skillKeywords: ['organizing'],
      availability: ['weekends', 'flexible', 'weekdays'],
      motivationKeywords: ['support', 'operations', 'organize']
    }
  ];

  const ranked = roles
    .map((role) => ({ ...role, score: scoreRole(profile, role) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  return {
    bestRole: best.name,
    explanation: `${best.name} fits your ${profile.availability} availability, interests in ${profile.interests.join(', ')}, and skills in ${profile.skills.join(', ')}.`
  };
}

function scoreEventForProfile(profile, event) {
  let score = 0;
  const interests = profile.interests.map(normalizeText);
  const skills = profile.skills.map(normalizeText);
  const eventTags = event.tags.map(normalizeText);

  eventTags.forEach((tag) => {
    if (interests.includes(tag)) {
      score += 3;
    }
    if (tag === 'logistics' && skills.includes('organizing')) {
      score += 2;
    }
    if (tag === 'education' && skills.includes('public speaking')) {
      score += 2;
    }
    if (tag === 'environment' && skills.includes('social media')) {
      score += 1;
    }
  });

  if (profile.availability === 'weekends' && ['2026-04-12', '2026-04-24'].includes(event.date)) {
    score += 1;
  }

  if (profile.availability === 'weekdays' && ['2026-04-16', '2026-04-20', '2026-04-27'].includes(event.date)) {
    score += 1;
  }

  if (profile.availability === 'flexible') {
    score += 1;
  }

  return score;
}

function getFallbackEventRecommendations(profile, events) {
  return events
    .map((event) => ({
      eventId: event.id,
      eventName: event.name,
      reason: `${event.name} aligns with your interests in ${profile.interests.join(', ')} and your ${profile.availability} availability.`,
      score: scoreEventForProfile(profile, event)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ score, ...item }) => item);
}

function getFallbackReminder(volunteer, event) {
  return `Hi ${volunteer.name}, this is a friendly reminder that you're signed up for ${event.name} on ${event.date}. Thank you for supporting RiseUp PH.`;
}

function getFallbackChatReply(message, events) {
  const text = normalizeText(message);

  if (text.includes('sign up')) {
    return 'Complete the onboarding form first, then open the events section and click Sign Up on the event you want to join.';
  }

  if (text.includes('event') || text.includes('available')) {
    return `Current events: ${events.map((event) => `${event.name} on ${event.date} at ${event.location}`).join(', ')}.`;
  }

  if (text.includes('availability') || text.includes('change')) {
    return 'Yes. Submit the onboarding form again with your updated availability and the latest profile will be used for new recommendations.';
  }

  return 'I can help with onboarding, event recommendations, sign-ups, reminders, and updating your availability.';
}

async function callOpenAI({ systemPrompt, userPrompt, fallback }) {
  if (!process.env.OPENAI_API_KEY) {
    return fallback();
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        temperature: 0.4,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }

    const payload = await response.json();
    return payload.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI request failed, using fallback:', error.message);
    return fallback();
  }
}

function initFirestore() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  try {
    // Optional dependency so the demo still works without Firebase credentials installed.
    const admin = require('firebase-admin');

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n')
        })
      });
    }

    return admin.firestore();
  } catch (error) {
    console.error('Firebase Admin unavailable, using local storage:', error.message);
    return null;
  }
}

const firestore = initFirestore();

async function seedEvents() {
  if (!firestore) {
    ensureLocalDb();
    return SAMPLE_EVENTS;
  }

  const collection = firestore.collection('events');
  await Promise.all(
    SAMPLE_EVENTS.map((event) =>
      collection.doc(event.id).set(event, { merge: true })
    )
  );
  return SAMPLE_EVENTS;
}

async function getEvents() {
  if (!firestore) {
    ensureLocalDb();
    return readLocalDb().events;
  }

  const snapshot = await firestore.collection('events').get();
  if (snapshot.empty) {
    return seedEvents();
  }

  return snapshot.docs.map((doc) => doc.data());
}

async function saveVolunteer(payload) {
  if (!firestore) {
    const db = readLocalDb();
    const volunteer = { id: createId('vol'), ...payload };
    db.volunteers.unshift(volunteer);
    writeLocalDb(db);
    return volunteer;
  }

  const ref = firestore.collection('volunteers').doc();
  const volunteer = { id: ref.id, ...payload };
  await ref.set(volunteer);
  return volunteer;
}

async function getVolunteerById(id) {
  if (!firestore) {
    const db = readLocalDb();
    return db.volunteers.find((item) => item.id === id) || null;
  }

  const doc = await firestore.collection('volunteers').doc(id).get();
  return doc.exists ? doc.data() : null;
}

async function getLatestVolunteer() {
  if (!firestore) {
    const db = readLocalDb();
    return db.volunteers[0] || null;
  }

  const snapshot = await firestore
    .collection('volunteers')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  return snapshot.empty ? null : snapshot.docs[0].data();
}

async function saveSignup(payload) {
  if (!firestore) {
    const db = readLocalDb();
    const signup = { id: createId('signup'), ...payload };
    db.signups.unshift(signup);
    writeLocalDb(db);
    return signup;
  }

  const ref = firestore.collection('signups').doc();
  const signup = { id: ref.id, ...payload };
  await ref.set(signup);
  return signup;
}

async function saveChat(payload) {
  if (!firestore) {
    const db = readLocalDb();
    db.chats.unshift({ id: createId('chat'), ...payload });
    writeLocalDb(db);
    return;
  }

  const ref = firestore.collection('chatLogs').doc();
  await ref.set({ id: ref.id, ...payload });
}

async function getAdminOverview() {
  if (!firestore) {
    const db = readLocalDb();
    return db;
  }

  const [volunteers, events, signups] = await Promise.all([
    firestore.collection('volunteers').orderBy('createdAt', 'desc').get(),
    firestore.collection('events').get(),
    firestore.collection('signups').orderBy('createdAt', 'desc').get()
  ]);

  return {
    volunteers: volunteers.docs.map((doc) => doc.data()),
    events: events.docs.map((doc) => doc.data()),
    signups: signups.docs.map((doc) => doc.data())
  };
}

function validateOnboarding(body) {
  const fields = ['name', 'availability', 'interests', 'skills', 'motivation'];
  const missing = fields.filter((field) => {
    const value = body[field];
    if (Array.isArray(value)) {
      return value.length === 0;
    }
    return !value;
  });

  return missing;
}

app.get('/api/health', async (req, res) => {
  const events = await getEvents();
  res.json({
    ok: true,
    storage: firestore ? 'firestore' : 'local-json',
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    eventCount: events.length
  });
});

app.post('/api/admin/login', (req, res) => {
  const password = String(req.body.password || '').trim();

  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid admin password' });
  }

  res.setHeader(
    'Set-Cookie',
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(ADMIN_PASSWORD)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=28800`
  );

  return res.json({ success: true });
});

app.post('/api/admin/logout', (req, res) => {
  res.setHeader(
    'Set-Cookie',
    `${ADMIN_SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`
  );

  return res.json({ success: true });
});

app.get('/api/admin/session', (req, res) => {
  res.json({ authenticated: isAdminAuthenticated(req) });
});

app.get('/api/events', async (req, res) => {
  try {
    const events = await getEvents();
    res.json(events);
  } catch (error) {
    console.error('Failed to load events:', error);
    res.status(500).json({ error: 'Failed to load events' });
  }
});

app.post('/api/onboarding', async (req, res) => {
  const missing = validateOnboarding(req.body);
  if (missing.length) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }

  try {
    const profile = {
      name: req.body.name.trim(),
      availability: req.body.availability,
      interests: req.body.interests,
      skills: req.body.skills,
      motivation: req.body.motivation.trim()
    };

    const aiRaw = await callOpenAI({
      systemPrompt: 'You are a volunteer matching assistant. Return only valid JSON.',
      userPrompt: `Suggest the best volunteer role from these options: [Community Organizer, Social Media Volunteer, Logistics Support].
User profile:
Availability: ${profile.availability}
Interests: ${profile.interests.join(', ')}
Skills: ${profile.skills.join(', ')}
Motivation: ${profile.motivation}
Return JSON with keys:
- bestRole
- explanation`,
      fallback: () => JSON.stringify(getFallbackRoleRecommendation(profile))
    });

    const aiRecommendation =
      typeof aiRaw === 'string' ? parseJsonFromText(aiRaw) : aiRaw;

    const volunteer = await saveVolunteer({
      ...profile,
      aiRecommendation,
      createdAt: new Date().toISOString()
    });

    res.status(201).json(volunteer);
  } catch (error) {
    console.error('Onboarding failed:', error);
    res.status(500).json({ error: 'Failed to submit onboarding profile' });
  }
});

app.get('/api/volunteers/latest', async (req, res) => {
  try {
    const volunteer = await getLatestVolunteer();
    if (!volunteer) {
      return res.status(404).json({ error: 'No volunteer profile found yet' });
    }
    res.json(volunteer);
  } catch (error) {
    console.error('Failed to load latest volunteer:', error);
    res.status(500).json({ error: 'Failed to load volunteer profile' });
  }
});

app.get('/api/volunteers/:id', async (req, res) => {
  try {
    const volunteer = await getVolunteerById(req.params.id);
    if (!volunteer) {
      return res.status(404).json({ error: 'Volunteer not found' });
    }
    res.json(volunteer);
  } catch (error) {
    console.error('Failed to load volunteer:', error);
    res.status(500).json({ error: 'Failed to load volunteer profile' });
  }
});

app.post('/api/events/recommendations', async (req, res) => {
  try {
    const volunteerId = req.body.volunteerId;
    const volunteer = volunteerId
      ? await getVolunteerById(volunteerId)
      : await getLatestVolunteer();

    if (!volunteer) {
      return res.status(404).json({ error: 'Volunteer profile not found' });
    }

    const events = await getEvents();
    const aiRaw = await callOpenAI({
      systemPrompt: 'You rank volunteer events and return only valid JSON.',
      userPrompt: `Based on this volunteer profile, suggest the top 3 best events from this list: ${JSON.stringify(events)}.
Profile: ${JSON.stringify({
  availability: volunteer.availability,
  interests: volunteer.interests,
  skills: volunteer.skills,
  motivation: volunteer.motivation
})}
Return a JSON array of 3 items. Each item must include:
- eventId
- eventName
- reason`,
      fallback: () => JSON.stringify(getFallbackEventRecommendations(volunteer, events))
    });

    const recommendations =
      typeof aiRaw === 'string' ? parseJsonFromText(aiRaw) : aiRaw;

    res.json({
      volunteerId: volunteer.id,
      recommendations
    });
  } catch (error) {
    console.error('Failed to create event recommendations:', error);
    res.status(500).json({ error: 'Failed to create event recommendations' });
  }
});

app.post('/api/events/:eventId/signup', async (req, res) => {
  try {
    const volunteer = await getVolunteerById(req.body.volunteerId);
    if (!volunteer) {
      return res.status(404).json({ error: 'Volunteer profile not found' });
    }

    const events = await getEvents();
    const event = events.find((item) => item.id === req.params.eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const signupDetails = req.body.signupDetails || {};
    const requiredDetails = ['contactNumber', 'emergencyContact', 'notes'];
    const missingDetails = requiredDetails.filter((field) => !String(signupDetails[field] || '').trim());

    if (missingDetails.length) {
      return res.status(400).json({
        error: `Missing required sign-up details: ${missingDetails.join(', ')}`
      });
    }

    const signup = await saveSignup({
      userId: volunteer.id,
      eventId: event.id,
      eventName: event.name,
      eventDate: event.date,
      eventTime: event.time,
      eventLocation: event.location,
      signupDetails: {
        contactNumber: signupDetails.contactNumber.trim(),
        emergencyContact: signupDetails.emergencyContact.trim(),
        notes: signupDetails.notes.trim()
      },
      createdAt: new Date().toISOString()
    });

    const reminder = await callOpenAI({
      systemPrompt: 'You write friendly volunteer reminders.',
      userPrompt: `Write a friendly reminder message for a volunteer who signed up for ${event.name} happening on ${event.date}.`,
      fallback: () => getFallbackReminder(volunteer, event)
    });

    res.status(201).json({
      signup,
      reminder: typeof reminder === 'string' ? reminder.trim() : getFallbackReminder(volunteer, event)
    });
  } catch (error) {
    console.error('Failed to sign up for event:', error);
    res.status(500).json({ error: 'Failed to sign up for event' });
  }
});

app.post('/api/chat', async (req, res) => {
  if (!req.body.message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const events = await getEvents();
    const reply = await callOpenAI({
      systemPrompt:
        'You are a helpful and friendly assistant for RiseUp PH, a volunteer organization. Answer clearly and concisely.',
      userPrompt: `User question: ${req.body.message}
Current events: ${events.map((event) => `${event.name} on ${event.date}`).join(', ')}`,
      fallback: () => getFallbackChatReply(req.body.message, events)
    });

    await saveChat({
      volunteerId: req.body.volunteerId || null,
      userMessage: req.body.message,
      assistantMessage: typeof reply === 'string' ? reply.trim() : '',
      createdAt: new Date().toISOString()
    });

    res.json({ reply: typeof reply === 'string' ? reply.trim() : '' });
  } catch (error) {
    console.error('Chat request failed:', error);
    res.status(500).json({ error: 'Failed to process chat request' });
  }
});

app.get('/api/admin/overview', requireAdminAuth, async (req, res) => {
  try {
    const overview = await getAdminOverview();
    res.json(overview);
  } catch (error) {
    console.error('Failed to load admin overview:', error);
    res.status(500).json({ error: 'Failed to load admin overview' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
  if (!isAdminAuthenticated(req)) {
    return res.sendFile(path.join(__dirname, 'admin-login.html'));
  }
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/admin.html', (req, res) => {
  if (!isAdminAuthenticated(req)) {
    return res.sendFile(path.join(__dirname, 'admin-login.html'));
  }
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.use(express.static(path.join(__dirname, '/')));

seedEvents()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`RiseUp PH server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Startup failed:', error);
    process.exit(1);
  });
