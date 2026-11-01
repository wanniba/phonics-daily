/* curriculum.js —— 课程数据（唯一内容来源：../english/phonics-chart.md，顺序/音/例词/提示/例外/常见词全部照它）
 * 负责：单元(音)定义、词的拆音、按天分课、插入周五复习课、常见词两批。
 * 不负责：界面与播放（app.js / audio.js）。
 *
 * 词的写法：
 *   "cat"                普通词，按本课的「字母→音」表自动拆（最长匹配）
 *   "c a:ay k e:"        含空格 = 手写拆音；token = 字母[:音][+音]；`e:` = 不发音的字母
 *   "!get"               开头 ! = 例外词（页面上标 ⚠）
 */
(function (G) {
  "use strict";

  // ==== 字母/字母组合 → 默认音（音 id 对应 audio/<id>.mp3；数组 = 连着播的几个音）====
  const BASE = {
    s: "s",
    a: "ae",
    t: "t",
    p: "p",
    i: "ih",
    n: "n",
    c: "k",
    k: "k",
    e: "eh",
    h: "h",
    r: "r",
    m: "m",
    d: "d",
    g: "g",
    o: "o",
    u: "uh",
    l: "l",
    f: "f",
    b: "b",
    j: "dzh",
    v: "v",
    w: "w",
    x: ["k", "s"],
    y: "y",
    z: "z",
    qu: ["k", "w"],
    sh: "sh",
    ch: "ch",
    th: "th",
    wh: "w",
    ck: "k",
    ng: "ng",
    nk: ["ng", "k"],
    ff: "f",
    ll: "l",
    ss: "s",
    zz: "z",
    mb: "m",
    pp: "p",
    tt: "t",
    nn: "n",
  };

  // ==== 单元（一个「音」，对应对照表里的一行）====
  // g=屏幕上大大显示的字母(组合)；snd=点它听的音；ex=例词；tip/warn=家长看的提示/⚠
  const U = {};
  function unit(id, g, snd, ex, tip, warn, more) {
    U[id] = Object.assign(
      { id, g, snd, ex, tip: tip || "", warn: warn || "" },
      more || {},
    );
  }
  // 第 1 阶段：26 个字母
  unit("s", "s", "s", ["sun", "sit"], "像蛇「嘶嘶」，能拉长");
  unit("a", "a", "ae", ["apple", "cat"], "嘴张大，嘴角往两边拉");
  unit("t", "t", "t", ["top", "ten"], "舌尖弹一下，很短");
  unit("p", "p", "p", ["pig", "pen"], "嘴唇轻轻「噗」出一口气，不出声");
  unit("i", "i", "ih", ["insect", "pig"], "短短的，嘴微张");
  unit("n", "n", "n", ["net", "nut"], "舌尖顶上牙床，鼻子出声");
  unit("ck1", "c · k", "k", ["cat", "kid"], "两个字母同一个音，喉咙后面出气");
  unit("e", "e", "eh", ["egg", "bed"], "嘴半张，短");
  unit("h", "h", "h", ["hat", "hen"], "像哈气，很轻");
  unit("r", "r", "r", ["red", "run"], "嘴唇圆一点，舌头不碰任何地方");
  unit("m", "m", "m", ["mum", "map"], "闭嘴哼，能拉长");
  unit("d", "d", "d", ["dog", "dad"], "和 t 一样的位置，但声带要振动");
  unit("g", "g", "g", ["goat", "big"], "和 k 一样的位置，但声带要振动");
  unit(
    "o",
    "o",
    "o",
    ["octopus", "hot"],
    "嘴张圆（英音 /ɒ/、美音 /ɑ/，页面按设置里的口音播）",
  );
  unit("u", "u", "uh", ["umbrella", "cup"], "嘴放松，短促");
  unit("l", "l", "l", ["leg", "lip"], "舌尖顶上牙床");
  unit("f", "f", "f", ["fish", "fan"], "上牙轻咬下唇吹气，能拉长");
  unit("b", "b", "b", ["bed", "bus"], "和 p 一样的位置，但声带要振动");
  unit("j", "j", "dzh", ["jam", "jet"], "");
  unit("v", "v", "v", ["van", "vet"], "和 f 一样的位置，但声带要振动");
  unit("w", "w", "w", ["web", "wet"], "嘴唇先撮圆再放开");
  unit("x", "x", ["k", "s"], ["box", "fox"], "两个音，一般在词尾");
  unit("y", "y", "y", ["yes", "yak"], "在词首时是这个音");
  unit("z", "z", "z", ["zip", "zoo"], "像蜜蜂「嗡嗡」，能拉长");
  unit(
    "qu",
    "qu",
    ["k", "w"],
    ["queen", "quiz"],
    "q 后面几乎总跟着 u，当成一对来学",
  );
  // 第 3 阶段：两个字母读一个音
  unit("sh", "sh", "sh", ["ship", "fish", "shop"], "食指放嘴前「嘘—」");
  unit("ch", "ch", "ch", ["chip", "chin", "lunch"], "像火车 choo-choo");
  unit(
    "th1",
    "th",
    "th",
    ["thin", "bath", "three"],
    "舌尖从上下牙之间伸出一点点，吹气（不振动）",
  );
  unit(
    "th2",
    "th",
    "dh",
    ["this", "that", "them"],
    "同样的舌头位置，但喉咙振动",
    "",
    { mark: "voiced" },
  );
  unit("wh", "wh", "w", ["when", "whale", "what"], "读法和 w 一样");
  unit("ck", "ck", "k", ["duck", "back", "sock"], "只出现在短元音后面");
  unit("ng", "ng", "ng", ["ring", "song", "king"], "鼻音，嘴别闭");
  unit("nk", "nk", ["ng", "k"], ["pink", "bank", "think"], "ng 的音再加一个 k");
  unit(
    "ff",
    "ff",
    "f",
    ["off", "puff"],
    "短元音后面的 f、l、s、z 常常双写，读法不变",
  );
  unit("ll", "ll", "l", ["bell", "hill"], "双写，读法不变");
  unit("ss", "ss", "s", ["kiss", "miss"], "双写，读法不变");
  unit("zz", "zz", "z", ["buzz", "fizz"], "双写，读法不变");
  // 第 4 阶段：辅音连读（两个音都要读出来）
  const BL = {
    bl: ["black"],
    cl: ["clap"],
    fl: ["flag"],
    gl: ["glad"],
    pl: ["plum"],
    sl: ["slip"],
    br: ["brick"],
    cr: ["crab"],
    dr: ["drum"],
    fr: ["frog"],
    gr: ["grin"],
    pr: ["pram"],
    tr: ["trip"],
    sc: ["scan"],
    sk: ["skip"],
    sm: ["smell"],
    sn: ["snap"],
    sp: ["spot"],
    st: ["stop"],
    sw: ["swim"],
    spl: ["splash"],
    spr: ["spring"],
    str: ["string"],
    scr: ["scrub"],
  };
  Object.keys(BL).forEach(function (k) {
    const parts = k.split("").map(function (ch) {
      return ch === "c" ? "k" : ch;
    });
    unit(k, k, parts, BL[k], "两个音都要读出来，读得快、连在一起", "", {
      blend: true,
    });
  });
  [
    ["_st", "-st", ["s", "t"], "fast"],
    ["_nd", "-nd", ["n", "d"], "hand"],
    ["_mp", "-mp", ["m", "p"], "jump"],
    ["_nt", "-nt", ["n", "t"], "tent"],
    ["_lt", "-lt", ["l", "t"], "belt"],
    ["_ft", "-ft", ["f", "t"], "gift"],
  ].forEach(function (r) {
    unit(r[0], r[1], r[2], [r[3]], "在词尾，两个音都要读出来", "", {
      blend: true,
    });
  });
  // 第 5 阶段：魔法 e
  unit(
    "a_e",
    "a_e",
    "ay",
    ["cape", "tape", "cake"],
    "词尾的 e 不发音，让前面的 a 读成它的名字",
    "",
    { magic: true },
  );
  unit(
    "i_e",
    "i_e",
    "ie",
    ["kite", "pine", "bike"],
    "词尾的 e 不发音，让前面的 i 读成它的名字",
    "",
    { magic: true },
  );
  unit(
    "o_e",
    "o_e",
    "ow_long",
    ["hope", "note", "home"],
    "词尾的 e 不发音，让前面的 o 读成它的名字",
    "",
    { magic: true },
  );
  unit(
    "u_e",
    "u_e",
    ["y", "oo_long"],
    ["cube", "tube", "cute"],
    "读 /juː/ 或 /uː/（字母 U 的名字）",
    "",
    { magic: true },
  );
  unit("e_e", "e_e", "ee", ["Pete", "these"], "这一组少见", "", {
    magic: true,
  });
  // 第 6 阶段：两个元音一起走
  unit("ai", "ai", "ay", ["rain", "tail", "paint"], "多在词中间");
  unit("ay", "ay", "ay", ["play", "day", "say"], "多在词尾");
  unit("ee", "ee", "ee", ["feet", "see", "tree"], "");
  unit("ea", "ea", "ee", ["sea", "eat", "read"], "", "有时读短 e：head, bread");
  unit("ye", "y", "ee", ["happy", "baby", "funny"], "在词尾（多音节词）读长 e");
  unit("igh", "igh", "ie", ["night", "light", "high"], "gh 不发音");
  unit("ie", "ie", "ie", ["pie", "tie", "lie"], "");
  unit("yi", "y", "ie", ["my", "fly", "cry"], "在词尾（单音节词）读长 i");
  unit("oa", "oa", "ow_long", ["boat", "coat", "road"], "多在词中间");
  unit(
    "ow1",
    "ow",
    "ow_long",
    ["snow", "slow", "grow"],
    "",
    "也可能读 /aʊ/（见第 8 阶段 cow）",
  );
  unit("oo1", "oo", "oo_long", ["moon", "food", "zoo"], "");
  unit("ue", "ue · ew", "oo_long", ["blue", "glue", "new", "grew"], "");
  unit(
    "oo2",
    "oo",
    "oo_short",
    ["book", "look", "foot"],
    "同样是 oo，这一组读短音",
    "同样是 oo，这一组读短音",
  );
  // 第 7 阶段：元音加 r
  unit("ar", "ar", "ar", ["car", "star", "park", "farm"], "");
  unit("or", "or · ore", "aw", ["fork", "horse", "more", "store"], "");
  unit(
    "er",
    "er · ir · ur",
    "er",
    ["her", "bird", "girl", "turn", "nurse"],
    "三种写法同一个音；现阶段只要求会读",
  );
  unit("air", "air · are", "air", ["hair", "chair", "care", "share"], "");
  unit("ear", "ear", "ear", ["ear", "hear", "near"], "");
  unit(
    "ear2",
    "ear",
    "air",
    ["bear", "pear", "wear"],
    "ear 的例外读法",
    "ear 例外：读 /eə/",
  );
  // 第 8 阶段：滑动的元音
  unit("oi", "oi", "oy", ["coin", "oil", "point"], "多在词中间");
  unit("oy", "oy", "oy", ["boy", "toy", "enjoy"], "多在词尾");
  unit(
    "ou",
    "ou",
    "ow_diph",
    ["out", "house", "cloud"],
    "像被扎了一下「噢！」",
  );
  unit(
    "ow2",
    "ow",
    "ow_diph",
    ["cow", "now", "down"],
    "",
    "也可能读长 o（snow）",
  );
  unit("au", "au", "aw", ["haul", "August", "sauce"], "");
  unit("aw", "aw", "aw", ["saw", "draw", "paw"], "");
  // 第 9 阶段：特殊规则
  unit(
    "sc9",
    "c + e i y",
    "s",
    ["city", "ice", "face", "cycle"],
    "c 后面是 e、i、y 读 /s/（软 c）",
  );
  unit(
    "sg9",
    "g + e i y",
    "dzh",
    ["gem", "giant", "page"],
    "g 后面是 e、i、y 常读 /dʒ/（软 g）",
    "例外：get, girl, give",
  );
  unit("kn", "kn", "n", ["knee", "know", "knife"], "k 不发音");
  unit("wr", "wr", "r", ["write", "wrong", "wrap"], "w 不发音");
  unit("mb", "mb", "m", ["lamb", "climb", "thumb"], "b 不发音");
  unit("ph", "ph", "f", ["phone", "photo", "dolphin"], "");
  unit(
    "le",
    "-le",
    ["schwa", "l"],
    ["apple", "table", "little"],
    "在词尾读 /əl/",
  );
  unit(
    "tion",
    "-tion",
    ["sh", "schwa", "n"],
    ["station", "action"],
    "读 /ʃən/",
  );
  unit(
    "ed",
    "-ed",
    "t",
    ["jumped", "played", "wanted"],
    "过去式有三种读法：/t/、/d/、/ɪd/",
    "",
    {
      variants: [
        { label: "t", snd: "t" },
        { label: "d", snd: "d" },
        { label: "id", snd: ["ih", "d"] },
      ],
    },
  );
  unit("ym", "y", "ih", ["gym", "myth"], "y 在词中间读 /ɪ/");

  // ==== 课（只定义「有新音」的课；周五复习课在下面自动插入）====
  // stage 阶段号；units 新音；words 练习词；teams 本课特有的「字母组合→音」覆盖；focus 无新音时复习哪些音
  const C = [];
  function lesson(stage, units, words, teams, focus) {
    C.push({
      stage: stage,
      units: units,
      words: words,
      teams: teams || {},
      focus: focus || [],
    });
  }
  // --- 第 1 阶段（每课 1~2 个音；词只用已学的字母拼）---
  lesson(1, ["s", "a"], ["as"]);
  lesson(
    1,
    ["t", "p"],
    ["at", "sat", "sap", "tap", "pat", "taps", "pats", "spat"],
  );
  lesson(
    1,
    ["i", "n"],
    ["in", "sit", "sip", "tip", "pin", "tin", "nap", "pan", "tan", "nip"],
  );
  lesson(
    1,
    ["ck1", "e"],
    ["cat", "cap", "can", "kit", "pet", "net", "ten", "pen", "set"],
  );
  lesson(
    1,
    ["h", "r"],
    ["hat", "hit", "hen", "rat", "ran", "rip", "hip", "rap"],
  );
  lesson(
    1,
    ["m", "d"],
    ["mat", "map", "man", "dad", "red", "did", "mad", "sad", "pad", "den"],
  );
  lesson(
    1,
    ["g", "o"],
    ["dog", "got", "pot", "hot", "log", "cot", "rod", "hog"],
  );
  lesson(
    1,
    ["u", "l"],
    ["sun", "cup", "run", "hut", "mud", "nut", "leg", "lip", "let", "lid"],
  );
  lesson(
    1,
    ["f", "b"],
    ["fan", "fit", "fig", "big", "bed", "bat", "bus", "bug", "bun", "fun"],
  );
  lesson(1, ["j", "v"], ["jam", "jet", "jug", "van", "vet", "jog"]);
  lesson(
    1,
    ["w", "x"],
    ["web", "wet", "win", "wag", "box", "fox", "six", "mix", "wax"],
  );
  lesson(1, ["y", "z"], ["yes", "yak", "yet", "yum", "zip", "zap"]);
  lesson(1, ["qu"], ["quiz", "quit", "quip"]);
  // --- 第 2 阶段：拼读短单词（没有新音，每课盯一个元音）---
  lesson(2, [], ["cat", "map", "bag", "hat", "van", "jam", "sad", "tap"], {}, [
    "a",
  ]);
  lesson(2, [], ["bed", "pen", "net", "leg", "red", "wet", "ten", "hen"], {}, [
    "e",
  ]);
  lesson(2, [], ["pig", "sit", "fin", "big", "lip", "zip", "win", "kid"], {}, [
    "i",
  ]);
  lesson(2, [], ["hot", "dog", "top", "log", "box", "fox", "pot", "mop"], {}, [
    "o",
  ]);
  lesson(2, [], ["sun", "cup", "bus", "run", "bug", "hut", "mud", "nut"], {}, [
    "u",
  ]);
  lesson(
    2,
    [],
    [
      "bat",
      "bet",
      "bit",
      "bot",
      "but",
      "pan",
      "pen",
      "pin",
      "hat",
      "hit",
      "hot",
      "hut",
    ],
    {},
    ["a", "e", "i", "o", "u"],
  );
  // --- 第 3 阶段 ---
  lesson(
    3,
    ["sh", "ch"],
    ["ship", "fish", "shop", "chip", "chin", "lunch", "shed", "much"],
  );
  lesson(
    3,
    ["th1", "th2"],
    [
      "thin",
      "bath",
      "math",
      "path",
      "th:dh i s",
      "th:dh a t",
      "th:dh e m",
      "th:dh e n",
    ],
  );
  lesson(
    3,
    ["wh", "ck"],
    [
      "when",
      "whip",
      "whiz",
      "duck",
      "back",
      "sock",
      "neck",
      "pick",
      "kick",
      "lock",
    ],
  );
  lesson(
    3,
    ["ng", "nk"],
    [
      "ring",
      "song",
      "king",
      "sing",
      "long",
      "wing",
      "pink",
      "bank",
      "sink",
      "think",
      "junk",
    ],
  );
  lesson(
    3,
    ["ff", "ll"],
    [
      "off",
      "puff",
      "huff",
      "bell",
      "hill",
      "fill",
      "doll",
      "well",
      "sell",
      "tell",
    ],
  );
  lesson(
    3,
    ["ss", "zz"],
    ["kiss", "miss", "mess", "less", "pass", "buzz", "fizz", "jazz", "fuzz"],
  );
  // --- 第 4 阶段 ---
  lesson(
    4,
    ["bl", "cl"],
    ["black", "blot", "blob", "blink", "clap", "clip", "club", "clock"],
  );
  lesson(
    4,
    ["fl", "gl"],
    ["flag", "flip", "flat", "flash", "glad", "glum", "glen"],
  );
  lesson(
    4,
    ["pl", "sl"],
    ["plum", "plan", "plus", "plug", "slip", "slam", "slug", "sled"],
  );
  lesson(
    4,
    ["br", "cr"],
    ["brick", "bring", "brush", "brag", "crab", "crop", "crib", "crack"],
  );
  lesson(
    4,
    ["dr", "fr"],
    ["drum", "drip", "drop", "drink", "frog", "fresh", "frill"],
  );
  lesson(
    4,
    ["gr", "pr"],
    ["grin", "grab", "grip", "grub", "pram", "press", "prop", "print"],
  );
  lesson(4, ["tr"], ["trip", "trap", "truck", "trim", "track"]);
  lesson(
    4,
    ["sc", "sk"],
    ["scan", "scab", "scum", "skip", "skin", "skid", "skill", "skunk"],
  );
  lesson(
    4,
    ["sm", "sn"],
    ["smell", "smash", "smug", "snap", "snip", "sniff", "snug", "snack"],
  );
  lesson(
    4,
    ["sp", "st"],
    ["spot", "spin", "spill", "spell", "stop", "step", "stick", "stuff"],
  );
  lesson(4, ["sw"], ["swim", "swing", "swell", "swam"]);
  lesson(
    4,
    ["_st", "_nd"],
    [
      "fast",
      "list",
      "nest",
      "best",
      "dust",
      "hand",
      "sand",
      "band",
      "pond",
      "bend",
    ],
  );
  lesson(
    4,
    ["_mp", "_nt"],
    ["jump", "lamp", "camp", "bump", "tent", "hunt", "pant", "mint", "bent"],
  );
  lesson(
    4,
    ["_lt", "_ft"],
    ["belt", "melt", "felt", "hilt", "gift", "left", "lift", "raft"],
  );
  lesson(
    4,
    ["spl", "spr"],
    ["splash", "split", "splat", "spring", "sprint", "sprig"],
  );
  lesson(
    4,
    ["str", "scr"],
    ["string", "strip", "strap", "stress", "scrub", "scrap", "script"],
  );
  // --- 第 5 阶段：魔法 e ---
  lesson(
    5,
    ["a_e", "i_e"],
    [
      "cap",
      "c a:ay p e:",
      "tap",
      "t a:ay p e:",
      "c a:ay k e:",
      "g a:ay m e:",
      "n a:ay m e:",
      "l a:ay k e:",
      "kit",
      "k i:ie t e:",
      "pin",
      "p i:ie n e:",
      "b i:ie k e:",
      "f i:ie v e:",
      "t i:ie m e:",
      "r i:ie d e:",
    ],
  );
  lesson(
    5,
    ["o_e", "u_e"],
    [
      "hop",
      "h o:ow_long p e:",
      "not",
      "n o:ow_long t e:",
      "h o:ow_long m e:",
      "b o:ow_long n e:",
      "r o:ow_long p e:",
      "n o:ow_long s:z e:",
      "cub",
      "c u:y+oo_long b e:",
      "tub",
      "t u:y+oo_long b e:",
      "c u:y+oo_long t e:",
      "h u:y+oo_long g e:",
      "J u:oo_long n e:",
      "r u:oo_long l e:",
    ],
  );
  lesson(
    5,
    ["e_e"],
    ["pet", "P e:ee t e:", "th:dh e:ee s:z e:", "th e:ee m e:"],
  );
  // --- 第 6 阶段 ---
  lesson(
    6,
    ["ai", "ay"],
    [
      "rain",
      "tail",
      "paint",
      "train",
      "mail",
      "play",
      "day",
      "say",
      "way",
      "stay",
      "tray",
    ],
    { ai: "ay", ay: "ay" },
  );
  lesson(
    6,
    ["ee", "ea"],
    [
      "feet",
      "see",
      "tree",
      "bee",
      "keep",
      "sleep",
      "sea",
      "eat",
      "read",
      "tea",
      "beach",
      "leaf",
      "!h ea:eh d",
      "!b r ea:eh d",
    ],
    { ee: "ee", ea: "ee" },
  );
  lesson(
    6,
    ["ye", "igh"],
    [
      "h a pp:p y:ee",
      "b a:ay b y:ee",
      "f u nn:n y:ee",
      "c a n d y:ee",
      "night",
      "light",
      "high",
      "right",
      "sight",
      "fight",
    ],
    { igh: "ie" },
  );
  lesson(
    6,
    ["ie", "yi"],
    ["pie", "tie", "lie", "die", "my", "fly", "cry", "by", "try", "sky"],
    { ie: "ie", y: "ie" },
  );
  lesson(
    6,
    ["oa", "ow1"],
    [
      "boat",
      "coat",
      "road",
      "soap",
      "toad",
      "goat",
      "snow",
      "slow",
      "grow",
      "blow",
      "show",
    ],
    { oa: "ow_long", ow: "ow_long" },
  );
  lesson(
    6,
    ["oo1", "ue"],
    [
      "moon",
      "food",
      "zoo",
      "spoon",
      "pool",
      "room",
      "cool",
      "blue",
      "glue",
      "new",
      "grew",
      "clue",
      "few",
    ],
    { oo: "oo_long", ue: "oo_long", ew: "oo_long" },
  );
  lesson(6, ["oo2"], ["book", "look", "foot", "good", "cook", "wood"], {
    oo: "oo_short",
  });
  // --- 第 7 阶段 ---
  lesson(
    7,
    ["ar", "or"],
    [
      "car",
      "star",
      "park",
      "farm",
      "card",
      "jar",
      "barn",
      "fork",
      "h or s e:",
      "m ore",
      "s t ore",
      "corn",
      "born",
    ],
    { ar: "ar", or: "aw", ore: "aw" },
  );
  lesson(
    7,
    ["er", "air"],
    [
      "her",
      "bird",
      "girl",
      "turn",
      "n ur s e:",
      "fern",
      "dirt",
      "hurt",
      "hair",
      "chair",
      "c are",
      "sh are",
      "pair",
      "stair",
    ],
    { er: "er", ir: "er", ur: "er", air: "air", are: "air" },
  );
  lesson(
    7,
    ["ear", "ear2"],
    [
      "ear",
      "hear",
      "near",
      "dear",
      "year",
      "fear",
      "!b ear:air",
      "!p ear:air",
      "!w ear:air",
    ],
    { ear: "ear" },
  );
  // --- 第 8 阶段 ---
  lesson(
    8,
    ["oi", "oy"],
    [
      "coin",
      "oil",
      "point",
      "soil",
      "boil",
      "join",
      "boy",
      "toy",
      "e n j oy",
      "joy",
    ],
    { oi: "oy", oy: "oy" },
  );
  lesson(
    8,
    ["ou", "ow2"],
    [
      "out",
      "h ou s e:",
      "cloud",
      "loud",
      "shout",
      "found",
      "round",
      "cow",
      "now",
      "down",
      "brown",
      "town",
      "owl",
      "how",
      "!s n ow:ow_long",
    ],
    { ou: "ow_diph", ow: "ow_diph" },
  );
  lesson(
    8,
    ["au", "aw"],
    [
      "haul",
      "Au:aw g u s t",
      "s au:aw c:s e:",
      "haunt",
      "saw",
      "draw",
      "paw",
      "jaw",
      "claw",
      "lawn",
    ],
    { au: "aw", aw: "aw" },
  );
  // --- 第 9 阶段 ---
  lesson(
    9,
    ["sc9", "sg9"],
    [
      "c:s i t y:ee",
      "i:ie c:s e:",
      "f a:ay c:s e:",
      "c:s y:ie c le:schwa+l",
      "c:s e n t",
      "r a:ay c:s e:",
      "g:dzh e m",
      "g:dzh i:ie a:schwa n t",
      "p a:ay g:dzh e:",
      "!get",
      "!g ir:er l",
      "!g i v e:",
    ],
  );
  lesson(
    9,
    ["kn", "wr"],
    [
      "kn:n ee:ee",
      "kn:n ow:ow_long",
      "kn:n i:ie f e:",
      "kn:n i t",
      "wr:r i:ie t e:",
      "wr:r o ng",
      "wr:r a p",
      "wr:r i s t",
    ],
  );
  lesson(
    9,
    ["mb", "ph"],
    [
      "l a mb:m",
      "c l i:ie mb:m",
      "th u mb:m",
      "ph:f o:ow_long n e:",
      "ph:f o:ow_long t o:ow_long",
      "d o l ph:f i n",
    ],
  );
  lesson(
    9,
    ["le", "tion"],
    [
      "a pp:p le",
      "t a:ay b le",
      "l i tt:t le",
      "b o tt le",
      "c a n d le",
      "s t a:ay tion",
      "a c tion",
      "n a:ay tion",
      "m e n tion",
    ],
    { le: ["schwa", "l"], tion: ["sh", "schwa", "n"] },
  );
  lesson(
    9,
    ["ed", "ym"],
    [
      "j u m p ed:t",
      "h e l p ed:t",
      "p l ay:ay ed:d",
      "c a ll ed:d",
      "w a:o n t ed:ih+d",
      "n ee:ee d ed:ih+d",
      "g:dzh y:ih m",
      "m y:ih th",
    ],
  );

  // ==== 常见词两批（来自对照表「常见词」）====
  const SIGHT1 = [
    "the",
    "a",
    "I",
    "to",
    "you",
    "he",
    "she",
    "we",
    "me",
    "be",
    "was",
    "said",
    "are",
    "they",
    "my",
    "of",
  ];
  const SIGHT2 = [
    "one",
    "two",
    "come",
    "some",
    "do",
    "go",
    "no",
    "so",
    "what",
    "where",
    "there",
    "here",
    "have",
    "like",
    "love",
    "who",
  ];
  // 第 1 批：从第 4 个「新音课」开始每课最多 1 个（第 1~3 课一个常见词都不出现）；第 2 批：从第 32 个新音课开始每课 1 个（约学期过半）
  const SIGHT1_START = 4;
  const SIGHT2_START = 31;
  // 每个常见词里「不按规矩读」的那一段字母（页面只给这一段上色）；空串 = 没有可单挑的字母
  // （a / I 只有一个字母，like 按规矩读，只是常见）
  const SIGHT_IRR = {
    the: "e", a: "", I: "", to: "o", you: "ou", he: "e", she: "e", we: "e", me: "e", be: "e",
    was: "a", said: "ai", are: "a", they: "ey", my: "y", of: "f",
    one: "o", two: "wo", come: "o", some: "o", do: "o", go: "o", no: "o", so: "o",
    what: "a", where: "ere", there: "ere", here: "ere", have: "e", like: "", love: "o", who: "o",
  };
  // 把常见词切成 [{t:字母, irr:是否不按规矩读}]，给界面上色用
  function sightParts(w) {
    const irr = SIGHT_IRR[w] || "";
    const i = irr ? w.indexOf(irr) : -1;
    if (i < 0) return [{ t: w, irr: false }];
    const out = [];
    if (i > 0) out.push({ t: w.slice(0, i), irr: false });
    out.push({ t: irr, irr: true });
    if (i + irr.length < w.length) out.push({ t: w.slice(i + irr.length), irr: false });
    return out;
  }

  // ==== 拆音 ====
  function mapSound(sp) {
    return typeof sp === "string" ? sp.split("+") : sp;
  }
  function segment(word, teams) {
    const M = Object.assign({}, BASE, teams);
    if (word.indexOf(" ") >= 0) {
      // 手写
      return word.split(" ").map(function (tok) {
        const m = tok.split(":");
        if (m.length === 1) {
          const s = M[m[0].toLowerCase()];
          if (!s) throw new Error("无默认音: " + tok + " in " + word);
          return { t: m[0], s: [].concat(s) };
        }
        return { t: m[0], s: m[1] === "" ? [] : mapSound(m[1]) };
      });
    }
    const keys = Object.keys(M).sort(function (a, b) {
      return b.length - a.length;
    });
    const out = [];
    let i = 0;
    while (i < word.length) {
      const rest = word.slice(i).toLowerCase();
      const k = keys.find(function (kk) {
        return rest.indexOf(kk) === 0;
      });
      if (!k) throw new Error("拆不开: " + word + " @" + i);
      out.push({ t: word.substr(i, k.length), s: [].concat(M[k]) });
      i += k.length;
    }
    return out;
  }
  function plain(word) {
    return word
      .replace(/^!/, "")
      .replace(/:[^ ]*/g, "")
      .replace(/ /g, "");
  }
  function buildWord(raw, teams) {
    const warn = raw.charAt(0) === "!";
    const body = warn ? raw.slice(1) : raw;
    return { text: plain(body), segs: segment(body, teams), warn: warn };
  }

  // ==== 组装完整课表（含周五复习课）====
  const lessons = [];
  const seenUnits = []; // 已学过的 unit id（按课顺序）
  const bank = []; // 已出现过的练习词（给后面的课做「复习词」）
  let contentNo = 0;
  C.forEach(function (c) {
    contentNo++;
    const newSight = [];
    const i1 = contentNo - SIGHT1_START;
    if (i1 >= 0 && i1 < SIGHT1.length) newSight.push(SIGHT1[i1]);
    const i2 = contentNo - SIGHT2_START;
    if (i2 >= 0 && i2 < SIGHT2.length) newSight.push(SIGHT2[i2]);
    const teams = c.teams;
    const words = c.words.map(function (w) {
      return buildWord(w, teams);
    });
    const L = {
      no: 0,
      kind: "learn",
      stage: c.stage,
      units: c.units.slice(),
      focus: c.focus.slice(),
      words: words,
      newSight: newSight,
      reviewFrom: seenUnits.slice(),
      weekUnits: [],
    };
    lessons.push(L);
    c.units.forEach(function (u) {
      if (seenUnits.indexOf(u) < 0) seenUnits.push(u);
    });
    L.learnedAfter = seenUnits.slice();
    words.forEach(function (w) {
      bank.push(w);
    });
    if (contentNo % 4 === 0) {
      // 每 4 个新音课后接一节周五复习课
      const weekLessons = lessons
        .filter(function (x) {
          return x.kind === "learn";
        })
        .slice(-4);
      const wu = [];
      weekLessons.forEach(function (x) {
        x.units.concat(x.focus).forEach(function (u) {
          if (wu.indexOf(u) < 0) wu.push(u);
        });
      });
      const ww = [];
      weekLessons.forEach(function (x) {
        x.words.slice(0, 3).forEach(function (w) {
          ww.push(w);
        });
      });
      lessons.push({
        no: 0,
        kind: "review",
        stage: c.stage,
        units: [],
        focus: wu,
        words: ww.slice(0, 8),
        newSight: [],
        reviewFrom: seenUnits.slice(),
        weekUnits: wu,
      });
    }
  });
  lessons.forEach(function (l, i) {
    l.no = i + 1;
  });

  // 前面所有课出现过的常见词（给复习闪卡用）
  const sightBefore = [];
  lessons.forEach(function (l) {
    l.sightBefore = sightBefore.slice();
    l.newSight.forEach(function (w) {
      sightBefore.push(w);
    });
  });

  // ==== 词 → emoji（拼读页配图；听词选词只用有图的词）====
  const EMO = {
    sun: "☀️",
    apple: "🍎",
    cat: "🐱",
    pig: "🐷",
    pen: "🖊️",
    insect: "🐛",
    net: "🥅",
    nut: "🥜",
    kid: "🧒",
    egg: "🥚",
    bed: "🛏️",
    hat: "👒",
    hen: "🐔",
    red: "🟥",
    run: "🏃",
    mum: "👩",
    map: "🗺️",
    dog: "🐶",
    dad: "👨",
    goat: "🐐",
    octopus: "🐙",
    hot: "🥵",
    umbrella: "☂️",
    cup: "☕",
    leg: "🦵",
    lip: "👄",
    fish: "🐟",
    bus: "🚌",
    van: "🚐",
    web: "🕸️",
    wet: "💧",
    box: "📦",
    fox: "🦊",
    queen: "👑",
    ship: "🚢",
    shop: "🏪",
    chip: "🍟",
    ring: "💍",
    king: "🤴",
    bell: "🔔",
    duck: "🦆",
    sock: "🧦",
    rain: "🌧️",
    tree: "🌳",
    boat: "⛵",
    coat: "🧥",
    moon: "🌙",
    book: "📖",
    car: "🚗",
    star: "⭐",
    fork: "🍴",
    horse: "🐴",
    bird: "🐦",
    ear: "👂",
    bear: "🐻",
    pear: "🍐",
    chair: "🪑",
    coin: "🪙",
    boy: "👦",
    toy: "🧸",
    house: "🏠",
    cloud: "☁️",
    cow: "🐄",
    saw: "🪚",
    paw: "🐾",
    phone: "📱",
    thumb: "👍",
    lamb: "🐑",
    dolphin: "🐬",
    city: "🏙️",
    ice: "🧊",
    face: "😀",
    gem: "💎",
    snow: "❄️",
    sea: "🌊",
    tea: "🍵",
    leaf: "🍃",
    pie: "🥧",
    fly: "🪰",
    light: "💡",
    blue: "🟦",
    zoo: "🦁",
    pool: "🏊",
    spoon: "🥄",
    flag: "🚩",
    clock: "🕐",
    drum: "🥁",
    frog: "🐸",
    crab: "🦀",
    truck: "🚚",
    swim: "🏊",
    kite: "🪁",
    bike: "🚲",
    cake: "🎂",
    game: "🎮",
    home: "🏠",
    bone: "🦴",
    nose: "👃",
    cute: "🥰",
    jam: "🍓",
    jet: "✈️",
    bug: "🐞",
    bat: "🦇",
    bun: "🍞",
    six: "6️⃣",
    sing: "🎤",
    pink: "🩷",
    tent: "⛺",
    nest: "🪺",
    hand: "✋",
    camp: "⛺",
    lunch: "🍱",
    hut: "🛖",
    log: "🪵",
    pot: "🍲",
    table: "🪑",
    apple2: "🍏",
    plum: "🍑",
    crown: "👑",
    brush: "🪥",
    sled: "🛷",
    snap: "🫰",
  };

  G.Curriculum = {
    EMO: EMO,
    U: U,
    lessons: lessons,
    BASE: BASE,
    SIGHT1: SIGHT1,
    SIGHT2: SIGHT2,
    SIGHT_IRR: SIGHT_IRR,
    sightParts: sightParts,
    segment: segment,
    buildWord: buildWord,
  };
})(window);
