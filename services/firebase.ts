import { initializeApp, getApps } from 'firebase/app';
import { 
    getFirestore, initializeFirestore, memoryLocalCache, 
    collection, getDocs, doc, setDoc, 
    deleteDoc, onSnapshot, writeBatch, Firestore
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { Document, Memoir, HistoricalEvent, MartyrProfile } from '../types';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firestore with configured database ID or fallback to default
let dbInstance: Firestore;
try {
    const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
        ? firebaseConfig.firestoreDatabaseId
        : undefined;
    
    // Enable memory cache for smooth offline / preview sandbox operation
    if (dbId) {
        dbInstance = initializeFirestore(app, {
            localCache: memoryLocalCache()
        }, dbId);
    } else {
        dbInstance = initializeFirestore(app, {
            localCache: memoryLocalCache()
        });
    }
} catch (err) {
    console.warn("Failed to initialize custom database ID with memory cache, falling back:", err);
    dbInstance = getFirestore(app);
}

export const db = dbInstance;

// Helper to execute Firestore operations with a fast timeout
async function withTimeout<T>(promise: Promise<T>, ms: number = 4000, fallbackValue: T): Promise<T> {
    let timer: any;
    const timeoutPromise = new Promise<T>((resolve) => {
        timer = setTimeout(() => {
            console.warn(`Firestore operation timed out after ${ms}ms. Using local offline fallback.`);
            resolve(fallbackValue);
        }, ms);
    });

    try {
        const result = await Promise.race([promise, timeoutPromise]);
        clearTimeout(timer);
        return result;
    } catch (error: any) {
        clearTimeout(timer);
        console.warn("Firestore operation notice:", error?.message || error);
        return fallbackValue;
    }
}

// Collections references
export const COLLECTIONS = {
    DOCUMENTS: 'documents',
    PROFILES: 'profiles',
    MEMOIRS: 'memoirs',
    EVENTS: 'events',
    TAGS: 'tags'
};

// Sync Documents with Firestore
export async function fetchFirestoreDocs(): Promise<Document[]> {
    return withTimeout(
        (async () => {
            const querySnapshot = await getDocs(collection(db, COLLECTIONS.DOCUMENTS));
            const docs: Document[] = [];
            querySnapshot.forEach((docSnap) => {
                docs.push({ id: docSnap.id, ...docSnap.data() } as Document);
            });
            return docs;
        })(),
        3500,
        []
    );
}

export async function saveDocumentToFirestore(document: Document): Promise<void> {
    try {
        const docRef = doc(db, COLLECTIONS.DOCUMENTS, document.id);
        await withTimeout(setDoc(docRef, document, { merge: true }), 3000, undefined);
    } catch (e) {
        console.warn("Firestore save document offline notice:", e);
    }
}

export async function deleteDocumentFromFirestore(docId: string): Promise<void> {
    try {
        await withTimeout(deleteDoc(doc(db, COLLECTIONS.DOCUMENTS, docId)), 3000, undefined);
    } catch (e) {
        console.warn("Firestore delete document notice:", e);
    }
}

// Sync Profiles with Firestore
export async function fetchFirestoreProfiles(): Promise<MartyrProfile[]> {
    return withTimeout(
        (async () => {
            const querySnapshot = await getDocs(collection(db, COLLECTIONS.PROFILES));
            const profiles: MartyrProfile[] = [];
            querySnapshot.forEach((docSnap) => {
                profiles.push({ id: docSnap.id, ...docSnap.data() } as MartyrProfile);
            });
            return profiles;
        })(),
        3500,
        []
    );
}

export async function saveProfileToFirestore(profile: MartyrProfile): Promise<void> {
    try {
        const docRef = doc(db, COLLECTIONS.PROFILES, profile.id);
        await withTimeout(setDoc(docRef, profile, { merge: true }), 3000, undefined);
    } catch (e) {
        console.warn("Firestore save profile notice:", e);
    }
}

// Sync Memoirs with Firestore
export async function fetchFirestoreMemoirs(): Promise<Memoir[]> {
    return withTimeout(
        (async () => {
            const querySnapshot = await getDocs(collection(db, COLLECTIONS.MEMOIRS));
            const memoirs: Memoir[] = [];
            querySnapshot.forEach((docSnap) => {
                memoirs.push({ id: docSnap.id, ...docSnap.data() } as Memoir);
            });
            return memoirs;
        })(),
        3500,
        []
    );
}

export async function saveMemoirToFirestore(memoir: Memoir): Promise<void> {
    try {
        const docRef = doc(db, COLLECTIONS.MEMOIRS, memoir.id);
        await withTimeout(setDoc(docRef, memoir, { merge: true }), 3000, undefined);
    } catch (e) {
        console.warn("Firestore save memoir notice:", e);
    }
}

// Seed initial default profiles to Firestore if empty
export async function seedInitialFirestoreDataIfNeeded(initialDocs: Document[], initialProfiles: MartyrProfile[]): Promise<void> {
    try {
        const docs = await fetchFirestoreDocs();
        if (docs.length === 0 && initialDocs.length > 0) {
            console.log("Seeding initial documents to Firestore...");
            for (const docItem of initialDocs.slice(0, 10)) {
                await saveDocumentToFirestore(docItem);
            }
        }

        const profiles = await fetchFirestoreProfiles();
        if (profiles.length === 0 && initialProfiles.length > 0) {
            console.log("Seeding initial martyr profiles to Firestore...");
            for (const profile of initialProfiles.slice(0, 10)) {
                await saveProfileToFirestore(profile);
            }
        }
    } catch (e) {
        console.warn("Firestore seeding notice:", e);
    }
}

