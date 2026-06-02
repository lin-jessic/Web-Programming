import { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import ThreeDeskPostcard from "./ThreeDeskPostcard.jsx";
import UploadBooth from "./UploadBooth.jsx";
import CameraBooth from "./CameraBooth.jsx";
import BoothChoose from "./BoothChoose.jsx";
import ScrapbookPlanner from "./ScrapbookPlanner.jsx";
import {
  listenGallery,
  addGalleryPost,
  deleteGalleryPost,
  updateGalleryPost,
  likeGalleryPost,
  unlikeGalleryPost,
  favoriteGalleryPost,
  unfavoriteGalleryPost,
  addGalleryComment,
  listenGeneralComments,
  addGeneralCommentToCloud,
  clearGalleryCloud,
  clearGeneralCommentsCloud,
  updateGalleryComments,
  updateGeneralCommentReplies,
} from "./sharedStore.js";
import "./App.css";

const STORAGE_KEYS = {
  postcards: "stampStudio_savedPostcards",
  photoBooths: "stampStudio_savedPhotoBooths",
  scrapbooks: "lifeTracker_savedScrapbooks",
  gallery: "stampStudio_gallery",
  comments: "stampStudio_comments",
  postcardConfig: "stampStudio3DData",
  boothConfig: "photoBoothConfig",
  users: "stampStudio_users",
  currentUser: "stampStudio_currentUser"
};

const MAX_POSTCARDS = 30;
const MAX_PHOTOBOOTHS = 30;
const MAX_SCRAPBOOKS = 30;
const MAX_GALLERY = 30;
const MAX_COMMENTS = 50;

function getList(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return [];

  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveList(key, list, limit) {
  const limited = list.slice(0, limit);

  try {
    localStorage.setItem(key, JSON.stringify(limited));
    return true;
  } catch (error) {
    console.error("localStorage save failed.", error);
    alert("儲存失敗：目前瀏覽器 localStorage 仍然太滿，請先按 Reset Local Demo Data 清掉舊的大圖資料。");
    return false;
  }
}

const IMAGE_DB_NAME = "stampStudioImageDB";
const IMAGE_STORE_NAME = "images";

function openImageDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IMAGE_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE_NAME)) {
        db.createObjectStore(IMAGE_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveImageToDB(key, dataUrl) {
  if (!dataUrl) return;

  const db = await openImageDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE_NAME, "readwrite");
    tx.objectStore(IMAGE_STORE_NAME).put(dataUrl, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function getImageFromDB(key) {
  if (!key) return null;

  const db = await openImageDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE_NAME, "readonly");
    const request = tx.objectStore(IMAGE_STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function deleteImageFromDB(key) {
  if (!key) return;

  const db = await openImageDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE_NAME, "readwrite");
    tx.objectStore(IMAGE_STORE_NAME).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function attachImages(list) {
  return Promise.all(
    list.map(async (item) => {
      if (item.image) return item;
      const image = await getImageFromDB(item.imageKey);
      return {
        ...item,
        image
      };
    })
  );
}


function stripImages(list) {
  return list.map((item) => {
    const copy = { ...item };
    delete copy.image;
    return copy;
  });
}

async function migrateStoredImagesToIndexedDB() {
  const keys = [STORAGE_KEYS.postcards, STORAGE_KEYS.photoBooths, STORAGE_KEYS.scrapbooks, STORAGE_KEYS.gallery];

  for (const key of keys) {
    const list = getList(key);
    let changed = false;

    for (const item of list) {
      if (item.image) {
        const imageKey = item.imageKey || `img_${item.id || makeId()}`;
        await saveImageToDB(imageKey, item.image);
        item.imageKey = imageKey;
        delete item.image;
        changed = true;
      }
    }

    if (changed) {
      localStorage.setItem(key, JSON.stringify(list));
    }
  }
}

async function resetLocalDemoData() {
  localStorage.removeItem(STORAGE_KEYS.postcards);
  localStorage.removeItem(STORAGE_KEYS.photoBooths);
  localStorage.removeItem(STORAGE_KEYS.scrapbooks);
  localStorage.removeItem(STORAGE_KEYS.gallery);
  localStorage.removeItem(STORAGE_KEYS.comments);
  localStorage.removeItem(STORAGE_KEYS.postcardConfig);
  localStorage.removeItem(STORAGE_KEYS.boothConfig);

  const db = await openImageDB();

  await new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE_NAME, "readwrite");
    tx.objectStore(IMAGE_STORE_NAME).clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });

  alert("已清除舊的大圖資料，可以重新儲存作品了。帳號仍會保留。");
  window.location.reload();
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function stableHash(value) {
  const text = String(value || "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function getStableCommentId(source) {
  if (source.id) return source.id;
  const seed = `${source.gmail || "guest"}|${source.name || source.nickname || "Guest"}|${source.createdAt || ""}|${source.text || ""}`;
  return `comment_${stableHash(seed)}`;
}

function normalizeWallComment(comment) {
  const source = typeof comment === "string" ? { text: comment } : (comment || {});
  return {
    id: getStableCommentId(source),
    userId: source.userId || source.gmail || "guest",
    gmail: source.gmail || "",
    name: source.name || source.nickname || "Guest",
    avatar: source.avatar || "🌷",
    text: source.text || "",
    createdAt: source.createdAt || new Date().toLocaleString(),
    replies: Array.isArray(source.replies) ? source.replies.map(normalizeWallComment) : []
  };
}

function normalizeWallGallery(list) {
  return (Array.isArray(list) ? list : []).map((item) => ({
    ...item,
    likes: Array.isArray(item.likes) ? item.likes : [],
    favorites: Array.isArray(item.favorites) ? item.favorites : [],
    comments: Array.isArray(item.comments) ? item.comments.map(normalizeWallComment) : []
  }));
}

const replyInputStyle = {
  flex: 1,
  padding: "9px 12px",
  borderRadius: 999,
  border: "1px solid #e7cdb4",
  background: "#fffaf6",
  color: "#5b3924",
  fontSize: 12,
  outline: "none",
  boxShadow: "inset 0 1px 3px rgba(80, 48, 26, 0.06)"
};

const replySendButtonStyle = {
  border: "none",
  borderRadius: 999,
  padding: "8px 14px",
  background: "linear-gradient(135deg, #8a5633, #c4865c)",
  color: "#fff",
  fontWeight: 800,
  fontSize: 12,
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(120, 72, 36, 0.18)",
  whiteSpace: "nowrap"
};

const replyHintButtonStyle = {
  marginTop: 8,
  border: "none",
  borderRadius: 999,
  background: "linear-gradient(135deg, #fff3e8, #f1dcc8)",
  color: "#8a5633",
  fontWeight: 800,
  cursor: "default",
  padding: "6px 10px",
  fontSize: 12,
  boxShadow: "0 4px 10px rgba(120, 72, 36, 0.1)"
};

function downloadImage(dataUrl, filename) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

async function captureElement(element, scale = 1.2, format = "jpg") {
  if (!element) return null;

  const canvas = await html2canvas(element, {
    scale: scale,
    backgroundColor: null,
    useCORS: true
  });

  if (format === "jpg") {
    return canvas.toDataURL("image/jpeg", 0.68);
  }

  return canvas.toDataURL("image/png");
}

function AuthPage({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [gmail, setGmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("I love creating postcards and photo strips.");
  const [avatar, setAvatar] = useState("🌷");

  const avatarOptions = ["🌷", "🌙", "⭐", "📮", "🎀", "🍍", "🐻", "🧸"];

  const register = () => {
    if (!gmail.includes("@gmail.com")) {
      alert("請輸入 Gmail，例如：example@gmail.com");
      return;
    }

    if (!nickname.trim()) {
      alert("請輸入暱稱！");
      return;
    }

    const users = getList(STORAGE_KEYS.users);
    const existed = users.find((user) => user.gmail === gmail);

    if (existed) {
      alert("這個 Gmail 已經註冊過了，可以直接登入。");
      return;
    }

    const newUser = {
      id: makeId(),
      gmail,
      nickname,
      bio,
      avatar,
      joinedAt: new Date().toLocaleString()
    };

    const nextUsers = [newUser, ...users];

    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(nextUsers));
    localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(newUser));

    onLogin(newUser);
  };

  const login = () => {
    if (!gmail.includes("@gmail.com")) {
      alert("請輸入 Gmail，例如：example@gmail.com");
      return;
    }

    const users = getList(STORAGE_KEYS.users);
    const user = users.find((item) => item.gmail === gmail);

    if (!user) {
      alert("找不到這個帳號，請先註冊。");
      return;
    }

    localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(user));
    onLogin(user);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">📮</div>
          <h1>Stamp Studio</h1>
          <p>Login to save, share, like, and comment on creative works.</p>
        </div>

        <div className="auth-tabs">
          <button
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            Login
          </button>

          <button
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
          >
            Register
          </button>
        </div>

        <div className="auth-form">
          <label>Gmail</label>
          <input
            type="email"
            value={gmail}
            onChange={(e) => setGmail(e.target.value)}
            placeholder="example@gmail.com"
          />

          {mode === "register" && (
            <>
              <label>Nickname</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Your display name"
              />

              <label>Profile Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />

              <label>Avatar</label>
              <div className="avatar-picker">
                {avatarOptions.map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={avatar === item ? "active" : ""}
                    onClick={() => setAvatar(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </>
          )}

          {mode === "login" ? (
            <button className="auth-main-btn" onClick={login}>
              Login with Gmail
            </button>
          ) : (
            <button className="auth-main-btn" onClick={register}>
              Create Account
            </button>
          )}
        </div>

        <p className="auth-note">
          This is a front-end demo login system. Real Google login can be added
          later with Firebase Authentication.
        </p>
      </div>
    </div>
  );
}

function PostcardStudio({ onSaveArtwork }) {
  const postcardRef = useRef(null);

  const [frontReceiver, setFrontReceiver] = useState("To my dear friend");
  const [frontMessage, setFrontMessage] = useState("Wish you were here!");
  const [backMessage, setBackMessage] = useState(
    "Greetings from Stamp Studio! Hope you are having a wonderful day."
  );
  const [backAddress, setBackAddress] = useState(
    "Name: \nAddress: \nCity: \nCountry: "
  );

  const [fontSize, setFontSize] = useState(28);
  const [fontColor, setFontColor] = useState("#5b3924");
  const [fontFamily, setFontFamily] = useState("Georgia");
  const [theme, setTheme] = useState("vintage");

  const [selectedStamp, setSelectedStamp] = useState("LOVE");

  const [frontStamps, setFrontStamps] = useState([]);
  const [backStamps, setBackStamps] = useState([]);

  const [stampPressing, setStampPressing] = useState(false);
  const [draggingTool, setDraggingTool] = useState(false);

  const [toolPosition, setToolPosition] = useState({ x: 0, y: 0 });
  const [toolHome, setToolHome] = useState({ x: 0, y: 0 });

  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const frontFaceRef = useRef(null);
  const backFaceRef = useRef(null);
  const previewAreaRef = useRef(null);

  const [rotationX, setRotationX] = useState(-8);
  const [rotationY, setRotationY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const dragData = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    startRotationX: -8,
    startRotationY: 0
  });

  const themes = {
    vintage: "Vintage",
    pink: "Pink",
    sky: "Sky",
    night: "Night",
    cream: "Cream"
  };

  const stampOptions = ["LOVE", "TRAVEL", "AIR MAIL", "CGU", "2026"];

  const normalizeDeg = (deg) => {
    return ((deg % 360) + 360) % 360;
  };

  const getVisibleSide = () => {
    const normalized = normalizeDeg(rotationY);
    if (normalized > 90 && normalized < 270) return "back";
    return "front";
  };

  const visibleSide = getVisibleSide();

  useEffect(() => {
    const savedData = localStorage.getItem(STORAGE_KEYS.postcardConfig);

    if (savedData) {
      const data = JSON.parse(savedData);

      setFrontReceiver(data.frontReceiver || "To my dear friend");
      setFrontMessage(data.frontMessage || "Wish you were here!");
      setBackMessage(
        data.backMessage ||
          "Greetings from Stamp Studio! Hope you are having a wonderful day."
      );
      setBackAddress(
        data.backAddress || "Name: \nAddress: \nCity: \nCountry: "
      );
      setFontSize(data.fontSize || 28);
      setFontColor(data.fontColor || "#5b3924");
      setFontFamily(data.fontFamily || "Georgia");
      setTheme(data.theme || "vintage");
      setSelectedStamp(data.selectedStamp || "LOVE");
      setFrontStamps(data.frontStamps || []);
      setBackStamps(data.backStamps || []);
      setRotationX(data.rotationX ?? -8);
      setRotationY(data.rotationY ?? 0);
    }
  }, []);

  const getPostcardData = () => {
    return {
      frontReceiver,
      frontMessage,
      backMessage,
      backAddress,
      fontSize,
      fontColor,
      fontFamily,
      theme,
      selectedStamp,
      frontStamps,
      backStamps,
      rotationX,
      rotationY
    };
  };

  const saveToStorage = async () => {
    try {
      const config = getPostcardData();
      localStorage.setItem(STORAGE_KEYS.postcardConfig, JSON.stringify(config));

      const oldRotationX = rotationX;
      const oldRotationY = rotationY;

      setRotationX(-8);
      setRotationY(0);

      setTimeout(async () => {
        try {
          const image = await captureElement(postcardRef.current, 1.15, "jpg");

          setRotationX(oldRotationX);
          setRotationY(oldRotationY);

          if (!image) {
            alert("儲存失敗：沒有抓到明信片畫面。");
            return;
          }

          const item = {
            id: makeId(),
            type: "postcard",
            title: frontReceiver || "Untitled Postcard",
            subtitle: frontMessage.slice(0, 45),
            createdAt: new Date().toLocaleString(),
            image,
            data: config
          };

          const ok = await onSaveArtwork("postcard", item);
          if (ok) alert("明信片已成功存到 My Storage！");
        } catch (error) {
          console.error(error);
          setRotationX(oldRotationX);
          setRotationY(oldRotationY);
          alert("儲存失敗：請先按 Reset Local Demo Data 清除舊的大圖資料。");
        }
      }, 180);
    } catch (error) {
      console.error(error);
      alert("儲存失敗：請先按 Reset Local Demo Data 清除舊的大圖資料。");
    }
  };

  const clearDesign = () => {
    localStorage.removeItem(STORAGE_KEYS.postcardConfig);

    setFrontReceiver("To my dear friend");
    setFrontMessage("Wish you were here!");
    setBackMessage(
      "Greetings from Stamp Studio! Hope you are having a wonderful day."
    );
    setBackAddress("Name: \nAddress: \nCity: \nCountry: ");
    setFontSize(28);
    setFontColor("#5b3924");
    setFontFamily("Georgia");
    setTheme("vintage");
    setSelectedStamp("LOVE");
    setFrontStamps([]);
    setBackStamps([]);
    setRotationX(-8);
    setRotationY(0);

    alert("已清除明信片內容！");
  };


  const handleMouseDown = (e) => {
    dragData.current.dragging = true;
    dragData.current.startX = e.clientX;
    dragData.current.startY = e.clientY;
    dragData.current.startRotationX = rotationX;
    dragData.current.startRotationY = rotationY;
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!dragData.current.dragging) return;

    const dx = e.clientX - dragData.current.startX;
    const dy = e.clientY - dragData.current.startY;

    const newRotationY = dragData.current.startRotationY + dx * 0.7;
    let newRotationX = dragData.current.startRotationX - dy * 0.25;

    if (newRotationX > 25) newRotationX = 25;
    if (newRotationX < -25) newRotationX = -25;

    setRotationY(newRotationY);
    setRotationX(newRotationX);
  };

  const handleMouseUp = () => {
    dragData.current.dragging = false;
    setIsDragging(false);
  };

  const showFront = () => {
    setRotationX(-8);
    setRotationY(0);
  };

  const showBack = () => {
    setRotationX(-8);
    setRotationY(180);
  };

  const resetView = () => {
    setRotationX(-8);
    setRotationY(0);
  };

  const downloadPostcard = async () => {
    const image = await captureElement(postcardRef.current);
    if (!image) return;
    downloadImage(image, "postcard-3d.png");
  };
const resetToolPosition = () => {
  setToolPosition(toolHome);
};

useEffect(() => {
  const timer = setTimeout(() => {
    if (previewAreaRef.current) {
      const rect = previewAreaRef.current.getBoundingClientRect();
      const home = {
        x: rect.width - 150,
        y: 120
      };

      setToolHome(home);
      setToolPosition(home);
    }
  }, 100);

  return () => clearTimeout(timer);
}, []);

const startDraggingTool = (e) => {
  e.stopPropagation();
  e.preventDefault();

  if (!previewAreaRef.current) return;

  setDraggingTool(true);
  dragData.current.dragging = false;
  setIsDragging(false);

  const rect = previewAreaRef.current.getBoundingClientRect();

  dragOffsetRef.current = {
    x: e.clientX - rect.left - toolPosition.x,
    y: e.clientY - rect.top - toolPosition.y
  };
};

const handleToolPointerMove = (e) => {
  if (!draggingTool || !previewAreaRef.current) return;

  const rect = previewAreaRef.current.getBoundingClientRect();

  const newX = e.clientX - rect.left - dragOffsetRef.current.x;
  const newY = e.clientY - rect.top - dragOffsetRef.current.y;

  setToolPosition({
    x: newX,
    y: newY
  });
};

const placeStampAtPointer = (clientX, clientY) => {
  const targetRef = visibleSide === "front" ? frontFaceRef : backFaceRef;
  if (!targetRef.current) return false;

  const rect = targetRef.current.getBoundingClientRect();

  const inside =
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom;

  if (!inside) return false;

  const x = clientX - rect.left;
  const y = clientY - rect.top;

  const newStamp = {
    id: makeId(),
    x,
    y,
    text: selectedStamp,
    rotation: Math.floor(Math.random() * 24 - 12),
    scale: 1
  };

  if (visibleSide === "front") {
    setFrontStamps((prev) => [...prev, newStamp]);
  } else {
    setBackStamps((prev) => [...prev, newStamp]);
  }

  return true;
};

const finishDraggingTool = (e) => {
  if (!draggingTool) return;

  setDraggingTool(false);
  setStampPressing(true);

  placeStampAtPointer(e.clientX, e.clientY);

  setTimeout(() => {
    setStampPressing(false);
    resetToolPosition();
  }, 220);
};

useEffect(() => {
  window.addEventListener("pointermove", handleToolPointerMove);
  window.addEventListener("pointerup", finishDraggingTool);

  return () => {
    window.removeEventListener("pointermove", handleToolPointerMove);
    window.removeEventListener("pointerup", finishDraggingTool);
  };
}, [draggingTool, visibleSide, selectedStamp, toolHome]);

  return (
    <div className="studio-layout">
      <section className="control-panel">
        <h2>Postcard Studio</h2>

        <div className="tool-group">
          <label>Front Receiver</label>
          <input
            type="text"
            value={frontReceiver}
            onChange={(e) => setFrontReceiver(e.target.value)}
          />
        </div>

        <div className="tool-group">
          <label>Front Message</label>
          <textarea
            value={frontMessage}
            onChange={(e) => setFrontMessage(e.target.value)}
          />
        </div>

        <div className="tool-group">
          <label>Back Message</label>
          <textarea
            value={backMessage}
            onChange={(e) => setBackMessage(e.target.value)}
          />
        </div>

        <div className="tool-group">
          <label>Back Address</label>
          <textarea
            value={backAddress}
            onChange={(e) => setBackAddress(e.target.value)}
          />
        </div>

        <div className="tool-row">
          <div className="tool-group">
            <label>Font Size</label>
            <input
              type="range"
              min="18"
              max="42"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
            />
          </div>

          <div className="tool-group">
            <label>Color</label>
            <input
              className="color-input"
              type="color"
              value={fontColor}
              onChange={(e) => setFontColor(e.target.value)}
            />
          </div>
        </div>

        <div className="tool-group">
          <label>Font Style</label>
          <select
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
          >
            <option value="Georgia">Georgia</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Courier New">Courier New</option>
            <option value="Trebuchet MS">Trebuchet MS</option>
            <option value="Comic Sans MS">Comic Sans MS</option>
          </select>
        </div>

        <div className="tool-group">
          <label>Theme</label>
          <div className="theme-buttons">
            {Object.keys(themes).map((item) => (
              <button
                key={item}
                className={theme === item ? "active" : ""}
                onClick={() => setTheme(item)}
              >
                {themes[item]}
              </button>
            ))}
          </div>
        </div>

        <div className="tool-group">
          <label>Stamp Text</label>
          <div className="stamp-buttons">
            {stampOptions.map((item) => (
              <button
                key={item}
                className={selectedStamp === item ? "active" : ""}
                onClick={() => setSelectedStamp(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="tool-group">
          <label>Current Visible Side</label>
          <div className="side-badge">
            {visibleSide === "front" ? "Front Side" : "Back Side"}
          </div>
        </div>

        <div className="action-buttons">
          <button onClick={saveToStorage}>Save to My Storage</button>
          <button onClick={downloadPostcard}>Download to Local</button>
          <button className="clear-btn" onClick={clearDesign}>
            Clear
          </button>
        </div>
      </section>

      <section className="preview-area">
        <div className="mini-toolbar">
          <button onClick={showFront}>Front</button>
          <button onClick={showBack}>Back</button>
          <button onClick={resetView}>Reset View</button>
        </div>

        <div
          ref={previewAreaRef}
          className={`scene ${isDragging ? "dragging" : ""}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div
            className={`stamp-tool floating-stamp-tool ${stampPressing ? "pressing" : ""} ${draggingTool ? "dragging-tool" : ""}`}
            style={{
              left: `${toolPosition.x}px`,
              top: `${toolPosition.y}px`
            }}
            onPointerDown={startDraggingTool}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="stamp-handle"></div>
            <div className="stamp-head">
              <span>{selectedStamp}</span>
            </div>
          </div>

          <div
            ref={postcardRef}
            className="postcard-wrapper"
            style={{
              transform: `rotateX(${rotationX}deg) rotateY(${rotationY}deg)`
            }}
          >
            <div ref={frontFaceRef} className={`postcard postcard-front ${theme}`}>
              <div className="paper-texture"></div>
              <div className="postcard-title">POST CARD</div>
              <div className="receiver-text">{frontReceiver}</div>

              <div
                className="main-message"
                style={{
                  fontSize: `${fontSize}px`,
                  color: fontColor,
                  fontFamily: fontFamily
                }}
              >
                {frontMessage}
              </div>

              <div className="front-small-star">✦</div>

              <div className="postcard-lines">
                <span></span>
                <span></span>
                <span></span>
              </div>

              {frontStamps.map((stamp) => (
                <div
                  key={stamp.id}
                  className="placed-stamp-mark"
                  style={{
                    left: `${stamp.x}px`,
                    top: `${stamp.y}px`,
                    transform: `translate(-50%, -50%) rotate(${stamp.rotation}deg) scale(${stamp.scale})`
                  }}
                >
                  <span>{stamp.text}</span>
                </div>
              ))}
            </div>

            <div ref={backFaceRef} className={`postcard postcard-back ${theme}`}>
              <div className="paper-texture"></div>

              <div className="back-left">
                <h3>Message</h3>
                <div
                  className="back-message-text"
                  style={{
                    color: fontColor,
                    fontFamily: fontFamily
                  }}
                >
                  {backMessage}
                </div>
              </div>

              <div className="divider"></div>

              <div className="back-right">
                <div className="stamp-box">STAMP</div>

                <div
                  className="back-address-text"
                  style={{
                    color: fontColor,
                    fontFamily: fontFamily
                  }}
                >
                  {backAddress}
                </div>
              </div>

              {backStamps.map((stamp) => (
                <div
                  key={stamp.id}
                  className="placed-stamp-mark"
                  style={{
                    left: `${stamp.x}px`,
                    top: `${stamp.y}px`,
                    transform: `translate(-50%, -50%) rotate(${stamp.rotation}deg) scale(${stamp.scale})`
                  }}
                >
                  <span>{stamp.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="hint-text">
          Drag the postcard to rotate 360°. Click the 3D stamp to stamp the
          side currently facing you.
        </p>
      </section>
    </div>
  );
}

function PhotoBoothStudio({ onSaveArtwork }) {
  const stripRef = useRef(null);

  const [layoutCount, setLayoutCount] = useState(4);
  const [photoTitle, setPhotoTitle] = useState("PHOTO BOOTH");
  const [photoSubtitle, setPhotoSubtitle] = useState("Best Memory");
  const [photoDate, setPhotoDate] = useState("2026.05.06");
  const [photoTheme, setPhotoTheme] = useState("classic");
  const [photos, setPhotos] = useState([null, null, null, null]);
  const [printing, setPrinting] = useState(false);
  const [printedResult, setPrintedResult] = useState(null);

  const photoThemes = {
    classic: "Classic",
    mono: "Mono",
    pinkbooth: "Pink Booth",
    skybooth: "Sky Booth"
  };

  useEffect(() => {
    const savedData = localStorage.getItem(STORAGE_KEYS.boothConfig);

    if (savedData) {
      const data = JSON.parse(savedData);
      setLayoutCount(data.layoutCount || 4);
      setPhotoTitle(data.photoTitle || "PHOTO BOOTH");
      setPhotoSubtitle(data.photoSubtitle || "Best Memory");
      setPhotoDate(data.photoDate || "2026.05.06");
      setPhotoTheme(data.photoTheme || "classic");
    }
  }, []);

  useEffect(() => {
    setPhotos((prev) =>
      Array.from({ length: layoutCount }, (_, index) => prev[index] || null)
    );
    setPrintedResult(null);
  }, [layoutCount]);

  const getBoothConfig = () => {
    return {
      layoutCount,
      photoTitle,
      photoSubtitle,
      photoDate,
      photoTheme
    };
  };

  const saveConfigOnly = () => {
    localStorage.setItem(
      STORAGE_KEYS.boothConfig,
      JSON.stringify(getBoothConfig())
    );
  };

  const clearBooth = () => {
    localStorage.removeItem(STORAGE_KEYS.boothConfig);
    setLayoutCount(4);
    setPhotoTitle("PHOTO BOOTH");
    setPhotoSubtitle("Best Memory");
    setPhotoDate("2026.05.06");
    setPhotoTheme("classic");
    setPhotos([null, null, null, null]);
    setPrinting(false);
    setPrintedResult(null);
    alert("已清除拍貼機內容！");
  };

  const handlePhotoUpload = (index, event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      setPhotos((prev) => {
        const next = [...prev];
        next[index] = reader.result;
        return next;
      });
      setPrintedResult(null);
    };

    reader.readAsDataURL(file);
  };

  const removePhoto = (index) => {
    setPhotos((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
    setPrintedResult(null);
  };

  const playPrintAnimation = () => {
    setPrinting(false);

    setTimeout(() => {
      setPrinting(true);
    }, 50);

    setTimeout(() => {
      setPrinting(false);
    }, 1700);
  };

  const makeResultImage = async () => {
    const image = await captureElement(stripRef.current, 1.15, "jpg");
    return image;
  };

  const printAndShowResult = async () => {
    playPrintAnimation();

    setTimeout(async () => {
      const image = await makeResultImage();
      if (image) setPrintedResult(image);
    }, 1750);
  };

  const saveToStorage = async () => {
    try {
      saveConfigOnly();

      const image = await makeResultImage();
      if (!image) {
        alert("儲存失敗：沒有抓到拍貼結果。");
        return;
      }

      setPrintedResult(image);

      const item = {
        id: makeId(),
        type: "photobooth",
        title: photoTitle || "Untitled Photo Strip",
        subtitle: `${layoutCount}-Cut · ${photoSubtitle}`,
        createdAt: new Date().toLocaleString(),
        image,
        data: getBoothConfig()
      };

      const ok = await onSaveArtwork("photobooth", item);
      if (ok) alert("拍貼作品已成功存到 My Storage！");
    } catch (error) {
      console.error(error);
      alert("儲存失敗：請先按 Reset Local Demo Data 清除舊的大圖資料。");
    }
  };

  const downloadStrip = async () => {
    const image = await makeResultImage();
    if (!image) return;

    setPrintedResult(image);
    downloadImage(image, `photo-strip-${layoutCount}cut.png`);
  };

  return (
    <div className="studio-layout">
      <section className="control-panel">
        <h2>Photo Booth Studio</h2>

        <div className="tool-group">
          <label>Layout</label>
          <div className="layout-buttons">
            <button
              className={layoutCount === 3 ? "active" : ""}
              onClick={() => setLayoutCount(3)}
            >
              3-Cut
            </button>
            <button
              className={layoutCount === 4 ? "active" : ""}
              onClick={() => setLayoutCount(4)}
            >
              4-Cut
            </button>
          </div>
        </div>

        <div className="tool-group">
          <label>Strip Title</label>
          <input
            type="text"
            value={photoTitle}
            onChange={(e) => setPhotoTitle(e.target.value)}
          />
        </div>

        <div className="tool-group">
          <label>Subtitle</label>
          <input
            type="text"
            value={photoSubtitle}
            onChange={(e) => setPhotoSubtitle(e.target.value)}
          />
        </div>

        <div className="tool-group">
          <label>Date Text</label>
          <input
            type="text"
            value={photoDate}
            onChange={(e) => setPhotoDate(e.target.value)}
          />
        </div>

        <div className="tool-group">
          <label>Theme</label>
          <div className="theme-buttons">
            {Object.keys(photoThemes).map((item) => (
              <button
                key={item}
                className={photoTheme === item ? "active" : ""}
                onClick={() => setPhotoTheme(item)}
              >
                {photoThemes[item]}
              </button>
            ))}
          </div>
        </div>

        <div className="tool-group">
          <label>Upload Photos</label>

          <div className="upload-list">
            {Array.from({ length: layoutCount }).map((_, index) => (
              <div key={index} className="upload-card">
                <div className="upload-card-top">
                  <span>Photo {index + 1}</span>
                  {photos[index] && (
                    <button
                      className="remove-photo-btn"
                      onClick={() => removePhoto(index)}
                    >
                      Remove
                    </button>
                  )}
                </div>

                <label className="upload-btn">
                  Upload Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload(index, e)}
                  />
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="action-buttons">
          <button onClick={saveToStorage}>Save to My Storage</button>
          <button onClick={printAndShowResult}>Print Preview</button>
          <button onClick={downloadStrip}>Download to Local</button>
          <button className="clear-btn" onClick={clearBooth}>
            Clear
          </button>
        </div>
      </section>

      <section className="preview-area">
        <div className="photo-booth-preview">
          <div className="booth-machine">
            <div className="machine-top">
              <div className="machine-dot"></div>
              <div className="machine-title">MINI PHOTO BOOTH</div>
              <div className="machine-slot"></div>
            </div>

            <div className="machine-output-window">
              <div className={`strip-motion ${printing ? "printing" : ""}`}>
                <div
                  ref={stripRef}
                  className={`photo-strip ${photoTheme} layout-${layoutCount}`}
                >
                  <div className="photo-strip-header">
                    <div className="strip-main-title">{photoTitle}</div>
                    <div className="strip-sub-title">{photoSubtitle}</div>
                  </div>

                  <div className="strip-date">{photoDate}</div>

                  <div className="photo-frame-list">
                    {Array.from({ length: layoutCount }).map((_, index) => (
                      <div key={index} className="photo-frame">
                        {photos[index] ? (
                          <img
                            src={photos[index]}
                            alt={`uploaded-${index + 1}`}
                            className="photo-frame-img"
                          />
                        ) : (
                          <div className="photo-placeholder">
                            <span>Upload</span>
                            <small>Photo {index + 1}</small>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="strip-footer">
                    <span>STAMP STUDIO</span>
                    <span>{layoutCount}-CUT FILM</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="booth-button-area">
              <button className="big-print-btn" onClick={printAndShowResult}>
                Print Photo Strip
              </button>

              <button className="big-download-btn" onClick={downloadStrip}>
                Download PNG
              </button>
            </div>
          </div>
        </div>

        <div className="result-panel">
          <h3>Printed Result Preview</h3>

          {printedResult ? (
            <div className="printed-result-box">
              <img src={printedResult} alt="printed result" />
              <p>這是輸出的拍貼結果，可以下載或存到 My Storage。</p>
            </div>
          ) : (
            <div className="empty-result">
              還沒有輸出結果，請先按 Print Photo Strip。
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function MyStoragePage({ refreshKey, currentUser, onShareToWall }) {
  const [postcards, setPostcards] = useState([]);
  const [photoBooths, setPhotoBooths] = useState([]);
  const [scrapbooks, setScrapbooks] = useState([]);
  const [filter, setFilter] = useState("all");
  const [sharePreviewItem, setSharePreviewItem] = useState(null);
  const [sharePreviewCaption, setSharePreviewCaption] = useState("");

  const loadStorage = async () => {
    const myPostcards = getList(STORAGE_KEYS.postcards).filter(
      (item) => !item.ownerGmail || item.ownerGmail === currentUser.gmail
    );

    const myPhotoBooths = getList(STORAGE_KEYS.photoBooths).filter(
      (item) => !item.ownerGmail || item.ownerGmail === currentUser.gmail
    );

    const myScrapbooks = getList(STORAGE_KEYS.scrapbooks).filter(
      (item) => !item.ownerGmail || item.ownerGmail === currentUser.gmail
    );

    setPostcards(await attachImages(myPostcards));
    setPhotoBooths(await attachImages(myPhotoBooths));
    setScrapbooks(await attachImages(myScrapbooks));
  };

  useEffect(() => {
    loadStorage();
  }, [refreshKey]);

  const deleteItem = async (type, id) => {
    const keyMap = { postcard: STORAGE_KEYS.postcards, photobooth: STORAGE_KEYS.photoBooths, scrapbook: STORAGE_KEYS.scrapbooks };
    const setterMap = { postcard: setPostcards, photobooth: setPhotoBooths, scrapbook: setScrapbooks };
    const maxMap = { postcard: MAX_POSTCARDS, photobooth: MAX_PHOTOBOOTHS, scrapbook: MAX_SCRAPBOOKS };
    const key = keyMap[type];
    const setter = setterMap[type];
    if (!key || !setter) return;
    const all = getList(key);
    const target = all.find((item) => item.id === id);
    const nextAll = all.filter((item) => item.id !== id);
    if (target?.imageKey) await deleteImageFromDB(target.imageKey);
    setter((prev) => prev.filter((item) => item.id !== id));
    saveList(key, nextAll, maxMap[type]);
  };

  const clearType = async (type) => {
    const keyMap = { postcard: STORAGE_KEYS.postcards, photobooth: STORAGE_KEYS.photoBooths, scrapbook: STORAGE_KEYS.scrapbooks };
    const setterMap = { postcard: setPostcards, photobooth: setPhotoBooths, scrapbook: setScrapbooks };
    const key = keyMap[type];
    const setter = setterMap[type];
    if (!key || !setter) return;
    const all = getList(key);
    const mine = all.filter((item) => item.ownerGmail === currentUser.gmail || !item.ownerGmail);
    const next = all.filter((item) => item.ownerGmail && item.ownerGmail !== currentUser.gmail);
    await Promise.all(mine.map((item) => deleteImageFromDB(item.imageKey)));
    localStorage.setItem(key, JSON.stringify(next));
    setter([]);
  };

  const items =
    filter === "postcard"
      ? postcards
      : filter === "photobooth"
        ? photoBooths
        : filter === "scrapbook"
          ? scrapbooks
          : [...postcards, ...photoBooths, ...scrapbooks].sort(
              (a, b) => Number(String(b.id).split("-")[0]) - Number(String(a.id).split("-")[0])
            );

  return (
    <div className="page-card">
      <div className="profile-storage-card">
        <div className="profile-avatar" style={{ overflow: "hidden", display: "grid", placeItems: "center" }}>
          {currentUser.avatar && (currentUser.avatar.startsWith("data:image") || currentUser.avatar.startsWith("blob:")) ? (
            <img src={currentUser.avatar} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
          ) : (
            currentUser.avatar || "🌷"
          )}
        </div>
        <div>
          <h3>{currentUser.nickname}</h3>
          <p>{currentUser.bio}</p>
          <small>{currentUser.gmail}</small>
        </div>
      </div>

      <div className="page-title-row">
        <div>
          <h2>My Storage</h2>
          <p>
            Postcards: {postcards.length}/{MAX_POSTCARDS} · Photo Strips:{" "}
            {photoBooths.length}/{MAX_PHOTOBOOTHS} · Scrapbooks: {scrapbooks.length}/{MAX_SCRAPBOOKS}
          </p>
        </div>

        <div className="storage-filters">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            className={filter === "postcard" ? "active" : ""}
            onClick={() => setFilter("postcard")}
          >
            Postcards
          </button>
          <button
            className={filter === "photobooth" ? "active" : ""}
            onClick={() => setFilter("photobooth")}
          >
            Photo Booth
          </button>
          <button
            className={filter === "scrapbook" ? "active" : ""}
            onClick={() => setFilter("scrapbook")}
          >
            Scrapbook
          </button>
        </div>
      </div>

      <div className="storage-warning">
        每一類最多儲存 30 個作品，超過後會自動保留最新 30 個。
      </div>

      <div className="storage-actions">
        <button onClick={() => clearType("postcard")}>Clear Postcards</button>
        <button onClick={() => clearType("photobooth")}>
          Clear Photo Booths
        </button>
        <button onClick={() => clearType("scrapbook")}>Clear Scrapbooks</button>
      </div>

      {items.length === 0 ? (
        <div className="empty-storage">
          目前還沒有作品，請先到 Postcard、Booth 或 Scrapbook 按 Save / Store to My Storage。
        </div>
      ) : (
        <div className="storage-grid">
          {items.map((item) => (
            <div className="storage-item" key={item.id}>
              <img src={item.image} alt={item.title} />

              <div className="storage-item-body">
                <div className="item-type">
                  {item.type === "postcard" ? "Postcard" : item.type === "scrapbook" ? "Scrapbook" : "Photo Booth"}
                </div>
                <h3>{item.title}</h3>
                <p>{item.subtitle}</p>
                <small>{item.createdAt}</small>

                <div className="item-actions">
                  <button
                    onClick={() =>
                      downloadImage(
                        item.image,
                        item.type === "postcard"
                          ? "saved-postcard.png"
                          : item.type === "scrapbook"
                            ? "saved-scrapbook.png"
                            : "saved-photo-strip.png"
                      )
                    }
                  >
                    Download
                  </button>

                  <button onClick={() => {
                    setSharePreviewItem(item);
                    setSharePreviewCaption(
                      item.type === "postcard"
                        ? `Shared postcard: ${item.title}`
                        : item.type === "scrapbook"
                          ? `Shared scrapbook: ${item.title}`
                          : `Shared photo strip: ${item.title}`
                    );
                  }}>
                    Share to Wall
                  </button>

                  <button
                    className="danger-btn"
                    onClick={() => deleteItem(item.type, item.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {sharePreviewItem && (
        <div
          className="output-preview-overlay"
          onClick={() => setSharePreviewItem(null)}
        >
          <div
            className="output-preview-modal"
            style={{ maxWidth: 520 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="output-preview-header">
              <div>
                <h3>📮 分享到社交牆</h3>
                <p>預覽並編輯發布文字後再分享</p>
              </div>
              <button
                className="output-close-btn"
                onClick={() => setSharePreviewItem(null)}
              >
                ×
              </button>
            </div>

            {/* 發布者資訊 */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              marginBottom: 16, padding: "10px 14px",
              background: "#f4e5d6", borderRadius: 14
            }}>
              <span style={{ fontSize: 28 }}>{currentUser.avatar}</span>
              <div>
                <div style={{ fontWeight: "bold", color: "#5b3924" }}>
                  {currentUser.nickname}
                </div>
                <div style={{ fontSize: 12, color: "#96755c" }}>
                  {currentUser.gmail}
                </div>
              </div>
            </div>

            {/* 圖片預覽 */}
            <div style={{
              borderRadius: 18, overflow: "hidden",
              marginBottom: 16, background: "#f4e5d6",
              maxHeight: 300, display: "flex",
              alignItems: "center", justifyContent: "center"
            }}>
              <img
                src={sharePreviewItem.image}
                alt={sharePreviewItem.title}
                style={{ width: "100%", maxHeight: 300, objectFit: "contain" }}
              />
            </div>

            {/* 作品資訊 */}
            <div style={{
              padding: "10px 14px", borderRadius: 14,
              background: "#fff7f0", border: "1px solid #e7cfb8",
              marginBottom: 16
            }}>
              <div style={{ fontWeight: "bold", color: "#5b3924", fontSize: 14 }}>
                {sharePreviewItem.type === "postcard" ? "📬 Postcard" : "📷 Photo Booth"}
                {" · "}{sharePreviewItem.title}
              </div>
              <div style={{ fontSize: 12, color: "#96755c", marginTop: 4 }}>
                {sharePreviewItem.createdAt}
              </div>
            </div>

            {/* 編輯發布文字 */}
            <div className="tool-group">
              <label>發布文字</label>
              <textarea
                value={sharePreviewCaption}
                onChange={(e) => setSharePreviewCaption(e.target.value)}
                placeholder="寫點什麼吧..."
                style={{ minHeight: 80 }}
              />
            </div>

            <div className="output-preview-actions">
              <button onClick={async () => {
                await onShareToWall({
                  ...sharePreviewItem,
                  caption: sharePreviewCaption
                });
                setSharePreviewItem(null);
              }}>
                🚀 發布到社交牆
              </button>
              <button
                onClick={() => setSharePreviewItem(null)}
                style={{ background: "#efe0d1", color: "#5b3924" }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WallPostCard({ item, index, currentUser, onLike, onFavorite, onDelete, onEdit, onComment, onOpen }) {
  const [commentInput, setCommentInput] = useState("");
  const [replyInputs, setReplyInputs] = useState({});
  const [replyOpen, setReplyOpen] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [editCaption, setEditCaption] = useState(item.caption);

  const likes = item.likes || [];
  const comments = (item.comments || []).map(normalizeWallComment);
  const favorites = item.favorites || [];
  const commentTotal = comments.reduce((sum, comment) => sum + 1 + ((comment.replies || []).length), 0);
  
  const liked = likes.includes(currentUser.gmail);
  const favorited = favorites.includes(currentUser.gmail);
  const isOwner = item.gmail === currentUser.gmail;

  const sendComment = () => {
    if (!commentInput.trim()) return;
    onComment(item.id, commentInput);
    setCommentInput("");
  };

  const sendReply = (commentId) => {
    const text = (replyInputs[commentId] || "").trim();
    if (!text) return;
    onComment(item.id, text, commentId);
    setReplyInputs((prev) => ({ ...prev, [commentId]: "" }));
    setReplyOpen((prev) => ({ ...prev, [commentId]: false }));
  };

  const handleSaveEdit = () => {
    if (!editCaption.trim()) return;
    onEdit(item.id, editCaption);
    setIsEditing(false);
  };

  return (
    <div className={`pin-card redbook-card pin-size-${(index % 4) + 1}`}>
      <div className="pin-image-wrap">
        <img src={item.image} alt={item.caption} />

        <div className="pin-hover-layer">
          <div className="pin-user">{item.name}</div>
          <div className="pin-caption">{item.caption}</div>
          <div className="pin-time">{item.createdAt}</div>
        </div>
      </div>

      <div className="redbook-body">
        <div className="redbook-user-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="redbook-avatar" style={{ overflow: "hidden", display: "grid", placeItems: "center" }}>
            {item.avatar && (item.avatar.startsWith("data:image") || item.avatar.startsWith("blob:")) ? (
              <img src={item.avatar} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
            ) : (
              item.avatar || "🌷"
            )}
          </span>
            <div>
              <strong>{item.name}</strong>
              <small>{item.gmail}</small>
            </div>
          </div>
          {isOwner && (
            <div className="post-owner-actions" style={{ marginLeft: "auto", display: "flex", gap: "4px" }}>
              <button className="edit-post-btn" onClick={() => { setIsEditing(!isEditing); setEditCaption(item.caption); }}>✏️ 編輯</button>
              <button className="delete-post-btn" onClick={() => { if(confirm("確定要刪除這篇貼文嗎？")) onDelete(item.id); }}>🗑️ 刪除</button>
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="edit-post-box" style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <textarea value={editCaption} onChange={(e) => setEditCaption(e.target.value)} style={{ width: "100%", padding: "6px" }} />
            <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
              <button className="save-edit-btn" onClick={handleSaveEdit}>儲存</button>
              <button className="cancel-edit-btn" onClick={() => setIsEditing(false)}>取消</button>
            </div>
          </div>
        ) : (
          <p className="redbook-caption">{item.caption}</p>
        )}

        <div className="redbook-actions">
          <button className={`like-btn ${liked ? "liked" : ""}`} onClick={() => onLike(item.id)}>
            {liked ? "♥ Liked" : "♡ Like"} · {likes.length}
          </button>
          
          {/* 新增收藏按鈕 */}
          <button className={`favorite-btn ${favorited ? "favorited" : ""}`} onClick={() => onFavorite(item.id)}>
            {favorited ? "★ 已收藏" : "☆ 收藏"} · {favorites.length}
          </button>

          <button className="comment-toggle-btn" onClick={onOpen}>
            💬 {commentTotal} 留言
          </button>
        </div>

        <div className="wall-comment-box">
          <input
            type="text"
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            placeholder="留言給這個作品..."
          />
          <button onClick={sendComment}>Send</button>
        </div>

        {comments.length > 0 && (
          <div className="wall-comment-list">
            {comments.map((comment) => (
              <div className="wall-comment-item" key={comment.id}>
                {/* 💡 修正：加上照片判定機制，防止自訂大頭貼變成網頁純文字亂碼 */}
                <span className="redbook-avatar" style={{ overflow: "hidden", display: "grid", placeItems: "center", width: "24px", height: "24px", minWidth: "24px", fontSize: "14px" }}>
                  {comment.avatar && (comment.avatar.startsWith("data:image") || comment.avatar.startsWith("blob:")) ? (
                    <img src={comment.avatar} alt="comment avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                  ) : (
                    comment.avatar || "🌷"
                  )}
                </span>
                <div>
                  <strong>{comment.name}</strong>
                  <p>{comment.text}</p>
                  <small>{comment.createdAt}</small>

                  {(comment.replies || []).length > 0 && (
                    <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                      {(comment.replies || []).map((reply) => (
                        <div key={reply.id} style={{ display: "flex", gap: 8, padding: "8px 10px", borderRadius: 12, background: "rgba(255,255,255,0.62)", border: "1px solid rgba(123,86,56,0.12)" }}>
                          <span className="redbook-avatar" style={{ overflow: "hidden", display: "grid", placeItems: "center", width: "22px", height: "22px", minWidth: "22px", fontSize: "12px" }}>
                            {reply.avatar && (reply.avatar.startsWith("data:image") || reply.avatar.startsWith("blob:")) ? (
                              <img src={reply.avatar} alt="reply avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                            ) : (
                              reply.avatar || "🌷"
                            )}
                          </span>
                          <div>
                            <strong style={{ fontSize: 12 }}>{reply.name}</strong>
                            <p style={{ margin: "2px 0", fontSize: 13 }}>{reply.text}</p>
                            <small>{reply.createdAt}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    className="reply-toggle-btn"
                    onClick={() => setReplyOpen((prev) => ({ ...prev, [comment.id]: !prev[comment.id] }))}
                    style={replyHintButtonStyle}
                  >
                    ↩ Reply 回覆
                  </button>

                  {(
                    <div className="wall-reply-box" style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <input
                        type="text"
                        value={replyInputs[comment.id] || ""}
                        onChange={(e) => setReplyInputs((prev) => ({ ...prev, [comment.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") sendReply(comment.id);
                        }}
                        placeholder={`回覆 ${comment.name} 的留言...`}
                        style={replyInputStyle}
                      />
                      <button type="button" onClick={() => sendReply(comment.id)} style={replySendButtonStyle}>Send Reply</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CommunityWallPage({ refreshKey, currentUser }) {
  const [gallery, setGallery] = useState([]);
  const [comments, setComments] = useState([]);

  const [savedPostcards, setSavedPostcards] = useState([]);
  const [savedPhotoBooths, setSavedPhotoBooths] = useState([]);

  const [wallCaption, setWallCaption] = useState("");
  const [wallImage, setWallImage] = useState(null);
  const [selectedWorkId, setSelectedWorkId] = useState("");

  const [commentText, setCommentText] = useState("");
  const [generalReplyInputs, setGeneralReplyInputs] = useState({});
  const [generalReplyOpen, setGeneralReplyOpen] = useState({});

  const [shareModalItem, setShareModalItem] = useState(null); 
  const [shareCaption, setShareCaption] = useState("");
  const [openPostId, setOpenPostId] = useState(null); 
  const [modalReplyInputs, setModalReplyInputs] = useState({});
  const [modalReplyOpen, setModalReplyOpen] = useState({});
  
  const [wallFilter, setWallFilter] = useState("all");

  const loadWall = async () => {
    // My Storage 仍然使用本機 localStorage / IndexedDB，因為它是個人作品區。
    // Community Wall 和 Live Comment Board 改由 Firebase 即時同步，不再讀本機 gallery/comments。
    const myPostcards = getList(STORAGE_KEYS.postcards).filter(
      (item) => !item.ownerGmail || item.ownerGmail === currentUser.gmail
    );

    const myPhotoBooths = getList(STORAGE_KEYS.photoBooths).filter(
      (item) => !item.ownerGmail || item.ownerGmail === currentUser.gmail
    );

    setSavedPostcards(await attachImages(myPostcards));
    setSavedPhotoBooths(await attachImages(myPhotoBooths));
  };

  useEffect(() => {
    loadWall();

    const unsubscribeGallery = listenGallery((cloudGallery) => {
      setGallery(normalizeWallGallery(cloudGallery));
    });

    const unsubscribeComments = listenGeneralComments((cloudComments) => {
      setComments(cloudComments.map(normalizeWallComment).slice(0, MAX_COMMENTS));
    });

    return () => {
      unsubscribeGallery();
      unsubscribeComments();
    };
  }, [refreshKey, currentUser.gmail]);

  const savedWorks = [...savedPostcards, ...savedPhotoBooths].sort(
    (a, b) => Number(b.id.split("-")[0]) - Number(a.id.split("-")[0])
  );

  const handleWallImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      setWallImage(reader.result);
      setSelectedWorkId("");
    };

    reader.readAsDataURL(file);
  };

  const chooseSavedWork = (event) => {
    const id = event.target.value;
    setSelectedWorkId(id);

    if (!id) {
      setWallImage(null);
      return;
    }

    const work = savedWorks.find((item) => item.id === id);

    if (work) {
      setWallImage(work.image);

      if (!wallCaption.trim()) {
        setWallCaption(
          work.type === "postcard"
            ? `Shared postcard: ${work.title}`
            : `Shared photo strip: ${work.title}`
        );
      }
    }
  };

  const postToWall = async (image, caption) => {
    if (!image) {
      alert("請先上傳圖片，或從 My Storage 選擇一個作品！");
      return;
    }

    try {
      await addGalleryPost({
        image,
        userId: currentUser.id,
        name: currentUser.nickname,
        gmail: currentUser.gmail,
        avatar: currentUser.avatar,
        caption: caption || "Shared a new work.",
      });

      setWallCaption("");
      setWallImage(null);
      setSelectedWorkId("");
      setShareModalItem(null);
      setShareCaption("");
      setWallFilter("all");
    } catch (error) {
      console.error("Post to Firebase wall failed.", error);
      alert("發布失敗：請確認 Firebase Rules、網路連線，或圖片是否太大。");
    }
  };

  const toggleLike = async (postId) => {
    const target = gallery.find((item) => item.id === postId);
    if (!target) return;

    const likes = target.likes || [];
    const alreadyLiked = likes.includes(currentUser.gmail);

    try {
      if (alreadyLiked) {
        await unlikeGalleryPost(postId, currentUser.gmail);
      } else {
        await likeGalleryPost(postId, currentUser.gmail);
      }
    } catch (error) {
      console.error("Toggle like failed.", error);
      alert("按讚失敗，請稍後再試。");
    }
  };

  const toggleFavorite = async (postId) => {
    const target = gallery.find((item) => item.id === postId);
    if (!target) return;

    const favorites = target.favorites || [];
    const alreadyFavorited = favorites.includes(currentUser.gmail);

    try {
      if (alreadyFavorited) {
        await unfavoriteGalleryPost(postId, currentUser.gmail);
      } else {
        await favoriteGalleryPost(postId, currentUser.gmail);
      }
    } catch (error) {
      console.error("Toggle favorite failed.", error);
      alert("收藏失敗，請稍後再試。");
    }
  };

  const deleteWallPost = async (postId) => {
    try {
      await deleteGalleryPost(postId);
      if (openPostId === postId) setOpenPostId(null);
    } catch (error) {
      console.error("Delete cloud post failed.", error);
      alert("刪除失敗，請稍後再試。");
    }
  };

  const editWallPost = async (postId, newCaption) => {
    try {
      await updateGalleryPost(postId, newCaption);
    } catch (error) {
      console.error("Update cloud post failed.", error);
      alert("編輯失敗，請稍後再試。");
    }
  };

  const addWallComment = async (postId, text, parentCommentId = null) => {
    const cleanText = String(text || "").trim();
    if (!cleanText) return;

    const targetPost = gallery.find((item) => item.id === postId);
    if (!targetPost) return;

    const payload = {
      id: makeId(),
      userId: currentUser.id || currentUser.gmail,
      gmail: currentUser.gmail,
      name: currentUser.nickname,
      avatar: currentUser.avatar,
      text: cleanText,
      createdAt: new Date().toLocaleString(),
      replies: []
    };

    try {
      if (!parentCommentId) {
        await addGalleryComment(postId, payload);
        return;
      }

      const addReplyToCommentTree = (comments, parentId, replyPayload) => {
        let found = false;
        const nextComments = comments.map((comment) => {
          const normalized = normalizeWallComment(comment);
          if (String(normalized.id) === String(parentId)) {
            found = true;
            return {
              ...normalized,
              replies: [...(normalized.replies || []), replyPayload].slice(-30)
            };
          }

          if ((normalized.replies || []).length > 0) {
            const result = addReplyToCommentTree(normalized.replies, parentId, replyPayload);
            if (result.found) {
              found = true;
              return { ...normalized, replies: result.comments };
            }
          }

          return normalized;
        });

        return { comments: nextComments, found };
      };

      const oldComments = (targetPost.comments || []).map(normalizeWallComment);
      const result = addReplyToCommentTree(oldComments, parentCommentId, payload);
      if (!result.found) {
        alert("找不到要回覆的留言，請重新整理後再試一次。");
        return;
      }
      await updateGalleryComments(postId, result.comments);
    } catch (error) {
      console.error("Add wall comment failed.", error);
      alert("留言失敗，請稍後再試。");
    }
  };

  const addGeneralComment = async () => {
    const cleanText = commentText.trim();
    if (!cleanText) {
      alert("請先輸入留言內容！");
      return;
    }

    try {
      await addGeneralCommentToCloud({
        userId: currentUser.id,
        gmail: currentUser.gmail,
        name: currentUser.nickname,
        avatar: currentUser.avatar,
        text: cleanText,
      });

      setCommentText("");
    } catch (error) {
      console.error("Add general comment failed.", error);
      alert("留言失敗，請確認 Firebase Rules 或網路連線。");
    }
  };

  const addGeneralReply = async (commentId, text) => {
    const cleanText = String(text || "").trim();
    if (!cleanText) return;

    const targetComment = comments.find((comment) => String(comment.id) === String(commentId));
    if (!targetComment) return;

    const reply = {
      id: makeId(),
      userId: currentUser.id || currentUser.gmail,
      gmail: currentUser.gmail,
      name: currentUser.nickname,
      avatar: currentUser.avatar,
      text: cleanText,
      createdAt: new Date().toLocaleString(),
      replies: []
    };

    try {
      const normalized = normalizeWallComment(targetComment);
      const nextReplies = [...(normalized.replies || []), reply].slice(-30);
      await updateGeneralCommentReplies(commentId, nextReplies);
      setGeneralReplyInputs((prev) => ({ ...prev, [commentId]: "" }));
      setGeneralReplyOpen((prev) => ({ ...prev, [commentId]: false }));
    } catch (error) {
      console.error("Add general reply failed.", error);
      alert("回覆失敗，請稍後再試。");
    }
  };

  const clearWall = async () => {
    if (!window.confirm("確定要清空所有 Community Wall 作品嗎？")) return;

    try {
      await clearGalleryCloud();
      setOpenPostId(null);
    } catch (error) {
      console.error("Clear cloud wall failed.", error);
      alert("清空失敗，請稍後再試。");
    }
  };

  const clearComments = async () => {
    if (!window.confirm("確定要清空所有留言嗎？")) return;

    try {
      await clearGeneralCommentsCloud();
    } catch (error) {
      console.error("Clear cloud comments failed.", error);
      alert("清空留言失敗，請稍後再試。");
    }
  };

  const filteredGallery = gallery.filter((item) => {
    if (wallFilter === "mine") return item.gmail === currentUser.gmail;
    if (wallFilter === "fav") return (item.favorites || []).includes(currentUser.gmail);
    return true;
  });

  return (
    <div className="community-layout">
      <section className="page-card">
        <div className="page-title-row">
          <div>
            <h2>Community Wall</h2>
            <p>分享作品、按讚、收藏與留言。</p>
          </div>

          <button className="danger-soft-btn" onClick={clearWall}>
            Clear Wall
          </button>
        </div>

        {/* 社交牆篩選切換按鈕組 */}
        <div className="storage-filters" style={{ marginBottom: "16px", display: "flex", gap: "8px" }}>
          <button className={wallFilter === "all" ? "active" : ""} onClick={() => setWallFilter("all")}>全部作品</button>
          <button className={wallFilter === "mine" ? "active" : ""} onClick={() => setWallFilter("mine")}>我發布的</button>
          <button className={wallFilter === "fav" ? "active" : ""} onClick={() => setWallFilter("fav")}>我的收藏 ✨</button>
        </div>

        <div className="wall-form">
          <input
            type="text"
            value={wallCaption}
            onChange={(e) => setWallCaption(e.target.value)}
            placeholder="Write a caption"
          />

          <select value={selectedWorkId} onChange={chooseSavedWork}>
            <option value="">Choose a work from My Storage</option>
            {savedWorks.map((item) => (
              <option key={item.id} value={item.id}>
                {item.type === "postcard" ? "Postcard" : item.type === "scrapbook" ? "Scrapbook" : "Photo Booth"} -{" "}
                {item.title}
              </option>
            ))}
          </select>

          <div className="or-divider">or upload another image</div>

          <label className="upload-btn wall-upload-btn">
            Upload Image
            <input
              type="file"
              accept="image/*"
              onChange={handleWallImageUpload}
            />
          </label>

          <button onClick={() => {
            if (!wallImage) {
              alert("請先上傳圖片，或從 My Storage 選擇一個作品！");
              return;
            }
            setShareCaption(wallCaption || "");
            setShareModalItem({ image: wallImage });
          }}>Post to Wall</button>
        </div>

        {wallImage && (
          <div className="wall-preview">
            <img src={wallImage} alt="wall preview" />
            <p>Ready to post as {currentUser.nickname}</p>
          </div>
        )}

        {savedWorks.length === 0 && (
          <div className="storage-warning">
            目前 My Storage 還沒有作品。你可以先到 Postcard Studio 或 Photo
            Booth Studio 按 Save to My Storage，之後就能在這裡直接選作品分享。
          </div>
        )}

        {filteredGallery.length === 0 ? (
          <div className="empty-storage">目前沒有符合篩選條件的作品。</div>
        ) : (
          <div className="pinterest-wall">
            {filteredGallery.map((item, index) => (
              <WallPostCard
                key={item.id}
                item={item}
                index={index}
                currentUser={currentUser}
                onLike={toggleLike}
                onFavorite={toggleFavorite}
                onDelete={deleteWallPost}
                onEdit={editWallPost}
                onComment={addWallComment}
                onOpen={() => setOpenPostId(item.id)}   
              />
            ))}
          </div>
        )}
      </section>

      <section className="page-card comment-board-card">
        <div className="page-title-row">
          <div>
            <h2>Live Comment Board</h2>
            <p>留言區最多保留最新 {MAX_COMMENTS} 則留言。</p>
          </div>

          <button className="danger-soft-btn" onClick={clearComments}>
            Clear Comments
          </button>
        </div>

        <div className="comment-form">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Leave a message..."
          />

          <button onClick={addGeneralComment}>Send Message</button>
        </div>

        {comments.length === 0 ? (
          <div className="empty-storage">目前還沒有留言。</div>
        ) : (
          <div className="comment-list">
            {comments.map((item) => {
              const normalizedItem = normalizeWallComment(item);
              return (
                <div className="comment-item" key={normalizedItem.id}>
                  <div>
                    <strong>
                      {normalizedItem.avatar} {normalizedItem.name}
                    </strong>
                    <small>{normalizedItem.createdAt}</small>
                  </div>
                  <p>{normalizedItem.text}</p>

                  {(normalizedItem.replies || []).length > 0 && (
                    <div style={{ marginTop: 8, display: "grid", gap: 6, paddingLeft: 12, borderLeft: "3px solid #ead7c4" }}>
                      {(normalizedItem.replies || []).map((reply) => (
                        <div key={reply.id} style={{ padding: "8px 10px", borderRadius: 12, background: "rgba(255,255,255,0.68)" }}>
                          <strong style={{ fontSize: 12 }}>{reply.avatar} {reply.name}</strong>
                          <p style={{ margin: "4px 0", fontSize: 13 }}>{reply.text}</p>
                          <small>{reply.createdAt}</small>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    className="reply-toggle-btn"
                    onClick={() => setGeneralReplyOpen((prev) => ({ ...prev, [normalizedItem.id]: !prev[normalizedItem.id] }))}
                    style={replyHintButtonStyle}
                  >
                    ↩ Reply 回覆
                  </button>

                  {(
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <input
                        type="text"
                        value={generalReplyInputs[normalizedItem.id] || ""}
                        placeholder={`回覆 ${normalizedItem.name} 的留言...`}
                        onChange={(e) => setGeneralReplyInputs((prev) => ({ ...prev, [normalizedItem.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addGeneralReply(normalizedItem.id, generalReplyInputs[normalizedItem.id]);
                        }}
                        style={replyInputStyle}
                      />
                      <button type="button" onClick={() => addGeneralReply(normalizedItem.id, generalReplyInputs[normalizedItem.id])} style={replySendButtonStyle}>Send Reply</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
      
      {/* ── 分享預覽 Modal ── */}
      {shareModalItem && (
        <div
          className="output-preview-overlay"
          onClick={() => setShareModalItem(null)}
        >
          <div
            className="output-preview-modal"
            style={{ maxWidth: 520 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="output-preview-header">
              <div>
                <h3>📮 發布到社交牆</h3>
                <p>確認貼文內容後按發布</p>
              </div>
              <button
                className="output-close-btn"
                onClick={() => setShareModalItem(null)}
              >
                ×
              </button>
            </div>

            <div style={{
              borderRadius: 18,
              overflow: "hidden",
              marginBottom: 18,
              background: "#f4e5d6",
              maxHeight: 320,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <img
                src={shareModalItem.image}
                alt="preview"
                style={{ width: "100%", maxHeight: 320, objectFit: "contain" }}
              />
            </div>

            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              marginBottom: 16, padding: "10px 14px",
              background: "#f4e5d6", borderRadius: 14
            }}>
              <span style={{ fontSize: 28 }}>{currentUser.avatar}</span>
              <div>
                <div style={{ fontWeight: "bold", color: "#5b3924" }}>{currentUser.nickname}</div>
                <div style={{ fontSize: 12, color: "#96755c" }}>{currentUser.gmail}</div>
              </div>
            </div>

            <div className="tool-group">
              <label>發布文字</label>
              <textarea
                value={shareCaption}
                onChange={(e) => setShareCaption(e.target.value)}
                placeholder="寫點什麼吧..."
                style={{ minHeight: 80 }}
              />
            </div>

            <div className="output-preview-actions">
              <button onClick={() => postToWall(shareModalItem.image, shareCaption)}>
                🚀 發布
              </button>
              <button
                onClick={() => setShareModalItem(null)}
                style={{ background: "#efe0d1", color: "#5b3924" }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 貼文留言擴展 Modal ── */}
      {openPostId && (() => {
        const post = gallery.find((item) => item.id === openPostId);
        if (!post) return null;
        const likes = post.likes || [];
        const comments = (post.comments || []).map(normalizeWallComment);
        const favorites = post.favorites || [];
        const liked = likes.includes(currentUser.gmail);
        const favorited = favorites.includes(currentUser.gmail);
        const isOwner = post.gmail === currentUser.gmail;

        return (
          <div
            className="output-preview-overlay"
            onClick={() => setOpenPostId(null)}
          >
            <div
              className="output-preview-modal"
              style={{ maxWidth: 680 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="output-preview-header">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: "38px", height: "38px", borderRadius: "50%", background: "#f4e5d6", display: "grid", placeItems: "center", fontTop: "20px", overflow: "hidden" }}>
                  {post.avatar && (post.avatar.startsWith("data:image") || post.avatar.startsWith("blob:")) ? (
                    <img src={post.avatar} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                  ) : (
                    post.avatar || "🌷"
                  )}
                </span>
                  <div>
                    <div style={{ fontWeight: "bold", color: "#5b3924" }}>{post.name}</div>
                    <div style={{ fontSize: 12, color: "#96755c" }}>{post.createdAt}</div>
                  </div>
                </div>
                
                {isOwner && (
                  <button 
                    className="modal-delete-post-btn"
                    onClick={() => { if(confirm("確定要刪除這篇貼文嗎？")) deleteWallPost(post.id); }}
                    style={{ marginLeft: "auto", marginRight: "12px" }}
                  >
                    🗑️ 刪除貼文
                  </button>
                )}
                
                <button
                  className="output-close-btn"
                  onClick={() => setOpenPostId(null)}
                >
                  ×
                </button>
              </div>

              <div style={{
                borderRadius: 18, overflow: "hidden",
                marginBottom: 16, background: "#f4e5d6",
                maxHeight: 360, display: "flex",
                alignItems: "center", justifyContent: "center"
              }}>
                <img
                  src={post.image}
                  alt={post.caption}
                  style={{ width: "100%", maxHeight: 360, objectFit: "contain" }}
                />
              </div>

              <p style={{ margin: "0 0 14px 0", color: "#6b4a36", lineHeight: 1.6, fontSize: 16 }}>
                {post.caption}
              </p>

              <div style={{ marginBottom: 18, display: "flex", gap: "8px" }}>
                <button
                  className={`modal-like-btn ${liked ? "liked" : ""}`}
                  onClick={() => toggleLike(post.id)}
                >
                  {liked ? "♥ Liked" : "♡ Like"} · {likes.length}
                </button>
                
                <button
                  className={`modal-fav-btn ${favorited ? "favorited" : ""}`}
                  onClick={() => toggleFavorite(post.id)}
                >
                  {favorited ? "★ 已收藏" : "☆ 收藏"} · {favorites.length}
                </button>
              </div>

              <div style={{
                maxHeight: 240, overflowY: "auto",
                display: "grid", gap: 10, marginBottom: 16
              }}>
                {comments.length === 0 ? (
                  <div style={{
                    padding: 18, borderRadius: 14,
                    background: "#f4e5d6", color: "#7b5638",
                    textAlign: "center", fontWeight: "bold"
                  }}>
                    還沒有留言，來第一個留言！
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div className="wall-comment-item" key={comment.id}>
                      {/* 💡 修正：加上照片判定機制，防止大頭貼圖片代碼變成網頁亂碼 */}
                      <span className="redbook-avatar" style={{ overflow: "hidden", display: "grid", placeItems: "center", width: "24px", height: "24px", minWidth: "24px", fontSize: "14px" }}>
                        {comment.avatar && (comment.avatar.startsWith("data:image") || comment.avatar.startsWith("blob:")) ? (
                          <img src={comment.avatar} alt="comment avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                        ) : (
                          comment.avatar || "🌷"
                        )}
                      </span>
                      <div>
                        <strong>{comment.name}</strong>
                        <p>{comment.text}</p>
                        <small>{comment.createdAt}</small>

                        {(comment.replies || []).length > 0 && (
                          <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                            {(comment.replies || []).map((reply) => (
                              <div key={reply.id} style={{ display: "flex", gap: 8, padding: "8px 10px", borderRadius: 12, background: "rgba(255,255,255,0.68)", border: "1px solid rgba(123,86,56,0.12)" }}>
                                <span className="redbook-avatar" style={{ overflow: "hidden", display: "grid", placeItems: "center", width: "22px", height: "22px", minWidth: "22px", fontSize: "12px" }}>
                                  {reply.avatar && (reply.avatar.startsWith("data:image") || reply.avatar.startsWith("blob:")) ? (
                                    <img src={reply.avatar} alt="reply avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                                  ) : (
                                    reply.avatar || "🌷"
                                  )}
                                </span>
                                <div>
                                  <strong style={{ fontSize: 12 }}>{reply.name}</strong>
                                  <p style={{ margin: "2px 0", fontSize: 13 }}>{reply.text}</p>
                                  <small>{reply.createdAt}</small>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <button
                          type="button"
                          className="reply-toggle-btn"
                          onClick={() => setModalReplyOpen((prev) => ({ ...prev, [comment.id]: !prev[comment.id] }))}
                          style={replyHintButtonStyle}
                        >
                          ↩ Reply 回覆
                        </button>

                        {(
                          <div className="wall-reply-box" style={{ display: "flex", gap: 6, marginTop: 8 }}>
                            <input
                              type="text"
                              placeholder={`回覆 ${comment.name} 的留言...`}
                              value={modalReplyInputs[comment.id] || ""}
                              onChange={(e) => setModalReplyInputs((prev) => ({ ...prev, [comment.id]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && (modalReplyInputs[comment.id] || "").trim()) {
                                  addWallComment(post.id, modalReplyInputs[comment.id].trim(), comment.id);
                                  setModalReplyInputs((prev) => ({ ...prev, [comment.id]: "" }));
                                  setModalReplyOpen((prev) => ({ ...prev, [comment.id]: false }));
                                }
                              }}
                              style={replyInputStyle}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const text = (modalReplyInputs[comment.id] || "").trim();
                                if (!text) return;
                                addWallComment(post.id, text, comment.id);
                                setModalReplyInputs((prev) => ({ ...prev, [comment.id]: "" }));
                                setModalReplyOpen((prev) => ({ ...prev, [comment.id]: false }));
                              }}
                              style={replySendButtonStyle}
                            >
                              Send Reply
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="wall-comment-box">
                <input
                  type="text"
                  placeholder="留言..."
                  id={`modal-comment-${post.id}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.target.value.trim()) {
                      addWallComment(post.id, e.target.value.trim());
                      e.target.value = "";
                      setOpenPostId((prev) => prev);
                    }
                  }}
                />
                <button onClick={() => {
                  const input = document.getElementById(`modal-comment-${post.id}`);
                  if (!input?.value.trim()) return;
                  addWallComment(post.id, input.value.trim());
                  input.value = "";
                  setOpenPostId((prev) => prev);
                }}>Send</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState("postcard");
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);

  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      try { await migrateStoredImagesToIndexedDB(); } catch (error) { console.warn("Image migration failed.", error); }
      const savedUser = localStorage.getItem(STORAGE_KEYS.currentUser);
      if (savedUser) { 
        const parsedUser = JSON.parse(savedUser);
        if (parsedUser.avatarKey) {
          const customImg = await getImageFromDB(parsedUser.avatarKey);
          if (customImg) parsedUser.avatar = customImg;
        }
        setCurrentUser(parsedUser); 
      }
    };
    init();
  }, [refreshKey]);

  const logout = () => {
    localStorage.removeItem(STORAGE_KEYS.currentUser);
    setCurrentUser(null);
    setActiveTab("postcard");
  };

  const handleAvatarFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      await updateAvatarData(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      setCameraStream(stream);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play()
            .then(() => console.log("相機即時預覽成功！"))
            .catch(err => console.error("播放失敗:", err));
        }
      }, 50);

    } catch (err) {
      alert("無法開啟相機，請確認是否有其他程式（如 Line、Discord）正在佔用鏡頭。");
      console.error(err);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  const captureCameraImage = async () => {
    if (!videoRef.current || !cameraStream) return;
    
    const video = videoRef.current;

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      alert("相機影像還在載入，請看到畫面後再按下快門！");
      return;
    }

    const canvas = document.createElement("canvas");
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;
    
    const ctx = canvas.getContext("2d");
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;

    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    
    stopCamera();
    await updateAvatarData(dataUrl);
  };  

  const updateAvatarData = async (imageDataUrl) => {
    try {
      const avatarKey = `avatar_${currentUser.id}`;
      await saveImageToDB(avatarKey, imageDataUrl);

      const updatedUser = {
        ...currentUser,
        avatarKey: avatarKey,
        avatar: imageDataUrl
      };

      setCurrentUser(updatedUser);
      localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(updatedUser));

      const users = getList(STORAGE_KEYS.users);
      const nextUsers = users.map(u => u.id === currentUser.id ? { ...u, avatarKey: avatarKey } : u);
      localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(nextUsers));

      setAvatarModalOpen(false);
      setRefreshKey(prev => prev + 1);
      alert("頭像修改成功！");
    } catch (error) {
      console.error(error);
      alert("頭像儲存失敗，請重試。");
    }
  };

  const saveArtwork = async (type, item) => {
    try {
      const imageKey = item.imageKey || `art_${item.id}`;
      if (item.image) { await saveImageToDB(imageKey, item.image); }
      const itemWithOwner = {
        ...item, imageKey, ownerId: currentUser?.id, ownerGmail: currentUser?.gmail,
        ownerName: currentUser?.nickname || "Guest", ownerAvatar: currentUser?.avatarKey || currentUser?.avatar || "🌷"
      };
      delete itemWithOwner.image;
      let ok = false;
      if (type === "postcard") {
        const current = getList(STORAGE_KEYS.postcards);
        const next = [itemWithOwner, ...current];
        ok = saveList(STORAGE_KEYS.postcards, next, MAX_POSTCARDS);
      }
      if (type === "photobooth") {
        const current = getList(STORAGE_KEYS.photoBooths);
        const next = [itemWithOwner, ...current];
        ok = saveList(STORAGE_KEYS.photoBooths, next, MAX_PHOTOBOOTHS);
      }
      if (type === "scrapbook") {
        const current = getList(STORAGE_KEYS.scrapbooks);
        const next = [itemWithOwner, ...current];
        ok = saveList(STORAGE_KEYS.scrapbooks, next, MAX_SCRAPBOOKS);
      }
      if (ok) { setRefreshKey((prev) => prev + 1); }
      return ok;
    } catch (error) {
      console.error(error);
      alert("儲存失敗：請按 Reset Local Demo Data 清掉舊資料後再試一次。");
      return false;
    }
  };

  const shareToWall = async (item) => {
    try {
      const imageSource = item.image || (await getImageFromDB(item.imageKey));

      if (!imageSource) {
        alert("分享失敗：找不到作品圖片。");
        return;
      }

      await addGalleryPost({
        image: imageSource,
        userId: currentUser?.id,
        name: currentUser?.nickname || "Guest",
        gmail: currentUser?.gmail || "",
        avatar: currentUser?.avatar || "🌷",
        caption:
          item.caption ||
          (item.type === "postcard"
            ? `Shared postcard: ${item.title}`
            : item.type === "scrapbook"
              ? `Shared scrapbook: ${item.title || "Scrapbook"}`
              : `Shared photo strip: ${item.title}`),
      });

      setRefreshKey((prev) => prev + 1);
      alert("已分享到 Community Wall！");
    } catch (error) {
      console.error("Share to cloud wall failed.", error);
      alert("分享失敗：請確認 Firebase 設定、Firestore Rules 或圖片大小是否過大。");
    }
  };

  const dispatchScrapbookAction = (actionName) => {
    const actions = window.lifeTrackerScrapbookActions;
    if (actions && typeof actions[actionName] === "function") {
      actions[actionName]();
      return;
    }
    window.dispatchEvent(new Event(`life-tracker-scrapbook-${actionName}`));
  };

  const handleIntroStore = () => {
    if (activeTab === "scrapbook") {
      dispatchScrapbookAction("store");
      return;
    }
    if (activeTab === "postcard" || activeTab === "photobooth") {
      const buttons = Array.from(document.querySelectorAll("button"));
      const target = buttons.find((button) => /Save to My Storage|Store to Storage/i.test(button.textContent || ""));
      if (target) {
        target.click();
      } else {
        alert("Open or finish a work first, then press Save to My Storage. / 請先完成作品，再按儲存到作品庫。");
      }
      return;
    }
    alert("This page does not create a new work. / 此頁面不是創作頁，沒有可儲存的新作品。");
  };


  if (!currentUser) { return <AuthPage onLogin={setCurrentUser} />; }

  const pageIntro = {
    postcard: {
      title: "Postcard",
      text: "Create a 3D flip postcard with stamps, messages, address details, and exportable artwork."
    },
    photobooth: {
      title: "Booth",
      text: "Choose upload or camera booth mode to create photo strips and save them to your storage."
    },
    scrapbook: {
      title: "Scrapbook",
      text: "Design a single-page planner with templates, stickers, tape, notes, photos, drawing tools, and shared works."
    },
    storage: {
      title: "My Storage",
      text: "Review saved postcards and booth works, download them, delete them, or share them to the wall."
    },
    community: {
      title: "Community Wall",
      text: "Share your creations, browse classmates’ posts, like, favorite, comment, and reply to comments."
    }
  }[activeTab];

  return (
    <div className="app">
      <style>{lifeTrackerPageStyles}</style>
      <header className="global-header">
        <div>
          <h1>Life Tracker</h1>
          <p>Postcard+Booth+Scrapbook&Share!</p>
        </div>
        <div className="login-profile-box">
          {/* 加上 header-avatar-trigger 和 onClick 事件 */}
          <div className="mini-user header-avatar-trigger" onClick={() => setAvatarModalOpen(true)} title="點擊更換頭像" style={{ cursor: "pointer" }}>
            <span className="mini-avatar">
              {currentUser.avatar && (currentUser.avatar.startsWith("data:image") || currentUser.avatar.startsWith("blob:")) ? (
                <img src={currentUser.avatar} alt="avatar" className="header-custom-avatar-img" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                currentUser.avatar || "🌷"
              )}
            </span>
            <div>
              <strong>{currentUser.nickname} </strong>
              <small>{currentUser.gmail}</small>
            </div>
          </div>
          <button className="reset-data-btn" onClick={resetLocalDemoData}>
            Reset Local Demo Data
          </button>
          <button className="logout-btn" onClick={logout}>
            Logout
          </button>
        </div>
        <div className="tab-switcher">
          <button className={activeTab === "postcard" ? "active" : ""} onClick={() => setActiveTab("postcard")}>Postcard</button>
          <button className={activeTab === "photobooth" ? "active" : ""} onClick={() => setActiveTab("photobooth")}>Booth</button>
          <button className={activeTab === "scrapbook" ? "active" : ""} onClick={() => setActiveTab("scrapbook")}>Scrapbook</button>
          <button className={activeTab === "storage" ? "active" : ""} onClick={() => setActiveTab("storage")}>My Storage</button>
          <button className={activeTab === "community" ? "active" : ""} onClick={() => setActiveTab("community")}>Community Wall</button>
        </div>
      </header>

      <section className="page-intro-card">
        <div className="page-intro-copy">
          <strong>{pageIntro.title}</strong>
          <span>{pageIntro.text}</span>
        </div>
        {activeTab === "scrapbook" && (
          <div className="intro-action-row">
            <button className="intro-store-btn intro-download-png" onClick={() => dispatchScrapbookAction("download-png")}>Download PNG</button>
            <button className="intro-store-btn intro-download-pdf" onClick={() => dispatchScrapbookAction("download-pdf")}>Download PDF</button>
            <button className="intro-store-btn intro-store-storage" onClick={handleIntroStore}>Store to Storage</button>
            <button className="intro-store-btn intro-share-wall" onClick={() => dispatchScrapbookAction("share")}>Share to Wall</button>
          </div>
        )}
      </section>

      {activeTab === "postcard" && <ThreeDeskPostcard onSaveArtwork={saveArtwork} />}
         {/* ==================== PHOTOBOOTH 分頁開始 ==================== */}
      {activeTab === "photobooth" && (
        <div className="photobooth-tab-container" style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 20px" }}>
          
          {/* 安全初始化子選單狀態變數，確保點擊後能被 React 正常追蹤重新渲染 */}
          {(() => {
            if (window.currentBoothMode === undefined) {
              window.currentBoothMode = "menu";
            }
          })()}

          {/* 如果不在主選單(menu)，就在左上角顯示一個大地色系返回按鈕 */}
          {window.currentBoothMode !== "menu" && (
            <button 
              onClick={() => {
                window.currentBoothMode = "menu";
                setRefreshKey(prev => prev + 1); // 強制 React 刷新畫面回選單
              }}
              style={{
                background: "#6D4328",
                color: "white",
                border: "none",
                padding: "10px 20px",
                borderRadius: "10px",
                cursor: "pointer",
                marginBottom: "20px",
                fontWeight: "bold",
                boxShadow: "0 4px 10px rgba(109,67,40,0.15)",
                fontFamily: "inherit"
              }}
            >
              ⬅ 返回 Booth Choose 選單
            </button>
          )}

          {/* 子路由判斷 A：顯示獨立出來的 Booth Choose 選單畫面 */}
          {window.currentBoothMode === "menu" && (
            <BoothChoose 
              onSelectMode={(mode) => {
                window.currentBoothMode = mode;
                setRefreshKey(prev => prev + 1); // 使用者點選後，切換模式並重新整理
              }} 
            />
          )}

          {/* 子路由判斷 B：進入 3D 上傳機台 */}
          {window.currentBoothMode === "upload" && (
            <UploadBooth onSaveArtwork={saveArtwork} />
          )}

          {/* 子路由判斷 C：進入現場鏡頭拍貼機 */}
          {window.currentBoothMode === "camera" && (
            <CameraBooth onSaveArtwork={saveArtwork} />
          )}

        </div>
      )}
      {/* ==================== PHOTOBOOTH 分頁結束 ==================== */}


      {activeTab === "storage" && <MyStoragePage refreshKey={refreshKey} currentUser={currentUser} onShareToWall={shareToWall} />}
      {activeTab === "community" && <CommunityWallPage refreshKey={refreshKey} currentUser={currentUser} />}
      {activeTab === "scrapbook" && <ScrapbookPlanner currentUser={currentUser} onShareToWall={shareToWall} onSaveArtwork={saveArtwork} />}

      {/* ── 新增：更換頭像專用彈出視窗 (Modal) ── */}
      {avatarModalOpen && (
        <div className="output-preview-overlay" onClick={() => { stopCamera(); setAvatarModalOpen(false); }}>
          <div className="output-preview-modal avatar-change-modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="output-preview-header">
              <div>
                <h3>Change profile picture</h3>
                <p>Change your unique social avatar</p>
              </div>
              <button className="output-close-btn" onClick={() => { stopCamera(); setAvatarModalOpen(false); }}>×</button>
            </div>

            <div className="avatar-modal-body">
              {/* 目前頭像/相機預覽區域 */}
              <div className="avatar-preview-box" style={{ background: "transparent", position: "relative" }}>
                {cameraStream ? (
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="avatar-video-preview" 
                    style={{ 
                      width: "100%", 
                      height: "100%", 
                      objectFit: "cover", 
                      transform: "scaleX(-1)", 
                      background: "black",
                      display: "block",
                      position: "absolute",
                      zIndex: 99999
                    }} 
                  />
                ) : (
                  <div className="avatar-current-large">
                    {currentUser.avatar.startsWith("data:image") ? (
                      <img src={currentUser.avatar} alt="current large avatar" />
                    ) : (
                      <span>{currentUser.avatar}</span>
                    )}
                  </div>
                )}
              </div>

              {/* 控制按鈕區 */}
              <div className="avatar-action-row">
                {cameraStream ? (
                  <button className="avatar-shoot-btn" onClick={captureCameraImage}>📸 </button>
                ) : (
                  <button className="avatar-camera-on-btn" onClick={startCamera}>📹 camera</button>
                )}
              </div>

              <div className="avatar-modal-divider">或</div>

              <div className="avatar-upload-field">
                <label className="upload-btn avatar-file-label">
                  📁 upload image
                  <input type="file" accept="image/*" onChange={handleAvatarFileUpload} style={{ display: "none" }} />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


const lifeTrackerPageStyles = `
  body { overflow-x: hidden; }
  .app { overflow-x: hidden; }
  .page-intro-card {
    max-width: 1280px;
    margin: 18px auto 22px;
    padding: 16px 22px;
    border-radius: 24px;
    border: 1px solid rgba(140, 104, 72, 0.18);
    background: linear-gradient(135deg, rgba(255,255,255,.92), rgba(255,246,232,.84));
    box-shadow: 0 16px 36px rgba(83, 55, 35, .08);
    display: flex;
    align-items: center;
    gap: 16px;
    color: #5c3a26;
  }
  .page-intro-card strong {
    flex: 0 0 auto;
    justify-self: start;
    display: inline-flex;
    width: fit-content;
    max-width: max-content;
    padding: 7px 13px;
    border-radius: 999px;
    background: #6d4328;
    color: #fffdf8;
    letter-spacing: .03em;
  }
  .page-intro-card span { line-height: 1.55; font-size: .95rem; }
  .page-intro-copy { display: grid; gap: 4px; align-items: start; min-width: 0; }
  .intro-store-btn { border: 0; border-radius: 999px; padding: 10px 16px; background: linear-gradient(135deg, #7d4e32, #bf8052); color: #fff; font-weight: 900; cursor: pointer; box-shadow: 0 10px 22px rgba(94, 57, 35, .16); white-space: nowrap; }
  .intro-store-btn:hover { transform: translateY(-1px); filter: brightness(1.03); }
  @media (max-width: 780px) {
    .page-intro-card { margin: 14px 14px 18px; flex-direction: column; align-items: flex-start; }
  }

  /* Final intro action layout */
  .page-intro-card { align-items: center; gap: 14px; }
  .page-intro-copy strong { display: inline-flex !important; width: fit-content !important; align-self: flex-start; padding: 8px 14px !important; border-radius: 999px !important; }
  .intro-action-row { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; align-items: center; margin-left: auto; }
  .intro-action-row .intro-store-btn { white-space: nowrap; }
  @media (max-width: 760px) { .intro-action-row { justify-content: flex-start; width: 100%; margin-left: 0; } }

  /* Final requested intro fixes: actions only appear on Scrapbook, one row, distinct colors */
  .page-intro-card { justify-content: space-between; }
  .intro-action-row { display: flex !important; flex-wrap: nowrap !important; gap: 10px !important; justify-content: flex-end !important; align-items: center !important; margin-left: auto !important; }
  .intro-store-btn { min-width: 118px; min-height: 42px; padding: 10px 14px !important; font-size: .92rem !important; line-height: 1.1 !important; }
  .intro-download-png { background: linear-gradient(135deg, #8a5633, #c4865c) !important; }
  .intro-download-pdf { background: linear-gradient(135deg, #5263c9, #8e70d4) !important; }
  .intro-store-storage { background: linear-gradient(135deg, #3f7a54, #8bbf7d) !important; }
  .intro-share-wall { background: linear-gradient(135deg, #d66b92, #ff9fb9) !important; }
  @media (max-width: 760px) { .intro-action-row { flex-wrap: wrap !important; justify-content: flex-start !important; } }


  /* Booth and Community width alignment fixes */
  .photobooth-tab-container,
  .community-layout {
    width: min(1280px, calc(100% - 40px)) !important;
    max-width: 1280px !important;
    margin-left: auto !important;
    margin-right: auto !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
    box-sizing: border-box !important;
  }

  .photobooth-tab-container .camera-booth-layout {
    width: 100% !important;
    max-width: 1280px !important;
    margin: 0 auto !important;
    padding: 0 !important;
    box-sizing: border-box !important;
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) minmax(320px, 420px) !important;
    gap: 28px !important;
    align-items: start !important;
    justify-content: stretch !important;
    flex-wrap: nowrap !important;
  }

  .photobooth-tab-container .camera-booth-layout > div:first-child,
  .photobooth-tab-container .camera-booth-layout > div:last-child {
    min-width: 0 !important;
    max-width: none !important;
    width: 100% !important;
    box-sizing: border-box !important;
  }

  .photobooth-tab-container .camera-booth-layout > div:last-child {
    max-width: 420px !important;
    justify-self: end !important;
  }

  .photobooth-tab-container .photo-strip-preview {
    width: 100% !important;
    box-sizing: border-box !important;
  }

  .community-layout {
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 24px !important;
  }

  .community-layout > .page-card,
  .community-layout .comment-board-card {
    width: 100% !important;
    max-width: 1280px !important;
    margin-left: auto !important;
    margin-right: auto !important;
    box-sizing: border-box !important;
  }

  .community-layout .storage-filters {
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    flex-wrap: wrap !important;
  }

  .community-layout .wall-form,
  .community-layout .wall-preview,
  .community-layout .pinterest-wall,
  .community-layout .comment-form,
  .community-layout .comment-list {
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
  }

  .community-layout .wall-form button,
  .community-layout .wall-upload-btn,
  .community-layout .redbook-actions button,
  .community-layout .post-owner-actions button,
  .community-layout .edit-post-box button,
  .community-layout .wall-comment-box button,
  .community-layout .output-preview-actions button,
  .community-layout .modal-like-btn,
  .community-layout .modal-fav-btn,
  .community-layout .modal-delete-post-btn,
  .community-layout .reply-toggle-btn {
    white-space: nowrap !important;
    word-break: keep-all !important;
    line-height: 1.15 !important;
  }

  .community-layout .redbook-actions,
  .community-layout .post-owner-actions {
    flex-wrap: nowrap !important;
    align-items: center !important;
  }

  .community-layout .redbook-actions button {
    flex: 0 0 auto !important;
    min-width: max-content !important;
    padding-left: 12px !important;
    padding-right: 12px !important;
  }

  .community-layout .wall-comment-box {
    display: flex !important;
    flex-wrap: nowrap !important;
    align-items: center !important;
  }

  .community-layout .wall-comment-box input {
    min-width: 0 !important;
  }

  @media (max-width: 1040px) {
    .photobooth-tab-container .camera-booth-layout {
      grid-template-columns: 1fr !important;
    }
    .photobooth-tab-container .camera-booth-layout > div:last-child {
      max-width: 520px !important;
      justify-self: center !important;
    }
  }

  @media (max-width: 760px) {
    .photobooth-tab-container,
    .community-layout {
      width: min(100% - 24px, 1280px) !important;
    }
    .community-layout .redbook-actions,
    .community-layout .post-owner-actions {
      flex-wrap: wrap !important;
    }
  }

`;

export default App;


/* Community Wall button clipping hotfix: keep post/action buttons visible without splitting button text */
const postButtonClipFixStyle = document.createElement("style");
postButtonClipFixStyle.textContent = `
  .community-layout,
  .community-layout * {
    box-sizing: border-box !important;
  }

  .community-layout .page-card,
  .community-layout .comment-board-card,
  .community-layout .wall-form,
  .community-layout .pinterest-wall,
  .community-layout .pin-card,
  .community-layout .redbook-card,
  .community-layout .redbook-body {
    overflow: visible !important;
  }

  .community-layout .wall-form {
    display: grid !important;
    grid-template-columns: minmax(220px, 1fr) minmax(220px, 1fr) auto auto !important;
    align-items: center !important;
    gap: 12px !important;
    padding: 18px !important;
  }

  .community-layout .wall-form input,
  .community-layout .wall-form select {
    min-width: 0 !important;
    width: 100% !important;
  }

  .community-layout .wall-form .or-divider {
    white-space: nowrap !important;
    text-align: center !important;
  }

  .community-layout .wall-form button,
  .community-layout .wall-upload-btn {
    width: auto !important;
    min-width: max-content !important;
    max-width: 100% !important;
    padding: 10px 16px !important;
    line-height: 1.15 !important;
    white-space: nowrap !important;
    overflow: visible !important;
    text-overflow: clip !important;
    flex: 0 0 auto !important;
  }

  .community-layout .redbook-actions,
  .community-layout .post-owner-actions,
  .community-layout .edit-post-box > div,
  .community-layout .output-preview-actions {
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 8px !important;
    overflow: visible !important;
    align-items: center !important;
  }

  .community-layout .redbook-actions button,
  .community-layout .post-owner-actions button,
  .community-layout .edit-post-box button,
  .community-layout .modal-like-btn,
  .community-layout .modal-fav-btn,
  .community-layout .modal-delete-post-btn,
  .community-layout .output-preview-actions button,
  .community-layout .wall-comment-box button,
  .community-layout .wall-reply-box button,
  .community-layout .reply-toggle-btn {
    flex: 0 0 auto !important;
    width: auto !important;
    min-width: max-content !important;
    max-width: 100% !important;
    padding: 8px 12px !important;
    line-height: 1.15 !important;
    white-space: nowrap !important;
    overflow: visible !important;
    text-overflow: clip !important;
    word-break: keep-all !important;
  }

  .community-layout .wall-comment-box,
  .community-layout .wall-reply-box {
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    flex-wrap: nowrap !important;
    max-width: 100% !important;
    overflow: visible !important;
  }

  .community-layout .wall-comment-box input,
  .community-layout .wall-reply-box input {
    min-width: 0 !important;
    flex: 1 1 auto !important;
  }

  @media (max-width: 980px) {
    .community-layout .wall-form {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
    }
    .community-layout .wall-form .or-divider,
    .community-layout .wall-form .wall-upload-btn,
    .community-layout .wall-form button {
      justify-self: start !important;
    }
  }

  @media (max-width: 620px) {
    .community-layout .wall-form {
      grid-template-columns: 1fr !important;
    }
    .community-layout .redbook-actions button,
    .community-layout .post-owner-actions button,
    .community-layout .wall-form button,
    .community-layout .wall-upload-btn {
      font-size: 12px !important;
      padding: 8px 10px !important;
    }
  }
`;
document.head.appendChild(postButtonClipFixStyle);


/* Community Wall final wrap fix: action buttons may wrap to new rows instead of overflowing */
const communityButtonWrapNoOverflowStyle = document.createElement("style");
communityButtonWrapNoOverflowStyle.textContent = `
  .community-layout,
  .community-layout * {
    box-sizing: border-box !important;
  }

  .community-layout .page-card,
  .community-layout .comment-board-card,
  .community-layout .wall-form,
  .community-layout .wall-preview,
  .community-layout .pinterest-wall,
  .community-layout .pin-card,
  .community-layout .redbook-card,
  .community-layout .redbook-body,
  .community-layout .wall-comment-list,
  .community-layout .wall-comment-item {
    max-width: 100% !important;
    min-width: 0 !important;
  }

  .community-layout .wall-form {
    display: flex !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    gap: 12px !important;
    overflow: visible !important;
  }

  .community-layout .wall-form input,
  .community-layout .wall-form select {
    flex: 1 1 230px !important;
    min-width: 170px !important;
    max-width: 100% !important;
  }

  .community-layout .wall-form .or-divider {
    flex: 0 1 auto !important;
    min-width: 0 !important;
    white-space: normal !important;
  }

  .community-layout .wall-form button,
  .community-layout .wall-upload-btn {
    flex: 0 1 auto !important;
    min-width: 116px !important;
    max-width: 100% !important;
    width: auto !important;
    white-space: normal !important;
    overflow: visible !important;
    overflow-wrap: anywhere !important;
    text-overflow: clip !important;
  }

  .community-layout .redbook-user-row {
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 8px !important;
    align-items: center !important;
    min-width: 0 !important;
  }

  .community-layout .post-owner-actions {
    margin-left: 0 !important;
  }

  .community-layout .redbook-actions,
  .community-layout .post-owner-actions,
  .community-layout .edit-post-box > div,
  .community-layout .output-preview-actions,
  .community-layout .modal-action-row {
    display: flex !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    gap: 8px !important;
    max-width: 100% !important;
    min-width: 0 !important;
    overflow: visible !important;
  }

  .community-layout .redbook-actions button,
  .community-layout .post-owner-actions button,
  .community-layout .edit-post-box button,
  .community-layout .modal-like-btn,
  .community-layout .modal-fav-btn,
  .community-layout .modal-delete-post-btn,
  .community-layout .output-preview-actions button,
  .community-layout .wall-comment-box button,
  .community-layout .wall-reply-box button,
  .community-layout .reply-toggle-btn,
  .community-layout .save-edit-btn,
  .community-layout .cancel-edit-btn {
    flex: 0 1 auto !important;
    min-width: 0 !important;
    max-width: 100% !important;
    width: auto !important;
    white-space: normal !important;
    overflow-wrap: anywhere !important;
    word-break: keep-all !important;
    overflow: visible !important;
    text-overflow: clip !important;
    padding: 8px 11px !important;
    line-height: 1.2 !important;
  }

  .community-layout .wall-comment-box,
  .community-layout .wall-reply-box {
    display: flex !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    gap: 8px !important;
    max-width: 100% !important;
    overflow: visible !important;
  }

  .community-layout .wall-comment-box input,
  .community-layout .wall-reply-box input {
    flex: 1 1 160px !important;
    min-width: 130px !important;
    max-width: 100% !important;
  }

  @media (max-width: 720px) {
    .community-layout .wall-form input,
    .community-layout .wall-form select,
    .community-layout .wall-form .or-divider,
    .community-layout .wall-upload-btn,
    .community-layout .wall-form button {
      flex: 1 1 100% !important;
      width: 100% !important;
    }

    .community-layout .redbook-actions button,
    .community-layout .post-owner-actions button,
    .community-layout .edit-post-box button,
    .community-layout .wall-comment-box button,
    .community-layout .wall-reply-box button,
    .community-layout .reply-toggle-btn {
      flex: 1 1 auto !important;
      min-width: 92px !important;
    }
  }
`;
document.head.appendChild(communityButtonWrapNoOverflowStyle);


/* Community Wall hard no-overflow fix: let post buttons wrap inside each card instead of spilling out */
const communityWallHardWrapFixStyle = document.createElement("style");
communityWallHardWrapFixStyle.textContent = `
  .community-layout,
  .community-layout * {
    box-sizing: border-box !important;
  }

  .community-layout .pinterest-wall {
    overflow: visible !important;
  }

  .community-layout .pin-card,
  .community-layout .redbook-card {
    overflow: hidden !important;
    max-width: 100% !important;
    min-width: 0 !important;
  }

  .community-layout .redbook-body,
  .community-layout .redbook-body * {
    max-width: 100% !important;
    min-width: 0 !important;
  }

  .community-layout .redbook-user-row {
    display: flex !important;
    flex-wrap: wrap !important;
    align-items: flex-start !important;
    gap: 8px !important;
    width: 100% !important;
  }

  .community-layout .redbook-user-row > div:first-child {
    flex: 1 1 170px !important;
    min-width: 0 !important;
  }

  .community-layout .redbook-user-row strong,
  .community-layout .redbook-user-row small,
  .community-layout .redbook-caption {
    overflow-wrap: anywhere !important;
    word-break: break-word !important;
  }

  .community-layout .post-owner-actions {
    margin-left: 0 !important;
    flex: 1 1 100% !important;
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 8px !important;
  }

  .community-layout .redbook-actions {
    width: 100% !important;
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 8px !important;
    align-items: stretch !important;
    overflow: hidden !important;
  }

  .community-layout .redbook-actions .comment-toggle-btn {
    grid-column: 1 / -1 !important;
  }

  .community-layout .redbook-actions button,
  .community-layout .post-owner-actions button,
  .community-layout .edit-post-box button,
  .community-layout .modal-like-btn,
  .community-layout .modal-fav-btn,
  .community-layout .modal-delete-post-btn,
  .community-layout .output-preview-actions button,
  .community-layout .save-edit-btn,
  .community-layout .cancel-edit-btn,
  .community-layout .reply-toggle-btn {
    width: 100% !important;
    min-width: 0 !important;
    max-width: 100% !important;
    padding: 8px 10px !important;
    white-space: normal !important;
    overflow-wrap: anywhere !important;
    word-break: break-word !important;
    line-height: 1.25 !important;
    text-align: center !important;
    overflow: hidden !important;
    text-overflow: clip !important;
  }

  .community-layout .wall-comment-box,
  .community-layout .wall-reply-box {
    width: 100% !important;
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) auto !important;
    gap: 8px !important;
    align-items: center !important;
    overflow: hidden !important;
  }

  .community-layout .wall-comment-box input,
  .community-layout .wall-reply-box input {
    width: 100% !important;
    min-width: 0 !important;
  }

  .community-layout .wall-comment-box button,
  .community-layout .wall-reply-box button {
    width: auto !important;
    min-width: 72px !important;
    max-width: 100% !important;
    padding: 8px 10px !important;
    white-space: normal !important;
    overflow-wrap: anywhere !important;
    line-height: 1.2 !important;
  }

  .community-layout .wall-comment-list,
  .community-layout .wall-comment-item {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    overflow: hidden !important;
  }

  .community-layout .wall-comment-item > div {
    min-width: 0 !important;
    max-width: 100% !important;
  }

  .community-layout .wall-comment-item p,
  .community-layout .wall-comment-item small,
  .community-layout .wall-comment-item strong {
    overflow-wrap: anywhere !important;
    word-break: break-word !important;
  }

  @media (max-width: 520px) {
    .community-layout .redbook-actions,
    .community-layout .post-owner-actions {
      grid-template-columns: 1fr !important;
    }
    .community-layout .wall-comment-box,
    .community-layout .wall-reply-box {
      grid-template-columns: 1fr !important;
    }
    .community-layout .wall-comment-box button,
    .community-layout .wall-reply-box button {
      width: 100% !important;
    }
  }
`;
document.head.appendChild(communityWallHardWrapFixStyle);
