/* =====================================================================
   KERALA PSC — SHARED MOCK TEST ENGINE
   Expects on each page:
     window.PART_KEY      e.g. 'keralaHistory'
     window.PART_TITLE    e.g. 'Kerala History'
     window.QUESTIONS     array of question objects
   ===================================================================== */

(function () {
  "use strict";

  const DEFAULT_NEGATIVE_MARK = 0.33;
  const PART_KEY = window.PART_KEY || 'default';
  const STORAGE_KEY = 'kpsc_mock_' + PART_KEY;
  const SUMMARY_KEY = 'kpsc_summaries_v1';
  const questions = window.QUESTIONS || [];

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function shuffle(arr){
    const a = arr.slice();
    for(let i = a.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const BY_ID = {};
  questions.forEach(q => { BY_ID[q.id] = q; });
  const Q_ORDER = shuffle(questions.map(q => q.id));
  const OPT_ORDER = {};
  questions.forEach(q => { OPT_ORDER[q.id] = shuffle(q.options.map((_, i) => i)); });

  let state = {
    answers: {},
    bookmarks: {},
    settings: { negative: DEFAULT_NEGATIVE_MARK, category: 'ALL', topic: 'ALL', difficulty: 'ALL' },
    activeSet: 'all'
  };

  let pool = [];
  let cur = 0;

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return;
      const s = JSON.parse(raw);
      if(s && typeof s === 'object'){
        state.answers   = s.answers   || {};
        state.bookmarks = s.bookmarks || {};
        Object.assign(state.settings, s.settings || {});
      }
    }catch(e){ console.warn('Could not load saved progress:', e); }
  }

  function saveState(){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        answers: state.answers,
        bookmarks: state.bookmarks,
        settings: state.settings
      }));
      const summaries = JSON.parse(localStorage.getItem(SUMMARY_KEY) || '{}');
      const s = computeStats(questions);
      summaries[PART_KEY] = {
        total: s.total,
        attempted: s.attempted,
        correct: s.correct,
        wrong: s.wrong,
        net: s.net
      };
      localStorage.setItem(SUMMARY_KEY, JSON.stringify(summaries));
    }catch(e){ console.warn('Could not save progress:', e); }
  }

  function computeStats(list){
    let attempted = 0, correct = 0, wrong = 0;
    list.forEach(q => {
      const a = state.answers[q.id];
      if(a){ attempted++; a.ok ? correct++ : wrong++; }
    });
    const total = list.length;
    const remaining = total - attempted;
    const negativeMarks = wrong * Number(state.settings.negative || 0);
    const net = correct - negativeMarks;
    const accuracy = attempted ? (correct / attempted) * 100 : 0;
    return { total, attempted, correct, wrong, remaining, negativeMarks, net, accuracy };
  }

  function currentPool(){
    let list = Q_ORDER.map(id => BY_ID[id]);
    const s = state.settings;
    if(s.category !== 'ALL')   list = list.filter(q => q.category === s.category);
    if(s.topic !== 'ALL')      list = list.filter(q => q.topic === s.topic);
    if(s.difficulty !== 'ALL') list = list.filter(q => q.difficulty === s.difficulty);
    if(state.activeSet === 'wrong')      list = list.filter(q => state.answers[q.id] && !state.answers[q.id].ok);
    if(state.activeSet === 'unanswered') list = list.filter(q => !state.answers[q.id]);
    if(state.activeSet === 'bookmarked') list = list.filter(q => state.bookmarks[q.id]);
    if(state.activeSet === 'difficult')  list = list.filter(q => q.difficulty === 'Hard' || q.difficulty === 'Very Hard');
    return list;
  }

  function refreshPool(keepId){
    const prevId = keepId || (pool[cur] ? pool[cur].id : null);
    pool = currentPool();
    if(!pool.length){ cur = 0; }
    else{
      const idx = pool.findIndex(q => q.id === prevId);
      cur = idx >= 0 ? idx : 0;
    }
    renderAll();
  }

  const LETTERS = ['A','B','C','D'];

  function diffClass(d){
    return {'Easy':'easy','Medium':'medium','Hard':'hard','Very Hard':'veryhard'}[d] || 'medium';
  }
  function diffIcon(d){
    return {'Easy':'🟢','Medium':'🟡','Hard':'🟠','Very Hard':'🔴'}[d] || '🟡';
  }
  function tagClass(cat){
    return cat === '573' ? 'c573' : cat === '883' ? 'c883' : 'both';
  }

  function renderQuestion(){
    const host = $('#qcard');
    if(!pool.length){
      host.innerHTML = '<div class="empty">No questions match the current filter. Change the filters, or use ' +
                       '<b>Revision → Practise All Questions</b> to reset.</div>';
      return;
    }
    const q = pool[cur];
    const ans = state.answers[q.id];
    const order = OPT_ORDER[q.id];

    let optsHtml = '';
    order.forEach((origIdx, pos) => {
      let cls = 'option';
      let verdict = '';
      if(ans){
        if(origIdx === q.answer){
          cls += ' correct';
          verdict = '<span class="vtag ok">✓ Correct</span>';
        }
        if(origIdx === ans.sel && !ans.ok){
          cls += ' wrong';
          verdict = '<span class="vtag bad">✗ Wrong</span>';
        }
      }
      optsHtml += '<button class="' + cls + '" data-orig="' + origIdx + '"' + (ans ? ' disabled' : '') + '>' +
                  '<span class="optkey">' + LETTERS[pos] + '</span>' +
                  '<span class="opttext">' + esc(q.options[origIdx]) + '</span>' + verdict +
                  '</button>';
    });

    let feedback = '';
    if(ans){
      const notesHtml = order.map((origIdx, pos) =>
        '<li><b>' + LETTERS[pos] + '. ' + esc(q.options[origIdx]) + '</b> — ' + esc(q.optionNotes[origIdx]) + '</li>'
      ).join('');
      const remaining = pool.filter(x => !state.answers[x.id]).length;
      const nextLabel = remaining > 0 ? 'NEXT QUESTION →' : 'FINISH TEST';
      feedback =
        '<div class="feedback ' + (ans.ok ? 'ok' : 'bad') + '">' +
          '<div class="fbhead">' + (ans.ok ? '✅ Correct Answer' : '❌ Wrong Answer') + '</div>' +
          (ans.ok ? '' : '<div class="fbcorrect">Correct Answer: <b>' + esc(q.options[q.answer]) + '</b></div>') +
          '<div class="fbexp"><b>Explanation:</b> ' + esc(q.explanation) + '</div>' +
          '<ul class="optnotes">' + notesHtml + '</ul>' +
          '<div class="fbtools">' +
            '<button class="btn ghost" data-action="retry">🔄 Try Again</button>' +
            '<button class="btn primary" data-action="next">' + nextLabel + '</button>' +
          '</div>' +
        '</div>';
    }

    host.innerHTML =
      '<div class="qmeta">' +
        '<span class="pill">Q' + (cur + 1) + ' / ' + pool.length + '</span>' +
        '<span class="pill">' + esc(q.topic) + '</span>' +
        '<span class="tag ' + tagClass(q.category) + '">' + q.category + '</span>' +
        '<span class="diff ' + diffClass(q.difficulty) + '">' + diffIcon(q.difficulty) + ' ' + q.difficulty + '</span>' +
        '<button class="bookmark ' + (state.bookmarks[q.id] ? 'on' : '') + '" data-action="bookmark" ' +
          'aria-label="Bookmark this question">' +
          (state.bookmarks[q.id] ? '⭐ Bookmarked' : '☆ Bookmark') +
        '</button>' +
      '</div>' +
      '<div class="qtext">' + esc(q.question) + '</div>' +
      '<div class="options">' + optsHtml + '</div>' +
      feedback;
  }

  function renderNav(){
    const grid = $('#navgrid');
    if(!pool.length){ grid.innerHTML = ''; return; }
    grid.innerHTML = pool.map((q, i) => {
      const a = state.answers[q.id];
      const cls = a ? (a.ok ? 'ok' : 'bad') : '';
      const mark = a ? (a.ok ? '✓' : '✗') : '—';
      return '<button class="navbtn ' + cls + (i === cur ? ' active' : '') + '" data-i="' + i + '" ' +
             'aria-label="Go to question ' + (i + 1) + '">' + (i + 1) +
             '<span class="nm">' + mark + '</span></button>';
    }).join('');
  }

  function updateScore(){
    const s = computeStats(pool);
    $('#sbScore').textContent = s.net.toFixed(2) + ' / ' + s.total;
    $('#sbAtt').textContent   = s.attempted;
    $('#sbCor').textContent   = s.correct;
    $('#sbWr').textContent    = s.wrong;
    $('#sbRem').textContent   = s.remaining;
    $('#sbAcc').textContent   = s.accuracy.toFixed(1) + '%';
    $('#progressbar').style.width = (s.total ? (s.attempted / s.total) * 100 : 0) + '%';
  }

  function renderSetInfo(){
    const names = { all:'All Questions', wrong:'Wrong Questions', unanswered:'Unanswered Questions',
                    bookmarked:'Bookmarked Questions', difficult:'Difficult Questions (Hard / Very Hard)' };
    const el = $('#setInfo');
    const s = computeStats(pool);
    el.innerHTML = '<b>Current set:</b> ' + names[state.activeSet] +
                   ' &nbsp;•&nbsp; ' + s.total + ' question(s) &nbsp;•&nbsp; Negative mark: ' +
                   Number(state.settings.negative).toFixed(2);
  }

  function renderAll(){
    renderQuestion();
    renderNav();
    updateScore();
    renderSetInfo();
  }

  function selectOption(qid, origIdx){
    if(state.answers[qid]) return;
    const q = BY_ID[qid];
    const ok = (origIdx === q.answer);
    state.answers[qid] = { sel: origIdx, ok: ok };
    saveState();
    renderAll();
  }

  function toggleBookmark(qid){
    if(state.bookmarks[qid]) delete state.bookmarks[qid];
    else state.bookmarks[qid] = true;
    saveState();
    renderAll();
  }

  function goNext(){
    if(!pool.length) return;
    for(let i = cur + 1; i < pool.length; i++){
      if(!state.answers[pool[i].id]){ cur = i; renderAll(); scrollToCard(); return; }
    }
    for(let i = 0; i < cur; i++){
      if(!state.answers[pool[i].id]){ cur = i; renderAll(); scrollToCard(); return; }
    }
    finishTest();
  }

  function scrollToCard(){
    const el = $('#qcard');
    if(el) el.scrollIntoView({ behavior:'smooth', block:'start' });
  }

  function finishTest(){ showView('result'); }

  function showView(name){
    $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
    $$('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    if(name === 'result')    renderResult();
    if(name === 'bookmarks') renderBookmarks();
    if(name === 'revision')  renderRevision();
    if(name === 'test')      renderAll();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderResult(){
    const host = $('#resultHost');
    const s = computeStats(pool);
    if(!s.total){
      host.innerHTML = '<div class="viewhead"><h2>📊 RESULT</h2><p class="hint">No questions in the current set.</p></div>';
      return;
    }
    const correctPct = (s.correct / s.total) * 100;
    const wrongPct   = (s.wrong / s.total) * 100;
    const unansPct   = (s.remaining / s.total) * 100;

    let reviewHtml = pool.map((q, i) => {
      const a = state.answers[q.id];
      const status = !a ? 'none' : (a.ok ? 'ok' : 'bad');
      const statusText = !a ? '⚪ Unanswered' : (a.ok ? '✅ Correct' : '❌ Wrong');
      const yourAns = a ? q.options[a.sel] : '—';
      return '<div class="revcard ' + status + '">' +
        '<div class="rq">Q' + (i + 1) + '. ' + esc(q.question) + '</div>' +
        '<div class="line"><b>Your answer:</b> ' + esc(yourAns) + '</div>' +
        '<div class="line"><b>Correct answer:</b> ' + esc(q.options[q.answer]) + '</div>' +
        '<div class="line"><b>Explanation:</b> ' + esc(q.explanation) + '</div>' +
        '<div class="line status ' + status + '">Status: ' + statusText + '</div>' +
      '</div>';
    }).join('');

    host.innerHTML =
      '<div class="resultcard">' +
        '<h2>TEST RESULT</h2>' +
        '<div class="statgrid">' +
          '<div class="stat"><span class="k">Total Questions</span><span class="v">' + s.total + '</span></div>' +
          '<div class="stat"><span class="k">Attempted</span><span class="v">' + s.attempted + '</span></div>' +
          '<div class="stat"><span class="k">Correct</span><span class="v">' + s.correct + '</span></div>' +
          '<div class="stat"><span class="k">Wrong</span><span class="v">' + s.wrong + '</span></div>' +
          '<div class="stat"><span class="k">Unanswered</span><span class="v">' + s.remaining + '</span></div>' +
          '<div class="stat"><span class="k">Positive Marks</span><span class="v">' + s.correct + '</span></div>' +
          '<div class="stat"><span class="k">Negative Marks</span><span class="v">−' + s.negativeMarks.toFixed(2) + '</span></div>' +
          '<div class="stat"><span class="k">Accuracy</span><span class="v">' + s.accuracy.toFixed(2) + '%</span></div>' +
        '</div>' +
        '<div class="final">Final Score: <b>' + s.net.toFixed(2) + ' / ' + s.total + '</b></div>' +
        '<div class="perf">' +
          '<h4>Performance</h4>' +
          perfRow('Correct', correctPct, '#177a3d') +
          perfRow('Wrong', wrongPct, '#c5221f') +
          perfRow('Unanswered', unansPct, '#8a94a6') +
        '</div>' +
      '</div>' +
      '<h3>Review Answers</h3>' +
      '<div class="reviewlist">' + reviewHtml + '</div>';
  }

  function perfRow(label, pct, color){
    return '<div class="perfrow"><span class="lbl">' + label + '</span>' +
           '<span class="bar"><i style="width:' + pct.toFixed(2) + '%;background:' + color + '"></i></span>' +
           '<span class="pct">' + pct.toFixed(1) + '%</span></div>';
  }

  function renderBookmarks(){
    const host = $('#bookmarkList');
    const ids = Object.keys(state.bookmarks).filter(id => state.bookmarks[id]);
    if(!ids.length){
      host.innerHTML = '<p class="empty">No bookmarked questions yet. Tap ☆ Bookmark on any question to save it here.</p>';
      return;
    }
    host.innerHTML = ids.map(id => {
      const q = BY_ID[id];
      if(!q) return '';
      return '<div class="bmcard">' +
        '<div class="bmq">' + esc(q.question) + '</div>' +
        '<div class="bmmeta">' +
          '<span class="pill">' + esc(q.topic) + '</span>' +
          '<span class="tag ' + tagClass(q.category) + '">' + q.category + '</span>' +
          '<span class="diff ' + diffClass(q.difficulty) + '">' + diffIcon(q.difficulty) + ' ' + q.difficulty + '</span>' +
        '</div>' +
        '<div class="bmans">Answer: ' + esc(q.options[q.answer]) + '</div>' +
        '<div class="bmtools">' +
          '<button class="btn ghost" data-open="' + id + '">Open in Test</button>' +
          '<button class="btn ghost" data-remove="' + id + '">Remove ⭐</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function renderRevision(){
    const wrong      = questions.filter(q => state.answers[q.id] && !state.answers[q.id].ok).length;
    const unanswered = questions.filter(q => !state.answers[q.id]).length;
    const bookmarked = Object.keys(state.bookmarks).filter(id => state.bookmarks[id]).length;
    const difficult  = questions.filter(q => q.difficulty === 'Hard' || q.difficulty === 'Very Hard').length;

    $('#setgrid').innerHTML =
      setCard('wrong', wrong, 'Wrong Questions') +
      setCard('unanswered', unanswered, 'Unanswered Questions') +
      setCard('bookmarked', bookmarked, 'Bookmarked Questions') +
      setCard('difficult', difficult, 'Difficult Questions');

    function setCard(set, num, label){
      return '<div class="setcard">' +
        '<div class="num">' + num + '</div>' +
        '<div class="lbl">' + label + '</div>' +
        '<button class="btn primary" data-set="' + set + '">Practice</button>' +
      '</div>';
    }
  }

  function doSearch(term){
    const host = $('#searchResults');
    term = (term || '').trim().toLowerCase();
    if(term.length < 2){
      host.innerHTML = '<p class="empty">Type at least 2 characters to search notes and questions.</p>';
      return;
    }
    const noteBlocks = $$('.note-block');
    const noteHits = noteBlocks.filter(nb => nb.textContent.toLowerCase().includes(term));
    const qHits = questions.filter(q =>
      (q.question + ' ' + q.options.join(' ') + ' ' + q.topic + ' ' + q.subject + ' ' + q.explanation)
        .toLowerCase().includes(term)
    );

    let html = '';
    html += '<h3>📚 Notes (' + noteHits.length + ')</h3>';
    if(noteHits.length){
      html += noteHits.map(nb =>
        '<div class="sres" data-note="' + nb.id + '">' +
          '<div class="st">' + esc(nb.dataset.title || 'Note') + '</div>' +
          '<div class="ss">' + snippet(nb.textContent, term) + '</div>' +
        '</div>'
      ).join('');
    } else {
      html += '<p class="empty">No matching notes.</p>';
    }

    html += '<h3 style="margin-top:1rem">📝 Questions (' + qHits.length + ')</h3>';
    if(qHits.length){
      html += qHits.map(q =>
        '<div class="sres" data-qid="' + q.id + '">' +
          '<div class="st">' + esc(q.question) + '</div>' +
          '<div class="ss">' + esc(q.topic) + ' • ' + q.category + ' • ' + q.difficulty +
            ' • Answer: ' + esc(q.options[q.answer]) + '</div>' +
        '</div>'
      ).join('');
    } else {
      html += '<p class="empty">No matching questions.</p>';
    }

    host.innerHTML = html;
  }

  function snippet(text, term){
    const t = text.replace(/\s+/g, ' ').trim();
    const i = t.toLowerCase().indexOf(term);
    if(i < 0) return esc(t.slice(0, 140)) + '…';
    const start = Math.max(0, i - 60);
    const end = Math.min(t.length, i + term.length + 90);
    return (start > 0 ? '…' : '') + esc(t.slice(start, end)) + (end < t.length ? '…' : '');
  }

  function bindUI(){
    $$('#tabs button').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));

    $('#startMcqBtn').addEventListener('click', () => {
      state.activeSet = 'all';
      resetFilters();
      refreshPool();
      showView('test');
    });

    $$('.chip[data-cat]').forEach(chip => {
      chip.addEventListener('click', () => {
        state.settings.category = chip.dataset.cat;
        $$('.chip[data-cat]').forEach(c => c.classList.toggle('active', c === chip));
        saveState();
        refreshPool();
      });
    });

    $('#topicFilter').addEventListener('change', e => {
      state.settings.topic = e.target.value;
      saveState();
      refreshPool();
    });
    $('#diffFilter').addEventListener('change', e => {
      state.settings.difficulty = e.target.value;
      saveState();
      refreshPool();
    });

    $('#negInput').addEventListener('change', e => {
      let v = parseFloat(e.target.value);
      if(isNaN(v) || v < 0) v = 0;
      state.settings.negative = v;
      e.target.value = v;
      saveState();
      updateScore();
      renderSetInfo();
    });

    $('#resetBtn').addEventListener('click', () => {
      if(confirm('Delete all saved answers, bookmarks and settings for THIS part? This cannot be undone.')){
        localStorage.removeItem(STORAGE_KEY);
        state.answers = {};
        state.bookmarks = {};
        state.settings = { negative: DEFAULT_NEGATIVE_MARK, category:'ALL', topic:'ALL', difficulty:'ALL' };
        state.activeSet = 'all';
        $('#negInput').value = DEFAULT_NEGATIVE_MARK;
        $('#topicFilter').value = 'ALL';
        $('#diffFilter').value = 'ALL';
        $$('.chip[data-cat]').forEach(c => c.classList.toggle('active', c.dataset.cat === 'ALL'));
        saveState();
        refreshPool();
        alert('Progress reset.');
      }
    });

    $('#finishBtn').addEventListener('click', finishTest);

    $('#qcard').addEventListener('click', e => {
      const opt = e.target.closest('.option');
      if(opt && !opt.disabled){
        selectOption(pool[cur].id, Number(opt.dataset.orig));
        return;
      }
      const btn = e.target.closest('[data-action]');
      if(!btn) return;
      const action = btn.dataset.action;
      if(action === 'bookmark'){ toggleBookmark(pool[cur].id); }
      if(action === 'retry'){
        delete state.answers[pool[cur].id];
        saveState();
        renderAll();
      }
      if(action === 'next'){ goNext(); }
    });

    $('#navgrid').addEventListener('click', e => {
      const btn = e.target.closest('.navbtn');
      if(!btn) return;
      cur = Number(btn.dataset.i);
      renderAll();
      scrollToCard();
    });

    document.addEventListener('click', e => {
      const setBtn = e.target.closest('[data-set]');
      if(setBtn){
        const set = setBtn.dataset.set;
        state.activeSet = (set === 'reset') ? 'all' : set;
        resetFilters();
        refreshPool();
        showView('test');
        return;
      }
      const openBtn = e.target.closest('[data-open]');
      if(openBtn){
        const id = Number(openBtn.dataset.open);
        state.activeSet = 'bookmarked';
        resetFilters();
        pool = currentPool();
        cur = Math.max(0, pool.findIndex(q => q.id === id));
        renderAll();
        showView('test');
        return;
      }
      const removeBtn = e.target.closest('[data-remove]');
      if(removeBtn){
        delete state.bookmarks[Number(removeBtn.dataset.remove)];
        saveState();
        renderBookmarks();
        return;
      }
      const noteHit = e.target.closest('[data-note]');
      if(noteHit){
        const nb = document.getElementById(noteHit.dataset.note);
        if(nb){
          showView('notes');
          let parent = nb.parentElement;
          while(parent){
            if(parent.tagName === 'DETAILS') parent.open = true;
            parent = parent.parentElement;
          }
          nb.open = true;
          setTimeout(() => {
            nb.scrollIntoView({ behavior:'smooth', block:'center' });
            nb.classList.add('flash');
            setTimeout(() => nb.classList.remove('flash'), 1300);
          }, 120);
        }
        return;
      }
      const qHit = e.target.closest('[data-qid]');
      if(qHit){
        const id = Number(qHit.dataset.qid);
        state.activeSet = 'all';
        resetFilters();
        pool = currentPool();
        cur = Math.max(0, pool.findIndex(q => q.id === id));
        renderAll();
        showView('test');
        return;
      }
    });

    let searchTimer = null;
    $('#searchInput').addEventListener('input', e => {
      clearTimeout(searchTimer);
      const val = e.target.value;
      searchTimer = setTimeout(() => doSearch(val), 180);
    });
    $('#clearSearch').addEventListener('click', () => {
      $('#searchInput').value = '';
      doSearch('');
    });

    document.addEventListener('keydown', e => {
      if(!$('#view-test').classList.contains('active')) return;
      const tag = (e.target.tagName || '').toUpperCase();
      if(tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if(['1','2','3','4'].includes(e.key)){
        const btns = $$('#qcard .option');
        const i = Number(e.key) - 1;
        if(btns[i] && !btns[i].disabled) btns[i].click();
      }
      if(e.key === 'ArrowRight') goNext();
    });
  }

  function resetFilters(){
    state.settings.category = 'ALL';
    state.settings.topic = 'ALL';
    state.settings.difficulty = 'ALL';
    $$('.chip[data-cat]').forEach(c => c.classList.toggle('active', c.dataset.cat === 'ALL'));
    const tf = $('#topicFilter'); if(tf) tf.value = 'ALL';
    const df = $('#diffFilter');  if(df) df.value = 'ALL';
    saveState();
  }

  function buildTopicOptions(){
    const topics = Array.from(new Set(questions.map(q => q.topic))).sort();
    const sel = $('#topicFilter');
    topics.forEach(t => {
      const o = document.createElement('option');
      o.value = t; o.textContent = t;
      sel.appendChild(o);
    });
  }

  function init(){
    loadState();
    $('#negInput').value = state.settings.negative;
    $('#diffFilter').value = state.settings.difficulty || 'ALL';
    $$('.chip[data-cat]').forEach(c =>
      c.classList.toggle('active', c.dataset.cat === (state.settings.category || 'ALL'))
    );

    buildTopicOptions();
    $('#topicFilter').value = state.settings.topic || 'ALL';

    $$('.note-block').forEach((nb, i) => { if(!nb.id) nb.id = 'note-' + (i + 1); });

    bindUI();

    pool = currentPool();
    cur = 0;
    renderAll();
    doSearch('');
  }

  document.addEventListener('DOMContentLoaded', init);
})();