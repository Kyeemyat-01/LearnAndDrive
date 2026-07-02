/* Admin Feedback Page */

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
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
    const menu = document.getElementById('userMenu');
    const btn = document.getElementById('userTrigger');
    if (menu) menu.classList.remove('open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
}

function handleLogout() {
    auth.signOut().then(() => {
        window.location.href = '../index.html';
    });
}

document.addEventListener('click', (e) => {
    const langSwitcher = document.querySelector('.lang-switcher');
    if (langSwitcher && !langSwitcher.contains(e.target)) closeLangMenu();
    const chip = document.querySelector('.user-chip');
    if (chip && !chip.contains(e.target)) closeUserMenu();
});

let currentUser = null;

auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = '../index.html';
        return;
    }

    currentUser = user;

    const doc = await db.collection('users').doc(user.uid).get();
    const data = doc.exists ? doc.data() : {};

    if (data.role !== 'admin') {
        window.location.href = '../index.html';
        return;
    }

    document.getElementById('userChip').style.display = 'flex';
    document.getElementById('userEmailLabel').textContent = data.firstName || user.email;
    document.getElementById('userMenuNameLabel').textContent = data.firstName || user.email;
    document.getElementById('roleBadge').textContent = 'Admin';
    document.getElementById('roleBadge').classList.add('admin');

    loadFeedbacks();
});

function renderStars(rating) {
    return Array.from({ length: 5 }, (_, i) =>
        `<i class="ti ti-star-filled ${i < rating ? '' : 'empty'}"></i>`
    ).join('');
}

async function loadFeedbacks() {
    const container = document.getElementById('feedbackListContainer');
    const summary = document.getElementById('feedbackSummary');
    container.innerHTML = '<p class="feedback-empty">Loading...</p>';

    try {
        const snap = await db.collection('feedbacks')
            .orderBy('createdAt', 'desc')
            .get();

        if (snap.empty) {
            summary.textContent = 'Feedback မရှိသေးပါ။';
            container.innerHTML = '<p class="feedback-empty">User များ feedback မပေးရသေးပါ။</p>';
            return;
        }

        const total = snap.docs.length;
        const avgRating = (snap.docs.reduce((sum, d) => sum + (d.data().rating || 0), 0) / total).toFixed(1);
        summary.textContent = `Feedback ${total} ခု — ပျမ်းမျှ rating: ${avgRating} / 5`;

        container.innerHTML = snap.docs.map(doc => {
            const data = doc.data();
            const date = data.createdAt
                ? new Date(data.createdAt.toDate()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                : '-';
            return `
                <div class="feedback-card">
                    <div class="feedback-card-header">
                        <span class="feedback-card-name">${escapeHtml(data.name)}</span>
                        <span class="feedback-card-date">${date}</span>
                    </div>
                    <div class="feedback-card-stars">${renderStars(data.rating)}</div>
                    <p class="feedback-card-comment">${escapeHtml(data.comment)}</p>
                </div>
            `;
        }).join('');
    } catch (err) {
        container.innerHTML = `<p class="feedback-empty">Error: ${escapeHtml(err.message)}</p>`;
    }
}

/* ---- Language switcher ---- */
function toggleLangMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('langMenu');
    const btn = document.getElementById('langBtn');
    const isOpen = menu.classList.contains('open');
    closeLangMenu();
    closeUserMenu();
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
    const menu = document.getElementById('langMenu');
    const btn = document.getElementById('langBtn');
    if (menu) menu.classList.remove('open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
}



/* ---- Profile ---- */
function openProfilePanel() {
    closeUserMenu();
    db.collection('users').doc(currentUser.uid).get().then(doc => {
        const data = doc.exists ? doc.data() : {};
        document.getElementById('profileFirstName').textContent = data.firstName || '-';
        document.getElementById('profileLastName').textContent = data.lastName || '-';
        document.getElementById('profileEmail').textContent = data.email || currentUser.uid || '-';
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

/* ---- Give Feedback (admin page) ---- */
let giveRating = 0;

function openGiveFeedbackPanel() {
    closeUserMenu();
    giveRating = 0;
    document.getElementById('giveFeedbackComment').value = '';
    document.querySelectorAll('#giveFeedbackStars .star').forEach(s => s.classList.remove('active'));
    document.getElementById('giveFeedbackModal').classList.add('open');
}
function closeGiveFeedbackPanel() {
    document.getElementById('giveFeedbackModal').classList.remove('open');
}
function setGiveRating(value) {
    giveRating = value;
    document.querySelectorAll('#giveFeedbackStars .star').forEach(s => {
        s.classList.toggle('active', parseInt(s.dataset.value) <= value);
    });
}
function submitGiveFeedback() {
    if (giveRating === 0) { alert('ကြယ် အနည်းဆုံး ၁ လုံး ရွေးပါ။'); return; }
    const comment = document.getElementById('giveFeedbackComment').value.trim();
    if (!comment) { alert('Comment ရေးပါ။'); return; }

    db.collection('users').doc(currentUser.uid).get().then(doc => {
        const data = doc.exists ? doc.data() : {};
        const name = `${data.firstName || ''} ${data.lastName || ''}`.trim() || currentUser.email;
        return db.collection('feedbacks').add({
            uid: currentUser.uid,
            name,
            rating: giveRating,
            comment,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }).then(() => {
        closeGiveFeedbackPanel();
        alert('Feedback ပေးပို့ပြီးပါပြီ။ ကျေးဇူးတင်ပါသည်။');
        loadFeedbacks();
    }).catch(err => alert(err.message));
}