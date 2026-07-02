/* Language switcher (dropdown choice list) */
function toggleLangMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('langMenu');
    const btn = document.getElementById('langBtn');
    const isOpen = menu.classList.contains('open');
    closeUserMenu();
    menu.classList.toggle('open', !isOpen);
    btn.setAttribute('aria-expanded', String(!isOpen));
}

let currentLang = 'en';
let currentSublessonSlug = null;

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
        closeProfilePanel();
        closeFeedbackPanel();

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
    buildFlatLessonIndex(docs);

    if (!lessonListLoaded) {
    lessonListLoaded = true;
    const savedSlug = localStorage.getItem('ld_selected_lesson');
    const savedSubSlug = localStorage.getItem('ld_selected_sublesson');

    if (savedSlug && docs.some(d => d.id === savedSlug)) {
        currentLessonSlug = savedSlug;

        const lessonEl = document.querySelector(`.lesson-item[data-lesson="${savedSlug}"]`);
        if (lessonEl) {
            lessonEl.classList.add('active', 'expanded');
            const subList = document.getElementById(`sub-${savedSlug}`);
            if (subList) subList.classList.add('open');
        }

        db.collection('lessons').doc(savedSlug).collection('sublessons')
            .orderBy('order', 'asc')
            .get()
            .then(snap => {
                loadSublessons(savedSlug);

                if (!snap.empty) {
                    const targetDoc = (savedSubSlug && snap.docs.find(d => d.id === savedSubSlug))
                        ? snap.docs.find(d => d.id === savedSubSlug)
                        : snap.docs[0];

                    currentSublessonSlug = targetDoc.id;

                    setTimeout(() => {
                        const subItem = document.querySelector(`.sublesson-item[data-sublesson="${targetDoc.id}"]`);
                        if (subItem) {
                            subItem.classList.add('active');
                            selectSublesson(subItem, savedSlug, targetDoc.id);
                        }
                    }, 300);
                } else {
                    watchLesson(savedSlug);
                }
            });

        updateNoteFabVisibility();
    }
}
});

function renderLessonList(docs) {
    const list = document.getElementById('lessonListContainer');
    if (!list) return;

    list.innerHTML = '';

    docs.forEach((doc, idx) => {
        const data = doc.data();
        const isActive = doc.id === currentLessonSlug;

        const li = document.createElement('li');
        li.className = `lesson-item${isActive ? ' active' : ''}`;
        li.dataset.lesson = doc.id;
        li.onclick = () => toggleLessonExpand(li, doc.id);

        const subUl = document.createElement('ul');
        subUl.className = `sublesson-list${isActive ? ' open' : ''}`;
        subUl.id = `sub-${doc.id}`;

        db.collection('lessons').doc(doc.id).collection('sublessons')
            .limit(1)
            .get()
            .then(snap => {
                const hasSublessons = !snap.empty || currentRole === 'admin';
                li.innerHTML = `
                    <div class="icon-wrap"><i class="ti ${data.icon || 'ti-book'}"></i></div>
                    <span class="item-text">${escapeHtml(localized(data.title))}</span>
                    ${hasSublessons ? '<i class="ti ti-chevron-down lesson-expand-icon"></i>' : ''}
                `;
            });

        list.appendChild(li);
        list.appendChild(subUl);
    });
}
/* ---- Lesson content (live-updating) ---- */
function toggleLessonExpand(el, lessonId) {
    if (currentRole === 'guest') {
        openModal('login');
        return;
    }

    const isExpanded = el.classList.contains('expanded');
    const subList = document.getElementById(`sub-${lessonId}`);

    // တခြား lesson တွေ ပိတ်
    document.querySelectorAll('.lesson-item').forEach(i => {
        if (i !== el) {
            i.classList.remove('active', 'expanded');
        }
    });
    document.querySelectorAll('.sublesson-list').forEach(ul => {
        if (ul !== subList) ul.classList.remove('open');
    });

    if (isExpanded) {
        // ပွင့်နေရင် ပိတ် — active ကိုတော့ ဆက်ထား
        el.classList.remove('expanded');
        if (subList) subList.classList.remove('open');
    } else {
    el.classList.add('active', 'expanded');
    if (subList) subList.classList.add('open');

    const prevSublessonSlug = currentSublessonSlug;
    currentLessonSlug = lessonId;
    localStorage.setItem('ld_selected_lesson', lessonId);

    db.collection('lessons').doc(lessonId).collection('sublessons')
        .orderBy('order', 'asc')
        .get()
        .then(snap => {
            loadSublessons(lessonId);

            if (snap.empty) {
                currentSublessonSlug = null;
                watchLesson(lessonId);
                window.scrollTo(0, 0);
                document.documentElement.scrollTop = 0;
                document.body.scrollTop = 0;
            } else {
                // ရှိပြီးသား active sub-lesson ဒါမှမဟုတ် ပထမဆုံး sub-lesson
                const targetDoc = (prevSublessonSlug && snap.docs.find(d => d.id === prevSublessonSlug))
                    ? snap.docs.find(d => d.id === prevSublessonSlug)
                    : snap.docs[0];

                const isReopeningActive = prevSublessonSlug && prevSublessonSlug === targetDoc.id;

                setTimeout(() => {
                    const subItem = document.querySelector(`.sublesson-item[data-sublesson="${targetDoc.id}"]`);
                    if (subItem) {
                        subItem.classList.add('active');
                        if (!isReopeningActive) {
                            selectSublesson(subItem, lessonId, targetDoc.id);
                        }
                    }
                }, 300);
            }
        });
    }

    updateNoteFabVisibility();
}

function selectLesson(el) {
    if (currentRole === 'guest') {
        openModal('login');
        return;
    }
}

function watchLesson(slug) {
    if (unsubscribeCurrentLesson) unsubscribeCurrentLesson();
    renderQuizQuestions(lastSnapshotDocs);

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

/* ---- Sub-lessons ---- */
function loadSublessons(lessonId) {
    const subList = document.getElementById(`sub-${lessonId}`);
    if (!subList) return;

    db.collection('lessons').doc(lessonId).collection('sublessons')
        .orderBy('order', 'asc')
        .get()
        .then(snap => {
            if (snap.empty && currentRole !== 'admin') {
                subList.innerHTML = '';
                subList.classList.remove('open');
                return;
            }

            let html = snap.docs.map(doc => {
                const data = doc.data();
                const isActive = doc.id === currentSublessonSlug ? ' active' : '';
                return `
                    <li class="sublesson-item${isActive}"
                        data-lesson="${lessonId}"
                        data-sublesson="${doc.id}"
                        onclick="selectSublesson(this, '${lessonId}', '${doc.id}')">
                        <span class="sublesson-dot"></span>
                        <span>${escapeHtml(localized(data.title))}</span>
                        ${currentRole === 'admin' ? `
                        <div class="sublesson-admin">
                            <button class="q-icon-btn" onclick="event.stopPropagation(); editSublesson('${lessonId}','${doc.id}')"><i class="ti ti-pencil"></i></button>
                            <button class="q-icon-btn danger" onclick="event.stopPropagation(); deleteSublesson('${lessonId}','${doc.id}')"><i class="ti ti-trash"></i></button>
                        </div>` : ''}
                    </li>
                `;
            }).join('');

            if (currentRole === 'admin') {
                html += `
                    <li>
                        <button class="sublesson-add-btn" onclick="openSublessonComposer('${lessonId}')">
                            <i class="ti ti-plus"></i> Add sub-lesson
                        </button>
                    </li>
                `;
            }

            subList.innerHTML = html;
        })
        .catch(err => console.error('loadSublessons error:', err));
}

/* ---- Flat lesson index (nav အတွက်) ---- */
function buildFlatLessonIndex(docs) {
    flatLessonIndex = [];
    const promises = docs.map(doc => {
        const lessonData = doc.data();
        return db.collection('lessons').doc(doc.id).collection('sublessons')
            .orderBy('order', 'asc')
            .get()
            .then(snap => {
                if (snap.empty) {
                    flatLessonIndex.push({
                        lessonId: doc.id,
                        sublessonId: null,
                        lessonTitle: getLangField(lessonData.title, 'en'),
                        sublessonTitle: null,
                        order: lessonData.order ?? 0
                    });
                } else {
                    snap.docs.forEach(subDoc => {
                        const subData = subDoc.data();
                        flatLessonIndex.push({
                            lessonId: doc.id,
                            sublessonId: subDoc.id,
                            lessonTitle: getLangField(lessonData.title, 'en'),
                            sublessonTitle: getLangField(subData.title, 'en'),
                            order: lessonData.order ?? 0,
                            subOrder: subData.order ?? 0
                        });
                    });
                }
            });
    });

    Promise.all(promises).then(() => {
        flatLessonIndex.sort((a, b) => a.order - b.order || (a.subOrder ?? 0) - (b.subOrder ?? 0));
        updateCurrentFlatIndex();
    });
}

function updateCurrentFlatIndex() {
    if (!currentSublessonSlug && !currentLessonSlug) {
        currentFlatIndex = -1;
        updateLessonNavBar();
        return;
    }
    currentFlatIndex = flatLessonIndex.findIndex(item =>
        item.lessonId === currentLessonSlug &&
        (item.sublessonId === currentSublessonSlug || (!item.sublessonId && !currentSublessonSlug))
    );
    updateLessonNavBar();
}

function updateLessonNavBar() {
    const bar = document.getElementById('lessonNavBar');
    const prevBtn = document.getElementById('prevLessonBtn');
    const nextBtn = document.getElementById('nextLessonBtn');
    const label = document.getElementById('lessonNavLabel');

    if (!bar || currentRole === 'guest' || currentFlatIndex < 0) {
        if (bar) bar.style.display = 'none';
        return;
    }

    bar.style.display = 'flex';

    const prev = flatLessonIndex[currentFlatIndex - 1];
    const next = flatLessonIndex[currentFlatIndex + 1];

    prevBtn.disabled = !prev;
    nextBtn.disabled = !next;

    const current = flatLessonIndex[currentFlatIndex];
    label.textContent = current
        ? `${current.lessonTitle}${current.sublessonTitle ? ' › ' + current.sublessonTitle : ''}`
        : '';
}

function navigateLesson(direction) {
    const target = flatLessonIndex[currentFlatIndex + direction];
    if (!target) return;

    currentLessonSlug = target.lessonId;

    // Sidebar ထဲမှာ active ပြင်
    document.querySelectorAll('.lesson-item').forEach(i => i.classList.remove('active', 'expanded'));
    document.querySelectorAll('.sublesson-list').forEach(ul => ul.classList.remove('open'));
    document.querySelectorAll('.sublesson-item').forEach(i => i.classList.remove('active'));

    const lessonEl = document.querySelector(`.lesson-item[data-lesson="${target.lessonId}"]`);
    if (lessonEl) {
        lessonEl.classList.add('active', 'expanded');
        const subList = document.getElementById(`sub-${target.lessonId}`);
        if (subList) subList.classList.add('open');
    }

    if (target.sublessonId) {
        currentSublessonSlug = target.sublessonId;
        localStorage.setItem('ld_selected_sublesson', target.sublessonId);

        db.collection('lessons').doc(target.lessonId)
            .collection('sublessons').doc(target.sublessonId).get()
            .then(doc => {
                if (!doc.exists) return;
                const data = doc.data();
                let images = data.images || [];
                const bodyHtml = localized(data.body);
                const usedIndices = getUsedImageIndices(bodyHtml);
                const remainingImages = images.filter((img, idx) => !usedIndices.has(idx));
                const bodyWithImages = renderBodyWithImages(bodyHtml, images);
                const box = document.getElementById('lessonContent');
                box.innerHTML = `
                    <div class="lesson-title-row">
                        <h2 class="lesson-title">${escapeHtml(localized(data.title))}</h2>
                    </div>
                    ${renderLessonImages(remainingImages)}
                    <div class="lesson-body">${bodyWithImages}</div>
                `;
            });

        renderQuizQuestions(lastSnapshotDocs, target.sublessonId);
        loadSublessons(target.lessonId);
    } else {
        currentSublessonSlug = null;
        localStorage.removeItem('ld_selected_sublesson');
        watchLesson(target.lessonId);
        loadSublessons(target.lessonId);
    }

    localStorage.setItem('ld_selected_lesson', target.lessonId);
    currentFlatIndex = currentFlatIndex + direction;
    updateLessonNavBar();

    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
}

function selectSublesson(el, lessonId, sublessonId) {
    if (currentRole === 'guest') { openModal('login'); return; }

    document.querySelectorAll('.sublesson-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');

    currentSublessonSlug = sublessonId;
    localStorage.setItem('ld_selected_sublesson', sublessonId);

    const box = document.getElementById('lessonContent');
    box.innerHTML = '<p class="lesson-loading">Loading...</p>';

    db.collection('lessons').doc(lessonId).collection('sublessons').doc(sublessonId).get()
        .then(doc => {
            if (!doc.exists) {
                box.innerHTML = '<p class="lesson-empty">ဒီ sub-lesson ကို ဖျက်ပစ်ပြီးပါပြီ။</p>';
                return;
            }
            const data = doc.data();
            let images = data.images || [];
            const bodyHtml = localized(data.body);
            const usedIndices = getUsedImageIndices(bodyHtml);
            const remainingImages = images.filter((img, idx) => !usedIndices.has(idx));
            const bodyWithImages = renderBodyWithImages(bodyHtml, images);

            box.innerHTML = `
                <div class="lesson-title-row">
                    <h2 class="lesson-title">${escapeHtml(localized(data.title))}</h2>
                    ${currentRole === 'admin' ? `
                    <div class="q-admin-actions">
                        <button class="q-icon-btn" onclick="editSublesson('${lessonId}','${doc.id}')"><i class="ti ti-pencil"></i></button>
                        <button class="q-icon-btn danger" onclick="deleteSublesson('${lessonId}','${doc.id}')"><i class="ti ti-trash"></i></button>
                    </div>` : ''}
                </div>
                ${renderLessonImages(remainingImages)}
                <div class="lesson-body">${bodyWithImages}</div>
            `;
        });

    renderQuizQuestions(lastSnapshotDocs, sublessonId);
    currentFlatIndex = flatLessonIndex.findIndex(item =>
    item.lessonId === lessonId && item.sublessonId === sublessonId
    );
    updateLessonNavBar();
    updateNoteFabVisibility();
    toggleSidebar(false);
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
}

let editingSublessonId = null;
let editingSublessonParentId = null;

function openSublessonComposer(lessonId) {
    editingSublessonId = null;
    editingSublessonParentId = lessonId;
    document.getElementById('newLessonTitle').value = '';
    document.getElementById('newLessonBody').value = '';
    clearImageRows();
    document.getElementById('lessonSaveBtn').textContent = 'Post sub-lesson';
    document.getElementById('lessonFormBox').style.display = 'flex';
    document.getElementById('lessonFormBox').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function editSublesson(lessonId, sublessonId) {
    editingSublessonParentId = lessonId;
    editingSublessonId = sublessonId;

    db.collection('lessons').doc(lessonId).collection('sublessons').doc(sublessonId).get()
        .then(doc => {
            if (!doc.exists) return;
            const data = doc.data();
            document.getElementById('newLessonTitle').value = getLangField(data.title, 'en');
            document.getElementById('newLessonBody').value = getLangField(data.body, 'en');
            clearImageRows();
            (data.images || []).forEach(img => addImageRow(img.url, img.size));
            document.getElementById('lessonSaveBtn').textContent = 'Save changes';
            document.getElementById('lessonFormBox').style.display = 'flex';
            document.getElementById('lessonFormBox').scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
}

function deleteSublesson(lessonId, sublessonId) {
    if (!confirm('ဒီ sub-lesson ကို ဖျက်မှာ သေချာပါသလား?')) return;
    db.collection('lessons').doc(lessonId).collection('sublessons').doc(sublessonId)
        .delete()
        .then(() => loadSublessons(lessonId))
        .catch(err => alert(err.message));
}

/* ---- Composer: add / edit ---- */
function openLessonComposer() {
    editingLessonId = null;
    editingSublessonId = null;
    editingSublessonParentId = null;
    document.getElementById('newLessonTitle').value = '';
    document.getElementById('newLessonBody').value = '';
    clearImageRows();
    document.getElementById('lessonSaveBtn').textContent = 'Post lesson';
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

    const editingId = editingSublessonId || editingLessonId;

    if (editingId) {
        const isSublesson = !!editingSublessonId;
        const existingData = isSublesson ? null : lastLessonDocs.find(d => d.id === editingLessonId)?.data();
        if (existingData) {
            titleObj = { ...(typeof existingData.title === 'object' ? existingData.title : {}), en: title };
            bodyObj = { ...(typeof existingData.body === 'object' ? existingData.body : {}), en: body };
        }
    }

    const ref = editingSublessonParentId
        ? db.collection('lessons').doc(editingSublessonParentId).collection('sublessons')
        : lessonsRef;

    const action = editingId
        ? ref.doc(editingId).update({
            title: titleObj,
            body: bodyObj,
            images,
            imageUrl: firebase.firestore.FieldValue.delete()
        })
        : ref.add({
            title: titleObj,
            body: bodyObj,
            images,
            order: Date.now(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

    action.then(() => {
        if (editingSublessonParentId) loadSublessons(editingSublessonParentId);
        editingSublessonParentId = null;
        editingSublessonId = null;
        closeLessonComposer();
    }).catch(err => {
        alert(err.message);
    }).finally(() => {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Post lesson';
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
/* Auth စစ်နေချိန် main content ဖျောင်းထားပါ */
document.querySelector('.ld-main').style.visibility = 'hidden';

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
    const feedbackMenuItem = document.getElementById('feedbackMenuItem');
    if (feedbackMenuItem) {
        feedbackMenuItem.style.display = currentRole === 'admin' ? 'flex' : 'none';
    }
    document.querySelector('.quiz-section').style.display = currentRole === 'guest' ? 'none' : 'block';
    if (currentLessonSlug) watchLesson(currentLessonSlug);
    updateNoteFabVisibility();
    updateLessonNavBar();

    document.querySelector('.ld-main').style.visibility = 'visible';
    document.querySelector('.ld-main').style.opacity = '1';
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

function renderQuizQuestions(docs, sublessonId) {
    const container = document.getElementById('quizListContainer');
    if (!container) return;

    const targetId = sublessonId || currentSublessonSlug;

    if (!targetId) {
        container.innerHTML = '<p class="quiz-empty-hint">Sub-lesson တစ်ခု ရွေးပြီးမှ quiz မေးခွန်းများ ပေါ်ပါမည်။</p>';
        return;
    }

    const filtered = docs.filter(doc => doc.data().lessonId === targetId);
    container.innerHTML = '';
    filtered.forEach(doc => {
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
            <div class="q-content">
                ${entry.imageUrl ? `<div class="q-img-wrap"><img src="${entry.imageUrl}" alt="" /></div>` : ''}
                <p class="q-text">${escapeHtml(localized(entry.text))}</p>
            </div>
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
    document.getElementById('newQuestionImage').value = '';
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
    closeLangMenu();
    menu.classList.toggle('open', !isOpen);
    btn.setAttribute('aria-expanded', String(!isOpen));
}

function closeUserMenu() {
    document.getElementById('userMenu').classList.remove('open');
    document.getElementById('userTrigger').setAttribute('aria-expanded', 'false');
}

document.addEventListener('click', (e) => {
    const langSwitcher = document.querySelector('.lang-switcher');
    if (langSwitcher && !langSwitcher.contains(e.target)) closeLangMenu();

    const userChip = document.querySelector('.user-chip');
    if (userChip && !userChip.contains(e.target)) closeUserMenu();
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

function preventBackgroundTouch(e) {
    if (!e.target.closest('.ld-sidebar')) {
        e.preventDefault();
    }
}

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
        document.addEventListener('touchmove', preventBackgroundTouch, { passive: false });
    } else {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        window.scrollTo(0, sidebarScrollY);
        document.removeEventListener('touchmove', preventBackgroundTouch, { passive: false });
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
    document.getElementById('newQuestionImage').value = data.imageUrl || '';
    document.querySelector('#addForm .add-post').textContent = 'Save changes';

    toggleAddForm(true);
    document.getElementById('addBox').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function deleteQuestion(id) {
    if (!confirm('ဒီမေးခွန်းကို ဖျက်မှာ သေချာပါသလား?')) return;
    quizRef.doc(id).delete().catch(err => alert(err.message));
}

function postQuestion() {
    const targetLessonId = currentSublessonSlug || currentLessonSlug;

    if (!targetLessonId) {
        alert('Sub-lesson တစ်ခု ရွေးပြီးမှ မေးခွန်းထည့်နိုင်ပါမည်။');
        return;
    }

    const text = document.getElementById('newQuestionText').value.trim();
    const explanation = document.getElementById('newQuestionExplain').value.trim();
    const imageUrl = document.getElementById('newQuestionImage').value.trim();

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

    const payload = {
        text: textObj,
        answer: pendingAnswer,
        explanation: explanationObj,
        lessonId: targetLessonId
    };
    if (imageUrl) payload.imageUrl = imageUrl;

    const action = editingQuestionId
        ? quizRef.doc(editingQuestionId).update({
            ...payload,
            ...(imageUrl ? {} : { imageUrl: firebase.firestore.FieldValue.delete() })
        })
        : quizRef.add({
            ...payload,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

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

let flatLessonIndex = []; // [{lessonId, sublessonId, lessonTitle, sublessonTitle}]
let currentFlatIndex = -1;






/* ============ NOTES (per-lesson) ============ */
const notesRef = db.collection('notes');
let currentNoteId = null;

function getNoteDocId(lessonId) {
    return `${currentUser.uid}_${lessonId}`;
}

function openNotePanel() {
    if (!currentLessonSlug || currentRole === 'guest') return;
    currentNoteId = getNoteDocId(currentLessonSlug);

    const lessonDoc = lastLessonDocs.find(d => d.id === currentLessonSlug);
    document.getElementById('noteLessonTitle').textContent = lessonDoc ? getLangField(lessonDoc.data().title, 'en') : '';

    notesRef.doc(currentNoteId).get().then(doc => {
        document.getElementById('noteEditor').innerHTML = doc.exists ? (doc.data().content || '') : '';
    });

    document.getElementById('noteOverlay').classList.add('open');
}

function closeNotePanel() {
    const overlay = document.getElementById('noteOverlay');
    if (overlay) overlay.classList.remove('open');
}

function handleNoteOverlayClick(e) {
    if (e.target.id === 'noteOverlay') closeNotePanel();
}

function formatNote(command) {
    const editor = document.getElementById('noteEditor');
    restoreNoteSelection();
    editor.focus();
    document.execCommand(command, false, null);
}

let savedNoteSelection = null;
let currentNoteFontSize = 16;

function saveNoteSelection() {
    const sel = window.getSelection();
    if (sel.rangeCount > 0 && document.getElementById('noteEditor').contains(sel.anchorNode)) {
        savedNoteSelection = sel.getRangeAt(0).cloneRange();
    }
}

function restoreNoteSelection() {
    if (savedNoteSelection) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedNoteSelection);
    }
}

document.getElementById('noteEditor').addEventListener('mouseup', saveNoteSelection);
document.getElementById('noteEditor').addEventListener('keyup', saveNoteSelection);

function setNoteFontSize(px) {
    const editor = document.getElementById('noteEditor');
    restoreNoteSelection();
    editor.focus();
    document.execCommand('fontSize', false, '7');
    editor.querySelectorAll('font[size="7"]').forEach(el => {
        el.removeAttribute('size');
        el.style.fontSize = px + 'px';
    });
    document.getElementById('noteFontSizeValue').textContent = px + 'px';
}

function adjustNoteFontSize(direction) {
    currentNoteFontSize = Math.min(30, Math.max(10, currentNoteFontSize + direction * 2));
    setNoteFontSize(currentNoteFontSize);
}

function highlightNote(color) {
    const editor = document.getElementById('noteEditor');
    restoreNoteSelection();
    editor.focus();
    document.execCommand('hiliteColor', false, color);
}

function saveNote() {
    const content = document.getElementById('noteEditor').innerHTML;
    notesRef.doc(currentNoteId).set({
        uid: currentUser.uid,
        lessonId: currentLessonSlug,
        content,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        closeNotePanel();
    }).catch(err => alert(err.message));
}

function updateNoteFabVisibility() {
    const fab = document.getElementById('noteFab');
    if (!fab) return;
    fab.style.display = (currentRole !== 'guest' && currentLessonSlug) ? 'flex' : 'none';
}

function updateNoteFabPosition() {
    const fab = document.getElementById('noteFab');
    const footerEl = document.querySelector('.ld-footer');
    if (!fab || !footerEl || fab.style.display === 'none') return;
    const footerRect = footerEl.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    if (footerRect.top < viewportHeight) {
        const overlap = viewportHeight - footerRect.top;
        fab.style.bottom = `${overlap}px`;
    } else {
        fab.style.bottom = '0px';
    }
}

function setNoteFabBottomOffset() {
    const fab = document.getElementById('noteFab');
    const footerEl = document.querySelector('.ld-footer');
    if (!fab || !footerEl) return;
    fab.style.bottom = `${footerEl.offsetHeight / 3}px`;
}

setNoteFabBottomOffset();
window.addEventListener('load', setNoteFabBottomOffset);
window.addEventListener('resize', setNoteFabBottomOffset);




window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        toggleSidebar(false);
    }
})



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

/* ---- Profile Edit ---- */
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
        document.getElementById('userEmailLabel').textContent = firstName || currentUser.email;
        document.getElementById('userMenuNameLabel').textContent = firstName || currentUser.email;
        cancelEditProfile();
        alert('Profile ပြင်ဆင်ပြီးပါပြီ။');
    }).catch(err => alert(err.message));
}

function handleProfileOverlayClick(e) {
    if (e.target.id === 'profileOverlay') closeProfilePanel();
}

/* ---- Feedback ---- */
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

    const userData = { uid: currentUser.uid };
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






//   ------- Footer --------
document.getElementById('footerYear').textContent = new Date().getFullYear();