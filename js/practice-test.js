/* ============ PRACTICE TEST PAGE ============ */

let currentUser = null;
let currentRole = 'guest';
let currentLang = 'en';
let allPracticeQuestions = [];
let testQuestions = [];
let currentQIndex = 0;
let correctCount = 0;
let testMode = null;
let selectedLessonId = null;
let selectedSublessonId = null;
let mockQuestionCount = 10;
let editingPQId = null;
let reviewData = [];
let lessonDocs = [];

/* ---- Firebase refs ---- */
const pqRef = db.collection('practiceQuestions');

/* ---- Auth ---- */
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        document.getElementById('authControls').style.display = 'flex';
        document.getElementById('userChip').style.display = 'none';
        return;
    }
    currentUser = user;
    const doc = await db.collection('users').doc(user.uid).get();
    const data = doc.exists ? doc.data() : {};
    currentRole = data.role || 'user';

    document.getElementById('authControls').style.display = 'none';
    document.getElementById('userChip').style.display = 'flex';
    document.getElementById('userEmailLabel').textContent = data.firstName || user.email;
    document.getElementById('userMenuNameLabel').textContent = data.firstName || user.email;
    document.getElementById('roleBadge').textContent = currentRole === 'admin' ? 'Admin' : 'Member';
    document.getElementById('roleBadge').classList.toggle('admin', currentRole === 'admin');

    const feedbackMenuItem = document.getElementById('feedbackMenuItem');
    if (feedbackMenuItem) feedbackMenuItem.style.display = currentRole === 'admin' ? 'flex' : 'none';
    const adminCard = document.getElementById('adminModeCard');
    if (adminCard) adminCard.style.display = currentRole === 'admin' ? 'flex' : 'none';

    if (window.location.hash === '#admin' && currentRole === 'admin') openAdminPanel();

    loadAllPracticeQuestions();
    loadLessonsForSelect();
});

/* ---- Helpers ---- */
function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}
function getLangField(field, lang) {
    if (!field) return '';
    if (typeof field === 'string') return field;
    return field[lang] || field.en || '';
}
function localized(field) { return getLangField(field, currentLang); }
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
function showOnly(id) {
    ['ptHome','ptLessonSelect','ptMockSetup','ptQuizArea','ptResult','ptAdminPanel'].forEach(s => {
        document.getElementById(s).style.display = s === id ? 'block' : 'none';
    });
}

/* ---- Load questions ---- */
function loadAllPracticeQuestions() {
    pqRef.orderBy('createdAt', 'asc').onSnapshot(snap => {
        allPracticeQuestions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    });
}

async function loadLessonsForSelect() {
    const snap = await db.collection('lessons').orderBy('order', 'asc').get();
    lessonDocs = snap.docs;
    populateLessonDropdown();
}

function populateLessonDropdown() {
    const sel = document.getElementById('pqLesson');
    if (!sel) return;
    sel.innerHTML = '<option value="">— All Lessons (Mock Exam) —</option>';
    lessonDocs.forEach(doc => {
        const title = getLangField(doc.data().title, 'en');
        sel.innerHTML += `<option value="${doc.id}">${escapeHtml(title)}</option>`;
    });
}

/* ---- Navigation ---- */
function backToHome() { showOnly('ptHome'); }
function quitTest() { if (confirm('Test ကို ထွက်မှာ သေချာလား?')) backToHome(); }

/* ---- Lesson Mode ---- */
function startLessonMode() {
    testMode = 'lesson';
    showOnly('ptLessonSelect');
    renderLessonList();
}

async function renderLessonList() {
    const container = document.getElementById('ptLessonList');
    container.innerHTML = '<p style="color:#8A9BB0; font-size:13px;">Loading...</p>';
    const snap = await db.collection('lessons').orderBy('order','asc').get();
    container.innerHTML = '';
    for (const doc of snap.docs) {
        const data = doc.data();
        const title = localized(data.title);
        const subSnap = await db.collection('lessons').doc(doc.id).collection('sublessons').orderBy('order','asc').get();
        const qCount = allPracticeQuestions.filter(q => q.lessonId === doc.id || subSnap.docs.some(s => s.id === q.lessonId)).length;

        const item = document.createElement('div');
        item.className = 'pt-lesson-item';
        item.innerHTML = `
            <h4>${escapeHtml(title)}</h4>
            <p>${qCount} မေးခွန်း</p>
            ${subSnap.empty ? '' : '<div class="pt-sublesson-list" id="sub-pt-'+doc.id+'"></div>'}
        `;
        item.onclick = (e) => {
            if (e.target.closest('.pt-sublesson-item')) return;
            if (!subSnap.empty) {
                const subList = document.getElementById('sub-pt-'+doc.id);
                if (subList) subList.style.display = subList.style.display === 'none' ? 'flex' : 'none';
            } else {
                startLessonTest(doc.id, null, title);
            }
        };
        container.appendChild(item);

        if (!subSnap.empty) {
            const subList = document.getElementById('sub-pt-'+doc.id);
            if (subList) {
                subList.style.display = 'none';
                subList.style.flexDirection = 'column';
                subSnap.docs.forEach(subDoc => {
                    const subData = subDoc.data();
                    const subTitle = localized(subData.title);
                    const subQCount = allPracticeQuestions.filter(q => q.lessonId === subDoc.id).length;
                    const subItem = document.createElement('div');
                    subItem.className = 'pt-sublesson-item';
                    subItem.innerHTML = `<i class="ti ti-book"></i> ${escapeHtml(subTitle)} <span style="margin-left:auto;font-size:11px;color:#8A9BB0;">${subQCount} Q</span>`;
                    subItem.onclick = (e) => {
                        e.stopPropagation();
                        startLessonTest(doc.id, subDoc.id, subTitle);
                    };
                    subList.appendChild(subItem);
                });
            }
        }
    }
}

function startLessonTest(lessonId, sublessonId, title) {
    selectedLessonId = lessonId;
    selectedSublessonId = sublessonId;
    const filtered = allPracticeQuestions.filter(q => q.lessonId === (sublessonId || lessonId));
    if (filtered.length === 0) {
        alert(`"${title}" အတွက် မေးခွန်း မရှိသေးပါ။`);
        return;
    }
    beginTest(shuffle(filtered));
}

/* ---- Mock Mode ---- */
function startMockMode() {
    testMode = 'mock';
    showOnly('ptMockSetup');
}
function setQuestionCount(btn) {
    document.querySelectorAll('.pt-count-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    mockQuestionCount = parseInt(btn.dataset.count);
}
function startMockExam() {
    const shuffled = shuffle(allPracticeQuestions);
    const selected = shuffled.slice(0, Math.min(mockQuestionCount, shuffled.length));
    if (selected.length === 0) {
        alert('မေးခွန်း မရှိသေးပါ — Admin ကနေ ထည့်ပေးပါ။');
        return;
    }
    beginTest(selected);
}

/* ---- Begin test ---- */
function beginTest(questions) {
    testQuestions = questions;
    currentQIndex = 0;
    correctCount = 0;
    reviewData = [];
    showOnly('ptQuizArea');
    renderQuestion();
}

function renderQuestion() {
    const q = testQuestions[currentQIndex];
    const total = testQuestions.length;

    document.getElementById('ptProgressFill').style.width = `${(currentQIndex / total) * 100}%`;
    document.getElementById('ptProgressLabel').textContent = `${currentQIndex + 1} / ${total}`;
    document.getElementById('ptScoreLive').textContent = `✓ ${correctCount}`;
    document.getElementById('ptNextBtn').style.display = 'none';
    document.getElementById('ptExplanation').style.display = 'none';

    const imgWrap = document.getElementById('ptQImgWrap');
    const img = document.getElementById('ptQImg');
    if (q.imageUrl) {
        img.src = q.imageUrl;
        imgWrap.style.display = 'block';
    } else {
        imgWrap.style.display = 'none';
    }

    document.getElementById('ptQText').textContent = localized(q.text);

    const optContainer = document.getElementById('ptOptions');
    optContainer.innerHTML = '';
    const shuffledOptions = shuffle(q.options.map((o, i) => ({ ...o, origIndex: i })));
    shuffledOptions.forEach(opt => {
        const text = localized(opt.text);
        const isTrue = text.includes('True') || text.includes('○');
        const div = document.createElement('div');
        div.className = 'pt-option';
        div.innerHTML = `
            <span>${isTrue ? '○' : '×'}</span>
            <span class="pt-option-label">${isTrue ? 'True' : 'False'}</span>
        `;
        div.onclick = () => selectOption(div, opt.isCorrect, q);
        optContainer.appendChild(div);
    });
}

function selectOption(selectedDiv, isCorrect, q) {
    document.querySelectorAll('.pt-option').forEach(d => {
        d.classList.add('disabled');
        d.onclick = null;
    });

    document.querySelectorAll('.pt-option').forEach(d => {
        const label = d.querySelector('.pt-option-label').textContent;
        const matchingOpt = q.options.find(o => {
            const t = localized(o.text);
            return (label === 'True' && (t.includes('True') || t.includes('○'))) ||
                   (label === 'False' && (t.includes('False') || t.includes('×')));
        });
        if (matchingOpt && matchingOpt.isCorrect) d.classList.add('correct');
    });

    if (isCorrect) {
        selectedDiv.classList.add('correct');
        correctCount++;
    } else {
        selectedDiv.classList.add('wrong');
    }

    const explanation = localized(q.explanation);
    if (explanation) {
        document.getElementById('ptExplanationText').textContent = explanation;
        document.getElementById('ptExplanation').style.display = 'block';
    }

    reviewData.push({
        q,
        isCorrect,
        selectedText: selectedDiv.querySelector('.pt-option-label').textContent
    });
    document.getElementById('ptNextBtn').style.display = 'flex';
    document.getElementById('ptScoreLive').textContent = `✓ ${correctCount}`;
}

function nextQuestion() {
    currentQIndex++;
    if (currentQIndex >= testQuestions.length) {
        showResult();
    } else {
        renderQuestion();
    }
}

/* ---- Result ---- */
function showResult() {
    showOnly('ptResult');
    const total = testQuestions.length;
    const pct = Math.round((correctCount / total) * 100);
    const passed = pct >= 80;

    document.getElementById('ptResultIcon').textContent = passed ? '🎉' : '📝';
    document.getElementById('ptResultTitle').textContent = passed ? 'Congratulations!' : 'Keep Practicing!';
    document.getElementById('ptResultScore').textContent = `${pct}% (${correctCount}/${total} မှန်ကန်)`;

    document.getElementById('ptResultBreakdown').innerHTML = `
        <div class="pt-breakdown-item">
            <span class="pt-breakdown-num correct">${correctCount}</span>
            <span class="pt-breakdown-label">မှန်</span>
        </div>
        <div class="pt-breakdown-item">
            <span class="pt-breakdown-num wrong">${total - correctCount}</span>
            <span class="pt-breakdown-label">မှား</span>
        </div>
        <div class="pt-breakdown-item">
            <span class="pt-breakdown-num total">${total}</span>
            <span class="pt-breakdown-label">စုစုပေါင်း</span>
        </div>
    `;

    const review = document.getElementById('ptResultReview');
    review.innerHTML = `<h4 style="font-family:'Poppins',sans-serif;font-size:15px;font-weight:600;color:#2B2A1F;margin-bottom:10px;">မေးခွန်းပြန်လည်စစ်ဆေးခြင်း</h4>`;
    reviewData.forEach((item, idx) => {
        const correctOpt = item.q.options.find(o => o.isCorrect);
        review.innerHTML += `
            <div class="pt-review-item ${item.isCorrect ? 'correct' : 'wrong'}">
                <p class="pt-review-q">${idx+1}. ${escapeHtml(localized(item.q.text))}</p>
                <p class="pt-review-a">
                    သင့်အဖြေ: ${escapeHtml(item.selectedText)}<br>
                    ${!item.isCorrect ? `မှန်ကန်သောအဖြေ: ${escapeHtml(localized(correctOpt?.text))}` : ''}
                    ${localized(item.q.explanation) ? `<br><em>${escapeHtml(localized(item.q.explanation))}</em>` : ''}
                </p>
            </div>
        `;
    });
}

function retryTest() {
    if (testMode === 'mock') startMockExam();
    else if (selectedLessonId) startLessonTest(selectedLessonId, selectedSublessonId, '');
}

/* ---- Admin Panel ---- */
function openAdminPanel() {
    if (currentRole !== 'admin') return;
    showOnly('ptAdminPanel');
    loadAdminQuestionList();
}

let selectedTFAnswer = null;

function selectTF(value) {
    selectedTFAnswer = value;
    document.getElementById('pqTrue').classList.remove('selected-true', 'selected-false');
    document.getElementById('pqFalse').classList.remove('selected-true', 'selected-false');
    if (value === 'true') {
        document.getElementById('pqTrue').classList.add('selected-true');
    } else {
        document.getElementById('pqFalse').classList.add('selected-false');
    }
}

function resetPQForm() {
    editingPQId = null;
    selectedTFAnswer = null;
    document.getElementById('pqTrue').classList.remove('selected-true', 'selected-false');
    document.getElementById('pqFalse').classList.remove('selected-true', 'selected-false');
    document.getElementById('pqText').value = '';
    document.getElementById('pqImage').value = '';
    document.getElementById('pqExplain').value = '';
    document.getElementById('pqLesson').value = '';
    document.getElementById('pqSaveBtn').textContent = 'Add Question';
}

function savePracticeQuestion() {
    const text = document.getElementById('pqText').value.trim();
    const explanation = document.getElementById('pqExplain').value.trim();
    const imageUrl = document.getElementById('pqImage').value.trim();
    const lessonId = document.getElementById('pqLesson').value;

    if (!text) { alert('မေးခွန်း ဖြည့်ပါ။'); return; }
    if (!explanation) { alert('Explanation ဖြည့်ပါ။'); return; }
    if (!selectedTFAnswer) { alert('○ True သို့ × False ကို ရွေးပါ။'); return; }

    const options = [
        { text: { en: '○ True' }, isCorrect: selectedTFAnswer === 'true' },
        { text: { en: '× False' }, isCorrect: selectedTFAnswer === 'false' }
    ];

    const payload = {
        text: { en: text },
        explanation: { en: explanation },
        options,
        ...(imageUrl ? { imageUrl } : {}),
        ...(lessonId ? { lessonId } : {})
    };

    const action = editingPQId
        ? pqRef.doc(editingPQId).update(payload)
        : pqRef.add({ ...payload, createdAt: firebase.firestore.FieldValue.serverTimestamp() });

    action.then(() => {
        resetPQForm();
        loadAdminQuestionList();
    }).catch(err => alert(err.message));
}

function loadAdminQuestionList() {
    const container = document.getElementById('ptAdminList');
    container.innerHTML = '<p style="color:#8A9BB0;font-size:13px;">Loading...</p>';

    pqRef.orderBy('createdAt', 'asc').get().then(snap => {
        if (snap.empty) {
            container.innerHTML = '<p style="color:#8A9BB0;font-size:13px;">မေးခွန်း မရှိသေးပါ။</p>';
            return;
        }
        container.innerHTML = '';
        snap.docs.forEach(doc => {
            const data = doc.data();
            const lessonTitle = data.lessonId
                ? (lessonDocs.find(d => d.id === data.lessonId) ? getLangField(lessonDocs.find(d => d.id === data.lessonId).data().title, 'en') : data.lessonId)
                : 'Mock Exam';
            const card = document.createElement('div');
            card.className = 'pt-admin-q-card';
            card.innerHTML = `
                <div style="flex:1;">
                    <p class="pt-admin-q-text">${escapeHtml(getLangField(data.text, 'en'))}</p>
                    <p class="pt-admin-q-lesson">${escapeHtml(lessonTitle)}</p>
                </div>
                <div class="q-admin-actions">
                    <button class="q-icon-btn" onclick="editPracticeQuestion('${doc.id}')"><i class="ti ti-pencil"></i></button>
                    <button class="q-icon-btn danger" onclick="deletePracticeQuestion('${doc.id}')"><i class="ti ti-trash"></i></button>
                </div>
            `;
            container.appendChild(card);
        });
    });
}

function editPracticeQuestion(id) {
    pqRef.doc(id).get().then(doc => {
        if (!doc.exists) return;
        const data = doc.data();
        editingPQId = id;
        document.getElementById('pqText').value = getLangField(data.text, 'en');
        document.getElementById('pqExplain').value = getLangField(data.explanation, 'en');
        document.getElementById('pqImage').value = data.imageUrl || '';
        document.getElementById('pqLesson').value = data.lessonId || '';
        document.getElementById('pqSaveBtn').textContent = 'Save Changes';

        const trueOpt = data.options && data.options.find(o => {
            const t = getLangField(o.text, 'en');
            return t.includes('True') || t.includes('○');
        });
        selectTF(trueOpt && trueOpt.isCorrect ? 'true' : 'false');

        document.getElementById('ptAdminFormBox').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

function deletePracticeQuestion(id) {
    if (!confirm('ဒီမေးခွန်းကို ဖျက်မှာ သေချာလား?')) return;
    pqRef.doc(id).delete().then(() => loadAdminQuestionList()).catch(err => alert(err.message));
}

/* ---- User menu shared functions ---- */
function toggleLangMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('langMenu');
    const btn = document.getElementById('langBtn');
    const isOpen = menu.classList.contains('open');
    closeUserMenu();
    menu.classList.toggle('open', !isOpen);
    btn.setAttribute('aria-expanded', String(!isOpen));
}
function selectLang(code, label, el) {
    currentLang = code;
    document.getElementById('lang-label').textContent = label;
    document.querySelectorAll('.lang-menu li').forEach(li => li.classList.remove('selected'));
    el.classList.add('selected');
    closeLangMenu();
}
function closeLangMenu() {
    const m = document.getElementById('langMenu');
    const b = document.getElementById('langBtn');
    if (m) m.classList.remove('open');
    if (b) b.setAttribute('aria-expanded','false');
}
function toggleUserMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('userMenu');
    const btn = document.getElementById('userTrigger');
    const isOpen = menu.classList.contains('open');
    closeLangMenu();
    menu.classList.toggle('open', !isOpen);
    btn.setAttribute('aria-expanded', String(!isOpen));
}
function closeUserMenu() {
    const m = document.getElementById('userMenu');
    const b = document.getElementById('userTrigger');
    if (m) m.classList.remove('open');
    if (b) b.setAttribute('aria-expanded','false');
}
function handleLogout() {
    auth.signOut().then(() => window.location.href = '../index.html');
}
document.addEventListener('click', (e) => {
    const ls = document.querySelector('.lang-switcher');
    if (ls && !ls.contains(e.target)) closeLangMenu();
    const uc = document.querySelector('.user-chip');
    if (uc && !uc.contains(e.target)) closeUserMenu();
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeLangMenu(); closeUserMenu(); closeProfilePanel(); closeFeedbackPanel(); }
});

/* ---- Profile ---- */
function openProfilePanel() {
    closeUserMenu();
    document.getElementById('profileEditForm').style.display = 'none';
    document.getElementById('profileViewActions').style.display = 'flex';
    document.getElementById('profileBody').style.display = 'flex';
    loadProfileData();
    document.getElementById('profileOverlay').classList.add('open');
}
function closeProfilePanel() {
    document.getElementById('profileOverlay').classList.remove('open');
}
function loadProfileData() {
    db.collection('users').doc(currentUser.uid).get().then(doc => {
        const data = doc.exists ? doc.data() : {};
        document.getElementById('profileFirstName').textContent = data.firstName || '-';
        document.getElementById('profileLastName').textContent = data.lastName || '-';
        document.getElementById('profileEmail').textContent = data.email || currentUser.email || '-';
        document.getElementById('profileBirthday').textContent = data.birthday || '-';
        document.getElementById('profileRole').textContent = data.role === 'admin' ? 'Admin' : 'Member';
    });
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
    loadProfileData();
}
function saveEditProfile() {
    const firstName = document.getElementById('editFirstName').value.trim();
    const lastName = document.getElementById('editLastName').value.trim();
    const birthday = document.getElementById('editBirthday').value;
    if (!firstName) { alert('First name ကိုဖြည့်ပါ။'); return; }
    db.collection('users').doc(currentUser.uid).update({ firstName, lastName, birthday }).then(() => {
        const el = document.getElementById('userEmailLabel');
        const nl = document.getElementById('userMenuNameLabel');
        if (el) el.textContent = firstName || currentUser.email;
        if (nl) nl.textContent = firstName || currentUser.email;
        cancelEditProfile();
        alert('Profile ပြင်ဆင်ပြီးပါပြီ။');
    }).catch(err => alert(err.message));
}

/* ---- Feedback ---- */
let feedbackRating = 0;
function openFeedbackPanel() {
    closeUserMenu();
    feedbackRating = 0;
    document.getElementById('feedbackComment').value = '';
    document.querySelectorAll('#feedbackStars .star').forEach(s => s.classList.remove('active'));
    document.getElementById('feedbackModal').classList.add('open');
}
function closeFeedbackPanel() {
    document.getElementById('feedbackModal').classList.remove('open');
}
function setRating(value) {
    feedbackRating = value;
    document.querySelectorAll('#feedbackStars .star').forEach(s => {
        s.classList.toggle('active', parseInt(s.dataset.value) <= value);
    });
}
function submitFeedback() {
    if (feedbackRating === 0) { alert('ကြယ် အနည်းဆုံး ၁ လုံး ရွေးပါ။'); return; }
    const comment = document.getElementById('feedbackComment').value.trim();
    if (!comment) { alert('Comment ရေးပါ။'); return; }
    db.collection('users').doc(currentUser.uid).get().then(doc => {
        const data = doc.exists ? doc.data() : {};
        const name = `${data.firstName||''} ${data.lastName||''}`.trim() || currentUser.email;
        return db.collection('feedbacks').add({
            uid: currentUser.uid, name, rating: feedbackRating, comment,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }).then(() => { closeFeedbackPanel(); alert('Feedback ပေးပို့ပြီးပါပြီ။ ကျေးဇူးတင်ပါသည်။'); })
    .catch(err => alert(err.message));
}