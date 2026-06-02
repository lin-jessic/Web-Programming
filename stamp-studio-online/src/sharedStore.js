// src/sharedStore.js
// 集中管理 Firestore 雲端資料

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  getDocs,
} from "firebase/firestore";

import { db } from "./firebase";

const galleryRef = collection(db, "stampStudioGallery");
const commentsRef = collection(db, "stampStudioComments");

// 即時監聽 Community Wall
export function listenGallery(callback) {
  const unsubscribe = onSnapshot(
    galleryRef,
    (snapshot) => {
      const gallery = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        .sort((a, b) => {
          const timeA = a.createdAtTime?.toMillis?.() || 0;
          const timeB = b.createdAtTime?.toMillis?.() || 0;
          return timeB - timeA;
        });

      console.log("Firebase gallery loaded:", gallery);
      callback(gallery);
    },
    (error) => {
      console.error("listenGallery Firebase error:", error);
      alert("讀取 Community Wall 失敗，請確認 Firebase Rules / Environment Variables。");
    }
  );

  return unsubscribe;
}

// 新增作品到 Community Wall
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

// 刪除作品
export async function deleteGalleryPost(postId) {
  const postDoc = doc(db, "stampStudioGallery", postId);
  return await deleteDoc(postDoc);
}

// 編輯作品文字
export async function updateGalleryPost(postId, newCaption) {
  const postDoc = doc(db, "stampStudioGallery", postId);

  return await updateDoc(postDoc, {
    caption: newCaption,
    updatedAtTime: serverTimestamp(),
  });
}

// 更新作品留言陣列，支援回覆留言
export async function updateGalleryComments(postId, comments) {
  const postDoc = doc(db, "stampStudioGallery", postId);

  return await updateDoc(postDoc, {
    comments,
    updatedAtTime: serverTimestamp(),
  });
}

// 按讚
export async function likeGalleryPost(postId, userGmail) {
  const postDoc = doc(db, "stampStudioGallery", postId);

  return await updateDoc(postDoc, {
    likes: arrayUnion(userGmail),
    updatedAtTime: serverTimestamp(),
  });
}

// 取消按讚
export async function unlikeGalleryPost(postId, userGmail) {
  const postDoc = doc(db, "stampStudioGallery", postId);

  return await updateDoc(postDoc, {
    likes: arrayRemove(userGmail),
    updatedAtTime: serverTimestamp(),
  });
}

// 收藏
export async function favoriteGalleryPost(postId, userGmail) {
  const postDoc = doc(db, "stampStudioGallery", postId);

  return await updateDoc(postDoc, {
    favorites: arrayUnion(userGmail),
    updatedAtTime: serverTimestamp(),
  });
}

// 取消收藏
export async function unfavoriteGalleryPost(postId, userGmail) {
  const postDoc = doc(db, "stampStudioGallery", postId);

  return await updateDoc(postDoc, {
    favorites: arrayRemove(userGmail),
    updatedAtTime: serverTimestamp(),
  });
}

// 新增 Community Wall 留言
export async function addGalleryComment(postId, commentData) {
  const postDoc = doc(db, "stampStudioGallery", postId);

  return await updateDoc(postDoc, {
    comments: arrayUnion({
      id: commentData.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      userId: commentData.userId || commentData.gmail || "",
      gmail: commentData.gmail || "",
      name: commentData.name || "Guest",
      avatar: commentData.avatar || "🌷",
      text: commentData.text || "",
      createdAt: commentData.createdAt || new Date().toLocaleString(),
      replies: commentData.replies || [],
    }),
    updatedAtTime: serverTimestamp(),
  });
}

// 即時監聽一般留言板
export function listenGeneralComments(callback) {
  const unsubscribe = onSnapshot(
    commentsRef,
    (snapshot) => {
      const comments = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        .sort((a, b) => {
          const timeA = a.createdAtTime?.toMillis?.() || 0;
          const timeB = b.createdAtTime?.toMillis?.() || 0;
          return timeB - timeA;
        });

      console.log("Firebase comments loaded:", comments);
      callback(comments);
    },
    (error) => {
      console.error("listenGeneralComments Firebase error:", error);
      alert("讀取 Live Comment Board 失敗，請確認 Firebase Rules / Environment Variables。");
    }
  );

  return unsubscribe;
}

// 新增一般留言
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

// 更新一般留言回覆
export async function updateGeneralCommentReplies(commentId, replies) {
  const commentDoc = doc(db, "stampStudioComments", commentId);

  return await updateDoc(commentDoc, {
    replies,
    updatedAtTime: serverTimestamp(),
  });
}

// 清空 Community Wall
export async function clearGalleryCloud() {
  const snapshot = await getDocs(galleryRef);
  const jobs = snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref));
  return await Promise.all(jobs);
}

// 清空一般留言板
export async function clearGeneralCommentsCloud() {
  const snapshot = await getDocs(commentsRef);
  const jobs = snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref));
  return await Promise.all(jobs);
}