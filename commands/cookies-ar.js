"use strict";
  const fs             = require("fs");
  const path           = require("path");
  const config         = require("../config.json");
  const pendingReplies = require("../utils/pendingReplies");

  function isAdmin(id) { return (config.bot.adminIDs || []).includes(String(id)); }

  const APP_STATE_PATH = path.resolve(__dirname, "../appstate.json");
  const GH_TOKEN  = process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN || "";
  const GH_REPO   = "marwanbou20100-cyber/messenger-bot";

  async function pushToGitHub(newState) {
    if (!GH_TOKEN) return;
    try {
      const getRes = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/appstate.json`, {
        headers: { Authorization: `token ${GH_TOKEN}`, "User-Agent": "Madox-Bot" }
      });
      const j = await getRes.json();
      await fetch(`https://api.github.com/repos/${GH_REPO}/contents/appstate.json`, {
        method: "PUT",
        headers: { Authorization: `token ${GH_TOKEN}`, "Content-Type": "application/json", "User-Agent": "Madox-Bot" },
        body: JSON.stringify({
          message: "Update appstate.json via bot command",
          content: Buffer.from(JSON.stringify(newState, null, 2)).toString("base64"),
          sha: j.sha,
        })
      });
    } catch {}
  }

  module.exports = {
    name: "كوكيز",
    aliases: ["cookies", "كوكي"],
    description: "تحديث كوكيز البوت مباشرةً من المحادثة.",
    usage: "-كوكيز",
    category: "Admin",
    adminOnly: false,

    async execute({ api, event, args }) {
      const { threadID, senderID } = event;
      if (!isAdmin(senderID)) return api.sendMessage("🔒 هذا الأمر للمشرف الرئيسي فقط.", threadID);

      await api.sendMessage(
        "🍪 تحديث الكوكيز\n" +
        "───────────────\n" +
        "1. سجّل دخول فيسبوك في المتصفح\n" +
        "2. ثبّت إضافة Cookie Editor\n" +
        "3. اضغط Export → Copy\n" +
        "4. أرسل الـ JSON هنا الآن\n\n" +
        "⚠️ سيُعاد تشغيل البوت بعد التحديث.",
        threadID
      );

      pendingReplies.set(senderID, {
        handler: async (text, api2, ev2) => {
          let parsed;
          try { parsed = JSON.parse(text); } catch {
            await api2.sendMessage("❌ JSON غير صالح. تأكد من نسخ الكوكيز كاملاً.", ev2.threadID);
            return;
          }
          if (!Array.isArray(parsed) || parsed.length === 0) {
            await api2.sendMessage("❌ يجب أن تكون الكوكيز مصفوفة JSON صالحة.", ev2.threadID);
            return;
          }
          const hasCUser = parsed.some(c => c && c.key === "c_user");
          if (!hasCUser) {
            await api2.sendMessage("❌ الكوكيز لا تحتوي على c_user. تأكد من تصدير كوكيز فيسبوك الصحيحة.", ev2.threadID);
            return;
          }
          try {
            const backup = APP_STATE_PATH.replace(".json", ".backup.json");
            if (fs.existsSync(APP_STATE_PATH)) fs.copyFileSync(APP_STATE_PATH, backup);
            fs.writeFileSync(APP_STATE_PATH, JSON.stringify(parsed, null, 2), "utf8");
            await pushToGitHub(parsed);
            await api2.sendMessage("✅ تم حفظ الكوكيز الجديدة بنجاح!\nسيُعاد تشغيل البوت خلال 5 ثوانٍ...", ev2.threadID);
            setTimeout(() => process.exit(1), 5000);
          } catch (e) {
            await api2.sendMessage("❌ فشل حفظ الكوكيز: " + e.message, ev2.threadID);
          }
        }
      });
    },
  };
  