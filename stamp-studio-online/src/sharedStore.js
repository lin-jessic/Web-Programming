// src/sharedStore.js
// 集中管理 Firestore 雲端資料：Community Wall、按讚、收藏、留言、一般留言板

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  getDocs,
} from "firebase/firestore";

import { db } from "./firebase";

const galleryRef = collection(db, "stampStudioGallery");
const commentsRef = collection(db, "stampStudioComments");

export function listenGallery(callback) {
  const q = query(galleryRef, orderBy("createdAtTime", "desc"));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const gallery = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      callback(gallery);
    },
    (error) => {
      console.error("listenGallery Firebase error:", error);
      alert("讀取 Community Wall 失敗，請確認 Firebase Rules / Vercel Environment Variables。");
    }
  );

  return unsubscribe;
}

export async function addGalleryPost(postData) {
  return await addDoc(galleryRef, {
    image: postData.image || "",
    imageKey: postData.imageKey || "",
    userId: postData.userId || "",
    name: postData.name || "Guest",
    gmail: postData.gmail || "",
    avatar: postData.avatar || "🌷",
    caption: postData.caption || "Shared a new work.",
    createdAt: new Date().toLocaleString(),
    createdAtTime: serverTimestamp(),
    updatedAtTime: serverTimestamp(),
    likes: [],
    favorites: [],
    comments: [],
  });
}

export async function deleteGalleryPost(postId) {
  const postDoc = doc(db, "stampStudioGallery", postId);
  return await deleteDoc(postDoc);
}

export async function updateGalleryPost(postId, newCaption) {
  const postDoc = doc(db, "stampStudioGallery", postId);

  return await updateDoc(postDoc, {
    caption: newCaption,
    updatedAtTime: serverTimestamp(),
  });
}

export async function likeGalleryPost(postId, userGmail) {
  const postDoc = doc(db, "stampStudioGallery", postId);

  return await updateDoc(postDoc, {
    likes: arrayUnion(userGmail),
    updatedAtTime: serverTimestamp(),
  });
}

export async function unlikeGalleryPost(postId, userGmail) {
  const postDoc = doc(db, "stampStudioGallery", postId);

  return await updateDoc(postDoc, {
    likes: arrayRemove(userGmail),
    updatedAtTime: serverTimestamp(),
  });
}

export async function favoriteGalleryPost(postId, userGmail) {
  const postDoc = doc(db, "stampStudioGallery", postId);

  return await updateDoc(postDoc, {
    favorites: arrayUnion(userGmail),
    updatedAtTime: serverTimestamp(),
  });
}

export async function unfavoriteGalleryPost(postId, userGmail) {
  const postDoc = doc(db, "stampStudioGallery", postId);

  return await updateDoc(postDoc, {
    favorites: arrayRemove(userGmail),
    updatedAtTime: serverTimestamp(),
  });
}

export async function addGalleryComment(postId, commentData) {
  const postDoc = doc(db, "stampStudioGallery", postId);

  return await updateDoc(postDoc, {
    comments: arrayUnion({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      userId: commentData.userId || commentData.gmail || "",
      gmail: commentData.gmail || "",
      name: commentData.name || "Guest",
      avatar: commentData.avatar || "🌷",
      text: commentData.text || "",
      createdAt: new Date().toLocaleString(),
      replies: [],
    }),
    updatedAtTime: serverTimestamp(),
  });
}

export function listenGeneralComments(callback) {
  const q = query(commentsRef, orderBy("createdAtTime", "desc"));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const comments = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      callback(comments);
    },
    (error) => {
      console.error("listenGeneralComments Firebase error:", error);
      alert("讀取 Live Comment Board 失敗，請確認 Firebase Rules / Vercel Environment Variables。");
    }
  );

  return unsubscribe;
}

export async function addGeneralCommentToCloud(commentData) {
  return await addDoc(commentsRef, {
    userId: commentData.userId || commentData.gmail || "",
    gmail: commentData.gmail || "",
    name: commentData.name || "Guest",
    avatar: commentData.avatar || "🌷",
    text: commentData.text || "",
    createdAt: new Date().toLocaleString(),
    createdAtTime: serverTimestamp(),
    replies: [],
  });
}

export async function clearGalleryCloud() {
  const snapshot = await getDocs(galleryRef);
  const jobs = snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref));
  return await Promise.all(jobs);
}

export async function clearGeneralCommentsCloud() {
  const snapshot = await getDocs(commentsRef);
  const jobs = snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref));
  return await Promise.all(jobs);
}