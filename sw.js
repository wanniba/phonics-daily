/* sw.js —— 让网页可装到主屏幕并断网可用。
 * 负责：安装时预缓存全部网页文件；取文件「先走网络（3 秒超时、绕过 HTTP 缓存），失败才用缓存」，拿到的新文件写回缓存。
 * 不负责：进度（在 localStorage）、课程内容。
 * 预缓存清单由 tools/check-precache.py 与实际发布文件比对（publish.sh 发布前跑），改文件后清单对不上会发布失败。
 */
"use strict";

const CACHE = "phonics-v1"; // 名字不用随发版改：新文件靠「先走网络 + 写回」更新，清单外的旧条目在 install 时清掉
const NET_TIMEOUT_MS = 3000;

// ==== 预缓存清单（相对 sw.js 所在目录；sw.js 自己不在内）====
// PRECACHE-BEGIN
const PRECACHE = [
  "index.html",
  "style.css",
  "manifest.webmanifest",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "js/app.js",
  "js/audio.js",
  "js/curriculum.js",
  "js/modules.js",
  "js/quiz.js",
  "js/sources.js",
  "js/today.js",
  "audio/LICENSE.md",
  "audio/ae.mp3",
  "audio/air.mp3",
  "audio/ar.mp3",
  "audio/aw.mp3",
  "audio/ay.mp3",
  "audio/b.mp3",
  "audio/ch.mp3",
  "audio/d.mp3",
  "audio/dh.mp3",
  "audio/dzh.mp3",
  "audio/ear.mp3",
  "audio/ee.mp3",
  "audio/eh.mp3",
  "audio/er.mp3",
  "audio/f.mp3",
  "audio/g.mp3",
  "audio/h.mp3",
  "audio/ie.mp3",
  "audio/ih.mp3",
  "audio/k.mp3",
  "audio/l.mp3",
  "audio/m.mp3",
  "audio/n.mp3",
  "audio/ng.mp3",
  "audio/o_gb.mp3",
  "audio/o_us.mp3",
  "audio/oo_long.mp3",
  "audio/oo_short.mp3",
  "audio/ow_diph.mp3",
  "audio/ow_long.mp3",
  "audio/oy.mp3",
  "audio/p.mp3",
  "audio/r.mp3",
  "audio/s.mp3",
  "audio/schwa.mp3",
  "audio/sh.mp3",
  "audio/t.mp3",
  "audio/th.mp3",
  "audio/uh.mp3",
  "audio/v.mp3",
  "audio/w.mp3",
  "audio/y.mp3",
  "audio/z.mp3",
];
// PRECACHE-END

const abs = (p) => new URL(p, self.registration.scope).href;

// ==== 安装 / 激活 ====
self.addEventListener("install", (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const want = PRECACHE.map(abs);
      // cache:"reload" 绕过 HTTP 缓存，保证预缓存的是线上最新
      await Promise.all(
        want.map(async (u) => {
          const r = await fetch(new Request(u, { cache: "reload" }));
          if (!r.ok) throw new Error(u + " HTTP " + r.status);
          await cache.put(u, r);
        })
      );
      for (const k of await cache.keys()) {
        // 清单外的旧条目（已删除的文件）清掉；index 的目录写法（scope 根）保留
        if (!want.includes(k.url) && k.url !== abs("./")) await cache.delete(k);
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
      await self.clients.claim();
    })()
  );
});

// ==== 取文件：先走网络，失败才用缓存 ====
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const net = fetch(new Request(req.url, { cache: "reload", credentials: "same-origin" })).then(
    async (res) => {
      if (res.status === 200) {
        try {
          await (await caches.open(CACHE)).put(req.url, res.clone());
        } catch (err) {
          /* 写不进缓存也照常返回 */
        }
      }
      return res;
    }
  );
  // 3 秒内没回来就先用缓存（网络那头继续跑，回来后仍会写进缓存）；缓存里没有就继续等网络
  const timeout = new Promise((_, no) => setTimeout(no, NET_TIMEOUT_MS, new Error("timeout")));
  try {
    return await Promise.race([net, timeout]);
  } catch (err) {
    const hit = await fromCache(req);
    if (hit) {
      net.catch(() => {});
      return hit;
    }
    return net;
  }
}

async function fromCache(req) {
  const hit = await caches.match(req, { ignoreSearch: true });
  if (hit) return hit;
  if (req.mode === "navigate") return caches.match(abs("index.html")); // 打开 scope 根 / 带参数的地址
  return undefined;
}
