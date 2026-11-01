/* audio.js —— 发声引擎
 * 负责：① 单音录音(audio/*.mp3)用 WebAudio 播放，可连播（拼接多个音）；② 单词用浏览器自带朗读(speechSynthesis)。
 * 不负责：界面、课程。
 * 还负责：中文指令语音（设备自带声音，没有就只显示文字）、seq() 把「中文指令 + 要听的音/词」串成一串。
 * 约束：iOS 必须在「点击（click / touchend）」里第一次触发声音 → unlock() 挂在 pointerdown + touchend + click 上；被挡时通过 setHandlers 通知界面显示「点我听」。
 */
(function (G) {
  "use strict";

  // ==== 设置（localStorage 读写全部 try/catch，读不到就用默认）====
  const KEY = "phonics.settings.v1";
  const settings = { accent: "us", voiceURI: "", rate: 0.85 };
  try {
    Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || "{}"));
  } catch (e) {
    /* 读不到就默认 */
  }
  function saveSettings() {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch (e) {
      /* 存不了也照常用 */
    }
  }

  // ==== 单音（WebAudio）====
  const AC = G.AudioContext || G.webkitAudioContext;
  let ctx = null;
  const buffers = {}; // id -> Promise<AudioBuffer>
  let active = []; // 正在播的 source
  let seqToken = 0;
  const GAP = 0.07; // 连播两个音之间的间隔（秒）

  function resolveId(id) {
    if (id === "o") return settings.accent === "gb" ? "o_gb" : "o_us";
    return id;
  }
  function decode(ab) {
    return new Promise(function (ok, bad) {
      const p = ctx.decodeAudioData(ab, ok, bad); // 老 Safari 只认回调写法
      if (p && p.then) p.then(ok, bad);
    });
  }
  function load(id) {
    id = resolveId(id);
    if (!buffers[id]) {
      buffers[id] = fetch("audio/" + id + ".mp3")
        .then(function (r) {
          if (!r.ok) throw new Error("audio " + id + " HTTP " + r.status);
          return r.arrayBuffer();
        })
        .then(decode);
    }
    return buffers[id];
  }
  // iOS 的「静音拨片」会把 WebAudio 静掉；把音频会话声明成 playback 就不受影响（Safari 16.4+）
  try {
    if (G.navigator && G.navigator.audioSession) G.navigator.audioSession.type = "playback";
  } catch (e) {
    /* 老系统没有这个接口 */
  }
  // 被浏览器挡住（没有被点击解锁）时的回调：界面据此显示「点我听」
  let onBlocked = null;
  let onOk = null;
  function blocked() {
    if (onBlocked) onBlocked();
  }
  function ok() {
    if (onOk) onOk();
  }
  // ev = 触发它的事件类型。iOS 只认 click / touchend 当「用户点击」，pointerdown / touchstart 不算
  let primed = false;
  let unlockUttering = false; // 解锁用的那条无声朗读还在队里时，别把它当成「正在说话」去 cancel
  function unlock(ev) {
    if (AC && (!ctx || ctx.state === "closed")) {
      try {
        ctx = new AC();
        primed = false;
      } catch (e) {
        ctx = null;
      }
    }
    const real = ev === "click" || ev === "touchend";
    if (ctx && ctx.state !== "running") {
      try {
        const p = ctx.resume(); // 老 Safari 不返回 Promise
        if (p && p.catch) p.catch(function () { /* 下次点击再试 */ });
      } catch (e) {
        /* 忽略 */
      }
    }
    if (ctx && real && (!primed || ctx.state !== "running")) {
      // iOS 老办法：在点击里同步放一小段静音，WebAudio 才算真正解锁
      try {
        const b = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = b;
        src.connect(ctx.destination);
        src.start(0);
        primed = true;
      } catch (e) {
        /* 忽略 */
      }
    }
    if (G.speechSynthesis && real && !unlock.spoke) {
      // iOS：第一次朗读必须在真正的点击里；只在 click / touchend 里做一次
      unlock.spoke = true;
      try {
        const u = new SpeechSynthesisUtterance(".");
        u.volume = 0;
        unlockUttering = true;
        u.onend = u.onerror = function () { unlockUttering = false; };
        setTimeout(function () { unlockUttering = false; }, 1500);
        G.speechSynthesis.speak(u);
      } catch (e) {
        unlockUttering = false;
      }
    }
  }
  // 确认 ctx 真的在跑；挂起就在这次调用里再 resume 一次，等 300ms，还不行就是被挡了
  function ensureRunning() {
    if (!ctx) return Promise.resolve(false);
    if (ctx.state === "running") return Promise.resolve(true);
    return new Promise(function (done) {
      const t = setTimeout(function () {
        done(ctx.state === "running");
      }, 300);
      try {
        const p = ctx.resume();
        if (p && p.then)
          p.then(
            function () {
              clearTimeout(t);
              done(ctx.state === "running");
            },
            function () {
              clearTimeout(t);
              done(false);
            },
          );
      } catch (e) {
        clearTimeout(t);
        done(false);
      }
    });
  }
  function stopTones() {
    seqToken++;
    active.forEach(function (s) {
      try {
        s.stop();
      } catch (e) {
        /* 已停 */
      }
    });
    active = [];
  }
  // 播一个音或一串音；spec = 'b' 或 ['b','l']；返回播完后 resolve 的 Promise
  function tone(spec) {
    stopTones();
    const my = seqToken;
    const ids = [].concat(spec);
    if (!ctx) {
      blocked(); // 还没有任何点击解锁过
      return Promise.resolve();
    }
    return Promise.all([ensureRunning()].concat(ids.map(load)))
      .then(function (res) {
        if (my !== seqToken) return;
        if (!res[0]) {
          blocked(); // 浏览器还没允许出声：别静默失败，让孩子点一下
          return;
        }
        ok();
        const bufs = res.slice(1);
        let t = ctx.currentTime + 0.02;
        bufs.forEach(function (b) {
          const src = ctx.createBufferSource();
          src.buffer = b;
          src.connect(ctx.destination);
          src.start(t);
          active.push(src);
          t += b.duration + GAP;
        });
        return new Promise(function (done) {
          setTimeout(done, Math.max(0, (t - ctx.currentTime) * 1000));
        });
      })
      .catch(function (e) {
        console.warn("[tone]", e);
      });
  }
  function preload(ids) {
    if (ctx)
      [].concat(ids).forEach(function (i) {
        load(i).catch(function () {
          /* 播放时再报 */
        });
      });
  }

  // ==== 单词（speechSynthesis）====
  const NOVELTY =
    /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Wobble|Fred|Good News|Jester|Junior|Organ|Ralph|Superstar|Trinoids|Whisper|Zarvox|Kathy)/;
  const PREFER = {
    us: [
      "Samantha (Premium)",
      "Samantha (Enhanced)",
      "Samantha",
      "Ava (Premium)",
      "Ava (Enhanced)",
      "Allison (Enhanced)",
      "Allison",
      "Zoe (Premium)",
    ],
    gb: [
      "Serena (Premium)",
      "Serena (Enhanced)",
      "Daniel (Enhanced)",
      "Daniel",
      "Serena",
      "Kate (Enhanced)",
      "Kate",
      "Oliver (Enhanced)",
    ],
  };
  let voices = [];
  function refreshVoices() {
    if (!G.speechSynthesis) return;
    voices = G.speechSynthesis.getVoices().filter(function (v) {
      return /^en[-_]/i.test(v.lang) && !NOVELTY.test(v.name);
    });
  }
  if (G.speechSynthesis) {
    refreshVoices();
    G.speechSynthesis.addEventListener &&
      G.speechSynthesis.addEventListener("voiceschanged", refreshVoices); // Safari 异步加载
  }
  function langOf(v) {
    return v.lang.replace("_", "-");
  }
  function quality(v) {
    return /Premium/.test(v.name) ? 2 : /Enhanced/.test(v.name) ? 1 : 0;
  }
  function pickVoice() {
    refreshVoices();
    if (settings.voiceURI) {
      const hit = voices.find(function (v) {
        return v.voiceURI === settings.voiceURI;
      });
      if (hit) return hit;
    }
    const want = settings.accent === "gb" ? "en-GB" : "en-US";
    const list = PREFER[settings.accent === "gb" ? "gb" : "us"];
    for (let i = 0; i < list.length; i++) {
      const hit = voices.find(function (v) {
        return v.name === list[i] && langOf(v) === want;
      });
      if (hit) return hit;
    }
    const same = voices
      .filter(function (v) {
        return langOf(v) === want;
      })
      .sort(function (a, b) {
        return quality(b) - quality(a);
      });
    return same[0] || voices[0] || null;
  }
  // 中文声音：设备自带（macOS / iOS 的 Tingting、Meijia 之类）；找不到就返回 null，界面只显示文字、不出声
  let zhVoices = [];
  function refreshZh() {
    if (!G.speechSynthesis) return;
    zhVoices = G.speechSynthesis.getVoices().filter(function (v) {
      return /^zh([-_]|$)/i.test(v.lang) && !/yue|HK/i.test(v.lang + v.name);
    });
  }
  if (G.speechSynthesis) {
    refreshZh();
    G.speechSynthesis.addEventListener && G.speechSynthesis.addEventListener("voiceschanged", refreshZh);
  }
  const ZH_PREFER = [/ting-?ting|tingting/i, /mei-?jia/i, /li-?mu|lili|yu-?shu|sinji/i, /Premium|Enhanced/i];
  function pickZh() {
    refreshZh();
    const cn = zhVoices.filter(function (v) { return /^zh[-_](CN|Hans)/i.test(v.lang); });
    const list = cn.length ? cn : zhVoices;
    for (let i = 0; i < ZH_PREFER.length; i++) {
      const hit = list.find(function (v) { return ZH_PREFER[i].test(v.name); });
      if (hit) return hit;
    }
    return list[0] || null;
  }
  function stopSpeech() {
    if (G.speechSynthesis)
      try {
        G.speechSynthesis.cancel();
      } catch (e) {
        /* 忽略 */
      }
  }
  // 把一句话排进浏览器朗读队列（不 cancel、不延时，所以在点击里调用就是「从点击里发出」）
  // lang = 'en' | 'zh'；返回 {done: Promise, cancel()}；opts.onstart 开口时回调
  function utter(text, lang, opts) {
    const ss = G.speechSynthesis;
    opts = opts || {};
    let fin;
    const done = new Promise(function (r) { fin = r; });
    if (!ss) { fin(); return { done: done }; }
    const u = new SpeechSynthesisUtterance(text);
    const v = lang === "zh" ? pickZh() : pickVoice();
    if (v) {
      u.voice = v;
      u.lang = v.lang;
    } else {
      u.lang = lang === "zh" ? "zh-CN" : settings.accent === "gb" ? "en-GB" : "en-US";
    }
    u.rate = lang === "zh" ? 0.95 : settings.rate;
    let started = false;
    const t = setTimeout(fin, (lang === "zh" ? 2500 : 4000) + text.length * 250); // 防止个别浏览器不触发 end
    const watch = setTimeout(function () {
      if (!started && !ss.speaking) blocked(); // 2 秒还没开口：多半是没被点击解锁
    }, 2000);
    u.onstart = function () {
      started = true;
      clearTimeout(watch);
      ok();
      opts.onstart && opts.onstart();
    };
    u.onend = u.onerror = function () {
      clearTimeout(t);
      clearTimeout(watch);
      fin();
    };
    try {
      if (ss.paused) ss.resume(); // Safari 偶尔卡在 paused，后面所有朗读都不出声
      ss.speak(u);
    } catch (e) {
      clearTimeout(t);
      clearTimeout(watch);
      fin();
    }
    return { done: done };
  }
  // 要开口前先清场：有别的话在读才 cancel；WebKit 里 cancel() 后立刻 speak() 会被一起吞掉，所以这种情况让出一拍（返回 true）
  function clearSpeech() {
    const ss = G.speechSynthesis;
    const busy = !!ss && !unlockUttering && (ss.speaking || ss.pending);
    if (busy) stopSpeech();
    return busy;
  }
  function say(text) {
    if (!G.speechSynthesis) return Promise.resolve();
    const busy = clearSpeech();
    if (!busy) return utter(text, "en").done;
    return new Promise(function (res) {
      setTimeout(function () { utter(text, "en").done.then(res); }, 60);
    });
  }

  // ==== 一串话 / 音：steps = [{zh:'中文'} | {en:'单词'} | {snd:'m' 或 ['b','l']}]，每步可带 on()（这一步开始时）====
  // 连着的几句话（zh / en）会在同一时刻一次排进朗读队列：只要 seq() 是在点击里调用的，这些话就都「从点击里发出」。
  // 没有中文声音时 zh 步不出声：界面靠 on() 换气泡文字，默认停一会儿让人读（带 nodwell 的不停，用于点击里要立刻出声的指令）；返回 Promise，被新的 seq / stopAll 打断时不 resolve 给旧的 done。
  let seqId = 0;
  function seq(steps) {
    const my = ++seqId;
    stopTones();
    const busy = clearSpeech();
    return new Promise(function (finish) {
      function live() { return my === seqId; }
      function run(i) {
        if (!live()) return;
        if (i >= steps.length) { finish(true); return; }
        const s = steps[i];
        if (s.zh && !pickZh() && !s.nodwell) {
          // 没有中文声音：气泡文字停一会儿让人读，再往下
          s.on && s.on();
          setTimeout(function () { run(i + 1); }, 900 + s.zh.length * 140);
          return;
        }
        if (s.snd) {
          s.on && s.on();
          tone(s.snd).then(function () { run(i + 1); });
          return;
        }
        // 一组连着的朗读步：先全部排队，最后一句念完再继续
        let j = i;
        const group = [];
        while (j < steps.length && !steps[j].snd) {
          if (steps[j].zh && !pickZh() && !steps[j].nodwell && j > i) break; // 要停顿的无声中文步另起一轮
          const st = steps[j++];
          if (st.zh && !pickZh()) { st.on && st.on(); continue; } // 没有中文声音：只换文字（nodwell 的那种不停顿）
          group.push(st);
        }
        if (!group.length) { run(j); return; }
        let last = null;
        group.forEach(function (st) {
          last = utter(st.zh || st.en, st.zh ? "zh" : "en", { onstart: function () { live() && st.on && st.on(); } });
        });
        last.done.then(function () { run(j); });
      }
      if (busy && steps[0] && !steps[0].snd) setTimeout(function () { run(0); }, 60);
      else run(0);
    });
  }
  // 答对的小音效：两个上行的音（合成的，不用文件）
  function ding() {
    if (!ctx) return;
    try {
      [660, 880].forEach(function (f, i) {
        const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + i * 0.12;
        o.type = "sine"; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.3);
      });
    } catch (e) { /* 没声音也不影响 */ }
  }
  function stopAll() {
    seqId++;
    stopTones();
    stopSpeech();
  }

  G.Snd = {
    settings: settings,
    saveSettings: saveSettings,
    unlock: unlock,
    setHandlers: function (b, o) {
      onBlocked = b;
      onOk = o;
    },
    // 单独放一个音 / 一个词，会打断还在进行的 seq()（否则旧的那串会接着往下放）
    tone: function (spec) {
      seqId++;
      return tone(spec);
    },
    say: function (text) {
      seqId++;
      return say(text);
    },
    seq: seq,
    hasZh: function () {
      return !!pickZh();
    },
    ding: ding,
    stopAll: stopAll,
    preload: preload,
    voices: function () {
      refreshVoices();
      return voices;
    },
    currentVoice: pickVoice,
    resolveId: resolveId,
    hasWebAudio: !!AC,
    hasSpeech: !!G.speechSynthesis,
  };
})(window);
