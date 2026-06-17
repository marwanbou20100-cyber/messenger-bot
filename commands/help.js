"use strict";
  const config = require("../config.json");
  const fmt    = require("../utils/fmt");
  const path   = require("path");
  const fss    = require("fs");

  module.exports = {
    name: "help",
    aliases: ["h", "cmds", "commands", "مساعدة"],
    description: "عرض قائمة الأوامر أو تفاصيل أمر واحد.",
    usage: "help [أمر]",
    category: "General",

    async execute({ api, event, args, commands }) {
      const p = config.prefix;

      // ── تفاصيل أمر واحد ──────────────────────────────────────────────────────
      if (args[0]) {
        const name = args[0].toLowerCase().replace(/^-+/, "");
        const cmd  = commands.get(name) ||
          [...new Set(commands.values())].find(c => c.aliases?.includes(name));

        if (!cmd) {
          return api.sendMessage(fmt.err(`الأمر "${name}" غير موجود.\n  اكتب ${p}help لعرض جميع الأوامر.`), event.threadID);
        }

        const lines = [
          fmt.header(),
          "",
          fmt.row("الأمر",       p + cmd.name,                "⌨️"),
          fmt.row("الوصف",       cmd.description || "—",      "📝"),
          fmt.row("الفئة",       cmd.category    || "عام",    "🏷️"),
          fmt.row("الاستخدام",   p + (cmd.usage  || cmd.name), "📌"),
        ];
        if (cmd.aliases?.length)
          lines.push(fmt.row("الاختصارات", cmd.aliases.map(a => p + a).join("  "), "🔁"));
        if (cmd.adminOnly) lines.push(fmt.row("الصلاحية", "مشرف فقط 🔒", "🛡️"));
        if (cmd.groupOnly) lines.push(fmt.row("النطاق",   "مجموعات فقط 👥", "💬"));

        return api.sendMessage(lines.join("\n"), event.threadID);
      }

      // ── قائمة كل الأوامر ─────────────────────────────────────────────────────
      const unique     = [...new Set(commands.values())];
      const categories = {};
      for (const cmd of unique) {
        const cat = cmd.category || "General";
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(cmd.name);
      }

      const ORDER = ["General","Info","Utility","Group","Entertainment","Fun","Admin"];
      const ICONS  = {
        General: "🔹", Info: "📋", Utility: "🔧",
        Group: "🔸", Entertainment: "🎵", Fun: "🎮", Admin: "⚙️",
      };
      const LABELS = {
        General: "عام", Info: "معلومات", Utility: "أدوات",
        Group: "مجموعات", Entertainment: "ترفيه", Fun: "تسلية", Admin: "إدارة",
      };

      const sorted = [
        ...ORDER.filter(c => categories[c]),
        ...Object.keys(categories).filter(c => !ORDER.includes(c)),
      ];

      const totalCmds = unique.length;
      let msg = fmt.header(`البادئة: ${p}   •   الأوامر: ${totalCmds}`) + "\n";

      for (const cat of sorted) {
        const cmds = categories[cat];
        const icon = ICONS[cat]  || "▪️";
        const lbl  = LABELS[cat] || cat;
        msg += "\n" + icon + "  " + lbl + "\n";
        // Group in rows of 5
        for (let i = 0; i < cmds.length; i += 5) {
          const row = cmds.slice(i, i + 5).map(n => p + n).join("  ");
          msg += "   " + row + "\n";
        }
      }

      msg += "\n" + fmt.divider() + "\n";
      msg += "  " + p + "help <أمر>  لتفاصيل أي أمر";

      // ── إرسال قائمة الأوامر ثم صورة الفينيق ─────────────────────────────────
      api.sendMessage(msg, event.threadID, () => {
        const bannerPath = path.join(__dirname, "../assets/help-banner.jpg");
        if (fss.existsSync(bannerPath)) {
          api.sendMessage(
            { attachment: fss.createReadStream(bannerPath) },
            event.threadID
          );
        }
      });
    },
  };
