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
    const chip = document.querySelector('.user-chip');
    if (chip && !chip.contains(e.target)) closeUserMenu();
});

auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = '../index.html';
        return;
    }

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