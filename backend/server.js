const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Paths
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

// Ensure directories
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Utilities for simple JSON persistence
function readJson(fileName, fallback) {
	const filePath = path.join(DATA_DIR, fileName);
	if (!fs.existsSync(filePath)) return fallback;
	try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch (e) { return fallback; }
}
function writeJson(fileName, data) {
	const filePath = path.join(DATA_DIR, fileName);
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Seed files if not present
if (!fs.existsSync(path.join(DATA_DIR, 'ieps.json'))) writeJson('ieps.json', []);
if (!fs.existsSync(path.join(DATA_DIR, 'resources.json'))) writeJson('resources.json', []);
if (!fs.existsSync(path.join(DATA_DIR, 'meetings.json'))) writeJson('meetings.json', []);
if (!fs.existsSync(path.join(DATA_DIR, 'recentActivity.json'))) writeJson('recentActivity.json', []);
if (!fs.existsSync(path.join(DATA_DIR, 'students.json'))) {
	writeJson('students.json', [
		{ id: uuidv4(), studentName: 'Michael Thompson', currentStage: 'Completed', fileLastModified: dayjs().subtract(2, 'day').toISOString() },
		{ id: uuidv4(), studentName: 'Jennifer Martinez', currentStage: 'Scheduled', fileLastModified: dayjs().subtract(1, 'day').toISOString() },
		{ id: uuidv4(), studentName: 'Sarah Williams', currentStage: 'Draft', fileLastModified: dayjs().subtract(5, 'day').toISOString() },
		{ id: uuidv4(), studentName: 'Ava Johnson', currentStage: 'Under Review', fileLastModified: dayjs().subtract(3, 'day').toISOString() },
		{ id: uuidv4(), studentName: 'Liam Brown', currentStage: 'Draft', fileLastModified: dayjs().subtract(7, 'day').toISOString() },
		{ id: uuidv4(), studentName: 'Noah Davis', currentStage: 'Completed', fileLastModified: dayjs().subtract(9, 'day').toISOString() },
		{ id: uuidv4(), studentName: 'Emma Garcia', currentStage: 'Scheduled', fileLastModified: dayjs().subtract(4, 'day').toISOString() },
		{ id: uuidv4(), studentName: 'Olivia Wilson', currentStage: 'Under Review', fileLastModified: dayjs().subtract(6, 'day').toISOString() }
	]);
}

// Static serving for uploaded files and frontend
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(FRONTEND_DIR));

// Multer storage setup
const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, UPLOAD_DIR);
	},
	filename: function (req, file, cb) {
		const unique = `${Date.now()}-${uuidv4()}`;
		const safe = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
		cb(null, `${unique}-${safe}`);
	}
});
const upload = multer({ storage });

// Auth (mock)
app.post('/api/login', (req, res) => {
	// Always returns the same user for demo
	res.json({
		token: 'mock-token',
		user: { id: 'user-1', name: 'Sarah Johnson', email: 'sarah@example.com' }
	});
});

// Dashboard
app.get('/api/dashboard', (req, res) => {
	const ieps = readJson('ieps.json', []);
	const meetings = readJson('meetings.json', []);
	const recent = readJson('recentActivity.json', []);
	const dueThisMonth = ieps.filter(i => dayjs(i.dueDate).isSame(dayjs(), 'month')).length || 12; // mock
	res.json({
		stats: {
			activeIEPs: ieps.length || 47,
			dueThisMonth,
			meetingsScheduled: meetings.length || 8,
			pendingReviews: Math.max(0, 3)
		},
		recentActivity: recent.slice(-10).reverse()
	});
});

// Students: list with optional search and sorting
app.get('/api/students', (req, res) => {
	const { search = '', sortBy = 'studentName', sortDir = 'asc' } = req.query;
	let students = readJson('students.json', []);
	const q = String(search).toLowerCase();
	if (q) students = students.filter(s => (s.studentName || '').toLowerCase().includes(q));
	const dir = String(sortDir).toLowerCase() === 'desc' ? -1 : 1;
	const key = ['studentName','currentStage','fileLastModified'].includes(sortBy) ? sortBy : 'studentName';
	students.sort((a, b) => {
		let va = a[key]; let vb = b[key];
		if (key === 'fileLastModified') { va = new Date(va).getTime(); vb = new Date(vb).getTime(); }
		if (va < vb) return -1 * dir; if (va > vb) return 1 * dir; return 0;
	});
	res.json(students);
});

// IEPs
app.post('/api/ieps', (req, res) => {
	const { studentName, parentName, additionalInfo } = req.body;
	if (!studentName || !parentName) {
		return res.status(400).json({ error: 'studentName and parentName are required' });
	}
	const ieps = readJson('ieps.json', []);
	const id = uuidv4();
	const newIep = { id, studentName, parentName, additionalInfo: additionalInfo || '', createdAt: new Date().toISOString(), dueDate: dayjs().add(2, 'month').toISOString() };
	ieps.push(newIep);
	writeJson('ieps.json', ieps);

	// Log activity
	const recent = readJson('recentActivity.json', []);
	recent.push({ id: uuidv4(), type: 'IEP_CREATED', text: `IEP created for ${studentName}`, ts: new Date().toISOString() });
	writeJson('recentActivity.json', recent);

	res.status(201).json(newIep);
});

// Resources
app.get('/api/resources', (req, res) => {
	const { search } = req.query;
	let resources = readJson('resources.json', []);
	resources.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
	if (search) {
		const q = String(search).toLowerCase();
		resources = resources.filter(r => (r.title || '').toLowerCase().includes(q) || (r.originalName || '').toLowerCase().includes(q));
	}
	res.json(resources);
});

app.post('/api/resources', upload.single('file'), (req, res) => {
	if (!req.file) return res.status(400).json({ error: 'file is required' });
	const title = req.body.title || req.file.originalname;
	const resources = readJson('resources.json', []);
	const record = {
		id: uuidv4(),
		title,
		filename: req.file.filename,
		originalName: req.file.originalname,
		uploadedAt: new Date().toISOString(),
		url: `/uploads/${req.file.filename}`
	};
	resources.push(record);
	writeJson('resources.json', resources);
	res.status(201).json(record);
});

app.patch('/api/resources/:id', (req, res) => {
	const { id } = req.params;
	const { title } = req.body;
	let resources = readJson('resources.json', []);
	const idx = resources.findIndex(r => r.id === id);
	if (idx === -1) return res.status(404).json({ error: 'not_found' });
	if (typeof title === 'string') resources[idx].title = title;
	writeJson('resources.json', resources);
	res.json(resources[idx]);
});

app.delete('/api/resources/:id', (req, res) => {
	const { id } = req.params;
	let resources = readJson('resources.json', []);
	const idx = resources.findIndex(r => r.id === id);
	if (idx === -1) return res.status(404).json({ error: 'not_found' });
	const [removed] = resources.splice(idx, 1);
	writeJson('resources.json', resources);
	try { fs.unlinkSync(path.join(UPLOAD_DIR, removed.filename)); } catch {}
	res.json({ ok: true });
});

// Meetings
app.get('/api/meetings', (req, res) => {
	const meetings = readJson('meetings.json', []);
	meetings.sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor));
	res.json(meetings);
});

app.post('/api/meetings', (req, res) => {
	const { emails, meetingType, durationMinutes } = req.body;
	if (!Array.isArray(emails) || emails.length === 0) return res.status(400).json({ error: 'emails required' });
	const type = meetingType || 'Other';
	const duration = Number(durationMinutes) || 45;
	// For demo: schedule the meeting tomorrow at 2pm local time
	const base = dayjs().add(1, 'day').hour(14).minute(0).second(0).millisecond(0);
	const newMeeting = {
		id: uuidv4(),
		emails,
		meetingType: type,
		durationMinutes: duration,
		scheduledFor: base.toISOString(),
		createdAt: new Date().toISOString(),
		googleAddLink: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(type)}&dates=${base.format('YYYYMMDDTHHmmss')}/${base.add(duration, 'minute').format('YYYYMMDDTHHmmss')}&details=${encodeURIComponent('IEP Meeting')}`
	};
	const meetings = readJson('meetings.json', []);
	meetings.push(newMeeting);
	writeJson('meetings.json', meetings);

	// Log activity
	const recent = readJson('recentActivity.json', []);
	recent.push({ id: uuidv4(), type: 'MEETING_SCHEDULED', text: `Meeting scheduled: ${type}`, ts: new Date().toISOString() });
	writeJson('recentActivity.json', recent);

	res.status(201).json(newMeeting);
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
	res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

app.listen(PORT, () => {
	console.log(`IEP.AI server running on http://localhost:${PORT}`);
}); 