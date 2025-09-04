const qs = (sel, el=document) => el.querySelector(sel);
const qsa = (sel, el=document) => Array.from(el.querySelectorAll(sel));
const api = async (url, options) => {
	const res = await fetch(url, options);
	if (!res.ok) throw new Error(await res.text());
	return res.json();
};

// Navigation
qsa('.nav-item').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));
function showView(view) {
	qsa('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
	qsa('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
	if (view === 'dashboard') { loadDashboard(); loadStudents(); }
	if (view === 'resources') loadResources();
	if (view === 'meetings') loadMeetings();
	if (view === 'calendar') loadCalendar();
}

// Dashboard
async function loadDashboard() {
	try {
		const { stats, recentActivity } = await api('/api/dashboard');
		qs('#stat-active').textContent = stats.activeIEPs;
		qs('#stat-due').textContent = stats.dueThisMonth;
		qs('#stat-meetings').textContent = stats.meetingsScheduled;
		qs('#stat-reviews').textContent = stats.pendingReviews;
		const list = qs('#recent-list');
		list.innerHTML = '';
		(recentActivity || []).forEach(a => {
			const li = document.createElement('li');
			li.textContent = `${new Date(a.ts).toLocaleDateString()} — ${a.text}`;
			list.appendChild(li);
		});
	} catch (e) { console.error(e); }
}

// Students table (dashboard)
let studentSortKey = 'studentName';
let studentSortDir = 'asc';

qsa('#students-table th').forEach(th => {
	th.addEventListener('click', () => {
		const key = th.getAttribute('data-key');
		if (studentSortKey === key) {
			studentSortDir = studentSortDir === 'asc' ? 'desc' : 'asc';
		} else {
			studentSortKey = key; studentSortDir = 'asc';
		}
		loadStudents();
	});
});

qs('#student-search').addEventListener('input', () => loadStudents());

async function loadStudents() {
	const search = qs('#student-search')?.value || '';
	const url = `/api/students?search=${encodeURIComponent(search)}&sortBy=${encodeURIComponent(studentSortKey)}&sortDir=${encodeURIComponent(studentSortDir)}`;
	try {
		const rows = await api(url);
		const tbody = qs('#students-table tbody');
		tbody.innerHTML = '';
		rows.forEach(s => {
			const tr = document.createElement('tr');
			const d = new Date(s.fileLastModified);
			tr.innerHTML = `<td>${s.studentName}</td><td>${s.currentStage}</td><td>${d.toLocaleString()}</td>`;
			tbody.appendChild(tr);
		});
	} catch (e) { console.error(e); }
}

// New IEP
qs('#form-new-iep').addEventListener('submit', async (e) => {
	e.preventDefault();
	const fd = new FormData(e.target);
	const payload = Object.fromEntries(fd.entries());
	try {
		await api('/api/ieps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
		alert('IEP saved. Now schedule a meeting.');
		showView('meetings');
	} catch (err) { alert('Failed to save IEP'); }
});

// Resources
const resourceList = qs('#resource-list');
qs('#form-upload').addEventListener('submit', async (e) => {
	e.preventDefault();
	const fd = new FormData(e.target);
	try {
		await api('/api/resources', { method: 'POST', body: fd });
		e.target.reset();
		loadResources();
	} catch (err) { alert('Upload failed'); }
});

qs('#resource-search').addEventListener('input', () => loadResources());

async function loadResources() {
	const search = qs('#resource-search').value || '';
	let url = '/api/resources';
	if (search) url += `?search=${encodeURIComponent(search)}`;
	try {
		const items = await api(url);
		resourceList.innerHTML = '';
		items.forEach(r => {
			const li = document.createElement('li');
			li.className = 'resource-row';
			const title = document.createElement('input');
			title.className = 'title-input';
			title.value = r.title || r.originalName;
			title.addEventListener('change', async () => {
				await api(`/api/resources/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.value }) });
			});
			const link = document.createElement('a');
			link.href = r.url; link.textContent = 'Open'; link.target = '_blank';
			const remove = document.createElement('button');
			remove.textContent = 'Remove';
			remove.addEventListener('click', async () => {
				if (!confirm('Delete resource?')) return;
				await api(`/api/resources/${r.id}`, { method: 'DELETE' });
				loadResources();
			});
			li.appendChild(title);
			li.appendChild(link);
			li.appendChild(remove);
			resourceList.appendChild(li);
		});
	} catch (e) { console.error(e); }
}

// Meetings
qs('#form-meeting').addEventListener('submit', async (e) => {
	e.preventDefault();
	const fd = new FormData(e.target);
	const emails = String(fd.get('emails') || '')
		.split(',')
		.map(s => s.trim())
		.filter(Boolean);
	const payload = {
		emails,
		meetingType: fd.get('meetingType'),
		durationMinutes: Number(fd.get('durationMinutes') || 45)
	};
	try {
		const m = await api('/api/meetings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
		alert('Meeting scheduled for ' + new Date(m.scheduledFor).toLocaleString());
		loadMeetings();
		loadCalendar();
	} catch (err) { alert('Failed to schedule meeting'); }
});

async function loadMeetings() {
	try {
		const items = await api('/api/meetings');
		const list = qs('#meetings-list');
		list.innerHTML = '';
		items.forEach(m => {
			const li = document.createElement('li');
			li.innerHTML = `${new Date(m.scheduledFor).toLocaleString()} — ${m.meetingType} · ${m.durationMinutes}m · <a href="${m.googleAddLink}" target="_blank">Add to Google Calendar</a>`;
			list.appendChild(li);
		});
	} catch (e) { console.error(e); }
}

async function loadCalendar() {
	try {
		const items = await api('/api/meetings');
		const list = qs('#calendar-list');
		list.innerHTML = '';
		items.forEach(m => {
			const li = document.createElement('li');
			li.innerHTML = `${new Date(m.scheduledFor).toLocaleString()} — ${m.meetingType} · ${m.durationMinutes}m`;
			list.appendChild(li);
		});
	} catch (e) { console.error(e); }
}

// Initial load
loadDashboard();
loadStudents(); 