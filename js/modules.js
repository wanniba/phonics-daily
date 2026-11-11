/* modules.js —— 首页左侧「模块」用到的数据：目标、读过的书、「要再练」清单、（预留）贴纸
 * 负责：目标默认值与读写、读过的书、要再练的汇总（小测薄弱音 + 预留的「说」卡词）、贴纸的存取接口。
 * 不负责：界面（app.js）、每天的勾（today.js）、小测记录（quiz.js）。
 * 存储（读写一律 try/catch，存不了照常用）：
 *   phonics.goals.v1   = { read: 4 本/月, listen: 5 天/周, say: 5 天/周, write: 5 天/周 }
 *   phonics.books.v1   = [ { d: "YYYY-MM-DD", t: "书名（可空，家长补）" } ]
 *   phonics.review.v1  = { words: [ { w: "cat", streak: 0, d: "YYYY-MM-DD", src: "say" } ] }
 *                        ← 第二期：「说」卡点「不像」的词写在这里；这一期只读不写，界面已经会把它并进「要再练」
 *   phonics.stickers.v1 = [ { id, kind, d, ref } ]   ← 第二期：贴纸；这一期只有存取接口，没有界面
 */
(function (G) {
  "use strict";
  const Cur = G.Curriculum,
    Quiz = G.Quiz;
  const K_GOALS = "phonics.goals.v1",
    K_BOOKS = "phonics.books.v1",
    K_REVIEW = "phonics.review.v1",
    K_STICKERS = "phonics.stickers.v1";

  function lget(k) {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  }
  function lset(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {
      /* 存不了也照常用 */
    }
  }
  function load(k, fallback) {
    try {
      const v = JSON.parse(lget(k) || "null");
      return v === null || v === undefined ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  // ==== 目标（家长面板里可改）====
  const GOAL_DEFAULT = { read: 4, listen: 5, say: 5, write: 5 };
  const GOAL_MAX = { read: 31, listen: 7, say: 7, write: 7 };
  let goals = Object.assign({}, GOAL_DEFAULT);
  (function () {
    const g = load(K_GOALS, {});
    Object.keys(GOAL_DEFAULT).forEach(function (k) {
      if (g && g[k] >= 1 && g[k] <= GOAL_MAX[k]) goals[k] = Math.round(g[k]);
    });
  })();
  function goal(k) {
    return goals[k];
  }
  function setGoal(k, v) {
    if (!(k in GOAL_DEFAULT)) return;
    v = Math.round(+v);
    goals[k] = v >= 1 && v <= GOAL_MAX[k] ? v : GOAL_DEFAULT[k];
    lset(K_GOALS, goals);
  }

  // ==== 读过的书 ====
  let books = load(K_BOOKS, []);
  if (!Array.isArray(books)) books = [];
  books = books.filter(function (b) {
    return b && typeof b.d === "string";
  });
  function saveBooks() {
    lset(K_BOOKS, books);
  }
  function addBook(date, title) {
    books.push({ d: date, t: title || "" });
    saveBooks();
  }
  function setBookTitle(i, title) {
    if (books[i]) {
      books[i].t = title;
      saveBooks();
    }
  }
  function delBook(i) {
    if (books[i]) {
      books.splice(i, 1);
      saveBooks();
    }
  }
  // 返回 [{i: 原序号, d, t}]，新的在前
  function bookList() {
    return books
      .map(function (b, i) {
        return { i: i, d: b.d, t: b.t || "" };
      })
      .reverse();
  }
  function monthCount(dateStr) {
    const ym = dateStr.slice(0, 7);
    return books.filter(function (b) {
      return b.d.slice(0, 7) === ym;
    }).length;
  }

  // ==== 要再练：小测薄弱音 + （第二期）「说」卡里点了「不像」的词 ====
  function lessonOfUnit(id) {
    const ls = Cur.lessons;
    for (let i = 0; i < ls.length; i++)
      if (ls[i].kind === "learn" && ls[i].units.indexOf(id) >= 0) return ls[i].no;
    for (let i = 0; i < ls.length; i++)
      if (ls[i].kind === "learn" && ls[i].focus.indexOf(id) >= 0) return ls[i].no;
    return 0;
  }
  function lessonOfWord(w) {
    const ls = Cur.lessons;
    for (let i = 0; i < ls.length; i++)
      if (
        ls[i].words.some(function (x) {
          return x.text === w;
        })
      )
        return ls[i].no;
    return 0;
  }
  function reviewWords() {
    const r = load(K_REVIEW, null);
    return r && Array.isArray(r.words)
      ? r.words.filter(function (x) {
          return x && x.w;
        })
      : [];
  }
  // 清单项：{kind: 'unit'|'word', id, label, src: 'quiz'|'say', lesson: 课号（0 = 找不到）}
  function review(cur) {
    const out = [];
    Quiz.allStats(cur).forEach(function (s) {
      if (s.weak)
        out.push({
          kind: "unit",
          id: s.id,
          label: Quiz.label(s.id),
          src: "quiz",
          lesson: lessonOfUnit(s.id),
        });
    });
    reviewWords().forEach(function (x) {
      out.push({
        kind: "word",
        id: x.w,
        label: x.w,
        src: x.src || "say",
        lesson: lessonOfWord(x.w),
      });
    });
    return out;
  }
  // 第二期用：「说」卡点「不像」→ 收进来；连续「像」够了 → 移出
  function addReviewWord(w, src, dateStr) {
    const r = load(K_REVIEW, { words: [] }) || { words: [] };
    if (!Array.isArray(r.words)) r.words = [];
    const f = r.words.filter(function (x) {
      return x.w === w;
    })[0];
    if (f) f.streak = 0;
    else r.words.push({ w: w, streak: 0, d: dateStr || "", src: src || "say" });
    lset(K_REVIEW, r);
  }
  function removeReviewWord(w) {
    const r = load(K_REVIEW, { words: [] }) || { words: [] };
    r.words = (r.words || []).filter(function (x) {
      return x.w !== w;
    });
    lset(K_REVIEW, r);
  }

  // ==== 贴纸（第二期）：只有存取，没有界面 ====
  function stickers() {
    const s = load(K_STICKERS, []);
    return Array.isArray(s) ? s : [];
  }
  function addSticker(kind, ref, dateStr) {
    const s = stickers();
    s.push({ id: s.length + 1, kind: kind, d: dateStr || "", ref: ref || "" });
    lset(K_STICKERS, s);
  }

  G.Modules = {
    GOAL_DEFAULT: GOAL_DEFAULT,
    goal: goal,
    setGoal: setGoal,
    bookList: bookList,
    addBook: addBook,
    setBookTitle: setBookTitle,
    delBook: delBook,
    monthCount: monthCount,
    review: review,
    addReviewWord: addReviewWord,
    removeReviewWord: removeReviewWord,
    stickers: stickers,
    addSticker: addSticker,
  };
})(window);
