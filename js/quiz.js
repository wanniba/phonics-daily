/* quiz.js —— 出题、成绩记录、掌握情况汇总、「复制给老师」文本
 * 负责：三种题（听音选字母 / 听词选词 / 读给家长听）的生成；每个音的答题记录（localStorage）；弱项判定；汇总文本。
 * 不负责：界面与交互（app.js）。
 * 块顺序：记录 → 出题工具 → 三种题 → 一套卷子（小测 / 周测 / 阶段测）→ 汇总
 */
(function (G) {
  "use strict";
  const Cur = G.Curriculum,
    U = Cur.U,
    LS = Cur.lessons;

  // ==== 记录：{units:{id:[[ts,1|0],…]}, quizzes:[{ts,lesson,kind,stage,score,total,wrong:[id]}]}，读写全部 try/catch ====
  const KEY = "phonics.records.v1";
  let rec = { units: {}, quizzes: [] };
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || "null");
    if (r && r.units && r.quizzes) rec = r;
  } catch (e) {
    /* 读不到就空记录 */
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(rec));
    } catch (e) {
      /* 存不了也照常用 */
    }
  }
  function addAnswer(unitId, ok) {
    const a = rec.units[unitId] || (rec.units[unitId] = []);
    a.push([Date.now(), ok ? 1 : 0]);
    if (a.length > 40) a.shift();
    save();
  }
  function addQuiz(meta) {
    rec.quizzes.push(Object.assign({ ts: Date.now() }, meta));
    if (rec.quizzes.length > 200) rec.quizzes.shift();
    save();
  }
  function resetRecords() {
    rec = { units: {}, quizzes: [] };
    save();
  }

  // 一个音的统计；弱项 = 至少答过 2 次且正确率 < 80%，或最近 4 次里错了 ≥ 2 次
  function statOf(id) {
    const a = rec.units[id] || [];
    const ok = a.filter(function (x) {
      return x[1];
    }).length;
    const last4 = a.slice(-4);
    const rate = a.length ? ok / a.length : null;
    const weak =
      (a.length >= 2 && rate < 0.8) ||
      last4.filter(function (x) {
        return !x[1];
      }).length >= 2;
    return {
      id: id,
      n: a.length,
      ok: ok,
      rate: rate,
      weak: weak,
      recent: a.slice(-6).map(function (x) {
        return x[1];
      }),
    };
  }

  // ==== 出题工具 ====
  function rnd(n) {
    return Math.floor(Math.random() * n);
  }
  function shuffle(a) {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) {
      const j = rnd(i + 1);
      const t = b[i];
      b[i] = b[j];
      b[j] = t;
    }
    return b;
  }
  function pick(a) {
    return a[rnd(a.length)];
  }
  function sndKey(u) {
    return JSON.stringify(u.snd);
  }
  // 音的显示名（家长页 / 汇总文本里区分同形字母）
  const LAB = {
    ck1: "c·k",
    th1: "th（吹气）",
    th2: "th（振动）",
    ow1: "ow（读长o）",
    ow2: "ow（读ou）",
    oo1: "oo（长）",
    oo2: "oo（短）",
    ye: "y（读e）",
    yi: "y（读i）",
    ym: "y（词中）",
    ear: "ear",
    ear2: "ear（例外读air）",
    sc9: "软c",
    sg9: "软g",
    _st: "-st",
    _nd: "-nd",
    _mp: "-mp",
    _nt: "-nt",
    _lt: "-lt",
    _ft: "-ft",
  };
  function label(id) {
    return LAB[id] || U[id].g;
  }

  // 每个音对应的练习词（来自教这个音的那几课；不含例外词）
  const UW = {};
  LS.forEach(function (l) {
    if (l.kind !== "learn") return; // 复习课的词是别的课抽来的，不算这个音的词
    l.units.concat(l.focus).forEach(function (u) {
      UW[u] = UW[u] || [];
      l.words.forEach(function (w) {
        if (!w.warn && UW[u].indexOf(w) < 0) UW[u].push(w);
      });
    });
  });
  // 学过的词（到第 no 课为止）
  function poolUpTo(no) {
    const seen = {},
      out = [];
    LS.slice(0, no).forEach(function (l) {
      l.words.forEach(function (w) {
        if (!w.warn && !seen[w.text]) {
          seen[w.text] = 1;
          out.push(w);
        }
      });
    });
    return out;
  }
  function learnedUnits(no) {
    const out = [];
    LS.slice(0, no).forEach(function (l) {
      l.units.concat(l.focus).forEach(function (u) {
        if (out.indexOf(u) < 0) out.push(u);
      });
    });
    return out;
  }
  function altsOf(u) {
    if (u.id === "sc9") return ["c"];
    if (u.id === "sg9") return ["g"];
    return u.g
      .replace(/^-/, "")
      .split(/[\s·+_]+/)
      .filter(Boolean)
      .map(function (x) {
        return x.toLowerCase();
      });
  }

  // ==== 题型 1：听音选字母（选项里不放同音、同形的，避免有两个都对）====
  function qSound(uid, ctx) {
    const u = U[uid];
    const pool = learnedUnits(ctx.no)
      .map(function (x) {
        return U[x];
      })
      .filter(function (x) {
        return x.id !== uid && x.g !== u.g && sndKey(x) !== sndKey(u);
      });
    const seenG = {};
    seenG[u.g] = 1;
    const opts = [u];
    shuffle(pool).forEach(function (x) {
      if (opts.length < 4 && !seenG[x.g]) {
        seenG[x.g] = 1;
        opts.push(x);
      }
    });
    if (opts.length < 2) return null;
    const o = shuffle(opts);
    return {
      type: "sound",
      tags: [uid],
      snd: u.snd,
      options: o.map(function (x) {
        return { text: x.g, id: x.id };
      }),
      answer: o.indexOf(u),
    };
  }

  // ==== 题型 2：听词选词（干扰项和答案只差一个音）====
  function oneDiff(a, b) {
    if (a.segs.length !== b.segs.length || a.text === b.text) return false;
    let d = 0;
    for (let i = 0; i < a.segs.length; i++)
      if (a.segs[i].t !== b.segs[i].t) d++;
    return d === 1;
  }
  function qWord(uid, ctx) {
    const base = (UW[uid] || []).filter(function (w) {
      return ctx.poolTexts[w.text] && ctx.pool.some(function (p) {
        return oneDiff(w, p);
      });
    });
    if (!base.length) return null;
    const w = pick(base);
    let near = shuffle(
      ctx.pool.filter(function (p) {
        return oneDiff(w, p);
      }),
    );
    const seen = {};
    seen[w.text] = 1;
    near = near
      .filter(function (p) {
        if (seen[p.text]) return false;
        seen[p.text] = 1;
        return true;
      })
      .slice(0, 2);
    if (near.length < 1) return null;
    const o = shuffle([w].concat(near));
    return {
      type: "word",
      tags: [uid],
      text: w.text,
      segs: w.segs,
      options: o.map(function (x) {
        return { text: x.text };
      }),
      answer: o.indexOf(w),
    };
  }

  // ==== 题型 3：读给家长听（可含「外星词」：把真词里的一个音换成别的词里的同位置的音）====
  function qRead(uid, ctx, alien) {
    const u = U[uid];
    const bases = (UW[uid] || []).filter(function (w) {
      return ctx.poolTexts[w.text] && w.segs.every(function (s) {
        return s.s.length;
      });
    });
    if (!bases.length) return null;
    const w = pick(bases);
    if (!alien)
      return {
        type: "read",
        tags: [uid],
        text: w.text,
        segs: w.segs,
        alien: false,
      };
    const alts = altsOf(u);
    for (let tries = 0; tries < 30; tries++) {
      const donor = pick(
        ctx.pool.filter(function (p) {
          return (
            p.segs.length === w.segs.length &&
            p.segs.every(function (s) {
              return s.s.length;
            })
          );
        }),
      );
      if (!donor) break;
      const idx = rnd(w.segs.length);
      if (alts.indexOf(w.segs[idx].t.toLowerCase()) >= 0 && w.segs.length > 1)
        continue; // 别把要测的音换掉
      if (donor.segs[idx].t === w.segs[idx].t) continue;
      const segs = w.segs.map(function (s, i) {
        return i === idx ? donor.segs[i] : s;
      });
      const text = segs
        .map(function (s) {
          return s.t;
        })
        .join("");
      if (ctx.poolTexts[text] || ctx.used[text]) continue;
      ctx.used[text] = 1;
      return { type: "read", tags: [uid], text: text, segs: segs, alien: true };
    }
    return {
      type: "read",
      tags: [uid],
      text: w.text,
      segs: w.segs,
      alien: false,
    };
  }

  // ==== 一套卷子 ====
  function makeCtx(no) {
    const pool = poolUpTo(no),
      pt = {};
    pool.forEach(function (w) {
      pt[w.text] = 1;
    });
    return { no: no, pool: pool, poolTexts: pt, used: {} };
  }
  function ask(kind, uid, ctx, alien) {
    let q =
      kind === "sound"
        ? qSound(uid, ctx)
        : kind === "word"
          ? qWord(uid, ctx)
          : qRead(uid, ctx, alien);
    if (!q) q = qSound(uid, ctx) || qRead(uid, ctx, false);
    return q;
  }
  // kind: 'lesson' 每课小测 6 题 | 'week' 周测 10 题 | 'stage' 阶段测 12 题
  function build(l, kind) {
    const ctx = makeCtx(l.no);
    const out = [];
    if (kind === "lesson") {
      const main = l.units.length ? l.units : l.focus;
      const old = l.reviewFrom.filter(function (u) {
        return main.indexOf(u) < 0;
      });
      const pat = [
        ["sound"],
        ["word"],
        ["sound"],
        ["word", "old"],
        ["read"],
        ["read", "alien"],
      ];
      pat.forEach(function (p, i) {
        const useOld = p[1] === "old" && old.length;
        const uid = useOld ? pick(old) : main[i % main.length];
        out.push(ask(p[0], uid, ctx, p[1] === "alien"));
      });
    } else {
      const units = kind === "week" ? l.weekUnits.slice() : stageUnits(l.stage);
      const n = kind === "week" ? 10 : 12;
      const list = [];
      const base = shuffle(units);
      for (let i = 0; i < n; i++) list.push(base[i % base.length]);
      const types = ["sound", "word", "read"];
      list.forEach(function (uid, i) {
        const t = types[i % 3];
        out.push(ask(t, uid, ctx, t === "read" && Math.floor(i / 3) % 2 === 1));
      });
    }
    return out.filter(Boolean);
  }
  function stageUnits(stage) {
    const out = [];
    LS.forEach(function (l) {
      if (l.stage === stage && l.kind === "learn")
        l.units.concat(l.focus).forEach(function (u) {
          if (out.indexOf(u) < 0) out.push(u);
        });
    });
    return out;
  }
  function isStageLast(l) {
    return (
      LS.filter(function (x) {
        return x.stage === l.stage;
      }).pop().no === l.no
    );
  }

  // ==== 汇总（家长页 / 复制给老师）====
  function dateStr(ts) {
    const d = new Date(ts);
    const p = function (n) {
      return (n < 10 ? "0" : "") + n;
    };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  const KIND = { lesson: "小测", week: "周测", stage: "阶段测" };
  function allStats(cur) {
    // 学过的音 + 有记录的音，按课程顺序
    const ids = learnedUnits(Math.min(cur, LS.length));
    Object.keys(rec.units).forEach(function (u) {
      if (ids.indexOf(u) < 0 && U[u]) ids.push(u);
    });
    return ids.map(statOf);
  }
  function summaryText(cur) {
    const done = Math.max(0, cur - 1),
      now = LS[Math.min(cur, LS.length) - 1];
    const st = allStats(cur);
    const weak = st.filter(function (s) {
      return s.weak;
    });
    const pct = function (s) {
      return s.n
        ? Math.round(s.rate * 100) + "%（" + s.ok + "/" + s.n + "）"
        : "没测过";
    };
    const lines = [];
    lines.push("【拼读学习汇报】" + dateStr(Date.now()));
    lines.push(
      "进度：已学完第 " +
        done +
        " 课 / 共 " +
        LS.length +
        " 课；现在在第 " +
        now.no +
        " 课（阶段 " +
        now.stage +
        "）",
    );
    const stages = rec.quizzes.filter(function (q) {
      return q.kind === "stage";
    });
    lines.push(
      "阶段测：" +
        (stages.length
          ? stages
              .map(function (q) {
                return (
                  dateStr(q.ts) +
                  " 阶段" +
                  q.stage +
                  " " +
                  q.score +
                  "/" +
                  q.total +
                  "（" +
                  Math.round((q.score / q.total) * 100) +
                  "%，" +
                  (q.score / q.total >= 0.8 ? "过关" : "未过关") +
                  "）"
                );
              })
              .join("；")
          : "还没做"),
    );
    const weeks = rec.quizzes
      .filter(function (q) {
        return q.kind === "week";
      })
      .slice(-4);
    lines.push(
      "周测（最近 " +
        weeks.length +
        " 次）：" +
        (weeks.length
          ? weeks
              .map(function (q) {
                return (
                  dateStr(q.ts) +
                  " 第" +
                  q.lesson +
                  "课 " +
                  q.score +
                  "/" +
                  q.total
                );
              })
              .join("；")
          : "还没做"),
    );
    const smalls = rec.quizzes
      .filter(function (q) {
        return q.kind === "lesson";
      })
      .slice(-6);
    lines.push(
      "每课小测（最近 " +
        smalls.length +
        " 次）：" +
        (smalls.length
          ? smalls
              .map(function (q) {
                return (
                  dateStr(q.ts) +
                  " 第" +
                  q.lesson +
                  "课 " +
                  q.score +
                  "/" +
                  q.total
                );
              })
              .join("；")
          : "还没做"),
    );
    lines.push(
      "薄弱音（" +
        weak.length +
        " 个；标准：正确率低于 80%，或最近 4 次错过 2 次）：" +
        (weak.length
          ? weak
              .map(function (s) {
                return label(s.id) + " " + pct(s);
              })
              .join("、")
          : "暂无"),
    );
    const tested = st.filter(function (s) {
      return s.n;
    });
    lines.push(
      "各音正确率：" +
        (tested.length
          ? tested
              .map(function (s) {
                return label(s.id) + " " + Math.round(s.rate * 100) + "%";
              })
              .join("，")
          : "还没有数据"),
    );
    return lines.join("\n");
  }

  G.Quiz = {
    build: build,
    isStageLast: isStageLast,
    stageUnits: stageUnits,
    addAnswer: addAnswer,
    addQuiz: addQuiz,
    statOf: statOf,
    allStats: allStats,
    summaryText: summaryText,
    label: label,
    dateStr: dateStr,
    KIND: KIND,
    resetRecords: resetRecords,
    records: function () {
      return rec;
    },
  };
})(window);
