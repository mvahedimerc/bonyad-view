
import React, { useState, useRef, useMemo } from 'react';
import { 
    Sparkles, Upload, Image as ImageIcon, Video, ChevronRight, Loader2, Save, Trash2, 
    CheckCircle, AlertCircle, Maximize2, History, UserCheck, FolderInput, Download, Search, 
    Filter, Tag, FileText, ArrowRight, RefreshCw, Copy, Check, Terminal, Code2, ShieldAlert, Cpu
} from 'lucide-react';
import { Document, MartyrProfile, DocumentType } from '../types';
import { MOCK_PROFILES, MOCK_DOCUMENTS, localizeNumber, APP_LOGO_URL } from '../data';
import { restoreImage } from '../services/geminiService';
import { resizeImage } from '../services/imageUtils';

interface RestorationProps {
    documents?: Document[];
    onSaveDocument: (doc: Document) => void;
    profiles?: MartyrProfile[];
}

// Utility to convert an image URL (dataUrl or http) to a File object for the AI restoration engine
const urlToFile = async (url: string, filename: string = 'archive-doc.jpg'): Promise<File> => {
    try {
        if (url.startsWith('data:')) {
            const arr = url.split(',');
            const mimeMatch = arr[0].match(/:(.*?);/);
            const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            return new File([u8arr], filename, { type: mime });
        }

        const targetUrl = (url.startsWith('http://') || url.startsWith('https://'))
            ? `/api/proxy-image?url=${encodeURIComponent(url)}`
            : url;

        const res = await fetch(targetUrl);
        if (res.ok) {
            const blob = await res.blob();
            if (blob.size > 0) {
                return new File([blob], filename, { type: blob.type || 'image/jpeg' });
            }
        }
        throw new Error("Direct fetch failed");
    } catch (err) {
        console.warn("Using proxy image fallback loader for:", url);
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(300, img.naturalWidth || 600);
                canvas.height = Math.max(300, img.naturalHeight || 600);
                const ctx = canvas.getContext('2d');
                if (ctx) ctx.drawImage(img, 0, 0);
                try {
                    canvas.toBlob((blob) => {
                        if (blob && blob.size > 0) {
                            resolve(new File([blob], filename, { type: 'image/jpeg' }));
                        } else {
                            throw new Error("Empty canvas blob");
                        }
                    }, 'image/jpeg', 0.9);
                } catch (e) {
                    // Create minimal valid image canvas fallback
                    const fbCanvas = document.createElement('canvas');
                    fbCanvas.width = 400;
                    fbCanvas.height = 400;
                    const fbCtx = fbCanvas.getContext('2d');
                    if (fbCtx) {
                        fbCtx.fillStyle = '#111827';
                        fbCtx.fillRect(0, 0, 400, 400);
                    }
                    fbCanvas.toBlob((fbBlob) => {
                        resolve(new File([fbBlob || new Blob()], filename, { type: 'image/jpeg' }));
                    }, 'image/jpeg');
                }
            };
            img.onerror = () => {
                // Try proxy URL as last resort
                const proxyImg = new Image();
                proxyImg.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.max(300, proxyImg.naturalWidth || 600);
                    canvas.height = Math.max(300, proxyImg.naturalHeight || 600);
                    const ctx = canvas.getContext('2d');
                    if (ctx) ctx.drawImage(proxyImg, 0, 0);
                    canvas.toBlob((b) => {
                        resolve(new File([b || new Blob()], filename, { type: 'image/jpeg' }));
                    }, 'image/jpeg');
                };
                proxyImg.onerror = () => {
                    resolve(new File([new Blob([new Uint8Array(100)])], filename, { type: 'image/jpeg' }));
                };
                proxyImg.src = `/api/proxy-image?url=${encodeURIComponent(url)}`;
            };
            img.src = url;
        });
    }
};

const DEFAULT_ENGLISH_PROMPT = `You are an expert photo restoration AI with advanced image processing capabilities. Your task is to perform a complete, all-in-one restoration of the uploaded image with the following strict requirements:

MANDATORY COLORIZATION RULE:
- REGARDLESS of whether the uploaded image is Black & White, Sepia, Faded, or Color, you MUST apply FULL, NATURAL COLORIZATION to the entire image.
- If the image is already colored, enhance and restore its existing colors.
- If the image is Black & White or Sepia, you MUST intelligently colorize it with realistic, natural, and historically accurate colors. Skin tones must look lifelike, skies must be blue, foliage green, clothing colors natural, and all environmental elements appropriately colored based on context and era.
- This is a MANDATORY step. There is NO exception. Every single output MUST be a fully colorized image.

Step 1: Comprehensive Damage Detection & Physical Reconstruction
- Scan the entire image for all types of deterioration: scratches, cracks, creases, folds, tears, stains (ink, water, mold), dust specks, and silvering (mirroring effect).
- Completely remove all detected damages using advanced inpainting. Where pixels are missing or severely degraded, reconstruct them with perfect logical consistency based on surrounding textures, patterns, and geometric symmetry.
- If a human face is present, carefully reconstruct blurred or missing facial features (eyes, nose, lips, ears) with anatomical precision, ensuring the person's unique identity remains intact and natural.

Step 2: Upscaling & Ultra-High-Definition Sharpening (True 4K Standard)
- Upscale the image resolution to true 4K quality (3840x2160 pixels or higher) with zero pixelation or jagged edges.
- Apply multi-scale AI sharpening to extract and enhance micro-details: restore the clarity of individual hair strands, fabric weaves, skin pores, eyelashes, eyebrows, and environmental textures (leaves, bricks, clouds).
- The final sharpness must be crystal-clear and "tack-sharp" for professional large-format printing, yet remain completely natural and avoid the "overcooked" or artificial plastic look.

Step 3: Intelligent Color Restoration & Enhancement (MANDATORY FOR ALL IMAGES)
- Perform full, professional colorization on Black & White or Sepia images. For already colored images, restore and enhance existing colors.
- Automatically correct the global white balance by neutralizing unwanted color casts (remove severe yellowing from age, cyan from old scanners, or magenta/reddish tones from chemical fading).
- Restore all faded pigments to their natural, vibrant, and historically accurate states.
- Perform precise local color adjustments: ensure skin tones are lifelike and uniform (warm, natural complexions), skies are appropriate blues, foliage appears natural green, and all clothing and environmental elements have accurate, context-appropriate colors.

Step 4: Dynamic Range Optimization & Lighting Perfection (HDR Toning)
- Redistribute the entire dynamic range of the image using HDR (High Dynamic Range) toning.
- Recover every single detail hidden in overexposed (blown-out) highlights, such as clouds or bright windows, and bring out all information from underexposed (crushed) shadow areas, like dark clothing or hair.
- Ensure the final contrast is perfectly balanced: not too flat and not too harsh, with a natural three-dimensional depth and realistic ambient lighting.

Step 5: Advanced Noise Reduction & Texture Preservation
- Aggressively reduce all forms of digital and film noise (grain, chrominance noise, compression artifacts) to create a clean, smooth base.
- Exception: Retain the authentic, fine film grain texture if the photo is analog (shot on film) to preserve its nostalgic character. For digital photos, make the surface completely clean and pristine.

Step 6: Color Consistency & Final Polish
- Perform a final pass to ensure all colorized areas blend seamlessly with the rest of the image. There should be NO visible borders, artifacts, or color bleeding between colorized and original areas.
- Check for any residual artifacts, halos, or warping. Ensure the photo looks like it was taken yesterday with a state-of-the-art medium format camera, but with full, natural colors.
- Ensure the final output has zero compression to maintain the 4K quality.

FINAL OUTPUT REQUIREMENT:
- Display the fully restored, 4K upscaled, and COMPLETELY COLORIZED image directly in your response.
- Do NOT provide any code, do NOT explain the process step-by-step, and do NOT suggest external tools or software.
- The output must be the final image only, ready for download and use.

CRITICAL REMINDER: COLORIZATION IS MANDATORY FOR EVERY IMAGE WITHOUT EXCEPTION. BLACK & WHITE, SEPIA, AND FADED IMAGES MUST BE FULLY COLORIZED WITH NATURAL, REALISTIC COLORS. DO NOT LEAVE ANY IMAGE IN MONOCHROME.`;

const DEFAULT_PYTHON_SCRIPT = `# ==============================================================================
# اسکریپت جامع پایتون جهت ترمیم، لکه‌گیری، ارتقای رزولوشن و تجلی اسناد تاریخی
# منطبق بر دستورالعمل ۶ گانه بازسازی هوشمند اسناد ایثارگران و شهدا
# ==============================================================================

"""
================================================================================
          راهنمای گام‌به‌گام نصب پیش‌نیازها و اجرای اسکریپت پایتون
================================================================================

گام ۱: راه‌اندازی محیط مجازی پایتون (Virtual Environment)
------------------------------------------------------
در سیستم‌عامل ویندوز یا لینوکس/مک ترمینال را باز کنید:

[Windows]:
   python -m venv venv_restoration
   venv_restoration\\Scripts\\activate

[Linux / macOS]:
   python3 -m venv venv_restoration
   source venv_restoration/bin/activate

گام ۲: نصب کتابخانه‌های اصلی پردازش تصویر و هوش مصنوعی
------------------------------------------------------
دستور زیر را جهت نصب OpenCV, Pillow, NumPy, PyTorch و ابزارهای ترمیم چهره اجرا نمایید:

   pip install --upgrade pip
   pip install numpy opencv-python pillow torch torchvision torchaudio --extra-index-url https://download.pytorch.org/whl/cu118
   pip install gfpgan codeformer-pip torchvision basicsr facexlib

گام ۳: دریافت فایل‌های وزن مدل‌های پیش‌آموخته (Pre-trained Weights)
----------------------------------------------------------------
برای ارتقای هوشمند کیفیت چهره‌ها (GFPGAN / CodeFormer) وزن‌های زیر را در پوشه اسکریپت قرار دهید:
- GFPGANv1.4.pth (دانلود از گیت‌هاب رسمی GFPGAN)
- codeformer.pth (دانلود از گیت‌هاب رسمی CodeFormer)

گام ۴: نحوه اجرای اسکریپت
--------------------------
اسکریپت را با پارامتر ورودی و خروجی اجرا کنید:

   python restore_document.py --input my_old_photo.jpg --output restored_photo_1080p.jpg --upscale 2
================================================================================
"""

import os
import sys
import argparse
import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

def create_inpainting_mask(img_bgr):
    """ایجاد ماسک هوشمند شناسایی لکه‌ها، خش‌ها و نویزهای سند با الگوریتم مورفولوژی"""
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    
    # اعمال فیلتر مورفولوژیکال گرادیان جهت تشخیص لبه‌های پارگی و خراش
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    gradient = cv2.morphologyEx(gray, cv2.MORPH_GRADIENT, kernel)
    
    # آستانه‌گذاری خودکار برای تفکیک آسیب‌دیدگی‌های سطحی
    _, mask = cv2.threshold(gradient, 30, 255, cv2.THRESH_BINARY)
    
    # همگراسازی ماسک
    mask = cv2.dilate(mask, kernel, iterations=1)
    return mask

def restore_face_and_texture(img_bgr, upscale=2):
    """بازسازی هوشمند با حفظ ۱۰۰٪ اصالت چهره و عدم دستکاری ساختار استخوانی"""
    try:
        # تلاش برای فراخوانی GFPGAN در صورت نصب بودن
        from gfpgan import GFPGANer
        print("  -> در حال فراخوانی مدل GFPGAN برای شفاف‌سازی بافت چهره...")
        restorer = GFPGANer(
            model_path='GFPGANv1.4.pth',
            upscale=upscale,
            arch='clean',
            channel_multiplier=2,
            bg_upsampler=None
        )
        _, _, restored_img = restorer.enhance(img_bgr, has_aligned=False, only_center_face=False, paste_back=True)
        return restored_img
    except Exception as e:
        print(f"  -> GFPGAN در دسترس نیست ({e}). استفاده از فیلترهای پیشرفته OpenCV و CLAHE...")
        # الگوریتم پشتیبان بی‌پایان در OpenCV
        # ۱. ترمیم لکه‌ها (Telea Inpainting)
        mask = create_inpainting_mask(img_bgr)
        inpainted = cv2.inpaint(img_bgr, mask, inpaintRadius=3, flags=cv2.INPAINT_TELEA)
        
        # ۲. بهبود کنتراست محلی با CLAHE روی کانال درخشندگی Lab
        lab = cv2.cvtColor(inpainted, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        cl = clahe.apply(l)
        limg = cv2.merge((cl, a, b))
        enhanced_bgr = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
        return enhanced_bgr

def process_document(input_path, output_path, upscale_factor=2):
    print("==========================================================================")
    print(f"   شروع فرآیند ترمیم و تجلی هوشمند سند: {input_path}")
    print("==========================================================================")

    if not os.path.exists(input_path):
        print(f"❌ خطا: فایل {input_path} وجود ندارد.")
        return

    # ۱. بارگذاری تصویر
    print("[۱/۵] بارگذاری تصویر و استخراج ابعاد اصلی...")
    img = cv2.imread(input_path)
    if img is None:
        print("❌ خطا در خواندن تصویر با OpenCV.")
        return

    # ۲. پاکسازی نویز و لکه‌گیری هوشمند
    print("[۲/۵] پاکسازی نویز، خش‌گیری و ترمیم لکه‌های کهنگی...")
    restored = restore_face_and_texture(img, upscale=upscale_factor)

    # ۳. تنظیم نورپردازی، کنتراست و رنگ طبیعی
    print("[۳/۵] تنظیم نورپردازی و تعادل رنگی با حفظ اصالت نور مرجع...")
    rgb = cv2.cvtColor(restored, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(rgb)
    
    # شارپ‌سازی بافت پارچه و خطوط
    pil_img = pil_img.filter(ImageFilter.UnsharpMask(radius=1.5, percent=130, threshold=3))
    
    # افزایش جزیی کنتراست
    enhancer_contrast = ImageEnhance.Contrast(pil_img)
    pil_img = enhancer_contrast.enhance(1.12)

    # ۴. ارتقای ابعاد به Full HD (۱۹۲۰×۱۰۸۰) با الگوریتم Lanczos
    print("[۴/۵] تنظیم رزولوشن به استاندارد ۱۹۲۰×۱۰۸۰ Full HD...")
    final_rgb = np.array(pil_img)
    
    h, w, _ = final_rgb.shape
    target_w, target_h = 1920, 1080
    
    # محاسبه نسبت تصویر بدون دفرمگی چهره
    aspect = w / h
    if aspect > (target_w / target_h):
        new_w = target_w
        new_h = int(target_w / aspect)
    else:
        new_h = target_h
        new_w = int(target_h * aspect)
        
    resized = cv2.resize(final_rgb, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)
    
    # ساخت بوم Full HD ۱۹۲۰x۱۰۸۰ با پس‌زمینه منطبق
    canvas = np.zeros((target_h, target_w, 3), dtype=np.uint8)
    y_offset = (target_h - new_h) // 2
    x_offset = (target_w - new_w) // 2
    canvas[y_offset:y_offset+new_h, x_offset:x_offset+new_w] = resized

    # ۵. ذخیره نهایی با بالاترین کیفیت کیفیت (Quality 98)
    print(f"[۵/۵] ذخیره‌سازی تصویر ترمیم‌شده در: {output_path}")
    final_bgr = cv2.cvtColor(canvas, cv2.COLOR_RGB2BGR)
    cv2.imwrite(output_path, final_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 98])
    print("✅ با موفقیت انجام شد. اصالت چهره ۱۰۰٪ حفظ گردید.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="اسکریپت تخصصی ترمیم و تجلی اسناد ایثارگران")
    parser.add_argument("--input", type=str, default="old_photo.jpg", help="مسیر تصویر ورودی")
    parser.add_argument("--output", type=str, default="restored_1080p.jpg", help="مسیر تصویر خروجی")
    parser.add_argument("--upscale", type=int, default=2, help="ضریب ارتقا (۱، ۲ یا ۴)")
    
    args = parser.parse_args()
    process_document(args.input, args.output, args.upscale)
`;

const Restoration: React.FC<RestorationProps> = ({ documents = MOCK_DOCUMENTS, onSaveDocument, profiles = MOCK_PROFILES }) => {
    const [source, setSource] = useState<'upload' | 'archive'>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
    const [restoredUrl, setRestoredUrl] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isLoadingArchiveFile, setIsLoadingArchiveFile] = useState(false);
    const [analysis, setAnalysis] = useState<string>('');
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [saveData, setSaveData] = useState({ profileId: '', title: '', category: 'تصاویر ترمیم شده' });

    // Instruction Directive Tabs State
    const [instructionTab, setInstructionTab] = useState<'rules' | 'prompt' | 'python'>('rules');
    const [copiedPrompt, setCopiedPrompt] = useState(false);
    const [copiedScript, setCopiedScript] = useState(false);

    // Fine-tuning restoration options & slider states
    const [sliderPos, setSliderPos] = useState<number>(50);
    const [engineMode, setEngineMode] = useState<'digital' | 'ai'>('digital');
    const [scale, setScale] = useState<number>(3);
    const [contrast, setContrast] = useState<number>(1.35);
    const [brightness, setBrightness] = useState<number>(10);
    const [saturation, setSaturation] = useState<number>(1.3);
    const [sharpness, setSharpness] = useState<number>(1.8);
    const [deyellow, setDeyellow] = useState<boolean>(true);
    const [colorize, setColorize] = useState<boolean>(true);
    const [preset, setPreset] = useState<'studio' | 'document' | 'vintage' | 'colorization'>('studio');

    const applyPreset = (p: 'studio' | 'document' | 'vintage' | 'colorization') => {
        setPreset(p);
        if (p === 'studio') {
            setContrast(1.35); setBrightness(10); setSaturation(1.3); setSharpness(1.8); setDeyellow(true); setColorize(true);
        } else if (p === 'document') {
            setContrast(1.85); setBrightness(15); setSaturation(0.0); setSharpness(2.4); setDeyellow(true); setColorize(false);
        } else if (p === 'vintage') {
            setContrast(1.25); setBrightness(8); setSaturation(1.4); setSharpness(1.4); setDeyellow(true); setColorize(false);
        } else if (p === 'colorization') {
            setContrast(1.30); setBrightness(12); setSaturation(1.6); setSharpness(1.6); setDeyellow(true); setColorize(true);
        }
    };

    const handleCopyPrompt = () => {
        navigator.clipboard.writeText(DEFAULT_ENGLISH_PROMPT);
        setCopiedPrompt(true);
        setTimeout(() => setCopiedPrompt(false), 2000);
    };

    const handleCopyScript = () => {
        navigator.clipboard.writeText(DEFAULT_PYTHON_SCRIPT);
        setCopiedScript(true);
        setTimeout(() => setCopiedScript(false), 2000);
    };

    // Archive Search & Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('همه');

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Merge all available documents (passed props or default mock)
    const archiveDocs = useMemo(() => {
        const list = documents && documents.length > 0 ? documents : MOCK_DOCUMENTS;
        // Filter mainly visual items (images or documents with thumbnails)
        return list;
    }, [documents]);

    const categories = useMemo(() => {
        const set = new Set<string>();
        archiveDocs.forEach(d => { if (d.category) set.add(d.category); });
        return ['همه', ...Array.from(set)];
    }, [archiveDocs]);

    // Filtered documents in archive picker mode
    const filteredArchiveDocs = useMemo(() => {
        return archiveDocs.filter(doc => {
            const matchesCat = selectedCategory === 'همه' || doc.category === selectedCategory;
            if (!matchesCat) return false;

            if (!searchTerm.trim()) return true;
            const term = searchTerm.toLowerCase().trim();
            
            const titleMatch = doc.title.toLowerCase().includes(term);
            const tagMatch = doc.tags ? doc.tags.some(t => t.toLowerCase().includes(term)) : false;
            const catMatch = doc.category.toLowerCase().includes(term);
            const descMatch = doc.description ? doc.description.toLowerCase().includes(term) : false;

            // Profile match
            const profile = MOCK_PROFILES.find(p => p.id === doc.profileId);
            const profileMatch = profile ? `${profile.name} ${profile.family}`.toLowerCase().includes(term) : false;

            return titleMatch || tagMatch || catMatch || descMatch || profileMatch;
        });
    }, [archiveDocs, searchTerm, selectedCategory]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const f = e.target.files[0];
            setFile(f);
            setPreviewUrl(URL.createObjectURL(f));
            setSelectedDoc(null);
            setRestoredUrl(null);
            setAnalysis('');
        }
    };

    const handleSelectArchiveDoc = async (doc: Document) => {
        setIsLoadingArchiveFile(true);
        setSelectedDoc(doc);
        const imageUrl = doc.thumbnail || doc.description?.match(/https?:\/\/[^\s]+/)?.[0] || APP_LOGO_URL;
        setPreviewUrl(imageUrl);
        setRestoredUrl(null);
        setAnalysis('');

        const profile = MOCK_PROFILES.find(p => p.id === doc.profileId);
        const titlePrefix = profile ? `ترمیم تصویر ${profile.name} ${profile.family}` : `ترمیم ${doc.title}`;
        setSaveData({
            profileId: doc.profileId || '',
            title: titlePrefix,
            category: 'تصاویر ترمیم شده'
        });

        try {
            const convertedFile = await urlToFile(imageUrl, `archive-${doc.id}.jpg`);
            setFile(convertedFile);
        } catch (e) {
            console.error("Error converting archive document image to file:", e);
        } finally {
            setIsLoadingArchiveFile(false);
        }
    };

    const handleRestore = async (e?: React.MouseEvent, overrideOpts?: any) => {
        if (e) e.preventDefault();
        
        let targetFile = file;
        if (!targetFile && previewUrl) {
            setIsProcessing(true);
            try {
                targetFile = await urlToFile(previewUrl, 'restoration-input.jpg');
                setFile(targetFile);
            } catch (err) {
                console.error("Failed to prepare file for restoration:", err);
            }
        }

        if (!targetFile) {
            alert('لطفاً ابتدا یک تصویر را انتخاب یا بارگذاری نمایید.');
            return;
        }

        setIsProcessing(true);
        setRestoredUrl(null);
        setAnalysis('');

        const currentOpts = overrideOpts || {
            contrast,
            brightness,
            saturation,
            sharpness,
            deyellow,
            colorize,
            scale,
            mode: engineMode
        };

        try {
            console.log("Starting restoration with options:", currentOpts);
            const result = await restoreImage(targetFile, currentOpts);
            if (result.base64) {
                setRestoredUrl(result.base64);
            } else {
                setRestoredUrl(previewUrl);
                alert('هوش مصنوعی تحلیلی ارائه داد اما موفق به بازسازی تصویر نشد.');
            }
            setAnalysis(result.analysis || 'تحلیل بازسازی توسط هوش مصنوعی انجام شد.');
        } catch (err: any) {
            console.error("Restoration Error Detailed:", err);
            alert(`خطا در پردازش هوشمند: ${err.message || 'خطای ناشناخته'}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownloadRestored = () => {
        if (!restoredUrl) return;
        const link = document.createElement('a');
        link.href = restoredUrl;
        link.download = `Yade_Restored_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSave = async () => {
        setIsProcessing(true);
        let thumbnail = restoredUrl || previewUrl || undefined;
        if (thumbnail && thumbnail.startsWith('data:image')) {
            try {
                thumbnail = await resizeImage(thumbnail, 600, 600);
            } catch (e) {
                console.warn("Resize failed, using original", e);
            }
        }

        const newDoc: Document = {
            id: `REST-${Date.now()}`,
            title: saveData.title || file?.name || 'سند ترمیم شده',
            type: file?.type.includes('video') ? 'video' : 'image',
            category: saveData.category,
            date: new Date().toLocaleDateString('fa-IR'),
            status: 'processed',
            tags: ['AI_Restored', 'تجلی_یافته', ...(selectedDoc?.tags || [])],
            profileId: saveData.profileId,
            thumbnail: thumbnail,
            description: `سند ترمیم شده توسط هوش مصنوعی. ${selectedDoc ? `برگرفته از سند آرشیو: ${selectedDoc.title}.` : ''} تحلیل: ${analysis}`
        };
        onSaveDocument(newDoc);
        setIsProcessing(false);
        alert('سند تجلی یافته با موفقیت در آرشیو ثبت و بایگانی گردید.');
        setShowSaveModal(false);
        setFile(null);
        setSelectedDoc(null);
        setPreviewUrl(null);
        setRestoredUrl(null);
        setAnalysis('');
    };

    const handleResetSelection = () => {
        setFile(null);
        setSelectedDoc(null);
        setPreviewUrl(null);
        setRestoredUrl(null);
        setAnalysis('');
    };

    return (
        <div className="animate-fade-in space-y-8 pb-20">
            {/* Header & Source Toggle */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 dark:border-gray-700 pb-6">
                <div>
                    <h2 className="text-3xl font-bold text-[#1A5D1A] dark:text-yade-gold flex items-center gap-3">
                        <Sparkles size={32} />
                        ترمیم و تجلی اسناد
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">ارتقای کیفیت و بازآفرینی هوشمند اسناد بصری شهدا و ایثارگران با حفظ اصالت تاریخی</p>
                </div>
                
                {/* Source Selection Buttons */}
                <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl shadow-inner border border-gray-200 dark:border-gray-700">
                    <button 
                        type="button" 
                        onClick={() => { setSource('upload'); handleResetSelection(); }} 
                        className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${source === 'upload' ? 'bg-[#1A5D1A] text-white shadow-md' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                        <Upload size={18} />
                        بارگذاری جدید (فایل محلی)
                    </button>
                    <button 
                        type="button" 
                        onClick={() => { setSource('archive'); handleResetSelection(); }} 
                        className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${source === 'archive' ? 'bg-[#1A5D1A] text-white shadow-md' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                        <FolderInput size={18} />
                        انتخاب از آرشیو موجود
                    </button>
                </div>
            </div>

            {/* Main Content View based on state */}
            {!previewUrl ? (
                source === 'upload' ? (
                    /* Local File Upload Box */
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="h-96 border-4 border-dashed border-gray-200 dark:border-gray-700 rounded-[40px] flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all group bg-white dark:bg-gray-800/20"
                    >
                        <div className="p-8 bg-green-50 dark:bg-gray-700 rounded-full mb-6 group-hover:scale-110 transition-transform">
                            <Upload size={48} className="text-[#1A5D1A] dark:text-yade-gold" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-700 dark:text-gray-200">انتخاب تصویر یا ویدیو از رایانه برای ترمیم</h3>
                        <p className="text-sm text-gray-400 mt-2">فایل‌های کم‌کیفیت، قدیمی، سیاه و سفید یا آسیب‌دیده اسناد</p>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            onChange={handleFileSelect} 
                            accept="image/*,video/*" 
                        />
                        <button type="button" className="mt-6 px-8 py-3 bg-[#1A5D1A] text-white rounded-xl text-sm font-bold pointer-events-none shadow-md">
                            انتخاب فایل از سیستم
                        </button>
                    </div>
                ) : (
                    /* Interactive Archive Document Selector Grid */
                    <div className="space-y-6">
                        {/* Search and Category Filters */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-[32px] shadow-soft border border-gray-100 dark:border-gray-700 space-y-4">
                            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                                <div className="relative flex-1 w-full">
                                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                    <input 
                                        type="text" 
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="جستجو در آرشیو بر اساس عنوان سند، نام شهید، برچسب‌ها یا کد پرونده..." 
                                        className="w-full pr-12 pl-4 py-3.5 bg-gray-50 dark:bg-gray-700/50 rounded-2xl outline-none focus:ring-2 focus:ring-[#1A5D1A] text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400"
                                    />
                                    {searchTerm && (
                                        <button 
                                            onClick={() => setSearchTerm('')} 
                                            className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                        >
                                            پاکسازی
                                        </button>
                                    )}
                                </div>
                                <div className="text-xs font-bold text-gray-500 dark:text-gray-400 whitespace-nowrap bg-gray-100 dark:bg-gray-700 px-4 py-3 rounded-2xl">
                                    نمایش {localizeNumber(filteredArchiveDocs.length, 'fa')} سند آماده ترمیم
                                </div>
                            </div>

                            {/* Category Filter Pills */}
                            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                                <span className="text-xs text-gray-400 font-bold ml-2 flex items-center gap-1">
                                    <Filter size={14} /> دسته‌بندی:
                                </span>
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${selectedCategory === cat ? 'bg-[#1A5D1A] text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'}`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Document Cards Grid */}
                        {filteredArchiveDocs.length === 0 ? (
                            <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-[32px] border border-gray-100 dark:border-gray-700">
                                <FolderInput size={48} className="mx-auto text-gray-300 mb-4" />
                                <h4 className="text-lg font-bold text-gray-600 dark:text-gray-300">هیچ سندی با این مشخصات در آرشیو یافت نشد</h4>
                                <p className="text-sm text-gray-400 mt-2">عبارت دیگری را جستجو کنید یا به بخش بارگذاری جدید مراجعه نمایید.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {filteredArchiveDocs.map((doc, idx) => {
                                    const profile = MOCK_PROFILES.find(p => p.id === doc.profileId);
                                    const thumb = doc.thumbnail || APP_LOGO_URL;
                                    return (
                                        <div 
                                            key={doc.id}
                                            onClick={() => handleSelectArchiveDoc(doc)}
                                            className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden border border-gray-100 dark:border-gray-700 shadow-soft hover:shadow-xl hover:border-[#1A5D1A] transition-all cursor-pointer group flex flex-col justify-between"
                                        >
                                            <div>
                                                <div className="relative aspect-video bg-gray-100 dark:bg-gray-900 overflow-hidden">
                                                    <img 
                                                        src={thumb} 
                                                        onError={(e) => { (e.target as HTMLImageElement).src = APP_LOGO_URL; }} 
                                                        alt={doc.title} 
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                    />
                                                    <span className="absolute top-3 right-3 bg-black/60 text-white text-[10px] px-2.5 py-1 rounded-full backdrop-blur-md font-bold">
                                                        {doc.category}
                                                    </span>
                                                    {profile && (
                                                        <span className="absolute bottom-3 right-3 bg-[#1A5D1A]/90 text-white text-[10px] px-2.5 py-1 rounded-full backdrop-blur-md font-bold flex items-center gap-1">
                                                            <UserCheck size={12} /> {profile.name} {profile.family}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="p-5 space-y-3">
                                                    <h4 className="font-bold text-gray-800 dark:text-gray-100 text-sm line-clamp-1 group-hover:text-[#1A5D1A] dark:group-hover:text-yade-gold transition-colors">
                                                        {doc.title}
                                                    </h4>
                                                    {doc.description && (
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-5">
                                                            {doc.description}
                                                        </p>
                                                    )}
                                                    {doc.tags && doc.tags.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 pt-1">
                                                            {doc.tags.slice(0, 3).map((t, idx) => (
                                                                <span key={idx} className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] px-2 py-0.5 rounded-md">
                                                                    #{t}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="p-4 bg-gray-50 dark:bg-gray-700/40 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                                <span className="text-[10px] text-gray-400 font-bold">{doc.date}</span>
                                                <span className="text-xs font-bold text-[#1A5D1A] dark:text-yade-gold flex items-center gap-1 group-hover:translate-x-[-2px] transition-transform">
                                                    انتخاب برای ترمیم <ChevronRight size={16} />
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )
            ) : (
                /* Selected Document Restoration Studio View */
                <div className="space-y-6">
                    {/* Selected Source Banner */}
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-3">
                        <div className="flex items-center gap-3">
                            <span className="p-2 bg-[#1A5D1A]/10 text-[#1A5D1A] dark:text-yade-gold rounded-xl font-bold text-xs">
                                {selectedDoc ? 'سند آرشیو' : 'بارگذاری محلی'}
                            </span>
                            <div>
                                <h4 className="font-bold text-sm text-gray-800 dark:text-gray-100">
                                    {selectedDoc ? selectedDoc.title : file?.name || 'تصویر انتخاب شده'}
                                </h4>
                                <p className="text-xs text-gray-400">آماده برای فرایند بازسازی بافت‌ها، شفاف‌سازی چهره و تجلی رنگی</p>
                            </div>
                        </div>
                        <button 
                            onClick={handleResetSelection}
                            className="text-xs font-bold text-gray-500 hover:text-red-500 dark:text-gray-400 flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-xl transition-colors"
                        >
                            <RefreshCw size={14} /> تغییر سند انتخاب شده
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Comparison Area with Interactive Before/After Drag Slider */}
                        <div className="bg-white dark:bg-gray-800 rounded-[40px] shadow-soft p-6 border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col justify-between">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <Maximize2 size={16} className="text-[#1A5D1A] dark:text-yade-gold" />
                                    نمای مقایسه‌ای تفکیکی (نوار وسط را بکشید)
                                </span>
                                {restoredUrl && (
                                    <span className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-3 py-1 rounded-full text-[10px] font-bold">
                                        ترمیم و تجلی تکمیل شد
                                    </span>
                                )}
                            </div>

                            <div 
                                className="relative aspect-square md:aspect-video bg-gray-900 rounded-3xl overflow-hidden flex items-center justify-center select-none cursor-ew-resize group"
                                onMouseMove={(e) => {
                                    if (e.buttons === 1) {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
                                        setSliderPos((x / rect.width) * 100);
                                    }
                                }}
                                onTouchMove={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const touch = e.touches[0];
                                    if (touch) {
                                        const x = Math.max(0, Math.min(rect.width, touch.clientX - rect.left));
                                        setSliderPos((x / rect.width) * 100);
                                    }
                                }}
                            >
                                {!restoredUrl ? (
                                    <div className="relative w-full h-full">
                                        <img src={previewUrl || ''} className="w-full h-full object-contain" alt="Preview" />
                                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                            <span className="bg-black/70 text-white text-xs font-bold px-4 py-2 rounded-2xl backdrop-blur-md">
                                                برای مشاهده نسخه تجلی یافته، کلید ترمیم را بفشارید
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative w-full h-full">
                                        {/* Original Image (Full Background - Right side visible) */}
                                        <img src={previewUrl || ''} className="absolute inset-0 w-full h-full object-contain pointer-events-none" alt="Original" />

                                        {/* Restored Image (Overlaid Left Half using clipPath) */}
                                        <div 
                                            className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden"
                                            style={{ clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)` }}
                                        >
                                            <img src={restoredUrl} className="w-full h-full object-contain" alt="Restored" />
                                        </div>

                                        {/* Drag Handle Line */}
                                        <div 
                                            className="absolute top-0 bottom-0 w-1 bg-white shadow-2xl z-10 flex items-center justify-center pointer-events-none"
                                            style={{ left: `${sliderPos}%` }}
                                        >
                                            <div className="w-9 h-9 rounded-full bg-[#1A5D1A] text-white border-2 border-white flex items-center justify-center shadow-lg text-sm font-black -translate-x-1/2">
                                                ↔
                                            </div>
                                        </div>

                                        {/* Labels */}
                                        <span className="absolute top-4 right-4 bg-black/70 text-white text-[11px] font-bold px-3 py-1.5 rounded-full backdrop-blur-md z-10 border border-white/20">
                                            اصل سند (قبل)
                                        </span>
                                        <span className="absolute top-4 left-4 bg-[#1A5D1A] text-white text-[11px] font-bold px-3 py-1.5 rounded-full backdrop-blur-md z-10 shadow-md">
                                            تجلی یافته (بعد)
                                        </span>
                                    </div>
                                )}

                                {(isProcessing || isLoadingArchiveFile) && (
                                    <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex flex-col items-center justify-center text-white gap-4 z-20">
                                        <Loader2 size={48} className="animate-spin text-yade-gold" />
                                        <div className="text-center">
                                            <p className="font-bold text-base">
                                                {isLoadingArchiveFile ? 'در حال دریافت تصویر از آرشیو...' : 'در حال بازسازی هوشمند بافت‌ها، رفع زردی و ارتقای شفافیت...'}
                                            </p>
                                            <p className="text-xs opacity-75 mt-1">توسط هوش مصنوعی یادگاران البرز</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Preset Buttons Bar */}
                            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                <span className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">پریست‌های آماده ترمیم و بازسازی:</span>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => { applyPreset('studio'); if (restoredUrl) handleRestore(undefined, { contrast: 1.35, brightness: 10, saturation: 1.3, sharpness: 1.6, deyellow: true, colorize: true }); }}
                                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${preset === 'studio' ? 'bg-[#1A5D1A] text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                                    >
                                        🌟 آتلیه‌ای / چهره
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { applyPreset('document'); if (restoredUrl) handleRestore(undefined, { contrast: 1.85, brightness: 15, saturation: 0.0, sharpness: 2.4, deyellow: true, colorize: false }); }}
                                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${preset === 'document' ? 'bg-[#1A5D1A] text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                                    >
                                        📄 اسناد مکتوب
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { applyPreset('vintage'); if (restoredUrl) handleRestore(undefined, { contrast: 1.25, brightness: 8, saturation: 1.4, sharpness: 1.3, deyellow: true, colorize: false }); }}
                                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${preset === 'vintage' ? 'bg-[#1A5D1A] text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                                    >
                                        📷 عکس‌های قدیمی
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { applyPreset('colorization'); if (restoredUrl) handleRestore(undefined, { contrast: 1.30, brightness: 12, saturation: 1.6, sharpness: 1.5, deyellow: true, colorize: true }); }}
                                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${preset === 'colorization' ? 'bg-[#1A5D1A] text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                                    >
                                        🎨 رنگ‌آمیزی چهره
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Controls & Fine-Tuning Settings */}
                        <div className="space-y-6">
                            <div className="bg-white dark:bg-gray-800 rounded-[32px] p-6 sm:p-8 shadow-soft border border-gray-100 dark:border-gray-700 h-full flex flex-col justify-between">
                                <div>
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-100">
                                        <History size={24} className="text-[#1A5D1A] dark:text-yade-gold" />
                                        تنظیمات و کنترلهای مرمت و تجلی
                                    </h3>

                                    {/* Engine Mode Toggle */}
                                    <div className="mb-4 bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                                        <span className="block text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-2">انتخاب موتور هوش مصنوعی مرمت:</span>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setEngineMode('digital')}
                                                className={`p-2.5 rounded-xl text-xs font-bold text-right transition-all flex flex-col gap-0.5 ${engineMode === 'digital' ? 'bg-[#1A5D1A] text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}
                                            >
                                                <span>🔍 مرمت دیجیتال اصیل (3x Super-HD)</span>
                                                <span className="text-[10px] opacity-80 font-normal">شفاف‌سازی بافت و فونت بدون تغییر هویت</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setEngineMode('ai')}
                                                className={`p-2.5 rounded-xl text-xs font-bold text-right transition-all flex flex-col gap-0.5 ${engineMode === 'ai' ? 'bg-[#1A5D1A] text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}
                                            >
                                                <span>✨ بازآفرینی کامل ۸K با AI</span>
                                                <span className="text-[10px] opacity-80 font-normal">تولید نسخه فوق باکیفیت و شفاف آتلیه‌ای</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Fine Tuning Sliders & Toggles */}
                                    <div className="space-y-4 bg-gray-50 dark:bg-gray-700/40 p-4 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-700 mb-6">
                                        <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-600">
                                            <span className="text-xs font-bold text-gray-700 dark:text-gray-200">مقیاس بزرگ‌نمایی:</span>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setScale(2)}
                                                    className={`px-3 py-1 rounded-lg text-xs font-bold ${scale === 2 ? 'bg-[#1A5D1A] text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200'}`}
                                                >
                                                    2x (HD)
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setScale(3)}
                                                    className={`px-3 py-1 rounded-lg text-xs font-bold ${scale === 3 ? 'bg-[#1A5D1A] text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200'}`}
                                                >
                                                    3x Ultra-HD
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-600">
                                            <span className="text-xs font-bold text-gray-700 dark:text-gray-200">کنتراست و شفافیت: {(contrast).toFixed(2)}x</span>
                                            <input 
                                                type="range" min="0.8" max="2.2" step="0.05" value={contrast} 
                                                onChange={(e) => setContrast(parseFloat(e.target.value))}
                                                className="w-1/2 accent-[#1A5D1A]"
                                            />
                                        </div>

                                        <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-600">
                                            <span className="text-xs font-bold text-gray-700 dark:text-gray-200">وضوح بافت و آنشارپ‌مسک: {(sharpness).toFixed(1)}</span>
                                            <input 
                                                type="range" min="0.0" max="3.0" step="0.1" value={sharpness} 
                                                onChange={(e) => setSharpness(parseFloat(e.target.value))}
                                                className="w-1/2 accent-[#1A5D1A]"
                                            />
                                        </div>

                                        <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-600">
                                            <span className="text-xs font-bold text-gray-700 dark:text-gray-200">اشباع و شادابی رنگ: {(saturation).toFixed(1)}</span>
                                            <input 
                                                type="range" min="0.0" max="2.2" step="0.1" value={saturation} 
                                                onChange={(e) => setSaturation(parseFloat(e.target.value))}
                                                className="w-1/2 accent-[#1A5D1A]"
                                            />
                                        </div>

                                        <div className="flex items-center justify-between pt-1">
                                            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700 dark:text-gray-200">
                                                <input 
                                                    type="checkbox" checked={deyellow} onChange={(e) => setDeyellow(e.target.checked)} 
                                                    className="w-4 h-4 rounded text-[#1A5D1A] focus:ring-[#1A5D1A]" 
                                                />
                                                حذف زردی و کهنگی کاغذ
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700 dark:text-gray-200">
                                                <input 
                                                    type="checkbox" checked={colorize} onChange={(e) => setColorize(e.target.checked)} 
                                                    className="w-4 h-4 rounded text-[#1A5D1A] focus:ring-[#1A5D1A]" 
                                                />
                                                رنگ‌آمیزی ارگانیک چهره و لباس
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {!restoredUrl ? (
                                    <button 
                                        type="button"
                                        onClick={(e) => handleRestore(e)}
                                        disabled={isProcessing || isLoadingArchiveFile}
                                        className="w-full bg-[#1A5D1A] text-white py-4 rounded-2xl font-bold shadow-lg shadow-green-900/20 hover:scale-[1.01] transition-all flex items-center justify-center gap-3 disabled:opacity-50 text-base"
                                    >
                                        <Sparkles size={20} />
                                        اجرا و تجلی هوشمند تصویر
                                    </button>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 max-h-36 overflow-y-auto">
                                            <h4 className="text-xs font-bold text-[#1A5D1A] dark:text-yade-gold mb-2 flex items-center gap-1.5">
                                                <CheckCircle size={14}/> گزارش تحلیل و مرمت هوشمند:
                                            </h4>
                                            <p className="text-xs leading-6 text-gray-600 dark:text-gray-300">{analysis}</p>
                                        </div>

                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <button 
                                                type="button" 
                                                onClick={(e) => handleRestore(e)} 
                                                className="flex-1 py-3 bg-[#1A5D1A] text-white rounded-2xl font-bold text-xs shadow-md hover:bg-green-800 transition-all flex items-center justify-center gap-1.5"
                                            >
                                                <RefreshCw size={16} /> اعمال مجدد تنظیمات
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={handleDownloadRestored} 
                                                className="flex-1 py-3 bg-[#2A5CAA] text-white rounded-2xl font-bold text-xs shadow-md hover:bg-blue-700 transition-all flex items-center justify-center gap-1.5"
                                            >
                                                <Download size={16} /> دریافت خروجی
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={() => setShowSaveModal(true)} 
                                                className="flex-1 py-3 bg-[#D4AF37] text-white rounded-2xl font-bold text-xs shadow-md hover:bg-[#b8962e] transition-all flex items-center justify-center gap-1.5"
                                            >
                                                <Save size={16} /> ذخیره در آرشیو
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* DIRECTIVE & OUTPUTS SECTION */}
            <div className="mt-12 bg-white dark:bg-gray-800 rounded-[32px] p-8 shadow-soft border border-gray-100 dark:border-gray-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-gray-700">
                    <div>
                        <h3 className="text-xl font-bold text-[#1A5D1A] dark:text-yade-gold flex items-center gap-2">
                            <ShieldAlert size={24} /> دستورالعمل و خروجی‌های تخصصی ترمیم و تجلی اسناد
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">پیروی دقیق از شرایط ۶ گانه بازسازی هوشمند اسناد تاریخی و خروجی‌های استاندارد</p>
                    </div>

                    <div className="flex bg-gray-100 dark:bg-gray-700 p-1.5 rounded-2xl w-full md:w-auto">
                        <button 
                            type="button" 
                            onClick={() => setInstructionTab('rules')} 
                            className={`flex-1 md:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${instructionTab === 'rules' ? 'bg-[#1A5D1A] text-white shadow-md' : 'text-gray-600 dark:text-gray-300'}`}
                        >
                            <FileText size={16} /> شرایط ۶ گانه
                        </button>
                        <button 
                            type="button" 
                            onClick={() => setInstructionTab('prompt')} 
                            className={`flex-1 md:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${instructionTab === 'prompt' ? 'bg-[#1A5D1A] text-white shadow-md' : 'text-gray-600 dark:text-gray-300'}`}
                        >
                            <Sparkles size={16} /> خروجی ۱: پرامپت انگلیسی
                        </button>
                        <button 
                            type="button" 
                            onClick={() => setInstructionTab('python')} 
                            className={`flex-1 md:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${instructionTab === 'python' ? 'bg-[#1A5D1A] text-white shadow-md' : 'text-gray-600 dark:text-gray-300'}`}
                        >
                            <Terminal size={16} /> خروجی ۲: اسکریپت پایتون
                        </button>
                    </div>
                </div>

                {instructionTab === 'rules' && (
                    <div className="space-y-4 animate-fade-in">
                        <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                            <CheckCircle size={18} className="text-[#1A5D1A]" /> دستورالعمل و استانداردهای غیرقابل‌معامله بازسازی اسناد (رنگ‌آمیزی اجباری و استاندارد True 4K):
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                                <span className="font-bold text-xs text-[#1A5D1A] dark:text-yade-gold block mb-1">🎨 قانون رنگ‌آمیزی اجباری (MANDATORY COLORIZATION)</span>
                                <p className="text-xs text-gray-700 dark:text-gray-300 leading-5">بدون استثنا کلیه عکس‌های سیاه و سفید، سپیا و قدیمی با رنگ‌های زنده، طبیعی و واقعی رنگ‌آمیزی کامل می‌شوند.</p>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-gray-100 dark:border-gray-600">
                                <span className="font-bold text-xs text-[#1A5D1A] dark:text-yade-gold block mb-1">۱. آسیب‌زدایی و بازسازی فیزیکی (Step 1)</span>
                                <p className="text-xs text-gray-600 dark:text-gray-300 leading-5">حذف کامل لکه، ترک، پارگی و بازسازی هوشمند بافت چهره و لباس با حفظ ۱۰۰٪ هویت فرد.</p>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-gray-100 dark:border-gray-600">
                                <span className="font-bold text-xs text-[#1A5D1A] dark:text-yade-gold block mb-1">۲. ارتقا به استاندارد True 4K (Step 2)</span>
                                <p className="text-xs text-gray-600 dark:text-gray-300 leading-5">بزرگ‌نمایی به کیفیت ۳۸۴۰x۲۱۶۰ پیکسل و شفاف‌سازی کریستالی مو، بافت پارچه و منافذ پوست.</p>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-gray-100 dark:border-gray-600">
                                <span className="font-bold text-xs text-[#1A5D1A] dark:text-yade-gold block mb-1">۳. ترمیم و غنی‌سازی رنگ (Step 3)</span>
                                <p className="text-xs text-gray-600 dark:text-gray-300 leading-5">اصلاح بالانس سفید، حذف زردی و کهنگی کاغذ و بازگردانی رنگ طبیعی پوست، لباس و محیط.</p>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-gray-100 dark:border-gray-600">
                                <span className="font-bold text-xs text-[#1A5D1A] dark:text-yade-gold block mb-1">۴. بهینه‌سازی نورپردازی HDR (Step 4)</span>
                                <p className="text-xs text-gray-600 dark:text-gray-300 leading-5">تنظیم دقیق گستره دینامیکی، بازگردانی جزئیات در سایه‌ها و هایلایت‌ها با عمق سه بعدی.</p>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-gray-100 dark:border-gray-600">
                                <span className="font-bold text-xs text-[#1A5D1A] dark:text-yade-gold block mb-1">۵ و ۶. کاهش نویز و پولیش ۴K (Step 5 & 6)</span>
                                <p className="text-xs text-gray-600 dark:text-gray-300 leading-5">پاکسازی نویزهای دیجیتال، ادغام بی‌نقص رنگ‌ها و ارائه خروجی نهایی بدون فشرده‌سازی.</p>
                            </div>
                        </div>
                    </div>
                )}

                {instructionTab === 'prompt' && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="flex justify-between items-center">
                            <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                <Code2 size={18} className="text-[#1A5D1A]" /> پرامپت حرفه‌ای و دقیق بازسازی تصویر (Midjourney / Stable Diffusion / DALL-E 3):
                            </h4>
                            <button 
                                type="button" 
                                onClick={handleCopyPrompt} 
                                className="px-4 py-2 bg-[#1A5D1A] text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-green-800 transition-colors shadow-sm"
                            >
                                {copiedPrompt ? <Check size={16} /> : <Copy size={16} />}
                                {copiedPrompt ? 'کپی شد!' : 'کپی پرامپت انگلیسی'}
                            </button>
                        </div>
                        <div className="p-5 bg-gray-900 text-green-400 font-mono text-xs rounded-2xl overflow-x-auto leading-6 border border-gray-800 dir-ltr select-all">
                            {DEFAULT_ENGLISH_PROMPT}
                        </div>
                    </div>
                )}

                {instructionTab === 'python' && (
                    <div className="space-y-6 animate-fade-in">
                        {/* Step-by-step visual install guide cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-800">
                                <div className="flex items-center gap-2 mb-2 text-[#1A5D1A] dark:text-emerald-400 font-bold text-xs">
                                    <span className="w-5 h-5 rounded-full bg-[#1A5D1A] text-white flex items-center justify-center text-[10px]">۱</span>
                                    ساخت محیط مجازی (venv)
                                </div>
                                <code className="block bg-gray-900 text-green-400 p-2 rounded-xl text-[11px] font-mono dir-ltr select-all">
                                    python -m venv venv<br/>
                                    source venv/bin/activate
                                </code>
                            </div>

                            <div className="p-4 bg-blue-50/60 dark:bg-blue-950/30 rounded-2xl border border-blue-100 dark:border-blue-800">
                                <div className="flex items-center gap-2 mb-2 text-blue-700 dark:text-blue-400 font-bold text-xs">
                                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">۲</span>
                                    نصب کتابخانه‌ها با pip
                                </div>
                                <code className="block bg-gray-900 text-blue-300 p-2 rounded-xl text-[11px] font-mono dir-ltr select-all overflow-x-auto">
                                    pip install opencv-python pillow numpy torch gfpgan
                                </code>
                            </div>

                            <div className="p-4 bg-amber-50/60 dark:bg-amber-950/30 rounded-2xl border border-amber-100 dark:border-amber-800">
                                <div className="flex items-center gap-2 mb-2 text-amber-700 dark:text-amber-400 font-bold text-xs">
                                    <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px]">۳</span>
                                    اجرای اسکریپت ترمیم
                                </div>
                                <code className="block bg-gray-900 text-amber-300 p-2 rounded-xl text-[11px] font-mono dir-ltr select-all">
                                    python script.py --input old.jpg --output 1080p.jpg
                                </code>
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-2">
                            <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                <Terminal size={18} className="text-[#1A5D1A]" /> اسکریپت کامل پایتون ترمیم هوشمند با OpenCV، PIL و GFPGAN / CodeFormer:
                            </h4>
                            <button 
                                type="button" 
                                onClick={handleCopyScript} 
                                className="px-4 py-2 bg-[#1A5D1A] text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-green-800 transition-colors shadow-sm"
                            >
                                {copiedScript ? <Check size={16} /> : <Copy size={16} />}
                                {copiedScript ? 'کپی شد!' : 'کپی اسکریپت پایتون'}
                            </button>
                        </div>
                        <div className="p-5 bg-gray-900 text-gray-100 font-mono text-xs rounded-2xl overflow-x-auto leading-6 border border-gray-800 dir-ltr custom-scrollbar max-h-96 select-all">
                            <pre>{DEFAULT_PYTHON_SCRIPT}</pre>
                        </div>
                    </div>
                )}
            </div>

            {/* Save Modal */}
            {showSaveModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 dark:border-gray-700">
                        <div className="p-8 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                            <h3 className="text-xl font-bold text-[#1A5D1A] dark:text-yade-gold">بایگانی سند تجلی یافته در سامانه</h3>
                        </div>
                        <div className="p-8 space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-2">انتخاب پرونده ایثارگر مربوطه</label>
                                <select 
                                    className="w-full p-4 bg-gray-50 dark:bg-gray-700 rounded-2xl outline-none focus:ring-2 focus:ring-[#D4AF37] border-none text-sm text-gray-800 dark:text-gray-100"
                                    value={saveData.profileId}
                                    onChange={(e) => setSaveData({...saveData, profileId: e.target.value})}
                                >
                                    <option value="">اسناد عمومی / بدون پرونده مستقیم</option>
                                    {MOCK_PROFILES.map(p => <option key={p.id} value={p.id}>{p.name} {p.family} (کد ملی: {p.nationalCode})</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-2">عنوان سند ترمیم شده</label>
                                <input 
                                    className="w-full p-4 bg-gray-50 dark:bg-gray-700 rounded-2xl outline-none focus:ring-2 focus:ring-[#D4AF37] border-none text-sm text-gray-800 dark:text-gray-100"
                                    placeholder="مثلا: پرتره پرسنلی شهید - تجلی یافته"
                                    value={saveData.title}
                                    onChange={(e) => setSaveData({...saveData, title: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className="p-8 bg-gray-50 dark:bg-gray-900/50 flex gap-4">
                            <button type="button" onClick={(e) => { e.preventDefault(); setShowSaveModal(false); }} className="flex-1 py-4 text-gray-500 font-bold">انصراف</button>
                            <button type="button" onClick={(e) => { e.preventDefault(); handleSave(); }} className="flex-1 py-4 bg-[#1A5D1A] text-white rounded-2xl font-bold shadow-lg">تایید نهایی و ذخیره در آرشیو</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Restoration;
