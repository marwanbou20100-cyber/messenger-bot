"use strict";

/**
 * do.js — منفّذ الأوامر الذكي
 * يفهم الطلبات الطبيعية بالعربية ويُنفّذ أوامر البوت تلقائياً.
 * يستخدم Pollinations.ai (مجاني، لا يحتاج API key).
 */

const { mutedThreads, lockedThreads } = require("../state");
const pendingReplies = require("../utils/pendingReplies");
const config         = require("../config.json");

// ── System prompt: يعرّف البوت بجميع أوامره ─────────────────────────────────
const SYSTEM = `أنت محلل أوامر لبوت فيسبوك اسمه Madox. مهمتك الوحيدة: تحليل طلب المشرف واختيار الأمر المناسب.

الأوامر المتاحة:
[GROUP]
• mute — كتم البوت (يتوقف عن الرد للجميع)
• unmute — رفع الكتم عن البوت
• lock_on — قفل البوت (يرد للمشرفين فقط)
• lock_off — فك قفل البوت
• announce TEXT — إرسال إعلان رسمي
• rename TEXT — تغيير اسم المجموعة
• lockname TEXT — قفل اسم المجموعة بشكل معين
• rules TEXT — تحديث قواعد المجموعة
• poll QUESTION|OPT1|OPT2 — إنشاء استطلاع
• kick USERID REASON — طرد عضو (USERID رقم أو mention)
• warn USERID REASON — تحذير عضو
• ban USERID — حظر عضو نهائياً
• unwarn USERID — رفع تحذير عن عضو

[BOT]
• ping — فحص سرعة الاستجابة
• restart — إعادة تشغيل البوت
• members — عرض عدد الأعضاء
• info — معلومات المجموعة
• simstatus — إحصائيات محاكي الإنسان
• botadmin_add USERID — إضافة مشرف بوت
• botadmin_remove USERID — إزالة مشرف بوت

[COMMUNICATION]
• autoreply_on — تفعيل الرد التلقائي
• autoreply_off — إيقاف الرد التلقائي
• say TEXT — إرسال رسالة نصية عادية

قواعد الإجابة:
- أجب بـ JSON فقط، لا تكتب أي نص آخر.
- USERID يكون إما رقم الحساب أو "mentioned" إذا كان المشرف ذكر شخصاً.
- إذا الطلب غير واضح أو لا يوجد أمر مناسب: command = null.

الشكل المطلوب:
{"command":"اسم_الأمر","args":["حجة1","حجة2"],"explain":"شرح قصير بالعربية"}
`;

// ── استدعاء Pollinations AI ───────────────────────────────────────────────────
async function analyzeRequest(userText) {
  const url =
    "https://text.pollinations.ai/" +
    encodeURIComponent(userText) +
    "?model=openai&system=" +
    encodeURIComponent(SYSTEM) +
    "&json=true&seed=" + Math.floor(Math.random() * 9999);

  const res = await fetch(url, {
    headers: { "User-Agent": "Madox-Bot/2.1" },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error("AI: خطأ HTTP " + res.status);
  const raw = (await res.text()).trim();

  // استخرج JSON من الرد
  const match = raw.match(/\{[\s\S]*?\}/);
  if (!match) throw new Error("لم يُعثر على JSON في رد الذكاء الاصطناعي");
  return JSON.parse(match[0]);
}

// ── منفّذ الأوامر ─────────────────────────────────────────────────────────────
async function executeDecision(api, event, commands, decision) {
  const { threadID, senderID, mentions } = event;
  const cmd  = decision.command;
  const args = decision.args || [];

  // دالة مساعدة: جلب أول mention أو أول arg كـ userID
  function resolveUser() {
    const mentionID = Object.keys(mentions || {})[0];
    if (mentionID) return mentionID;
    const a = args[0];
    if (a && a !== "mentioned" && /^\d+$/.test(a)) return a;
    return null;
  }

  switch (cmd) {

    // ── Group commands ────────────────────────────────────────────────────────
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
      const text = args.join(" ");
      if (!text) return "❌ لم يُحدد نص الإعلان.";
      let senderName = senderID;
      try { const i = await api.getUserInfo([senderID]); senderName = i[senderID]?.name || senderID; } catch {}
      await api.sendMessage(
        "📢  إ ع ل ا ن\n━━━━━━━━━━━━━━\n\n" + text + "\n\n━━━━━━━━━━━━━━\n◈ بواسطة · " + senderName,
        threadID
      );
      return null; // رسالة الإعلان هي الرد
    }

    case "rename": {
      const name = args.join(" ");
      if (!name) return "❌ لم يُحدد الاسم الجديد.";
      await api.gcname(name, threadID);
      return "✅ تم تغيير اسم المجموعة إلى: " + name;
    }

    case "lockname": {
      const name = args.join(" ");
      if (!name) return "❌ لم يُحدد الاسم المراد قفله.";
      const lcmd = commands.get("lockname");
      if (lcmd) await lcmd.execute({ api, event: { ...event, isGroup: true }, args: [name] });
      return "🔒 تم قفل اسم المجموعة: " + name;
    }

    case "rules": {
      const text = args.join(" ");
      const rcmd = commands.get("rules");
      if (rcmd) await rcmd.execute({ api, event: { ...event, isGroup: true }, args: ["set", ...args] });
      else await api.sendMessage("📋 القواعد الجديدة:\n" + text, threadID);
      return null;
    }

    case "poll": {
      const pcmd = commands.get("poll");
      if (pcmd) await pcmd.execute({ api, event: { ...event, isGroup: true }, args });
      else await api.sendMessage("📊 " + args.join(" | "), threadID);
      return null;
    }

    case "kick": {
      const uid = resolveUser();
      if (!uid) return "❌ حدد العضو المراد طرده (mention أو رقم الحساب).";
      const reason = args.slice(1).join(" ") || "بقرار المشرف";
      try {
        await api.removeUserFromGroup(uid, threadID);
        return "🦵 تم طرد " + uid + "\nالسبب: " + reason;
      } catch (e) { return "❌ تعذّر الطرد: " + e.message; }
    }

    case "warn": {
      const wcmd = commands.get("warn");
      if (!wcmd) return "❌ أمر warn غير محمّل.";
      const uid = resolveUser();
      if (!uid) return "❌ حدد العضو المراد تحذيره.";
      const fakeEvent = {
        ...event, isGroup: true,
        mentions: { [uid]: "@" + uid, ...(mentions || {}) },
      };
      await wcmd.execute({ api, event: fakeEvent, args: [uid, ...args.slice(1)] });
      return null;
    }

    case "ban": {
      const bcmd = commands.get("ban");
      const uid  = resolveUser();
      if (!uid) return "❌ حدد العضو المراد حظره.";
      if (bcmd) await bcmd.execute({ api, event: { ...event, isGroup: true, mentions: { [uid]: "@" + uid } }, args: [uid] });
      return null;
    }

    case "unwarn": {
      const wcmd = commands.get("warn");
      const uid  = resolveUser();
      if (!uid) return "❌ حدد العضو.";
      if (wcmd) await wcmd.execute({
        api,
        event: { ...event, isGroup: true, mentions: { [uid]: "@" + uid } },
        args: ["unwarn", uid],
      });
      return null;
    }

    case "ping": {
      const pcmd = commands.get("ping");
      if (pcmd) await pcmd.execute({ api, event: { ...event, isGroup: true }, args: [] });
      return null;
    }

    case "restart": {
      const rcmd = commands.get("restart");
      if (rcmd) await rcmd.execute({ api, event: { ...event, isGroup: true }, args: [] });
      return null;
    }

    case "members": {
      const mcmd = commands.get("members");
      if (mcmd) await mcmd.execute({ api, event: { ...event, isGroup: true }, args: [] });
      return null;
    }

    case "info": {
      const icmd = commands.get("info");
      if (icmd) await icmd.execute({ api, event: { ...event, isGroup: true }, args: [] });
      return null;
    }

    case "simstatus": {
      const sc = commands.get("simstatus");
      if (sc) await sc.execute({ api, event: { ...event, isGroup: true }, args: [] });
      return null;
    }

    case "botadmin_add": {
      const uid = args[0];
      if (!uid) return "❌ حدد رقم الحساب.";
      const bcmd = commands.get("botadmin");
      if (bcmd) await bcmd.execute({ api, event: { ...event, isGroup: true }, args: ["add", uid] });
      return null;
    }

    case "botadmin_remove": {
      const uid = args[0];
      if (!uid) return "❌ حدد رقم الحساب.";
      const bcmd = commands.get("botadmin");
      if (bcmd) await bcmd.execute({ api, event: { ...event, isGroup: true }, args: ["remove", uid] });
      return null;
    }

    case "autoreply_on": {
      const acmd = commands.get("autoreply");
      if (acmd) await acmd.execute({ api, event: { ...event, isGroup: true }, args: ["on"] });
      return null;
    }

    case "autoreply_off": {
      const acmd = commands.get("autoreply");
      if (acmd) await acmd.execute({ api, event: { ...event, isGroup: true }, args: ["off"] });
      return null;
    }

    case "say": {
      const text = args.join(" ");
      if (!text) return "❌ لم يُحدد النص.";
      await api.sendMessage(text, threadID);
      return null;
    }

    case null:
    case undefined:
      return "🤔 " + (decision.explain || "لم أفهم الطلب. حاول بصياغة أوضح.");

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
          "أكتب طلبك بالعربية وسأنفّذه تلقائياً.",
          "",
          "أمثلة:",
          "• -do اكتم المجموعة",
          "• -do أرسل إعلان: المجموعة ستُغلق غداً",
          "• -do قفل البوت على المشرفين",
          "• -do غير اسم المجموعة إلى نخبة 2026",
          "• -do حذّر @user لأنه يسيء الأدب",
          "• -do اطرد @user",
        ].join("\n"),
        threadID
      );
    }

    await api.sendMessage("🧠 جاري تحليل طلبك...", threadID);

    let decision;
    try {
      decision = await analyzeRequest(request);
    } catch (e) {
      return api.sendMessage("❌ خطأ في الذكاء الاصطناعي: " + e.message, threadID);
    }

    // أخبر المشرف بما سيفعله
    const preview = [
      "🤖 فهمت الطلب:",
      "━━━━━━━━━━━━━━",
      "📌 الأمر : " + (decision.command || "لا يوجد"),
      "💡 الشرح : " + (decision.explain || "—"),
    ].join("\n");
    await api.sendMessage(preview, threadID);

    // نفّذ
    try {
      const result = await executeDecision(api, event, commands, decision);
      if (result) await api.sendMessage("✅ " + result, threadID);
    } catch (e) {
      await api.sendMessage("❌ فشل التنفيذ: " + e.message, threadID);
    }
  },
};
