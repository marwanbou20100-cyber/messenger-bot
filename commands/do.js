"use strict";

/**
 * do.js — منفّذ الأوامر الذكي (v2)
 * يفهم الطلبات الطبيعية بالعربية ويُنفّذ أوامر البوت تلقائياً.
 * - يجرّب 3 نماذج Pollinations مختلفة تلقائياً عند 429
 * - يُعيد المحاولة مع تأخير تصاعدي
 * - يرجع للتحليل المحلي (regex) إذا فشل الإنترنت كلياً
 */

const { mutedThreads, lockedThreads } = require("../state");
const config = require("../config.json");

// ── نماذج الذكاء الاصطناعي (يجرّبها بالترتيب) ──────────────────────────────
const AI_MODELS = ["openai", "mistral", "llama"];

const SYSTEM = `أنت محلل أوامر لبوت فيسبوك اسمه Madox. مهمتك الوحيدة: تحليل طلب المشرف واختيار الأمر المناسب.

الأوامر المتاحة:
• mute — كتم البوت (يتوقف عن الرد للجميع)
• unmute — رفع الكتم عن البوت
• lock_on — قفل البوت (يرد للمشرفين فقط)
• lock_off — فك قفل البوت
• announce TEXT — إرسال إعلان رسمي (TEXT = نص الإعلان)
• rename TEXT — تغيير اسم المجموعة
• lockname TEXT — قفل اسم المجموعة
• rules TEXT — تحديث قواعد المجموعة
• poll QUESTION|OPT1|OPT2 — إنشاء استطلاع
• kick USERID REASON — طرد عضو
• warn USERID REASON — تحذير عضو
• ban USERID — حظر عضو
• unwarn USERID — رفع تحذير
• ping — فحص سرعة الاستجابة
• restart — إعادة تشغيل البوت
• members — عرض الأعضاء
• info — معلومات المجموعة
• simstatus — حالة محاكي الإنسان
• botadmin_add USERID — إضافة مشرف بوت
• botadmin_remove USERID — إزالة مشرف بوت
• autoreply_on — تفعيل الرد التلقائي
• autoreply_off — إيقاف الرد التلقائي
• say TEXT — إرسال رسالة عادية

قواعد الإجابة:
- أجب بـ JSON فقط، لا تكتب أي نص آخر أبداً.
- إذا ذكر المشرف @شخص فاستخدم "mentioned" كـ USERID.
- إذا الطلب غير واضح أو لا يوجد أمر مناسب: command = null.
الشكل: {"command":"اسم_الأمر","args":["حجة1","حجة2"],"explain":"شرح بالعربية"}`;

// ── تأخير ─────────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── استدعاء نموذج واحد ───────────────────────────────────────────────────────
async function tryModel(model, userText) {
  const url =
    "https://text.pollinations.ai/" +
    encodeURIComponent(userText) +
    "?model=" + model +
    "&system=" + encodeURIComponent(SYSTEM) +
    "&json=true&seed=" + Math.floor(Math.random() * 99999);

  const res = await fetch(url, {
    headers: { "User-Agent": "Madox-Bot/2.1" },
    signal: AbortSignal.timeout(22000),
  });

  if (res.status === 429) throw Object.assign(new Error("429"), { code: 429 });
  if (!res.ok)           throw new Error("HTTP " + res.status);

  const raw   = (await res.text()).trim();
  const match = raw.match(/\{[\s\S]*?\}/);
  if (!match) throw new Error("لا JSON في الرد");
  return JSON.parse(match[0]);
}

// ── تحليل محلي احتياطي (بدون إنترنت) ───────────────────────────────────────
function localFallback(text) {
  const t = text;
  const has = (...kw) => kw.some(k => t.includes(k));

  if (has("اكتم","كتم","صامت","اصمت"))                        return { command:"mute",       args:[], explain:"كتم البوت" };
  if (has("ارفع الكتم","رفع الكتم","فك الكتم","افتح الكتم")) return { command:"unmute",     args:[], explain:"رفع الكتم" };
  if (has("قفل","اقفل") && !has("اسم","رانك"))               return { command:"lock_on",    args:[], explain:"قفل البوت" };
  if (has("فك القفل","فك الق","افتح القفل"))                  return { command:"lock_off",   args:[], explain:"فك القفل" };
  if (has("اطرد","طرد","اخرج"))                               return { command:"kick",       args:["mentioned"], explain:"طرد عضو" };
  if (has("حذّر","حذر","تحذير","وارن"))                       return { command:"warn",       args:["mentioned"], explain:"تحذير عضو" };
  if (has("احظر","حظر","بان"))                                return { command:"ban",        args:["mentioned"], explain:"حظر عضو" };
  if (has("اعلان","أعلن","ابلغ","بلّغ"))                      return { command:"announce",   args: text.split(/[:،]/g).slice(1).map(s=>s.trim()).filter(Boolean), explain:"إعلان" };
  if (has("اسم","رنيم","سمّ","سمي") && has("المجموعة","الغروب","الجروب")) return { command:"rename", args:[text.replace(/.*(?:المجموعة|الغروب|الجروب|إلى|الى|لـ|ل )s*/i,"").trim()], explain:"تغيير الاسم" };
  if (has("ريستارت","اعد تشغيل","أعد تشغيل","اعادة تشغيل"))  return { command:"restart",    args:[], explain:"إعادة التشغيل" };
  if (has("بينج","ping","السرعة","الاستجابة"))                return { command:"ping",       args:[], explain:"فحص السرعة" };
  if (has("اعضاء","أعضاء","عدد"))                             return { command:"members",    args:[], explain:"عرض الأعضاء" };
  if (has("معلومات","info","بيانات المجموعة"))                return { command:"info",       args:[], explain:"معلومات المجموعة" };
  if (has("استطلاع","تصويت","بول"))                           return { command:"poll",       args:[text], explain:"استطلاع" };
  if (has("قواعد","قوانين"))                                  return { command:"rules",      args:[text], explain:"قواعد المجموعة" };
  if (has("قل","أرسل","ارسل") && !has("اعلان","إعلان"))       return { command:"say",        args:[text.replace(/^(?:قل|أرسل|ارسل)[:\s]*/,"").trim()], explain:"إرسال رسالة" };

  return { command:null, explain:"لم أتعرف على الأمر، حاول بصياغة أوضح." };
}

// ── جلب قرار الذكاء الاصطناعي (مع retry و fallback) ─────────────────────────
async function getDecision(userText) {
  // جرّب كل نموذج مع backoff
  for (let i = 0; i < AI_MODELS.length; i++) {
    const model = AI_MODELS[i];
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await tryModel(model, userText);
        result._source = model; // للتتبع
        return result;
      } catch (e) {
        const is429 = e.code === 429 || e.message.includes("429");
        const delay = is429 ? (attempt === 0 ? 3000 : 7000) : 1500;
        if (i < AI_MODELS.length - 1 || attempt < 1) {
          await sleep(delay);
        }
      }
    }
  }
  // Fallback محلي
  const local = localFallback(userText);
  local._source = "local";
  return local;
}

// ── منفّذ الأوامر ─────────────────────────────────────────────────────────────
async function executeDecision(api, event, commands, decision) {
  const { threadID, senderID, mentions } = event;
  const cmd  = decision.command;
  const args = decision.args || [];

  function resolveUser() {
    const mid = Object.keys(mentions || {})[0];
    if (mid) return mid;
    const a = args.find(x => x !== "mentioned" && /^\d{10,}$/.test(x));
    return a || null;
  }

  async function delegate(name, fakeArgs, fakeEvent) {
    const c = commands.get(name);
    if (!c) return "⚠️ أمر [" + name + "] غير محمّل.";
    await c.execute({ api, event: fakeEvent || event, args: fakeArgs || [] });
    return null;
  }

  switch (cmd) {
    case "mute":
      mutedThreads.add(threadID);
      return "🔇 تم كتم البوت في هذه المجموعة.";

    case "unmute":
      mutedThreads.delete(threadID);
      return "🔊 تم رفع الكتم — البوت نشط الآن.";

    case "lock_on":
      lockedThreads.add(threadID);
      return "🔒 تم قفل البوت — يستجيب للمشرفين فقط.";

    case "lock_off":
      lockedThreads.delete(threadID);
      return "🔓 تم فك قفل البوت — يستجيب للجميع.";

    case "announce": {
      const text = args.join(" ").trim();
      if (!text) return "❌ لم يُحدد نص الإعلان.";
      let name = senderID;
      try { const i = await api.getUserInfo([senderID]); name = i[senderID]?.name || senderID; } catch {}
      await api.sendMessage(
        "📢  إ ع ل ا ن\n━━━━━━━━━━━━━━\n\n" + text + "\n\n━━━━━━━━━━━━━━\n◈ بواسطة · " + name,
        threadID
      );
      return null;
    }

    case "rename": {
      const name = args.join(" ").trim();
      if (!name) return "❌ لم يُحدد الاسم الجديد.";
      await api.gcname(name, threadID);
      return "✅ تم تغيير اسم المجموعة إلى: " + name;
    }

    case "lockname":
      return delegate("lockname", args);

    case "rules":
      return delegate("rules", ["set", ...args]);

    case "poll":
      return delegate("poll", args);

    case "kick": {
      const uid = resolveUser();
      if (!uid) return "❌ حدد العضو (mention أو رقم الحساب).";
      const reason = args.filter(a => a !== uid && a !== "mentioned").join(" ") || "بقرار المشرف";
      try {
        await api.removeUserFromGroup(uid, threadID);
        return "🦵 تم طرد العضو.\nالسبب: " + reason;
      } catch (e) { return "❌ تعذّر الطرد: " + e.message; }
    }

    case "warn": {
      const uid = resolveUser();
      if (!uid) return "❌ حدد العضو (mention أو رقم الحساب).";
      const reason = args.filter(a => a !== uid && a !== "mentioned").join(" ") || "بقرار المشرف";
      return delegate("warn", [uid, reason], {
        ...event, mentions: { [uid]: "@user", ...(mentions||{}) }
      });
    }

    case "ban": {
      const uid = resolveUser();
      if (!uid) return "❌ حدد العضو.";
      return delegate("ban", [uid], {
        ...event, mentions: { [uid]: "@user", ...(mentions||{}) }
      });
    }

    case "unwarn": {
      const uid = resolveUser();
      if (!uid) return "❌ حدد العضو.";
      return delegate("warn", ["unwarn", uid], {
        ...event, mentions: { [uid]: "@user", ...(mentions||{}) }
      });
    }

    case "ping":       return delegate("ping");
    case "restart":    return delegate("restart");
    case "members":    return delegate("members");
    case "info":       return delegate("info");
    case "simstatus":  return delegate("simstatus");

    case "botadmin_add":    return delegate("botadmin", ["add",    args[0]]);
    case "botadmin_remove": return delegate("botadmin", ["remove", args[0]]);

    case "autoreply_on":  return delegate("autoreply", ["on"]);
    case "autoreply_off": return delegate("autoreply", ["off"]);

    case "say": {
      const text = args.join(" ").trim();
      if (!text) return "❌ لم يُحدد النص.";
      await api.sendMessage(text, threadID);
      return null;
    }

    case null:
    case undefined:
      return "🤔 " + (decision.explain || "لم أفهم الطلب، حاول بصياغة أوضح.");

    default:
      return "⚠️ الأمر [" + cmd + "] غير مدعوم حالياً.";
  }
}

// ── الأمر الرئيسي ─────────────────────────────────────────────────────────────
module.exports = {
  name: "do",
  aliases: ["افعل", "نفذ", "اوامر", "طلب"],
  description: "نفّذ أوامر البوت بلغة طبيعية (ذكاء اصطناعي).",
  usage: "do <طلبك بالعربية>",
  category: "Admin",
  adminOnly: true,

  async execute({ api, event, args, commands }) {
    const { threadID } = event;
    const request = args.join(" ").trim();

    if (!request) {
      return api.sendMessage(
        [
          "🤖 منفّذ الأوامر الذكي",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "اكتب طلبك بالعربية:",
          "",
          "• -do اكتم المجموعة",
          "• -do أرسل إعلان: المجموعة ستُغلق غداً",
          "• -do قفل البوت على المشرفين",
          "• -do غير اسم المجموعة إلى نخبة 2026",
          "• -do حذّر @user لأنه يسيء الأدب",
          "• -do اطرد @user",
          "• -do أعد تشغيل البوت",
        ].join("\n"),
        threadID
      );
    }

    const thinking = await api.sendMessage("🧠 أحلّل طلبك...", threadID).catch(()=>null);

    let decision;
    try {
      decision = await getDecision(request);
    } catch (e) {
      return api.sendMessage("❌ فشل التحليل: " + e.message, threadID);
    }

    // مصدر الذكاء
    const sourceLabel = decision._source === "local"
      ? "📱 تحليل محلي (بدون إنترنت)"
      : "🌐 نموذج: " + decision._source;

    // معاينة القرار
    const preview = [
      "🤖 قرار الذكاء الاصطناعي",
      "━━━━━━━━━━━━━━━━━━━━━━",
      "📌 الأمر   : " + (decision.command || "لا يوجد"),
      "💡 الشرح   : " + (decision.explain || "—"),
      "   " + sourceLabel,
    ].join("\n");

    await api.sendMessage(preview, threadID);

    // تنفيذ
    try {
      const result = await executeDecision(api, event, commands, decision);
      if (result) await api.sendMessage("✅ " + result, threadID);
    } catch (e) {
      await api.sendMessage("❌ فشل التنفيذ: " + e.message, threadID);
    }
  },
};
