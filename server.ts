import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Gemini Time-Allocation Advisor
  app.post("/api/ai/schedule-advise", async (req, res) => {
    try {
      const { tasks, currentHour } = req.body;

      if (!process.env.GEMINI_API_KEY) {
        return res.status(400).json({
          error: "ຂໍອະໄພ: ບໍ່ພົບ `GEMINI_API_KEY` ໃນລະບົບ. ກະລຸນາຕັ້ງຄ່າຄວາມລັບໃນ Secrets ກ່ອນ!"
        });
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const tasksText = JSON.stringify(tasks, null, 2);

      const prompt = `ຢາກໃຫ້ທ່ານເປັນຜູ້ຊ່ວຍວາງແຜນ ແລະ ຈັດສັນເວລາສ່ວນຕົວ ແລະ ວິເຄາະວຽກງານປະຈຳວັນ (Daily Time-Allocation Coach).
ນີ້ຄືລາຍການວຽກ ແລະ ເວລາໃນມື້ນີ້ (ເວລາປະຈຸບັນແມ່ນ ${currentHour || "ຍັງບໍ່ໄດ້ລະບຸ"}):
${tasksText}

ກະລຸນາວິເຄາະ ແລະ ຕອບເປັນພາສາລາວ (Lao Language) ທີ່ສຸພາບ, ໃຫ້ກຳລັງໃຈ, ແລະ ເປັນມິດ.
ຈົ່ງໃຫ້ຄະແນນການຈັດສັນເວລາ (score ຈາກ 0 ຫາ 100), ພ້ອມສະຫຼຸບພາບລວມ, ແລະ ຄຳແນະນຳທີ່ເປັນປະໂຫຍດເພື່ອຫຼີກລ້ຽງການເຮັດວຽກໜັກເກີນໄປ ຫຼື ເວລາທັບຊ້ອນກັນ, ແລະ ຮັກສາສຸຂະພາບ (Work-Life Balance).`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: {
                type: Type.NUMBER,
                description: "ຄະແນນຄວາມສົມບູນ ແລະ ປະສິດທິພາບການຈັດເວລາ 0-100",
              },
              analysis: {
                type: Type.STRING,
                description: "ບົດວິເຄາະ ແລະ ສະຫຼຸບບົດບາດຂອງແຜນການໃນມື້ນີ້ເປັນພາສາລາວ",
              },
              advices: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING, description: "ປະເພດຄຳແນະນຳ ເຊັ່ນ 'OVERLAP', 'HEALTH', 'EFFICIENT', 'REST' ຫຼື 'MOTIVATION'" },
                    text: { type: Type.STRING, description: "ເນື້ອຫາຄຳແນະນຳສັ້ນໆເປັນພາສາລາວ 1-2 ປະໂຫຍດ" },
                    severity: { type: Type.STRING, description: "ລະດັບຄວາມເຂັ້ມງວດ ເຊັ່ນ 'info', 'warning', 'success'" }
                  },
                  required: ["type", "text", "severity"]
                },
                description: "ລາຍການແນະນຳແຕ່ລະອັນ",
              },
              insights: {
                type: Type.OBJECT,
                properties: {
                  focusHours: { type: Type.NUMBER, description: "ຊົ່ວໂມງທີ່ໃຊ້ໂຟກັສວຽກງານ" },
                  healthHours: { type: Type.NUMBER, description: "ຊົ່ວໂມງທີ່ໃຊ້ພັກຜ່ອນ ຫຼື ເພື່ອສຸຂະພາບ" },
                  balanceRatio: { type: Type.STRING, description: "ອັດຕາສ່ວນການຈັດສັນຄວາມສົມດຸນ ເຊັ່ນ '60:40 Work-Life'" }
                },
                required: ["focusHours", "healthHours", "balanceRatio"]
              }
            },
            required: ["score", "analysis", "advices", "insights"]
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("No response string returned from Gemini API");
      }

      const adviceResult = JSON.parse(responseText.trim());
      res.json(adviceResult);
    } catch (error: any) {
      console.error("Gemini Advisor API Error:", error);
      res.status(500).json({ error: error.message || "ເກີດຂໍ້ຜິດພາດໃນການວິເຄາະດ້ວຍ AI" });
    }
  });

  // Serve static files / Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
