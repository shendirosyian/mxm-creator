/**
 * MXM CREATOR - Persistent Project Storage
 * Uses IndexedDB to store high-resolution images, original assets, versions, and outfit library items.
 */

import { ProjectRecord, SavedOutfit } from '../types';

const DB_NAME = 'mxm_creator_db';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_OUTFITS = 'outfits';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_OUTFITS)) {
        db.createObjectStore(STORE_OUTFITS, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// PROJECTS
export async function getAllProjects(): Promise<ProjectRecord[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const store = tx.objectStore(STORE_PROJECTS);
      const req = store.getAll();
      req.onsuccess = () => {
        const sorted = (req.result || []).sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(sorted);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Falling back to localStorage for projects:', e);
    const raw = localStorage.getItem('mxm_projects');
    return raw ? JSON.parse(raw) : [];
  }
}

export async function getProjectById(id: string): Promise<ProjectRecord | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const store = tx.objectStore(STORE_PROJECTS);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    const list = await getAllProjects();
    return list.find((p) => p.id === id) || null;
  }
}

export async function saveProject(project: ProjectRecord): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      const store = tx.objectStore(STORE_PROJECTS);
      const req = store.put(project);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('IndexedDB save failed, falling back to localStorage:', e);
    const list = await getAllProjects();
    const existingIdx = list.findIndex((p) => p.id === project.id);
    if (existingIdx >= 0) list[existingIdx] = project;
    else list.unshift(project);
    try {
      localStorage.setItem('mxm_projects', JSON.stringify(list));
    } catch {
      // Quota exceeded
    }
  }
}

export async function deleteProject(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      const store = tx.objectStore(STORE_PROJECTS);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    const list = (await getAllProjects()).filter((p) => p.id !== id);
    localStorage.setItem('mxm_projects', JSON.stringify(list));
  }
}

// OUTFIT LIBRARY
export async function getAllSavedOutfits(): Promise<SavedOutfit[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_OUTFITS, 'readonly');
      const store = tx.objectStore(STORE_OUTFITS);
      const req = store.getAll();
      req.onsuccess = () => {
        const sorted = (req.result || []).sort((a, b) => b.createdAt - a.createdAt);
        resolve(sorted);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    const raw = localStorage.getItem('mxm_outfits');
    return raw ? JSON.parse(raw) : [];
  }
}

export async function saveOutfitToLibrary(outfit: SavedOutfit): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_OUTFITS, 'readwrite');
      const store = tx.objectStore(STORE_OUTFITS);
      const req = store.put(outfit);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    const list = await getAllSavedOutfits();
    list.unshift(outfit);
    localStorage.setItem('mxm_outfits', JSON.stringify(list));
  }
}

export async function deleteOutfitFromLibrary(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_OUTFITS, 'readwrite');
      const store = tx.objectStore(STORE_OUTFITS);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    const list = (await getAllSavedOutfits()).filter((o) => o.id !== id);
    localStorage.setItem('mxm_outfits', JSON.stringify(list));
  }
}
