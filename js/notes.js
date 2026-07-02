/* notes.html ရဲ့ page-specific logic — firebase.js (db, auth) ကို ပြန်သုံးပါတယ် */

let currentUser = null;

auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = '../index.html';
        return;
    }
    currentUser = user;


    const usersRef = db.collection('users');
    const doc = await usersRef.doc(user.uid).get();
    const data = doc.exists ? doc.data() : {};

    document.getElementById('userChip').style.display = 'flex';
    document.getElementById('userEmailLabel').textContent = data.firstName || user.email;
    document.getElementById('userMenuNameLabel').textContent = data.firstName || user.email;
    document.getElementById('roleBadge').textContent = (data.role === 'admin') ? 'Admin' : 'Member';
    document.getElementById('roleBadge').classList.toggle('admin', data.role === 'admin');
    const feedbackMenuItem = document.getElementById('feedbackMenuItem');
    if (feedbackMenuItem) {
        feedbackMenuItem.style.display = data.role === 'admin' ? 'flex' : 'none';
        }

    loadNotes(user.uid);
});

function handleLogout() {
    auth.signOut();
}

/* Language switcher (main page နဲ့ပုံစံတူ) */
function toggleLangMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('langMenu');
    const btn = document.getElementById('langBtn');
    const isOpen = menu.classList.contains('open');
    menu.classList.toggle('open', !isOpen);
    btn.setAttribute('aria-expanded', String(!isOpen));
}
function selectLang(code, label, el) {
    document.getElementById('lang-label').textContent = label;
    document.querySelectorAll('.lang-menu li').forEach(li => li.classList.remove('selected'));
    el.classList.add('selected');
    closeLangMenu();
}
function closeLangMenu() {
    document.getElementById('langMenu').classList.remove('open');
    document.getElementById('langBtn').setAttribute('aria-expanded', 'false');
}

function toggleUserMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('userMenu');
    const btn = document.getElementById('userTrigger');
    const isOpen = menu.classList.contains('open');
    menu.classList.toggle('open', !isOpen);
    btn.setAttribute('aria-expanded', String(!isOpen));
}
function closeUserMenu() {
    document.getElementById('userMenu').classList.remove('open');
    document.getElementById('userTrigger').setAttribute('aria-expanded', 'false');
}

document.addEventListener('click', (e) => {
    const switcher = document.querySelector('.lang-switcher');
    if (switcher && !switcher.contains(e.target)) closeLangMenu();
    const chip = document.querySelector('.user-chip');
    if (chip && !chip.contains(e.target)) closeUserMenu();
});

/* ---- Notes listing ---- */
function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}

function goToLesson(lessonId) {
    localStorage.setItem('ld_selected_lesson', lessonId);
    window.location.href = '../index.html';
}

async function loadNotes(uid) {
    const container = document.getElementById('notesListContainer');
    container.innerHTML = '<p class="notes-empty">Loading...</p>';

    try {
        const [notesSnap, lessonsSnap] = await Promise.all([
            db.collection('notes').where('uid', '==', uid).get(),
            db.collection('lessons').get()
        ]);

        if (notesSnap.empty) {
            container.innerHTML = '<p class="notes-empty">Note မှတ်ထားတာ မရှိသေးပါ — lesson တစ်ခုခုကို ဖွင့်ပြီး note icon ကို နှိပ်ပါ။</p>';
            return;
        }

        const lessonInfo = {};
        lessonsSnap.forEach(doc => {
            const data = doc.data();
            const title = data.title;
            lessonInfo[doc.id] = {
                title: (typeof title === 'object') ? (title.en || '') : (title || ''),
                order: data.order ?? 0
            };
        });

        const sortedNotes = notesSnap.docs.slice().sort((a, b) => {
            const orderA = lessonInfo[a.data().lessonId]?.order ?? 0;
            const orderB = lessonInfo[b.data().lessonId]?.order ?? 0;
            return orderA - orderB;
        });

        container.innerHTML = sortedNotes.map(doc => {
            const data = doc.data();
            const info = lessonInfo[data.lessonId];
            const title = info ? info.title : data.lessonId;
            return `
                <div class="note-card">
                    <div class="note-card-header">
                        <h3>${escapeHtml(title)}</h3>
                        <button class="note-card-link" onclick="goToLesson('${data.lessonId}')">
                            <i class="ti ti-arrow-right"></i> Lesson ကိုသွားရန်
                        </button>
                    </div>
                    <div class="note-card-body">${data.content || ''}</div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('loadNotes error:', err);
        container.innerHTML = `<p class="notes-empty">Error: ${escapeHtml(err.message)}</p>`;
    }
}

/* ---- Profile (notes page) ---- */
function openProfilePanel() {
    closeUserMenu();
    db.collection('users').doc(currentUser.uid).get().then(doc => {
        const data = doc.exists ? doc.data() : {};
        document.getElementById('profileFirstName').textContent = data.firstName || '-';
        document.getElementById('profileLastName').textContent = data.lastName || '-';
        document.getElementById('profileEmail').textContent = data.email || currentUser.email || '-';
        document.getElementById('profileBirthday').textContent = data.birthday || '-';
        document.getElementById('profileRole').textContent = data.role === 'admin' ? 'Admin' : 'Member';
        document.getElementById('profileOverlay').classList.add('open');
    });
}

function closeProfilePanel() {
    document.getElementById('profileOverlay').classList.remove('open');
}

function switchToEditProfile() {
    document.getElementById('profileEditForm').style.display = 'flex';
    document.getElementById('profileViewActions').style.display = 'none';
    document.getElementById('profileBody').style.display = 'none';
    document.getElementById('editFirstName').value = document.getElementById('profileFirstName').textContent === '-' ? '' : document.getElementById('profileFirstName').textContent;
    document.getElementById('editLastName').value = document.getElementById('profileLastName').textContent === '-' ? '' : document.getElementById('profileLastName').textContent;
    document.getElementById('editBirthday').value = document.getElementById('profileBirthday').textContent === '-' ? '' : document.getElementById('profileBirthday').textContent;
}

function cancelEditProfile() {
    document.getElementById('profileEditForm').style.display = 'none';
    document.getElementById('profileViewActions').style.display = 'flex';
    document.getElementById('profileBody').style.display = 'flex';
    openProfilePanel();
}


function saveEditProfile() {
    const firstName = document.getElementById('editFirstName').value.trim();
    const lastName = document.getElementById('editLastName').value.trim();
    const birthday = document.getElementById('editBirthday').value;

    if (!firstName) {
        alert('First name ကိုဖြည့်ပါ။');
        return;
    }

    db.collection('users').doc(currentUser.uid).update({
        firstName,
        lastName,
        birthday
    }).then(() => {
        document.getElementById('profileFirstName').textContent = firstName || '-';
        document.getElementById('profileLastName').textContent = lastName || '-';
        document.getElementById('profileBirthday').textContent = birthday || '-';
        const emailLabel = document.getElementById('userEmailLabel');
        const nameLabel = document.getElementById('userMenuNameLabel');
        if (emailLabel) emailLabel.textContent = firstName || currentUser.email;
        if (nameLabel) nameLabel.textContent = firstName || currentUser.email;
        cancelEditProfile();
        alert('Profile ပြင်ဆင်ပြီးပါပြီ။');
    }).catch(err => alert(err.message));
}


/* ---- Feedback (notes page) ---- */
let currentRating = 0;

function openFeedbackPanel() {
    closeUserMenu();
    currentRating = 0;
    document.getElementById('feedbackComment').value = '';
    document.querySelectorAll('.star').forEach(s => s.classList.remove('active'));
    document.getElementById('feedbackModal').classList.add('open');
}

function closeFeedbackPanel() {
    document.getElementById('feedbackModal').classList.remove('open');
}

function setRating(value) {
    currentRating = value;
    document.querySelectorAll('.star').forEach(s => {
        s.classList.toggle('active', parseInt(s.dataset.value) <= value);
    });
}

function submitFeedback() {
    if (currentRating === 0) {
        alert('ကြယ် အနည်းဆုံး ၁ လုံး ရွေးပါ။');
        return;
    }
    const comment = document.getElementById('feedbackComment').value.trim();
    if (!comment) {
        alert('Comment ရေးပါ။');
        return;
    }

    db.collection('users').doc(currentUser.uid).get().then(doc => {
        const data = doc.exists ? doc.data() : {};
        const name = `${data.firstName || ''} ${data.lastName || ''}`.trim() || currentUser.email;

        return db.collection('feedbacks').add({
            uid: currentUser.uid,
            name,
            rating: currentRating,
            comment,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }).then(() => {
        closeFeedbackPanel();
        alert('Feedback ပေးပို့ပြီးပါပြီ။ ကျေးဇူးတင်ပါသည်။');
    }).catch(err => alert(err.message));
}