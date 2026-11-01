/* audio.js —— 发声引擎
 * 负责：① 单音录音(audio/*.mp3)用 WebAudio 播放，可连播（拼接多个音）；② 单词用浏览器自带朗读(speechSynthesis)。
 * 不负责：界面、课程。
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
  function unlock(ev) {
    if (AC && (!ctx || ctx.state === "closed")) {
      try {
        ctx = new AC();
      } catch (e) {
        ctx = null;
      }
    }
    if (ctx && ctx.state !== "running") {
      try {
        const p = ctx.resume(); // 老 Safari 不返回 Promise
        if (p && p.catch) p.catch(function () { /* 下次点击再试 */ });
      } catch (e) {
        /* 忽略 */
      }
    }
    const real = ev === "click" || ev === "touchend";
    if (G.speechSynthesis && real && !unlock.spoke) {
      // iOS：第一次朗读必须在真正的点击里；只在 click / touchend 里做一次
      unlock.spoke = true;
      try {
        const u = new SpeechSynthesisUtterance(".");
        u.volume = 0;
        G.speechSynthesis.speak(u);
      } catch (e) {
        /* 忽略 */
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
  function stopSpeech() {
    if (G.speechSynthesis)
      try {
        G.speechSynthesis.cancel();
      } catch (e) {
        /* 忽略 */
      }
  }
  function say(text) {
    const ss = G.speechSynthesis;
    const busy = !!ss && (ss.speaking || ss.pending);
    stopSpeech();
    if (!ss) return Promise.resolve();
    return new Promise(function (done) {
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice();
      if (v) {
        u.voice = v;
        u.lang = v.lang;
      } else {
        u.lang = settings.accent === "gb" ? "en-GB" : "en-US";
      }
      u.rate = settings.rate;
      let started = false;
      const t = setTimeout(done, 4000); // 防止个别浏览器不触发 end
      const watch = setTimeout(function () {
        if (!started && !ss.speaking) blocked(); // 2 秒还没开口：多半是没被点击解锁
      }, 2000);
      u.onstart = function () {
        started = true;
        clearTimeout(watch);
        ok();
      };
      u.onend = u.onerror = function () {
        clearTimeout(t);
        clearTimeout(watch);
        done();
      };
      function go() {
        try {
          if (ss.paused) ss.resume(); // Safari 偶尔卡在 paused，后面所有朗读都不出声
          ss.speak(u);
        } catch (e) {
          clearTimeout(t);
          clearTimeout(watch);
          done();
        }
      }
      // WebKit：cancel() 之后立刻 speak()，这句会被一起吞掉；有东西在读时让出一拍
      if (busy) setTimeout(go, 60);
      else go();
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
    tone: tone,
    say: say,
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
