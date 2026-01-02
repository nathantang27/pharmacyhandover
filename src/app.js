// App state
let notes = JSON.parse(localStorage.getItem('tna_notes_v1') || '[]');
let audit = JSON.parse(localStorage.getItem('tna_audit_v1') || '[]');
let profile = JSON.parse(localStorage.getItem('tna_profile_v1') || '{}');
let editingNoteId = null;

// DOM elements
const els = {};
['notesGrid','noteCount','modalBackdrop','createNoteBtn','saveNote','cancelNote',
 'searchInput','statusFilter','priorityFilter','categoryFilter','showing','auditLog',
 'saveProfile','clearProfile','roleSelect','displayName','gphc','avatar','userName',
 'userRole','exportBtn','importBtn','importFile','clearLog','clearAllBtn',
 'noteCategory','notePriority','notePatientRef','noteMessage','modalTitle'
].forEach(id => els[id] = document.getElementById(id));

// Utilities
const uid = pref => pref + Math.random().toString(36).slice(2,9);
const nowISO = () => new Date().toISOString();
const escapeHtml = s => s ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : '';

// Initialize
function init() {
    bindEvents();
    loadProfileToUI();
    renderNotes();
    renderAudit();
}

// Event binding
function bindEvents() {
    els.createNoteBtn.addEventListener('click', () => openModal());
    els.cancelNote.addEventListener('click', closeModal);
    els.saveNote.addEventListener('click', saveNote);
    els.searchInput.addEventListener('input', renderNotes);
    els.statusFilter.addEventListener('change', renderNotes);
    els.priorityFilter.addEventListener('change', renderNotes);
    els.categoryFilter.addEventListener('change', renderNotes);
    els.saveProfile.addEventListener('click', saveProfile);
    els.clearProfile.addEventListener('click', resetProfile);
    els.exportBtn.addEventListener('click', exportJSON);
    els.importBtn.addEventListener('click', () => els.importFile.click());
    els.importFile.addEventListener('change', handleImportFile);
    els.clearLog.addEventListener('click', clearAudit);
    els.clearAllBtn.addEventListener('click', clearAllNotes);
}

// Profile functions
function saveProfile() {
    profile = {
        role: els.roleSelect.value,
        name: els.displayName.value || 'Guest',
        gphc: els.gphc.value || ''
    };
    localStorage.setItem('tna_profile_v1', JSON.stringify(profile));
    loadProfileToUI();
    pushAudit('Profile saved');
}

function resetProfile() {
    profile = {};
    localStorage.removeItem('tna_profile_v1');
    loadProfileToUI();
    pushAudit('Profile reset');
}

function loadProfileToUI() {
    els.roleSelect.value = profile.role || 'guest';
    els.displayName.value = profile.name || '';
    els.gphc.value = profile.gphc || '';
    els.avatar.textContent = (profile.name || 'Guest').split(' ')[0].charAt(0) || 'U';
    els.userName.textContent = profile.name || 'Guest';
    els.userRole.textContent = profile.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : 'No role selected';
}

// Modal functions
function openModal(note = null) {
    els.modalBackdrop.style.display = 'flex';
    if (note) {
        els.modalTitle.textContent = 'Edit Note';
        els.noteCategory.value = note.category || 'Other';
        els.notePriority.value = note.priority || 'low';
        els.notePatientRef.value = note.patientRef || '';
        els.noteMessage.value = note.message || '';
        editingNoteId = note.id;
    } else {
        els.modalTitle.textContent = 'Create Note';
        editingNoteId = null;
    }
}

function closeModal() {
    els.modalBackdrop.style.display = 'none';
    editingNoteId = null;
}

// Notes CRUD
function saveNote() {
    const msg = els.noteMessage.value.trim();
    if (!msg) { alert('Message is required'); return; }
    
    const noteData = {
        id: editingNoteId || uid('N'),
        author: profile.name || 'Guest',
        authorRole: profile.role || 'guest',
        gphc: profile.gphc || '',
        category: els.noteCategory.value,
        priority: els.notePriority.value,
        patientRef: els.notePatientRef.value.trim(),
        message: msg,
        status: 'active',
        createdAt: editingNoteId ? notes.find(n => n.id === editingNoteId).createdAt : nowISO(),
        updatedAt: nowISO(),
        acks: []
    };
    
    if (editingNoteId) {
        notes = notes.map(n => n.id === editingNoteId ? {...n, ...noteData} : n);
        pushAudit('Edited note ' + editingNoteId);
    } else {
        notes.unshift(noteData);
        pushAudit('Created note ' + noteData.id);
    }
    
    persistNotes();
    closeModal();
    renderNotes();
}

function persistNotes() {
    localStorage.setItem('tna_notes_v1', JSON.stringify(notes));
}

function renderNotes() {
    const q = (els.searchInput.value || '').toLowerCase();
    const status = els.statusFilter.value;
    const pri = els.priorityFilter.value;
    const cat = els.categoryFilter.value;
    
    let filtered = notes.filter(n => {
        if (status !== 'all' && n.status !== status) return false;
        if (pri !== 'all' && n.priority !== pri) return false;
        if (cat !== 'all' && n.category !== cat) return false;
        if (q) {
            return (n.message || '').toLowerCase().includes(q) || 
                   (n.patientRef || '').toLowerCase().includes(q) || 
                   (n.author || '').toLowerCase().includes(q);
        }
        return true;
    });
    
    els.notesGrid.innerHTML = '';
    if (filtered.length === 0) {
        els.notesGrid.innerHTML = '<div class="small">You\'re all up to date!</div>';
    } else {
        filtered.forEach(renderNoteCard);
    }
    
    els.noteCount.textContent = notes.length;
    els.showing.textContent = filtered.length === notes.length ? 'all' : filtered.length + ' shown';
}

function renderNoteCard(note) {
    const div = document.createElement('div');
    div.className = 'note';
    const prioClass = note.priority === 'low' ? 'low' : note.priority === 'medium' ? 'med' : 'high';
    
    div.innerHTML = `
        <div class="meta">
            <div style="font-weight:600">${escapeHtml(note.category)}</div>
            <div class="badge ${prioClass}">${note.priority}</div>
        </div>
        <p>${escapeHtml(note.message)}</p>
        <div class="small">By ${escapeHtml(note.author)} ${note.gphc ? '(' + escapeHtml(note.gphc) + ')' : ''} · ${new Date(note.createdAt).toLocaleString()}</div>
        <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center">
            <div class="controls small">
                <button data-action="ack" data-id="${note.id}" class="btn ghost">Ack</button>
                <button data-action="edit" data-id="${note.id}" class="btn ghost">Edit</button>
                <button data-action="del" data-id="${note.id}" class="btn ghost">Delete</button>
            </div>
            <div style="text-align:right;font-size:12px;color:var(--muted)">
                ${note.status === 'completed' ? '<div style="color:var(--success)">Completed</div>' : '<div class="small">Active</div>'}
            </div>
        </div>
    `;
    
    els.notesGrid.appendChild(div);
    div.querySelectorAll('button').forEach(b => b.addEventListener('click', onNoteAction));
}

function onNoteAction(ev) {
    const id = ev.currentTarget.dataset.id;
    const action = ev.currentTarget.dataset.action;
    const note = notes.find(n => n.id === id);
    if (!note) return;
    
    if (action === 'ack') {
        doAck(note);
    } else if (action === 'edit') {
        openModal(note);
    } else if (action === 'del' && confirm('Delete note?')) {
        notes = notes.filter(n => n.id !== id);
        persistNotes();
        pushAudit('Deleted note ' + id);
        renderNotes();
    }
}

function doAck(note) {
    const who = profile.name || 'Guest';
    const role = profile.role || 'guest';
    note.acks = note.acks || [];
    note.acks.push({ id: uid('A'), user: who, role: role, at: nowISO() });
    note.status = 'completed';
    note.updatedAt = nowISO();
    notes = notes.map(n => n.id === note.id ? note : n);
    persistNotes();
    pushAudit('Acknowledged note ' + note.id + ' by ' + who);
    renderNotes();
}

// Audit functions
function pushAudit(text) {
    const entry = { id: uid('L'), text, at: nowISO(), by: profile.name || 'Guest' };
    audit.unshift(entry);
    localStorage.setItem('tna_audit_v1', JSON.stringify(audit));
    renderAudit();
}

function renderAudit() {
    if (audit.length === 0) {
        els.auditLog.innerHTML = '<div class="small">No log entries</div>';
        return;
    }
    els.auditLog.innerHTML = audit.map(a => `
        <div style="margin-bottom:6px">
            <strong>${escapeHtml(a.text)}</strong>
            <div class="small">${new Date(a.at).toLocaleString()} · ${escapeHtml(a.by)}</div>
        </div>
    `).join('');
}

function clearAudit() {
    if (confirm('Clear audit log?')) {
        audit = [];
        localStorage.removeItem('tna_audit_v1');
        renderAudit();
        pushAudit('Cleared audit log');
    }
}

// Export/Import
function exportJSON() {
    const payload = { notes, audit, profile, exportedAt: nowISO() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tna-export-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
}

function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);
            if (data.notes) notes = data.notes;
            if (data.audit) audit = data.audit;
            if (data.profile) profile = data.profile;
            
            persistNotes();
            localStorage.setItem('tna_audit_v1', JSON.stringify(audit));
            localStorage.setItem('tna_profile_v1', JSON.stringify(profile));
            loadProfileToUI();
            renderNotes();
            renderAudit();
            alert('Import complete');
        } catch (err) {
            alert('Invalid file');
        }
    };
    reader.readAsText(file);
}

function clearAllNotes() {
    if (confirm('Clear ALL notes? This cannot be undone.')) {
        notes = [];
        persistNotes();
        pushAudit('Cleared all notes');
        renderNotes();
    }
}

// Initialize app
init();