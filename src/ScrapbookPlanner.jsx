import { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";

const STORAGE_KEYS = {
  postcards: "stampStudio_savedPostcards",
  photoBooths: "stampStudio_savedPhotoBooths"
};

const IMAGE_DB_NAME = "stampStudioImageDB";
const IMAGE_STORE_NAME = "images";

const CANVAS_W = 800;
const CANVAS_H = 1100;

const stylePresets = {
  vintage: {
    label: "Vintage 復古拼貼",
    canvasBg: "#f8efe2",
    paper: "#fff8ed",
    border: "#c9a27f",
    accent: "#8a5633",
    accent2: "#c48a5a",
    soft: "#ead7c4",
    text: "#4c3223",
    tape: "#c48a5a",
    note: "#fff1b8",
    sticker: "#e8b98f"
  },
  kawaii: {
    label: "Kawaii 流行可愛",
    canvasBg: "#fff0f6",
    paper: "#fffafd",
    border: "#ffb5d0",
    accent: "#e55d9a",
    accent2: "#ff8abd",
    soft: "#ffe0ed",
    text: "#713653",
    tape: "#ffa6c9",
    note: "#fff3a6",
    sticker: "#ffc7dc"
  },
  minimal: {
    label: "Minimal 極簡乾淨",
    canvasBg: "#f4f4f0",
    paper: "#ffffff",
    border: "#d0d0c8",
    accent: "#333333",
    accent2: "#8a8a80",
    soft: "#eeeeea",
    text: "#222222",
    tape: "#d9d9d2",
    note: "#f9f9f0",
    sticker: "#e5e5de"
  },
  botanical: {
    label: "Botanical 植物清新",
    canvasBg: "#edf7ee",
    paper: "#fbfff9",
    border: "#93b58c",
    accent: "#4f7d4a",
    accent2: "#8bbf7d",
    soft: "#dcedd5",
    text: "#2f4c31",
    tape: "#82a96f",
    note: "#f6f4c8",
    sticker: "#c9e6b7"
  },
  modern: {
    label: "Modern 藍紫潮流",
    canvasBg: "#eef2ff",
    paper: "#fbfcff",
    border: "#9aa8e8",
    accent: "#5263c9",
    accent2: "#8e70d4",
    soft: "#e4e8ff",
    text: "#26315f",
    tape: "#6f89e8",
    note: "#e9ddff",
    sticker: "#c8d5ff"
  }
};

const fontOptions = [
  "Trebuchet MS",
  "Georgia",
  "Arial",
  "Times New Roman",
  "Courier New",
  "Comic Sans MS"
];

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getList(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

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

async function attachImages(list) {
  return Promise.all(
    list.map(async (item) => {
      if (item.image) return item;
      const image = await getImageFromDB(item.imageKey);
      return { ...item, image };
    })
  );
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function removeLightBackground(dataUrl, tolerance = 38) {
  const img = await loadImageElement(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const limit = 255 - tolerance;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const isLight = r >= limit && g >= limit && b >= limit;
    const isNearlyNeutral = Math.abs(r - g) < 18 && Math.abs(g - b) < 18 && Math.abs(r - b) < 18;

    if (isLight && isNearlyNeutral) {
      data[i + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

function toDateInputValue(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getWeekdayName(date) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()];
}

function getMonday(date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = (day + 6) % 7;
  copy.setDate(copy.getDate() - diff);
  return copy;
}

function makeMonthlyCells(year, month) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const startBlank = (firstDay + 6) % 7; // Monday first
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];

  for (let i = 0; i < startBlank; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  while (cells.length < 35) cells.push(null);

  return cells;
}

function MonthlyTemplate({ year, month, theme, styleName }) {
  const cells = makeMonthlyCells(Number(year), Number(month));
  const monthName = new Date(Number(year), Number(month) - 1, 1).toLocaleString("en-US", {
    month: "long"
  });

  return (
    <div className={`sp-template sp-monthly-template sp-template-${styleName}`}>
      <div className="sp-template-title">
        <span>{monthName}</span>
        <strong>{year}</strong>
      </div>
      <div className="sp-week-head">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <b key={d}>{d}</b>
        ))}
      </div>
      <div className="sp-calendar-grid">
        {cells.map((day, index) => (
          <div key={`${day || "blank"}-${index}`} className={day ? "" : "sp-blank-day"}>
            {day && <span>{day}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function WeeklyTemplate({ dateValue, styleName }) {
  const start = getMonday(new Date(`${dateValue}T00:00:00`));
  const days = Array.from({ length: 7 }, (_, index) => {
    const d = new Date(start);
    d.setDate(start.getDate() + index);
    return d;
  });

  return (
    <div className={`sp-template sp-weekly-template sp-template-${styleName}`}>
      <div className="sp-template-title">
        <span>Weekly Planner</span>
        <strong>
          {toDateInputValue(days[0])} ~ {toDateInputValue(days[6])}
        </strong>
      </div>
      <div className="sp-weekly-grid">
        {days.map((day) => (
          <div key={day.toISOString()}>
            <h4>{getWeekdayName(day)}</h4>
            <small>
              {day.getMonth() + 1}/{day.getDate()}
            </small>
          </div>
        ))}
      </div>
      <div className="sp-week-bottom">
        <section>
          <h4>Weekly Goals</h4>
        </section>
        <section>
          <h4>Notes</h4>
        </section>
      </div>
    </div>
  );
}

function DailyTemplate({ dateValue, styleName }) {
  const date = new Date(`${dateValue}T00:00:00`);

  return (
    <div className={`sp-template sp-daily-template sp-template-${styleName}`}>
      <div className="sp-template-title">
        <span>Daily Planner</span>
        <strong>
          {date.getFullYear()}/{date.getMonth() + 1}/{date.getDate()} · {getWeekdayName(date)}
        </strong>
      </div>
      <div className="sp-daily-grid">
        <section>
          <h4>Schedule</h4>
          {Array.from({ length: 9 }, (_, index) => (
            <p key={index}>{String(index + 9).padStart(2, "0")}:00</p>
          ))}
        </section>
        <section>
          <h4>To-do List</h4>
        </section>
        <section>
          <h4>Notes</h4>
        </section>
        <section>
          <h4>Mood</h4>
        </section>
      </div>
    </div>
  );
}


function safeHexColor(color, fallback = "#8a6b50") {
  return /^#[0-9a-fA-F]{6}$/.test(color || "") ? color : fallback;
}

function hexToRgb(color, fallback = "#8a6b50") {
  const hex = safeHexColor(color, fallback).replace("#", "");
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16)
  };
}

function colorWithAlpha(color, alpha = 1, fallback = "#8a6b50") {
  if (color === "transparent") return "transparent";
  if (typeof color === "string" && color.startsWith("rgba")) return color;
  const { r, g, b } = hexToRgb(color, fallback);
  const a = Math.max(0, Math.min(1, Number(alpha ?? 1)));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function makeOuterTextShadow(width, color) {
  const w = Math.max(1, Math.min(12, Number(width || 1)));
  const shadows = [];
  for (let x = -w; x <= w; x += 1) {
    for (let y = -w; y <= w; y += 1) {
      if (x === 0 && y === 0) continue;
      if ((x * x + y * y) <= w * w) shadows.push(`${x}px ${y}px 0 ${color}`);
    }
  }
  return shadows.join(", ");
}

function textStrokeStyle(item) {
  if (!item?.textStrokeEnabled) return {};
  const color = colorWithAlpha(item.textStrokeColor || "#ffffff", item.textStrokeOpacity ?? 1, "#ffffff");
  return {
    textShadow: makeOuterTextShadow(item.textStrokeWidth || 1, color)
  };
}

function ColorOpacityField({ label, color, alpha = 1, fallback = "#8a6b50", onColorChange, onAlphaChange }) {
  const safe = safeHexColor(color, fallback);
  const percent = Math.round((alpha ?? 1) * 100);
  return (
    <div className="sp-color-field">
      <div className="sp-color-head">
        <label>{label}</label>
        <span className="sp-color-swatch" style={{ background: colorWithAlpha(safe, alpha, fallback) }} />
      </div>
      <input type="color" value={safe} onChange={(e) => onColorChange(e.target.value)} />
      <label className="sp-mini-label">透明度 {percent}%</label>
      <input
        type="range"
        min="0"
        max="100"
        value={percent}
        onChange={(e) => onAlphaChange(Number(e.target.value) / 100)}
      />
    </div>
  );
}

function brushPathStyle(item) {
  const texture = item.brushTexture || "pen";
  const base = {
    fill: "none",
    stroke: colorWithAlpha(item.color || "#3b2a20", 1, "#3b2a20"),
    strokeWidth: Number(item.strokeWidth || 4),
    strokeLinecap: "round",
    strokeLinejoin: "round",
    opacity: item.opacity ?? 1
  };

  if (texture === "pencil") return { ...base, strokeDasharray: "2 3", strokeLinecap: "butt", opacity: Math.min(0.72, item.opacity ?? 0.72) };
  if (texture === "dashed") return { ...base, strokeDasharray: "12 9", strokeLinecap: "round" };
  if (texture === "marker") return { ...base, strokeWidth: Number(item.strokeWidth || 4) * 1.7, opacity: Math.min(0.75, item.opacity ?? 0.55) };
  if (texture === "highlighter") return { ...base, strokeWidth: Number(item.strokeWidth || 4) * 2.3, opacity: Math.min(0.48, item.opacity ?? 0.35) };
  if (texture === "neon") return { ...base, filter: "drop-shadow(0 0 5px currentColor)", opacity: item.opacity ?? 0.9 };
  return base;
}

function itemHasBorder(item) {
  return item.borderEnabled ?? Number(item.borderWidth || 0) > 0;
}

function itemBorderStyle(item, fallbackRadius = 12) {
  const enabled = itemHasBorder(item);
  return {
    borderColor: colorWithAlpha(item.borderColor || "#8a6b50", item.borderOpacity ?? 1, "#8a6b50"),
    borderWidth: enabled ? Number(item.borderWidth || 1) : 0,
    borderStyle: enabled ? "solid" : "none",
    borderRadius: Number(item.borderRadius ?? fallbackRadius)
  };
}

function parseDateInput(value) {
  const date = new Date(`${value || toDateInputValue(new Date())}T00:00:00`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function startOfWeek(date) {
  return getMonday(date);
}

function formatShort(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

const weekDayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function makeDrawingPath(points = []) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y + 0.1}`;
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function ScrapbookItem({ item, selected, onPointerDown, onResizeDown, onSelect, onCropPointerDown, drawingMode, eraserMode, onEraseObject }) {
  const baseStyle = {
    left: item.x,
    top: item.y,
    width: item.width,
    height: item.height,
    zIndex: item.z || 1,
    opacity: item.opacity ?? 1,
    transform: `rotate(${Number(item.rotation || 0)}deg)`,
    transformOrigin: "center center",
    pointerEvents: drawingMode && !(eraserMode === "object" && item.type === "drawing") ? "none" : "auto"
  };

  return (
    <div
      className={`sp-item ${selected ? "sp-selected" : ""} sp-item-${item.type}`}
      style={baseStyle}
      onPointerDown={(e) => {
        if (eraserMode === "object" && item.type === "drawing") {
          e.preventDefault();
          e.stopPropagation();
          onEraseObject(item.id);
          return;
        }
        onPointerDown(e, item.id);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(item.id);
      }}
    >
      {item.type === "text" && (
        <div
          className="sp-text-box"
          style={{
            color: colorWithAlpha(item.color, item.colorOpacity ?? 1, "#4c3223"),
            background: item.bgColor === "transparent" ? "transparent" : colorWithAlpha(item.bgColor, item.bgOpacity ?? 1, "#ffffff"),
            fontSize: item.fontSize,
            fontFamily: item.fontFamily,
            fontWeight: item.fontWeight || (item.bold ? "700" : "400"),
            ...textStrokeStyle(item),
            ...itemBorderStyle(item, 12)
          }}
        >
          {item.text}
        </div>
      )}

      {item.type === "sticker" && (
        <div
          className={`sp-sticker sp-sticker-${item.shape}`}
          style={{
            backgroundColor: colorWithAlpha(item.color, item.colorOpacity ?? 1, "#ffffff"),
            color: colorWithAlpha(item.textColor, item.textColorOpacity ?? 1, "#4c3223"),
            fontSize: item.fontSize,
            fontFamily: item.fontFamily,
            ...itemBorderStyle(item, item.shape === "circle" ? 999 : item.shape === "pill" ? 999 : 18)
          }}
        >
          {item.shape === "heart" ? "♥" : item.shape === "star" ? "★" : item.text}
        </div>
      )}

      {item.type === "tape" && (
        <div
          className={`sp-tape sp-tape-${item.pattern}`}
          style={{
            backgroundColor: colorWithAlpha(item.color, item.colorOpacity ?? 1, "#ffffff"),
            color: colorWithAlpha(item.textColor, item.textColorOpacity ?? 1, "#4c3223"),
            fontSize: item.fontSize,
            fontFamily: item.fontFamily,
            ...itemBorderStyle(item, 4)
          }}
        >
          {item.text}
        </div>
      )}

      {item.type === "note" && (
        <div
          className={`sp-note sp-note-${item.variant} sp-note-shape-${item.noteShape || "rounded"}`}
          style={{
            backgroundColor: colorWithAlpha(item.color, item.colorOpacity ?? 1, "#ffffff"),
            color: colorWithAlpha(item.textColor, item.textColorOpacity ?? 1, "#4c3223"),
            fontSize: item.fontSize,
            fontFamily: item.fontFamily,
            ...itemBorderStyle(item, 18)
          }}
        >
          <strong>{item.title}</strong>
          <pre>{item.text}</pre>
        </div>
      )}

      {item.type === "polaroid" && (
        <div
          className="sp-polaroid"
          style={{
            background: item.frameColor === "transparent" ? "transparent" : colorWithAlpha(item.frameColor, item.frameOpacity ?? 1, "#fffdf8"),
            ...itemBorderStyle(item, 4)
          }}
        >
          {item.image ? (
            <div
              className={`sp-crop-area ${selected && item.cropMode ? "sp-crop-active" : ""}`}
              style={{ borderRadius: item.imageRounded ? Number(item.imageRadius ?? 10) : 0 }}
              onPointerDown={(e) => {
                if (selected && item.cropMode) onCropPointerDown(e, item.id);
              }}
              title={selected && item.cropMode ? "拖曳圖片選擇要顯示的位置" : ""}
            >
              <img
                src={item.image}
                alt={item.caption || "polaroid"}
                style={{
                  objectFit: item.fit || "cover",
                  objectPosition: `${item.cropX ?? 50}% ${item.cropY ?? 50}%`,
                  transform: `scale(${Number(item.cropZoom ?? 100) / 100})`,
                  transformOrigin: `${item.cropX ?? 50}% ${item.cropY ?? 50}%`
                }}
                draggable={false}
              />
            </div>
          ) : (
            <div className="sp-polaroid-empty">Upload Image</div>
          )}
          <p style={{ color: colorWithAlpha(item.textColor, item.textColorOpacity ?? 1, "#4c3223"), fontFamily: item.fontFamily }}>{item.caption}</p>
        </div>
      )}

      {item.type === "image" && (
        <div className="sp-image-card" style={{ background: item.frameColor === "transparent" ? "transparent" : colorWithAlpha(item.frameColor, item.frameOpacity ?? 1, "#fffdf8"), ...itemBorderStyle(item, 16) }}>
          <div
            className={`sp-crop-area ${selected && item.cropMode ? "sp-crop-active" : ""}`}
            style={{ borderRadius: item.imageRounded ? Number(item.imageRadius ?? 14) : 0 }}
            onPointerDown={(e) => {
              if (selected && item.cropMode) onCropPointerDown(e, item.id);
            }}
            title={selected && item.cropMode ? "拖曳圖片選擇要顯示的位置" : ""}
          >
            <img
              src={item.image}
              alt={item.title || "imported work"}
              style={{
                objectFit: item.fit || "contain",
                objectPosition: `${item.cropX ?? 50}% ${item.cropY ?? 50}%`,
                transform: `scale(${Number(item.cropZoom ?? 100) / 100})`,
                transformOrigin: `${item.cropX ?? 50}% ${item.cropY ?? 50}%`
              }}
              draggable={false}
            />
          </div>
        </div>
      )}

      {item.type === "box" && (
        <div
          className={`sp-box sp-box-${item.variant || "plain"}`}
          style={{
            backgroundColor: colorWithAlpha(item.color, item.colorOpacity ?? 1, "#ffffff"),
            color: colorWithAlpha(item.textColor, item.textColorOpacity ?? 1, "#4c3223"),
            fontSize: item.fontSize,
            fontFamily: item.fontFamily,
            fontWeight: item.fontWeight || (item.bold ? 800 : 500),
            textAlign: item.align || "center",
            ...textStrokeStyle(item),
            ...itemBorderStyle(item, 14)
          }}
        >
          {item.text}
        </div>
      )}

      {item.type === "drawing" && (
        <svg className="sp-drawing-layer" viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} preserveAspectRatio="none">
          <path
            d={makeDrawingPath(item.points)}
            style={brushPathStyle(item)}
          />
        </svg>
      )}

      {selected && item.type !== "drawing" && (
        <span
          className="sp-resize-handle"
          title="拖曳調整大小"
          onPointerDown={(e) => onResizeDown(e, item.id)}
        />
      )}
    </div>
  );
}

export default function ScrapbookPlanner({ currentUser, onShareToWall }) {
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const cropDragRef = useRef(null);
  const drawRef = useRef(null);

  const today = new Date();
  const [styleName, setStyleName] = useState("vintage");
  const [templateType, setTemplateType] = useState("monthly");
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [dateValue, setDateValue] = useState(toDateInputValue(today));
  const [uploadedTemplate, setUploadedTemplate] = useState(null);

  const [items, setItems] = useState([]);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [undoStepCount, setUndoStepCount] = useState(1);
  const [redoStepCount, setRedoStepCount] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [savedWorks, setSavedWorks] = useState([]);
  const [worksOpen, setWorksOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [drawingMode, setDrawingMode] = useState(false);
  const [brushColor, setBrushColor] = useState("#6a3d24");
  const [brushSize, setBrushSize] = useState(5);
  const [brushOpacity, setBrushOpacity] = useState(0.95);
  const [brushTexture, setBrushTexture] = useState("pen");
  const [eraserMode, setEraserMode] = useState("none");

  const theme = stylePresets[styleName];
  const selectedItem = items.find((item) => item.id === selectedId) || null;

  const getCanvasInfo = (event) => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      rect,
      scaleX: CANVAS_W / rect.width,
      scaleY: CANVAS_H / rect.height,
      x: (event.clientX - rect.left) * (CANVAS_W / rect.width),
      y: (event.clientY - rect.top) * (CANVAS_H / rect.height)
    };
  };

  const cloneItems = (list) => list.map((item) => ({ ...item }));

  const pushHistorySnapshot = () => {
    setHistory((prev) => [...prev.slice(-24), cloneItems(items)]);
  };

  const commitItems = (updater) => {
    setItems((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      setHistory((historyPrev) => [...historyPrev.slice(-49), cloneItems(prev)]);
      setFuture([]);
      return next;
    });
  };

  const undoSteps = (steps = undoStepCount) => {
    setHistory((prevHistory) => {
      if (prevHistory.length === 0) return prevHistory;
      const count = Math.max(1, Math.min(Number(steps) || 1, 5, prevHistory.length));
      const targetIndex = prevHistory.length - count;
      const target = cloneItems(prevHistory[targetIndex]);
      const redoCandidates = [...prevHistory.slice(targetIndex + 1), cloneItems(items)].map(cloneItems);
      setFuture((prevFuture) => [...redoCandidates, ...prevFuture].slice(0, 50));
      setItems(target);
      setSelectedId(null);
      return prevHistory.slice(0, targetIndex);
    });
  };

  const redoSteps = (steps = redoStepCount) => {
    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;
      const count = Math.max(1, Math.min(Number(steps) || 1, 5, prevFuture.length));
      const target = cloneItems(prevFuture[count - 1]);
      const historyCandidates = [cloneItems(items), ...prevFuture.slice(0, count - 1)].map(cloneItems);
      setHistory((prevHistory) => [...prevHistory, ...historyCandidates].slice(-50));
      setItems(target);
      setSelectedId(null);
      return prevFuture.slice(count);
    });
  };

  const undoLast = () => undoSteps(1);

  useEffect(() => {
    loadSavedWorks();
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (!canvasRef.current) return;

      if (drawRef.current) {
        const drawId = drawRef.current.id;
        const info = getCanvasInfo(e);
        if (!info) return;
        const point = {
          x: Math.max(0, Math.min(CANVAS_W, Math.round(info.x))),
          y: Math.max(0, Math.min(CANVAS_H, Math.round(info.y)))
        };

        setItems((prev) =>
          prev.map((item) =>
            item.id === drawId
              ? { ...item, points: [...(item.points || []), point] }
              : item
          )
        );
        return;
      }

      if (cropDragRef.current) {
        const { id, startX, startY, startCropX, startCropY, startFit, scaleX, scaleY } = cropDragRef.current;
        const dx = (e.clientX - startX) * (scaleX || 1);
        const dy = (e.clientY - startY) * (scaleY || 1);

        setItems((prev) =>
          prev.map((target) => {
            if (target.id !== id) return target;
            const sensitivityX = 100 / Math.max(120, Number(target.width || 240));
            const sensitivityY = 100 / Math.max(120, Number(target.height || 200));
            return {
              ...target,
              fit: startFit === "contain" ? "cover" : target.fit || "cover",
              cropX: Math.max(0, Math.min(100, startCropX - dx * sensitivityX)),
              cropY: Math.max(0, Math.min(100, startCropY - dy * sensitivityY))
            };
          })
        );
        return;
      }

      if (resizeRef.current) {
        const { id, startX, startY, startWidth, startHeight, scaleX, scaleY } = resizeRef.current;
        const dx = (e.clientX - startX) * (scaleX || 1);
        const dy = (e.clientY - startY) * (scaleY || 1);

        setItems((prev) =>
          prev.map((item) => {
            if (item.id !== id) return item;
            const minW = item.type === "tape" ? 90 : 60;
            const minH = item.type === "tape" ? 28 : 50;
            const nextWidth = Math.max(minW, Math.min(CANVAS_W - item.x, startWidth + dx));
            const nextHeight = Math.max(minH, Math.min(CANVAS_H - item.y, startHeight + dy));
            return { ...item, width: Math.round(nextWidth), height: Math.round(nextHeight) };
          })
        );
        return;
      }

      if (!dragRef.current) return;
      const { id, offsetX, offsetY } = dragRef.current;
      const info = getCanvasInfo(e);
      if (!info) return;
      const nextX = info.x - offsetX;
      const nextY = info.y - offsetY;

      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                x: Math.max(0, Math.min(CANVAS_W - item.width, nextX)),
                y: Math.max(0, Math.min(CANVAS_H - item.height, nextY))
              }
            : item
        )
      );
    };

    const onUp = () => {
      dragRef.current = null;
      resizeRef.current = null;
      cropDragRef.current = null;
      drawRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const loadSavedWorks = async () => {
    try {
      const postcards = getList(STORAGE_KEYS.postcards).filter(
        (item) => !item.ownerGmail || !currentUser?.gmail || item.ownerGmail === currentUser.gmail
      );
      const photoBooths = getList(STORAGE_KEYS.photoBooths).filter(
        (item) => !item.ownerGmail || !currentUser?.gmail || item.ownerGmail === currentUser.gmail
      );

      const withImages = await attachImages([...postcards, ...photoBooths]);
      setSavedWorks(withImages.filter((item) => item.image));
    } catch (error) {
      console.error(error);
      alert("讀取 My Storage 作品失敗，請確認作品有成功儲存。");
    }
  };

  const startDrawing = (e) => {
    if (!drawingMode || !canvasRef.current || eraserMode === "object") return;
    e.preventDefault();
    e.stopPropagation();

    const info = getCanvasInfo(e);
    if (!info) return;
    const point = {
      x: Math.max(0, Math.min(CANVAS_W, Math.round(info.x))),
      y: Math.max(0, Math.min(CANVAS_H, Math.round(info.y)))
    };
    const id = makeId();
    pushHistorySnapshot();
    setSelectedId(null);
    setItems((prev) => [
      ...prev,
      {
        id,
        type: "drawing",
        x: 0,
        y: 0,
        width: CANVAS_W,
        height: CANVAS_H,
        z: 10000 + prev.length,
        points: [point],
        color: eraserMode === "pixel" ? theme.paper : brushColor,
        strokeWidth: eraserMode === "pixel" ? Number(brushSize || 5) * 2.6 : Number(brushSize || 5),
        opacity: eraserMode === "pixel" ? 1 : Number(brushOpacity || 1),
        brushTexture: eraserMode === "pixel" ? "pen" : brushTexture,
        eraserStroke: eraserMode === "pixel",
        rotation: 0
      }
    ]);
    drawRef.current = { id };
  };

  const selectAndDrag = (e, id) => {
    if (!canvasRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(id);
    pushHistorySnapshot();

    const item = items.find((target) => target.id === id);
    if (!item) return;

    const info = getCanvasInfo(e);
    if (!info) return;
    dragRef.current = {
      id,
      offsetX: info.x - item.x,
      offsetY: info.y - item.y
    };
  };

  const startResize = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    const item = items.find((target) => target.id === id);
    if (!item) return;
    setSelectedId(id);
    pushHistorySnapshot();
    dragRef.current = null;
    const info = getCanvasInfo(e);
    resizeRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: item.width,
      startHeight: item.height,
      scaleX: info?.scaleX || 1,
      scaleY: info?.scaleY || 1
    };
  };

  const startCropDrag = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    const item = items.find((target) => target.id === id);
    if (!item || !(item.type === "image" || item.type === "polaroid")) return;
    setSelectedId(id);
    pushHistorySnapshot();
    dragRef.current = null;
    resizeRef.current = null;
    const info = getCanvasInfo(e);
    cropDragRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      startCropX: Number(item.cropX ?? 50),
      startCropY: Number(item.cropY ?? 50),
      startFit: item.fit || "cover",
      scaleX: info?.scaleX || 1,
      scaleY: info?.scaleY || 1
    };
  };

  const addItem = (newItem) => {
    const item = {
      id: makeId(),
      x: 80 + (items.length % 5) * 24,
      y: 110 + (items.length % 5) * 24,
      z: items.length + 3,
      opacity: newItem.opacity ?? 1,
      rotation: newItem.rotation ?? 0,
      ...newItem
    };
    commitItems((prev) => [...prev, item]);
    setSelectedId(item.id);
  };

  const addText = () => {
    addItem({
      type: "text",
      width: 260,
      height: 90,
      text: "Type your text here",
      color: theme.text,
      colorOpacity: 1,
      bgColor: "transparent",
      bgOpacity: 1,
      fontSize: 28,
      fontFamily: "Georgia",
      fontWeight: 400,
      bold: false,
      textStrokeEnabled: false,
      textStrokeColor: "#ffffff",
      textStrokeOpacity: 1,
      textStrokeWidth: 1,
      borderEnabled: false,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: 12
    });
  };

  const addSticker = () => {
    addItem({
      type: "sticker",
      width: 120,
      height: 90,
      shape: "rounded",
      text: "STICKER",
      color: theme.sticker,
      colorOpacity: 1,
      textColor: theme.text,
      textColorOpacity: 1,
      borderEnabled: true,
      borderOpacity: 1,
      borderColor: theme.accent,
      borderWidth: 2,
      borderRadius: 18,
      fontSize: 18,
      fontFamily: "Trebuchet MS"
    });
  };

  const addTape = () => {
    addItem({
      type: "tape",
      width: 260,
      height: 54,
      pattern: "stripe",
      text: "WASHI TAPE",
      color: theme.tape,
      colorOpacity: 1,
      textColor: "#ffffff",
      textColorOpacity: 1,
      borderEnabled: false,
      borderColor: "#d0b39a",
      borderWidth: 1,
      borderRadius: 4,
      opacity: 0.88,
      fontSize: 16,
      fontFamily: "Trebuchet MS"
    });
  };

  const addNote = () => {
    addItem({
      type: "note",
      width: 230,
      height: 190,
      variant: "lines",
      noteShape: "rounded",
      title: "Memo",
      text: "- To-do\n- Notes\n- Ideas",
      color: theme.note,
      colorOpacity: 1,
      textColor: theme.text,
      textColorOpacity: 1,
      borderEnabled: true,
      borderOpacity: 1,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: 18,
      fontSize: 16,
      fontFamily: "Trebuchet MS"
    });
  };

  const addPolaroid = (image = "") => {
    addItem({
      type: "polaroid",
      width: 230,
      height: 285,
      image,
      caption: "Memory",
      frameColor: "#fffdf8",
      frameOpacity: 1,
      borderEnabled: true,
      borderOpacity: 1,
      borderColor: "#e1d2c4",
      borderWidth: 1,
      borderRadius: 4,
      textColor: theme.text,
      textColorOpacity: 1,
      fontFamily: "Georgia",
      fit: "cover",
      cropX: 50,
      cropY: 50,
      cropZoom: 100,
      cropMode: false,
      imageRounded: false,
      imageRadius: 10,
      bgRemoved: false
    });
  };

  const addImageCard = (image, title = "Imported Work") => {
    addItem({
      type: "image",
      width: 260,
      height: 210,
      image,
      title,
      frameColor: "#fffdf8",
      frameOpacity: 1,
      borderEnabled: true,
      borderOpacity: 1,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: 16,
      fit: "contain",
      cropX: 50,
      cropY: 50,
      cropZoom: 100,
      cropMode: false,
      imageRounded: true,
      imageRadius: 14,
      bgRemoved: false
    });
  };

  const addBox = (patch = {}) => {
    addItem({
      type: "box",
      width: 180,
      height: 70,
      text: "Box",
      color: "#ffffff",
      colorOpacity: 0.74,
      textColor: theme.text,
      textColorOpacity: 1,
      borderEnabled: true,
      borderOpacity: 1,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: 14,
      fontSize: 18,
      fontFamily: "Trebuchet MS",
      fontWeight: 500,
      bold: false,
      textStrokeEnabled: false,
      textStrokeColor: "#ffffff",
      textStrokeWidth: 1,
      variant: "plain",
      align: "center",
      ...patch
    });
  };

  const markTemplateItems = (list, source) =>
    list.map((item, index) => ({
      ...item,
      templateElement: true,
      templateSource: source,
      z: 50 + index
    }));

  const replaceEditableTemplate = (newTemplateItems, source) => {
    const stamped = markTemplateItems(newTemplateItems, source);
    commitItems((prev) => [
      ...prev.filter((item) => !item.templateElement),
      ...stamped
    ]);
    setTemplateType("blank");
    setSelectedId(stamped[0]?.id || null);
  };

  const handleTemplateTypeChange = (nextType) => {
    setTemplateType(nextType);
    setSelectedId(null);
    if (nextType !== "blank") {
      // 切換月曆 / 週計畫 / 日計畫時，清掉上一個「可編輯模板」產生的元素，避免堆在一起。
      commitItems((prev) => prev.filter((item) => !item.templateElement));
    }
  };

  const insertEditableMonthlyTemplate = () => {
    const startX = 40;
    const startY = 80;
    const cellW = 102;
    const cellH = 78;
    const gap = 6;
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const first = new Date(year, month - 1, 1).getDay();
    const total = new Date(year, month, 0).getDate();
    const newItems = [];

    newItems.push({
      id: makeId(), type: "box", x: startX, y: 28, z: items.length + 3, width: 720, height: 42,
      text: `${year} / ${String(month).padStart(2, "0")}`, color: theme.soft, textColor: theme.text,
      borderEnabled: true, borderColor: theme.border, borderWidth: 1, borderRadius: 16, fontSize: 24, fontFamily: "Georgia", bold: true, align: "center", opacity: 1
    });

    days.forEach((day, i) => {
      newItems.push({
        id: makeId(), type: "box", x: startX + i * (cellW + gap), y: startY, z: items.length + 4 + i, width: cellW, height: 36,
        text: day, color: theme.accent, textColor: "#ffffff", borderEnabled: false, borderColor: theme.border, borderWidth: 1, borderRadius: 12, fontSize: 15, fontFamily: "Trebuchet MS", bold: true, align: "center", opacity: 0.95
      });
    });

    for (let slot = 0; slot < 42; slot += 1) {
      const dayNum = slot - first + 1;
      const row = Math.floor(slot / 7);
      const col = slot % 7;
      newItems.push({
        id: makeId(), type: "box", x: startX + col * (cellW + gap), y: startY + 44 + row * (cellH + gap), z: items.length + 20 + slot, width: cellW, height: cellH,
        text: dayNum >= 1 && dayNum <= total ? String(dayNum) : "", color: "rgba(255,255,255,0.74)", textColor: theme.text,
        borderEnabled: true, borderColor: theme.border, borderWidth: 1, borderRadius: 14, fontSize: 17, fontFamily: "Trebuchet MS", bold: false, align: "left", opacity: 1
      });
    }

    replaceEditableTemplate(newItems, "monthly");
  };

  const insertEditableWeeklyTemplate = () => {
    const base = parseDateInput(dateValue);
    const monday = startOfWeek(base);
    const newItems = [
      { id: makeId(), type: "box", x: 42, y: 32, z: items.length + 3, width: 716, height: 48, text: `Weekly Planner · ${formatShort(monday)}`, color: theme.soft, colorOpacity: 1, textColor: theme.text, textColorOpacity: 1, borderEnabled: true, borderColor: theme.border, borderOpacity: 1, borderWidth: 1, borderRadius: 16, fontSize: 24, fontFamily: "Georgia", fontWeight: 800, bold: true, align: "center", opacity: 1 }
    ];
    for (let i = 0; i < 7; i += 1) {
      const current = new Date(monday);
      current.setDate(monday.getDate() + i);
      newItems.push({ id: makeId(), type: "box", x: 42 + (i % 2) * 360, y: 96 + Math.floor(i / 2) * 150, z: items.length + 10 + i, width: 340, height: 128, text: `${weekDayLabels[i]} ${formatShort(current)}\n\n`, color: "rgba(255,255,255,0.76)", textColor: theme.text, borderEnabled: true, borderColor: theme.border, borderWidth: 1, borderRadius: 16, fontSize: 16, fontFamily: "Trebuchet MS", bold: false, align: "left", opacity: 1 });
    }
    labels.forEach((label, i) => {
      newItems.push({ id: makeId(), type: "box", x: 42 + i * 240, y: 720, z: items.length + 30 + i, width: 220, height: 170, text: `${label}\n\n-`, color: theme.note, textColor: theme.text, borderEnabled: true, borderColor: theme.border, borderWidth: 1, borderRadius: 18, fontSize: 16, fontFamily: "Trebuchet MS", bold: false, align: "left", opacity: 1 });
    });
    replaceEditableTemplate(newItems, "weekly");
  };

  const insertEditableDailyTemplate = () => {
    const date = parseDateInput(dateValue);
    const newItems = [
      { id: makeId(), type: "box", x: 42, y: 32, z: items.length + 3, width: 716, height: 48, text: `Daily Planner · ${formatShort(date)} ${getWeekdayName(date)}`, color: theme.soft, textColor: theme.text, borderEnabled: true, borderColor: theme.border, borderWidth: 1, borderRadius: 16, fontSize: 23, fontFamily: "Georgia", bold: true, align: "center", opacity: 1 },
      { id: makeId(), type: "box", x: 42, y: 110, z: items.length + 4, width: 330, height: 420, text: "Today’s Schedule\n\n08:00  __________\n10:00  __________\n12:00  __________\n14:00  __________\n16:00  __________\n18:00  __________", color: "rgba(255,255,255,0.78)", textColor: theme.text, borderEnabled: true, borderColor: theme.border, borderWidth: 1, borderRadius: 18, fontSize: 16, fontFamily: "Trebuchet MS", bold: false, align: "left", opacity: 1 },
      { id: makeId(), type: "box", x: 410, y: 110, z: items.length + 5, width: 320, height: 240, text: "To-do List\n\n□\n□\n□\n□", color: theme.note, textColor: theme.text, borderEnabled: true, borderColor: theme.border, borderWidth: 1, borderRadius: 18, fontSize: 17, fontFamily: "Trebuchet MS", bold: false, align: "left", opacity: 1 },
      { id: makeId(), type: "box", x: 410, y: 380, z: items.length + 6, width: 320, height: 150, text: "Mood\n😊  😐  😴  💪  🌷", color: "rgba(255,255,255,0.76)", textColor: theme.text, borderEnabled: true, borderColor: theme.border, borderWidth: 1, borderRadius: 18, fontSize: 18, fontFamily: "Trebuchet MS", bold: false, align: "center", opacity: 1 },
      { id: makeId(), type: "box", x: 42, y: 570, z: items.length + 7, width: 688, height: 260, text: "Notes\n\n", color: "rgba(255,255,255,0.76)", textColor: theme.text, borderEnabled: true, borderColor: theme.border, borderWidth: 1, borderRadius: 18, fontSize: 18, fontFamily: "Trebuchet MS", bold: false, align: "left", opacity: 1 }
    ];
    replaceEditableTemplate(newItems, "daily");
  };

  const updateSelected = (patch) => {
    if (!selectedItem) return;
    commitItems((prev) => prev.map((item) => (item.id === selectedItem.id ? { ...item, ...patch } : item)));
  };

  const deleteSelected = () => {
    if (!selectedItem) return;
    commitItems((prev) => prev.filter((item) => item.id !== selectedItem.id));
    setSelectedId(null);
  };

  const duplicateSelected = () => {
    if (!selectedItem) return;
    const copy = {
      ...selectedItem,
      id: makeId(),
      x: Math.min(selectedItem.x + 30, CANVAS_W - selectedItem.width),
      y: Math.min(selectedItem.y + 30, CANVAS_H - selectedItem.height),
      z: items.length + 3
    };
    commitItems((prev) => [...prev, copy]);
    setSelectedId(copy.id);
  };

  const bringForward = () => {
    if (!selectedItem) return;
    updateSelected({ z: Math.max(...items.map((item) => item.z || 1)) + 1 });
  };

  const sendBackward = () => {
    if (!selectedItem) return;
    updateSelected({ z: Math.max(1, (selectedItem.z || 1) - 1) });
  };

  const handleTemplateUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("目前版本先支援圖片模板：PNG、JPG、JPEG、WEBP。PDF 可做為之後擴充。");
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    setUploadedTemplate(dataUrl);
    setTemplateType("uploaded");
  };

  const handlePolaroidUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    addPolaroid(dataUrl);
    e.target.value = "";
  };

  const handleImageCardUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    addImageCard(dataUrl, file.name || "Uploaded Image");
    e.target.value = "";
  };

  const handleSelectedImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);

    if (selectedItem?.type === "polaroid") {
      updateSelected({ image: dataUrl, fit: "cover", cropX: 50, cropY: 50, cropZoom: 100, cropMode: false, imageRounded: selectedItem.imageRounded ?? false, imageRadius: selectedItem.imageRadius ?? 10 });
    } else if (selectedItem?.type === "image") {
      updateSelected({ image: dataUrl, title: file.name || selectedItem.title, fit: "contain", cropX: 50, cropY: 50, cropZoom: 100, cropMode: false, imageRounded: selectedItem.imageRounded ?? true, imageRadius: selectedItem.imageRadius ?? 14 });
    } else {
      addImageCard(dataUrl, file.name || "Uploaded Image");
    }

    e.target.value = "";
  };

  const removeBackgroundForSelected = async () => {
    if (!selectedItem || (selectedItem.type !== "image" && selectedItem.type !== "polaroid") || !selectedItem.image) return;

    try {
      const nextImage = await removeLightBackground(selectedItem.image, 42);
      updateSelected({ image: nextImage, bgRemoved: true, fit: "contain", frameColor: "transparent" });
    } catch (error) {
      console.error(error);
      alert("去背失敗。這個簡易去背主要適合白色或淺色背景圖片。");
    }
  };

  const applyCropToSelected = async () => {
    if (!selectedItem || (selectedItem.type !== "image" && selectedItem.type !== "polaroid") || !selectedItem.image) return;

    try {
      const img = await loadImageElement(selectedItem.image);
      const innerWidth = selectedItem.type === "polaroid" ? Math.max(80, selectedItem.width - 26) : Math.max(80, selectedItem.width - 16);
      const innerHeight = selectedItem.type === "polaroid" ? Math.max(80, selectedItem.height - 60) : Math.max(80, selectedItem.height - 16);
      const targetAspect = innerWidth / innerHeight;
      const imageAspect = img.width / img.height;

      let cropW = img.width;
      let cropH = img.height;

      if (imageAspect > targetAspect) {
        cropW = img.height * targetAspect;
      } else {
        cropH = img.width / targetAspect;
      }

      const zoom = Math.max(1, Number(selectedItem.cropZoom ?? 100) / 100);
      cropW = Math.max(1, cropW / zoom);
      cropH = Math.max(1, cropH / zoom);

      const xPercent = Number(selectedItem.cropX ?? 50) / 100;
      const yPercent = Number(selectedItem.cropY ?? 50) / 100;
      const sx = Math.max(0, Math.min(img.width - cropW, (img.width - cropW) * xPercent));
      const sy = Math.max(0, Math.min(img.height - cropH, (img.height - cropH) * yPercent));

      const outputW = 1000;
      const outputH = Math.max(1, Math.round(outputW / targetAspect));
      const canvas = document.createElement("canvas");
      canvas.width = outputW;
      canvas.height = outputH;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, outputW, outputH);
      const cropped = canvas.toDataURL("image/png");

      updateSelected({ image: cropped, fit: "cover", cropX: 50, cropY: 50, cropZoom: 100 });
    } catch (error) {
      console.error(error);
      alert("裁切失敗，請換一張圖片再試一次。");
    }
  };



  const captureCanvasImage = async (type = "image/png", quality = 0.95) => {
    if (!canvasRef.current) return null;
    setSelectedId(null);
    await new Promise((resolve) => setTimeout(resolve, 120));
    const canvas = await html2canvas(canvasRef.current, {
      scale: 2,
      backgroundColor: theme.paper,
      useCORS: true
    });
    return canvas.toDataURL(type, quality);
  };

  const buildPdfBlobFromJpeg = (jpegDataUrl) => {
    const base64 = jpegDataUrl.split(",")[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

    const encoder = new TextEncoder();
    const parts = [];
    const offsets = [];
    let position = 0;
    const add = (part) => {
      const data = typeof part === "string" ? encoder.encode(part) : part;
      parts.push(data);
      position += data.length;
    };
    const obj = (id, bodyParts) => {
      offsets[id] = position;
      add(`${id} 0 obj\n`);
      bodyParts.forEach(add);
      add("\nendobj\n");
    };

    add("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
    obj(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
    obj(2, ["<< /Type /Pages /Kids [3 0 R] /Count 1 >>"]);
    obj(3, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${CANVAS_W} ${CANVAS_H}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`]);
    obj(4, [`<< /Type /XObject /Subtype /Image /Width ${CANVAS_W} /Height ${CANVAS_H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`, bytes, "\nendstream"]);
    const content = `q\n${CANVAS_W} 0 0 ${CANVAS_H} 0 0 cm\n/Im0 Do\nQ`;
    obj(5, [`<< /Length ${content.length} >>\nstream\n${content}\nendstream`]);
    const xrefStart = position;
    add(`xref\n0 6\n0000000000 65535 f \n`);
    for (let i = 1; i <= 5; i += 1) add(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
    add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);
    return new Blob(parts, { type: "application/pdf" });
  };

  const downloadPng = async () => {
    setDownloading(true);
    try {
      const dataUrl = await captureCanvasImage("image/png");
      if (!dataUrl) return;
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `scrapbook-planner-${Date.now()}.png`;
      link.click();
    } catch (error) {
      console.error(error);
      alert("下載圖片失敗，請再試一次。");
    } finally {
      setDownloading(false);
    }
  };

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const jpeg = await captureCanvasImage("image/jpeg", 0.95);
      if (!jpeg) return;
      const blob = buildPdfBlobFromJpeg(jpeg);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `scrapbook-planner-${Date.now()}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("下載 PDF 失敗，請再試一次。");
    } finally {
      setDownloading(false);
    }
  };

  const shareCurrentToWall = async () => {
    if (!onShareToWall) {
      alert("目前尚未接到 Community Wall 分享功能。");
      return;
    }
    setDownloading(true);
    try {
      const dataUrl = await captureCanvasImage("image/png");
      if (!dataUrl) return;
      await onShareToWall({
        id: makeId(),
        type: "scrapbook",
        title: "Scrapbook Planner",
        caption: "Shared scrapbook planner",
        image: dataUrl
      });
    } catch (error) {
      console.error(error);
      alert("分享到作品牆失敗，請再試一次。");
    } finally {
      setDownloading(false);
    }
  };

  const renderTemplate = () => {
    if (templateType === "blank") return null;
    if (templateType === "monthly") return <MonthlyTemplate year={year} month={month} theme={theme} styleName={styleName} />;
    if (templateType === "weekly") return <WeeklyTemplate dateValue={dateValue} styleName={styleName} />;
    if (templateType === "daily") return <DailyTemplate dateValue={dateValue} styleName={styleName} />;
    return null;
  };

  return (
    <div className="sp-page">
      <style>{scrapbookStyles}</style>

      <div className="sp-heading">
        <div>
          <h2>Scrapbook Planner Studio</h2>
          <p>單頁手帳 / 計畫本編輯器：可以加入文字、貼紙、紙膠帶、便利貼、拍立得，也能導入 My Storage 作品。</p>
        </div>
        <div className="sp-heading-actions">
          <button className="sp-primary-btn" onClick={downloadPng} disabled={downloading}>
            {downloading ? "Exporting..." : "Download PNG"}
          </button>
          <button className="sp-primary-btn sp-secondary-export" onClick={downloadPdf} disabled={downloading}>
            Download PDF
          </button>
          <button className="sp-primary-btn sp-wall-export" onClick={shareCurrentToWall} disabled={downloading}>
            Share to Wall
          </button>
        </div>
      </div>

      <div className="sp-layout">
        <aside className="sp-panel">
          <h3>Tools</h3>

          <div className="sp-history-tools">
            <label>History 歷史紀錄</label>
            <div className="sp-history-menus">
              <details className="sp-step-menu">
                <summary className={history.length === 0 ? "sp-history-btn sp-disabled-summary" : "sp-history-btn"}>↶ Undo 選步數</summary>
                <div className="sp-step-menu-panel">
                  {[1, 2, 3, 4, 5].map((step) => (
                    <button key={`undo-${step}`} type="button" disabled={history.length < step} onClick={() => undoSteps(step)}>
                      回上 {step} 步
                    </button>
                  ))}
                </div>
              </details>
              <details className="sp-step-menu">
                <summary className={future.length === 0 ? "sp-history-btn sp-redo-btn sp-disabled-summary" : "sp-history-btn sp-redo-btn"}>↷ Redo 選步數</summary>
                <div className="sp-step-menu-panel">
                  {[1, 2, 3, 4, 5].map((step) => (
                    <button key={`redo-${step}`} type="button" disabled={future.length < step} onClick={() => redoSteps(step)}>
                      下一步 {step} 步
                    </button>
                  ))}
                </div>
              </details>
            </div>
          </div>

          <label>Style</label>
          <select value={styleName} onChange={(e) => setStyleName(e.target.value)}>
            {Object.entries(stylePresets).map(([key, value]) => (
              <option key={key} value={key}>
                {value.label}
              </option>
            ))}
          </select>

          <label>Template</label>
          <select value={templateType} onChange={(e) => handleTemplateTypeChange(e.target.value)}>
            <option value="blank">Blank 空白紙</option>
            <option value="monthly">Monthly Calendar 月曆</option>
            <option value="weekly">Weekly Planner 週計畫</option>
            <option value="daily">Daily Planner 日計畫</option>
            <option value="uploaded">Uploaded Template 上傳模板</option>
          </select>

          {templateType === "monthly" && (
            <div className="sp-two-col">
              <div>
                <label>Year</label>
                <input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
              </div>
              <div>
                <label>Month</label>
                <select value={month} onChange={(e) => setMonth(e.target.value)}>
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {(templateType === "weekly" || templateType === "daily") && (
            <>
              <label>Date</label>
              <input type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} />
            </>
          )}

          <div className="sp-template-actions">
            {templateType === "monthly" && <button type="button" onClick={insertEditableMonthlyTemplate}>Make Monthly Template Editable</button>}
            {templateType === "weekly" && <button type="button" onClick={insertEditableWeeklyTemplate}>Make Weekly Template Editable</button>}
            {templateType === "daily" && <button type="button" onClick={insertEditableDailyTemplate}>Make Daily Template Editable</button>}
          </div>

          <label className="sp-file-btn">
            Upload Image Template
            <input type="file" accept="image/*,.pdf" onChange={handleTemplateUpload} />
          </label>
          <small className="sp-help">目前先支援圖片模板；PDF 可當未來擴充。</small>

          <div className="sp-tool-grid">
            <button onClick={addText}>Add Text</button>
            <button onClick={addSticker}>Add Sticker</button>
            <button onClick={addTape}>Add Tape</button>
            <button onClick={addNote}>Add Note</button>
          </div>

          <div className="sp-draw-tool">
            <button
              type="button"
              className={drawingMode ? "sp-draw-active" : "sp-wide-btn"}
              onClick={() => setDrawingMode((prev) => !prev)}
            >
              {drawingMode ? "Drawing Mode ON 畫畫中" : "Draw on Page 在手帳上畫畫"}
            </button>
            <ColorOpacityField
              label="Brush Color 筆刷顏色"
              color={brushColor}
              alpha={brushOpacity}
              fallback={theme.accent}
              onColorChange={setBrushColor}
              onAlphaChange={setBrushOpacity}
            />
            <label>Brush Texture 筆刷質感</label>
            <select value={brushTexture} onChange={(e) => setBrushTexture(e.target.value)}>
              <option value="pen">Normal Pen 一般筆</option>
              <option value="marker">Marker 麥克筆</option>
              <option value="pencil">Pencil 鉛筆感</option>
              <option value="highlighter">Highlighter 螢光筆</option>
              <option value="dashed">Dashed 虛線筆</option>
              <option value="neon">Glow 發光筆</option>
            </select>
            <label>Eraser 橡皮擦</label>
            <select value={eraserMode} onChange={(e) => { setEraserMode(e.target.value); if (e.target.value !== "none") setDrawingMode(true); }}>
              <option value="none">Off 關閉</option>
              <option value="pixel">Pixel Eraser 像素橡皮擦</option>
              <option value="object">Object Eraser 物件橡皮擦</option>
            </select>
            <label>Brush Size：{brushSize}px</label>
            <input type="range" min="1" max="36" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} />
            <small className="sp-help">像素橡皮擦會用紙張底色覆蓋筆跡；物件橡皮擦可直接點掉整條筆跡。</small>
          </div>

          <button className="sp-wide-btn" onClick={() => addPolaroid("")}>Add Blank Polaroid</button>

          <label className="sp-file-btn">
            Add Polaroid from Image
            <input type="file" accept="image/*" onChange={handlePolaroidUpload} />
          </label>

          <label className="sp-file-btn">
            Add Image Card from Image
            <input type="file" accept="image/*" onChange={handleImageCardUpload} />
          </label>

          <button
            className="sp-wide-btn"
            onClick={() => {
              loadSavedWorks();
              setWorksOpen((prev) => !prev);
            }}
          >
            Import Works from My Storage
          </button>

          {worksOpen && (
            <div className="sp-work-list">
              {savedWorks.length === 0 ? (
                <p className="sp-help">目前讀不到作品，請先在明信片或拍貼機按 Save to My Storage。</p>
              ) : (
                savedWorks.map((work) => (
                  <div className="sp-work" key={work.id}>
                    <img src={work.image} alt={work.title} />
                    <div>
                      <strong>{work.type === "postcard" ? "Postcard" : "Photo Booth"}</strong>
                      <span>{work.title}</span>
                      <button onClick={() => addImageCard(work.image, work.title)}>Add Image</button>
                      <button onClick={() => addPolaroid(work.image)}>Add Polaroid</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <button className="sp-danger-btn" onClick={() => window.confirm("確定清空這張手帳嗎？") && commitItems([])}>
            Clear Page
          </button>
        </aside>

        <main className="sp-canvas-wrap">
          <div className="sp-canvas-toolbar">
            <span>拖曳素材可移動；右下角小點可調整大小；Rotation 可旋轉；工具列可選上一步/下一步 1～5 步，也能用筆刷或橡皮擦在手帳上畫畫。</span>
          </div>

          <div
            ref={canvasRef}
            className={`sp-canvas sp-style-${styleName}`}
            style={{
              background: theme.paper,
              borderColor: theme.border,
              cursor: drawingMode ? "crosshair" : "default"
            }}
            onPointerDown={startDrawing}
            onClick={() => setSelectedId(null)}
          >
            {templateType === "uploaded" && uploadedTemplate && (
              <img className="sp-uploaded-template" src={uploadedTemplate} alt="uploaded template" />
            )}

            {renderTemplate()}

            {items.map((item) => (
              <ScrapbookItem
                key={item.id}
                item={item}
                selected={selectedId === item.id}
                onPointerDown={selectAndDrag}
                onResizeDown={startResize}
                onSelect={setSelectedId}
                onCropPointerDown={startCropDrag}
                drawingMode={drawingMode}
                eraserMode={eraserMode}
                onEraseObject={(id) => {
                  commitItems((prev) => prev.filter((target) => target.id !== id));
                  setSelectedId(null);
                }}
              />
            ))}
          </div>
        </main>

        <aside className="sp-panel">
          <h3>Settings</h3>
          {!selectedItem ? (
            <p className="sp-empty-setting">請先點選畫布上的文字、貼紙、便利貼或圖片。</p>
          ) : (
            <div className="sp-setting-fields">
              <div className="sp-selected-label">Selected: {selectedItem.type}</div>

              <div className="sp-two-col">
                <div>
                  <label>X</label>
                  <input type="number" value={Math.round(selectedItem.x)} onChange={(e) => updateSelected({ x: Number(e.target.value) })} />
                </div>
                <div>
                  <label>Y</label>
                  <input type="number" value={Math.round(selectedItem.y)} onChange={(e) => updateSelected({ y: Number(e.target.value) })} />
                </div>
              </div>

              <div className="sp-two-col">
                <div>
                  <label>Width</label>
                  <input type="number" value={selectedItem.width} onChange={(e) => updateSelected({ width: Number(e.target.value) })} />
                </div>
                <div>
                  <label>Height</label>
                  <input type="number" value={selectedItem.height} onChange={(e) => updateSelected({ height: Number(e.target.value) })} />
                </div>
              </div>

              {selectedItem.type !== "drawing" && (
                <>
                  <label>Rotation Angle 旋轉角度：{selectedItem.rotation || 0}°</label>
                  <input type="range" min="-180" max="180" value={selectedItem.rotation || 0} onChange={(e) => updateSelected({ rotation: Number(e.target.value) })} />
                </>
              )}

              <label>Opacity 透明度：{Math.round((selectedItem.opacity ?? 1) * 100)}%</label>
              <input
                type="range"
                min="10"
                max="100"
                value={Math.round((selectedItem.opacity ?? 1) * 100)}
                onChange={(e) => updateSelected({ opacity: Number(e.target.value) / 100 })}
              />

              <div className="sp-border-panel">
                <label className="sp-check-row">
                  <input
                    type="checkbox"
                    checked={itemHasBorder(selectedItem)}
                    onChange={(e) => updateSelected({ borderEnabled: e.target.checked })}
                  />
                  Show Border 顯示邊框
                </label>
                <div className="sp-two-col">
                  <ColorOpacityField
                    label="Border Color"
                    color={selectedItem.borderColor}
                    alpha={selectedItem.borderOpacity ?? 1}
                    fallback={theme.border}
                    onColorChange={(value) => updateSelected({ borderColor: value, borderEnabled: true })}
                    onAlphaChange={(value) => updateSelected({ borderOpacity: value, borderEnabled: true })}
                  />
                  <div>
                    <label>Border Width</label>
                    <input
                      type="number"
                      min="0"
                      max="12"
                      value={selectedItem.borderWidth ?? 1}
                      onChange={(e) => updateSelected({ borderWidth: Number(e.target.value), borderEnabled: Number(e.target.value) > 0 })}
                    />
                  </div>
                </div>
                <label>Rounded Corner 圓角：{selectedItem.borderRadius ?? 12}px</label>
                <input
                  type="range"
                  min="0"
                  max="80"
                  value={selectedItem.borderRadius ?? 12}
                  onChange={(e) => updateSelected({ borderRadius: Number(e.target.value) })}
                />
              </div>

              {selectedItem.type === "text" && (
                <>
                  <label>Text</label>
                  <textarea value={selectedItem.text} onChange={(e) => updateSelected({ text: e.target.value })} />
                  <label>Font</label>
                  <select value={selectedItem.fontFamily} onChange={(e) => updateSelected({ fontFamily: e.target.value })}>
                    {fontOptions.map((font) => (
                      <option key={font} value={font}>{font}</option>
                    ))}
                  </select>
                  <div className="sp-two-col">
                    <div>
                      <label>Size</label>
                      <input type="number" value={selectedItem.fontSize} onChange={(e) => updateSelected({ fontSize: Number(e.target.value) })} />
                    </div>
                    <div>
                      <ColorOpacityField label="Color" color={selectedItem.color} alpha={selectedItem.colorOpacity ?? 1} fallback={theme.text} onColorChange={(value) => updateSelected({ color: value })} onAlphaChange={(value) => updateSelected({ colorOpacity: value })} />
                    </div>
                  </div>
                  <label className="sp-check-row">
                    <input
                      type="checkbox"
                      checked={selectedItem.bgColor === "transparent"}
                      onChange={(e) => updateSelected({ bgColor: e.target.checked ? "transparent" : theme.soft })}
                    />
                    Transparent Background 透明背景
                  </label>
                  {selectedItem.bgColor !== "transparent" && (
                    <>
                      <ColorOpacityField label="Background Color" color={selectedItem.bgColor} alpha={selectedItem.bgOpacity ?? 1} fallback={theme.soft} onColorChange={(value) => updateSelected({ bgColor: value })} onAlphaChange={(value) => updateSelected({ bgOpacity: value })} />
                    </>
                  )}
                  <label>Font Weight 字體粗細：{selectedItem.fontWeight || (selectedItem.bold ? 700 : 400)}</label>
                  <input type="range" min="100" max="900" step="100" value={selectedItem.fontWeight || (selectedItem.bold ? 700 : 400)} onChange={(e) => updateSelected({ fontWeight: Number(e.target.value), bold: Number(e.target.value) >= 700 })} />
                  <div className="sp-border-panel">
                    <label className="sp-check-row">
                      <input type="checkbox" checked={!!selectedItem.textStrokeEnabled} onChange={(e) => updateSelected({ textStrokeEnabled: e.target.checked })} /> Text Outline 文字描邊
                    </label>
                    {selectedItem.textStrokeEnabled && (
                      <>
                        <div className="sp-two-col">
                          <div>
                            <ColorOpacityField label="Outline Color" color={selectedItem.textStrokeColor} alpha={selectedItem.textStrokeOpacity ?? 1} fallback="#ffffff" onColorChange={(value) => updateSelected({ textStrokeColor: value })} onAlphaChange={(value) => updateSelected({ textStrokeOpacity: value })} />
                          </div>
                          <div>
                            <label>Outline Width</label>
                            <input type="number" min="1" max="6" value={selectedItem.textStrokeWidth || 1} onChange={(e) => updateSelected({ textStrokeWidth: Number(e.target.value) })} />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}

              {selectedItem.type === "sticker" && (
                <>
                  <label>Shape</label>
                  <select value={selectedItem.shape} onChange={(e) => updateSelected({ shape: e.target.value })}>
                    <option value="circle">Circle 圓形</option>
                    <option value="rounded">Rounded 圓角方形</option>
                    <option value="pill">Label 標籤</option>
                    <option value="heart">Heart 愛心</option>
                    <option value="star">Star 星星</option>
                  </select>
                  {selectedItem.shape !== "heart" && selectedItem.shape !== "star" && (
                    <>
                      <label>Sticker Text</label>
                      <input value={selectedItem.text} onChange={(e) => updateSelected({ text: e.target.value })} />
                    </>
                  )}
                  <div className="sp-two-col">
                    <div>
                      <ColorOpacityField label="Color" color={selectedItem.color} alpha={selectedItem.colorOpacity ?? 1} fallback={theme.sticker} onColorChange={(value) => updateSelected({ color: value })} onAlphaChange={(value) => updateSelected({ colorOpacity: value })} />
                    </div>
                    <div>
                      <ColorOpacityField label="Text Color" color={selectedItem.textColor} alpha={selectedItem.textColorOpacity ?? 1} fallback={theme.text} onColorChange={(value) => updateSelected({ textColor: value })} onAlphaChange={(value) => updateSelected({ textColorOpacity: value })} />
                    </div>
                  </div>
                  <label>Font Size</label>
                  <input type="number" value={selectedItem.fontSize} onChange={(e) => updateSelected({ fontSize: Number(e.target.value) })} />
                </>
              )}

              {selectedItem.type === "tape" && (
                <>
                  <label>Pattern</label>
                  <select value={selectedItem.pattern} onChange={(e) => updateSelected({ pattern: e.target.value })}>
                    <option value="solid">Solid 純色</option>
                    <option value="dot">Dots 點點</option>
                    <option value="grid">Grid 格紋</option>
                    <option value="stripe">Stripe 條紋</option>
                    <option value="checker">Checker 棋盤格</option>
                    <option value="diagonal">Diagonal 斜紋</option>
                    <option value="wave">Wave 波浪</option>
                    <option value="flower">Flower 小花</option>
                    <option value="heart">Heart 愛心</option>
                    <option value="star">Star 星星</option>
                  </select>
                  <label>Tape Text</label>
                  <input value={selectedItem.text} onChange={(e) => updateSelected({ text: e.target.value })} />
                  <div className="sp-two-col">
                    <div>
                      <ColorOpacityField label="Color" color={selectedItem.color} alpha={selectedItem.colorOpacity ?? 1} fallback={theme.sticker} onColorChange={(value) => updateSelected({ color: value })} onAlphaChange={(value) => updateSelected({ colorOpacity: value })} />
                    </div>
                    <div>
                      <ColorOpacityField label="Text Color" color={selectedItem.textColor} alpha={selectedItem.textColorOpacity ?? 1} fallback="#ffffff" onColorChange={(value) => updateSelected({ textColor: value })} onAlphaChange={(value) => updateSelected({ textColorOpacity: value })} />
                    </div>
                  </div>
                </>
              )}

              {selectedItem.type === "note" && (
                <>
                  <label>Note Style</label>
                  <select value={selectedItem.variant} onChange={(e) => updateSelected({ variant: e.target.value })}>
                    <option value="plain">Blank 空白</option>
                    <option value="lines">Lines 橫線</option>
                    <option value="dots">Dots 點點</option>
                    <option value="grid">Grid 方格</option>
                    <option value="todo">To-do 待辦</option>
                  </select>
                  <label>Note Shape 便利貼形狀</label>
                  <select value={selectedItem.noteShape || "rounded"} onChange={(e) => updateSelected({ noteShape: e.target.value })}>
                    <option value="rounded">Rounded 圓角便條</option>
                    <option value="square">Square 方形</option>
                    <option value="pill">Pill 膠囊</option>
                    <option value="ticket">Ticket 票券</option>
                    <option value="tag">Tag 標籤</option>
                    <option value="bubble">Bubble 對話框</option>
                  </select>
                  <label>Title</label>
                  <input value={selectedItem.title} onChange={(e) => updateSelected({ title: e.target.value })} />
                  <label>Text</label>
                  <textarea value={selectedItem.text} onChange={(e) => updateSelected({ text: e.target.value })} />
                  <div className="sp-two-col">
                    <div>
                      <ColorOpacityField label="Note Color" color={selectedItem.color} alpha={selectedItem.colorOpacity ?? 1} fallback={theme.sticker} onColorChange={(value) => updateSelected({ color: value })} onAlphaChange={(value) => updateSelected({ colorOpacity: value })} />
                    </div>
                    <div>
                      <ColorOpacityField label="Text Color" color={selectedItem.textColor} alpha={selectedItem.textColorOpacity ?? 1} fallback={theme.text} onColorChange={(value) => updateSelected({ textColor: value })} onAlphaChange={(value) => updateSelected({ textColorOpacity: value })} />
                    </div>
                  </div>
                  <label>Font Size</label>
                  <input type="number" value={selectedItem.fontSize} onChange={(e) => updateSelected({ fontSize: Number(e.target.value) })} />
                </>
              )}

              {selectedItem.type === "box" && (
                <>
                  <label>Box Text / Template Text</label>
                  <textarea value={selectedItem.text} onChange={(e) => updateSelected({ text: e.target.value })} />
                  <label>Font</label>
                  <select value={selectedItem.fontFamily} onChange={(e) => updateSelected({ fontFamily: e.target.value })}>
                    {fontOptions.map((font) => (
                      <option key={font} value={font}>{font}</option>
                    ))}
                  </select>
                  <div className="sp-two-col">
                    <div>
                      <ColorOpacityField label="Box Color" color={selectedItem.color} alpha={selectedItem.colorOpacity ?? 1} fallback={theme.soft} onColorChange={(value) => updateSelected({ color: value })} onAlphaChange={(value) => updateSelected({ colorOpacity: value })} />
                    </div>
                    <div>
                      <ColorOpacityField label="Text Color" color={selectedItem.textColor} alpha={selectedItem.textColorOpacity ?? 1} fallback={theme.text} onColorChange={(value) => updateSelected({ textColor: value })} onAlphaChange={(value) => updateSelected({ textColorOpacity: value })} />
                    </div>
                  </div>
                  <label>Font Size</label>
                  <input type="number" min="8" max="64" value={selectedItem.fontSize} onChange={(e) => updateSelected({ fontSize: Number(e.target.value) })} />
                  <label>Text Align</label>
                  <select value={selectedItem.align || "center"} onChange={(e) => updateSelected({ align: e.target.value })}>
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                  <label>Font Weight 字體粗細：{selectedItem.fontWeight || (selectedItem.bold ? 800 : 500)}</label>
                  <input type="range" min="100" max="900" step="100" value={selectedItem.fontWeight || (selectedItem.bold ? 800 : 500)} onChange={(e) => updateSelected({ fontWeight: Number(e.target.value), bold: Number(e.target.value) >= 700 })} />
                  <div className="sp-border-panel">
                    <label className="sp-check-row">
                      <input type="checkbox" checked={!!selectedItem.textStrokeEnabled} onChange={(e) => updateSelected({ textStrokeEnabled: e.target.checked })} /> Text Outline 文字描邊
                    </label>
                    {selectedItem.textStrokeEnabled && (
                      <div className="sp-two-col">
                        <div>
                          <ColorOpacityField label="Outline Color" color={selectedItem.textStrokeColor} alpha={selectedItem.textStrokeOpacity ?? 1} fallback="#ffffff" onColorChange={(value) => updateSelected({ textStrokeColor: value })} onAlphaChange={(value) => updateSelected({ textStrokeOpacity: value })} />
                        </div>
                        <div>
                          <label>Outline Width</label>
                          <input type="number" min="1" max="6" value={selectedItem.textStrokeWidth || 1} onChange={(e) => updateSelected({ textStrokeWidth: Number(e.target.value) })} />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {(selectedItem.type === "polaroid" || selectedItem.type === "image") && (
                <>
                  {selectedItem.type === "polaroid" && (
                    <>
                      <label>Caption</label>
                      <input value={selectedItem.caption} onChange={(e) => updateSelected({ caption: e.target.value })} />
                    </>
                  )}

                  <label className="sp-file-btn">
                    Upload / Replace Image
                    <input type="file" accept="image/*" onChange={handleSelectedImageUpload} />
                  </label>
                  <small className="sp-help">選到拍立得時，上傳圖片會直接放進拍立得框；選到一般圖片時，會替換素材圖片。</small>

                  <label>Image Fit / Crop</label>
                  <select value={selectedItem.fit || "cover"} onChange={(e) => updateSelected({ fit: e.target.value })}>
                    <option value="cover">Crop Fill 裁切填滿</option>
                    <option value="contain">Show Full 顯示完整</option>
                  </select>

                  <label className="sp-check-row">
                    <input
                      type="checkbox"
                      checked={!!selectedItem.cropMode}
                      onChange={(e) => updateSelected({ cropMode: e.target.checked, fit: e.target.checked ? "cover" : selectedItem.fit })}
                    />
                    Drag Crop Mode 拖曳裁切模式
                  </label>
                  <small className="sp-help">開啟後，直接在圖片上拖曳，就能選擇要顯示圖片的哪一部分；關閉後拖曳素材本身是移動位置。</small>

                  <label>Crop Zoom 裁切縮放：{selectedItem.cropZoom ?? 100}%</label>
                  <input
                    type="range"
                    min="100"
                    max="260"
                    value={selectedItem.cropZoom ?? 100}
                    onChange={(e) => updateSelected({ cropZoom: Number(e.target.value), fit: "cover" })}
                  />

                  <div className="sp-two-col">
                    <div>
                      <label>Crop X 左右：{selectedItem.cropX ?? 50}%</label>
                      <input type="range" min="0" max="100" value={selectedItem.cropX ?? 50} onChange={(e) => updateSelected({ cropX: Number(e.target.value), fit: "cover" })} />
                    </div>
                    <div>
                      <label>Crop Y 上下：{selectedItem.cropY ?? 50}%</label>
                      <input type="range" min="0" max="100" value={selectedItem.cropY ?? 50} onChange={(e) => updateSelected({ cropY: Number(e.target.value), fit: "cover" })} />
                    </div>
                  </div>
                  <small className="sp-help">建議開啟 Drag Crop Mode 後，直接在圖片裡拖曳調整顯示區域；也可以用下方滑桿微調。</small>

                  <button type="button" className="sp-wide-btn" onClick={applyCropToSelected}>
                    Apply Crop to Image 套用裁切
                  </button>
                  <small className="sp-help">按下後會把目前畫面真正裁成新圖片，之後下載也會保持裁切結果。</small>

                  <button type="button" className="sp-wide-btn" onClick={removeBackgroundForSelected}>
                    Remove White Background 簡易去背
                  </button>
                  <small className="sp-help">簡易去背適合白底、淺底圖片；不是 AI 精準去背。</small>

                  <label className="sp-check-row">
                    <input
                      type="checkbox"
                      checked={!!selectedItem.imageRounded}
                      onChange={(e) => updateSelected({ imageRounded: e.target.checked })}
                    />
                    Round Image Corners 圖片圓角
                  </label>
                  {selectedItem.imageRounded && (
                    <>
                      <label>Image Corner Radius：{selectedItem.imageRadius ?? 12}px</label>
                      <input
                        type="range"
                        min="0"
                        max="80"
                        value={selectedItem.imageRadius ?? 12}
                        onChange={(e) => updateSelected({ imageRadius: Number(e.target.value) })}
                      />
                    </>
                  )}

                  <label className="sp-check-row">
                    <input
                      type="checkbox"
                      checked={selectedItem.frameColor === "transparent"}
                      onChange={(e) => updateSelected({ frameColor: e.target.checked ? "transparent" : "#fffdf8" })}
                    />
                    Transparent Frame 透明框
                  </label>
                  {selectedItem.frameColor !== "transparent" && (
                    <>
                      <ColorOpacityField label="Frame Color" color={selectedItem.frameColor} alpha={selectedItem.frameOpacity ?? 1} fallback="#fffdf8" onColorChange={(value) => updateSelected({ frameColor: value })} onAlphaChange={(value) => updateSelected({ frameOpacity: value })} />
                    </>
                  )}
                </>
              )}

              <div className="sp-action-row">
                <button onClick={duplicateSelected}>Duplicate</button>
                <button onClick={bringForward}>Front</button>
                <button onClick={sendBackward}>Back</button>
              </div>
              <button className="sp-danger-btn" onClick={deleteSelected}>Delete Selected</button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

const scrapbookStyles = `
.sp-page {
  max-width: 1280px;
  margin: 0 auto;
  color: #3b2a20;
}

.sp-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
  margin-bottom: 18px;
  padding: 22px 26px;
  background: rgba(255, 250, 244, 0.85);
  border: 1px solid rgba(120, 80, 50, 0.15);
  border-radius: 26px;
  box-shadow: 0 18px 45px rgba(87, 56, 34, 0.12);
}

.sp-heading h2 {
  margin: 0;
  color: #6a3d24;
  font-size: 30px;
}

.sp-heading p {
  margin: 6px 0 0;
  color: #8a674d;
}

.sp-layout {
  display: grid;
  grid-template-columns: 280px minmax(840px, 1fr) 280px;
  gap: 18px;
  align-items: start;
}

.sp-panel {
  background: rgba(255, 250, 244, 0.88);
  border: 1px solid rgba(120, 80, 50, 0.15);
  border-radius: 24px;
  padding: 20px;
  box-shadow: 0 18px 45px rgba(87, 56, 34, 0.10);
  position: sticky;
  top: 18px;
  max-height: calc(100vh - 36px);
  overflow: auto;
}

.sp-panel h3 {
  margin: 0 0 16px;
  color: #6a3d24;
}

.sp-panel label {
  display: block;
  margin-top: 12px;
  margin-bottom: 7px;
  color: #6d4b36;
  font-weight: 700;
  font-size: 13px;
}

.sp-panel input,
.sp-panel textarea,
.sp-panel select {
  width: 100%;
  border: 1px solid #d6bca5;
  border-radius: 14px;
  padding: 10px 12px;
  background: #fffaf5;
  color: #4b3325;
  outline: none;
}

.sp-panel input[type="color"] {
  height: 42px;
  padding: 4px;
  border-radius: 14px;
  cursor: pointer;
  background: #fffaf5;
}

.sp-panel input[type="color"]::-webkit-color-swatch-wrapper {
  padding: 0;
}

.sp-panel input[type="color"]::-webkit-color-swatch {
  border: none;
  border-radius: 10px;
}

.sp-panel textarea {
  min-height: 96px;
  resize: vertical;
}

.sp-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.sp-tool-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
  margin-top: 16px;
}

.sp-panel button,
.sp-primary-btn,
.sp-wide-btn,
.sp-danger-btn,
.sp-file-btn {
  border: none;
  border-radius: 999px;
  padding: 11px 14px;
  background: linear-gradient(135deg, #f1dfcd, #dfc0a3);
  color: #6c442d;
  cursor: pointer;
  font-weight: 900;
  text-align: center;
  letter-spacing: 0.2px;
  box-shadow: 0 8px 18px rgba(92, 55, 31, 0.12);
  transition: transform 0.15s ease, filter 0.15s ease, box-shadow 0.15s ease;
}

.sp-panel button:hover,
.sp-primary-btn:hover,
.sp-wide-btn:hover,
.sp-danger-btn:hover,
.sp-file-btn:hover {
  filter: brightness(1.02);
  transform: translateY(-1px);
  box-shadow: 0 12px 24px rgba(92, 55, 31, 0.16);
}

.sp-panel button:disabled,
.sp-primary-btn:disabled,
.sp-wide-btn:disabled,
.sp-danger-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}

.sp-primary-btn {
  background: linear-gradient(135deg, #8a5633, #b9764a);
  color: #fff;
  min-width: 155px;
}


.sp-primary-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.sp-wide-btn,
.sp-danger-btn {
  width: 100%;
  margin-top: 12px;
}

.sp-draw-active {
  width: 100%;
  margin-top: 12px;
  background: linear-gradient(135deg, #4b91ff, #7dc2ff) !important;
  color: #fff !important;
}

.sp-draw-tool {
  margin-top: 14px;
  padding: 12px;
  background: rgba(255,255,255,0.55);
  border: 1px dashed rgba(120, 80, 50, 0.2);
  border-radius: 18px;
}

.sp-danger-btn {
  background: #b86b5b !important;
  color: #fff !important;
}

.sp-file-btn {
  display: block;
  margin-top: 12px;
  background: #8a5633;
  color: #fff;
}

.sp-file-btn input {
  display: none;
}

.sp-help {
  display: block;
  color: #96755c;
  font-size: 12px;
  line-height: 1.45;
  margin-top: 6px;
}

.sp-canvas-wrap {
  overflow: auto;
  padding-bottom: 24px;
}

.sp-canvas-toolbar {
  margin-bottom: 10px;
  padding: 10px 14px;
  background: rgba(255, 250, 244, 0.8);
  border-radius: 16px;
  color: #8a674d;
  font-size: 13px;
}

.sp-canvas {
  width: 800px;
  height: 1100px;
  position: relative;
  overflow: hidden;
  border: 2px solid;
  border-radius: 26px;
  box-shadow: 0 24px 60px rgba(87, 56, 34, 0.18);
  margin: 0 auto;
  user-select: none;
}

.sp-style-vintage {
  background-image: radial-gradient(circle at 20px 20px, rgba(128, 91, 55, 0.055) 0 1px, transparent 1px);
  background-size: 22px 22px;
}

.sp-style-kawaii {
  background-image: radial-gradient(circle at 18px 18px, rgba(229, 93, 154, 0.11) 0 3px, transparent 3px);
  background-size: 34px 34px;
}

.sp-style-minimal {
  background-image: linear-gradient(rgba(0,0,0,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.035) 1px, transparent 1px);
  background-size: 40px 40px;
}

.sp-uploaded-template {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  z-index: 0;
  pointer-events: none;
  background: white;
}

.sp-template {
  position: absolute;
  inset: 48px;
  z-index: 1;
  pointer-events: none;
  color: #4c3223;
}

.sp-template-title {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 24px;
  border-bottom: 3px solid rgba(120, 80, 50, 0.18);
  padding-bottom: 12px;
}

.sp-template-title span {
  font-family: Georgia, serif;
  font-size: 42px;
  font-weight: 700;
}

.sp-template-title strong {
  font-size: 24px;
  color: rgba(76, 50, 35, 0.72);
}

.sp-week-head {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  margin-bottom: 8px;
}

.sp-week-head b {
  text-align: center;
  padding: 10px 0;
  background: rgba(255,255,255,0.7);
  border-radius: 14px;
}

.sp-calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}

.sp-calendar-grid div {
  height: 92px;
  background: rgba(255,255,255,0.62);
  border: 1px solid rgba(120, 80, 50, 0.13);
  border-radius: 15px;
  padding: 9px;
}

.sp-calendar-grid span {
  font-weight: 800;
  color: rgba(76, 50, 35, 0.82);
}

.sp-blank-day {
  opacity: 0.35;
}

.sp-month-notes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: 18px;
}

.sp-month-notes > div,
.sp-week-bottom section,
.sp-daily-grid section {
  background: rgba(255,255,255,0.66);
  border: 1px solid rgba(120, 80, 50, 0.13);
  border-radius: 18px;
  padding: 14px 16px;
}

.sp-template h4 {
  margin: 0 0 10px;
  color: #6a3d24;
}

.sp-template p {
  margin: 8px 0;
  min-height: 18px;
  border-bottom: 1px dashed rgba(120, 80, 50, 0.2);
}

.sp-weekly-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 10px;
}

.sp-weekly-grid > div {
  min-height: 420px;
  background: rgba(255,255,255,0.62);
  border: 1px solid rgba(120, 80, 50, 0.13);
  border-radius: 18px;
  padding: 12px;
}

.sp-weekly-grid h4 {
  font-size: 15px;
}

.sp-weekly-grid small {
  display: block;
  margin-bottom: 12px;
  color: #96755c;
}

.sp-week-bottom {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: 18px;
}

.sp-daily-grid {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  grid-template-rows: 1.2fr 0.8fr;
  gap: 16px;
  height: 880px;
}

.sp-item {
  position: absolute;
  cursor: grab;
  touch-action: none;
  z-index: 2;
}

.sp-item:active {
  cursor: grabbing;
}

.sp-selected {
  outline: 3px solid #4aa3ff;
  outline-offset: 4px;
  border-radius: 12px;
}

.sp-text-box {
  width: 100%;
  height: 100%;
  padding: 8px 10px;
  white-space: pre-wrap;
  overflow: hidden;
  border-radius: 12px;
  line-height: 1.2;
}

.sp-sticker {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  text-align: center;
  font-weight: 900;
  letter-spacing: 0.5px;
  box-shadow: 0 8px 18px rgba(0,0,0,0.10);
  padding: 8px;
}

.sp-sticker-circle {
  border-radius: 50%;
}

.sp-sticker-rounded {
  border-radius: 22px;
}

.sp-sticker-pill {
  border-radius: 999px;
}

.sp-sticker-heart,
.sp-sticker-star {
  background: transparent !important;
  border: none !important;
  box-shadow: none;
  font-size: 72px !important;
  line-height: 1;
  text-shadow: 0 6px 14px rgba(0,0,0,0.12);
}

.sp-tape {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  font-weight: 900;
  letter-spacing: 1px;
  border: 1px solid;
  box-shadow: 0 8px 18px rgba(0,0,0,0.10);
  overflow: hidden;
}

.sp-tape-solid {
  background-image: none;
}

.sp-tape-dot {
  background-image: radial-gradient(rgba(255,255,255,0.65) 0 3px, transparent 3px);
  background-size: 18px 18px;
}

.sp-tape-grid {
  background-image: linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px);
  background-size: 16px 16px;
}

.sp-tape-stripe {
  background-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.42) 0 9px, transparent 9px 18px);
}

.sp-tape-checker {
  background-image: linear-gradient(45deg, rgba(255,255,255,0.44) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.44) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.44) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.44) 75%);
  background-size: 22px 22px;
  background-position: 0 0, 0 11px, 11px -11px, -11px 0px;
}

.sp-tape-diagonal {
  background-image: repeating-linear-gradient(-35deg, rgba(255,255,255,0.55) 0 6px, transparent 6px 14px);
}

.sp-tape-wave {
  background-image: radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.52) 0 22%, transparent 24%);
  background-size: 28px 18px;
}

.sp-tape-flower {
  background-image: radial-gradient(circle at 10px 10px, rgba(255,255,255,0.75) 0 3px, transparent 4px), radial-gradient(circle at 16px 10px, rgba(255,255,255,0.58) 0 3px, transparent 4px), radial-gradient(circle at 13px 6px, rgba(255,255,255,0.58) 0 3px, transparent 4px), radial-gradient(circle at 13px 14px, rgba(255,255,255,0.58) 0 3px, transparent 4px);
  background-size: 32px 24px;
}

.sp-tape-heart {
  background-image: radial-gradient(circle at 9px 10px, rgba(255,255,255,0.72) 0 5px, transparent 6px), radial-gradient(circle at 17px 10px, rgba(255,255,255,0.72) 0 5px, transparent 6px), linear-gradient(45deg, transparent 0 42%, rgba(255,255,255,0.72) 42% 58%, transparent 58%);
  background-size: 32px 24px;
}

.sp-tape-star {
  background-image: radial-gradient(circle at 12px 12px, rgba(255,255,255,0.78) 0 2px, transparent 3px), radial-gradient(circle at 24px 18px, rgba(255,255,255,0.5) 0 2px, transparent 3px);
  background-size: 36px 26px;
}

.sp-note {
  width: 100%;
  height: 100%;
  padding: 16px;
  border: 1px solid;
  border-radius: 6px 18px 18px 18px;
  box-shadow: 0 12px 24px rgba(0,0,0,0.12);
  overflow: hidden;
}

.sp-note strong {
  display: block;
  margin-bottom: 8px;
  font-size: 1.1em;
}

.sp-note pre {
  margin: 0;
  white-space: pre-wrap;
  font-family: inherit;
  line-height: 1.45;
}

.sp-note-lines {
  background-image: linear-gradient(transparent 28px, rgba(0,0,0,0.13) 29px);
  background-size: 100% 30px;
}

.sp-note-dots {
  background-image: radial-gradient(rgba(0,0,0,0.14) 0 1px, transparent 1px);
  background-size: 14px 14px;
}

.sp-note-grid {
  background-image: linear-gradient(rgba(0,0,0,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.10) 1px, transparent 1px);
  background-size: 20px 20px;
}

.sp-note-todo pre {
  line-height: 1.7;
}

.sp-polaroid,
.sp-image-card {
  width: 100%;
  height: 100%;
  border: 1px solid;
  box-shadow: 0 14px 28px rgba(0,0,0,0.14);
  overflow: hidden;
}

.sp-polaroid {
  padding: 13px 13px 34px;
  border-radius: 4px;
}

.sp-polaroid img {
  width: 100%;
  height: calc(100% - 34px);
  object-fit: cover;
  border-radius: 2px;
}

.sp-polaroid p {
  margin: 8px 0 0;
  text-align: center;
  font-size: 17px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sp-polaroid-empty {
  height: calc(100% - 34px);
  display: grid;
  place-items: center;
  background: #efe6dc;
  color: #8a674d;
}

.sp-image-card {
  border-radius: 16px;
  padding: 8px;
}

.sp-image-card img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 10px;
}

.sp-selected-label {
  display: inline-block;
  background: #f4e5d6;
  color: #6a3d24;
  border-radius: 999px;
  padding: 7px 12px;
  font-weight: 900;
  margin-bottom: 10px;
}


.sp-border-panel {
  padding: 10px;
  border: 1px dashed rgba(120, 80, 50, 0.22);
  border-radius: 14px;
  background: rgba(255,255,255,0.45);
  margin: 8px 0 12px;
}

.sp-border-panel label {
  margin-top: 6px;
}

.sp-check-row {
  display: flex !important;
  align-items: center;
  gap: 8px;
}

.sp-check-row input {
  width: auto;
}

.sp-action-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  margin-top: 14px;
}

.sp-work-list {
  margin-top: 12px;
  display: grid;
  gap: 10px;
}

.sp-work {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 10px;
  padding: 9px;
  border-radius: 16px;
  background: #fff7f0;
  border: 1px solid #e7cfb8;
}

.sp-work img {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: 12px;
  background: #efe0d1;
}

.sp-work strong,
.sp-work span {
  display: block;
  font-size: 12px;
}

.sp-work span {
  color: #8a674d;
  margin: 3px 0 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 150px;
}

.sp-work button {
  width: 100%;
  padding: 7px 8px;
  margin-top: 4px;
  font-size: 12px;
}

.sp-empty-setting {
  color: #96755c;
  line-height: 1.6;
}

.sp-resize-handle {
  position: absolute;
  right: -10px;
  bottom: -10px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #4aa3ff;
  border: 3px solid #ffffff;
  box-shadow: 0 4px 12px rgba(0,0,0,0.22);
  cursor: nwse-resize;
  z-index: 999;
}

.sp-resize-handle::after {
  content: "";
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 6px;
  height: 6px;
  border-right: 2px solid white;
  border-bottom: 2px solid white;
}

@media (max-width: 1180px) {
  .sp-layout {
    grid-template-columns: 1fr;
  }

  .sp-panel {
    position: static;
    max-height: none;
  }

  .sp-canvas-wrap {
    width: 100%;
  }
}
.sp-crop-area {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: block;
  touch-action: none;
}

.sp-crop-area img {
  width: 100%;
  height: 100%;
  display: block;
  user-select: none;
  pointer-events: auto;
}

.sp-crop-active {
  cursor: grab;
  outline: 2px dashed rgba(80, 120, 255, 0.75);
  outline-offset: -4px;
}

.sp-crop-active:active {
  cursor: grabbing;
}

.sp-box {
  width: 100%;
  height: 100%;
  padding: 10px;
  white-space: pre-wrap;
  overflow: hidden;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  line-height: 1.35;
}

.sp-drawing-layer {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.sp-template-actions {
  display: grid;
  gap: 8px;
  margin: 8px 0 12px;
}

.sp-template-actions button {
  border: none;
  border-radius: 12px;
  padding: 10px 12px;
  background: #8a5633;
  color: #fff;
  font-weight: 800;
  cursor: pointer;
}


.sp-polaroid .sp-crop-area {
  height: calc(100% - 44px);
  background: #f2eee8;
}

.sp-image-card .sp-crop-area {
  height: 100%;
}


/* 48h-friendly refinements */
.sp-page {
  max-width: min(1280px, calc(100vw - 28px));
  overflow-x: hidden;
}

.sp-heading-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.sp-secondary-export {
  background: linear-gradient(135deg, #5f7e59, #9cbc8a) !important;
}

.sp-wall-export {
  background: linear-gradient(135deg, #5263c9, #a074d9) !important;
}

.sp-layout {
  grid-template-columns: 220px 800px 220px;
  gap: 12px;
  justify-content: center;
}

.sp-panel {
  padding: 14px;
}

.sp-panel button,
.sp-primary-btn,
.sp-wide-btn,
.sp-danger-btn,
.sp-file-btn,
.sp-history-btn {
  min-height: 42px;
  border: 1px solid rgba(255,255,255,0.35);
}

.sp-history-tools {
  padding: 12px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(255,255,255,0.75), rgba(244,229,214,0.75));
  border: 1px solid rgba(138,86,51,0.16);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
  margin-bottom: 14px;
}

.sp-history-row {
  display: grid;
  grid-template-columns: 82px 1fr;
  gap: 8px;
  margin-top: 8px;
}

.sp-history-row select {
  padding: 9px 8px;
  border-radius: 14px;
}

.sp-history-btn {
  margin: 0 !important;
  padding: 9px 10px !important;
  width: 100%;
  background: linear-gradient(135deg, #8a5633, #c4865c) !important;
  color: #fff !important;
}

.sp-redo-btn {
  background: linear-gradient(135deg, #5263c9, #8e70d4) !important;
}

.sp-note-shape-square { border-radius: 4px !important; }
.sp-note-shape-rounded { border-radius: 6px 22px 22px 22px !important; }
.sp-note-shape-pill { border-radius: 44px !important; }
.sp-note-shape-ticket { border-radius: 16px !important; clip-path: polygon(0 0, 100% 0, 100% 38%, 95% 50%, 100% 62%, 100% 100%, 0 100%, 0 62%, 5% 50%, 0 38%); }
.sp-note-shape-tag { border-radius: 12px 28px 28px 12px !important; clip-path: polygon(0 0, 85% 0, 100% 50%, 85% 100%, 0 100%); padding-right: 28px; }
.sp-note-shape-bubble { border-radius: 28px 28px 28px 8px !important; }

.sp-template {
  padding: 18px;
  border-radius: 28px;
}

.sp-template-vintage {
  background: linear-gradient(135deg, rgba(255,247,235,0.72), rgba(238,216,191,0.48));
  border: 2px double rgba(138,86,51,0.28);
}

.sp-template-kawaii {
  background: radial-gradient(circle at 18px 18px, rgba(255,181,208,0.22) 0 8px, transparent 9px), linear-gradient(135deg, rgba(255,250,253,0.9), rgba(255,224,237,0.55));
  border: 2px solid rgba(229,93,154,0.22);
}

.sp-template-minimal {
  background: linear-gradient(180deg, rgba(255,255,255,0.94), rgba(246,246,242,0.82));
  border: 1px solid rgba(40,40,40,0.12);
}

.sp-template-botanical {
  background: radial-gradient(circle at 96% 6%, rgba(139,191,125,0.28) 0 52px, transparent 53px), linear-gradient(135deg, rgba(251,255,249,0.94), rgba(220,237,213,0.56));
  border: 2px solid rgba(79,125,74,0.18);
}

.sp-template-modern {
  background: linear-gradient(135deg, rgba(251,252,255,0.92), rgba(228,232,255,0.68));
  border: 2px solid rgba(82,99,201,0.18);
  box-shadow: inset 0 0 0 8px rgba(142,112,212,0.06);
}

.sp-template-title {
  padding: 12px 14px;
  border-radius: 20px;
  background: rgba(255,255,255,0.62);
}

.sp-template-botanical .sp-template-title::before,
.sp-template-kawaii .sp-template-title::before,
.sp-template-modern .sp-template-title::before,
.sp-template-vintage .sp-template-title::before {
  content: "✦";
  margin-right: 10px;
  color: currentColor;
}

.sp-canvas-wrap {
  overflow: visible;
  max-width: 800px;
}

.sp-canvas-toolbar {
  width: 800px;
  box-sizing: border-box;
}

@media (max-width: 1264px) {
  .sp-layout {
    grid-template-columns: 1fr;
  }
  .sp-canvas-wrap,
  .sp-canvas-toolbar {
    max-width: 100%;
    width: 100%;
  }
  .sp-canvas {
    margin-inline: auto;
  }
}


/* requested final refinements */
html, body {
  overflow-x: hidden;
}

.sp-page, .sp-page * {
  box-sizing: border-box;
}

.sp-page {
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
  padding-inline: 10px;
}

.sp-layout {
  grid-template-columns: 220px minmax(0, 800px) 220px !important;
  max-width: 1264px;
  margin-inline: auto;
  overflow: visible;
}

.sp-panel {
  position: static !important;
  max-height: none !important;
  overflow: visible !important;
}

.sp-setting-fields {
  overflow: visible;
}

.sp-history-menus {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.sp-step-menu {
  position: relative;
}

.sp-step-menu summary {
  list-style: none;
  display: block;
  text-align: center;
}

.sp-step-menu summary::-webkit-details-marker {
  display: none;
}

.sp-disabled-summary {
  opacity: 0.55;
}

.sp-step-menu-panel {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  margin-top: 8px;
  padding: 8px;
  border-radius: 16px;
  background: rgba(255,255,255,0.72);
  border: 1px solid rgba(138,86,51,0.14);
}

.sp-step-menu-panel button {
  padding: 8px 4px !important;
  min-height: 36px !important;
  font-size: 11px;
  border-radius: 12px !important;
}

.sp-color-field {
  display: block;
  padding: 8px;
  border-radius: 14px;
  background: rgba(255,255,255,0.45);
  border: 1px solid rgba(138,86,51,0.12);
  margin-top: 6px;
}

.sp-color-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.sp-color-head label,
.sp-mini-label {
  margin: 0 0 6px !important;
}

.sp-color-swatch {
  width: 34px;
  height: 24px;
  border-radius: 8px;
  border: 1px solid rgba(0,0,0,0.18);
  box-shadow: inset 0 0 0 2px rgba(255,255,255,0.5);
}

.sp-color-field input[type="color"] {
  height: 38px;
  margin-bottom: 8px;
}

.sp-color-field input[type="range"] {
  padding-inline: 0;
}

.sp-draw-tool select,
.sp-draw-tool input[type="range"] {
  margin-bottom: 8px;
}

.sp-template-vintage .sp-template-title {
  background: linear-gradient(135deg, rgba(255,244,226,.92), rgba(218,178,139,.42));
  border: 1px solid rgba(138,86,51,.28);
  font-family: Georgia, serif;
}

.sp-template-vintage .sp-calendar-grid div,
.sp-template-vintage .sp-weekly-grid > div,
.sp-template-vintage .sp-daily-grid section {
  background: rgba(255,247,234,.74);
  border: 1px dashed rgba(138,86,51,.32);
  box-shadow: inset 0 0 0 4px rgba(255,255,255,.25);
}

.sp-template-kawaii .sp-template-title {
  background: linear-gradient(135deg, rgba(255,224,237,.96), rgba(255,250,253,.78));
  border: 2px solid rgba(255,181,208,.55);
  color: #a93f72;
}

.sp-template-kawaii .sp-calendar-grid div,
.sp-template-kawaii .sp-weekly-grid > div,
.sp-template-kawaii .sp-daily-grid section {
  background: radial-gradient(circle at 20px 18px, rgba(255,181,208,.20) 0 8px, transparent 9px), rgba(255,255,255,.78);
  border: 2px solid rgba(255,181,208,.34);
  border-radius: 24px;
}

.sp-template-minimal .sp-template-title {
  background: #fff;
  border: 0;
  border-bottom: 2px solid rgba(0,0,0,.18);
  border-radius: 0;
  color: #222;
}

.sp-template-minimal .sp-calendar-grid div,
.sp-template-minimal .sp-weekly-grid > div,
.sp-template-minimal .sp-daily-grid section {
  background: rgba(255,255,255,.86);
  border: 1px solid rgba(0,0,0,.14);
  border-radius: 6px;
  box-shadow: none;
}

.sp-template-botanical .sp-template-title {
  background: linear-gradient(90deg, rgba(220,237,213,.9), rgba(251,255,249,.8));
  border: 1px solid rgba(79,125,74,.24);
  color: #315c36;
}

.sp-template-botanical .sp-calendar-grid div,
.sp-template-botanical .sp-weekly-grid > div,
.sp-template-botanical .sp-daily-grid section {
  background: radial-gradient(circle at 96% 5%, rgba(139,191,125,.22) 0 20px, transparent 21px), rgba(251,255,249,.82);
  border: 1px solid rgba(79,125,74,.20);
  border-radius: 22px 10px 22px 10px;
}

.sp-template-modern .sp-template-title {
  background: linear-gradient(135deg, rgba(82,99,201,.92), rgba(142,112,212,.86));
  color: #fff;
  border: 0;
  box-shadow: 0 10px 24px rgba(82,99,201,.20);
}

.sp-template-modern .sp-calendar-grid div,
.sp-template-modern .sp-weekly-grid > div,
.sp-template-modern .sp-daily-grid section {
  background: linear-gradient(135deg, rgba(255,255,255,.85), rgba(228,232,255,.82));
  border: 1px solid rgba(82,99,201,.18);
  border-radius: 18px;
  box-shadow: 0 8px 22px rgba(82,99,201,.08);
}

.sp-template-vintage .sp-week-head b { background: #d9b890; color: #fff; }
.sp-template-kawaii .sp-week-head b { background: #ffb5d0; color: #fff; border-radius: 999px; }
.sp-template-minimal .sp-week-head b { background: #222; color: #fff; border-radius: 4px; }
.sp-template-botanical .sp-week-head b { background: #8bbf7d; color: #fff; }
.sp-template-modern .sp-week-head b { background: #5263c9; color: #fff; }

@media (max-width: 1180px) {
  .sp-layout {
    grid-template-columns: 1fr !important;
  }
  .sp-canvas {
    transform: scale(.84);
    transform-origin: top center;
    margin-bottom: -176px;
  }
  .sp-canvas-toolbar {
    width: min(800px, 100%);
  }
}

`;
