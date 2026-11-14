import express from "express";
import path, { dirname } from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
    generateSpeechServer,
    transcribeMemoirServer,
    semanticSearchServer,
    performOCRServer,
    restoreImageServer,
    analyzeFacesServer,
    analyzeSentimentServer,
    autoCategorizeServer,
    analyzeFileForArchiveServer,
    performImageMatchServer,
    analyzeVideoWithReferenceServer,
    searchInternalArchiveServer,
    getChatResponseServer,
    generateCreativeContentServer,
    webSearchServer,
    generateVideoServer,
    getVideoStatusServer,
    downloadVideoServer,
    enhanceUserPromptServer
} from "./server/geminiServerService";

async function startServer() {
    const app = express();
    const PORT = 3000;

    // Use JSON parser with high payload limits for base64 file uploads
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }));

    // Health check endpoint
    app.get("/api/health", (req, res) => {
        res.json({ status: "ok", time: new Date().toISOString() });
    });

    // Gemini API proxy routes
    app.post("/api/gemini/chat", async (req, res) => {
        try {
            const { history, newMessage } = req.body;
            const reply = await getChatResponseServer(history, newMessage);
            res.json({ text: reply });
        } catch (error: any) {
            console.error("Server API Error (Chat):", error);
            res.status(500).send(error.message || "خطا در برقراری ارتباط با مدل هوش مصنوعی");
        }
    });

    app.post("/api/gemini/ocr", async (req, res) => {
        try {
            const { file } = req.body;
            if (!file || !file.data) {
                return res.status(400).send("فایل ارسال نشده است.");
            }
            const reply = await performOCRServer(file.data, file.mimeType);
            res.json({ text: reply });
        } catch (error: any) {
            console.error("Server API Error (OCR):", error);
            res.status(500).send(error.message || "خطا در استخراج متن سند");
        }
    });

    app.post("/api/gemini/faces", async (req, res) => {
        try {
            const { file } = req.body;
            if (!file || !file.data) {
                return res.status(400).send("تصویر برای پردازش ارسال نشده است.");
            }
            const reply = await analyzeFacesServer(file.data, file.mimeType);
            res.json({ text: reply });
        } catch (error: any) {
            console.error("Server API Error (Faces):", error);
            res.status(500).send(error.message || "خطا در تشخیص چهره تصویر");
        }
    });

    app.post("/api/gemini/category", async (req, res) => {
        try {
            const { file } = req.body;
            if (!file || !file.data) {
                return res.status(400).send("فایل برای طبقه‌بندی ارسال نشده است.");
            }
            const reply = await autoCategorizeServer(file.data, file.mimeType);
            res.json({ text: reply });
        } catch (error: any) {
            console.error("Server API Error (Category):", error);
            res.status(500).send(error.message || "خطا در طبقه‌بندی هوشمند سند");
        }
    });

    app.post("/api/gemini/sentiment", async (req, res) => {
        try {
            const { text } = req.body;
            const reply = await analyzeSentimentServer(text);
            res.json({ text: reply });
        } catch (error: any) {
            console.error("Server API Error (Sentiment):", error);
            res.status(500).send(error.message || "خطا در تحلیل احساس متن");
        }
    });

    app.post("/api/gemini/face-video", async (req, res) => {
        try {
            const { video, reference } = req.body;
            if (!video || !video.data || !reference || !reference.data) {
                return res.status(400).send("ویدئو یا تصویر مرجع به درستی ارسال نشده است.");
            }
            const reply = await analyzeVideoWithReferenceServer(video.data, video.mimeType, reference.data, reference.mimeType);
            res.json({ text: reply });
        } catch (error: any) {
            console.error("Server API Error (Face Video):", error);
            res.status(500).send(error.message || "خطا در تشخیص چهره در ویدیو");
        }
    });

    app.post("/api/gemini/image-match", async (req, res) => {
        try {
            const { file, query } = req.body;
            if (!file || !file.data) {
                return res.status(400).send("تصویر برای مطابقت ارسال نشده است.");
            }
            const reply = await performImageMatchServer(file.data, file.mimeType, query);
            res.json(reply);
        } catch (error: any) {
            console.error("Server API Error (Image Match):", error);
            res.status(500).send(error.message || "خطا در مطابقت تصویر");
        }
    });

    app.post("/api/gemini/internal-search", async (req, res) => {
        try {
            const { file, repoPath } = req.body;
            if (!file || !file.data) {
                return res.status(400).send("سند برای جستجوی داخلی ارسال نشده است.");
            }
            const reply = await searchInternalArchiveServer(file.data, file.mimeType, repoPath);
            res.json({ text: reply });
        } catch (error: any) {
            console.error("Server API Error (Internal Search):", error);
            res.status(500).send(error.message || "خطا در جستجو در مخزن محلی آرشیو");
        }
    });

    app.post("/api/gemini/transcribe-memoir", async (req, res) => {
        try {
            const { file } = req.body;
            if (!file || !file.data) {
                return res.status(400).send("فایل صوتی ارسال نشده است.");
            }
            const reply = await transcribeMemoirServer(file.data, file.mimeType);
            res.json({ text: reply });
        } catch (error: any) {
            console.error("Server API Error (Transcribe):", error);
            res.status(500).send(error.message || "خطا در واژه‌نگاری صوت روایت");
        }
    });

    app.post("/api/gemini/generate-speech", async (req, res) => {
        try {
            const { text } = req.body;
            const audioBase64 = await generateSpeechServer(text);
            res.json({ base64: audioBase64 });
        } catch (error: any) {
            console.error("Server API Error (Speech Generation):", error);
            res.status(500).send(error.message || "خطا در تبدیل متن به گفتار دکلمه");
        }
    });

    app.post("/api/gemini/semantic-search", async (req, res) => {
        try {
            const { query, profiles, documents } = req.body;
            const reply = await semanticSearchServer(query, profiles, documents);
            res.json(reply);
        } catch (error: any) {
            console.error("Server API Error (Semantic Search):", error);
            res.status(500).send(error.message || "خطا در اجرای جستجوی معنایی هوشمند");
        }
    });

    app.post("/api/gemini/web-search", async (req, res) => {
        try {
            const { query } = req.body;
            if (!query) {
                return res.status(400).send("عبارت جستجو خالی است.");
            }
            const reply = await webSearchServer(query);
            res.json(reply);
        } catch (error: any) {
            console.error("Server API Error (Web Search):", error);
            res.status(500).send(error.message || "خطا در اجرای جستجوی وب");
        }
    });

    app.get("/api/proxy-image", async (req, res) => {
        try {
            const imageUrl = req.query.url as string;
            if (!imageUrl) return res.status(400).send("آدرس تصویر ارسال نشده است.");

            if (imageUrl.startsWith("data:")) {
                const matches = imageUrl.match(/^data:(.+);base64,(.+)$/);
                if (matches) {
                    res.setHeader("Content-Type", matches[1]);
                    return res.send(Buffer.from(matches[2], "base64"));
                }
            }

            const response = await fetch(imageUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const contentType = response.headers.get("content-type") || "image/jpeg";
            const arrayBuffer = await response.arrayBuffer();
            res.setHeader("Content-Type", contentType);
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.send(Buffer.from(arrayBuffer));
        } catch (error: any) {
            console.error("Server Proxy Image Error:", error?.message || error);
            res.status(500).send("خطا در بارگیری تصویر از سرور واسط");
        }
    });

    app.post("/api/gemini/restore", async (req, res) => {
        try {
            const { file } = req.body;
            if (!file || !file.data) {
                return res.status(400).send("تصویر برای ترمیم ارسال نشده است.");
            }
            const reply = await restoreImageServer(file.data, file.mimeType);
            res.json(reply);
        } catch (error: any) {
            console.error("Server API Error (Restore Image):", error);
            res.status(500).send(error.message || "خطا در پردازش ترمیم تصویر");
        }
    });

    app.post("/api/gemini/analyze-archive", async (req, res) => {
        try {
            const { file, profiles } = req.body;
            if (!file || !file.data) {
                return res.status(400).send("فایل برای تحلیل آرشیو ارسال نشده است.");
            }
            const reply = await analyzeFileForArchiveServer(file.data, file.mimeType, profiles);
            res.json(reply);
        } catch (error: any) {
            console.error("Server API Error (Analyze Archive):", error);
            res.status(500).send(error.message || "خطا در تحلیل و انطباق آرشیو");
        }
    });

    app.post("/api/gemini/creative", async (req, res) => {
        try {
            const { type, tags, contextDocs, profiles, additionalPrompt, prompt, mediaType, options } = req.body;
            const targetType = type || (options?.style ? `${options.style} ${mediaType || ''}` : '') || mediaType || 'طرح هنری و چندرسانه‌ای';
            const targetPrompt = additionalPrompt || prompt || '';
            const reply = await generateCreativeContentServer({ 
                type: targetType, 
                tags: tags || [], 
                contextDocs: contextDocs || [], 
                profiles: profiles || [], 
                additionalPrompt: targetPrompt 
            });
            res.json({ text: reply });
        } catch (error: any) {
            console.error("Server API Error (Creative Gen):", error);
            res.status(500).send(error.message || "خطا در تولید محتوای هنری");
        }
    });

    // Veo Video Generation endpoints (Two-Tier Architecture)
    app.post("/api/gemini/video/enhance-prompt", async (req, res) => {
        try {
            const { userText, style, cameraMotion, durationSeconds } = req.body;
            const result = await enhanceUserPromptServer({ userText, style, cameraMotion, durationSeconds });
            res.json(result);
        } catch (error: any) {
            console.error("Server API Error (Video Enhance Prompt):", error);
            res.status(500).send(error.message || "خطا در بهبود پرامپت ویدئو");
        }
    });

    app.post("/api/gemini/video/generate", async (req, res) => {
        try {
            const { prompt, imageBase64, mimeType, aspectRatio, resolution } = req.body;
            const result = await generateVideoServer({ prompt, imageBase64, mimeType, aspectRatio, resolution });
            res.json(result);
        } catch (error: any) {
            console.error("Server API Error (Video Generate):", error);
            res.status(500).send(error.message || "خطا در شروع تولید ویدئو با Veo");
        }
    });

    app.post("/api/gemini/video/status", async (req, res) => {
        try {
            const { operationName } = req.body;
            const status = await getVideoStatusServer(operationName);
            res.json(status);
        } catch (error: any) {
            console.error("Server API Error (Video Status):", error);
            res.status(500).send(error.message || "خطا در استعلام وضعیت ویدئو");
        }
    });

    app.post("/api/gemini/video/download", async (req, res) => {
        try {
            const { operationName } = req.body;
            const download = await downloadVideoServer(operationName);
            res.json(download);
        } catch (error: any) {
            console.error("Server API Error (Video Download):", error);
            res.status(500).send(error.message || "خطا در دانلود ویدئوی تولید شده");
        }
    });

    // Public REST Endpoints for External Studio Integration (Veo & AI Art Studio)
    app.get("/api/archive/export", (req, res) => {
        try {
            const firebaseConfig = JSON.parse(fs.readFileSync(path.join(_dirname, 'firebase-applet-config.json'), 'utf-8'));
            res.json({
                system: "Yadegaran Alborz Intelligent Archive",
                firebaseConfig: {
                    projectId: firebaseConfig.projectId,
                    firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
                    apiKey: firebaseConfig.apiKey,
                    authDomain: firebaseConfig.authDomain
                },
                apiVersion: "1.0.0",
                exportTime: new Date().toISOString()
            });
        } catch (e: any) {
            res.status(500).json({ error: "Could not read archive export configuration" });
        }
    });

    // Define __filename and __dirname safely for ES modules
    const _filename = typeof __filename !== "undefined" ? __filename : fileURLToPath(import.meta.url);
    const _dirname = typeof __dirname !== "undefined" ? __dirname : dirname(_filename);

    // Detect production environment and verify that pre-built static assets are present.
    // If not, fall back to starting Vite Dev Server dynamically so the app is always functional.
    const isProductionCjs = _filename.endsWith('server.cjs') || _dirname.endsWith('dist');
    const distPath = isProductionCjs ? _dirname : path.join(_dirname, 'dist');
    const hasDistHTML = fs.existsSync(path.join(distPath, 'index.html'));

    let isProd = isProductionCjs ? hasDistHTML : (process.env.NODE_ENV === "production" && hasDistHTML);

    let useVite = !isProd;
    if (useVite) {
        try {
            const { createServer: createViteServer } = await import("vite");
            const vite = await createViteServer({
                server: { middlewareMode: true },
                appType: "spa",
            });
            app.use(vite.middlewares);
            console.log("Started Vite Dev Server middleware inside Express");
        } catch (viteError) {
            console.warn("Could not import Vite / start Vite Dev Server. Falling back to production static serve:", viteError);
            useVite = false;
            isProd = true;
        }
    }

    if (!useVite) {
        app.use(express.static(distPath));
        
        // Single-page application route support for Express 5
        app.get('*all', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
        
        // Robust fallback middleware for any unmatched GET requests requesting HTML
        app.use((req, res, next) => {
            if (req.method === 'GET' && (req.headers.accept || '').includes('text/html')) {
                res.sendFile(path.join(distPath, 'index.html'));
            } else {
                res.status(404).json({ error: "Page not found" });
            }
        });
        console.log(`Serving static production assets from ${distPath}`);
    }

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Express Full-Stack Server running on http://localhost:${PORT}`);
    });
}

startServer().catch(err => {
    console.error("Critical: Failed to boot express full-stack server:", err);
});
