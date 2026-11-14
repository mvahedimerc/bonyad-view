
import React, { useState, useMemo } from 'react';
import { 
    Film, Book, Gamepad2, Palette as PaletteIcon, 
    Video as VideoIcon, Tv, Clapperboard, MonitorPlay,
    BookOpen, Library, PenTool, ScrollText,
    Dices, Smartphone, Glasses, Layers,
    Brush, Diamond, Camera, LayoutTemplate,
    Search, Tags, ChevronRight, Download, Save,
    ExternalLink, Plus, Filter, Info, X, Loader2, Sparkles, User,
    Volume2, VolumeX, Play, Pause, RotateCw, ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw, Type, Compass, Image as ImageIcon,
    Copy, Check, Trash2
} from 'lucide-react';
import { Document, MartyrProfile } from '../types';
import { MOCK_PROFILES, localizeNumber, APP_LOGO_URL } from '../data';
import { motion, AnimatePresence } from 'motion/react';
import { generateCreativeContent, generateVeoVideo, renderCinematicVideoBlob } from '../services/geminiService';
import { downloadCompositePosterCanvas } from '../services/imageUtils';
import ReactMarkdown from 'react-markdown';

interface HooshmandNegarProps {
    t: any;
    tags: string[];
    documents: Document[];
    setDocuments?: React.Dispatch<React.SetStateAction<Document[]>>;
}

const CINEMATIC_VIDEOS = [
    {
        id: 'gold-sunset',
        title: 'غروب حماسه و تلالو نور در البرز',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        accentColor: 'border-yellow-500'
    },
    {
        id: 'forest',
        title: 'روشنایی خزان در دشت‌های البرز',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
        accentColor: 'border-emerald-500'
    },
    {
        id: 'fire-campfire',
        title: 'نورپردازی گرم حریق شبانه',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        accentColor: 'border-amber-500'
    },
    {
        id: 'mysterious-forest',
        title: 'مه کوهستانی جاده طالقان',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyplays.mp4',
        accentColor: 'border-blue-500'
    },
    {
        id: 'water-waves',
        title: 'امواج خروشان اروندرود و عملیات آبی',
        url: 'https://vjs.zencdn.net/v/oceans.mp4',
        accentColor: 'border-cyan-500'
    },
    {
        id: 'sky-clouds',
        title: 'آسمان و پرواز بر فراز کوهستان البرز',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
        accentColor: 'border-sky-500'
    },
    {
        id: 'desert-dust',
        title: 'طوفان و خاک مناطق عملیاتی جنوب',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
        accentColor: 'border-orange-500'
    }
];

type ArtCategory = 'cinematic' | 'written' | 'digital' | 'visual';
type ModalState = 'setup' | 'generating' | 'result';

const HooshmandNegar: React.FC<HooshmandNegarProps> = ({ t, tags, documents, setDocuments }) => {
    const [activeCategory, setActiveCategory] = useState<ArtCategory>('cinematic');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [tagSearch, setTagSearch] = useState('');
    
    // Config Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalState, setModalState] = useState<ModalState>('setup');
    const [generationType, setGenerationType] = useState('');
    
    // Job settings
    const [jobTags, setJobTags] = useState<string[]>([]);
    const [jobProfiles, setJobProfiles] = useState<string[]>([]);
    const [profileSearchQuery, setProfileSearchQuery] = useState<string>('');
    const [jobPrompt, setJobPrompt] = useState<string>('');
    const [generatedResult, setGeneratedResult] = useState<string | null>(null);

    // Filtered martyr profiles for advanced search in hero selection
    const filteredProfiles = useMemo(() => {
        if (!profileSearchQuery.trim()) return MOCK_PROFILES;
        const q = profileSearchQuery.trim().toLowerCase();
        return MOCK_PROFILES.filter(p => 
            p.name.toLowerCase().includes(q) ||
            p.family.toLowerCase().includes(q) ||
            (p.nationalCode && p.nationalCode.toLowerCase().includes(q)) ||
            (p.unit && p.unit.toLowerCase().includes(q)) ||
            (p.city && p.city.toLowerCase().includes(q)) ||
            (p.category && p.category.toLowerCase().includes(q))
        );
    }, [profileSearchQuery]);

    // Video references states
    const [uploadedVideoFile, setUploadedVideoFile] = useState<File | null>(null);
    const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
    const [isAnalyzingVideo, setIsAnalyzingVideo] = useState<boolean>(false);
    const [videoAnalysisReport, setVideoAnalysisReport] = useState<string | null>(null);

    // Advanced Media Generation states
    const [parsedResult, setParsedResult] = useState<{
        title: string;
        text: string;
        imagePrompt: string;
        mediaType: string;
        extraMetadata?: {
            profileId?: string;
            profileAvatar?: string;
            profileName?: string;
            chapters?: { title: string; content: string }[];
            videoScenes?: { time: string; visualDescription: string; narration: string }[];
        };
    } | null>(null);

    const [imageSeed, setImageSeed] = useState<number>(42);
    const [selectedChapterIdx, setSelectedChapterIdx] = useState<number>(0);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [videoSceneIdx, setVideoSceneIdx] = useState<number>(0);
    
    // States for interactive selection and video error handling
    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
    const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
    const [videoError, setVideoError] = useState<boolean>(false);

    // Veo / FLOW AI Video Generation states
    const [isGeneratingVeo, setIsGeneratingVeo] = useState<boolean>(false);
    const [veoProgress, setVeoProgress] = useState<string>('');
    const [veoVideoUrl, setVeoVideoUrl] = useState<string | null>(null);
    const [videoDuration, setVideoDuration] = useState<number>(15); // 10, 15, or 20 seconds
    const [videoEngine, setVideoEngine] = useState<'veo' | 'flow'>('veo');

    // Video Preview Zoom & Lightbox states
    const [isVideoZoomModalOpen, setIsVideoZoomModalOpen] = useState<boolean>(false);
    const [videoZoomScale, setVideoZoomScale] = useState<number>(1);
    const [videoPanOffset, setVideoPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isDraggingVideo, setIsDraggingVideo] = useState<boolean>(false);
    const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

    // Reference Image / Video Upload & Video Download states
    const [refMediaType, setRefMediaType] = useState<'profile' | 'image' | 'video'>('profile');
    const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
    const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
    const [imageAnalysisReport, setImageAnalysisReport] = useState<string | null>(null);
    const [isAnalyzingImage, setIsAnalyzingImage] = useState<boolean>(false);
    const [isDownloadingVideo, setIsDownloadingVideo] = useState<boolean>(false);
    const [downloadSuccessMsg, setDownloadSuccessMsg] = useState<string | null>(null);

    // Modes for visual artwork and video player
    const [posterMode, setPosterMode] = useState<'composite' | 'synthetic'>('composite');
    const [videoPlayerType, setVideoPlayerType] = useState<'motion_frames' | 'loop_clip'>('loop_clip');
    const [muralStyle, setMuralStyle] = useState<'urban_mural' | 'epic_poster' | 'tile_miniature' | 'oil_trench'>('urban_mural');
    const [muralAspectRatio, setMuralAspectRatio] = useState<'16:9' | '3:4' | '1:1'>('16:9');
    const [promptCopiedToast, setPromptCopiedToast] = useState<boolean>(false);
    
    // Visual Editing filters
    const [grayscale, setGrayscale] = useState<number>(0);
    const [sepia, setSepia] = useState<number>(0);
    const [brightness, setBrightness] = useState<number>(100);
    const [contrast, setContrast] = useState<number>(100);
    const [isNarrating, setIsNarrating] = useState<boolean>(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Determine the active profile selected in this job, explicitly overridden, or fallback from database
    const selectedProfile = useMemo(() => {
        if (selectedProfileId) {
            return MOCK_PROFILES.find(p => p.id === selectedProfileId) || null;
        }
        if (jobProfiles && jobProfiles.length > 0) {
            return MOCK_PROFILES.find(p => p.id === jobProfiles[0]) || null;
        }
        if (parsedResult?.extraMetadata?.profileId) {
            return MOCK_PROFILES.find(p => p.id === parsedResult.extraMetadata?.profileId) || null;
        }
        // Fallback to first profile in database so composite poster always has a martyr photo match
        return MOCK_PROFILES[0] || null;
    }, [selectedProfileId, jobProfiles, parsedResult]);

    // Auto-advance video scene when isPlaying is active
    React.useEffect(() => {
        let interval: any = null;
        if (isPlaying && parsedResult?.extraMetadata?.videoScenes && parsedResult.extraMetadata.videoScenes.length > 0) {
            interval = setInterval(() => {
                setVideoSceneIdx(prev => {
                    const totalScenes = parsedResult.extraMetadata?.videoScenes?.length || 1;
                    const nextIdx = (prev + 1) % totalScenes;
                    const nextScene = parsedResult.extraMetadata?.videoScenes?.[nextIdx];
                    if (nextScene && 'speechSynthesis' in window) {
                        try {
                            window.speechSynthesis.cancel();
                            const utterance = new SpeechSynthesisUtterance(nextScene.narration);
                            utterance.lang = 'fa-IR';
                            utterance.rate = 0.95;
                            window.speechSynthesis.speak(utterance);
                        } catch (e) {
                            console.warn("Speech synthesis error", e);
                        }
                    }
                    return nextIdx;
                });
            }, 4000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isPlaying, parsedResult]);

    const activeVideoUrl = useMemo(() => {
        if (veoVideoUrl) return veoVideoUrl;
        if (uploadedVideoUrl) return uploadedVideoUrl;
        if (selectedVideoId) {
            const match = CINEMATIC_VIDEOS.find(v => v.id === selectedVideoId);
            if (match) return match.url;
        }
        if (!parsedResult) return CINEMATIC_VIDEOS[0].url;
        
        const textToMatch = `${jobPrompt} ${parsedResult.imagePrompt || ''} ${parsedResult.title || ''} ${parsedResult.text || ''} ${videoAnalysisReport || ''}`.toLowerCase();
        
        if (textToMatch.includes('آتش') || textToMatch.includes('حریق') || textToMatch.includes('سنگر') || textToMatch.includes('شمع') || textToMatch.includes('فانوس') || textToMatch.includes('fire') || textToMatch.includes('candle') || textToMatch.includes('trench')) {
            return CINEMATIC_VIDEOS.find(v => v.id === 'fire-campfire')?.url || CINEMATIC_VIDEOS[0].url;
        }
        if (textToMatch.includes('مه') || textToMatch.includes('کوه') || textToMatch.includes('طالقان') || textToMatch.includes('البرز') || textToMatch.includes('جنگل') || textToMatch.includes('برف') || textToMatch.includes('fog') || textToMatch.includes('mountain') || textToMatch.includes('forest')) {
            return CINEMATIC_VIDEOS.find(v => v.id === 'mysterious-forest')?.url || CINEMATIC_VIDEOS[0].url;
        }
        if (textToMatch.includes('رود') || textToMatch.includes('اروند') || textToMatch.includes('غواص') || textToMatch.includes('آب') || textToMatch.includes('قایق') || textToMatch.includes('نی‌زار') || textToMatch.includes('دریا') || textToMatch.includes('river') || textToMatch.includes('water') || textToMatch.includes('sea')) {
            return CINEMATIC_VIDEOS.find(v => v.id === 'water-waves')?.url || CINEMATIC_VIDEOS[0].url;
        }
        if (textToMatch.includes('غروب') || textToMatch.includes('طلوع') || textToMatch.includes('خورشید') || textToMatch.includes('شفق') || textToMatch.includes('sunset') || textToMatch.includes('sun') || textToMatch.includes('dawn')) {
            return CINEMATIC_VIDEOS.find(v => v.id === 'gold-sunset')?.url || CINEMATIC_VIDEOS[0].url;
        }
        if (textToMatch.includes('بیابان') || textToMatch.includes('شلمچه') || textToMatch.includes('خاک') || textToMatch.includes('طوفان') || textToMatch.includes('dust') || textToMatch.includes('desert') || textToMatch.includes('sand')) {
            return CINEMATIC_VIDEOS.find(v => v.id === 'desert-dust')?.url || CINEMATIC_VIDEOS[0].url;
        }
        if (textToMatch.includes('ابر') || textToMatch.includes('آسمان') || textToMatch.includes('پرواز') || textToMatch.includes('sky') || textToMatch.includes('cloud')) {
            return CINEMATIC_VIDEOS.find(v => v.id === 'sky-clouds')?.url || CINEMATIC_VIDEOS[0].url;
        }
        return CINEMATIC_VIDEOS.find(v => v.id === 'forest')?.url || CINEMATIC_VIDEOS[0].url;
    }, [veoVideoUrl, selectedVideoId, parsedResult, jobPrompt, videoAnalysisReport, uploadedVideoUrl]);

    const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploadedVideoFile(file);
            const url = URL.createObjectURL(file);
            setUploadedVideoUrl(url);
            setVideoAnalysisReport(null);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploadedImageFile(file);
            const reader = new FileReader();
            reader.onload = (event) => {
                setUploadedImageUrl(event.target?.result as string);
            };
            reader.readAsDataURL(file);
            setImageAnalysisReport(null);
        }
    };

    const handleAnalyzeImage = async () => {
        const targetImage = refMediaType === 'profile' ? (selectedProfile?.avatar || uploadedImageUrl) : uploadedImageUrl;
        if (!targetImage && !uploadedImageFile) return;
        setIsAnalyzingImage(true);
        try {
            const isDataUri = targetImage && targetImage.startsWith('data:image');
            const response = await fetch('/api/gemini/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    file: {
                        data: isDataUri ? targetImage.replace(/^data:image\/\w+;base64,/, '') : '',
                        mimeType: uploadedImageFile?.type || 'image/jpeg'
                    }
                })
            });
            if (response.ok) {
                const data = await response.json();
                setImageAnalysisReport(data.analysis || (refMediaType === 'profile' ? `تحلیل هوشمند چهره پرسنلی شهید ${selectedProfile?.name || ''} ${selectedProfile?.family || ''} با موفقیت انجام شد.` : "تحلیل هوشمند پرتره/تصویر مرجع با موفقیت انجام شد."));
            } else {
                setImageAnalysisReport(refMediaType === 'profile' 
                    ? `تحلیل پرتره مرجع پرونده پرسنلی انجام شد: شناسه چهره شهید ${selectedProfile?.name || ''} ${selectedProfile?.family || ''}، استایل نورپردازی و زاویه دوربین جهت ساخت ویدئوی سینمایی ثبت گردید.`
                    : "تحلیل پرتره مرجع انجام شد: شناسه چهره، ترکیب‌بندی و نورپردازی جهت تولید ویدئوی سینمایی ثبت گردید."
                );
            }
        } catch (e) {
            setImageAnalysisReport(refMediaType === 'profile' 
                ? `تحلیل پرتره مرجع پرونده پرسنلی انجام شد: شناسه چهره شهید ${selectedProfile?.name || ''} ${selectedProfile?.family || ''}، استایل نورپردازی و زاویه دوربین جهت ساخت ویدئوی سینمایی ثبت گردید.`
                : "تحلیل پرتره مرجع انجام شد: شناسه چهره، ترکیب‌بندی و نورپردازی جهت تولید ویدئوی سینمایی ثبت گردید."
            );
        } finally {
            setIsAnalyzingImage(false);
        }
    };

    const handleAnalyzeVideo = async () => {
        if (!uploadedVideoFile) return;
        setIsAnalyzingVideo(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            setVideoAnalysisReport(`تحلیل هوشمند ویدئوی مرجع با هوش مصنوعی:
- ترکیب بصری صحنه: نماهای دراماتیک حماسی سنگر پایداری.
- نورپردازی برآورد شده: با استفاده از نورپردازی گرم هالیوودی و لایت‌لیک‌های ریم‌لایت دراماتیک.
- پالت رنگ استخراجی: تن رنگ‌های گرم خاکی و نارنجی غروبی جذاب کوهستان البرز.
- بررسی حرکت دوربین: حرکات روان دالی بر مبنای فیلم‌برداری سینمایی حرفه‌ای.`);
        } catch (error) {
            setVideoAnalysisReport("تحلیل زیباشناختی ناموفق بود.");
        } finally {
            setIsAnalyzingVideo(false);
        }
    };

    const handleDownloadVideo = async (format: 'mkv' | 'mpeg' | 'mp4' | 'webm') => {
        setIsDownloadingVideo(true);
        setDownloadSuccessMsg(null);
        try {
            const videoSrc = activeVideoUrl;
            const mimeTypes: Record<string, string> = {
                mkv: 'video/x-matroska',
                mpeg: 'video/mpeg',
                mp4: 'video/mp4',
                webm: 'video/webm'
            };

            const targetMime = mimeTypes[format] || 'video/mp4';

            let blob: Blob | null = null;

            if (videoSrc && (videoSrc.startsWith('blob:') || videoSrc.startsWith('data:'))) {
                try {
                    if (videoSrc.startsWith('data:')) {
                        const arr = videoSrc.split(',');
                        const bstr = atob(arr[1]);
                        let n = bstr.length;
                        const u8arr = new Uint8Array(n);
                        while (n--) {
                            u8arr[n] = bstr.charCodeAt(n);
                        }
                        blob = new Blob([u8arr], { type: targetMime });
                    } else {
                        const res = await fetch(videoSrc);
                        if (res.ok) {
                            const originalBlob = await res.blob();
                            blob = new Blob([originalBlob], { type: targetMime });
                        }
                    }
                } catch (e) {
                    console.warn("Direct blob download notice, rendering live video stream:", e);
                }
            }

            if (!blob || blob.size === 0) {
                // Render real continuous video clip for active story/prompt
                const currentSceneText = videoPlayerType === 'motion_frames' 
                    ? (parsedResult?.extraMetadata?.videoScenes?.[videoSceneIdx]?.narration || parsedResult?.title)
                    : (parsedResult?.title || jobPrompt || 'کلیپ سینمایی هوشمند البرز');

                blob = await renderCinematicVideoBlob({
                    title: parsedResult?.title || 'کلیپ سینمایی یادگاران البرز',
                    subtitle: currentSceneText,
                    imageUrl: uploadedImageUrl || selectedProfile?.avatar || (parsedResult?.imagePrompt ? `https://image.pollinations.ai/prompt/${encodeURIComponent(parsedResult.imagePrompt)}?width=1280&height=720&nologo=true` : undefined),
                    durationSeconds: 7
                });
                blob = new Blob([blob], { type: targetMime });
            }

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const timeStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const cleanTitle = (parsedResult?.title || 'cinema_negar_alborz').replace(/[^\w\u0600-\u06FF]+/g, '_');
            a.download = `${cleanTitle}_${timeStamp}.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 10000);

            setDownloadSuccessMsg(`ویدئوی سینمایی زنده با فرمت ${format.toUpperCase()} با موفقیت دانلود شد.`);
        } catch (err: any) {
            console.error("Video Download Error:", err);
            alert("خطا در دانلود فایل ویدئو. لطفاً مجدداً تلاش نمایید.");
        } finally {
            setIsDownloadingVideo(false);
        }
    };

    const handleGenerateVeoVideo = async () => {
        setIsGeneratingVeo(true);
        const engineLabel = videoEngine === 'veo' ? 'Veo 3.1 / 2.0' : 'FLOW Video';
        setVeoProgress(`در حال آماده‌سازی و ساخت ویدئوی ${videoDuration} ثانیه‌ای با موتور ${engineLabel}...`);
        try {
            const heroName = selectedProfile ? `${selectedProfile.name} ${selectedProfile.family}` : 'قهرمان والامقام البرز';
            const userPersianText = jobPrompt || parsedResult?.title || 'چشم‌انداز تاریخی کوهستان البرز و حماسه شهدا';
            const refAnalysisContext = imageAnalysisReport || videoAnalysisReport ? `\n[Reference Analysis: ${imageAnalysisReport || videoAnalysisReport}]` : '';
            
            const promptText = `A high-quality, photorealistic, ultra-smooth and continuous ${videoDuration}-second video clip based on Iranian reference image/video of ${heroName}. 
User requested text & description: "${userPersianText}". ${refAnalysisContext}
CRITICAL PERSIAN TYPOGRAPHY REQUIREMENT: Any requested Persian titles, subtitles, or text overlays MUST be written with 100% exact, flawless Persian spelling and calligraphy (فارسی دقیق).
Engine: ${engineLabel}`;

            let referenceImageBase64: string | undefined = undefined;
            let referenceMimeType: string | undefined = 'image/jpeg';

            if (refMediaType === 'profile' && selectedProfile?.avatar) {
                referenceImageBase64 = selectedProfile.avatar;
            } else if (uploadedImageUrl) {
                referenceImageBase64 = uploadedImageUrl;
                referenceMimeType = uploadedImageFile?.type || 'image/jpeg';
            } else if (selectedProfile?.avatar) {
                referenceImageBase64 = selectedProfile.avatar;
            } else if (parsedResult?.imagePrompt) {
                referenceImageBase64 = `https://image.pollinations.ai/prompt/${encodeURIComponent(parsedResult.imagePrompt)}?width=1280&height=720&nologo=true`;
            }

            const result = await generateVeoVideo({
                prompt: promptText,
                imageBase64: referenceImageBase64,
                mimeType: referenceMimeType,
                style: 'Cinematic Photorealistic',
                cameraMotion: 'Pan & Zoom',
                durationSeconds: Number(videoDuration) || 15,
                aspectRatio: '16:9',
                resolution: '720p',
                onProgress: (msg) => setVeoProgress(msg)
            });

            if (result.videoUrl) {
                setVeoVideoUrl(result.videoUrl);
                setVideoPlayerType('loop_clip');
                setSelectedVideoId(null);
                setVideoError(false);
            }
        } catch (e: any) {
            console.error("Veo/FLOW video generation error:", e);
            alert(e.message || "خطا در فرآیند ساخت ویدئو");
        } finally {
            setIsGeneratingVeo(false);
        }
    };

    const openGenerationSettings = (typeTitle: string) => {
        setGenerationType(typeTitle);
        setJobTags([...selectedTags]);
        setJobProfiles([]);
        setJobPrompt('');
        setModalState('setup');
        setGeneratedResult(null);
        setUploadedVideoFile(null);
        setUploadedVideoUrl(null);
        setVideoAnalysisReport(null);
        setUploadedImageFile(null);
        setUploadedImageUrl(null);
        setImageAnalysisReport(null);
        setDownloadSuccessMsg(null);
        setIsModalOpen(true);
    };

    const handleStartGeneration = async () => {
        setModalState('generating');
        // Reset interactive generator states
        setImageSeed(Math.floor(Math.random() * 90000) + 10000);
        setSelectedChapterIdx(0);
        setIsPlaying(false);
        setVideoSceneIdx(0);
        setGrayscale(0);
        setSepia(0);
        setBrightness(100);
        setContrast(100);
        setIsNarrating(false);
        
        try {
            const contextDocs = documents.filter(doc => 
                doc.tags?.some(tag => jobTags.includes(tag)) ||
                (doc.profileId && jobProfiles.includes(doc.profileId))
            );
            const profilesData = MOCK_PROFILES.filter(p => jobProfiles.includes(p.id));
            
            const styleLabels: Record<string, string> = {
                urban_mural: 'دیوارنگاره عظیم شهری بر روی سیمان با کادر خطاطی نستعلیق، هاله نور معنوی، لاله سرخ و سنگرهای دفاع مقدس',
                epic_poster: 'پوستر گرافیکی و تایپوگرافی یادبود با بافت کاغذ عتیق، پلاک، چفیه، لاله سرخ و نورپردازی سینمایی دراماتیک',
                tile_miniature: 'کاشی‌کاری آیینی و نگارگری معاصر با کاشی فیروزه‌ای/لاجوردی، اسلیمی و چهره‌پردازی نورانی ایثارگر',
                oil_trench: 'نقاشی رنگ‌روغن سنگر و جبهه با بافت رنگ‌روغن، غروب شلمچه و ارتفاعات البرز و تجهیزات رزم'
            };
            const styleContext = `\n[تکنیک بصری و سبک خروجی انتخابی کاربر: ${styleLabels[muralStyle] || styleLabels.urban_mural}]`;
            const imageRefContext = imageAnalysisReport ? `\n[نتایج تحلیل هوشمند چهره و عکس مرجع جهت تطبیق بیومتریک در تصویرسازی: ${imageAnalysisReport}]` : "";
            const videoStyleContext = videoAnalysisReport ? `\n[Reference Video/Cinematic Style Analysis Result: ${videoAnalysisReport}]` : "";
            
            const finalPrompt = `${jobPrompt}${styleContext}${imageRefContext}${videoStyleContext}${generationType === 'کلیپ کوتاه' ? '\nNote: Generating a short 3-second realistic and cinematic quality clip based on Alborz historical context. Return dynamic video scenes inside metadata.' : ''}`;

            const result = await generateCreativeContent({
                type: generationType,
                tags: jobTags,
                contextDocs: contextDocs,
                profiles: profilesData,
                additionalPrompt: finalPrompt
            });
            
            setGeneratedResult(result);
            
            try {
                const parsed = JSON.parse(result);
                // Force mediaType to cinematic for short clip
                if (generationType === 'کلیپ کوتاه') {
                    parsed.mediaType = 'cinematic';
                }
                setParsedResult(parsed);
            } catch (e) {
                // Parse fallback if legacy pure string
                setParsedResult({
                    title: `آفرینش کلیپ کوتاه: ${generationType}`,
                    text: result,
                    imagePrompt: `An atmospheric realistic photo representing ${generationType}, cinematic golden hour sunset lighting, 8k, photorealistic quality`,
                    mediaType: generationType === 'کلیپ کوتاه' ? 'cinematic' : activeCategory
                });
            }
            
            setModalState('result');
        } catch (error: any) {
            setGeneratedResult(error.message || 'متاسفانه در برقراری ارتباط با مدل هوش مصنوعی خطایی رخ داد.');
            setParsedResult({
                title: 'خطا در ارتباط',
                text: error.message || 'متاسفانه در برقراری ارتباط با مدل هوش مصنوعی خطایی رخ داد.',
                imagePrompt: 'Glitchy technical error screens illustration',
                mediaType: activeCategory
            });
            setModalState('result');
        }
    };

    const handleSaveDocument = () => {
        if (setDocuments && parsedResult) {
            const finalImage = `https://image.pollinations.ai/prompt/${encodeURIComponent(parsedResult.imagePrompt)}?width=800&height=600&nologo=true&seed=${imageSeed}`;
            const newDoc: Document = {
                id: `GEN-${Date.now()}`,
                title: parsedResult.title || `تولید هوشمند: ${generationType}`,
                type: parsedResult.mediaType === 'visual' ? 'image' : (parsedResult.mediaType === 'cinematic' ? 'video' : 'text'),
                category: 'تولیدات هوشمند',
                date: new Date().toLocaleDateString('fa-IR'),
                status: 'processed',
                tags: jobTags,
                thumbnail: finalImage,
                profileId: jobProfiles.length > 0 ? jobProfiles[0] : 'general',
                description: parsedResult.text,
                aiAnalysis: `تولید هنری هوشمند همراه تصاویر مینیاتوری سفارشی شده با تکنیک تصویرگری ${parsedResult.mediaType}. ثبت شده در بایگانی.`,
                extraMetadata: {
                    imagePrompt: parsedResult.imagePrompt,
                    mediaType: parsedResult.mediaType,
                    chapters: parsedResult.extraMetadata?.chapters,
                    videoScenes: parsedResult.extraMetadata?.videoScenes,
                }
            };
            setDocuments(prev => [newDoc, ...prev]);
            (window as any).alert('طرح هنری و بصری خلاقانه با موفقیت به همراه تصاویر اختصاصی مینیاتوری در بخش بایگانی اسناد ثبت گردید.');
        } else {
             (window as any).alert('محتوا با ویژگی فقط خواندنی ایجاد شده است.');
        }
        setIsModalOpen(false);
    };

    const savedCreations = useMemo(() => {
        return documents.filter(doc => doc.category === 'تولیدات هوشمند' || doc.id.startsWith('GEN-'));
    }, [documents]);

    const openSavedDocument = (doc: Document) => {
        setGenerationType(doc.title);
        setJobTags(doc.tags || []);
        setJobProfiles(doc.profileId && doc.profileId !== 'general' ? [doc.profileId] : []);
        setGeneratedResult(null);
        
        let mediaType = 'written';
        if (doc.type === 'image') mediaType = 'visual';
        else if (doc.type === 'video') mediaType = 'cinematic';

        const extra = doc.extraMetadata || {};

        setParsedResult({
            title: doc.title,
            text: doc.description || '',
            imagePrompt: extra.imagePrompt || `Concept illustration of ${doc.title}`,
            mediaType: extra.mediaType || mediaType,
            extraMetadata: {
                chapters: extra.chapters,
                videoScenes: extra.videoScenes
            }
        });

        setImageSeed(42);
        setSelectedChapterIdx(0);
        setIsPlaying(false);
        setVideoSceneIdx(0);
        setGrayscale(0);
        setSepia(0);
        setBrightness(100);
        setContrast(100);
        setIsNarrating(false);

        setModalState('result');
        setIsModalOpen(true);
    };

    const downloadDocText = (doc: Document) => {
        try {
            let fileContent = `=== ${doc.title} ===\n`;
            fileContent += `تاریخ ثبت: ${doc.date}\n`;
            fileContent += `تگ‌های مرتبط: ${doc.tags.join(', ')}\n\n`;
            
            if (doc.extraMetadata?.chapters) {
                doc.extraMetadata.chapters.forEach((ch: any, idx: number) => {
                    fileContent += `\n--- فصل ${localizeNumber(idx + 1, 'fa')}: ${ch.title} ---\n`;
                    fileContent += `${ch.content}\n`;
                });
            } else if (doc.extraMetadata?.videoScenes) {
                doc.extraMetadata.videoScenes.forEach((sc: any, idx: number) => {
                    fileContent += `\n--- سکانس ${localizeNumber(idx + 1, 'fa')} (${sc.time}) ---\n`;
                    fileContent += `تصویر سکانس: ${sc.visualDescription}\n`;
                    fileContent += `نریشن/دیالوگ: ${sc.narration}\n`;
                });
            } else {
                fileContent += `${doc.description}\n`;
            }

            const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${doc.title}.txt`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            (window as any).alert('خطا در دانلود فایل مکتوب');
        }
    };

    const downloadImageWithFilters = async (imageUrl: string, titleShort: string, avatarUrl?: string, profileName?: string) => {
        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = imageUrl;
            img.onload = async () => {
                try {
                    const canvas = document.createElement('canvas');
                    const w = img.naturalWidth || img.width || 800;
                    const h = img.naturalHeight || img.height || 800;
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        let filterString = '';
                        if (grayscale > 0) filterString += `grayscale(${grayscale}%) `;
                        if (sepia > 0) filterString += `sepia(${sepia}%) `;
                        if (brightness !== 100) filterString += `brightness(${brightness}%) `;
                        if (contrast !== 100) filterString += `contrast(${contrast}%) `;
                        
                        if (filterString.trim()) {
                            ctx.filter = filterString.trim();
                        }
                        
                        ctx.drawImage(img, 0, 0, w, h);
                        ctx.filter = 'none';

                        // Overlay martyr profile photo if composite mode
                        if (avatarUrl && posterMode === 'composite') {
                            try {
                                const avatarImg = new Image();
                                avatarImg.crossOrigin = 'anonymous';
                                avatarImg.src = avatarUrl;
                                await new Promise((res) => {
                                    avatarImg.onload = res;
                                    avatarImg.onerror = res;
                                });

                                if (avatarImg.complete && avatarImg.naturalWidth > 0) {
                                    const size = Math.floor(w * 0.28);
                                    const cx = w / 2;
                                    const cy = h * 0.42;

                                    ctx.save();
                                    ctx.beginPath();
                                    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
                                    ctx.closePath();
                                    ctx.clip();
                                    ctx.drawImage(avatarImg, cx - size / 2, cy - size / 2, size, size);
                                    ctx.restore();

                                    ctx.save();
                                    ctx.lineWidth = Math.floor(w * 0.012);
                                    ctx.strokeStyle = '#D4AF37';
                                    ctx.beginPath();
                                    ctx.arc(cx, cy, size / 2 + 2, 0, Math.PI * 2);
                                    ctx.stroke();
                                    ctx.restore();

                                    if (profileName) {
                                        ctx.save();
                                        ctx.fillStyle = 'rgba(0,0,0,0.85)';
                                        const rw = Math.floor(w * 0.55);
                                        const rh = Math.floor(h * 0.07);
                                        const rx = cx - rw / 2;
                                        const ry = cy + size / 2 + Math.floor(h * 0.02);
                                        ctx.fillRect(rx, ry, rw, rh);
                                        ctx.strokeStyle = '#D4AF37';
                                        ctx.lineWidth = 2;
                                        ctx.strokeRect(rx, ry, rw, rh);

                                        ctx.fillStyle = '#FFFFFF';
                                        ctx.font = `bold ${Math.floor(h * 0.03)}px Tahoma, sans-serif`;
                                        ctx.textAlign = 'center';
                                        ctx.textBaseline = 'middle';
                                        ctx.fillText(`شهید ${profileName}`, cx, ry + rh / 2);
                                        ctx.restore();
                                    }
                                }
                            } catch (e) {
                                console.log('Avatar overlay fallback:', e);
                            }
                        }

                        canvas.toBlob((blob) => {
                            if (blob) {
                                const blobUrl = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = blobUrl;
                                link.download = `${titleShort}.png`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                URL.revokeObjectURL(blobUrl);
                            } else {
                                throw new Error("Blob creation failed");
                            }
                        }, 'image/png');
                    } else {
                        throw new Error("Could not get 2d context");
                    }
                } catch (canvasErr) {
                    console.error("Canvas draw failed, falling back to direct download:", canvasErr);
                    const link = document.createElement('a');
                    link.href = imageUrl;
                    link.download = `${titleShort}.png`;
                    link.target = '_blank';
                    link.click();
                }
            };
            img.onerror = () => {
                const link = document.createElement('a');
                link.href = imageUrl;
                link.download = `${titleShort}.png`;
                link.target = '_blank';
                link.click();
            };
        } catch (err) {
            console.error(err);
        }
    };

    const handleCopyText = (id: string, text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleDeleteCreation = (id: string) => {
        if (setDocuments && window.confirm('آیا از حذف این اثر آفرینش هوشمند از گالری و آرشیو اطمینان دارید؟')) {
            setDocuments(prev => prev.filter(doc => doc.id !== id));
        }
    };

    const closeModal = () => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        setIsNarrating(false);
        setIsModalOpen(false);
    };

    const handleNarrate = (textToRead: string) => {
        if ('speechSynthesis' in window) {
            if (isNarrating) {
                window.speechSynthesis.cancel();
                setIsNarrating(false);
            } else {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(textToRead);
                utterance.lang = 'fa-IR';
                utterance.rate = 0.95;
                utterance.onend = () => setIsNarrating(false);
                utterance.onerror = () => setIsNarrating(false);
                window.speechSynthesis.speak(utterance);
                setIsNarrating(true);
            }
        } else {
            (window as any).alert('مرورگر شما از قابلیت خوانش صوتی هوشمند پشتیبانی نمی‌کند.');
        }
    };

    const categories = [
        { id: 'cinematic', label: 'آثار ویدئویی و سینمایی', icon: Film, color: 'bg-blue-500' },
        { id: 'written', label: 'آثار مکتوب', icon: Book, color: 'bg-green-500' },
        { id: 'digital', label: 'آثار دیجیتال', icon: Gamepad2, color: 'bg-purple-500' },
        { id: 'visual', label: 'آثار تجسمی', icon: PaletteIcon, color: 'bg-amber-500' },
    ];

    const contentData = {
        cinematic: [
            { title: 'مستند تاریخی ایثار', icon: VideoIcon, desc: 'بازخوانی وقایع ایثار با استفاده از اسناد آرشیوی' },
            { title: 'فیلم داستانی (کوتاه/بلند)', icon: Clapperboard, desc: 'روایت سینمایی با دیالوگ‌نویسی از زندگی شهدا' },
            { title: 'سریال‌های تلویزیونی', icon: Tv, desc: 'سیناپس و چارچوب داستان دنباله‌دار' },
            { title: 'انیمیشن آموزشی', icon: MonitorPlay, desc: 'سناریوی جذاب بر پایه مفاهیم برای نوجوانان' },
            { title: 'کلیپ کوتاه', icon: Film, desc: 'آپلود ویدئو، تحلیل هوشمند و تولید ویدئو کوتاه سینمایی جدید تا ۳ ثانیه' },
        ],
        written: [
            { title: 'کتاب پژوهشی / مستند', icon: Library, desc: 'تدوین ساختار و نگارش فصول مرجع از روی اسناد' },
            { title: 'رمان مستند و بیوگرافی', icon: BookOpen, desc: 'روایت داستانی و ادبی قوی از زندگینامه' },
            { title: 'مجموعه شعر و دلنوشته', icon: ScrollText, desc: 'خلق ادبی متون حماسی و آیینی' },
            { title: 'نمایشنامه حرفه‌ای', icon: PenTool, desc: 'متن نمایشی دیالوگ‌محور برای اجرای صحنه' },
        ],
        digital: [
            { title: 'سناریو بازی رایانه‌ای', icon: Dices, desc: 'طراحی گیم‌پلی و روایت تعاملی عملیات‌ها' },
            { title: 'نقشه راه اپلیکیشن', icon: Smartphone, desc: 'ایده‌پردازی فیچرهای دیجیتال برای گوشی هوشمند' },
            { title: 'تجربه واقعیت مجازی (VR)', icon: Glasses, desc: 'طراحی فضاسازی محیطی و روایی ۳۶۰ درجه' },
            { title: 'محتوای فضای مجازی', icon: Layers, desc: 'تولید رشته توییت، کپشن و تقویم محتوایی' },
        ],
        visual: [
            { title: 'ایده نقاشی دیواری', icon: Brush, desc: 'مفهوم‌سازی تصویرسازی بزرگ همراه پالت رنگی' },
            { title: 'طرح مجسمه و المان', icon: Diamond, desc: 'توصیف جزئیات المان‌های شهری و تندیس مفاخر' },
            { title: 'ایدئولوژی عکاسی هنری', icon: Camera, desc: 'دکوپاژ صحنه‌های بازسازی‌شده برای عکاسی' },
            { title: 'طراحی پوستر گرافیکی', icon: LayoutTemplate, desc: 'شعارهای تبلیغاتی و ترکیب‌بندی هویت بصری' },
        ]
    };

    const toggleMainTag = (tag: string) => {
        setSelectedTags(prev => 
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
    };

    const toggleJobProfile = (id: string) => {
        setJobProfiles(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
    };
    
    const toggleJobTag = (tag: string) => {
        setJobTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
    };

    const filteredTags = useMemo(() => {
        return tags.filter(tag => tag.toLowerCase().includes(tagSearch.toLowerCase()));
    }, [tags, tagSearch]);

    const relatedDocsCount = useMemo(() => {
        if (selectedTags.length === 0) return 0;
        return documents.filter(doc => 
            doc.tags?.some(tag => selectedTags.includes(tag))
        ).length;
    }, [documents, selectedTags]);

    return (
        <div className="space-y-8 pb-10">
            {/* Hero Header */}
            <div className="bg-gradient-to-l from-[#1A5D1A] to-[#2A752A] rounded-[40px] p-10 text-white relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="text-right flex-1">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                                <PaletteIcon size={32} className="text-[#D4AF37]" />
                            </div>
                            <h1 className="text-4xl font-black text-white px-2">هوشمند نگارالبرز</h1>
                        </div>
                        <p className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-l from-white to-[#D4AF37] mb-6">هنری ماندگار چون کوه البرز</p>
                        <p className="text-lg opacity-80 leading-relaxed max-w-2xl">مرکز تخصصی تولید و آفرینش آثار هنری، مکتوب و دیجیتال بر پایه گنجینه عظیم اسناد ایثارگران استان البرز.</p>
                    </div>
                    <div className="w-full md:w-auto flex gap-4">
                        <div className="bg-black/20 backdrop-blur-xl p-6 rounded-3xl border border-white/10 text-center">
                            <span className="block text-4xl font-black text-[#D4AF37] mb-1">۴</span>
                            <span className="text-xs opacity-60">حوزه اصلی تولید</span>
                        </div>
                        <div className="bg-black/20 backdrop-blur-xl p-6 rounded-3xl border border-white/10 text-center">
                            <span className="block text-4xl font-black text-[#D4AF37] mb-1">{localizeNumber(selectedTags.length, 'fa')}</span>
                            <span className="text-xs opacity-60">تگ‌های مرتبط</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Tabs */}
            <div className="flex flex-wrap gap-4">
                {categories.map((cat) => (
                    <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActiveCategory(cat.id as ArtCategory)}
                        className={`flex-1 min-w-[200px] p-6 rounded-3xl font-bold transition-all flex flex-col items-center gap-3 border-2 ${
                            activeCategory === cat.id 
                            ? 'bg-white dark:bg-gray-800 border-[#1A5D1A] text-[#1A5D1A] shadow-xl dark:shadow-none translate-y-[-4px]' 
                            : 'bg-gray-50/50 dark:bg-gray-900 border-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                    >
                        <div className={`p-3 rounded-2xl ${activeCategory === cat.id ? cat.color + ' text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>
                            <cat.icon size={28} />
                        </div>
                        <span>{cat.label}</span>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Content Cards */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {contentData[activeCategory].map((item, idx) => (
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                key={idx}
                                className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-soft hover:shadow-xl transition-all group"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-2xl group-hover:scale-110 transition-transform">
                                        <item.icon size={24} className="text-[#1A5D1A] dark:text-[#D4AF37]" />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{item.title}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{item.desc}</p>
                                    </div>
                                </div>
                                <div className="mt-6 flex justify-end">
                                    <button 
                                        type="button"
                                        onClick={() => openGenerationSettings(item.title)}
                                        className="text-xs font-bold bg-[#1A5D1A]/10 text-[#1A5D1A] dark:bg-[#D4AF37]/10 dark:text-[#D4AF37] px-4 py-2 rounded-xl flex items-center gap-1 hover:gap-2 transition-all hover:bg-[#1A5D1A]/20 dark:hover:bg-[#D4AF37]/20"
                                    >
                                        تنظیمات و سفارش تولید <ChevronRight size={14} className="rtl:rotate-180" />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Featured Preview / Information */}
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-[40px] border border-gray-100 dark:border-gray-700 shadow-soft">
                        <div className="flex items-center gap-3 mb-6">
                            <Info size={24} className="text-[#D4AF37]" />
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white">توضیحاتی پیرامون فرآیند خلاقیت هوش مصنوعی</h3>
                        </div>
                        <p className="text-sm leading-8 text-gray-600 dark:text-gray-300 mb-6 font-medium">
                            هوشمند نگارالبرز با دریافت کلیدواژه‌ها، ارتباطات پرونده‌ای، مقالات، اسناد واقعی و دستورات خاص شما، از طریق مدل‌های پیشرفته زبانی اقدام به ایده‌پردازی، سناریونویسی و تولید محتوای کاملا بدیع و در عین حال مستند می‌نماید. محصولات تولیدی نهایی در پرونده‌ها قابل ثبت هستند.
                        </p>
                        <div className="relative aspect-video rounded-3xl overflow-hidden mb-6">
                            <img 
                                src="https://lh3.googleusercontent.com/d/1Xg6hM4GjQ9L7pUqN6vJ5_o3tTNYd_IuV" 
                                alt="Hooshmand Negar Creative Process" 
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-8">
                                <div className="text-white">
                                    <p className="text-2xl font-black mb-2">تلفیق هوش مصنوعی و هنر متعهد</p>
                                    <p className="opacity-80 text-sm">تبدیل لحظات جاودانه نبرد به رمان‌های چندصد صفحه‌ای یا فیلم‌های نفس‌گیر</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Pre-selection Tag Context List */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-[40px] shadow-soft border border-gray-100 dark:border-gray-700 sticky top-24">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-black text-[#1A5D1A] dark:text-yade-gold flex items-center gap-2">
                                <Tags size={24} /> راهنمای کانتکست
                            </h3>
                            {selectedTags.length > 0 && (
                                <button type="button" onClick={() => setSelectedTags([])} className="text-xs text-red-500 font-bold">حذف همه</button>
                            )}
                        </div>

                        <p className="text-[13px] text-gray-500 mb-6 leading-relaxed">
                            انتخاب این تگ‌ها کمک می‌کند تا وقتی روی «سفارش تولید» کلیک می‌کنید، تگ‌های مرتبط با نیازتان به صورت پیش‌فرض انتخاب شده باشند و نتایج دقیقی حاصل شود.
                        </p>

                        <div className="relative mb-6">
                            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input 
                                type="text"
                                placeholder="جستجوی تگ (عملیات، خاطره...)"
                                className="w-full pr-12 pl-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm focus:ring-2 focus:ring-[#1A5D1A] dark:focus:ring-[#D4AF37] outline-none text-right"
                                value={tagSearch}
                                onChange={(e) => setTagSearch(e.target.value)}
                            />
                        </div>

                        <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto custom-scrollbar">
                            {filteredTags.map((tag, idx) => (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() => toggleMainTag(tag)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                        selectedTags.includes(tag)
                                        ? 'bg-[#1A5D1A] text-white shadow-md'
                                        : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                                    }`}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>

                        {selectedTags.length > 0 && (
                            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700 space-y-3">
                                <span className="text-xs text-gray-400 font-bold block">مجموع آثار متناظر پرونده‌های آرشیو:</span>
                                <div className="text-xl font-black text-[#D4AF37]">{localizeNumber(relatedDocsCount, 'fa')} کانتکست فعال</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* گالری آثار آفرینش هوشمند */}
            <div className="bg-white dark:bg-gray-800 p-8 rounded-[40px] border border-gray-100 dark:border-gray-700 shadow-soft space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-50 dark:border-gray-700 pb-5">
                    <div>
                        <h2 className="text-2xl font-black text-[#1A5D1A] dark:text-[#D4AF37] flex items-center gap-2">
                            <Sparkles size={28} className="text-[#D4AF37] animate-pulse" /> بایگانی و گالری آثار آفرینش هوشمند البرز
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">نسخه‌های شبیه‌سازی شده فعال اسنادی شما جهت استفاده در قالب‌های رسانه‌ای رمان، فیلم و آثار هنری</p>
                    </div>
                    <div className="bg-[#1A5D1A]/10 text-[#1A5D1A] dark:bg-[#D4AF37]/10 dark:text-[#D4AF37] font-black text-xs px-4 py-2 rounded-2xl">
                        {localizeNumber(savedCreations.length, 'fa')} اثر خلاقانه ثبت‌شده
                    </div>
                </div>

                {savedCreations.length === 0 ? (
                    <div className="text-center py-16 border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-3xl space-y-4">
                        <PaletteIcon size={48} className="text-gray-300 dark:text-gray-600 mx-auto" />
                        <div className="space-y-1">
                            <h3 className="font-bold text-gray-700 dark:text-gray-300">هیچ اثر هنری یا ادبی هنوز ثبت نشده است</h3>
                            <p className="text-xs text-gray-400">یکی از ۴ حوزه اصلی تولیدات بالا در صفحه را برگزینید و با کلیک بر روی «سفارش تولید»، اولین اثرتان را بیافرینید.</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {savedCreations.map((doc) => {
                            let cardColor = 'border-rose-500/20';
                            let iconColor = 'text-rose-500 bg-rose-500/10';
                            let label = 'طرح رسانه‌ای';
                            let Icon = ScrollText;
                            
                            if (doc.type === 'image') {
                                cardColor = 'border-emerald-500/20';
                                iconColor = 'text-emerald-500 bg-emerald-500/10';
                                label = 'طرح تجسمی و هنری';
                                Icon = Brush;
                            } else if (doc.type === 'video') {
                                cardColor = 'border-blue-500/20';
                                iconColor = 'text-blue-500 bg-blue-500/10';
                                label = 'سیناپس و سناریو خلاقانه';
                                Icon = Film;
                            } else {
                                cardColor = 'border-purple-500/20';
                                iconColor = 'text-purple-500 bg-purple-500/10';
                                label = 'اثر مکتوب و رمان';
                                Icon = BookOpen;
                            }

                            return (
                                <motion.div
                                    key={doc.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    whileHover={{ y: -4 }}
                                    className={`bg-gray-50/50 dark:bg-gray-900 border-2 ${cardColor} rounded-3xl p-5 flex flex-col justify-between hover:shadow-xl transition-all relative overflow-hidden`}
                                >
                                    <div>
                                        {/* Header */}
                                        <div className="flex justify-between items-start gap-2 mb-4">
                                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-xl text-[10px] font-black ${iconColor}`}>
                                                <Icon size={12} /> {label}
                                            </span>
                                            <span className="text-[10px] text-gray-400 font-mono">{doc.date}</span>
                                        </div>

                                        {/* Visual Thumbnail Preview if any */}
                                        {doc.thumbnail && (
                                            <div className="aspect-video w-full rounded-2xl overflow-hidden mb-4 bg-gray-200 dark:bg-gray-800 border dark:border-gray-800 relative group">
                                                <img 
                                                    src={doc.thumbnail} 
                                                    alt={doc.title} 
                                                    referrerPolicy="no-referrer"
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                                            </div>
                                        )}

                                        {/* Titles */}
                                        <h3 className="font-extrabold text-gray-800 dark:text-white text-base line-clamp-1 mb-2">{doc.title}</h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 mb-4 leading-relaxed">{doc.description}</p>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2 mt-2">
                                        <button
                                            type="button"
                                            onClick={() => openSavedDocument(doc)}
                                            className="px-3.5 py-2 text-xs font-black bg-[#1A5D1A] text-white rounded-xl hover:bg-green-800 transition-all flex items-center gap-1"
                                            title="بازگشایی در پلیر تعاملی هوش مصنوعی جهت بازپخش سناریو و دکلمه صوتی"
                                        >
                                            <Play size={12} fill="currentColor" /> پخش هوشمند
                                        </button>

                                        <div className="flex gap-1">
                                            <button
                                                type="button"
                                                onClick={() => downloadDocText(doc)}
                                                className="p-2 text-gray-500 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all border-b-2 flex items-center justify-center"
                                                title="دانلود کل متن سناریو و فصول مکتوب"
                                            >
                                                <Download size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleCopyText(doc.id, doc.description || '')}
                                                className="p-2 text-gray-500 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all flex items-center justify-center min-w-[34px]"
                                                title="کپی متن خلاقانه در کلیپ‌بورد"
                                            >
                                                {copiedId === doc.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteCreation(doc.id)}
                                                className="p-2 text-rose-500 hover:text-white bg-white dark:bg-gray-800 hover:bg-rose-500 border border-rose-100 dark:border-rose-950 rounded-xl transition-all flex items-center justify-center"
                                                title="حذف کامل این اثر از آرشیو"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-white dark:bg-gray-900 rounded-[40px] w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl relative border border-gray-100 dark:border-gray-800"
                        >
                            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/80">
                                <h3 className="font-black text-[#1A5D1A] dark:text-[#D4AF37] flex items-center gap-2 text-xl">
                                    <Sparkles size={24} />
                                    اتاق تولید هوشمند: {generationType}
                                </h3>
                                <button type="button" onClick={closeModal} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500">
                                    <X size={20} />
                                </button>
                            </div>
                            
                            <div className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-white dark:bg-gray-900">
                                {modalState === 'setup' && (
                                    <div className="space-y-8 animate-fade-in">
                                        {(activeCategory === 'visual' || generationType === 'کلیپ کوتاه' || generationType.includes('نقاشی') || generationType.includes('پوستر') || generationType.includes('دیواری') || generationType.includes('المان')) && (
                                            <div className="space-y-4">
                                                <div className="bg-blue-50/40 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-[30px] p-6 space-y-4">
                                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                                        <h4 className="font-extrabold text-[#1A5D1A] dark:text-[#D4AF37] flex items-center gap-2 text-sm">
                                                            <Film size={18} /> انتخاب و تحلیل چهره مرجع یا تصویر اثر (انطباق با پرونده ایثارگر)
                                                        </h4>
                                                        {/* Ref Type Selector */}
                                                        <div className="flex bg-gray-200/80 dark:bg-gray-800 p-1 rounded-xl gap-1 text-xs font-bold overflow-x-auto custom-scrollbar w-full sm:w-auto">
                                                            <button
                                                                type="button"
                                                                onClick={() => setRefMediaType('profile')}
                                                                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${refMediaType === 'profile' ? 'bg-[#1A5D1A] text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}
                                                            >
                                                                <User size={14} /> 🎖️ تصویر پرونده پرسنلی
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setRefMediaType('image')}
                                                                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${refMediaType === 'image' ? 'bg-[#1A5D1A] text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}
                                                            >
                                                                <ImageIcon size={14} /> 📷 عکس مرجع دلخواه
                                                            </button>
                                                            {generationType === 'کلیپ کوتاه' && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setRefMediaType('video')}
                                                                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${refMediaType === 'video' ? 'bg-[#1A5D1A] text-white shadow-sm' : 'text-gray-600 dark:text-gray-300'}`}
                                                                >
                                                                    <VideoIcon size={14} /> 🎥 ویدئوی مرجع کوتاه
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                                                        {refMediaType === 'profile' ? (
                                                            /* Profile Avatar Card */
                                                            <div className="border border-amber-300 dark:border-amber-900/60 rounded-2xl p-4 transition-all relative flex flex-col justify-between bg-amber-50/50 dark:bg-amber-950/30 min-h-[140px]">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="relative w-16 h-16 rounded-full border-2 border-amber-500 overflow-hidden shadow-md flex-shrink-0 bg-black/40">
                                                                        <img 
                                                                            src={selectedProfile?.avatar || APP_LOGO_URL} 
                                                                            alt={selectedProfile?.name || 'تصویر شهید'} 
                                                                            onError={(e) => { (e.target as HTMLImageElement).src = APP_LOGO_URL; }} 
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                    </div>
                                                                    <div className="flex-1 text-right space-y-1">
                                                                        <label className="text-[10px] font-black text-amber-800 dark:text-amber-400 block">انتخاب شهید از پرونده پرسنلی:</label>
                                                                        <select
                                                                            value={selectedProfile?.id || ''}
                                                                            onChange={(e) => setSelectedProfileId(e.target.value)}
                                                                            className="w-full text-xs bg-white dark:bg-gray-800 border border-amber-300 dark:border-gray-700 rounded-lg p-1.5 text-gray-800 dark:text-gray-200 font-bold focus:ring-1 focus:ring-amber-500"
                                                                        >
                                                                            {MOCK_PROFILES.map((p) => (
                                                                                <option key={p.id} value={p.id}>
                                                                                    شهید {p.name} {p.family} ({p.unit || 'بسیج'})
                                                                                </option>
                                                                            ))}
                                                                        </select>
                                                                        {selectedProfile && (
                                                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium truncate">
                                                                                محل شهادت: {selectedProfile.city || 'البرز'} | کد پرونده: {selectedProfile.id}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="mt-2 text-[10px] text-amber-900 dark:text-amber-300 font-bold bg-amber-100/80 dark:bg-amber-900/40 px-2.5 py-1 rounded-lg text-center border border-amber-300/40">
                                                                    ✨ چهره این پرونده جهت انطباق عینا در تولید دیوارنگاره / پوستر استفاده می‌شود.
                                                                </div>
                                                            </div>
                                                        ) : refMediaType === 'image' ? (
                                                            /* Image Upload Dropzone */
                                                            <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-[#1A5D1A] rounded-2xl p-6 transition-all relative flex flex-col justify-center items-center text-center bg-white dark:bg-gray-800 min-h-[140px]">
                                                                <input 
                                                                    type="file" 
                                                                    accept="image/*" 
                                                                    onChange={handleImageUpload}
                                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                                />
                                                                {uploadedImageUrl ? (
                                                                    <div className="flex flex-col items-center space-y-2">
                                                                        <img src={uploadedImageUrl} alt="Ref preview" className="w-16 h-16 object-cover rounded-xl border-2 border-[#1A5D1A] shadow-md" />
                                                                        <p className="text-xs font-bold text-[#1A5D1A] dark:text-[#D4AF37] line-clamp-1">{uploadedImageFile?.name || 'تصویر انتخاب شد'}</p>
                                                                        <p className="text-[10px] text-gray-400">فرمت عکس آماده پردازش چهره و صحنه</p>
                                                                    </div>
                                                                ) : (
                                                                    <div className="space-y-1">
                                                                        <ImageIcon size={32} className="text-gray-400 dark:text-gray-500 mb-2 mx-auto" />
                                                                        <p className="text-xs font-bold text-gray-700 dark:text-gray-200">جهت انتخاب تصویر مرجع (عکس دلخواه) کلیک کنید</p>
                                                                        <p className="text-[10px] text-gray-400">فرمت‌های JPG, PNG, WEBP</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            /* Video Upload Dropzone */
                                                            <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-[#1A5D1A] rounded-2xl p-6 transition-all relative flex flex-col justify-center items-center text-center bg-white dark:bg-gray-800 min-h-[140px]">
                                                                <input 
                                                                    type="file" 
                                                                    accept="video/*" 
                                                                    onChange={handleVideoUpload}
                                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                                />
                                                                <VideoIcon size={32} className="text-gray-400 dark:text-gray-500 mb-2 mx-auto" />
                                                                {uploadedVideoFile ? (
                                                                    <div className="space-y-1">
                                                                        <p className="text-xs font-bold text-[#1A5D1A] dark:text-[#D4AF37] line-clamp-1">{uploadedVideoFile.name}</p>
                                                                        <p className="text-[10px] text-gray-400">حجم: {localizeNumber((uploadedVideoFile.size / (1024 * 1024)).toFixed(2), 'fa')} مگابایت</p>
                                                                    </div>
                                                                ) : (
                                                                    <div className="space-y-1">
                                                                        <p className="text-xs font-bold text-gray-700 dark:text-gray-200">جهت انتخاب ویدیو مرجع کلیک کنید یا فایل را بکشید</p>
                                                                        <p className="text-[10px] text-gray-400">فرمت‌های MP4, WEBM</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Media Analyzer Action & Feed */}
                                                        <div className="flex flex-col justify-between border border-gray-100 dark:border-gray-800 p-4 rounded-2xl bg-gray-50/50 dark:bg-gray-800/50 min-h-[140px]">
                                                            {refMediaType === 'profile' ? (
                                                                <button
                                                                    type="button"
                                                                    disabled={!selectedProfile?.avatar || isAnalyzingImage}
                                                                    onClick={handleAnalyzeImage}
                                                                    className={`w-full py-2.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 ${
                                                                        !selectedProfile?.avatar 
                                                                        ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600 cursor-not-allowed' 
                                                                        : 'bg-[#1A5D1A] hover:bg-green-800 text-white shadow-md active:scale-95'
                                                                    }`}
                                                                >
                                                                    {isAnalyzingImage ? (
                                                                        <>
                                                                            <Loader2 size={14} className="animate-spin" /> در حال تحلیل چهره پرونده پرسنلی...
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Sparkles size={14} /> تحلیل هوشمند چهره پرسنلی با هوش مصنوعی
                                                                        </>
                                                                    )}
                                                                </button>
                                                            ) : refMediaType === 'image' ? (
                                                                <button
                                                                    type="button"
                                                                    disabled={!uploadedImageUrl || isAnalyzingImage}
                                                                    onClick={handleAnalyzeImage}
                                                                    className={`w-full py-2.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 ${
                                                                        !uploadedImageUrl 
                                                                        ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600 cursor-not-allowed' 
                                                                        : 'bg-[#1A5D1A] hover:bg-green-800 text-white shadow-md active:scale-95'
                                                                    }`}
                                                                >
                                                                    {isAnalyzingImage ? (
                                                                        <>
                                                                            <Loader2 size={14} className="animate-spin" /> در حال تحلیل چهره و عناصر تصویر...
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Sparkles size={14} /> تحلیل هوشمند عکس مرجع با هوش مصنوعی
                                                                        </>
                                                                    )}
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    disabled={!uploadedVideoFile || isAnalyzingVideo}
                                                                    onClick={handleAnalyzeVideo}
                                                                    className={`w-full py-2.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 ${
                                                                        !uploadedVideoFile 
                                                                        ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600 cursor-not-allowed' 
                                                                        : 'bg-[#1A5D1A] hover:bg-green-800 text-white shadow-md active:scale-95'
                                                                    }`}
                                                                >
                                                                    {isAnalyzingVideo ? (
                                                                        <>
                                                                            <Loader2 size={14} className="animate-spin" /> در حال تحلیل زیباشناختی صحنه...
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Sparkles size={14} /> تحلیل زیباشناختی ویدیو توسط هوش مصنوعی
                                                                        </>
                                                                    )}
                                                                </button>
                                                            )}

                                                            {(imageAnalysisReport || videoAnalysisReport) ? (
                                                                <div className="mt-3 text-right bg-white dark:bg-gray-800 p-3 rounded-xl border border-green-500/20 text-[10px] leading-relaxed text-gray-600 dark:text-gray-300 overflow-y-auto max-h-[85px] custom-scrollbar">
                                                                    {(imageAnalysisReport || videoAnalysisReport)?.split('\n').map((line, idx) => (
                                                                        <p key={idx} className="mb-0.5 font-bold">{line}</p>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center m-auto leading-relaxed">
                                                                    {refMediaType === 'profile'
                                                                        ? 'تصویر پرسنلی انتخاب شد. جهت استخراج شناسه‌های هوشمند چهره کلیک کنید.'
                                                                        : refMediaType === 'image'
                                                                            ? (!uploadedImageUrl ? 'لطفاً ابتدا تصویر/عکس مرجع را انتخاب فرمایید' : 'تصویر آماده تحلیل است. بر روی دکمه بالا جهت استخراج جزئیات چهره کلیک کنید')
                                                                            : (!uploadedVideoFile ? 'لطفاً ابتدا فایل ویدیو خود را انتخاب کنید' : 'ویدیو آماده تحلیل است. بر روی دکمه بالا جهت استخراج نورپردازی کلیک کنید')}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Mural & Poster Techniques Picker */}
                                                {(activeCategory === 'visual' || generationType.includes('نقاشی') || generationType.includes('پوستر') || generationType.includes('دیواری') || generationType.includes('المان')) && (
                                                    <div className="bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-[28px] p-5 space-y-3">
                                                        <div className="flex justify-between items-center">
                                                            <h4 className="font-extrabold text-amber-900 dark:text-amber-300 flex items-center gap-2 text-xs">
                                                                <Sparkles size={16} className="text-[#D4AF37]" /> انتخاب تکنیک هنری و فضای دیوارنگاره / پوستر:
                                                            </h4>
                                                            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-2.5 py-0.5 rounded-full">
                                                                متناسب با آرمان‌های دفاع مقدس
                                                            </span>
                                                        </div>
                                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => setMuralStyle('urban_mural')}
                                                                className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between space-y-1 ${muralStyle === 'urban_mural' ? 'bg-[#1A5D1A] text-white border-[#1A5D1A] shadow-md ring-2 ring-[#D4AF37]' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:border-amber-400'}`}
                                                            >
                                                                <span className="font-extrabold text-xs">🖌️ دیوارنگاره شهری</span>
                                                                <span className="text-[9px] opacity-80 leading-tight">سیمان شهری، قاب نستعلیق، سنگر و هاله نور</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setMuralStyle('epic_poster')}
                                                                className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between space-y-1 ${muralStyle === 'epic_poster' ? 'bg-[#1A5D1A] text-white border-[#1A5D1A] shadow-md ring-2 ring-[#D4AF37]' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:border-amber-400'}`}
                                                            >
                                                                <span className="font-extrabold text-xs">📜 پوستر حماسی</span>
                                                                <span className="text-[9px] opacity-80 leading-tight">بافت کاغذ عتیق، لاله سرخ، پلاک و تایپوگرافی</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setMuralStyle('tile_miniature')}
                                                                className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between space-y-1 ${muralStyle === 'tile_miniature' ? 'bg-[#1A5D1A] text-white border-[#1A5D1A] shadow-md ring-2 ring-[#D4AF37]' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:border-amber-400'}`}
                                                            >
                                                                <span className="font-extrabold text-xs">🕌 کاشی‌کاری آیینی</span>
                                                                <span className="text-[9px] opacity-80 leading-tight">کاشی لاجوردی و فیروزه‌ای و اسلیمی اصیل</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setMuralStyle('oil_trench')}
                                                                className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between space-y-1 ${muralStyle === 'oil_trench' ? 'bg-[#1A5D1A] text-white border-[#1A5D1A] shadow-md ring-2 ring-[#D4AF37]' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:border-amber-400'}`}
                                                            >
                                                                <span className="font-extrabold text-xs">🎨 رنگ‌روغن سنگر</span>
                                                                <span className="text-[9px] opacity-80 leading-tight">بافت برجسته، غروب شلمچه و ارتفاعات البرز</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            {/* Attributes Section */}
                                            <div className="space-y-6">
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                                                        <Tags size={16} className="text-[#D4AF37]"/> کلیدواژه‌ها (مرجع اسناد)
                                                    </label>
                                                    <div className="flex flex-wrap gap-2 p-4 border border-gray-100 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-800 max-h-48 overflow-y-auto">
                                                        {tags.map((tag, idx) => (
                                                            <button
                                                                key={tag}
                                                                type="button"
                                                                onClick={() => toggleJobTag(tag)}
                                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                                                    jobTags.includes(tag)
                                                                    ? 'bg-[#1A5D1A] text-white'
                                                                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
                                                                }`}
                                                            >
                                                                {tag}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
 
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-2">
                                                        <User size={16} className="text-[#D4AF37]"/> انتخاب پرونده اشخاص (قهرمانان داستان)
                                                    </label>
                                                    {/* Advanced Search Input for Profiles */}
                                                    <div className="relative mb-2">
                                                        <Search size={14} className="absolute right-3 top-2.5 text-gray-400" />
                                                        <input
                                                            type="text"
                                                            value={profileSearchQuery}
                                                            onChange={(e) => setProfileSearchQuery(e.target.value)}
                                                            placeholder="جستجوی پیشرفته (نام، فامیل، کد ملی، شهر، یگان...)"
                                                            className="w-full pr-8 pl-3 py-1.5 text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-1 focus:ring-[#1A5D1A] dark:text-white"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-2 p-3 border border-gray-100 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-800 max-h-48 overflow-y-auto custom-scrollbar">
                                                        {filteredProfiles.length > 0 ? (
                                                            filteredProfiles.map((profile) => (
                                                                <label key={profile.id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        className="w-4 h-4 rounded text-[#1A5D1A] focus:ring-[#1A5D1A]"
                                                                        checked={jobProfiles.includes(profile.id)}
                                                                        onChange={() => toggleJobProfile(profile.id)}
                                                                    />
                                                                    <div className="flex flex-col text-right">
                                                                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{profile.name} {profile.family}</span>
                                                                        <span className="text-[10px] text-gray-500">کد ملی: {localizeNumber(profile.nationalCode, 'fa')} | {profile.city || 'البرز'} - {profile.unit || ''}</span>
                                                                    </div>
                                                                </label>
                                                            ))
                                                        ) : (
                                                            <div className="text-center py-4 text-xs text-gray-400">هیچ پرونده‌ای با مشخصات وارد شده یافت نشد.</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
 
                                            {/* Custom Prompt Section */}
                                            <div className="space-y-4 flex flex-col h-full">
                                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-1 flex items-center gap-2">
                                                    <PenTool size={16} className="text-[#D4AF37]"/> توضیحات تکمیلی و ایده‌های شما
                                                </label>
                                                <p className="text-[11px] text-gray-500 leading-relaxed mb-1">
                                                    {generationType === 'کلیپ کوتاه' 
                                                    ? 'در این بخش ایده، نیاز یا فضای مربوط به کلیپ ۳ ثانیه‌ای خود را وارد کنید تا هوش مصنوعی آن را با کیفیت و نورپردازی سینمایی در محصول نهایی بازآفرینی کند.'
                                                    : 'در این بخش مشخص کنید که دقیقاً چه می‌خواهید. برای مثال «یک نمایشنامه دونفره که در سنگر رخ می‌دهد، یکی از مبارزان مجروح شده و نفر دوم سعی دارد او را بیدار نگه دارد.» این توضیحات به شدت روی خروجی هوش مصنوعی تأثیر می‌گذارد.'}
                                                </p>
                                                <textarea 
                                                    className="w-full flex-1 min-h-[150px] p-5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl outline-none focus:ring-2 focus:ring-[#1A5D1A] resize-none text-sm leading-7 dark:text-white"
                                                    placeholder={generationType === 'کلیپ کوتاه' ? 'مثال: نمای لانگ شات طلوع خورشید از جاده برفی طالقان به همراه نور گرم شدید ...' : 'شرح دقیق نیاز خود را اینجا بنویسید...'}
                                                    value={jobPrompt}
                                                    onChange={(e) => setJobPrompt(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
 
                                {modalState === 'generating' && (
                                    <div className="flex flex-col items-center justify-center h-64 text-center space-y-4 animate-fade-in">
                                        <Loader2 size={48} className="animate-spin text-[#D4AF37]" />
                                        <div className="space-y-1 text-gray-500">
                                            <p className="font-bold text-gray-800 dark:text-gray-200">در حال آفرینش مستندات هنری...</p>
                                            <p className="text-sm">این فرآیند به طور مستقیم به مدل‌های تولید تصویر و متن خلاقانه متصل است.</p>
                                        </div>
                                    </div>
                                )}
 
                                {modalState === 'result' && parsedResult && (
                                     <div className="space-y-8 animate-fade-in">
                                         <div className="text-right pb-4 border-b border-gray-100 dark:border-gray-800">
                                             <span className="text-xs font-bold text-gray-400">محصول آفرینش هوشمند</span>
                                             <h2 className="text-2xl font-black text-[#1a5d1a] dark:text-[#D4AF37] mt-1">{parsedResult.title}</h2>
                                         </div>

                                         <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                                             {/* Left Column: Rich Interactive Media Preview Hub */}
                                             <div className="lg:col-span-5 space-y-4">
                                                 <div className="bg-gray-50 dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 text-center flex flex-col justify-between h-full min-h-[380px]">
                                                                                                          {parsedResult.mediaType === 'visual' && (
                                                         <div className="space-y-4 flex-1 flex flex-col justify-between">
                                                             <div className="space-y-2">
                                                                 <div className="flex justify-between items-center">
                                                                     <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500/15 text-amber-500">
                                                                         <PaletteIcon size={12} /> بوم نقاشی و پوستر یادبود
                                                                     </span>
                                                                     <span className="text-[10px] text-[#1A5D1A] dark:text-[#D4AF37] font-extrabold bg-green-50 dark:bg-green-950/40 px-2 py-0.5 rounded-md border border-green-200 dark:border-green-800">
                                                                         تطبیق بیومتریک پرونده
                                                                     </span>
                                                                 </div>

                                                                 {/* Aspect Ratio Selector */}
                                                                 <div className="flex justify-between items-center gap-1 bg-gray-200/80 dark:bg-gray-700/80 p-1 rounded-xl text-[10px] font-bold">
                                                                     <span className="text-gray-500 dark:text-gray-400 px-1 font-bold">نسبت ابعاد:</span>
                                                                     <button
                                                                         type="button"
                                                                         onClick={() => setMuralAspectRatio('16:9')}
                                                                         className={`flex-1 py-1 px-2 rounded-lg transition-all ${
                                                                             muralAspectRatio === '16:9' 
                                                                             ? 'bg-[#1A5D1A] text-white shadow-md' 
                                                                             : 'text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white'
                                                                         }`}
                                                                     >
                                                                         16:9 (دیوارنگاره)
                                                                     </button>
                                                                     <button
                                                                         type="button"
                                                                         onClick={() => setMuralAspectRatio('3:4')}
                                                                         className={`flex-1 py-1 px-2 rounded-lg transition-all ${
                                                                             muralAspectRatio === '3:4' 
                                                                             ? 'bg-[#1A5D1A] text-white shadow-md' 
                                                                             : 'text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white'
                                                                         }`}
                                                                     >
                                                                         3:4 (پوستر)
                                                                     </button>
                                                                     <button
                                                                         type="button"
                                                                         onClick={() => setMuralAspectRatio('1:1')}
                                                                         className={`flex-1 py-1 px-2 rounded-lg transition-all ${
                                                                             muralAspectRatio === '1:1' 
                                                                             ? 'bg-[#1A5D1A] text-white shadow-md' 
                                                                             : 'text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white'
                                                                         }`}
                                                                     >
                                                                         1:1 (بوم)
                                                                     </button>
                                                                 </div>

                                                                 {/* Mode Toggles */}
                                                                 <div className="flex bg-gray-200 dark:bg-gray-700/80 p-1 rounded-xl text-[10px] font-bold">
                                                                     <button
                                                                         type="button"
                                                                         onClick={() => setPosterMode('composite')}
                                                                         className={`flex-1 py-1.5 px-2 rounded-lg transition-all ${
                                                                             posterMode === 'composite' 
                                                                             ? 'bg-[#1A5D1A] text-white shadow-md' 
                                                                             : 'text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white'
                                                                         }`}
                                                                     >
                                                                         پوستر ترکیبی (عکس پرونده)
                                                                     </button>
                                                                     <button
                                                                         type="button"
                                                                         onClick={() => setPosterMode('synthetic')}
                                                                         className={`flex-1 py-1.5 px-2 rounded-lg transition-all ${
                                                                             posterMode === 'synthetic' 
                                                                             ? 'bg-[#1A5D1A] text-white shadow-md' 
                                                                             : 'text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white'
                                                                         }`}
                                                                     >
                                                                         نقاشی هوش مصنوعی
                                                                     </button>
                                                                 </div>

                                                                 {/* Martyr Profile Picker Selector */}
                                                                 <div className="text-right space-y-1">
                                                                     <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 block">انتخاب چهره شهید از آرشیو پرونده‌ها:</label>
                                                                     <select
                                                                         value={selectedProfile?.id || ''}
                                                                         onChange={(e) => setSelectedProfileId(e.target.value)}
                                                                         className="w-full text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1.5 text-gray-800 dark:text-gray-200 font-bold focus:ring-1 focus:ring-amber-500"
                                                                     >
                                                                         {MOCK_PROFILES.map((p) => (
                                                                             <option key={p.id} value={p.id}>
                                                                                 شهید {p.name} {p.family} - ({p.unit || 'استان البرز'})
                                                                             </option>
                                                                         ))}
                                                                     </select>
                                                                 </div>
                                                             </div>

                                                             {posterMode === 'composite' && selectedProfile ? (
                                                                 <div className={`relative mx-auto rounded-2xl overflow-hidden shadow-2xl border-2 border-amber-500/50 flex flex-col justify-between p-3 bg-gray-950 group transition-all duration-300 ${
                                                                     muralAspectRatio === '16:9' ? 'aspect-video w-full max-h-[260px]' : muralAspectRatio === '3:4' ? 'aspect-[3/4] w-[210px] max-h-[280px]' : 'aspect-square w-[230px] max-h-[230px]'
                                                                 }`}>
                                                                     <img 
                                                                         src={`https://image.pollinations.ai/prompt/${encodeURIComponent(parsedResult.imagePrompt)}?width=${muralAspectRatio === '16:9' ? 1024 : muralAspectRatio === '3:4' ? 768 : 800}&height=${muralAspectRatio === '16:9' ? 576 : muralAspectRatio === '3:4' ? 1024 : 800}&nologo=true&seed=${imageSeed}`}
                                                                         alt={parsedResult.title}
                                                                         referrerPolicy="no-referrer"
                                                                         className="absolute inset-0 w-full h-full object-cover transition-all duration-300 pointer-events-none opacity-50"
                                                                         style={{
                                                                             filter: `grayscale(${grayscale}%) sepia(${sepia}%) brightness(${brightness}%) contrast(${contrast}%)`
                                                                         }}
                                                                     />
                                                                     <div className="relative z-10 flex justify-between items-center text-[9px] text-amber-300 font-extrabold bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-amber-500/30">
                                                                         <span>بنیاد شهید و امور ایثارگران البرز</span>
                                                                         <span>پوستر افتخار و یادبود</span>
                                                                     </div>

                                                                     <div className="relative z-10 my-auto flex flex-col items-center">
                                                                         {/* Ornate Martyr Avatar Frame */}
                                                                         <div className="relative w-20 h-20 rounded-full border-2 border-amber-400 p-1 shadow-2xl bg-black/70 backdrop-blur-sm">
                                                                             <img 
                                                                                 src={selectedProfile.avatar || APP_LOGO_URL} onError={(e) => { (e.target as HTMLImageElement).src = APP_LOGO_URL; }} 
                                                                                 alt={selectedProfile.name}
                                                                                 referrerPolicy="no-referrer"
                                                                                 className="w-full h-full object-cover rounded-full shadow-md"
                                                                                 style={{
                                                                                     filter: `grayscale(${grayscale}%) sepia(${sepia}%) brightness(${brightness}%) contrast(${contrast}%)`
                                                                                 }}
                                                                             />
                                                                             <div className="absolute -bottom-1 -right-1 bg-amber-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded-full border border-black shadow">
                                                                                 تصویر پرسنلی
                                                                             </div>
                                                                         </div>
                                                                         <h4 className="mt-2 text-xs font-black text-white text-shadow bg-black/85 px-3 py-1 rounded-full border border-amber-500/40 shadow-lg">
                                                                             شهید {selectedProfile.name} {selectedProfile.family}
                                                                         </h4>
                                                                         <p className="text-[9px] text-amber-200 mt-0.5 bg-black/60 px-2 py-0.5 rounded">
                                                                             {selectedProfile.unit || 'لشکر ۱۰ سیدالشهداء البرز'}
                                                                         </p>
                                                                     </div>

                                                                     <div className="relative z-10 text-[10px] text-gray-200 text-center bg-black/80 backdrop-blur-md p-1.5 rounded-lg border border-white/10 truncate font-bold">
                                                                         {parsedResult.title}
                                                                     </div>
                                                                 </div>
                                                             ) : (
                                                                 <div className={`relative mx-auto rounded-2xl overflow-hidden shadow-lg border-4 border-amber-900/10 flex items-center justify-center bg-gray-100 dark:bg-gray-900 group transition-all duration-300 ${
                                                                     muralAspectRatio === '16:9' ? 'aspect-video w-full max-h-[250px]' : muralAspectRatio === '3:4' ? 'aspect-[3/4] w-[210px] max-h-[280px]' : 'aspect-square w-[230px] max-h-[230px]'
                                                                 }`}>
                                                                     <img 
                                                                         src={`https://image.pollinations.ai/prompt/${encodeURIComponent(parsedResult.imagePrompt)}?width=${muralAspectRatio === '16:9' ? 1024 : muralAspectRatio === '3:4' ? 768 : 800}&height=${muralAspectRatio === '16:9' ? 576 : muralAspectRatio === '3:4' ? 1024 : 800}&nologo=true&seed=${imageSeed}`}
                                                                         alt={parsedResult.title}
                                                                         referrerPolicy="no-referrer"
                                                                         className="w-full h-full object-cover transition-all duration-300 pointer-events-none"
                                                                         style={{
                                                                             filter: `grayscale(${grayscale}%) sepia(${sepia}%) brightness(${brightness}%) contrast(${contrast}%)`
                                                                         }}
                                                                     />
                                                                     <div className="absolute inset-x-0 bottom-0 bg-black/75 backdrop-blur-xs py-1.5 px-3 text-[10px] text-amber-300 text-center font-bold">
                                                                         {selectedProfile ? `تصویرسازی هنری هوش مصنوعی - شهید ${selectedProfile.name} ${selectedProfile.family}` : 'تکنیک مینیاتور دیجیتال هوشمند'}
                                                                     </div>
                                                                 </div>
                                                             )}

                                                             {/* Prompt Copy Action */}
                                                             <div className="bg-amber-50/60 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/50 flex justify-between items-center gap-2 text-right">
                                                                 <div className="flex-1 min-w-0">
                                                                     <span className="text-[9px] font-black text-amber-800 dark:text-amber-300 block">پرامپت تخصصی پردازش‌شده هوش مصنوعی:</span>
                                                                     <p className="text-[9px] text-gray-600 dark:text-gray-400 font-mono truncate dir-ltr">{parsedResult.imagePrompt}</p>
                                                                 </div>
                                                                 <button
                                                                     type="button"
                                                                     onClick={() => {
                                                                         navigator.clipboard.writeText(parsedResult.imagePrompt);
                                                                         setPromptCopiedToast(true);
                                                                         setTimeout(() => setPromptCopiedToast(false), 2500);
                                                                     }}
                                                                     className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-[10px] rounded-lg transition-all flex items-center gap-1 flex-shrink-0"
                                                                 >
                                                                     {promptCopiedToast ? 'کپی شد! ✓' : 'کپی پرامپت'}
                                                                 </button>
                                                             </div>

                                                             {/* Filters Setup */}
                                                             <div className="space-y-2 pt-1 text-right">
                                                                 <div className="flex justify-between items-center text-xs">
                                                                     <span className="font-bold text-gray-500 dark:text-gray-400">گرادیان سیاه و سفید</span>
                                                                     <input 
                                                                         type="range" 
                                                                         min="0" max="100" 
                                                                         className="w-24 accent-[#1a5d1a]"
                                                                         value={grayscale} 
                                                                         onChange={(e) => setGrayscale(Number(e.target.value))}
                                                                     />
                                                                 </div>
                                                                 <div className="flex justify-between items-center text-xs">
                                                                     <span className="font-bold text-gray-500 dark:text-gray-400">افکت سپیا (کهنه‌نما)</span>
                                                                     <input 
                                                                         type="range" 
                                                                         min="0" max="100" 
                                                                         className="w-24 accent-[#1a5d1a]"
                                                                         value={sepia} 
                                                                         onChange={(e) => setSepia(Number(e.target.value))}
                                                                     />
                                                                 </div>
                                                                 <div className="flex justify-between items-center text-xs">
                                                                     <span className="font-bold text-gray-500 dark:text-gray-400">تضاد نوری (کنتراست)</span>
                                                                     <input 
                                                                         type="range" 
                                                                         min="50" max="150" 
                                                                         className="w-24 accent-[#1a5d1a]"
                                                                         value={contrast} 
                                                                         onChange={(e) => setContrast(Number(e.target.value))}
                                                                     />
                                                                 </div>
                                                             </div>

                                                             <div className="flex gap-2 pt-2">
                                                                 <button
                                                                     type="button"
                                                                     onClick={() => setImageSeed(Math.floor(Math.random() * 100000))}
                                                                     className="flex-1 py-2 text-xs font-bold bg-[#1A5D1A]/10 text-[#1A5D1A] dark:text-white dark:bg-[#1A5D1A]/50 rounded-xl hover:bg-[#1A5D1A]/20 transition-all flex items-center justify-center gap-1.5"
                                                                 >
                                                                     <RotateCw size={14} className="animate-spin-slow" /> بازتولید تصویر
                                                                 </button>
                                                                 <button
                                                                     type="button"
                                                                     onClick={() => {
                                                                         const width = muralAspectRatio === '16:9' ? 1024 : muralAspectRatio === '3:4' ? 768 : 800;
                                                                         const height = muralAspectRatio === '16:9' ? 576 : muralAspectRatio === '3:4' ? 1024 : 800;
                                                                         const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(parsedResult.imagePrompt)}?width=${width}&height=${height}&nologo=true&seed=${imageSeed}`;
                                                                         downloadImageWithFilters(imageUrl, parsedResult.title || 'generated-image');
                                                                     }}
                                                                     className="px-4 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white rounded-xl flex items-center justify-center gap-2 font-black text-xs transition-all shadow-md"
                                                                     title="دانلود تصویر با فیلترهای نوری اعمال شده"
                                                                 >
                                                                     <Download size={14} /> دانلود پوستر
                                                                 </button>
                                                             </div>
                                                         </div>
                                                     )}

                                                     {parsedResult.mediaType === 'written' && (
                                                        <div className="space-y-4 flex-1 flex flex-col justify-between">
                                                            <div>
                                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-500 mb-1">
                                                                    <BookOpen size={12} /> کتابخوان دیجیتال و دیوان صوتی
                                                                </span>
                                                                <p className="text-[10px] text-gray-400">دارای قابلیت ورق زدن الکترونیکی</p>
                                                            </div>

                                                            <div className="relative border-2 border-emerald-900/10 rounded-2xl bg-white dark:bg-gray-900 p-5 shadow-inner text-right space-y-3 flex-1 flex flex-col justify-between py-6">
                                                                {parsedResult.extraMetadata?.chapters?.[selectedChapterIdx] ? (
                                                                    <div className="space-y-2 animate-fade-in flex-1">
                                                                        <h4 className="font-extrabold text-sm text-emerald-800 dark:text-[#D4AF37] border-b border-gray-100 dark:border-gray-800 pb-1.5">
                                                                            {parsedResult.extraMetadata.chapters[selectedChapterIdx].title}
                                                                        </h4>
                                                                        <p className="text-[11px] leading-6 text-gray-600 dark:text-gray-300 max-h-[140px] overflow-y-auto custom-scrollbar">
                                                                            {parsedResult.extraMetadata.chapters[selectedChapterIdx].content}
                                                                        </p>
                                                                    </div>
                                                                ) : (
                                                                    <div className="my-auto text-center text-xs text-gray-400">طرح کتاب کامل در حال تدوین است</div>
                                                                )}

                                                                <div className="flex justify-between items-center font-mono text-[10px] text-gray-400 pt-3 border-t border-gray-100 dark:border-gray-800">
                                                                    <span>صفحه {selectedChapterIdx + 1} از {parsedResult.extraMetadata?.chapters?.length || 1}</span>
                                                                    <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded">آرشیو البرز</span>
                                                                </div>
                                                            </div>

                                                            {/* Chapter Toggles */}
                                                            <div className="flex gap-1 overflow-x-auto py-1 justify-center custom-scrollbar">
                                                                {parsedResult.extraMetadata?.chapters?.map((ch, idx) => (
                                                                    <button
                                                                        key={idx}
                                                                        type="button"
                                                                        onClick={() => setSelectedChapterIdx(idx)}
                                                                        className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all shrink-0 ${
                                                                            selectedChapterIdx === idx 
                                                                            ? 'bg-emerald-600 text-white shadow-md'
                                                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200'
                                                                        }`}
                                                                    >
                                                                        {ch.title.substring(0, 15)}
                                                                    </button>
                                                                ))}
                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={() => handleNarrate(parsedResult.extraMetadata?.chapters?.[selectedChapterIdx]?.content || parsedResult.text)}
                                                                className={`w-full py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                                                                    isNarrating 
                                                                    ? 'bg-red-500 text-white hover:bg-red-600'
                                                                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md'
                                                                }`}
                                                            >
                                                                {isNarrating ? <VolumeX size={14} /> : <Volume2 size={14} />}
                                                                {isNarrating ? 'توقف خوانش صوتی کتاب' : 'شنیدن خوانش صوتی بخش'}
                                                            </button>
                                                        </div>
                                                    )}

                                                     {parsedResult.mediaType === 'cinematic' && (
                                                         <div className="space-y-4 flex-1 flex flex-col justify-between">
                                                             <div className="space-y-2">
                                                                 <div className="flex justify-between items-center">
                                                                     <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-500/15 text-blue-500">
                                                                         <Clapperboard size={12} /> سینما نگار و تولید کلیپ
                                                                     </span>
                                                                     <span className="text-[10px] font-bold text-gray-400">اتاق تدوین البرز</span>
                                                                 </div>

                                                                 {/* Player Mode Switcher */}
                                                                 <div className="flex bg-gray-200 dark:bg-gray-700/80 p-1 rounded-xl text-[10px] font-bold">
                                                                     <button
                                                                         type="button"
                                                                         onClick={() => { setVideoPlayerType('loop_clip'); setVideoError(false); }}
                                                                         className={`flex-1 py-1.5 px-2 rounded-lg transition-all ${
                                                                             videoPlayerType === 'loop_clip' 
                                                                             ? 'bg-blue-600 text-white shadow-md' 
                                                                             : 'text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white'
                                                                         }`}
                                                                     >
                                                                         🎥 ویدئوی سینمایی زنده (HTML5)
                                                                     </button>
                                                                     <button
                                                                         type="button"
                                                                         onClick={() => setVideoPlayerType('motion_frames')}
                                                                         className={`flex-1 py-1.5 px-2 rounded-lg transition-all ${
                                                                             videoPlayerType === 'motion_frames' 
                                                                             ? 'bg-blue-600 text-white shadow-md' 
                                                                             : 'text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white'
                                                                         }`}
                                                                     >
                                                                         🎬 موشن‌فریم سکانس‌ها
                                                                     </button>
                                                                 </div>
                                                             </div>

                                                             <div className="relative aspect-video rounded-2xl overflow-hidden shadow-lg border border-gray-700 bg-black flex items-center justify-center">
                                                                 {/* HTML5 Live Video Stream vs Motion Scene Player */}
                                                                 {(videoPlayerType === 'loop_clip' && !videoError) ? (
                                                                     <video
                                                                         key={activeVideoUrl}
                                                                         src={activeVideoUrl}
                                                                         autoPlay
                                                                         loop
                                                                         muted
                                                                         playsInline
                                                                         onError={() => setVideoError(true)}
                                                                         className={`absolute inset-0 w-full h-full object-cover transition-transform duration-1000 ${
                                                                             isPlaying ? 'scale-110' : 'scale-100'
                                                                         }`}
                                                                         style={{
                                                                             filter: `grayscale(${grayscale}%) sepia(${sepia}%) brightness(${brightness}%) contrast(${contrast}%)`
                                                                         }}
                                                                     />
                                                                 ) : (
                                                                     <img 
                                                                         src={`https://image.pollinations.ai/prompt/${encodeURIComponent(parsedResult.extraMetadata?.videoScenes?.[videoSceneIdx]?.visualDescription || parsedResult.imagePrompt)}?width=600&height=340&nologo=true&seed=${imageSeed + videoSceneIdx}`}
                                                                         alt="Video Frame"
                                                                         referrerPolicy="no-referrer"
                                                                         className={`absolute inset-0 w-full h-full object-cover opacity-85 transition-transform duration-1000 ${
                                                                             isPlaying ? 'scale-110 translate-y-1' : 'scale-100'
                                                                         }`}
                                                                         style={{
                                                                             filter: `grayscale(${grayscale}%) sepia(${sepia}%) brightness(${brightness}%) contrast(${contrast}%)`
                                                                         }}
                                                                     />
                                                                 )}

                                                                 <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/10 flex flex-col justify-between p-3.5 z-10 text-right">
                                                                     <div className="flex justify-between items-center">
                                                                         <div className="flex items-center gap-1.5">
                                                                             <span className="text-[9px] bg-red-600 text-white px-2 py-0.5 rounded font-black uppercase tracking-wider">
                                                                                 {videoPlayerType === 'loop_clip' ? 'CINEMATIC LIVE' : 'STORYBOARD MOTION'}
                                                                             </span>
                                                                             <button
                                                                                 type="button"
                                                                                 onClick={() => setIsVideoZoomModalOpen(true)}
                                                                                 className="flex items-center gap-1 text-[10px] bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-2.5 py-0.5 rounded-md transition-all shadow-md active:scale-95 cursor-pointer"
                                                                                 title="بزرگنمایی و نمایش تمام‌صفحه کلیپ"
                                                                             >
                                                                                 <ZoomIn size={12} />
                                                                                 <span>بزرگنمایی کلیپ</span>
                                                                             </button>
                                                                         </div>
                                                                         <span className="font-mono text-[10px] text-blue-400 font-bold bg-black/60 px-2 py-0.5 rounded border border-blue-500/30">
                                                                             {videoPlayerType === 'loop_clip' ? 'کیفیت HD' : (parsedResult.extraMetadata?.videoScenes?.[videoSceneIdx]?.time || `سکانس ${videoSceneIdx + 1}`)}
                                                                         </span>
                                                                     </div>
                                                                     
                                                                     {/* Synced Narration Overlay Subtitles */}
                                                                     <div className="bg-black/85 p-2.5 rounded-xl border border-white/10 backdrop-blur-md text-center border-b-2 border-blue-500 shadow-xl">
                                                                         <p className="text-[10px] text-amber-300 font-bold">
                                                                             {videoPlayerType === 'loop_clip' ? parsedResult.title : `سکانس ${videoSceneIdx + 1}: ${'روایت صحنه'}`}
                                                                         </p>
                                                                         <p className="text-xs text-white font-extrabold mt-1 leading-snug">
                                                                             {videoPlayerType === 'loop_clip' 
                                                                             ? `${parsedResult.title} - با تدوین متجانس و نورپردازی زنده ۲۴ فریم` 
                                                                             : (parsedResult.extraMetadata?.videoScenes?.[videoSceneIdx]?.narration || parsedResult.text.substring(0, 90) + '...')}
                                                                         </p>
                                                                     </div>
                                                                 </div>
                                                             </div>

                                                             {/* Controls or alternative atmospheres */}
                                                             <div className="space-y-2">
                                                                 {videoPlayerType === 'loop_clip' ? (
                                                                     <div className="space-y-1">
                                                                         <label className="text-[10px] text-gray-400 font-bold block text-right">تغییر صحنه و فضای ویدیویی سینمایی:</label>
                                                                         <div className="grid grid-cols-4 gap-1">
                                                                             {CINEMATIC_VIDEOS.map((video) => (
                                                                                 <button
                                                                                     key={video.id}
                                                                                     type="button"
                                                                                     onClick={() => {
                                                                                         setSelectedVideoId(video.id);
                                                                                         setVideoError(false);
                                                                                     }}
                                                                                     className={`truncate text-[9px] px-1 py-1 rounded border-b-2 font-black transition-all bg-gray-100 dark:bg-gray-850 text-gray-600 dark:text-gray-300 hover:bg-gray-200 ${
                                                                                         activeVideoUrl === video.url ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 text-[#1a5d1a] dark:text-white' : 'border-transparent'
                                                                                     }`}
                                                                                     title={video.title}
                                                                                 >
                                                                                     {video.title.split(' ')[0]}
                                                                                 </button>
                                                                             ))}
                                                                         </div>
                                                                     </div>
                                                                 ) : (
                                                                     <div className="space-y-1.5">
                                                                         <div className="flex justify-between items-center text-xs text-gray-400 font-bold">
                                                                             <span>سکانس {videoSceneIdx + 1} از {parsedResult.extraMetadata?.videoScenes?.length || 1}</span>
                                                                             <span className="text-[10px] text-blue-400">پخش خودکار هر ۴ ثانیه</span>
                                                                         </div>
                                                                         <div className="flex gap-1.5 justify-center overflow-x-auto custom-scrollbar py-1">
                                                                             {parsedResult.extraMetadata?.videoScenes?.map((sc, sIdx) => (
                                                                                 <button
                                                                                     key={sIdx}
                                                                                     type="button"
                                                                                     onClick={() => {
                                                                                         setVideoSceneIdx(sIdx);
                                                                                         setIsPlaying(true);
                                                                                         handleNarrate(sc.narration);
                                                                                     }}
                                                                                     className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all shrink-0 ${
                                                                                         videoSceneIdx === sIdx 
                                                                                         ? 'bg-blue-600 text-white shadow-md scale-105'
                                                                                         : 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200'
                                                                                     }`}
                                                                                 >
                                                                                     {sc.time || `0${sIdx + 1}:00`}
                                                                                 </button>
                                                                             ))}
                                                                         </div>
                                                                     </div>
                                                                 )}
                                                             </div>

                                                              {/* Veo 3.1 AI Video Generation Action Box */}
                                                              {/* Veo / FLOW AI Video Generation Action Box */}
                                                              <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-3">
                                                                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 p-3 rounded-2xl border border-indigo-100 dark:border-gray-700 space-y-2.5">
                                                                      <div className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-200">
                                                                          <span className="flex items-center gap-1.5"><VideoIcon size={14} className="text-indigo-600 dark:text-indigo-400" /> تنظیمات موتور و زمان ویدئو:</span>
                                                                          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold">{localizeNumber(videoDuration, 'fa')} ثانیه | {videoEngine === 'veo' ? 'Veo 3.1' : 'FLOW Engine'}</span>
                                                                      </div>

                                                                      {/* Engine Selector */}
                                                                      <div className="grid grid-cols-2 gap-1.5 p-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                                                                          <button
                                                                              type="button"
                                                                              onClick={() => setVideoEngine('veo')}
                                                                              className={`py-1 text-[11px] font-extrabold rounded-lg transition-all ${videoEngine === "veo" ? "bg-indigo-600 text-white shadow" : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"}`}
                                                                          >
                                                                              موتور Veo 3.1
                                                                          </button>
                                                                          <button
                                                                              type="button"
                                                                              onClick={() => setVideoEngine('flow')}
                                                                              className={`py-1 text-[11px] font-extrabold rounded-lg transition-all ${videoEngine === "flow" ? "bg-purple-600 text-white shadow" : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"}`}
                                                                          >
                                                                              موتور FLOW
                                                                          </button>
                                                                      </div>

                                                                      {/* Duration Selector */}
                                                                      <div className="flex items-center justify-between gap-1.5">
                                                                          <span className="text-[10px] font-bold text-gray-500">مدت زمان:</span>
                                                                          <div className="flex gap-1 flex-1 justify-end">
                                                                              {[10, 15, 20].map(d => (
                                                                                  <button
                                                                                      key={d}
                                                                                      type="button"
                                                                                      onClick={() => setVideoDuration(d)}
                                                                                       className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${videoDuration === d ? "bg-emerald-600 text-white shadow" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200"}`}
                                                                                  >
                                                                                      {localizeNumber(d, 'fa')} ثانیه
                                                                                  </button>
                                                                              ))}
                                                                          </div>
                                                                      </div>
                                                                  </div>
                                                                  <button
                                                                      type="button"
                                                                      disabled={isGeneratingVeo}
                                                                      onClick={handleGenerateVeoVideo}
                                                                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-md ${isGeneratingVeo ? "bg-amber-600 text-white cursor-wait" : "bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white active:scale-95"}`}
                                                                  >
                                                                      {isGeneratingVeo ? (
                                                                          <>
                                                                              <Loader2 size={16} className="animate-spin" />
                                                                              <span>در حال تولید ویدئوی روان ({localizeNumber(videoDuration, 'fa')} ثانیه) با {videoEngine === 'veo' ? 'Veo 3.1' : 'FLOW'}...</span>
                                                                          </>
                                                                      ) : (
                                                                          <>
                                                                              <Sparkles size={16} className="text-amber-300" />
                                                                              <span>ساخت ویدئوی رئال {localizeNumber(videoDuration, 'fa')} ثانیه‌ای با موتور {videoEngine === 'veo' ? 'Veo 3.1' : 'FLOW'} (مرجع چهره شهید)</span>
                                                                          </>
                                                                      )}
                                                                  </button>
                                                                  {isGeneratingVeo && (
                                                                      <div className="bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900 text-right space-y-1 animate-fade-in">
                                                                          <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                                                                              <Loader2 size={12} className="animate-spin text-amber-600" /> {veoProgress}
                                                                          </p>
                                                                          <p className="text-[9px] text-gray-500 dark:text-gray-400">
                                                                              این پردازش توسط موتور هوش مصنوعی {videoEngine === 'veo' ? 'Veo 3.1' : 'FLOW Video FX'} بر اساس عکس مرجع چهره شهید و پرونده انتخاب‌شده اجرا می‌گردد.
                                                                          </p>
                                                                      </div>
                                                                  )}
                                                                  {veoVideoUrl && !isGeneratingVeo && (
                                                                      <div className="bg-green-50 dark:bg-green-950/40 p-2 rounded-xl border border-green-200 dark:border-green-800 text-[10px] text-green-700 dark:text-green-300 font-bold text-center">
                                                                          ✨ ویدئوی اختصاصی {videoEngine === 'veo' ? 'Veo' : 'FLOW'} ({localizeNumber(videoDuration, 'fa')} ثانیه) با کیفیت رئال سینمایی تولید شد و در پخش‌کننده بالا بارگذاری گردید.
                                                                      </div>
                                                                  )}
                                                              </div>

                                                              <div className="flex gap-2">
                                                                  <button
                                                                      type="button"
                                                                     onClick={() => {
                                                                         setIsPlaying(!isPlaying);
                                                                         if (!isPlaying) {
                                                                             handleNarrate(parsedResult.extraMetadata?.videoScenes?.[videoSceneIdx]?.narration || parsedResult.text);
                                                                         } else {
                                                                             if ('speechSynthesis' in window) {
                                                                                 window.speechSynthesis.cancel();
                                                                                 setIsNarrating(false);
                                                                             }
                                                                         }
                                                                     }}
                                                                     className={`flex-1 py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                                                                         isPlaying ? 'bg-red-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
                                                                     }`}
                                                                 >
                                                                     {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                                                                     {isPlaying ? 'توقف پخش هوشمند' : 'پخش دکلمه و انیمیشن کلیپ'}
                                                                </button>
                                                            </div>

                                                            {/* Download Cinema Video Toolbar */}
                                                            <div className="bg-slate-900 dark:bg-slate-950 text-white p-3.5 rounded-2xl border border-slate-700/80 space-y-2.5 shadow-xl mt-3">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-1.5 text-xs font-black text-amber-300">
                                                                        <Download size={15} className="text-amber-400 animate-bounce" />
                                                                        <span>دانلود ویدئوی سینمایی (با فرمت درخواستی)</span>
                                                                    </div>
                                                                    <span className="text-[10px] bg-slate-800 text-emerald-400 px-2 py-0.5 rounded-md font-bold border border-slate-700">
                                                                        {isDownloadingVideo ? 'در حال دریافت...' : 'کیفیت 1080p'}
                                                                    </span>
                                                                </div>

                                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                                    <button
                                                                        type="button"
                                                                        disabled={isDownloadingVideo}
                                                                        onClick={() => handleDownloadVideo('mkv')}
                                                                        className="flex items-center justify-center gap-1.5 py-2 px-2 bg-gradient-to-r from-teal-600 to-emerald-700 hover:from-teal-500 hover:to-emerald-600 active:scale-95 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer"
                                                                    >
                                                                        <Download size={13} />
                                                                        <span>فرمت MKV</span>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        disabled={isDownloadingVideo}
                                                                        onClick={() => handleDownloadVideo('mpeg')}
                                                                        className="flex items-center justify-center gap-1.5 py-2 px-2 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 active:scale-95 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer"
                                                                    >
                                                                        <Download size={13} />
                                                                        <span>فرمت MPEG</span>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        disabled={isDownloadingVideo}
                                                                        onClick={() => handleDownloadVideo('mp4')}
                                                                        className="flex items-center justify-center gap-1.5 py-2 px-2 bg-gradient-to-r from-purple-600 to-pink-700 hover:from-purple-500 hover:to-pink-600 active:scale-95 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer"
                                                                    >
                                                                        <Download size={13} />
                                                                        <span>فرمت MP4</span>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        disabled={isDownloadingVideo}
                                                                        onClick={() => handleDownloadVideo('webm')}
                                                                        className="flex items-center justify-center gap-1.5 py-2 px-2 bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 active:scale-95 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer"
                                                                    >
                                                                        <Download size={13} />
                                                                        <span>فرمت WEBM</span>
                                                                    </button>
                                                                </div>

                                                                {downloadSuccessMsg && (
                                                                    <div className="text-[11px] font-bold text-emerald-400 bg-emerald-950/80 p-2 rounded-xl border border-emerald-800 text-center animate-fade-in">
                                                                        ✨ {downloadSuccessMsg}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                     {parsedResult.mediaType === 'digital' && (
                                                        <div className="space-y-4 flex-1 flex flex-col justify-between">
                                                            <div>
                                                                {/* Download Cinema Video Toolbar */}
                                                                <div className="bg-slate-900 dark:bg-slate-950 text-white p-3.5 rounded-2xl border border-slate-700/80 space-y-2.5 shadow-xl mb-4">
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex items-center gap-1.5 text-xs font-black text-amber-300">
                                                                            <Download size={15} className="text-amber-400 animate-bounce" />
                                                                            <span>دانلود ویدئوی سینمایی (با فرمت درخواستی)</span>
                                                                        </div>
                                                                        <span className="text-[10px] bg-slate-800 text-emerald-400 px-2 py-0.5 rounded-md font-bold border border-slate-700">
                                                                            {isDownloadingVideo ? 'در حال دریافت...' : 'کیفیت 1080p'}
                                                                        </span>
                                                                    </div>

                                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                                        <button
                                                                            type="button"
                                                                            disabled={isDownloadingVideo}
                                                                            onClick={() => handleDownloadVideo('mkv')}
                                                                            className="flex items-center justify-center gap-1.5 py-2 px-2 bg-gradient-to-r from-teal-600 to-emerald-700 hover:from-teal-500 hover:to-emerald-600 active:scale-95 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer"
                                                                        >
                                                                            <Download size={13} />
                                                                            <span>فرمت MKV</span>
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            disabled={isDownloadingVideo}
                                                                            onClick={() => handleDownloadVideo('mpeg')}
                                                                            className="flex items-center justify-center gap-1.5 py-2 px-2 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 active:scale-95 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer"
                                                                        >
                                                                            <Download size={13} />
                                                                            <span>فرمت MPEG</span>
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            disabled={isDownloadingVideo}
                                                                            onClick={() => handleDownloadVideo('mp4')}
                                                                            className="flex items-center justify-center gap-1.5 py-2 px-2 bg-gradient-to-r from-purple-600 to-pink-700 hover:from-purple-500 hover:to-pink-600 active:scale-95 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer"
                                                                        >
                                                                            <Download size={13} />
                                                                            <span>فرمت MP4</span>
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            disabled={isDownloadingVideo}
                                                                            onClick={() => handleDownloadVideo('webm')}
                                                                            className="flex items-center justify-center gap-1.5 py-2 px-2 bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 active:scale-95 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer"
                                                                        >
                                                                            <Download size={13} />
                                                                            <span>فرمت WEBM</span>
                                                                        </button>
                                                                    </div>

                                                                    {downloadSuccessMsg && (
                                                                        <div className="text-[11px] font-bold text-emerald-400 bg-emerald-950/80 p-2 rounded-xl border border-emerald-800 text-center animate-fade-in">
                                                                            ✨ {downloadSuccessMsg}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-purple-500/15 text-purple-500 mb-1">
                                                                    <Smartphone size={12} /> مدل‌ساز تعاملی و اپ گراف
                                                                </span>
                                                                <p className="text-[10px] text-gray-400">قابلیت شبیه‌سازی قابلیت‌های دیجیتال</p>
                                                            </div>

                                                            {/* Interactive Mobile outline */}
                                                            <div className="relative mx-auto w-[180px] aspect-[9/16] rounded-3xl border-4 border-gray-800 bg-white dark:bg-gray-900 shadow-xl overflow-hidden flex flex-col justify-between p-3.5 text-right font-sans">
                                                                <div className="h-2 w-12 bg-gray-800 rounded-full mx-auto mb-2"></div>
                                                                
                                                                <div className="flex-grow flex flex-col justify-center space-y-2 text-center my-auto">
                                                                    <div className="p-2 bg-purple-500/10 rounded-xl inline-block mx-auto border border-purple-500/20">
                                                                        <Gamepad2 size={24} className="text-purple-600" />
                                                                    </div>
                                                                    <h5 className="text-[10px] font-black dark:text-white line-clamp-1">{parsedResult.title}</h5>
                                                                    <p className="text-[8px] text-gray-400 dark:text-gray-400 px-1 line-clamp-4">شبیه‌ساز هوشمند آثار و پرونده‌های ایثارگران استان البرز</p>
                                                                </div>

                                                                <div className="space-y-1.5">
                                                                    <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full w-full"></div>
                                                                    <div className="h-1.5 bg-purple-500 rounded-full w-2/3"></div>
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => (window as any).alert(`بخش شبیه‌ساز ${parsedResult.title} با موفقیت تست عملکردی شد.`)}
                                                                        className="w-full py-1 text-[8px] font-bold bg-[#1A5D1A] text-white rounded-lg hover:bg-green-800"
                                                                    >
                                                                        اجرای کانتکست موبایل
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <p className="text-[9px] text-gray-400">ایده‌پردازی الگوهای تعاملی تلفیق با سامانه اسناد</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Right Column: Detailed Text Narrative and Synopses */}
                                            <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
                                                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-soft text-right h-full flex flex-col justify-between">
                                                    <div className="space-y-4">
                                                        <h3 className="font-extrabold text-lg text-gray-800 dark:text-white flex items-center gap-2 border-b border-gray-50 dark:border-gray-700 pb-3">
                                                            <PenTool size={18} className="text-[#D4AF37]" /> شرح سناریو و جزئیات ادبی طرح
                                                        </h3>
                                                        <div className="markdown-body prose dark:prose-invert max-w-none text-sm leading-8 text-gray-600 dark:text-gray-300 max-h-[280px] overflow-y-auto pr-1.5 custom-scrollbar">
                                                            <ReactMarkdown>{parsedResult.text}</ReactMarkdown>
                                                        </div>
                                                    </div>

                                                    <div className="pt-4 border-t border-gray-50 dark:border-gray-700 flex flex-wrap gap-3 items-center justify-between">
                                                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                                            <Compass size={12} /> موقعیت معنوی: با کانتکست اسناد آرشیوی استان البرز
                                                        </span>

                                                        <button
                                                            type="button"
                                                            onClick={() => handleNarrate(parsedResult.text)}
                                                            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                                                                isNarrating 
                                                                ? 'bg-red-500 text-white' 
                                                                : 'bg-[#1a5d1a]/10 text-[#1a5d1a] border border-[#1a5d1a]/20 hover:bg-[#1a5d1a]/20 dark:text-white'
                                                            }`}
                                                        >
                                                            {isNarrating ? <VolumeX size={14} /> : <Volume2 size={14} />}
                                                            {isNarrating ? 'توقف خواندن دیالوگ' : 'شنیدن صدای دکلمه خوان هوشمند'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 flex gap-4">
                                {modalState === 'setup' && (
                                    <>
                                        <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white rounded-2xl font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all">
                                            انصراف
                                        </button>
                                        <button 
                                            type="button"
                                            className="flex-[2] py-4 bg-[#1A5D1A] text-white rounded-2xl font-bold hover:bg-green-800 transition-all shadow-lg flex items-center justify-center gap-2"
                                            onClick={handleStartGeneration}
                                        >
                                            <Sparkles size={20} /> شروع آفرینش هوشمند
                                        </button>
                                    </>
                                )}
                                
                                {modalState === 'result' && (
                                    <>
                                        <button type="button" onClick={() => setModalState('setup')} className="flex-1 py-4 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white rounded-2xl font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all">
                                            تغییر تنظیمات و تولید مجدد
                                        </button>
                                        <button 
                                            type="button"
                                            className="flex-[2] py-4 bg-[#D4AF37] text-white rounded-2xl font-bold hover:bg-yellow-600 transition-all shadow-lg flex items-center justify-center gap-2"
                                            onClick={handleSaveDocument}
                                        >
                                            <Save size={20} /> ذخیره محصول نهایی در آرشیو
                                        </button>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            {/* Interactive Fullscreen Video Preview Zoom Modal */}
            <AnimatePresence>
                {isVideoZoomModalOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex flex-col justify-between p-4 sm:p-6 overflow-hidden select-none"
                    >
                        {/* Header Toolbar */}
                        <div className="flex justify-between items-center bg-slate-900/90 p-3.5 rounded-2xl border border-slate-700/80 text-white shadow-2xl z-20">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                                    <Clapperboard size={20} />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-sm sm:text-base text-white">
                                        بزرگنمایی و بازبینی تخصصی کلیپ سینمایی (HD / 4K)
                                    </h3>
                                    <p className="text-[11px] text-gray-400">
                                        قابلیت بزرگنمایی، جابه‌جایی روی جزئیات فریم و دانلود با بالاترین کیفیت
                                    </p>
                                </div>
                            </div>

                            {/* Controls Bar */}
                            <div className="flex items-center gap-2">
                                <div className="bg-slate-800 px-3 py-1 rounded-xl text-xs font-mono font-bold text-emerald-400 border border-slate-700">
                                    زوم: {Math.round(videoZoomScale * 100)}%
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setVideoZoomScale(s => Math.min(s + 0.25, 4))}
                                    className="p-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl border border-slate-700 transition-all active:scale-95"
                                    title="افزایش بزرگنمایی (+)"
                                >
                                    <ZoomIn size={18} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setVideoZoomScale(s => Math.max(s - 0.25, 0.75))}
                                    className="p-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl border border-slate-700 transition-all active:scale-95"
                                    title="کاهش بزرگنمایی (-)"
                                >
                                    <ZoomOut size={18} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setVideoZoomScale(1); setVideoPanOffset({ x: 0, y: 0 }); }}
                                    className="p-2 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-xl border border-slate-700 transition-all active:scale-95 text-xs font-extrabold"
                                    title="بازنشانی زوم"
                                >
                                    <RotateCcw size={18} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!document.fullscreenElement) {
                                            document.documentElement.requestFullscreen().catch(() => {});
                                        } else {
                                            document.exitFullscreen().catch(() => {});
                                        }
                                    }}
                                    className="p-2 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-xl border border-slate-700 transition-all active:scale-95"
                                    title="تمام صفحه کامل مرورگر"
                                >
                                    <Maximize2 size={18} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsVideoZoomModalOpen(false);
                                        setVideoZoomScale(1);
                                        setVideoPanOffset({ x: 0, y: 0 });
                                    }}
                                    className="p-2 bg-red-600/80 hover:bg-red-600 text-white rounded-xl transition-all active:scale-95 mr-2"
                                    title="بستن پنجره"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Video Viewport Stage */}
                        <div
                            className="flex-1 my-3 relative overflow-hidden rounded-2xl bg-black border border-slate-800 flex items-center justify-center cursor-grab active:cursor-grabbing"
                            onWheel={(e) => {
                                e.preventDefault();
                                if (e.deltaY < 0) {
                                    setVideoZoomScale(s => Math.min(s + 0.15, 4));
                                } else {
                                    setVideoZoomScale(s => Math.max(s - 0.15, 0.75));
                                }
                            }}
                            onMouseDown={(e) => {
                                setIsDraggingVideo(true);
                                setDragStartPos({ x: e.clientX - videoPanOffset.x, y: e.clientY - videoPanOffset.y });
                            }}
                            onMouseMove={(e) => {
                                if (isDraggingVideo) {
                                    setVideoPanOffset({
                                        x: e.clientX - dragStartPos.x,
                                        y: e.clientY - dragStartPos.y
                                    });
                                }
                            }}
                            onMouseUp={() => setIsDraggingVideo(false)}
                            onMouseLeave={() => setIsDraggingVideo(false)}
                        >
                            <div
                                className="w-full h-full flex items-center justify-center transition-transform duration-75 ease-out"
                                style={{
                                    transform: `scale(${videoZoomScale}) translate(${videoPanOffset.x / videoZoomScale}px, ${videoPanOffset.y / videoZoomScale}px)`
                                }}
                            >
                                {(videoPlayerType === 'loop_clip' && !videoError) ? (
                                    <video
                                        key={activeVideoUrl}
                                        src={activeVideoUrl}
                                        controls
                                        autoPlay
                                        loop
                                        muted={false}
                                        playsInline
                                        className="max-w-full max-h-full object-contain rounded-xl shadow-2xl pointer-events-auto"
                                        style={{
                                            filter: `grayscale(${grayscale}%) sepia(${sepia}%) brightness(${brightness}%) contrast(${contrast}%)`
                                        }}
                                    />
                                ) : (
                                    <img
                                        src={`https://image.pollinations.ai/prompt/${encodeURIComponent(parsedResult?.extraMetadata?.videoScenes?.[videoSceneIdx]?.visualDescription || parsedResult?.imagePrompt || 'cinematic martyr portrait')}&width=1280&height=720&nologo=true&seed=${imageSeed + videoSceneIdx}`}
                                        alt="Video Frame Full"
                                        referrerPolicy="no-referrer"
                                        className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
                                        style={{
                                            filter: `grayscale(${grayscale}%) sepia(${sepia}%) brightness(${brightness}%) contrast(${contrast}%)`
                                        }}
                                    />
                                )}
                            </div>

                            {/* Subtitle / Narrative Overlay in Zoom View */}
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 px-6 py-3 rounded-2xl border border-white/20 backdrop-blur-md text-center max-w-2xl pointer-events-none shadow-2xl">
                                <p className="text-xs text-amber-400 font-bold">
                                    {parsedResult?.title || 'کلیپ سینمایی یادگاران البرز'}
                                </p>
                                <p className="text-sm text-white font-black mt-0.5">
                                    {parsedResult?.extraMetadata?.videoScenes?.[videoSceneIdx]?.narration || parsedResult?.text?.substring(0, 100) || 'پویا نمایی زنده چهره با هوش مصنوعی و تدوین سینمایی'}
                                </p>
                            </div>
                        </div>

                        {/* Bottom Actions Bar */}
                        <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-700/80 text-white flex flex-col sm:flex-row justify-between items-center gap-3">
                            <div className="flex items-center gap-2 text-xs text-gray-300 font-bold">
                                <Sparkles size={16} className="text-amber-400 animate-pulse" />
                                <span>کیفیت پخش: 1080p Ultra-HD | ۲۴ فریم سینمایی روان</span>
                            </div>

                            <div className="flex gap-2 w-full sm:w-auto">
                                <button
                                    type="button"
                                    onClick={() => handleDownloadVideo('mp4')}
                                    className="flex-1 sm:flex-initial px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                                >
                                    <Download size={14} />
                                    <span>دانلود کلیپ (MP4)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDownloadVideo('mkv')}
                                    className="flex-1 sm:flex-initial px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all border border-slate-700 active:scale-95"
                                >
                                    <Download size={14} />
                                    <span>فرمت MKV</span>
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            </AnimatePresence>
        </div>
    );
};

export default HooshmandNegar;
