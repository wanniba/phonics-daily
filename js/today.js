/* today.js —— 首页「今天做什么」清单的数据与规则
 * 负责：两种模式的每日清单、按天记录（localStorage）、抄写单选词、最近几周格子的数据。
 * 不负责：界面（app.js）、课程内容（curriculum.js）。
 * 存储：phonics.today.v1 = { "YYYY-MM-DD": { _m: "normal"|"self", _l: 课号, phon: true, read: true, ... } }
 *       _b: [键…] = 家长补勾的那几项（只在补勾时出现，旧记录没有也能读）
 *       phonics.today.mode.v1 = "normal" | "self"（当前模式；历史每天自带 _m，切模式不改历史）
 * 读写一律 try/catch：存不了照常用，只是刷新后不保留。
 */
(function (G) {
  "use strict";
  const Cur = G.Curriculum;
  const K_DATA = "phonics.today.v1",
    K_MODE = "phonics.today.mode.v1";

  // ==== 存储 ====
  function lget(k) {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  }
  function lset(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (e) {
      /* 存不了也照常用 */
    }
  }
  let store = {};
  try {
    store = JSON.parse(lget(K_DATA) || "{}") || {};
  } catch (e) {
    store = {};
  }
  if (typeof store !== "object" || Array.isArray(store)) store = {};
  function save() {
    lset(K_DATA, JSON.stringify(store));
  }
  let mode = lget(K_MODE) === "self" ? "self" : "normal";
  function getMode() {
    return mode;
  }
  function setMode(m) {
    mode = m === "self" ? "self" : "normal";
    lset(K_MODE, mode);
  }

  // ==== 日期（本地时间；周一 = 1 … 周日 = 7）====
  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }
  function ds(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function dowOf(d) {
    return ((d.getDay() + 6) % 7) + 1;
  }

  // ==== 每日清单 ====
  // 每项：k 记录键、ic 图标、cap 卡上的字、ac 主色、g 分段（自己带的周末：1 第一段 / 2 第二段）
  const ITEMS = {
    phon: { ic: "phon", cap: "拼读", ac: "--c-phon" },
    read: { ic: "read", cap: "读书", ac: "--c-read" },
    say: { ic: "say", cap: "说", ac: "--c-say" },
    write: { ic: "write", cap: "写", ac: "--c-write" },
    listen: { ic: "listen", cap: "听", ac: "--c-listen" },
    blocks: { ic: "blocks", cap: "语法", ac: "--c-listen" },
    search: { ic: "search", cap: "找句", ac: "--c-phon" },
    bookstar: { ic: "bookstar", cap: "新书", ac: "--c-read" },
    bookmark: { ic: "bookmark", cap: "生词", ac: "--c-read" },
    review: { ic: "review", cap: "复习", ac: "--c-write" },
    bookheart: { ic: "bookheart", cap: "陪读", ac: "--c-say" },
  };
  function plan(m, dow) {
    const P = [];
    function it(k, g, o) {
      const x = Object.assign({ k: k, g: g || 0 }, ITEMS[k], o || {});
      P.push(x);
    }
    if (m === "normal") {
      it("phon");
      it("read");
      it("say", 0, dow >= 6 ? { ic: "sayP", cap: "看图说" } : null);
      it("write", 0, dow === 5 ? { ic: "writeS", cap: "写句", sentence: true } : null);
      it("listen");
    } else if (dow <= 5) {
      it("read", 0, { cap: "读书 15 分钟" });
    } else if (dow === 6) {
      it("blocks", 1);
      it("search", 1);
      it("phon", 2);
      it("say", 2);
    } else {
      it("bookstar", 1);
      it("bookmark", 1);
      it("review", 2);
      it("write", 2, { ic: "writeS", cap: "写句", sentence: true });
      it("bookheart", 2);
    }
    return P;
  }

  // ==== 记录 ====
  function rec(date) {
    return store[date] || null;
  }
  function isDone(date, k) {
    const r = rec(date);
    return !!(r && r[k] === true);
  }
  function doneCount(date, P) {
    return P.filter(function (x) {
      return isDone(date, x.k);
    }).length;
  }
  function allDone(date, P) {
    return P.length > 0 && doneCount(date, P) === P.length;
  }
  // 写一个勾；_m 记下当时的模式（历史格子按它算），_l 记下当天的课号（抄写单不随「继续」往后跳）
  // opts.makeup = 家长补勾（补过去的日子）：不改那天原来的 _m，并在 _b 里记下「这一项是补的」
  function set(date, k, on, lessonNo, opts) {
    let r = store[date];
    if (!r || typeof r !== "object") r = store[date] = {};
    const mk = !!(opts && opts.makeup);
    if (on) r[k] = true;
    else delete r[k];
    if (!(mk && (r._m === "normal" || r._m === "self"))) r._m = mode;
    if (lessonNo && !r._l) r._l = lessonNo;
    let b = Array.isArray(r._b) ? r._b.filter(function (x) { return x !== k; }) : [];
    if (on && mk) b.push(k);
    if (b.length) r._b = b;
    else delete r._b;
    save();
  }
  function isMakeup(date, k) {
    const r = rec(date);
    return !!(r && Array.isArray(r._b) && r._b.indexOf(k) >= 0);
  }
  function lessonOf(date) {
    const r = rec(date);
    return r && r._l > 0 ? r._l : 0;
  }

  // ==== 抄写单选词：本课词里跳过复数和生僻词；不足 3 个先补已学词、再补字母 ====
  const MAX = 3;
  function isPlural(w, all) {
    return /[^s]s$/.test(w) && all.indexOf(w.slice(0, -1)) >= 0;
  }
  function usable(w, all) {
    return Cur.RARE.indexOf(w) < 0 && !isPlural(w, all);
  }
  function letterPair(u) {
    return /^[a-z]$/.test(u.g) ? u.g.toUpperCase() + u.g : null;
  }
  function pickWords(lessonNo) {
    const L = Cur.lessons[lessonNo - 1];
    if (!L) return { words: [], src: "" };
    const all = [];
    Cur.lessons.forEach(function (l) {
      l.words.forEach(function (w) {
        all.push(w.text);
      });
    });
    const out = [];
    L.words.forEach(function (w) {
      if (out.length < MAX && usable(w.text, all) && out.indexOf(w.text) < 0) out.push(w.text);
    });
    let src = "本课词";
    if (out.length < MAX) {
      // 已学词：往前翻，最近的优先
      for (let i = lessonNo - 2; i >= 0 && out.length < MAX; i--) {
        Cur.lessons[i].words.forEach(function (w) {
          if (out.length < MAX && usable(w.text, all) && out.indexOf(w.text) < 0) out.push(w.text);
        });
      }
      src = "本课词 + 补已学词";
    }
    if (out.length < MAX) {
      // 还不够：补字母（本课的新字母优先，再到学过的）
      const us = L.units.concat(L.reviewFrom);
      us.forEach(function (id) {
        const p = Cur.U[id] && letterPair(Cur.U[id]);
        if (p && out.length < MAX && out.indexOf(p) < 0) out.push(p);
      });
      src = "本课词 + 补字母";
    }
    return { words: out, src: src };
  }

  // ==== 最近几周格子（周一在左；按每天记录里的模式算分母；今天之后留空）====
  function weeks(n, today) {
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (dowOf(today) - 1));
    const todayStr = ds(today);
    const out = [];
    for (let w = -(n - 1); w <= 0; w++) {
      const row = [];
      for (let d = 1; d <= 7; d++) {
        const dt = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + w * 7 + d - 1);
        const s = ds(dt),
          r = rec(s);
        const m = r && r._m === "self" ? "self" : "normal";
        const P = plan(m, d);
        row.push({
          date: s,
          dow: d,
          m: m,
          t: P.length,
          c: r ? doneCount(s, P) : 0,
          fut: s > todayStr,
          today: s === todayStr,
        });
      }
      out.push(row);
    }
    return out;
  }

  // ==== 点线带：按天的完成情况 ====
  function parse(s) {
    const a = s.split("-");
    return new Date(+a[0], +a[1] - 1, +a[2]);
  }
  function addDays(d, n) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  }
  // 某一天：当天应做哪几项（今天和未来按「现在的模式」，过去按那天自己记的 _m）、勾了几项、有没有补的
  function day(date, todayStr) {
    const d = parse(date),
      r = rec(date),
      dow = dowOf(d);
    const fut = date > todayStr,
      isToday = date === todayStr;
    const m = isToday || fut ? mode : r && r._m === "self" ? "self" : r && r._m === "normal" ? "normal" : mode;
    const P = plan(m, dow);
    const flags = P.map(function (x) { return isDone(date, x.k); });
    const c = flags.filter(Boolean).length;
    return {
      date: date, d: d, dom: d.getDate(), mon: d.getMonth() + 1, dow: dow, m: m, P: P,
      flags: flags, t: P.length, c: c, full: P.length > 0 && c === P.length,
      fut: fut, today: isToday, bu: !!(r && Array.isArray(r._b) && r._b.length),
    };
  }
  // 有记录的第一天（没有记录返回 ""）
  function firstDate() {
    const ks = Object.keys(store).filter(function (k) { return /^\d{4}-\d{2}-\d{2}$/.test(k); }).sort();
    return ks.length ? ks[0] : "";
  }
  // 点线带的全部周：从「有记录的第一周」（没记录就本周）到今天之后 2 周；每周周一～周日 7 天
  function span(today) {
    const ts = ds(today);
    const mondayOf = function (d) { return addDays(d, -(dowOf(d) - 1)); };
    const fd = firstDate();
    let start = mondayOf(fd && fd < ts ? parse(fd) : today);
    const end = mondayOf(addDays(today, 14));
    const weeks = [];
    for (let w = start; w <= end; w = addDays(w, 7)) {
      const days = [];
      for (let i = 0; i < 7; i++) days.push(day(ds(addDays(w, i)), ts));
      weeks.push({ mon: ds(w), days: days, fullN: days.filter(function (x) { return x.full; }).length });
    }
    return weeks;
  }
  // 某一项（听 / 说 / 写…）最近 n 周每天勾没勾（周一在左，最后一行是本周）
  function itemWeeks(k, n, today) {
    const ts = ds(today),
      monday = addDays(today, -(dowOf(today) - 1));
    const out = [];
    for (let w = -(n - 1); w <= 0; w++) {
      const row = [];
      for (let i = 0; i < 7; i++) {
        const s = ds(addDays(monday, w * 7 + i));
        row.push({ date: s, dow: i + 1, on: isDone(s, k), fut: s > ts, today: s === ts });
      }
      out.push(row);
    }
    return out;
  }

  G.Today = {
    getMode: getMode,
    setMode: setMode,
    ds: ds,
    dowOf: dowOf,
    plan: plan,
    isDone: isDone,
    doneCount: doneCount,
    allDone: allDone,
    set: set,
    isMakeup: isMakeup,
    day: day,
    span: span,
    itemWeeks: itemWeeks,
    parse: parse,
    addDays: addDays,
    lessonOf: lessonOf,
    pickWords: pickWords,
    weeks: weeks,
  };
})(window);
