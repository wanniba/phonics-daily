/* sources.js —— 每个单音文件的来源（「关于」页展示，也是署名/许可证的出处）
 * how: rec=Commons 录音裁剪；say=macOS say 音素模式生成；mix=由两段录音交叉淡入拼成
 * 多音单元（x / qu / nk / 辅音连读 / -le / -tion / -ed…）不另有文件：播放时把上面的单音依次连播。
 */
(function (G) {
  "use strict";
  const CC = "CC BY-SA 3.0";
  // [文件 id, IPA, Commons 文件名, 许可证]
  const REC = [
    ["s", "/s/", "Voiceless alveolar fricative.ogg", CC],
    ["t", "/t/", "Voiceless alveolar plosive.ogg", CC],
    ["p", "/p/", "Voiceless bilabial plosive.ogg", CC],
    ["n", "/n/", "Alveolar nasal.ogg", CC],
    ["k", "/k/", "Voiceless velar plosive.ogg", CC],
    ["h", "/h/", "Voiceless glottal fricative.ogg", CC],
    ["r", "/r/", "Alveolar approximant.ogg", CC],
    ["m", "/m/", "Bilabial nasal.ogg", CC],
    ["d", "/d/", "Voiced alveolar plosive.ogg", CC],
    ["g", "/g/", "Voiced velar plosive.ogg", CC],
    ["l", "/l/", "Alveolar lateral approximant.ogg", CC],
    ["f", "/f/", "Voiceless labiodental fricative.ogg", CC],
    ["b", "/b/", "Voiced bilabial plosive.ogg", CC],
    ["dzh", "/dʒ/", "Voiced palato-alveolar affricate.ogg", "公有领域"],
    ["v", "/v/", "Voiced labiodental fricative.ogg", CC],
    ["w", "/w/", "Voiced labio-velar approximant.ogg", CC],
    ["y", "/j/", "Palatal approximant.ogg", CC],
    ["z", "/z/", "Voiced alveolar fricative.ogg", CC],
    ["sh", "/ʃ/", "Voiceless postalveolar fricative.ogg", CC],
    ["ch", "/tʃ/", "Voiceless palato-alveolar affricate.ogg", CC],
    ["th", "/θ/", "Voiceless dental fricative.ogg", CC],
    ["dh", "/ð/", "Voiced dental fricative.ogg", CC],
    ["ng", "/ŋ/", "Velar nasal.ogg", CC],
    ["ae", "/æ/", "Near-open front unrounded vowel.ogg", CC],
    ["ih", "/ɪ/", "Near-close near-front unrounded vowel.ogg", CC],
    ["eh", "/e/", "Open-mid front unrounded vowel.ogg", CC],
    ["o_gb", "/ɒ/", "Open back rounded vowel.ogg", CC],
    ["o_us", "/ɑ/", "Open back unrounded vowel.ogg", CC],
    ["uh", "/ʌ/", "Open-mid back unrounded vowel.ogg", CC],
    ["oo_short", "/ʊ/", "Near-close near-back rounded vowel.ogg", CC],
    ["ee", "/iː/", "Close front unrounded vowel.ogg", CC],
    ["oo_long", "/uː/", "Close back rounded vowel.ogg", CC],
    ["aw", "/ɔː/", "Open-mid back rounded vowel.ogg", CC],
    ["er", "/ɜː/", "Open-mid central unrounded vowel.ogg", CC],
    ["schwa", "/ə/", "Mid-central vowel.ogg", CC],
    ["ar", "/ɑː/", "Open back unrounded vowel.ogg", CC],
  ];
  const SAY = [
    ["ay", "/eɪ/", "eY"],
    ["ie", "/aɪ/", "AY"],
    ["ow_long", "/əʊ/", "OW"],
    ["oy", "/ɔɪ/", "OY"],
    ["ow_diph", "/aʊ/", "AW"],
  ];
  const MIX = [
    ["air", "/eə/", "/e/ → /ə/"],
    ["ear", "/ɪə/", "/ɪ/ → /ə/"],
  ];

  const rows = [];
  REC.forEach(function (r) {
    rows.push({
      id: r[0],
      ipa: r[1],
      how: "rec",
      src: "Wikimedia Commons：" + r[2],
      lic: r[3],
      url:
        "https://commons.wikimedia.org/wiki/File:" +
        encodeURIComponent(r[2].replace(/ /g, "_")),
    });
  });
  SAY.forEach(function (r) {
    rows.push({
      id: r[0],
      ipa: r[1],
      how: "say",
      src: "macOS say 音素模式（Samantha，[[" + r[2] + "]]）",
      lic: "自制",
      url: "",
    });
  });
  MIX.forEach(function (r) {
    rows.push({
      id: r[0],
      ipa: r[1],
      how: "mix",
      src: "由两段 Commons 录音交叉淡入拼成（" + r[2] + "）",
      lic: CC,
      url: "",
    });
  });
  G.AudioSources = rows;
})(window);
