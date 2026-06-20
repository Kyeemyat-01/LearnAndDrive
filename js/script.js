/* Language switcher (dropdown choice list) */
function toggleLangMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('langMenu');
    const btn = document.getElementById('langBtn');
    const isOpen = menu.classList.contains('open');
    menu.classList.toggle('open', !isOpen);
    btn.setAttribute('aria-expanded', String(!isOpen));
}

let currentLang = 'en';

function selectLang(code, label, el) {
    currentLang = code;
    document.getElementById('lang-label').textContent = label;
    document.querySelectorAll('.lang-menu li').forEach(li => li.classList.remove('selected'));
    el.classList.add('selected');
    closeLangMenu();
    renderQuizQuestions(lastSnapshotDocs);
    renderLessonList(lastLessonDocs);
    if (currentLessonSlug) watchLesson(currentLessonSlug);
}

function closeLangMenu() {
    document.getElementById('langMenu').classList.remove('open');
    document.getElementById('langBtn').setAttribute('aria-expanded', 'false');
}

/* Close on Escape */
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closeModal();
        closeLangMenu();
        closeUserMenu();
    }
});

/* Active nav link */
function setActive(e, el) {
    e.preventDefault();
    document.querySelectorAll('.ld-nav a').forEach(a => a.classList.remove('active'));
    el.classList.add('active');
}

/* Quiz toggle */
    function toggleAnswer(qId) {
      const box = document.getElementById(qId);
      const icon = document.getElementById(qId + '-icon');
      const isOpen = box.classList.contains('open');
      box.classList.toggle('open', !isOpen);
      icon.innerHTML = isOpen
        ? '<i class="ti ti-plus"></i>'
        : '<i class="ti ti-minus"></i>';
    }

/* Modal open / close */
function openModal(mode) {
    authMode = mode;
    document.getElementById('firstName').value = '';
    document.getElementById('lastName').value = '';
    document.getElementById('email').value = '';
    document.getElementById('birthday').value = '';
    document.getElementById('password').value = '';

    const modal = document.getElementById('authModal');
    const title = document.getElementById('modalTitle');
    const nameFields = document.getElementById('nameFields');
    const birthdayField = document.getElementById('birthdayField');

    if (mode === 'signup') {
        title.textContent = 'Create your account';
        document.querySelector('.modal-sub').textContent = 'Start your driving journey today — it\'s free.';
        document.querySelector('.modal-submit').textContent = 'Sign up';
        document.querySelector('.modal-footer').innerHTML = 'Already have an account? <a onclick="openModal(\'login\')">Log in</a>';
        nameFields.style.display = 'flex';
        birthdayField.style.display = 'block';
    }
    else {
        title.textContent = 'Welcome back';
        document.querySelector('.modal-sub').textContent = 'Sign in to continue your driving journey.';
        document.querySelector('.modal-submit').textContent = 'Log in';
        document.querySelector('.modal-footer').innerHTML = 'No account? <a onclick="switchToSignup()">Sign up free</a>';
        nameFields.style.display = 'none';
        birthdayField.style.display = 'none';
    }
    modal.classList.add('open');
}

function closeModal() {
    document.getElementById('authModal').classList.remove('open');
}

function handleOverlayClick(e) {
    if (e.target === document.getElementById('authModal')) closeModal();
}

function switchToSignup() { openModal('signup'); }

/*   Select lessons   */

const lessonsRef = db.collection('lessons');
let currentLessonSlug = null;
let unsubscribeCurrentLesson = null;
let editingLessonId = null;
let lessonListLoaded = false;
let lastLessonDocs = [];

/* ---- Sidebar: Firestore ကနေ dynamic render ---- */
lessonsRef.onSnapshot(snapshot => {
    const docs = snapshot.docs.slice().sort((a, b) => (a.data().order ?? 0) - (b.data().order ?? 0));
    lastLessonDocs = docs;
    renderLessonList(docs);

    if (!lessonListLoaded) {
        lessonListLoaded = true;
        const savedSlug = localStorage.getItem('ld_selected_lesson');
        if (savedSlug && docs.some(d => d.id === savedSlug)) {
            const li = document.querySelector(`.lesson-item[data-lesson="${savedSlug}"]`);
            if (li) li.classList.add('active');
            currentLessonSlug = savedSlug;
            watchLesson(savedSlug);
        }
    }
});

function renderLessonList(docs) {
    const list = document.getElementById('lessonListContainer');
    if (!list) return;
    const activeSlug = document.querySelector('.lesson-item.active')?.dataset.lesson;

    list.innerHTML = docs.map((doc, idx) => {
        const data = doc.data();
        const isActive = doc.id === activeSlug ? ' active' : '';
        return `
            <li class="lesson-item${isActive}" data-lesson="${doc.id}" onclick="selectLesson(this)">
                <span class="num">${String(idx + 1).padStart(2, '0')}</span>
                <div class="icon-wrap"><i class="ti ${data.icon || 'ti-book'}"></i></div>
                <span class="item-text">${escapeHtml(localized(data.title))}</span>
            </li>
        `;
    }).join('');
}

/* ---- Lesson content (live-updating) ---- */
function selectLesson(el) {
    if (currentRole === 'guest') {
        openModal('login');
        return;
    }
    document.querySelectorAll('.lesson-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    const slug = el.dataset.lesson;
    currentLessonSlug = slug;
    localStorage.setItem('ld_selected_lesson', slug);
    watchLesson(slug);
    toggleSidebar(false);
}

function watchLesson(slug) {
    if (unsubscribeCurrentLesson) unsubscribeCurrentLesson();

    if (currentRole === 'guest') {
        renderGuestWelcome();
        return;
    }

    const box = document.getElementById('lessonContent');
    box.innerHTML = '<p class="lesson-loading">Loading...</p>';

    unsubscribeCurrentLesson = lessonsRef.doc(slug).onSnapshot(doc => {
        if (!doc.exists) {
            box.innerHTML = `<p class="lesson-empty">ဒီ Lesson ကို ဖျက်ပစ်ပြီးပါပြီ။</p>`;
            return;
        }
        const data = doc.data();
        let images = data.images || [];
        if (!images.length && data.imageUrl) {
            images = [{ url: data.imageUrl, size: 'large' }];
        }

        const bodyHtml = localized(data.body);
        const usedIndices = getUsedImageIndices(bodyHtml);
        const remainingImages = images.filter((img, idx) => !usedIndices.has(idx));
        const bodyWithImages = renderBodyWithImages(bodyHtml, images);

        box.innerHTML = `
            <div class="lesson-title-row">
                <h2 class="lesson-title">${escapeHtml(localized(data.title))}</h2>
                ${currentRole === 'admin' ? `
                <div class="q-admin-actions">
                    <button class="q-icon-btn" title="ပြင်ဆင်" onclick="editLesson('${doc.id}')"><i class="ti ti-pencil"></i></button>
                    <button class="q-icon-btn danger" title="ဖျက်" onclick="deleteLesson('${doc.id}')"><i class="ti ti-trash"></i></button>
                </div>` : ''}
            </div>
            ${renderLessonImages(remainingImages)}
            <div class="lesson-body">${bodyWithImages}</div>
        `;
    }, err => {
        box.innerHTML = `<p class="lesson-empty">Error: ${escapeHtml(err.message)}</p>`;
    });
}

function renderGuestWelcome() {
    const box = document.getElementById('lessonContent');
    box.innerHTML = `
        <div class="lesson-locked">
            <div class="lesson-locked-icon"><i class="ti ti-steering-wheel"></i></div>
            <h2 class="lesson-locked-title">Learn&amp;Drive နဲ့ စာမေးပွဲကို ပြင်ဆင်ပါ</h2>
            <p class="lesson-locked-text">
                Traffic signs, road rules, quiz အပြည့်အစုံကို lesson ၁၂ ခုနဲ့ ခွဲခြားပေးထားပါတယ်။
                Lesson အပြည့်အစုံကို ကြည့်ရှု၊ quiz ဖြေဆိုနိုင်ရန် အကောင့်တစ်ခု အခမဲ့ ဖွင့်လိုက်ပါ။
            </p>
            <button class="lesson-locked-cta" onclick="openModal('signup')">Sign up free</button>
            <p class="lesson-locked-alt">အကောင့်ရှိပြီးသားလား? <a onclick="openModal('login')">Log in</a></p>
        </div>
    `;
}

/* ---- Composer: add / edit ---- */
function openLessonComposer() {
    editingLessonId = null;
    document.getElementById('newLessonTitle').value = '';
    document.getElementById('newLessonBody').value = '';
    clearImageRows();
    document.getElementById('lessonSaveBtn').textContent = 'Save lesson';
    document.getElementById('lessonFormBox').style.display = 'flex';
    document.getElementById('lessonFormBox').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function closeLessonComposer() {
    document.getElementById('lessonFormBox').style.display = 'none';
    editingLessonId = null;
}

function editLesson(id) {
    lessonsRef.doc(id).get().then(doc => {
        if (!doc.exists) return;
        const data = doc.data();
        editingLessonId = id;
        document.getElementById('newLessonTitle').value = getLangField(data.title, 'en');
        document.getElementById('newLessonBody').value = getLangField(data.body, 'en');
        clearImageRows();
        (data.images || []).forEach(img => addImageRow(img.url, img.size, img.caption || ''));
        if (!data.images && data.imageUrl) {
            addImageRow(data.imageUrl, 'large');
        }
        document.getElementById('lessonSaveBtn').textContent = 'Save changes';
        document.getElementById('lessonFormBox').style.display = 'flex';
        document.getElementById('lessonFormBox').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
}
function deleteLesson(id) {
    if (!confirm('ဒီ Lesson ကို ဖျက်မှာ သေချာပါသလား?')) return;
    lessonsRef.doc(id).delete().catch(err => alert(err.message));
}

function saveLessonForm() {
    const title = document.getElementById('newLessonTitle').value.trim();
    const body = document.getElementById('newLessonBody').value.trim();
    const images = collectImageRows();

    if (!title || !body) {
        alert('Title နဲ့ Content ကိုဖြည့်ပါ။');
        return;
    }

    const saveBtn = document.getElementById('lessonSaveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    let titleObj = { en: title };
    let bodyObj = { en: body };

    if (editingLessonId) {
        const existing = lastLessonDocs.find(d => d.id === editingLessonId);
        if (existing) {
            const data = existing.data();
            titleObj = { ...(typeof data.title === 'object' ? data.title : {}), en: title };
            bodyObj = { ...(typeof data.body === 'object' ? data.body : {}), en: body };
        }
    }

    const action = editingLessonId
        ? lessonsRef.doc(editingLessonId).update({
            title: titleObj,
            body: bodyObj,
            images,
            imageUrl: firebase.firestore.FieldValue.delete()
        })
        : lessonsRef.add({
            title: titleObj,
            body: bodyObj,
            images,
            order: Date.now(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

    action.then(() => {
        closeLessonComposer();
    }).catch(err => {
        alert(err.message);
    }).finally(() => {
        saveBtn.disabled = false;
        saveBtn.textContent = editingLessonId ? 'Save changes' : 'Save lesson';
    });
}

function addImageRow(url = '', size = 'medium', caption = '') {
    const list = document.getElementById('lessonImagesList');
    const row = document.createElement('div');
    row.className = 'lesson-image-row-edit';
    row.innerHTML = `
        <div class="lesson-image-row-edit-main">
            <input type="text" class="lesson-image-url" placeholder="https://example.com/sign.png" value="${escapeHtml(url)}" />
            <select class="lesson-image-size">
                <option value="small" ${size === 'small' ? 'selected' : ''}>Small</option>
                <option value="medium" ${size === 'medium' ? 'selected' : ''}>Medium</option>
                <option value="large" ${size === 'large' ? 'selected' : ''}>Large</option>
            </select>
            <button type="button" class="lesson-image-insert" title="Content ထဲ ညှပ်ထည့်ရန်" onclick="insertImagePlaceholder(this)"><i class="ti ti-photo-plus"></i></button>
            <button type="button" class="lesson-image-remove" onclick="this.closest('.lesson-image-row-edit').remove()"><i class="ti ti-x"></i></button>
        </div>
        <input type="text" class="lesson-image-caption-input" placeholder="Caption (e.g. Stop sign)" value="${escapeHtml(caption)}" />
    `;
    list.appendChild(row);
}

function collectImageRows() {
    return Array.from(document.querySelectorAll('#lessonImagesList .lesson-image-row-edit')).map(row => ({
        url: row.querySelector('.lesson-image-url').value.trim(),
        size: row.querySelector('.lesson-image-size').value,
        caption: row.querySelector('.lesson-image-caption-input').value.trim()
    })).filter(img => img.url);
}

function clearImageRows() {
    document.getElementById('lessonImagesList').innerHTML = '';
}

function renderLessonImages(images) {
    if (!images || !images.length) return '';
    let html = '';
    let i = 0;
    while (i < images.length) {
        if (images[i].size !== 'large') {
            let group = [];
            while (i < images.length && images[i].size !== 'large') {
                group.push(images[i]);
                i++;
            }
            html += `<div class="lesson-image-row">` +
                group.map(img => renderSingleImage(img)).join('') +
                `</div>`;
        } else {
            html += renderSingleImage(images[i]);
            i++;
        }
    }
    return html;
}

function renderSingleImage(img) {
    const captionHtml = img.caption
        ? `<figcaption class="lesson-image-caption">${escapeHtml(img.caption)}</figcaption>`
        : '';
    return `
        <figure class="lesson-image-figure lesson-image-${img.size}">
            <img class="lesson-image" src="${img.url}" alt="${escapeHtml(img.caption || '')}" />
            ${captionHtml}
        </figure>
    `;
}

function getUsedImageIndices(bodyHtml) {
    const matches = bodyHtml.match(/\{\{img(\d+)\}\}/g) || [];
    return new Set(matches.map(m => parseInt(m.match(/\d+/)[0], 10) - 1));
}

function renderBodyWithImages(bodyHtml, images) {
    if (!images || !images.length) return bodyHtml;
    return bodyHtml.replace(/(\{\{img\d+\}\}(\s*\{\{img\d+\}\})*)/g, (match) => {
        const indices = match.match(/\d+/g).map(n => parseInt(n, 10));
        const imgs = indices.map(idx => images[idx - 1]).filter(Boolean);
        if (!imgs.length) return '';
        if (imgs.length === 1) {
            return renderSingleImage(imgs[0]);
        }
        return `<div class="lesson-image-row">` +
            imgs.map(img => renderSingleImage(img)).join('') +
            `</div>`;
    });
}

function insertImagePlaceholder(button) {
    const row = button.closest('.lesson-image-row-edit');
    const allRows = Array.from(document.querySelectorAll('#lessonImagesList .lesson-image-row-edit'));
    const index = allRows.indexOf(row) + 1;
    const textarea = document.getElementById('newLessonBody');
    const placeholder = `{{img${index}}}`;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    textarea.value = text.slice(0, start) + placeholder + text.slice(end);
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + placeholder.length;
}

/* ============ AUTH + ADMIN ROLE + QUIZ (Firestore) ============ */
const usersRef = db.collection('users');
const quizRef  = db.collection('quizQuestions');

let currentUser  = null;
let currentRole  = 'guest';      // 'guest' | 'user' | 'admin'
let authMode     = 'login';
let editingQuestionId = null;
let pendingAnswer = true;
let lastSnapshotDocs = [];

/* ---- Auth state ---- */
auth.onAuthStateChanged(async (user) => {
    currentUser = user;

    if (user) {
        const doc = await usersRef.doc(user.uid).get();
        const data = doc.exists ? doc.data() : {};
        currentRole = data.role || 'user';

        document.getElementById('authControls').style.display = 'none';
        document.getElementById('userChip').style.display = 'flex';
        document.getElementById('userEmailLabel').textContent = data.firstName || user.email;
        document.getElementById('userMenuNameLabel').textContent = data.firstName || user.email;
        document.getElementById('roleBadge').textContent = currentRole === 'admin' ? 'Admin' : 'Member';
        document.getElementById('roleBadge').classList.toggle('admin', currentRole === 'admin');
    } else {
        currentRole = 'guest';
        document.getElementById('authControls').style.display = 'flex';
        document.getElementById('userChip').style.display = 'none';
        renderGuestWelcome();
    }

    document.getElementById('addBox').style.display = currentRole === 'admin' ? 'block' : 'none';
    document.getElementById('lessonAddTrigger').style.display = currentRole === 'admin' ? 'inline-flex' : 'none';
    document.querySelector('.quiz-section').style.display = currentRole === 'guest' ? 'none' : 'block';
    if (currentLessonSlug) watchLesson(currentLessonSlug);
});

function handleAuthSubmit() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
        alert('Email နဲ့ Password ကိုဖြည့်ပါ။');
        return;
    }

    if (authMode === 'signup') {
        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const birthday = document.getElementById('birthday').value;

        if (!firstName || !lastName || !birthday) {
            alert('First name, Last name, Birthday ကိုဖြည့်ပါ။');
            return;
        }

        auth.createUserWithEmailAndPassword(email, password)
            .then(cred => usersRef.doc(cred.user.uid).set({
                email,
                firstName,
                lastName,
                birthday,
                role: 'user',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }))
            .then(() => closeModal())
            .catch(err => alert(err.message));
    } else {
        auth.signInWithEmailAndPassword(email, password)
            .then(() => closeModal())
            .catch(err => alert(err.message));
    }
}

function handleLogout() {
    auth.signOut();
}

function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then(result => {
            const user = result.user;
            const isNewUser = result.additionalUserInfo && result.additionalUserInfo.isNewUser;
            if (isNewUser) {
                const nameParts = (user.displayName || '').trim().split(' ');
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ') || '';
                return usersRef.doc(user.uid).set({
                    email: user.email,
                    firstName,
                    lastName,
                    role: 'user',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        })
        .then(() => closeModal())
        .catch(err => alert(err.message));
}

/* ---- Render questions from Firestore ---- */
quizRef.orderBy('createdAt', 'asc').onSnapshot(snapshot => {
    lastSnapshotDocs = snapshot.docs;
    renderQuizQuestions(lastSnapshotDocs);
});

function renderQuizQuestions(docs) {
    const container = document.getElementById('quizListContainer');
    if (!container) return;
    container.innerHTML = '';
    docs.forEach(doc => {
        const entry = doc.data();
        entry.id = doc.id;
        container.appendChild(buildQuestionCard(entry));
    });
    renumberQuestions();
}

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}

function getLangField(field, lang) {
    if (!field) return '';
    if (typeof field === 'string') return field; // ဟောင်းတဲ့ plain-string document တွေအတွက် fallback
    return field[lang] || field.en || '';
}

function localized(field) {
    return getLangField(field, currentLang);
}

function buildQuestionCard(entry) {
    const verdictClass = entry.answer ? 'correct' : 'wrong';
    const verdictIcon  = entry.answer ? 'ti-circle' : 'ti-x';
    const card = document.createElement('div');
    card.className = 'q-box';
    card.id = entry.id;
    card.innerHTML = `
        <div class="q-header">
            <span class="q-badge">Q</span>
            ${entry.imageUrl ? `<div class="q-img-wrap"><img src="${entry.imageUrl}" alt="" /></div>` : ''}
            <p class="q-text">${escapeHtml(localized(entry.text))}</p>
            ${currentRole === 'admin' ? `
            <div class="q-admin-actions">
                <button class="q-icon-btn" title="ပြင်ဆင်" onclick="startEditQuestion('${entry.id}')"><i class="ti ti-pencil"></i></button>
                <button class="q-icon-btn danger" title="ဖျက်" onclick="deleteQuestion('${entry.id}')"><i class="ti ti-trash"></i></button>
            </div>` : ''}
        </div>
        <div class="q-answer-btn" onclick="toggleAnswer('${entry.id}')">
            <span class="btn-label">Answer</span>
            <span class="btn-icon" id="${entry.id}-icon"><i class="ti ti-plus"></i></span>
        </div>
        <div class="q-answer-panel" id="${entry.id}-panel">
            <span class="verdict ${verdictClass}"><i class="ti ${verdictIcon}"></i></span>
            <p>${escapeHtml(localized(entry.explanation))}</p>
        </div>
    `;
    return card;
}

function renumberQuestions() {
    document.querySelectorAll('.quiz-grid .q-box:not(.add-box) .q-badge').forEach((badge, idx) => {
        badge.textContent = 'Q' + (idx + 1);
    });
}

/* ---- Composer: add + edit ---- */
function setAnswer(val) {
    pendingAnswer = val;
    document.getElementById('trueOpt').classList.toggle('active', val);
    document.getElementById('falseOpt').classList.toggle('active', !val);
}

function resetAddForm() {
    document.getElementById('newQuestionText').value = '';
    document.getElementById('newQuestionExplain').value = '';
    setAnswer(true);
    editingQuestionId = null;
    document.querySelector('#addForm .add-post').textContent = 'Save question';
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
    const chip = document.querySelector('.user-chip');
    if (chip && !chip.contains(e.target)) closeUserMenu();
});

function toggleAddForm(forceOpen) {
    const box = document.getElementById('addBox');
    const isOpen = box.classList.contains('open');
    const open = typeof forceOpen === 'boolean' ? forceOpen : !isOpen;
    box.classList.toggle('open', open);
    document.getElementById('addToggleIcon').innerHTML = open
        ? '<i class="ti ti-chevron-up"></i>'
        : '<i class="ti ti-chevron-down"></i>';
    if (!open) resetAddForm();
}

let sidebarScrollY = 0;

function toggleSidebar(forceOpen) {
    const sidebar = document.querySelector('.ld-sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    const isOpen = sidebar.classList.contains('open');
    const open = typeof forceOpen === 'boolean' ? forceOpen : !isOpen;
    sidebar.classList.toggle('open', open);
    backdrop.classList.toggle('open', open);

    if (open) {
        sidebarScrollY = window.scrollY || document.documentElement.scrollTop;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${sidebarScrollY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
    } else {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        window.scrollTo(0, sidebarScrollY);
    }
}

function startEditQuestion(id) {
    const doc = lastSnapshotDocs.find(d => d.id === id);
    if (!doc) return;
    const data = doc.data();

    editingQuestionId = id;
    document.getElementById('newQuestionText').value = getLangField(data.text, 'en');
    document.getElementById('newQuestionExplain').value = getLangField(data.explanation, 'en');
    setAnswer(!!data.answer);
    document.querySelector('#addForm .add-post').textContent = 'Save changes';

    toggleAddForm(true);
    document.getElementById('addBox').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function deleteQuestion(id) {
    if (!confirm('ဒီမေးခွန်းကို ဖျက်မှာ သေချာပါသလား?')) return;
    quizRef.doc(id).delete().catch(err => alert(err.message));
}

function postQuestion() {
    const text = document.getElementById('newQuestionText').value.trim();
    const explanation = document.getElementById('newQuestionExplain').value.trim();

    if (!text || !explanation) {
        alert('Question နဲ့ Explanation ကိုဖြည့်ပါ။');
        return;
    }

    let textObj = { en: text };
    let explanationObj = { en: explanation };

    if (editingQuestionId) {
        const doc = lastSnapshotDocs.find(d => d.id === editingQuestionId);
        if (doc) {
            const data = doc.data();
            textObj = { ...(typeof data.text === 'object' ? data.text : {}), en: text };
            explanationObj = { ...(typeof data.explanation === 'object' ? data.explanation : {}), en: explanation };
        }
    }

    const payload = { text: textObj, answer: pendingAnswer, explanation: explanationObj };

    const action = editingQuestionId
        ? quizRef.doc(editingQuestionId).update(payload)
        : quizRef.add({ ...payload, createdAt: firebase.firestore.FieldValue.serverTimestamp() });

    action.then(() => toggleAddForm(false)).catch(err => alert(err.message));
}

/* ---- One-time migration: Q1, Q2, Q3 ကို Firestore ထဲထည့်ရန် ----
   admin အကောင့်နဲ့ login ဝင်ထားပြီး browser console (F12) မှာ
   seedInitialQuestions() ကိုရိုက်ပြီး Enter နှိပ်ပါ — တစ်ခါသာ run ပါ။ */
function seedInitialQuestions() {
    const base = new Date(2020, 0, 1).getTime();
    const initial = [
        {
            text: { en: 'A stop sign requires drivers to come to a complete stop even when no other vehicles or pedestrians are visible.' },
            answer: true,
            explanation: { en: 'A stop sign always requires a full stop, regardless of whether other road users are esent. Failing to stop fully is a traffic violation.' }
        },
        {
            text: { en: 'A triangular sign with a red border means the driver must stop immediately.' },
            answer: false,
            explanation: { en: 'Red-bordered triangles are warning signs — they alert you to a hazard ahead (curves, crossings, etc.). They do not require you to stop.' }
        },
        {
            text: { en: "This sign indicates a school or children's crossing zone and requires drivers to reduce speed and proceed with caution." },
            answer: true,
            explanation: { en: 'This sign marks areas where children may be crossing. Drivers must slow down and be ready to stop for pedestrians at any moment.' },
            imageUrl: 'https://cdn-01-au-prod.media-brady.com/media/catalog/product/cache/f3020b7489dcfc4d1d147cf4dad07b7f/y/5/y595288_2.png'
        }
    ];

    initial.forEach((q, i) => {
        quizRef.add({
            ...q,
            createdAt: firebase.firestore.Timestamp.fromDate(new Date(base + i * 1000))
        });
    });
    console.log('Seed ပြီးပါပြီ။');
}




window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        toggleSidebar(false);
    }
});






//   ------- Footer --------
document.getElementById('footerYear').textContent = new Date().getFullYear();