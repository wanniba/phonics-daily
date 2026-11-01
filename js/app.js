/* app.js —— 界面与流程
 * 负责：首页「今天第 N 课」、一课三步（复习闪卡 → 新音 → 拼读）、进度保存、家长面板（跳课 / 声音 / 说明 / 致谢）。
 * 不负责：课程内容（curriculum.js）、发声（audio.js）。
 * 块顺序：小工具 → 进度 → 图标/表情 → 首页 → 课程三步 → 家长面板 → 事件分发 → 启动
 */
(function (G) {
  "use strict";
  const Cur = G.Curriculum,
    Snd = G.Snd;
  const L = Cur.lessons,
    U = Cur.U;
  const $app = document.getElementById("app");

  // ==== 小工具 ====
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function sleep(ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  }
  function pickEven(arr, n) {
    // 从 arr 里均匀取 n 个（保证每个新音的词都能取到）
    if (arr.length <= n) return arr.slice();
    const out = [];
    for (let i = 0; i < n; i++) out.push(arr[Math.floor((i * arr.length) / n)]);
    return out;
  }
  function seeded(seed) {
    let s = seed * 9301 + 49297;
    return function () {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  // ==== 进度（localStorage 读写全部 try/catch，读不到就从第 1 课开始）====
  const PKEY = "phonics.progress.v1";
  let progress = { cur: 1 };
  try {
    const p = JSON.parse(localStorage.getItem(PKEY) || "null");
    if (p && p.cur >= 1) progress = p;
  } catch (e) {
    /* 读不到就默认 */
  }
  // 旧数据只有 cur：已学完 = 第 1 ~ cur-1 课（迁移，不改 cur，不丢进度）。done 是新增字段
  if (!Array.isArray(progress.done)) {
    progress.done = [];
    for (let i = 1; i < progress.cur && i <= Cur.lessons.length; i++) progress.done.push(i);
  }
  function saveProgress() {
    try {
      localStorage.setItem(PKEY, JSON.stringify(progress));
    } catch (e) {
      /* 存不了也照常用 */
    }
  }
  function curLesson() {
    return L[Math.min(progress.cur, L.length) - 1];
  }
  function finished() {
    return progress.cur > L.length;
  }

  // ==== 图标（同一家人：24 方格、描边 2.4）与表情 ====
  const I = {
    play: '<svg class="i" viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg>',
    next: '<svg class="i" viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6"/></svg>',
    speaker:
      '<svg class="i" viewBox="0 0 24 24"><path d="M4 9.5v5h4l5 4v-13l-5 4z" fill="currentColor"/><path d="M16.5 9a4.2 4.2 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11"/></svg>',
    ear: '<svg class="i" viewBox="0 0 24 24"><path d="M4 9.5v5h4l5 4v-13l-5 4z"/><path d="M16.5 9a4.2 4.2 0 0 1 0 6"/></svg>',
    home: '<svg class="i" viewBox="0 0 24 24"><path d="M4 11l8-7 8 7M6 10v9h12v-9"/></svg>',
    gear: '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>',
    close:
      '<svg class="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    check:
      '<svg class="i" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    cards:
      '<svg class="i" viewBox="0 0 24 24"><rect x="4" y="6" width="12" height="14" rx="2"/><path d="M8 3h10a2 2 0 0 1 2 2v11"/></svg>',
    ear2: '<svg class="i" viewBox="0 0 24 24"><path d="M9 18c0-3 4-4 4-8a4 4 0 0 0-8 0M15 9a4 4 0 0 1 0 6"/></svg>',
    back: '<svg class="i" viewBox="0 0 24 24"><path d="M19 12H6M11 6l-6 6 6 6"/></svg>',
    book: '<svg class="i" viewBox="0 0 24 24"><path d="M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z"/></svg>',
  };
  const EMO = Cur.EMO; // 词 → emoji（数据在 curriculum.js，听词选词与拼读页共用）

  // 例词里把本音的字母标成粉色
  function altsFor(u) {
    if (u.id === "sc9") return ["c"];
    if (u.id === "sg9") return ["g"];
    return u.g
      .replace(/^-/, "")
      .split(/[\s·+]+/)
      .filter(function (x) {
        return x && x !== "_";
      });
  }
  function hl(word, u) {
    const lw = word.toLowerCase();
    if (/^[aeiou]_e$/.test(u.g)) {
      // 魔法 e：标元音和词尾 e
      const v = u.g.charAt(0),
        vi = lw.indexOf(v);
      return word
        .split("")
        .map(function (c, i) {
          return i === vi || (i === word.length - 1 && c.toLowerCase() === "e")
            ? "<mark>" + esc(c) + "</mark>"
            : esc(c);
        })
        .join("");
    }
    const alts = altsFor(u).sort(function (a, b) {
      return b.length - a.length;
    });
    let best = null;
    alts.forEach(function (a) {
      const i = lw.indexOf(a.toLowerCase());
      if (i >= 0 && (!best || i < best.i)) best = { i: i, len: a.length };
    });
    if (!best) return esc(word);
    return (
      esc(word.slice(0, best.i)) +
      "<mark>" +
      esc(word.substr(best.i, best.len)) +
      "</mark>" +
      esc(word.slice(best.i + best.len))
    );
  }

  // ==== 会话状态（当前这一课）====
  let S = null; // { L, steps, si, deck, di, words, wi }
  let slowToken = 0;
  let overlay = null; // 'parent' | null
  let resetArm = false;
  let resetRecArm = false;
  let copyState = ''; // '' | 'ok' | 'fail'

  function buildDeck(l) {
    const rnd = seeded(l.no);
    const units = l.reviewFrom.slice();
    let order = [];
    if (l.kind === "review") {
      // 复习课：先过这周的音，再混几个老的
      order = l.weekUnits.slice();
      const rest = units
        .filter(function (u) {
          return order.indexOf(u) < 0;
        })
        .sort(function () {
          return rnd() - 0.5;
        });
      order = order.concat(rest).slice(0, 10);
    } else {
      // 普通课：最近学的两个音 + 随机几个老的（总共最多 8）
      const recent = units.slice(-2);
      const rest = units.slice(0, -2).sort(function () {
        return rnd() - 0.5;
      });
      order = recent.concat(rest).slice(0, 7);
    }
    const deck = order.map(function (u) {
      return { type: "unit", u: U[u] };
    });
    l.sightBefore.slice(-4).forEach(function (w) {
      deck.push({ type: "sight", w: w });
    }); // 最近 4 个常见词也闪一闪
    return deck.slice(0, 11).sort(function (a, b) {
      return a.type === "sight" ? 1 : b.type === "sight" ? -1 : 0;
    });
  }
  function startLesson(l) {
    const deck = buildDeck(l);
    // 一课：[复习闪卡] → 新音 → 拼读 → 小测 →（阶段最后一课：阶段测）→ 完成；周五复习课：没有拼读，小测换成周测
    const steps = (deck.length ? ["flash"] : [])
      .concat(l.kind === "review" ? ["learn"] : ["learn", "spell"])
      .concat(["quiz"])
      .concat(Quiz.isStageLast(l) ? ["stage"] : [])
      .concat(["done"]);
    S = {
      L: l,
      steps: steps,
      si: 0,
      deck: deck,
      di: 0,
      words: pickEven(l.words, 8),
      wi: 0,
    };
    // 预读本课要用的音，点的时候不卡
    const ids = [];
    l.units.concat(l.focus, l.weekUnits).forEach(function (u) {
      [].concat(U[u].snd).forEach(function (x) {
        ids.push(x);
      });
    });
    S.words.forEach(function (w) {
      w.segs.forEach(function (sg) {
        sg.s.forEach(function (x) {
          ids.push(x);
        });
      });
    });
    Snd.preload(ids);
    render();
    if (steps[0] === "learn") autoplayFirst();
  }
  function curStep() {
    return S.steps[S.si];
  }
  function goStep(n) {
    slowToken++;
    stopOwl();
    S.si = n;
    S.wi = 0;
    S.di = 0;
    if (curStep() === "quiz" || curStep() === "stage") {
      startQuiz();
      return;
    }
    render();
    if (curStep() === "learn") autoplayFirst();
  }
  function learnUnits(l) {
    return (l.units.length ? l.units : l.focus).map(function (u) {
      return U[u];
    });
  }
  function autoplayFirst() {
    const us = learnUnits(S.L);
    if (!(us.length && us.length <= 2)) return;
    const w = S.L.newSight[0];
    if (w) owlSay([{ snd: us[0].snd }, { zh: sightWhy(w) }]);
    else Snd.tone(us[0].snd);
  }

  // ==== 常见词收集：点 3 次收进收集册（phonics.sight.v1 = {词: 点过几次}）====
  const SIGHT_KEY = "phonics.sight.v1";
  let sightTaps = {};
  try { sightTaps = JSON.parse(localStorage.getItem(SIGHT_KEY) || "{}") || {}; } catch (e) { /* 读不到就从 0 开始 */ }
  function sightCount(w) { return Math.min(3, sightTaps[w] || 0); }
  function sightTap(w) {
    sightTaps[w] = sightCount(w) + 1;
    try { localStorage.setItem(SIGHT_KEY, JSON.stringify(sightTaps)); } catch (e) { /* 存不了也照常用 */ }
    return sightCount(w);
  }
  // 常见词：只把不按规矩读的那一段字母上色
  function sightHTML(w) {
    return Cur.sightParts(w).map(function (p) {
      return p.irr ? '<span class="irr">' + esc(p.t) + "</span>" : "<span>" + esc(p.t) + "</span>";
    }).join("");
  }
  function sightWhy(w) {
    if (w.length === 1) return "这个词只有一个字母，是个常见词，看熟就好。";
    return Cur.SIGHT_IRR[w] ? "这个词有个字母不按规矩读，看熟就好。" : "这是个常见词，看熟就好。";
  }
  function sightCardHTML(w) {
    const n = sightCount(w);
    let slots = "";
    for (let i = 0; i < 3; i++) slots += "<i" + (i < n ? ' class="f"' : "") + "></i>";
    const shelf = Cur.SIGHT1.concat(Cur.SIGHT2).filter(function (x) { return sightCount(x) >= 3; });
    return '<div class="sightbox">' +
      owlRow(n >= 3 ? "收集到啦！" : esc(sightWhy(w)), n >= 3 ? "happy" : "") +
      '<button class="coll" data-act="sight-say" data-w="' + esc(w) + '" aria-label="' + esc(w) + '"><span class="letters">' + sightHTML(w) + "</span></button>" +
      '<div class="slots" aria-label="收集进度 ' + n + ' / 3">' + slots + "</div>" +
      (shelf.length ? '<div class="shelf">收集册 ' + shelf.map(function (x) { return '<span class="mini">' + esc(x) + "</span>"; }).join("") + "</div>" : "") +
      "</div>";
  }

  // ==== 首页 ====
  function stageColor(n) {
    return "var(--s" + n + ")";
  }
  // ==== 首页 = 全局地图（9 个阶段）→ 点阶段看课程方块 ====
  const STAGE_NAME = [
    "",
    "字母的音",
    "拼短词",
    "两个字母一个音",
    "两个辅音连读",
    "魔法 e",
    "两个元音一起走",
    "元音加 r",
    "滑动的元音",
    "特殊规则",
  ];
  let mapStage = null; // null = 地图；1..9 = 展开某阶段的课程列表
  function isDone(no) {
    return progress.done.indexOf(no) >= 0;
  }
  // 阶段卡上的代表字母（取自对照表里各阶段最典型的几个）
  const STAGE_REPS = ["", "s a t", "c·a·t", "sh ch th", "bl cl st", "a_e i_e", "ai ay ee", "ar or er", "oi oy ow", "ph kn wr"];
  function stageReps(n) {
    return STAGE_REPS[n];
  }
  function stageTest(n) {
    // 这个阶段最近一次阶段测：null | {ok, score, total}
    const qs = Quiz.records().quizzes.filter(function (q) {
      return q.kind === "stage" && q.stage === n;
    });
    if (!qs.length) return null;
    const q = qs[qs.length - 1];
    return { ok: q.score / q.total >= 0.8, score: q.score, total: q.total };
  }
  function lessonTier(no) {
    // 这课小测 / 周测最近一次的得分档：'' | hi | mid | lo
    const qs = Quiz.records().quizzes.filter(function (q) {
      return q.lesson === no && q.kind !== "stage";
    });
    if (!qs.length) return "";
    const q = qs[qs.length - 1],
      r = q.score / q.total;
    return r >= 0.8 ? "hi" : r >= 0.6 ? "mid" : "lo";
  }
  function stageInfo(n) {
    const ls = L.filter(function (x) {
      return x.stage === n;
    });
    const done = ls.filter(function (x) {
      return isDone(x.no);
    }).length;
    const hasCur = ls.some(function (x) {
      return x.no === progress.cur;
    });
    const weak = Quiz.stageUnits(n).filter(function (u) {
      return Quiz.statOf(u).weak;
    }).length;
    return {
      ls: ls,
      done: done,
      total: ls.length,
      state: done === ls.length ? "done" : done > 0 || hasCur ? "on" : "new",
      cur: hasCur,
      weak: weak,
    };
  }
  const FLAG =
    '<svg class="i" viewBox="0 0 24 24"><path d="M6 21V4M6 5h12l-3 4 3 4H6" fill="currentColor"/></svg>';
  function flagHTML(t) {
    const cls = t ? (t.ok ? "pass" : "fail") : "none";
    return (
      '<span class="flag ' +
      cls +
      '" title="' +
      (t ? "阶段测 " + t.score + "/" + t.total : "阶段测还没做") +
      '">' +
      FLAG +
      "</span>"
    );
  }
  function stageCardHTML(n) {
    const s = stageInfo(n);
    const st = stageTest(n);
    return (
      '<button class="scard ' +
      s.state +
      (s.cur ? " cur" : "") +
      '" data-act="stage" data-n="' +
      n +
      '" style="--c:' +
      stageColor(n) +
      '" aria-label="阶段 ' +
      n +
      " " +
      esc(STAGE_NAME[n]) +
      '">' +
      '<span class="shead"><span class="snum">' +
      (s.state === "done" ? I.check : n) +
      '</span><span class="sstate">' +
      (s.state === "on" ? I.play : "") +
      "</span>" +
      flagHTML(st) +
      (s.weak
        ? '<span class="weak" data-act="mastery" title="薄弱音">⚠' +
          s.weak +
          "</span>"
        : "") +
      "</span>" +
      '<span class="sname">' +
      esc(STAGE_NAME[n]) +
      "</span>" +
      '<span class="sreps">' +
      esc(stageReps(n)) +
      "</span>" +
      '<span class="sprog"><span class="sbar"><i style="width:' +
      Math.round((s.done / s.total) * 100) +
      '%"></i></span><b>' +
      s.done +
      "/" +
      s.total +
      "</b></span></button>"
    );
  }
  function lessonSquareHTML(l) {
    const tier = lessonTier(l.no);
    const g = (l.units.length ? l.units : l.focus.slice(0, 2))
      .slice(0, 2)
      .map(function (u) {
        return U[u].g;
      })
      .join(" ");
    return (
      '<button class="lsq' +
      (isDone(l.no) ? " done" : "") +
      (tier ? " t-" + tier : "") +
      (l.kind === "review" ? " rev" : "") +
      (l.no === progress.cur ? " cur" : "") +
      '" data-act="enter" data-n="' +
      l.no +
      '" aria-label="第 ' +
      l.no +
      ' 课">' +
      '<span class="lno">' +
      l.no +
      "</span>" +
      '<span class="lg">' +
      (l.kind === "review" ? I.cards : esc(g)) +
      "</span>" +
      (isDone(l.no) ? '<span class="lmark">' + I.check + "</span>" : "") +
      (Quiz.isStageLast(l) ? '<span class="lflag">' + FLAG + "</span>" : "") +
      "</button>"
    );
  }
  function stageViewHTML(n) {
    const s = stageInfo(n);
    return (
      '<div class="top"><button class="round" data-act="map" aria-label="回地图">' +
      I.back +
      '</button><span class="stitle" style="--c:' +
      stageColor(n) +
      '"><span class="snum">' +
      n +
      "</span>" +
      esc(STAGE_NAME[n]) +
      "<b>" +
      s.done +
      "/" +
      s.total +
      "</b></span>" +
      flagHTML(stageTest(n)) +
      "</div>" +
      '<div class="lgrid" style="--c:' +
      stageColor(n) +
      '">' +
      s.ls.map(lessonSquareHTML).join("") +
      "</div>"
    );
  }
  function homeHTML() {
    if (mapStage) return stageViewHTML(mapStage);
    const doneN = progress.done.length;
    const pctN = Math.round((doneN / L.length) * 100);
    let hero;
    if (finished()) {
      hero =
        '<div class="hero"><button class="go" data-act="replay-all" aria-label="再来一遍"><span class="gplay">' +
        I.play +
        '</span><span class="gtxt">🎉🏆🎉</span></button></div>';
    } else {
      const l = curLesson();
      let tiles = "";
      if (l.kind === "review") {
        tiles += '<span class="tile review">' + I.cards + "</span>";
        l.weekUnits.slice(0, 5).forEach(function (u) {
          tiles += '<span class="tile review">' + esc(U[u].g) + "</span>";
        });
      } else {
        (l.units.length ? l.units : l.focus).forEach(function (u) {
          tiles +=
            '<span class="tile' +
            (l.units.length ? "" : " review") +
            '">' +
            esc(U[u].g) +
            "</span>";
        });
      }
      l.newSight.forEach(function (w) {
        tiles += '<span class="tile sight">' + sightHTML(w) + "</span>";
      });
      hero =
        '<div class="hero"><button class="go" data-act="start" aria-label="继续第 ' +
        l.no +
        ' 课" style="--c:' +
        stageColor(l.stage) +
        '"><span class="gplay">' +
        I.play +
        '</span><span class="gtxt">' +
        (l.kind === "review" ? "🔁 " : "") +
        "<b>" +
        l.no +
        '</b></span><span class="gtiles">' +
        tiles +
        "</span></button></div>";
    }
    let cards = "";
    for (let n = 1; n <= 9; n++) cards += stageCardHTML(n);
    return (
      '<div class="top"><div class="total" aria-label="总进度 ' +
      doneN +
      " / " +
      L.length +
      '"><b>' +
      doneN +
      "</b><span>/ " +
      L.length +
      '</span><span class="tbar"><i style="width:' +
      pctN +
      '%"></i></span><em>' +
      pctN +
      '%</em></div><button class="round small" data-act="parent" aria-label="家长">' +
      I.gear +
      "</button></div>" +
      hero +
      '<div class="smap">' +
      cards +
      "</div>"
    );
  }

  // ==== 课程：顶部条（关闭 + 步骤点）====
  function topbar() {
    const dots = S.steps
      .filter(function (s) {
        return s !== "done";
      })
      .map(function (s, i) {
        return (
          '<span class="dot' +
          (i < S.si ? " done" : i === S.si ? " on" : "") +
          '"></span>'
        );
      })
      .join("");
    return (
      '<div class="lesson-top"><button class="round" data-act="home" aria-label="回首页">' +
      I.home +
      "</button>" +
      '<div class="dots">' +
      dots +
      "</div>" +
      '<span style="width:64px"></span></div>'
    );
  }
  function nextBtn(act, label) {
    return (
      '<div class="nextbar"><button class="big-btn" data-act="' +
      act +
      '" aria-label="' +
      (label || "下一个") +
      '">' +
      I.next +
      "</button></div>"
    );
  }
  function miniDots(n, i) {
    let h = "";
    for (let k = 0; k < n; k++)
      h += '<i class="' + (k < i ? "done" : k === i ? "on" : "") + '"></i>';
    return '<div class="mini-dots" aria-hidden="true">' + h + "</div>";
  }

  // ==== 步骤 ① 复习闪卡 ====
  function flashHTML() {
    const c = S.deck[S.di];
    const face = c.type === "unit" ? esc(c.u.g) : sightHTML(c.w);
    const cls = c.type === "sight" ? ' style="font-size:clamp(90px,22vw,150px)"' : "";
    return (
      topbar() +
      '<div class="stage-body"><button class="flash" data-act="flash-hear"' +
      cls +
      ' aria-label="听">' +
      face +
      '<span class="ear">' +
      I.ear +
      "</span></button>" +
      miniDots(S.deck.length, S.di) +
      "</div>" +
      nextBtn("flash-next")
    );
  }

  // ==== 步骤 ② 新音 / 本周回顾 / 常见词 ====
  function ucardHTML(u, withWords) {
    const words = withWords
      ? '<div class="exwords">' +
        u.ex
          .map(function (w) {
            return (
              '<button class="exw" data-act="say" data-w="' +
              esc(w) +
              '">' +
              (EMO[w.toLowerCase()]
                ? "<em>" + EMO[w.toLowerCase()] + "</em>"
                : "") +
              "<span>" +
              hl(w, u) +
              "</span></button>"
            );
          })
          .join("") +
        "</div>"
      : "";
    const vars = u.variants
      ? '<div class="variants">' +
        u.variants
          .map(function (v, i) {
            return (
              '<button data-act="var" data-u="' +
              u.id +
              '" data-i="' +
              i +
              '">' +
              esc(v.label) +
              "</button>"
            );
          })
          .join("") +
        "</div>"
      : "";
    return (
      '<div class="ucard"><button class="ubig" data-act="hear" data-u="' +
      u.id +
      '" aria-label="听">' +
      esc(u.g) +
      (u.mark === "voiced" ? '<span class="voiced">〰</span>' : "") +
      '<span class="ear">' +
      I.ear +
      "</span></button>" +
      vars +
      words +
      "</div>"
    );
  }
  function parentTips(us) {
    const rows = us
      .map(function (u) {
        return (
          "<p><b>" +
          esc(u.g) +
          "</b>：" +
          esc(u.tip || "—") +
          (u.warn
            ? ' <span style="color:#c0392b">⚠ ' + esc(u.warn) + "</span>"
            : "") +
          "</p>"
        );
      })
      .join("");
    return (
      '<details class="tipbox"><summary>家长</summary>' + rows + "</details>"
    );
  }
  function learnHTML() {
    const l = S.L,
      us = learnUnits(l);
    let body = "";
    if (us.length <= 2) {
      body +=
        '<div class="sound-row">' +
        us
          .map(function (u) {
            return ucardHTML(u, l.units.length > 0);
          })
          .join("") +
        "</div>";
    } else {
      // 复习课：本周所有音排成一片，点哪个听哪个
      body +=
        '<div class="tiles">' +
        us
          .map(function (u) {
            return (
              '<button class="tile review" data-act="hear" data-u="' +
              u.id +
              '">' +
              esc(u.g) +
              "</button>"
            );
          })
          .join("") +
        "</div>";
    }
    if (l.newSight.length) body += sightCardHTML(l.newSight[0]);
    return (
      topbar() +
      '<div class="stage-body">' +
      body +
      parentTips(us) +
      "</div>" +
      nextBtn("learn-next")
    );
  }

  // ==== 步骤 ③ 拼读 ====
  function blocksHTML(w) {
    return w.segs
      .map(function (sg, i) {
        const silent = sg.s.length === 0;
        const mk = silent
          ? ""
          : sg.t.length > 1
            ? '<span class="barm"></span>'
            : '<span class="dotm"></span>'; // 一个音一个点；两个字母一个音画短横
        return (
          '<button class="blk' +
          (silent ? " silent" : "") +
          '" data-act="blk" data-i="' +
          i +
          '" aria-label="' +
          esc(sg.t) +
          '"><span class="ch">' +
          esc(sg.t) +
          '</span><span class="mk">' +
          mk +
          "</span></button>"
        );
      })
      .join("");
  }
  function spellHTML() {
    const w = S.words[S.wi];
    const e = EMO[w.text.toLowerCase()] || "";
    return (
      topbar() +
      '<div class="stage-body">' +
      '<div class="wordpic">' +
      (w.warn ? '<span class="warnmark">⚠️</span>' : "") +
      e +
      "</div>" +
      '<div class="blocks" id="blocks">' +
      blocksHTML(w) +
      "</div>" +
      '<div class="wordbtns"><button class="big-btn snd" data-act="slow" aria-label="慢慢拼">' +
      I.play +
      "</button>" +
      '<button class="big-btn snd" data-act="sayword" aria-label="听整个词">' +
      I.speaker +
      "</button></div>" +
      miniDots(S.words.length, S.wi) +
      "</div>" +
      nextBtn("spell-next")
    );
  }

  // ==== 完成页 ====
  function doneHTML() {
    return (
      topbar() +
      '<div class="stage-body"><div class="done-box"><div class="stars">⭐️🎉⭐️</div>' +
      '<button class="big-btn" data-act="finish" aria-label="完成">' +
      I.check +
      "</button>" +
      '<button class="linkish" data-act="again">再练一遍</button></div></div>'
    );
  }

  // ==== 家长面板 ====
  function voiceOptions() {
    const cur = Snd.settings.voiceURI;
    let h =
      '<option value="">自动（' +
      (Snd.settings.accent === "gb" ? "en-GB" : "en-US") +
      " 里最好的）</option>";
    Snd.voices().forEach(function (v) {
      h +=
        '<option value="' +
        esc(v.voiceURI) +
        '"' +
        (v.voiceURI === cur ? " selected" : "") +
        ">" +
        esc(v.name + " · " + v.lang) +
        "</option>";
    });
    return h;
  }
  function sourcesTable() {
    const how = {
      rec: "录音（Commons）",
      say: "生成（macOS say）",
      mix: "拼接（两段录音）",
    };
    return (
      "<table><tr><th>音</th><th>来源</th><th>许可</th></tr>" +
      G.AudioSources.map(function (r) {
        return (
          "<tr><td>" +
          esc(r.ipa) +
          "</td><td>" +
          how[r.how] +
          "：" +
          (r.url
            ? '<a href="' +
              r.url +
              '" target="_blank" rel="noopener">' +
              esc(r.src.replace("Wikimedia Commons：", "")) +
              "</a>"
            : esc(r.src)) +
          "</td><td>" +
          esc(r.lic) +
          "</td></tr>"
        );
      }).join("") +
      "</table>"
    );
  }
  function parentHTML() {
    const v = Snd.currentVoice();
    const stageFirst = [];
    for (let n = 1; n <= 9; n++) {
      const i = L.findIndex(function (x) {
        return x.stage === n;
      });
      stageFirst.push(
        '<button class="pbtn" data-act="jump" data-n="' +
          (i + 1) +
          '">阶段 ' +
          n +
          "</button>",
      );
    }
    return (
      '<div class="parent-mask" data-act="parent-bg"><div class="parent" role="dialog" aria-label="家长设置">' +
      '<h2>家长<button data-act="parent-close" aria-label="关闭">' +
      I.close +
      "</button></h2>" +
      '<div class="row"><button class="pbtn on" data-act="mastery">掌握情况（成绩 / 薄弱音 / 复制给老师）</button></div>' +
      "<details><summary>怎么用</summary><ul>" +
      "<li>每天点首页的大绿钮，学一课，大约 10 分钟：① 闪卡复习旧音 ② 听新音 ③ 拼读词。学完点 ✓，明天进入下一课。</li>" +
      "<li>每 5 课有 1 课「复习课」（对照表里的「每周五只复习」），不学新音，课末做约 10 题的周测；每课学完有 6 题小测；每个阶段最后一课再加阶段测（读对 80% 以上算过关，没到只提示先复习哪些音，不锁课）。</li>" +
      "<li>小测三种题：听音选字母、听词选词（选项只差一个音）、读给家长听（含无意义的「外星词」，孩子读出声，家长点「读对 / 读错」）。答错时孩子只会听到正确答案并再试一次，看不到红叉和扣分。</li>" +
      "<li>第 2 阶段起词的拆法：一个圆点 = 一个音，短横 = 两个字母读一个音，灰色字母不发音。</li>" +
      "<li>家长先用「慢慢拼」▶ 带读，再让孩子自己指着点；要求他先拼再读，不要猜。</li>" +
      "<li>进度只存在这台设备的浏览器里：Mac 和 iPad 各存各的；清除网站数据会回到第 1 课。</li>" +
      "<li>iPad 听不到声音：先看侧边静音开关 / 音量，再点一下屏幕。</li></ul></details>" +
      "<details open><summary>进度（现在：第 " +
      Math.min(progress.cur, L.length) +
      " 课 / 共 " +
      L.length +
      " 课）</summary>" +
      '<div class="row"><label>跳到第 <input type="number" id="jumpn" min="1" max="' +
      L.length +
      '" value="' +
      Math.min(progress.cur, L.length) +
      '"> 课</label><button class="pbtn" data-act="jump-input">跳转</button></div>' +
      '<div class="row">' +
      stageFirst.join("") +
      "</div></details>" +
      "<details><summary>声音</summary>" +
      '<div class="row"><button class="pbtn' +
      (Snd.settings.accent === "us" ? " on" : "") +
      '" data-act="accent" data-v="us">美音 en-US</button><button class="pbtn' +
      (Snd.settings.accent === "gb" ? " on" : "") +
      '" data-act="accent" data-v="gb">英音 en-GB</button></div>' +
      '<div class="row"><select id="voicesel">' +
      voiceOptions() +
      "</select></div>" +
      '<div class="row"><label>语速 <select id="ratesel">' +
      [0.7, 0.85, 1]
        .map(function (r) {
          return (
            '<option value="' +
            r +
            '"' +
            (Snd.settings.rate === r ? " selected" : "") +
            ">" +
            r +
            "</option>"
          );
        })
        .join("") +
      "</select></label>" +
      '<button class="pbtn" data-act="test-word">试听单词 cat</button><button class="pbtn" data-act="test-tone">试听单音 /æ/</button></div>' +
      '<p class="tiny">当前用的声音：' +
      (v ? esc(v.name + " · " + v.lang) : "（浏览器没有找到英语声音）") +
      "。单词用系统自带朗读，单个的音用录音文件。英音/美音只影响单词朗读和字母 o 的音。系统里下载「增强/优质」版英语声音（设置 → 辅助功能 → 朗读内容 → 系统语音）会更好听。</p></details>" +
      "<details><summary>关于与致谢</summary>" +
      "<p>课程内容依据家长自编的「自然拼读对照表」（9 个阶段）。</p>" +
      '<p class="tiny">单个的音来自 Wikimedia Commons 的 IPA 音素录音（作者署名见各文件页面），按 CC BY-SA 3.0 许可使用（/dʒ/ 为公有领域）；为适合教学已裁短、调音量，属于改编，同样以 CC BY-SA 3.0 提供。双元音 /eɪ aɪ əʊ ɔɪ aʊ/ 由 macOS 语音合成生成，/eə ɪə/ 由两段录音拼成。许可证：<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a>。</p>' +
      sourcesTable() +
      "</details>" +
      '<details><summary>清除</summary><div class="row"><button class="pbtn danger" data-act="reset">' +
      (resetArm ? "再点一次确认清除" : "进度回到第 1 课") +
      '</button><button class="pbtn danger" data-act="reset-records">' +
      (resetRecArm ? "再点一次确认清除" : "清除成绩记录") +
      "</button></div></details>" +
      "</div></div>"
    );
  }

  // ==== 猫头鹰（小测里的向导）：说话时气泡里同时显示中文字；没有中文声音就只显示文字 ====
  let talking = false;
  let owlTk = 0;
  function owlSVG(cls) {
    return '<svg class="owl ' + (cls || "") + (talking ? " talking" : "") + '" viewBox="0 0 120 150" aria-hidden="true">' +
      '<path d="M20 44L28 12 50 30z" fill="#8a5a33"/><path d="M100 44L92 12 70 30z" fill="#8a5a33"/>' +
      '<ellipse cx="14" cy="96" rx="11" ry="26" fill="#8a5a33"/><ellipse cx="106" cy="96" rx="11" ry="26" fill="#8a5a33"/>' +
      '<ellipse cx="60" cy="88" rx="46" ry="54" fill="#a9794a"/><ellipse cx="60" cy="106" rx="30" ry="34" fill="#f3dcb4"/>' +
      '<circle cx="40" cy="66" r="21" fill="#fff"/><circle cx="80" cy="66" r="21" fill="#fff"/>' +
      '<circle cx="43" cy="68" r="10" fill="#2b2b3a"/><circle cx="77" cy="68" r="10" fill="#2b2b3a"/>' +
      '<circle cx="47" cy="64" r="3.5" fill="#fff"/><circle cx="81" cy="64" r="3.5" fill="#fff"/>' +
      '<circle class="cheek" cx="22" cy="86" r="8" fill="#ff9db8"/><circle class="cheek" cx="98" cy="86" r="8" fill="#ff9db8"/>' +
      '<g class="beak"><path d="M51 80h18l-9 16z" fill="#ff9f1c"/></g>' +
      '<path d="M44 140l-6 8M54 142l-2 8M66 142l2 8M76 140l6 8" stroke="#ff9f1c" stroke-width="4" stroke-linecap="round"/></svg>';
  }
  function owlRow(bubble, cls) {
    return '<div class="owlrow"><button class="owlbtn" data-act="owl" aria-label="猫头鹰：点我再说一遍">' + owlSVG(cls) +
      '</button><div class="bubble">' + bubble + "</div></div>";
  }
  function setTalking(on) {
    talking = on;
    $app.querySelectorAll(".owl").forEach(function (o) { o.classList.toggle("talking", on); });
  }
  function setBubble(h) {
    const b = $app.querySelector(".bubble");
    if (b) b.innerHTML = h;
  }
  function stopOwl() {
    owlTk++;
    setTalking(false);
    Snd.stopAll();
  }
  // 猫头鹰说一串（steps 见 Snd.seq）：中文步开口时气泡换成那句话（或 b）。⭐ 要保证出声，必须在点击事件里同步调用
  function owlSay(steps, done) {
    const tk = ++owlTk;
    setTalking(true);
    const st = steps.map(function (s) {
      return Object.assign({}, s, {
        on: function () {
          if (tk !== owlTk) return;
          if (s.b || s.zh) setBubble(s.b || esc(s.zh));
          s.on && s.on();
        },
      });
    });
    Snd.seq(st).then(function (finished) {
      if (tk !== owlTk || !finished) return;
      setTalking(false);
      done && done();
    });
  }
  function ph(t) { return '<span class="ph">' + esc(t) + "</span>"; }
  function pulseSnd() {
    const b = $app.querySelector(".qsnd");
    if (b) { b.classList.remove("pulse"); void b.offsetWidth; b.classList.add("pulse"); }
  }

  // ==== 小测（每课 6 题 / 周测 10 题 / 阶段测 12 题）====
  // S.q = { kind, list, qi, tries, locked, heard, firstOk[], wrongTags[], disabled[], reveal,
  //         phase: 'start' | 'demo' | 'ask' | 'spell' | 'result', dm: 示范状态 }
  //   heard = 本次小测的孩子已经亲手点过「点我开始听」：只有第一道要点，之后每题自动播
  //   phase 'start' = 小测开始前（猫头鹰 + 开始钮 + 左下角家长陪做）；'spell' = 读错后把词拆开一个音一个音读
  const PARENT_KEY = "phonics.quizparent.v1";
  let parentOpen = true;
  try { parentOpen = localStorage.getItem(PARENT_KEY) !== "0"; } catch (e) { /* 读不到就展开 */ }
  const ZH = {
    begin: "今天做个小测：听声音，选答案！",
    tapFirst: "点一下，开始听！",
    tapFirstSay: "点一下蓝色按钮，开始听！",
    listen: "听一听，是哪一个？",
    read: "把这个词读给爸爸妈妈听！",
    demoIntro: "我先做一次给你看。",
  };
  function quizKind() { return curStep() === "stage" ? "stage" : S.L.kind === "review" ? "week" : "lesson"; }
  function startQuiz() {
    const kind = quizKind();
    const list = Quiz.build(S.L, kind);
    if (!list.length) { goStep(S.si + 1); return; }
    S.q = { kind: kind, list: list, qi: 0, tries: 0, locked: false, heard: false, firstOk: [], wrongTags: [], disabled: [], reveal: false, phase: "start", dm: null };
    const ids = [];
    list.forEach(function (q) {
      if (q.snd) [].concat(q.snd).forEach(function (x) { ids.push(x); });
      (q.segs || []).forEach(function (sg) { sg.s.forEach(function (x) { ids.push(x); }); });
    });
    Snd.preload(ids);
    render();
  }
  function curQ() { return S.q.list[S.q.qi]; }
  // 开始钮：猫头鹰先说（在点击里），然后看这道题的题型要不要先演示
  function quizBegin() {
    const Q = S.q;
    if (!Quiz.demoSeen(curQ().type)) beginDemo([curQ().type], "ask");
    else { Q.phase = "ask"; render(); }
  }
  // 当前题要不要先出示范（这个题型第一次出现）
  function enterQuestion() {
    const Q = S.q, q = curQ();
    if (!Quiz.demoSeen(q.type)) { beginDemo([q.type], "ask"); return; }
    Q.phase = "ask";
    render();
    if (q.type !== "read" && Q.heard) autoQ(); // 点过按钮之后，后面每题自动播
  }

  // ---- 示范题：猫头鹰自己做一遍（只看，不记成绩）----
  function beginDemo(types, ret) {
    const Q = S.q;
    Q.dm = { types: types, i: 0, ret: ret, q: null, done: false, step: 0 };
    Q.phase = "demo";
    loadDemo();
  }
  function loadDemo() {
    const Q = S.q, dm = Q.dm;
    const type = dm.types[dm.i];
    const avoid = [];
    Q.list.forEach(function (x) { if (x.type === type) avoid.push(x.tags[0]); });
    dm.q = Quiz.demoQuestion(type, S.L, avoid);
    dm.done = false; dm.step = 0;
    if (!dm.q) { demoNext(); return; } // 做不出示范（该题型这个阶段出不了）就跳过
    Quiz.markDemoSeen(type);
    render();
    runDemo();
  }
  function runDemo() {
    const Q = S.q, dm = Q.dm, q = dm.q;
    const mark = function (n) { return function () { dm.step = n; if (n === 1) pulseSnd(); if (n === 2) { const o = $app.querySelectorAll(".opt")[q.answer]; o && o.classList.add("pointed"); } }; };
    const finish = function () { const b = $app.querySelector(".bubble"); if (b) dm.bubble = b.innerHTML; dm.done = true; dm.step = 2; render(); };
    if (q.type === "sound") {
      owlSay([
        { zh: ZH.demoIntro },
        { zh: "听——", nodwell: true },
        { snd: q.snd, b: "🔊 " + ph(q.label), on: mark(1) },
        { zh: "我听到这个音，所以选这个字母。", b: "我听到 " + ph(q.label) + "，所以选 <b>" + esc(q.options[q.answer].text) + "</b>", on: mark(2) },
      ], finish);
    } else if (q.type === "word") {
      owlSay([
        { zh: ZH.demoIntro },
        { zh: "听——", nodwell: true },
        { en: q.text, b: "🔊 " + ph(q.text), on: mark(1) },
        { zh: "我听到的是这个词，所以选这张图。", b: "我听到 " + ph(q.text) + "，所以选 " + q.options[q.answer].emoji, on: mark(2) },
      ], finish);
    } else {
      owlSay([
        { zh: ZH.demoIntro },
        { zh: "看这个词：我一个音一个音拼，再连起来读。" },
      ], function () {
        if (!(S && S.q === Q && Q.dm === dm)) return;
        slowSpell(q).then(function () { if (S && S.q === Q && Q.dm === dm) finish(); });
      });
    }
  }
  function demoNext() {
    const Q = S.q, dm = Q.dm;
    if (dm.i + 1 < dm.types.length) { dm.i++; loadDemo(); return; }
    stopOwl();
    if (dm.ret === "start") { Q.phase = "start"; render(); } else { Q.phase = "ask"; render(); }
  }

  function autoQ() {
    const q = curQ();
    if (!q) return;
    if (q.type === "sound") Snd.tone(q.snd);
    else if (q.type === "word") Snd.say(q.text);
  }
  function optInner(o, type) {
    return type === "word"
      ? '<span class="em">' + (o.emoji || "") + '</span><span class="w">' + esc(o.text) + "</span>"
      : esc(o.text);
  }
  function optsHTML(q, cls, extra) {
    return '<div class="opts n' + q.options.length + " " + cls + '">' + q.options.map(function (o, i) {
      return '<button class="opt ' + q.type + (q.type === "sound" && o.text.length > 1 ? " long" : "") + extra(i) + '" data-act="' + (cls === "lock" ? "noop" : "q-pick") + '" data-i="' + i + '">' + optInner(o, q.type) + "</button>";
    }).join("") + "</div>";
  }
  function parentHTML_quiz() {
    return '<div class="qparent">' + (parentOpen
      ? '<div class="ppanel"><b>第一次陪做</b><ol><li>坐在旁边，先让他自己试，别急着替他点。</li><li>他愣住了：点猫头鹰，它会再说一遍要做什么。</li><li>答错没关系，不扣分，只记第一次。</li></ol><button class="tell" data-act="q-tell">🦉 讲给我听</button></div>'
      : "") +
      '<button class="ppill" data-act="ptoggle">👨‍👩‍👦 ' + (parentOpen ? "收起" : "家长陪做") + "</button></div>";
  }
  function quizHTML() {
    const Q = S.q;
    if (Q.phase === "result") return quizResultHTML();
    if (Q.phase === "start") {
      return topbar() + '<div class="stage-body quizbody">' + owlRow(ZH.begin, "happy") +
        '<button class="big-btn gobtn" data-act="q-begin" aria-label="开始">' + I.play + "</button>" +
        '<button class="demobtn" data-act="q-demo-all">👀 看示范</button></div>' + parentHTML_quiz();
    }
    if (Q.phase === "demo") {
      const dm = Q.dm, q = dm.q;
      let mid = "";
      if (q.type === "read") mid = '<div class="blocks" id="blocks">' + blocksHTML(q) + "</div>";
      else mid = '<div class="mid"><button class="big-btn snd qsnd' + (dm.step === 1 ? " pulse" : "") + '" data-act="q-hear" aria-label="听">' + I.speaker + "</button></div>" +
        optsHTML(q, "lock", function (i) { return dm.step >= 2 && i === q.answer ? " pointed" : ""; });
      const more = dm.i + 1 < dm.types.length;
      return topbar() + '<div class="stage-body quizbody"><span class="badge">👀 看我做</span>' + owlRow(dm.bubble || "我先做一次给你看") + mid +
        (dm.done ? '<button class="big-btn gobtn wide" data-act="q-demo-next" aria-label="' + (more ? "下一个" : "我来试试") + '"><span class="gl">' + (more ? "下一个" : "我来试试") + "</span>" + I.play + "</button>" : "") + "</div>";
    }
    const q = curQ();
    let body = "";
    if (q.type === "read") {
      const bub = Q.phase === "spell" ? "我们一个音一个音来" : ZH.read;
      body = owlRow(bub) + (Q.phase === "spell"
        ? '<div class="blocks" id="blocks">' + blocksHTML(q) + "</div>"
        : '<div class="wordpic">' + (q.alien ? "👽" : "") + '</div><div class="readword">' + esc(q.text) + "</div>" +
          '<div class="pbar"><button data-act="q-right">读对 ✓</button><button data-act="q-wrong">读错</button></div>');
    } else {
      const heard = Q.heard;
      const bub = Q.bubble || (heard ? ZH.listen : ZH.tapFirst);
      const cls = heard ? (Q.locked ? "lock" : "") : "wait";
      body = owlRow(bub, Q.locked && !Q.reveal ? "happy" : "") +
        '<div class="mid"><button class="big-btn snd qsnd' + (heard ? "" : " fresh") + '" data-act="q-hear" aria-label="' + (heard ? "再听一遍" : "点我开始听") + '">' + I.speaker +
        (heard ? "" : '<span class="gl">点我开始听</span>') + "</button></div>" +
        optsHTML(q, cls, function (i) { return (Q.disabled.indexOf(i) >= 0 ? " dim" : "") + (Q.good === i ? " good" : ""); });
    }
    return topbar() + '<div class="stage-body quizbody">' + body + miniDots(Q.list.length, Q.qi) + "</div>";
  }
  function quizResultHTML() {
    const Q = S.q;
    const score = Q.firstOk.filter(Boolean).length, total = Q.list.length;
    const rate = score / total;
    let note = Quiz.KIND[Q.kind] + "：" + score + " / " + total + "（" + Math.round(rate * 100) + "%）。";
    if (Q.kind === "stage") {
      const weak = Q.wrongTags.filter(function (v, i, arr) { return arr.indexOf(v) === i; }).map(Quiz.label);
      note += rate >= 0.8 ? "达到 80% 过关线，可以进入下一阶段。" : "没到 80% 过关线，建议先复习：" + (weak.join("、") || "（本次错的音见掌握情况）") + "。不强制，想往下学可以直接继续。";
    }
    const stars = score > 0 ? "⭐".repeat(Math.min(score, 12)) : "🌟";
    return topbar() + '<div class="stage-body"><div class="done-box"><div class="stars">' + stars + "</div>" +
      '<button class="big-btn" data-act="quiz-next" aria-label="继续">' + I.next + "</button>" +
      '<details class="tipbox"' + (Q.kind === "stage" ? " open" : "") + "><summary>家长</summary><p>" + esc(note) + "</p></details></div></div>";
  }
  function cheer(el) {
    Snd.ding();
    if (el) el.classList.add("good");
    const b = document.createElement("div");
    b.className = "burst"; b.textContent = "⭐ ✨ 🌟";
    $app.appendChild(b);
    setTimeout(function () { b.remove(); }, 1000);
  }
  function record(q, ok) {
    q.tags.forEach(function (t) { Quiz.addAnswer(t, ok); });
    S.q.firstOk.push(ok);
    if (!ok) S.q.wrongTags = S.q.wrongTags.concat(q.tags);
  }
  function nextQ() {
    const Q = S.q;
    Q.qi++; Q.tries = 0; Q.locked = false; Q.disabled = []; Q.good = -1; Q.reveal = false; Q.bubble = ""; Q.phase = "ask";
    if (Q.qi >= Q.list.length) {
      Q.phase = "result";
      Quiz.addQuiz({ lesson: S.L.no, kind: Q.kind, stage: S.L.stage, score: Q.firstOk.filter(Boolean).length, total: Q.list.length, wrong: Q.wrongTags });
      stopOwl();
      render(); Snd.ding();
      return;
    }
    enterQuestion();
  }
  // 说完这句再进下一题；换了题 / 离开小测就不进
  function thenNext(Q, qi, gap) {
    return function () { setTimeout(function () { if (S && S.q === Q && Q.qi === qi) nextQ(); }, gap); };
  }
  function qSteps(q) { return q.type === "sound" ? { snd: q.snd } : { en: q.text }; }
  function qLabel(q) { return q.type === "sound" ? q.label : q.text; }
  // 点喇叭 / 大蓝按钮：⭐ 第一次出声就发生在这次点击里（同步调用 speak / resume），不放进 setTimeout 或 await 后面
  function hearQ() {
    const Q = S.q;
    if (Q.phase === "demo") { // 示范页上点喇叭：只重放要听的音 / 词
      const dq = Q.dm.q;
      stopOwl();
      if (dq.type === "sound") Snd.tone(dq.snd); else Snd.say(dq.text);
      return;
    }
    const q = curQ();
    if (!Q.heard) {
      Q.heard = true;
      render();
      owlSay([{ zh: ZH.listen, nodwell: true }, Object.assign({ b: "🔊 听……", on: pulseSnd }, qSteps(q))], function () { setBubble(esc(ZH.listen)); });
      return;
    }
    stopOwl();
    autoQ(); // 重听：随时、不限次数、不扣分
  }
  function pickOpt(el) {
    const Q = S.q, q = curQ();
    if (Q.locked || !Q.heard) return;
    const i = +el.dataset.i;
    const qi = Q.qi;
    if (i === q.answer) {
      if (Q.tries === 0) record(q, true);
      Q.locked = true; Q.good = i; Q.bubble = "对啦！是 " + ph(qLabel(q));
      render(); cheer($app.querySelectorAll(".opt")[i]);
      owlSay([{ zh: "对啦！", b: Q.bubble }, qSteps(q)], thenNext(Q, qi, 500));
      return;
    }
    if (Q.tries === 0) record(q, false); // 第一次的结果才记
    Q.tries++;
    Q.disabled = Q.disabled.concat([i]); // 选错的那个变灰，不出红叉
    if (Q.tries >= 2) { // 再错：直接亮出答案，进入下一题
      Q.locked = true; Q.good = q.answer; Q.reveal = true; Q.bubble = "没关系，是这个 👆 " + ph(qLabel(q));
      render();
      owlSay([{ zh: "没关系，答案是这个。", b: Q.bubble }, qSteps(q)], thenNext(Q, qi, 700));
      return;
    }
    Q.bubble = "再听一次，这次是 " + ph(qLabel(q));
    render();
    owlSay([{ zh: "再听一次，这次是", b: Q.bubble }, qSteps(q)], function () { /* 留在这一题，等孩子再选 */ });
  }
  async function readMark(ok) {
    const Q = S.q, q = curQ();
    if (Q.locked) return;
    if (ok) {
      if (Q.tries === 0) record(q, true);
      Q.locked = true; cheer(null);
      setTimeout(nextQ, 950);
      return;
    }
    if (Q.tries === 0) record(q, false);
    Q.tries++;
    if (Q.tries >= 2) { nextQ(); return; }
    Q.locked = true; Q.phase = "spell"; render(); // 拆开一个音一个音读给他听，再读一次整词，然后再给一次机会
    await slowSpell(q);
    if (S && S.q === Q) { Q.locked = false; Q.phase = "ask"; render(); }
  }

  // ==== 掌握情况页（家长）====
  function pct(s) { return s.n ? Math.round(s.rate * 100) + "%" : "—"; }
  function masteryHTML() {
    const done = progress.done.length;
    const st = Quiz.allStats(progress.cur);
    const weak = st.filter(function (s) { return s.weak; });
    const rows = st.map(function (s) {
      const rc = s.recent.map(function (x) { return x ? "✓" : "✗"; }).join(" ");
      return "<tr" + (s.weak ? ' style="background:#fff4e5"' : "") + "><td>" + esc(Quiz.label(s.id)) + "</td><td>" + pct(s) + (s.n ? "（" + s.ok + "/" + s.n + "）" : "") + "</td><td>" + (rc || "—") + "</td><td>" + (s.weak ? "⚠ 薄弱" : "") + "</td></tr>";
    }).join("");
    const qs = Quiz.records().quizzes.slice().reverse().slice(0, 30).map(function (q) {
      return "<tr><td>" + Quiz.dateStr(q.ts) + "</td><td>第 " + q.lesson + " 课</td><td>" + Quiz.KIND[q.kind] + "</td><td>" + q.score + " / " + q.total + "</td></tr>";
    }).join("");
    const text = Quiz.summaryText(progress.cur, progress.done.length);
    return '<div class="parent-mask" data-act="parent-bg"><div class="parent" role="dialog" aria-label="掌握情况">' +
      '<h2>掌握情况<button data-act="parent-close" aria-label="关闭">' + I.close + "</button></h2>" +
      "<p>已学完 " + done + " 课 / 共 " + L.length + " 课。薄弱音：" + (weak.length ? weak.map(function (s) { return "<b>" + esc(Quiz.label(s.id)) + "</b>"; }).join("、") : "暂无") + "</p>" +
      '<p class="tiny">薄弱 = 答过至少 2 次且正确率低于 80%，或最近 4 次里错了 2 次以上。只统计每道题第一次作答。</p>' +
      '<div class="row"><button class="pbtn on" data-act="copy">复制给老师</button>' + (copyState === "ok" ? '<span class="tiny">已复制 ✓</span>' : "") + '<button class="pbtn" data-act="parent-back">返回</button></div>' +
      (copyState === "fail" ? '<p class="tiny">这台设备不让网页写剪贴板，请长按下面的文字全选后复制：</p><textarea id="copybox" readonly rows="10" style="width:100%;font-size:13px">' + esc(text) + "</textarea>" : "") +
      "<details open><summary>每个音</summary><table><tr><th>音</th><th>正确率</th><th>最近几次</th><th></th></tr>" + (rows || '<tr><td colspan="4">还没有数据</td></tr>') + "</table></details>" +
      "<details open><summary>小测记录</summary><table><tr><th>日期</th><th>课</th><th>类型</th><th>得分</th></tr>" + (qs || '<tr><td colspan="4">还没做过</td></tr>') + "</table></details>" +
      "</div></div>";
  }
  function copySummary() {
    const text = Quiz.summaryText(progress.cur, progress.done.length);
    const fail = function () { copyState = "fail"; render(); const t = document.getElementById("copybox"); if (t) { t.focus(); t.select(); } };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { copyState = "ok"; render(); }, fail);
      } else fail();
    } catch (e) { fail(); }
  }

  // ==== 渲染 ====
  function render() {
    let h;
    if (!S) h = homeHTML();
    else {
      const st = curStep();
      h =
        st === "flash"
          ? flashHTML()
          : st === "learn"
            ? learnHTML()
            : st === "spell"
              ? spellHTML()
              : st === "quiz" || st === "stage"
                ? quizHTML()
                : doneHTML();
    }
    $app.innerHTML =
      h +
      (overlay === "parent"
        ? parentHTML()
        : overlay === "mastery"
          ? masteryHTML()
          : "");
  }

  // ==== 动作 ====
  const lessonOf = function () {
    return S && S.L;
  };
  async function slowSpell(word) {
    const my = ++slowToken;
    Snd.stopAll();
    const w = word || S.words[S.wi];
    const els = $app.querySelectorAll(".blk");
    for (let i = 0; i < w.segs.length; i++) {
      if (my !== slowToken) return;
      const sg = w.segs[i];
      if (!sg.s.length) continue;
      els[i] && els[i].classList.add("lit");
      await Snd.tone(sg.s);
      await sleep(120);
      els[i] && els[i].classList.remove("lit");
    }
    if (my !== slowToken) return;
    await sleep(150);
    if (my === slowToken) await Snd.say(w.text);
  }
  function jumpTo(n) {
    n = Math.max(1, Math.min(L.length, Math.round(n) || 1));
    progress.cur = n;
    saveProgress();
    S = null;
    overlay = null;
    mapStage = null;
    render();
  }
  const actions = {
    start: function () {
      startLesson(curLesson());
    },
    "replay-all": function () {
      progress.cur = 1;
      progress.done = [];
      saveProgress();
      render();
    },
    home: function () {
      slowToken++;
      stopOwl();
      S = null;
      mapStage = null;
      render();
    },
    stage: function (el) {
      mapStage = +el.dataset.n;
      render();
    },
    map: function () {
      mapStage = null;
      render();
    },
    enter: function (el) {
      startLesson(L[+el.dataset.n - 1]); // 直接进这一课，不改「当前课」，已学完的标记也不动
    },
    parent: function () {
      overlay = "parent";
      render();
    },
    "parent-close": function () {
      overlay = null;
      resetArm = false;
      resetRecArm = false;
      render();
    },
    "flash-hear": function () {
      const c = S.deck[S.di];
      if (c.type === "unit") Snd.tone(c.u.snd);
      else { sightTap(c.w); Snd.say(c.w); }
    },
    "sight-say": function (el) {
      const w = el.dataset.w, was = sightCount(w), n = sightTap(w);
      render();
      if (n >= 3 && was < 3) owlSay([{ en: w }, { zh: "收集到啦！" }]);
      else owlSay([{ en: w }]);
    },
    owl: function () {
      const Q = S && S.q;
      if (S && curStep() === "learn" && S.L.newSight.length) { owlSay([{ zh: sightWhy(S.L.newSight[0]) }]); return; }
      if (!Q) return;
      if (Q.phase === "start") owlSay([{ zh: ZH.begin }]);
      else if (Q.phase === "demo") runDemo();
      else if (Q.phase === "ask") owlSay([{ zh: curQ().type === "read" ? ZH.read : Q.heard ? ZH.listen : ZH.tapFirstSay }]);
    },
    "q-begin": quizBegin,
    "q-demo-all": function () {
      const types = [];
      S.q.list.forEach(function (q) { if (types.indexOf(q.type) < 0) types.push(q.type); });
      beginDemo(types, "start");
    },
    "q-demo-next": demoNext,
    ptoggle: function () {
      parentOpen = !parentOpen;
      try { localStorage.setItem(PARENT_KEY, parentOpen ? "1" : "0"); } catch (e) { /* 记不住也照常用 */ }
      render();
    },
    "q-tell": function () {
      owlSay([{ zh: "你好，我是猫头鹰。小测里，我会先说怎么做，再放声音。孩子点一下蓝色大按钮就能听，想听几次都行。选对了我会夸他，选错了不扣分，我会再放一次。", b: "小测里我先说怎么做，再放声音；想听几次都行，选错不扣分。" }]);
    },
    "flash-next": function () {
      if (S.di + 1 < S.deck.length) {
        S.di++;
        render();
      } else goStep(S.si + 1);
    },
    hear: function (el) {
      Snd.tone(U[el.dataset.u].snd);
    },
    var: function (el) {
      Snd.tone(U[el.dataset.u].variants[+el.dataset.i].snd);
    },
    say: function (el) {
      Snd.say(el.dataset.w);
    },
    "learn-next": function () {
      goStep(S.si + 1);
    },
    blk: function (el) {
      const sg = S.words[S.wi].segs[+el.dataset.i];
      if (!sg.s.length) {
        el.classList.remove("wiggle");
        void el.offsetWidth;
        el.classList.add("wiggle");
        return;
      } // 不发音的字母：抖一下
      Snd.tone(sg.s);
    },
    slow: function () {
      slowSpell();
    },
    sayword: function () {
      slowToken++;
      Snd.stopAll();
      Snd.say(S.words[S.wi].text);
    },
    "spell-next": function () {
      if (S.wi + 1 < S.words.length) {
        slowToken++;
        Snd.stopAll();
        S.wi++;
        render();
      } else goStep(S.si + 1);
    },
    finish: function () {
      if (S.L.no >= progress.cur) progress.cur = S.L.no + 1;
      if (progress.done.indexOf(S.L.no) < 0) progress.done.push(S.L.no);
      saveProgress();
      S = null;
      mapStage = null;
      render();
    },
    again: function () {
      goStep(S.steps.indexOf("learn"));
    },
    jump: function (el) {
      jumpTo(+el.dataset.n);
    },
    "jump-input": function () {
      const v = document.getElementById("jumpn");
      jumpTo(v ? +v.value : 1);
    },
    accent: function (el) {
      Snd.settings.accent = el.dataset.v;
      Snd.settings.voiceURI = "";
      Snd.saveSettings();
      render();
    },
    "test-word": function () {
      Snd.say("cat");
    },
    "test-tone": function () {
      Snd.tone("ae");
    },
    "q-hear": hearQ,
    "q-pick": pickOpt,
    "q-right": function () { readMark(true); },
    "q-wrong": function () { readMark(false); },
    "quiz-next": function () { goStep(S.si + 1); },
    mastery: function () { overlay = "mastery"; copyState = ""; render(); },
    "parent-back": function () { overlay = "parent"; render(); },
    copy: copySummary,
    "reset-records": function () {
      if (!resetRecArm) { resetRecArm = true; render(); return; }
      resetRecArm = false; Quiz.resetRecords(); render();
    },
    reset: function () {
      if (!resetArm) {
        resetArm = true;
        render();
        return;
      }
      resetArm = false;
      progress.cur = 1;
      progress.done = [];
      saveProgress();
      S = null;
      overlay = null;
      render();
    },
  };

  ["pointerdown", "touchend", "click"].forEach(function (type) {
    document.addEventListener(type, function () { Snd.unlock(type); }, true);
  });
  // 声音被浏览器挡住时：给所有发声按钮加醒目的「点我听」提示，点一下就是一次真点击，会重新放
  Snd.setHandlers(
    function () { document.body.classList.add("snd-blocked"); },
    function () { document.body.classList.remove("snd-blocked"); },
  );
  $app.addEventListener("click", function (ev) {
    const el = ev.target.closest("[data-act]");
    if (!el) return;
    if (el.dataset.act === "parent-bg" && ev.target !== el) return; // 只有点到遮罩本身才关
    const fn =
      el.dataset.act === "parent-bg"
        ? actions["parent-close"]
        : actions[el.dataset.act];
    if (fn) fn(el);
  });
  $app.addEventListener("change", function (ev) {
    if (ev.target.id === "voicesel") {
      Snd.settings.voiceURI = ev.target.value;
      Snd.saveSettings();
    }
    if (ev.target.id === "ratesel") {
      Snd.settings.rate = +ev.target.value;
      Snd.saveSettings();
    }
  });

  // ==== 启动 ====
  G.PhonicsApp = {
    q: function () { return S && S.q && S.q.phase === 'ask' ? { q: S.q.list[S.q.qi], i: S.q.qi, n: S.q.list.length, kind: S.q.kind } : null; }, // 自测脚本用
    progress: function () {
      return progress;
    },
    lessons: L,
  }; // 给自测脚本用
  render();
})(window);
