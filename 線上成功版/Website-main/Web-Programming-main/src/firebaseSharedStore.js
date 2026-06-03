import { initializeApp, getApps } from "firebase/app";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc
} from "firebase/firestore";

const COLLECTIONS = {
  users: "stampStudioUsers",
  gallery: "stampStudioGallery",
  comments: "stampStudioGeneralComments",
  userWorksRoot: "stampStudioUserWorks"
};

let dbPromise = null;
let dbInstance = null;

function normalizeGmail(gmail) {
  return String(gmail || "").trim().toLowerCase();
}

function userDocId(gmail) {
  return normalizeGmail(gmail) || "guest";
}

function nowMs() {
  return Date.now();
}

function stripUndefined(value) {
  if (Array.isArray(value)) {
    return value.map(stripUndefined).filter((item) => item !== undefined);
  }

  if (value && typeof value === "object") {
    const result = {};
    Object.entries(value).forEach(([key, item]) => {
      if (item === undefined || typeof item === "function") return;
      result[key] = stripUndefined(item);
    });
    return result;
  }

  return value;
}

async function loadFirebaseConfig() {
  const response = await fetch("/__/firebase/init.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Firebase Hosting init config is not available in this environment.");
  }
  const config = await response.json();
  if (!config?.projectId) {
    throw new Error("Firebase config does not include projectId.");
  }
  return config;
}

export async function getCloudDb() {
  if (dbInstance) return dbInstance;
  if (!dbPromise) {
    dbPromise = loadFirebaseConfig()
      .then((config) => {
        const app = getApps().length ? getApps()[0] : initializeApp(config);
        dbInstance = getFirestore(app);
        return dbInstance;
      })
      .catch((error) => {
        console.warn("Firebase shared storage is unavailable. Falling back to this browser only.", error);
        dbPromise = null;
        return null;
      });
  }
  return dbPromise;
}

export async function isCloudReady() {
  return Boolean(await getCloudDb());
}

export async function findCloudUserByGmail(gmail) {
  const db = await getCloudDb();
  if (!db) return null;

  const snap = await getDoc(doc(db, COLLECTIONS.users, userDocId(gmail)));
  return snap.exists() ? snap.data() : null;
}

export async function createCloudUser(user) {
  const db = await getCloudDb();
  if (!db) return { ok: false, cloudUnavailable: true };

  const id = userDocId(user.gmail);
  const ref = doc(db, COLLECTIONS.users, id);
  const existed = await getDoc(ref);

  if (existed.exists()) {
    return { ok: false, exists: true, user: existed.data() };
  }

  const payload = stripUndefined({
    ...user,
    gmail: normalizeGmail(user.gmail),
    id: user.id || id,
    createdAtMs: user.createdAtMs || nowMs(),
    updatedAtMs: nowMs()
  });

  await setDoc(ref, payload);
  return { ok: true, user: payload };
}

export async function updateCloudUser(user) {
  const db = await getCloudDb();
  if (!db || !user?.gmail) return false;

  await setDoc(
    doc(db, COLLECTIONS.users, userDocId(user.gmail)),
    stripUndefined({ ...user, gmail: normalizeGmail(user.gmail), updatedAtMs: nowMs() }),
    { merge: true }
  );
  return true;
}

export async function getCloudWall() {
  const db = await getCloudDb();
  if (!db) return null;

  const snap = await getDocs(collection(db, COLLECTIONS.gallery));
  return snap.docs
    .map((item) => item.data())
    .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
}

export async function saveCloudWallItem(item) {
  const db = await getCloudDb();
  if (!db || !item?.id) return false;

  const payload = stripUndefined({
    ...item,
    createdAtMs: item.createdAtMs || nowMs(),
    updatedAtMs: nowMs()
  });

  await setDoc(doc(db, COLLECTIONS.gallery, String(item.id)), payload, { merge: false });
  return true;
}

export async function deleteCloudWallItem(postId) {
  const db = await getCloudDb();
  if (!db || !postId) return false;

  await deleteDoc(doc(db, COLLECTIONS.gallery, String(postId)));
  return true;
}

export async function clearCloudWallByOwner(gmail) {
  const db = await getCloudDb();
  if (!db || !gmail) return false;

  const normalized = normalizeGmail(gmail);
  const snap = await getDocs(collection(db, COLLECTIONS.gallery));
  await Promise.all(
    snap.docs
      .filter((item) => normalizeGmail(item.data()?.gmail) === normalized)
      .map((item) => deleteDoc(item.ref))
  );
  return true;
}

export async function getCloudGeneralComments() {
  const db = await getCloudDb();
  if (!db) return null;

  const snap = await getDocs(collection(db, COLLECTIONS.comments));
  return snap.docs
    .map((item) => item.data())
    .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
}

export async function saveCloudGeneralComment(item) {
  const db = await getCloudDb();
  if (!db || !item?.id) return false;

  const payload = stripUndefined({
    ...item,
    createdAtMs: item.createdAtMs || nowMs(),
    updatedAtMs: nowMs()
  });

  await setDoc(doc(db, COLLECTIONS.comments, String(item.id)), payload, { merge: false });
  return true;
}

export async function clearCloudGeneralCommentsByOwner(gmail) {
  const db = await getCloudDb();
  if (!db || !gmail) return false;

  const normalized = normalizeGmail(gmail);
  const snap = await getDocs(collection(db, COLLECTIONS.comments));
  await Promise.all(
    snap.docs
      .filter((item) => normalizeGmail(item.data()?.gmail) === normalized)
      .map((item) => deleteDoc(item.ref))
  );
  return true;
}

function userWorksCollection(db, gmail) {
  return collection(db, COLLECTIONS.userWorksRoot, userDocId(gmail), "items");
}

export async function getCloudUserWorks(gmail) {
  const db = await getCloudDb();
  if (!db || !gmail) return null;

  const snap = await getDocs(userWorksCollection(db, gmail));
  return snap.docs
    .map((item) => item.data())
    .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
}

export async function saveCloudUserWork(gmail, item) {
  const db = await getCloudDb();
  if (!db || !gmail || !item?.id) return false;

  const payload = stripUndefined({
    ...item,
    ownerGmail: normalizeGmail(gmail),
    createdAtMs: item.createdAtMs || nowMs(),
    updatedAtMs: nowMs()
  });

  await setDoc(doc(userWorksCollection(db, gmail), String(item.id)), payload, { merge: false });
  return true;
}

export async function deleteCloudUserWork(gmail, workId) {
  const db = await getCloudDb();
  if (!db || !gmail || !workId) return false;

  await deleteDoc(doc(userWorksCollection(db, gmail), String(workId)));
  return true;
}

export async function clearCloudUserWorks(gmail, type = null) {
  const db = await getCloudDb();
  if (!db || !gmail) return false;

  const snap = await getDocs(userWorksCollection(db, gmail));
  await Promise.all(
    snap.docs
      .filter((item) => !type || item.data()?.type === type)
      .map((item) => deleteDoc(item.ref))
  );
  return true;
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

export async function prepareCloudImage(dataUrl, maxSide = 1200, quality = 0.72) {
  if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image")) {
    return dataUrl;
  }

  if (dataUrl.length < 850000) return dataUrl;

  try {
    const image = await loadImage(dataUrl);
    const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * ratio));
    const height = Math.max(1, Math.round(image.height * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, width, height);

    let result = canvas.toDataURL("image/jpeg", quality);

    if (result.length > 850000) {
      const smallerRatio = Math.min(1, 900 / Math.max(width, height));
      const smallCanvas = document.createElement("canvas");
      smallCanvas.width = Math.max(1, Math.round(width * smallerRatio));
      smallCanvas.height = Math.max(1, Math.round(height * smallerRatio));
      smallCanvas.getContext("2d").drawImage(image, 0, 0, smallCanvas.width, smallCanvas.height);
      result = smallCanvas.toDataURL("image/jpeg", 0.62);
    }

    return result;
  } catch (error) {
    console.warn("Could not compress image for Firebase cloud storage.", error);
    return dataUrl;
  }
}
