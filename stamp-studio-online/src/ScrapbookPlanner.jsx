import { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";

const STORAGE_KEYS = {
  postcards: "stampStudio_savedPostcards",
  photoBooths: "stampStudio_savedPhotoBooths",
  scrapbooks: "lifeTracker_savedScrapbooks"
};

const IMAGE_DB_NAME = "stampStudioImageDB";
const IMAGE_STORE_NAME = "images";

const CANVAS_W = 800;
const CANVAS_H = 1100;

// Keep the visible canvas under the center column width while preserving real aspect ratios.
const canvasPresets = {
  phone: { label: "Phone 手機 9:16", width: 450, height: 800 },
  tablet: { label: "Tablet 平板 3:4", width: 600, height: 800 },
  a4: { label: "A4 紙張 1:√2", width: 760, height: 1075 },
  b5: { label: "B5 紙張 1:√2", width: 710, height: 1004 },
  square: { label: "Square 方形 1:1", width: 820, height: 820 }
};

function getCanvasSize(preset, orientation) {
  const picked = canvasPresets[preset] || canvasPresets.a4;
  let w = Number(picked.width || CANVAS_W);
  let h = Number(picked.height || CANVAS_H);
  if (orientation === "landscape") [w, h] = [h, w];

  // Keep every preset at the correct visual ratio while fitting the center column.
  const maxW = 660;
  const maxH = 730;
  const scale = Math.min(maxW / w, maxH / h, 1);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

function Bi({ en, zh }) {
  return (
    <span className="sp-bi">
      <span>{en}</span>
      <span>{zh}</span>
    </span>
  );
}

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
  while (cells.length < 42) cells.push(null);
  return cells.slice(0, 42);
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


function roundRectPath(ctx, x, y, width, height, radius = 0) {
  const r = Math.max(0, Math.min(Number(radius || 0), Math.abs(width) / 2, Math.abs(height) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function canvasStarPath(ctx, cx, cy, outer, inner, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    const radius = i % 2 === 0 ? outer : inner;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function canvasHeartPath(ctx, x, y, width, height) {
  ctx.beginPath();
  const top = y + height * 0.25;
  ctx.moveTo(x + width / 2, y + height * 0.92);
  ctx.bezierCurveTo(x + width * 0.05, y + height * 0.58, x + width * 0.02, top, x + width * 0.25, top);
  ctx.bezierCurveTo(x + width * 0.38, top, x + width * 0.48, y + height * 0.36, x + width / 2, y + height * 0.47);
  ctx.bezierCurveTo(x + width * 0.52, y + height * 0.36, x + width * 0.62, top, x + width * 0.75, top);
  ctx.bezierCurveTo(x + width * 0.98, top, x + width * 0.95, y + height * 0.58, x + width / 2, y + height * 0.92);
  ctx.closePath();
}

function wrapCanvasText(ctx, text, maxWidth) {
  const source = String(text || "").split("\n");
  const lines = [];
  source.forEach((paragraph) => {
    if (!paragraph) {
      lines.push("");
      return;
    }
    const words = paragraph.split(/(\s+)/).filter(Boolean);
    let line = "";
    words.forEach((word) => {
      const test = line + word;
      if (ctx.measureText(test).width > maxWidth && line.trim()) {
        lines.push(line.trimEnd());
        line = word.trimStart();
      } else {
        line = test;
      }
    });
    lines.push(line.trimEnd());
  });
  return lines;
}

function drawCanvasTextBlock(ctx, text, x, y, width, height, options = {}) {
  const fontSize = Number(options.fontSize || 16);
  const fontFamily = options.fontFamily || "Trebuchet MS";
  const fontWeight = options.fontWeight || (options.bold ? 700 : 400);
  const lineHeight = fontSize * 1.22;
  ctx.save();
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textBaseline = "top";
  ctx.textAlign = options.align === "center" ? "center" : options.align === "right" ? "right" : "left";
  const padding = Number(options.padding ?? 10);
  const maxWidth = Math.max(1, width - padding * 2);
  const lines = wrapCanvasText(ctx, text, maxWidth);
  const startX = options.align === "center" ? x + width / 2 : options.align === "right" ? x + width - padding : x + padding;
  let yy = y + padding;
  const fillColor = options.color || "#4c3223";
  const strokeEnabled = options.textStrokeEnabled;
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  lines.forEach((line) => {
    if (yy + lineHeight > y + height - 2) return;
    if (strokeEnabled) {
      ctx.strokeStyle = options.textStrokeColor || "#ffffff";
      ctx.lineWidth = Math.max(1, Number(options.textStrokeWidth || 1)) * 2;
      ctx.strokeText(line, startX, yy);
    }
    ctx.fillStyle = fillColor;
    ctx.fillText(line, startX, yy);
    yy += lineHeight;
  });
  ctx.restore();
}

function drawBorder(ctx, item, width, height, fallbackRadius = 12) {
  if (!itemHasBorder(item)) return;
  ctx.save();
  ctx.strokeStyle = colorWithAlpha(item.borderColor || "#8a6b50", item.borderOpacity ?? 1, "#8a6b50");
  ctx.lineWidth = Number(item.borderWidth || 1);
  roundRectPath(ctx, ctx.lineWidth / 2, ctx.lineWidth / 2, width - ctx.lineWidth, height - ctx.lineWidth, Number(item.borderRadius ?? fallbackRadius));
  ctx.stroke();
  ctx.restore();
}

function applyItemTransform(ctx, item) {
  const x = Number(item.x || 0);
  const y = Number(item.y || 0);
  const w = Number(item.width || 1);
  const h = Number(item.height || 1);
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate((Number(item.rotation || 0) * Math.PI) / 180);
  ctx.translate(-w / 2, -h / 2);
  return { w, h };
}

function drawTapePattern(ctx, pattern, color, width, height) {
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  if (pattern === "dots" || pattern === "flower" || pattern === "heart" || pattern === "star") {
    for (let yy = 10; yy < height; yy += 18) {
      for (let xx = 10; xx < width; xx += 22) {
        ctx.beginPath();
        if (pattern === "heart") canvasHeartPath(ctx, xx - 5, yy - 5, 12, 12);
        else if (pattern === "star") canvasStarPath(ctx, xx, yy, 7, 3, 5);
        else if (pattern === "flower") {
          for (let p = 0; p < 6; p += 1) {
            ctx.moveTo(xx, yy);
            ctx.arc(xx + Math.cos(p) * 4, yy + Math.sin(p) * 4, 4, 0, Math.PI * 2);
          }
        } else ctx.arc(xx, yy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (pattern === "grid" || pattern === "checker") {
    for (let xx = 0; xx < width; xx += 16) { ctx.beginPath(); ctx.moveTo(xx, 0); ctx.lineTo(xx, height); ctx.stroke(); }
    for (let yy = 0; yy < height; yy += 16) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(width, yy); ctx.stroke(); }
    if (pattern === "checker") {
      for (let yy = 0; yy < height; yy += 16) for (let xx = 0; xx < width; xx += 16) if (((xx + yy) / 16) % 2 === 0) ctx.fillRect(xx, yy, 16, 16);
    }
  } else if (pattern === "diagonal" || pattern === "stripe") {
    for (let xx = -height; xx < width; xx += 18) { ctx.beginPath(); ctx.moveTo(xx, height); ctx.lineTo(xx + height, 0); ctx.stroke(); }
  } else if (pattern === "wave") {
    for (let yy = 10; yy < height; yy += 18) {
      ctx.beginPath();
      for (let xx = 0; xx < width; xx += 8) {
        const y = yy + Math.sin(xx / 12) * 5;
        if (xx === 0) ctx.moveTo(xx, y); else ctx.lineTo(xx, y);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawNotePattern(ctx, item, width, height) {
  const variant = item.variant || "blank";
  ctx.save();
  ctx.strokeStyle = "rgba(80,55,35,0.18)";
  ctx.fillStyle = "rgba(80,55,35,0.22)";
  if (variant === "lines" || variant === "todo") {
    for (let y = 48; y < height - 12; y += 22) {
      ctx.beginPath(); ctx.moveTo(14, y); ctx.lineTo(width - 14, y); ctx.stroke();
    }
  }
  if (variant === "dots") {
    for (let y = 24; y < height - 8; y += 18) for (let x = 18; x < width - 8; x += 18) { ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill(); }
  }
  if (variant === "grid") {
    for (let x = 18; x < width; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = 18; y < height; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
  }
  if (variant === "todo") {
    for (let y = 42; y < height - 12; y += 22) ctx.strokeRect(18, y - 8, 10, 10);
  }
  ctx.restore();
}

function drawImageFit(ctx, img, x, y, width, height, fit = "contain", cropX = 50, cropY = 50, cropZoom = 100, radius = 0) {
  ctx.save();
  roundRectPath(ctx, x, y, width, height, radius);
  ctx.clip();
  const zoom = Math.max(1, Number(cropZoom || 100) / 100);
  const scale = (fit === "cover" ? Math.max(width / img.width, height / img.height) : Math.min(width / img.width, height / img.height)) * zoom;
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const maxOffsetX = Math.max(0, drawW - width);
  const maxOffsetY = Math.max(0, drawH - height);
  const dx = x - maxOffsetX * (Number(cropX ?? 50) / 100);
  const dy = y - maxOffsetY * (Number(cropY ?? 50) / 100);
  ctx.drawImage(img, dx, dy, drawW, drawH);
  ctx.restore();
}

async function drawScrapbookItemToCanvas(ctx, item, canvasW, canvasH, theme) {
  ctx.save();
  ctx.globalAlpha = item.opacity ?? 1;
  const { w, h } = applyItemTransform(ctx, item);

  if (item.type === "text") {
    const radius = Number(item.borderRadius ?? 12);
    if (item.bgColor && item.bgColor !== "transparent") {
      ctx.fillStyle = colorWithAlpha(item.bgColor, item.bgOpacity ?? 1, "#ffffff");
      roundRectPath(ctx, 0, 0, w, h, radius);
      ctx.fill();
    }
    drawBorder(ctx, item, w, h, radius);
    drawCanvasTextBlock(ctx, item.text, 0, 0, w, h, {
      fontSize: item.fontSize,
      fontFamily: item.fontFamily,
      fontWeight: item.fontWeight || (item.bold ? 700 : 400),
      color: colorWithAlpha(item.color, item.colorOpacity ?? 1, theme.text),
      textStrokeEnabled: item.textStrokeEnabled,
      textStrokeColor: colorWithAlpha(item.textStrokeColor, item.textStrokeOpacity ?? 1, "#ffffff"),
      textStrokeWidth: item.textStrokeWidth,
      padding: 10
    });
  }

  if (item.type === "sticker") {
    ctx.fillStyle = colorWithAlpha(item.color, item.colorOpacity ?? 1, theme.sticker);
    ctx.strokeStyle = colorWithAlpha(item.borderColor || theme.accent, item.borderOpacity ?? 1, theme.accent);
    ctx.lineWidth = itemHasBorder(item) ? Number(item.borderWidth || 1) : 0;
    const shape = item.shape || "rounded";
    if (shape === "circle") { ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.min(w, h) / 2 - ctx.lineWidth / 2, 0, Math.PI * 2); }
    else if (shape === "heart") canvasHeartPath(ctx, 0, 0, w, h);
    else if (shape === "star") canvasStarPath(ctx, w / 2, h / 2, Math.min(w, h) * 0.48, Math.min(w, h) * 0.22, 5);
    else if (shape === "label") { ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(w - 22, 0); ctx.lineTo(w, h / 2); ctx.lineTo(w - 22, h); ctx.lineTo(10, h); ctx.quadraticCurveTo(0, h, 0, h - 10); ctx.lineTo(0, 10); ctx.quadraticCurveTo(0, 0, 10, 0); ctx.closePath(); }
    else roundRectPath(ctx, 0, 0, w, h, shape === "pill" ? Math.min(w, h) / 2 : Number(item.borderRadius ?? 18));
    ctx.fill();
    if (ctx.lineWidth > 0 && shape !== "heart" && shape !== "star") ctx.stroke();
    const displayText = shape === "heart" ? "♥" : shape === "star" ? "★" : item.text;
    drawCanvasTextBlock(ctx, displayText, 0, 0, w, h, {
      fontSize: shape === "heart" || shape === "star" ? Math.min(w, h) * 0.72 : item.fontSize,
      fontFamily: item.fontFamily,
      fontWeight: 900,
      color: shape === "heart" || shape === "star" ? colorWithAlpha(item.color, item.colorOpacity ?? 1, theme.sticker) : colorWithAlpha(item.textColor, item.textColorOpacity ?? 1, theme.text),
      align: "center",
      padding: 8
    });
  }

  if (item.type === "tape") {
    const radius = Number(item.borderRadius ?? 4);
    ctx.fillStyle = colorWithAlpha(item.color, item.colorOpacity ?? 1, theme.tape);
    roundRectPath(ctx, 0, 0, w, h, radius);
    ctx.fill();
    drawTapePattern(ctx, item.pattern, item.color, w, h);
    drawBorder(ctx, item, w, h, radius);
    drawCanvasTextBlock(ctx, item.text, 0, 0, w, h, { fontSize: item.fontSize, fontFamily: item.fontFamily, fontWeight: 800, color: colorWithAlpha(item.textColor, item.textColorOpacity ?? 1, "#ffffff"), align: "center", padding: 8 });
  }

  if (item.type === "note") {
    const radius = Number(item.borderRadius ?? 18);
    ctx.fillStyle = colorWithAlpha(item.color, item.colorOpacity ?? 1, theme.note);
    if ((item.noteShape || "rounded") === "circle") { ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill(); }
    else if (item.noteShape === "pill") { roundRectPath(ctx, 0, 0, w, h, Math.min(w, h) / 2); ctx.fill(); }
    else if (item.noteShape === "ticket") { roundRectPath(ctx, 0, 0, w, h, radius); ctx.fill(); ctx.clearRect(-4, h / 2 - 12, 10, 24); ctx.clearRect(w - 6, h / 2 - 12, 10, 24); }
    else { roundRectPath(ctx, 0, 0, w, h, item.noteShape === "square" ? 2 : radius); ctx.fill(); }
    drawNotePattern(ctx, item, w, h);
    drawBorder(ctx, item, w, h, radius);
    if (item.title) drawCanvasTextBlock(ctx, item.title, 0, 0, w, 40, { fontSize: item.fontSize, fontFamily: item.fontFamily, fontWeight: 800, color: colorWithAlpha(item.textColor, item.textColorOpacity ?? 1, theme.text), padding: 12 });
    if (item.text) drawCanvasTextBlock(ctx, item.text, 0, item.title ? 34 : 0, w, h - (item.title ? 34 : 0), { fontSize: item.fontSize, fontFamily: item.fontFamily, color: colorWithAlpha(item.textColor, item.textColorOpacity ?? 1, theme.text), padding: 12 });
  }

  if (item.type === "box") {
    const radius = Number(item.borderRadius ?? 14);
    ctx.fillStyle = colorWithAlpha(item.color, item.colorOpacity ?? 1, "#ffffff");
    roundRectPath(ctx, 0, 0, w, h, radius);
    ctx.fill();
    drawBorder(ctx, item, w, h, radius);
    drawCanvasTextBlock(ctx, item.text, 0, 0, w, h, { fontSize: item.fontSize, fontFamily: item.fontFamily, fontWeight: item.fontWeight || (item.bold ? 800 : 500), color: colorWithAlpha(item.textColor, item.textColorOpacity ?? 1, theme.text), align: item.align, textStrokeEnabled: item.textStrokeEnabled, textStrokeColor: colorWithAlpha(item.textStrokeColor, item.textStrokeOpacity ?? 1, "#ffffff"), textStrokeWidth: item.textStrokeWidth, padding: 10 });
  }

  if (item.type === "polaroid") {
    const radius = Number(item.borderRadius ?? 4);
    ctx.fillStyle = item.frameColor === "transparent" ? "rgba(255,255,255,0)" : colorWithAlpha(item.frameColor, item.frameOpacity ?? 1, "#fffdf8");
    roundRectPath(ctx, 0, 0, w, h, radius);
    ctx.fill();
    drawBorder(ctx, item, w, h, radius);
    const pad = Math.max(10, Math.round(Math.min(w, h) * 0.055));
    const captionH = Math.max(34, Math.round(h * 0.18));
    const imgX = pad;
    const imgY = pad;
    const imgW = Math.max(1, w - pad * 2);
    const imgH = Math.max(1, h - captionH - pad * 1.5);
    if (item.image) {
      try {
        const img = await loadImageElement(item.image);
        drawImageFit(ctx, img, imgX, imgY, imgW, imgH, item.fit || "cover", item.cropX, item.cropY, item.cropZoom, item.imageRounded ? Number(item.imageRadius ?? 10) : 0);
      } catch { ctx.fillStyle = "#eee"; ctx.fillRect(imgX, imgY, imgW, imgH); }
    } else {
      ctx.fillStyle = "#f4ece2"; ctx.fillRect(imgX, imgY, imgW, imgH);
    }
    drawCanvasTextBlock(ctx, item.caption, 0, h - captionH, w, captionH, { fontSize: item.fontSize || 16, fontFamily: item.fontFamily, color: colorWithAlpha(item.textColor, item.textColorOpacity ?? 1, theme.text), align: "center", padding: 8 });
  }

  if (item.type === "image") {
    const radius = Number(item.borderRadius ?? 16);
    ctx.fillStyle = item.frameColor === "transparent" ? "rgba(255,255,255,0)" : colorWithAlpha(item.frameColor, item.frameOpacity ?? 1, "#fffdf8");
    roundRectPath(ctx, 0, 0, w, h, radius);
    ctx.fill();
    drawBorder(ctx, item, w, h, radius);
    const pad = itemHasBorder(item) ? Math.max(2, Number(item.borderWidth || 1) + 3) : 0;
    if (item.image) {
      try {
        const img = await loadImageElement(item.image);
        drawImageFit(ctx, img, pad, pad, Math.max(1, w - pad * 2), Math.max(1, h - pad * 2), item.fit || "contain", item.cropX, item.cropY, item.cropZoom, item.imageRounded ? Number(item.imageRadius ?? 14) : 0);
      } catch { ctx.fillStyle = "#eee"; ctx.fillRect(pad, pad, w - pad * 2, h - pad * 2); }
    }
  }

  if (item.type === "drawing") {
    const points = item.points || [];
    if (points.length) {
      const style = brushPathStyle(item);
      ctx.save();
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = style.strokeWidth;
      ctx.lineCap = style.strokeLinecap || "round";
      ctx.lineJoin = style.strokeLinejoin || "round";
      ctx.globalAlpha = (item.opacity ?? 1) * (style.opacity ?? 1);
      if (style.strokeDasharray) ctx.setLineDash(String(style.strokeDasharray).split(/\s+/).map(Number));
      if (item.brushTexture === "neon") { ctx.shadowColor = style.stroke; ctx.shadowBlur = 8; }
      ctx.beginPath();
      points.forEach((pt, idx) => { if (idx === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y); });
      if (points.length === 1) ctx.lineTo(points[0].x + 0.1, points[0].y + 0.1);
      ctx.stroke();
      ctx.restore();
    }
  }

  ctx.restore();
}

async function renderScrapbookToCanvasDataUrl({ canvasSize, theme, styleName, templateType, uploadedTemplate, items, fixedTemplateItems = [], type = "image/png", quality = 0.95 }) {
  const exportScale = 2.5;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(canvasSize.width * exportScale);
  canvas.height = Math.round(canvasSize.height * exportScale);
  const ctx = canvas.getContext("2d");
  ctx.save();
  ctx.scale(exportScale, exportScale);
  ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
  ctx.fillStyle = theme.paper || "#fffaf5";
  ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

  if (styleName === "minimal") {
    ctx.strokeStyle = "rgba(0,0,0,0.035)";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvasSize.width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvasSize.height); ctx.stroke(); }
    for (let y = 0; y < canvasSize.height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvasSize.width, y); ctx.stroke(); }
  }

  if (templateType === "uploaded" && uploadedTemplate) {
    try {
      const img = await loadImageElement(uploadedTemplate);
      drawImageFit(ctx, img, 0, 0, canvasSize.width, canvasSize.height, "contain", 50, 50, 100, 0);
    } catch {}
  }

  const allItems = [...fixedTemplateItems, ...items]
    .filter((item) => !item.exportOnlyHidden)
    .sort((a, b) => Number(a.z || 1) - Number(b.z || 1));
  for (const item of allItems) {
    await drawScrapbookItemToCanvas(ctx, item, canvasSize.width, canvasSize.height, theme);
  }
  ctx.restore();
  return canvas.toDataURL(type, quality);
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

function ScrapbookItem({ item, selected, onPointerDown, onResizeDown, onSelect, onCropPointerDown, drawingMode, eraserMode, onEraseObject, canvasW = CANVAS_W, canvasH = CANVAS_H }) {
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
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragStart={(e) => e.preventDefault()}
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
            color: item.shape === "heart" || item.shape === "star"
              ? colorWithAlpha(item.color, item.colorOpacity ?? 1, "#ffffff")
              : colorWithAlpha(item.textColor, item.textColorOpacity ?? 1, "#4c3223"),
            fontSize: item.fontSize,
            fontFamily: item.fontFamily,
            ...itemBorderStyle(item, 18),
            borderRadius: item.shape === "circle" ? "50%" : item.shape === "pill" ? 999 : Number(item.borderRadius ?? 18)
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
          {item.title ? <strong>{item.title}</strong> : null}
          {item.text ? <pre>{item.text}</pre> : null}
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
        <svg className="sp-drawing-layer" viewBox={`0 0 ${canvasW} ${canvasH}`} preserveAspectRatio="none">
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

export default function ScrapbookPlanner({ currentUser, onShareToWall, onSaveArtwork }) {
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const cropDragRef = useRef(null);
  const drawRef = useRef(null);
  const clickCycleRef = useRef({ x: null, y: null, ids: [], index: 0, time: 0 });
  const canvasSizeRef = useRef({ width: CANVAS_W, height: CANVAS_H });

  const today = new Date();
  const [styleName, setStyleName] = useState("vintage");
  const [templateType, setTemplateType] = useState("monthly");
  const [lastFixedTemplate, setLastFixedTemplate] = useState("monthly");
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [dateValue, setDateValue] = useState(toDateInputValue(today));
  const [uploadedTemplate, setUploadedTemplate] = useState(null);
  const [canvasPreset, setCanvasPreset] = useState("a4");
  const [orientation, setOrientation] = useState("portrait");
  const [activeToolPanel, setActiveToolPanel] = useState("theme");
  const [activeSettingsPanel, setActiveSettingsPanel] = useState("material");

  const [items, setItems] = useState([]);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [undoStepCount, setUndoStepCount] = useState(1);
  const [redoStepCount, setRedoStepCount] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [savedWorks, setSavedWorks] = useState([]);
  const [worksOpen, setWorksOpen] = useState(false);
  const [worksFilter, setWorksFilter] = useState("all");
  const [downloading, setDownloading] = useState(false);
  const [drawingMode, setDrawingMode] = useState(false);
  const [brushColor, setBrushColor] = useState("#6a3d24");
  const [brushSize, setBrushSize] = useState(5);
  const [brushOpacity, setBrushOpacity] = useState(0.95);
  const [brushTexture, setBrushTexture] = useState("pen");
  const [eraserMode, setEraserMode] = useState("none");

  const theme = stylePresets[styleName];
  const canvasSize = getCanvasSize(canvasPreset, orientation);
  const selectedItem = items.find((item) => item.id === selectedId) || null;
  const selectedName = selectedItem ? ({ text: "Text", sticker: "Sticker", tape: "Washi Tape", note: "Sticky Note", polaroid: "Polaroid", image: "Image", box: "Template Box", drawing: "Drawing" }[selectedItem.type] || selectedItem.type) : "Nothing selected";
  const activeEditableTemplate = items.find((item) => item.templateElement)?.templateSource || null;

  const changeToolPanel = (panel) => {
    setActiveToolPanel(panel);
    if (panel === "draw") {
      setDrawingMode(true);
    } else {
      setDrawingMode(false);
      setEraserMode("none");
      drawRef.current = null;
    }
  };

  useEffect(() => {
    const previous = canvasSizeRef.current || canvasSize;
    if (
      previous.width &&
      previous.height &&
      (previous.width !== canvasSize.width || previous.height !== canvasSize.height)
    ) {
      const scaleX = canvasSize.width / previous.width;
      const scaleY = canvasSize.height / previous.height;
      setItems((prev) =>
        prev.map((item) => {
          const next = {
            ...item,
            x: Math.round((item.x || 0) * scaleX),
            y: Math.round((item.y || 0) * scaleY),
            width: Math.max(20, Math.round((item.width || 20) * scaleX)),
            height: Math.max(20, Math.round((item.height || 20) * scaleY))
          };
          if (item.type === "drawing" && Array.isArray(item.points)) {
            next.points = item.points.map((point) => ({
              x: Math.round((point.x || 0) * scaleX),
              y: Math.round((point.y || 0) * scaleY)
            }));
          }
          return next;
        })
      );
    }
    canvasSizeRef.current = canvasSize;
  }, [canvasSize.width, canvasSize.height]);

  const getCanvasInfo = (event) => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const currentSize = canvasSizeRef.current || { width: CANVAS_W, height: CANVAS_H };
    return {
      rect,
      scaleX: currentSize.width / rect.width,
      scaleY: currentSize.height / rect.height,
      x: (event.clientX - rect.left) * (currentSize.width / rect.width),
      y: (event.clientY - rect.top) * (currentSize.height / rect.height)
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
          x: Math.max(0, Math.min(canvasSizeRef.current.width, Math.round(info.x))),
          y: Math.max(0, Math.min(canvasSizeRef.current.height, Math.round(info.y)))
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
            const nextWidth = Math.max(minW, Math.min(canvasSizeRef.current.width - item.x, startWidth + dx));
            const nextHeight = Math.max(minH, Math.min(canvasSizeRef.current.height - item.y, startHeight + dy));
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
                x: Math.max(0, Math.min(canvasSizeRef.current.width - item.width, nextX)),
                y: Math.max(0, Math.min(canvasSizeRef.current.height - item.height, nextY))
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
      const belongsToMe = (item) => !item.ownerGmail || !currentUser?.gmail || item.ownerGmail === currentUser.gmail;
      const stampType = (type) => (item) => ({
        ...item,
        type: item.type || type,
        sourceType: type,
        title: item.title || (type === "postcard" ? "Untitled Postcard" : type === "photobooth" ? "Untitled Booth" : "Untitled Techo")
      });

      const postcards = getList(STORAGE_KEYS.postcards).filter(belongsToMe).map(stampType("postcard"));
      const photoBooths = getList(STORAGE_KEYS.photoBooths).filter(belongsToMe).map(stampType("photobooth"));
      const scrapbooks = getList(STORAGE_KEYS.scrapbooks).filter(belongsToMe).map(stampType("scrapbook"));

      const withImages = await attachImages([...postcards, ...photoBooths, ...scrapbooks]);
      setSavedWorks(
        withImages
          .map((item) => ({
            ...item,
            image: item.image || item.preview || item.dataUrl || item.src || item.thumbnail || null,
            sourceType: item.sourceType || item.type
          }))
          .filter((item) => item.image)
      );
    } catch (error) {
      console.error(error);
      alert("讀取 My Storage 作品失敗，請確認作品有成功儲存。");
    }
  };


  const openWorksPicker = async () => {
    await loadSavedWorks();
    setWorksOpen(true);
  };

  const closeWorksPicker = () => setWorksOpen(false);

  const workTypeLabel = (type) => {
    if (type === "postcard") return "Postcard";
    if (type === "photobooth") return "Booth";
    if (type === "scrapbook") return "Techo";
    return "Work｜作品";
  };

  const filteredSavedWorks = savedWorks.filter((work) => worksFilter === "all" || work.sourceType === worksFilter || work.type === worksFilter);

  const startDrawing = (e) => {
    if (!drawingMode || !canvasRef.current || eraserMode === "object") return;
    e.preventDefault();
    e.stopPropagation();

    const info = getCanvasInfo(e);
    if (!info) return;
    const point = {
      x: Math.max(0, Math.min(canvasSizeRef.current.width, Math.round(info.x))),
      y: Math.max(0, Math.min(canvasSizeRef.current.height, Math.round(info.y)))
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
        width: canvasSize.width,
        height: canvasSize.height,
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

  const handleCanvasPointerDown = (e) => {
    if (e.target?.closest?.(".sp-item")) return;
    if (drawingMode) {
      startDrawing(e);
      return;
    }
    clickCycleRef.current = { x: null, y: null, ids: [], index: 0, time: 0 };
    setSelectedId(null);
  };

  const getItemsAtPoint = (x, y) => {
    return items
      .filter((item) => item.type !== "drawing")
      .filter((item) => x >= Number(item.x || 0) && x <= Number(item.x || 0) + Number(item.width || 0) && y >= Number(item.y || 0) && y <= Number(item.y || 0) + Number(item.height || 0))
      .sort((a, b) => Number(b.z || 1) - Number(a.z || 1));
  };

  const selectAndDrag = (e, id) => {
    if (!canvasRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const info = getCanvasInfo(e);
    if (!info) return;

    const stacked = getItemsAtPoint(info.x, info.y);
    const stackedIds = stacked.map((target) => target.id);
    let targetId = id;

    if (stackedIds.length > 0) {
      const last = clickCycleRef.current || {};
      const sameSpot =
        Number.isFinite(last.x) &&
        Number.isFinite(last.y) &&
        Math.abs(last.x - info.x) <= 10 &&
        Math.abs(last.y - info.y) <= 10;
      const sameStack =
        Array.isArray(last.ids) &&
        last.ids.length === stackedIds.length &&
        last.ids.every((value, index) => value === stackedIds[index]);

      if (sameSpot && sameStack && stackedIds.length > 1) {
        const nextIndex = ((last.index || 0) + 1) % stackedIds.length;
        targetId = stackedIds[nextIndex];
        clickCycleRef.current = { x: info.x, y: info.y, ids: stackedIds, index: nextIndex, time: Date.now() };
      } else {
        const clickedIndex = Math.max(0, stackedIds.indexOf(id));
        targetId = stackedIds[clickedIndex] || stackedIds[0];
        clickCycleRef.current = { x: info.x, y: info.y, ids: stackedIds, index: clickedIndex, time: Date.now() };
      }
    }

    const item = items.find((target) => target.id === targetId);
    if (!item) return;

    setSelectedId(targetId);
    pushHistorySnapshot();
    dragRef.current = {
      id: targetId,
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

  const getNextZ = (list = items) => Math.max(1, ...list.map((item) => Number(item.z || 1))) + 10;

  const addItem = (newItem) => {
    const item = {
      id: makeId(),
      x: 80 + (items.length % 5) * 24,
      y: 110 + (items.length % 5) * 24,
      z: getNextZ(items),
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
      variant: "blank",
      noteShape: "rounded",
      title: "",
      text: "",
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

  const fixedTemplateTypes = ["monthly", "weekly", "daily"];

  const handleTemplateTypeChange = (nextType) => {
    setTemplateType(nextType);
    setSelectedId(null);
    if (fixedTemplateTypes.includes(nextType)) {
      setLastFixedTemplate(nextType);
    }
    if (nextType !== "blank" && nextType !== "uploaded") {
      // 切換月曆 / 週計畫 / 日計畫時，清掉上一個「可編輯模板」產生的元素，避免堆在一起。
      commitItems((prev) => prev.filter((item) => !item.templateElement));
    }
  };

  const backToFixedTemplate = () => {
    const source = activeEditableTemplate || lastFixedTemplate || "monthly";
    commitItems((prev) => prev.filter((item) => !item.templateElement));
    setTemplateType(source);
    setLastFixedTemplate(source);
    setSelectedId(null);
  };

  const makeTemplateBox = (patch) => ({
    id: makeId(),
    type: "box",
    colorOpacity: patch.colorOpacity ?? 0.84,
    textColorOpacity: 1,
    borderEnabled: true,
    borderOpacity: 1,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    fontFamily: "Trebuchet MS",
    fontWeight: patch.fontWeight ?? (patch.bold ? 800 : 500),
    textStrokeEnabled: false,
    opacity: 1,
    templateElement: true,
    ...patch
  });

  const buildEditableMonthlyTemplateItems = () => {
    const w = canvasSize.width;
    const h = canvasSize.height;
    const margin = Math.max(18, Math.round(Math.min(w, h) * 0.045));
    const gap = Math.max(4, Math.round(w * 0.008));
    const titleH = Math.max(34, Math.round(h * 0.052));
    const weekH = Math.max(24, Math.round(h * 0.036));
    const gridTop = margin + titleH + gap * 2 + weekH;
    const cellW = Math.floor((w - margin * 2 - gap * 6) / 7);
    const cellH = Math.floor((h - gridTop - margin - gap * 5) / 6);
    const cells = makeMonthlyCells(Number(year), Number(month));
    const monthName = new Date(Number(year), Number(month) - 1, 1).toLocaleString("en-US", { month: "long" });
    const newItems = [];

    newItems.push(makeTemplateBox({
      x: margin,
      y: margin,
      z: 10,
      width: w - margin * 2,
      height: titleH,
      text: `${monthName} ${year}`,
      color: theme.soft,
      colorOpacity: 0.92,
      textColor: theme.text,
      fontSize: Math.max(16, Math.round(titleH * 0.48)),
      fontFamily: styleName === "vintage" ? "Georgia" : "Trebuchet MS",
      bold: true,
      align: "center",
      borderRadius: styleName === "minimal" ? 6 : 18
    }));

    weekDayLabels.forEach((day, i) => {
      newItems.push(makeTemplateBox({
        x: margin + i * (cellW + gap),
        y: margin + titleH + gap,
        z: 11 + i,
        width: cellW,
        height: weekH,
        text: day,
        color: theme.accent,
        colorOpacity: 0.92,
        textColor: "#ffffff",
        fontSize: Math.max(10, Math.round(weekH * 0.42)),
        bold: true,
        align: "center",
        borderEnabled: false,
        borderRadius: 999
      }));
    });

    cells.forEach((day, slot) => {
      const row = Math.floor(slot / 7);
      const col = slot % 7;
      newItems.push(makeTemplateBox({
        x: margin + col * (cellW + gap),
        y: gridTop + row * (cellH + gap),
        z: 30 + slot,
        width: cellW,
        height: cellH,
        text: day ? String(day) : "",
        color: "#ffffff",
        colorOpacity: day ? 0.74 : 0.34,
        textColor: theme.text,
        fontSize: Math.max(12, Math.round(cellH * 0.18)),
        align: "left",
        borderRadius: styleName === "minimal" ? 4 : 14
      }));
    });

    return newItems;
  };

  const insertEditableMonthlyTemplate = () => {
    replaceEditableTemplate(buildEditableMonthlyTemplateItems(), "monthly");
  };

  const buildEditableWeeklyTemplateItems = () => {
    const w = canvasSize.width;
    const h = canvasSize.height;
    const margin = Math.max(18, Math.round(Math.min(w, h) * 0.045));
    const gap = Math.max(8, Math.round(Math.min(w, h) * 0.018));
    const titleH = Math.max(34, Math.round(h * 0.052));
    const base = parseDateInput(dateValue);
    const monday = startOfWeek(base);
    const cols = w >= 760 ? 7 : w >= 520 ? 2 : 1;
    const rows = Math.ceil(7 / cols);
    const boxW = Math.floor((w - margin * 2 - gap * (cols - 1)) / cols);
    const boxH = Math.max(54, Math.floor((h - margin * 2 - titleH - gap * (rows + 1)) / rows));
    const newItems = [
      makeTemplateBox({
        x: margin,
        y: margin,
        z: 10,
        width: w - margin * 2,
        height: titleH,
        text: `Weekly Planner · ${formatShort(monday)}`,
        color: theme.soft,
        colorOpacity: 0.9,
        textColor: theme.text,
        fontSize: Math.max(16, Math.round(titleH * 0.45)),
        fontFamily: styleName === "vintage" ? "Georgia" : "Trebuchet MS",
        bold: true,
        align: "center"
      })
    ];

    for (let i = 0; i < 7; i += 1) {
      const current = new Date(monday);
      current.setDate(monday.getDate() + i);
      const col = i % cols;
      const row = Math.floor(i / cols);
      newItems.push(makeTemplateBox({
        x: margin + col * (boxW + gap),
        y: margin + titleH + gap + row * (boxH + gap),
        z: 20 + i,
        width: boxW,
        height: boxH,
        text: `${weekDayLabels[i]} ${formatShort(current)}`,
        color: "#ffffff",
        colorOpacity: 0.76,
        textColor: theme.text,
        fontSize: Math.max(10, Math.min(18, Math.round(Math.min(boxH, boxW) * 0.11))),
        bold: true,
        align: "left",
        borderRadius: styleName === "minimal" ? 6 : 18
      }));
    }
    return newItems;
  };

  const insertEditableWeeklyTemplate = () => {
    replaceEditableTemplate(buildEditableWeeklyTemplateItems(), "weekly");
  };

  const buildEditableDailyTemplateItems = () => {
    const w = canvasSize.width;
    const h = canvasSize.height;
    const margin = Math.max(18, Math.round(Math.min(w, h) * 0.045));
    const gap = Math.max(8, Math.round(Math.min(w, h) * 0.018));
    const titleH = Math.max(34, Math.round(h * 0.052));
    const date = parseDateInput(dateValue);
    const belowY = margin + titleH + gap;
    const availableH = h - belowY - margin;
    const leftW = Math.floor((w - margin * 2 - gap) * 0.52);
    const rightW = w - margin * 2 - gap - leftW;
    const halfH = Math.floor((availableH - gap) / 2);
    const newItems = [
      makeTemplateBox({
        x: margin,
        y: margin,
        z: 10,
        width: w - margin * 2,
        height: titleH,
        text: `Daily Planner · ${formatShort(date)} ${getWeekdayName(date)}`,
        color: theme.soft,
        colorOpacity: 0.9,
        textColor: theme.text,
        fontSize: Math.max(15, Math.round(titleH * 0.42)),
        fontFamily: styleName === "vintage" ? "Georgia" : "Trebuchet MS",
        bold: true,
        align: "center"
      }),
      makeTemplateBox({ x: margin, y: belowY, z: 20, width: leftW, height: availableH, text: "Schedule\n08:00\n10:00\n12:00\n14:00\n16:00", color: "#ffffff", colorOpacity: 0.76, textColor: theme.text, fontSize: Math.max(10, Math.min(16, Math.round(w * 0.018))), bold: false, align: "left", borderRadius: styleName === "minimal" ? 6 : 18 }),
      makeTemplateBox({ x: margin + leftW + gap, y: belowY, z: 21, width: rightW, height: halfH, text: "To-do", color: theme.note, colorOpacity: 0.82, textColor: theme.text, fontSize: Math.max(11, Math.min(17, Math.round(w * 0.019))), bold: true, align: "left", borderRadius: styleName === "minimal" ? 6 : 18 }),
      makeTemplateBox({ x: margin + leftW + gap, y: belowY + halfH + gap, z: 22, width: rightW, height: halfH, text: "Notes / Mood", color: "#ffffff", colorOpacity: 0.76, textColor: theme.text, fontSize: Math.max(11, Math.min(17, Math.round(w * 0.019))), bold: true, align: "left", borderRadius: styleName === "minimal" ? 6 : 18 })
    ];
    return newItems;
  };

  const insertEditableDailyTemplate = () => {
    replaceEditableTemplate(buildEditableDailyTemplateItems(), "daily");
  };

  useEffect(() => {
    if (!activeEditableTemplate) return;
    if (activeEditableTemplate === "monthly") insertEditableMonthlyTemplate();
    if (activeEditableTemplate === "weekly") insertEditableWeeklyTemplate();
    if (activeEditableTemplate === "daily") insertEditableDailyTemplate();
    // Rebuild editable template elements whenever style, date, size, or orientation changes.
    // This keeps the editable elements using the same design and spacing as each fixed template.
  }, [styleName, canvasSize.width, canvasSize.height, year, month, dateValue]);

  const updateSelected = (patch) => {
    if (!selectedItem) return;
    commitItems((prev) => prev.map((item) => (item.id === selectedItem.id ? { ...item, ...patch } : item)));
  };

  const applyStickerShape = (shape) => {
    if (!selectedItem || selectedItem.type !== "sticker") return;
    const maxSide = Math.max(Number(selectedItem.width || 120), Number(selectedItem.height || 90));
    if (shape === "circle") {
      updateSelected({ shape, width: maxSide, height: maxSide, borderRadius: 999 });
      return;
    }
    if (shape === "pill") {
      updateSelected({ shape, width: Math.max(maxSide, 170), height: Math.max(58, Math.round(maxSide * 0.46)), borderRadius: 999 });
      return;
    }
    if (shape === "heart" || shape === "star") {
      updateSelected({ shape, width: maxSide, height: maxSide, borderRadius: 0, borderEnabled: false, borderWidth: 0, fontSize: Math.max(56, Math.round(maxSide * 0.62)) });
      return;
    }
    updateSelected({ shape: "rounded", width: Math.max(130, Number(selectedItem.width || 120)), height: Math.max(82, Number(selectedItem.height || 90)), borderRadius: 18, borderEnabled: true, borderWidth: selectedItem.borderWidth || 2 });
  };

  const resetSelectedDefaults = () => {
    if (!selectedItem) return;
    const common = {
      opacity: 1,
      rotation: 0,
      borderEnabled: false,
      borderWidth: 0,
      borderColor: theme.border,
      borderOpacity: 1,
      borderRadius: 14
    };
    const typeDefaults = {
      text: { ...common, fontSize: 24, fontWeight: 500, color: theme.text, colorOpacity: 1, bgColor: "transparent", textStrokeEnabled: false },
      sticker: { ...common, shape: "rounded", color: theme.sticker, colorOpacity: 1, textColor: theme.text, textColorOpacity: 1, fontSize: 18 },
      tape: { ...common, pattern: "solid", color: theme.tape, colorOpacity: .8, textColor: theme.text, textColorOpacity: 1, borderRadius: 8 },
      note: { ...common, variant: "blank", noteShape: "rounded", color: theme.note, colorOpacity: 1, textColor: theme.text, textColorOpacity: 1, fontSize: 16, borderRadius: 18 },
      box: { ...common, color: theme.soft, colorOpacity: .9, textColor: theme.text, textColorOpacity: 1, fontSize: 18, align: "center" },
      polaroid: { ...common, frameColor: "#fffdf8", frameOpacity: 1, fit: "cover", cropX: 50, cropY: 50, cropZoom: 100, cropMode: false, imageRounded: false, imageRadius: 10 },
      image: { ...common, frameColor: "#fffdf8", frameOpacity: 1, fit: "contain", cropX: 50, cropY: 50, cropZoom: 100, cropMode: false, imageRounded: false, imageRadius: 14 },
      drawing: { opacity: 1 }
    };
    updateSelected(typeDefaults[selectedItem.type] || common);
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
      x: Math.min(selectedItem.x + 30, canvasSize.width - selectedItem.width),
      y: Math.min(selectedItem.y + 30, canvasSize.height - selectedItem.height),
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
    setSelectedId(null);
    e.target.value = "";
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

  const buildFixedTemplateItemsForExport = () => {
    if (templateType === "monthly") return buildEditableMonthlyTemplateItems();
    if (templateType === "weekly") return buildEditableWeeklyTemplateItems();
    if (templateType === "daily") return buildEditableDailyTemplateItems();
    return [];
  };

  const prepareCanvasForExport = async () => {
    const original = {
      items,
      templateType,
      uploadedTemplate,
      selectedId
    };

    const shouldMaterializeFixedTemplate =
      fixedTemplateTypes.includes(templateType) &&
      !items.some((item) => item.templateElement);

    if (!shouldMaterializeFixedTemplate) {
      setSelectedId(null);
      await waitForPaint();
      return async () => {
        setSelectedId(original.selectedId);
      };
    }

    const templateItems = buildFixedTemplateItemsForExport().map((item, index) => ({
      ...item,
      templateElement: true,
      exportOnlyTemplate: true,
      z: 10 + index
    }));
    const userItems = original.items
      .filter((item) => !item.templateElement)
      .map((item, index) => ({
        ...item,
        z: 10000 + index
      }));

    setSelectedId(null);
    setUploadedTemplate(null);
    setTemplateType("blank");
    setItems([...templateItems, ...userItems]);
    await waitForPaint();

    return async () => {
      setItems(original.items);
      setTemplateType(original.templateType);
      setUploadedTemplate(original.uploadedTemplate);
      setSelectedId(original.selectedId);
      await waitForPaint();
    };
  };

  const waitForPaint = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const waitForCanvasImages = async (node) => {
    if (!node) return;
    const images = Array.from(node.querySelectorAll("img"));
    await Promise.all(
      images.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        if (typeof img.decode === "function") {
          return img.decode().catch(() => undefined);
        }
        return new Promise((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
      })
    );
  };

  const captureCanvasImage = async (type = "image/png", quality = 0.95) => {
    // Export the real visible techo page. This keeps fixed templates, editable templates,
    // uploaded templates, hand drawing, crop positioning, and all user changes looking the
    // same in Download / Storage / Community Wall.
    const previousSelectedId = selectedId;
    try {
      if (!canvasRef.current) throw new Error("Techo canvas not found");
      setSelectedId(null);
      await waitForPaint();
      await waitForCanvasImages(canvasRef.current);
      await waitForPaint();

      const rect = canvasRef.current.getBoundingClientRect();
      const outputScale = Math.max(2, Math.min(4, (window.devicePixelRatio || 1) * 2.5));
      const renderedCanvas = await html2canvas(canvasRef.current, {
        backgroundColor: null,
        useCORS: true,
        allowTaint: true,
        logging: false,
        scale: outputScale,
        width: Math.ceil(rect.width),
        height: Math.ceil(rect.height),
        scrollX: -window.scrollX,
        scrollY: -window.scrollY,
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
        onclone: (doc) => {
          const cloneCanvas = doc.querySelector(".sp-canvas");
          if (!cloneCanvas) return;
          cloneCanvas.querySelectorAll(".sp-resize-handle").forEach((node) => node.remove());
          cloneCanvas.querySelectorAll(".sp-item").forEach((node) => {
            node.classList.remove("sp-selected");
          });
        }
      });

      return renderedCanvas.toDataURL(type, quality);
    } catch (error) {
      console.error("DOM Techo export failed; trying canvas renderer fallback", error);
      try {
        const fixedTemplateItems =
          fixedTemplateTypes.includes(templateType) && !items.some((item) => item.templateElement)
            ? buildFixedTemplateItemsForExport()
            : [];
        return await renderScrapbookToCanvasDataUrl({
          canvasSize,
          theme,
          styleName,
          templateType,
          uploadedTemplate,
          items,
          fixedTemplateItems,
          type,
          quality
        });
      } catch (fallbackError) {
        console.error("Techo export fallback failed", fallbackError);
        alert("輸出失敗，請確認圖片已載入後再試一次。\nExport failed. Please make sure all images are loaded and try again.");
        return null;
      }
    } finally {
      setSelectedId(previousSelectedId);
      await waitForPaint();
    }
  };

  const getDataUrlImageSize = (dataUrl) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
    img.onerror = reject;
    img.src = dataUrl;
  });

  const buildPdfBlobFromJpeg = async (jpegDataUrl) => {
    const base64 = jpegDataUrl.split(",")[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

    const imageSize = await getDataUrlImageSize(jpegDataUrl);
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
    const pageWidth = canvasSize.width;
    const pageHeight = canvasSize.height;
    obj(3, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`]);
    obj(4, [`<< /Type /XObject /Subtype /Image /Width ${imageSize.width} /Height ${imageSize.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`, bytes, "\nendstream"]);
    const content = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ`;
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
      link.download = `techo-${Date.now()}.png`;
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
      const blob = await buildPdfBlobFromJpeg(jpeg);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `techo-${Date.now()}.pdf`;
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
        title: "Techo",
        caption: "Shared techo",
        image: dataUrl
      });
    } catch (error) {
      console.error(error);
      alert("分享到作品牆失敗，請再試一次。");
    } finally {
      setDownloading(false);
    }
  };


  const storeCurrentToStorage = async () => {
    if (!onSaveArtwork) {
      alert("Storage is not connected yet. / 目前尚未接到作品庫功能。");
      return;
    }
    setDownloading(true);
    try {
      const dataUrl = await captureCanvasImage("image/png");
      if (!dataUrl) return;
      const item = {
        id: makeId(),
        type: "scrapbook",
        title: `Techo ${new Date().toLocaleDateString()}`,
        subtitle: `${stylePresets[styleName]?.label || "Style"} · ${canvasPresets[canvasPreset]?.label || "Canvas"}`,
        createdAt: new Date().toLocaleString(),
        image: dataUrl,
        data: {
          styleName,
          templateType,
          year,
          month,
          dateValue,
          canvasPreset,
          orientation,
          itemCount: items.length
        }
      };
      const ok = await onSaveArtwork("scrapbook", item);
      if (ok) alert("Saved to My Storage! / 已存到 My Storage！");
    } catch (error) {
      console.error(error);
      alert("Save failed. / 儲存失敗，請再試一次。");
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    const actions = {
      store: storeCurrentToStorage,
      "download-png": downloadPng,
      "download-pdf": downloadPdf,
      share: shareCurrentToWall
    };
    window.lifeTrackerScrapbookActions = actions;
    return () => {
      if (window.lifeTrackerScrapbookActions === actions) {
        delete window.lifeTrackerScrapbookActions;
      }
    };
  }, [items, styleName, templateType, year, month, dateValue, canvasPreset, orientation, theme.paper, uploadedTemplate]);

  useEffect(() => {
    const storeHandler = () => storeCurrentToStorage();
    const pngHandler = () => downloadPng();
    const pdfHandler = () => downloadPdf();
    const shareHandler = () => shareCurrentToWall();
    window.addEventListener("life-tracker-store-scrapbook", storeHandler);
    window.addEventListener("life-tracker-scrapbook-store", storeHandler);
    window.addEventListener("life-tracker-scrapbook-download-png", pngHandler);
    window.addEventListener("life-tracker-scrapbook-download-pdf", pdfHandler);
    window.addEventListener("life-tracker-scrapbook-share", shareHandler);
    return () => {
      window.removeEventListener("life-tracker-store-scrapbook", storeHandler);
      window.removeEventListener("life-tracker-scrapbook-store", storeHandler);
      window.removeEventListener("life-tracker-scrapbook-download-png", pngHandler);
      window.removeEventListener("life-tracker-scrapbook-download-pdf", pdfHandler);
      window.removeEventListener("life-tracker-scrapbook-share", shareHandler);
    };
  }, [items, styleName, templateType, year, month, dateValue, canvasPreset, orientation, theme.paper]);

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

      <div className="sp-heading sp-heading-compact">
        <div>
          <h2>Techo</h2>
          <p>Single-page creative planner. / 單頁 Techo 計畫本</p>
        </div>
      </div>

      <div className="sp-layout">
        <aside className="sp-panel sp-tool-panel">
          <div className="sp-panel-fixed sp-panel-top">
            <h3><Bi en="Tools" zh="工具" /></h3>
            <div className="sp-history-menus">
              <details className="sp-step-menu">
                <summary className={history.length === 0 ? "sp-history-btn sp-disabled-summary" : "sp-history-btn"}><Bi en="↶ Undo" zh="上一步" /></summary>
                <div className="sp-step-menu-panel">
                  {[1, 2, 3, 4, 5].map((step) => (
                    <button key={`undo-${step}`} type="button" disabled={history.length < step} onClick={() => undoSteps(step)}><Bi en={`Undo ${step}`} zh={`${step} 步`} /></button>
                  ))}
                </div>
              </details>
              <details className="sp-step-menu">
                <summary className={future.length === 0 ? "sp-history-btn sp-redo-btn sp-disabled-summary" : "sp-history-btn sp-redo-btn"}><Bi en="↷ Redo" zh="下一步" /></summary>
                <div className="sp-step-menu-panel">
                  {[1, 2, 3, 4, 5].map((step) => (
                    <button key={`redo-${step}`} type="button" disabled={future.length < step} onClick={() => redoSteps(step)}><Bi en={`Redo ${step}`} zh={`${step} 步`} /></button>
                  ))}
                </div>
              </details>
            </div>

            <div className="sp-tab-buttons">
              <button className={activeToolPanel === "theme" ? "active" : ""} onClick={() => changeToolPanel("theme")}><Bi en="Theme" zh="主題" /></button>
              <button className={activeToolPanel === "materials" ? "active" : ""} onClick={() => changeToolPanel("materials")}><Bi en="Materials" zh="素材" /></button>
              <button className={activeToolPanel === "draw" ? "active" : ""} onClick={() => changeToolPanel("draw")}><Bi en="Draw" zh="手繪" /></button>
            </div>
          </div>

          <div className="sp-panel-scroll">
            {activeToolPanel === "theme" && (
              <div className="sp-tool-section">
                <label><Bi en="Canvas Size" zh="畫布尺寸" /></label>
                <select value={canvasPreset} onChange={(e) => setCanvasPreset(e.target.value)}>
                  {Object.entries(canvasPresets).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
                </select>
                <label><Bi en="Orientation" zh="方向" /></label>
                <select value={orientation} onChange={(e) => setOrientation(e.target.value)}>
                  <option value="portrait">Portrait｜直向</option>
                  <option value="landscape">Landscape｜橫向</option>
                </select>
                <label><Bi en="Style" zh="風格" /></label>
                <select value={styleName} onChange={(e) => setStyleName(e.target.value)}>
                  {Object.entries(stylePresets).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
                </select>
                <label><Bi en="Template" zh="模板" /></label>
                <select value={templateType} onChange={(e) => handleTemplateTypeChange(e.target.value)}>
                  <option value="blank">Blank｜空白紙</option>
                  <option value="monthly">Monthly Calendar｜月曆</option>
                  <option value="weekly">Weekly Planner｜週計畫</option>
                  <option value="daily">Daily Planner｜日計畫</option>
                  <option value="uploaded">Uploaded Template｜上傳模板</option>
                </select>
                {templateType === "monthly" && <div className="sp-two-col"><div><label><Bi en="Year" zh="年份" /></label><input type="number" value={year} onChange={(e) => setYear(e.target.value)} /></div><div><label><Bi en="Month" zh="月份" /></label><select value={month} onChange={(e) => setMonth(e.target.value)}>{Array.from({ length: 12 }, (_, index) => index + 1).map((m) => <option key={m} value={m}>{m}</option>)}</select></div></div>}
                {(templateType === "weekly" || templateType === "daily") && <><label><Bi en="Date" zh="日期" /></label><input type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} /></>}
                <div className="sp-template-actions">
                  {templateType === "monthly" && <button type="button" onClick={insertEditableMonthlyTemplate}><Bi en="Edit Monthly" zh="編輯月曆" /></button>}
                  {templateType === "weekly" && <button type="button" onClick={insertEditableWeeklyTemplate}><Bi en="Edit Weekly" zh="編輯週計畫" /></button>}
                  {templateType === "daily" && <button type="button" onClick={insertEditableDailyTemplate}><Bi en="Edit Daily" zh="編輯日計畫" /></button>}
                  {(activeEditableTemplate || templateType === "uploaded") && <button type="button" onClick={backToFixedTemplate}><Bi en="Fixed Template" zh="回既定模板" /></button>}
                </div>
                <label className="sp-file-btn"><Bi en="Upload Template" zh="上傳模板" /><input type="file" accept="image/*,.pdf" onChange={handleTemplateUpload} /></label>
                <small className="sp-help">Use PNG/JPG/WEBP as a background template.<br />可上傳圖片模板並在上面編輯。</small>
              </div>
            )}

            {activeToolPanel === "materials" && (
              <div className="sp-tool-section">
                <div className="sp-tool-grid"><button onClick={addText}><Bi en="Text" zh="文字" /></button><button onClick={addSticker}><Bi en="Sticker" zh="貼紙" /></button><button onClick={addTape}><Bi en="Washi Tape" zh="紙膠帶" /></button><button onClick={addNote}><Bi en="Sticky Note" zh="便利貼" /></button></div>
                <button className="sp-wide-btn" onClick={() => addPolaroid("")}><Bi en="Blank Polaroid" zh="空拍立得" /></button>
                <label className="sp-file-btn"><Bi en="To Polaroid" zh="加入拍立得" /><input type="file" accept="image/*" onChange={handlePolaroidUpload} /></label>
                <label className="sp-file-btn"><Bi en="Photo Material" zh="照片素材" /><input type="file" accept="image/*" onChange={handleImageCardUpload} /></label>
                <button className="sp-wide-btn" type="button" onClick={openWorksPicker}><Bi en="Import Works" zh="匯入作品" /></button>
                <small className="sp-help">Pick postcards, booth strips, or techo pages from My Storage.<br />可從 My Storage 選擇要導入的Postcard、Booth或Techo作品。</small>
              </div>
            )}

            {activeToolPanel === "draw" && (
              <div className="sp-draw-tool sp-tool-section">
                <button type="button" className={drawingMode ? "sp-draw-active" : "sp-wide-btn"} onClick={() => setDrawingMode((prev) => !prev)}>{drawingMode ? <Bi en="Drawing ON" zh="正在手繪" /> : <Bi en="Draw on Page" zh="在 Techo 上畫畫" />}</button>
                <ColorOpacityField label="Brush Color｜筆刷顏色" color={brushColor} alpha={brushOpacity} fallback={theme.accent} onColorChange={setBrushColor} onAlphaChange={setBrushOpacity} />
                <div className={`sp-brush-preview sp-brush-preview-${brushTexture}`} style={{ "--brush-color": colorWithAlpha(brushColor, brushOpacity, theme.accent), "--brush-size": `${Math.max(2, Math.min(18, brushSize))}px` }}>
                  <span>Brush Preview｜筆刷預覽</span>
                  <i />
                </div>
                <label><Bi en="Brush Texture" zh="筆刷質感" /></label>
                <select value={brushTexture} onChange={(e) => setBrushTexture(e.target.value)}><option value="pen">Normal Pen</option><option value="marker">Marker</option><option value="pencil">Pencil</option><option value="highlighter">Highlighter</option><option value="dashed">Dashed</option><option value="neon">Glow</option></select>
                <label><Bi en="Eraser" zh="橡皮擦" /></label>
                <select value={eraserMode} onChange={(e) => { setEraserMode(e.target.value); if (e.target.value !== "none") setDrawingMode(true); }}><option value="none">Off</option><option value="pixel">Pixel Eraser</option><option value="object">Object Eraser</option></select>
                <label><Bi en={`Brush Size: ${brushSize}px`} zh={`筆刷大小：${brushSize}px`} /></label><input type="range" min="1" max="36" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} />
                <small className="sp-help">Pixel eraser removes pixels; object eraser deletes a whole stroke.<br />像素橡皮擦擦線條，物件橡皮擦刪整筆。</small>
              </div>
            )}
          </div>

          <div className="sp-panel-fixed sp-panel-bottom sp-tool-bottom-actions">
            <button className="sp-danger-btn" onClick={() => window.confirm("Clear this page? / 確定清空這張 Techo 嗎？") && commitItems([])}>
              <Bi en="Clear Page" zh="清空頁面" />
            </button>
          </div>
        </aside>

        <main className="sp-canvas-wrap">
          <div
            ref={canvasRef}
            className={`sp-canvas sp-style-${styleName}`}
            style={{
              background: theme.paper,
              borderColor: theme.border,
              cursor: drawingMode ? "crosshair" : "default",
              width: canvasSize.width,
              height: canvasSize.height,
              aspectRatio: `${canvasSize.width} / ${canvasSize.height}`
            }}
            onPointerDown={handleCanvasPointerDown}
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
                canvasW={canvasSize.width}
                canvasH={canvasSize.height}
              />
            ))}
          </div>
        </main>

        <aside className="sp-panel sp-settings-panel">
          <div className="sp-panel-fixed sp-panel-top">
            <h3><Bi en="Settings" zh="設定" /></h3>
            <div className="sp-selected-label"><Bi en={`Selected: ${selectedName}`} zh={`已選擇：${selectedName}`} /></div>
            <div className="sp-tab-buttons">
              <button className={activeSettingsPanel === "material" ? "active" : ""} onClick={() => setActiveSettingsPanel("material")}><Bi en="Material" zh="素材" /></button>
              <button className={activeSettingsPanel === "text" ? "active" : ""} onClick={() => setActiveSettingsPanel("text")}><Bi en="Text" zh="文字" /></button>
              <button className={activeSettingsPanel === "appearance" ? "active" : ""} onClick={() => setActiveSettingsPanel("appearance")}><Bi en="Look" zh="外觀" /></button>
            </div>
          </div>

          <div className="sp-panel-scroll">
            {!selectedItem ? (
              <p className="sp-empty-setting">Select an item on the page first.<br />請先點選畫布上的素材。</p>
            ) : (
              <div className="sp-setting-fields">
                {activeSettingsPanel === "text" && (
                  <div className="sp-tool-section">
                    {(selectedItem.type === "text" || selectedItem.type === "box") && <><label><Bi en="Text" zh="文字" /></label><textarea value={selectedItem.text} onChange={(e) => updateSelected({ text: e.target.value })} /></>}
                    {selectedItem.type === "sticker" && selectedItem.shape !== "heart" && selectedItem.shape !== "star" && <><label><Bi en="Sticker Text" zh="貼紙文字" /></label><input value={selectedItem.text} onChange={(e) => updateSelected({ text: e.target.value })} /></>}
                    {selectedItem.type === "tape" && <><label><Bi en="Tape Text" zh="紙膠帶文字" /></label><input value={selectedItem.text} onChange={(e) => updateSelected({ text: e.target.value })} /></>}
                    {selectedItem.type === "note" && <><label><Bi en="Title" zh="標題" /></label><input value={selectedItem.title} onChange={(e) => updateSelected({ title: e.target.value })} /><label><Bi en="Note Text" zh="便條內容" /></label><textarea value={selectedItem.text} onChange={(e) => updateSelected({ text: e.target.value })} /></>}
                    {selectedItem.type === "polaroid" && <><label><Bi en="Caption" zh="照片文字" /></label><input value={selectedItem.caption} onChange={(e) => updateSelected({ caption: e.target.value })} /></>}
                    {(selectedItem.type === "text" || selectedItem.type === "box" || selectedItem.type === "note" || selectedItem.type === "sticker" || selectedItem.type === "tape" || selectedItem.type === "polaroid") && <>
                      <label><Bi en="Font" zh="字體" /></label><select value={selectedItem.fontFamily || "Trebuchet MS"} onChange={(e) => updateSelected({ fontFamily: e.target.value })}>{fontOptions.map((font) => <option key={font} value={font}>{font}</option>)}</select>
                      <label><Bi en="Font Size" zh="字體大小" /></label><input type="number" min="8" max="90" value={selectedItem.fontSize || 18} onChange={(e) => updateSelected({ fontSize: Number(e.target.value) })} />
                      <label><Bi en={`Font Weight: ${selectedItem.fontWeight || (selectedItem.bold ? 700 : 400)}`} zh={`字體粗細：${selectedItem.fontWeight || (selectedItem.bold ? 700 : 400)}`} /></label><input type="range" min="100" max="900" step="100" value={selectedItem.fontWeight || (selectedItem.bold ? 700 : 400)} onChange={(e) => updateSelected({ fontWeight: Number(e.target.value), bold: Number(e.target.value) >= 700 })} />
                      <ColorOpacityField label="Text Color｜文字顏色" color={selectedItem.type === "text" ? selectedItem.color : selectedItem.textColor} alpha={selectedItem.type === "text" ? (selectedItem.colorOpacity ?? 1) : (selectedItem.textColorOpacity ?? 1)} fallback={theme.text} onColorChange={(value) => selectedItem.type === "text" ? updateSelected({ color: value }) : updateSelected({ textColor: value })} onAlphaChange={(value) => selectedItem.type === "text" ? updateSelected({ colorOpacity: value }) : updateSelected({ textColorOpacity: value })} />
                      <label className="sp-check-row"><input type="checkbox" checked={!!selectedItem.textStrokeEnabled} onChange={(e) => updateSelected({ textStrokeEnabled: e.target.checked })} /> <Bi en="Text Outline" zh="文字外框" /></label>
                      {selectedItem.textStrokeEnabled && <div className="sp-two-col"><ColorOpacityField label="Outline Color｜外框顏色" color={selectedItem.textStrokeColor} alpha={selectedItem.textStrokeOpacity ?? 1} fallback="#ffffff" onColorChange={(value) => updateSelected({ textStrokeColor: value })} onAlphaChange={(value) => updateSelected({ textStrokeOpacity: value })} /><div><label><Bi en="Outline Width" zh="外框粗細" /></label><input type="number" min="1" max="8" value={selectedItem.textStrokeWidth || 1} onChange={(e) => updateSelected({ textStrokeWidth: Number(e.target.value) })} /></div></div>}
                    </>}
                    {selectedItem.type === "image" || selectedItem.type === "drawing" ? <p className="sp-help">This selected item has no editable text.<br />此素材沒有可編輯文字。</p> : null}
                  </div>
                )}

                {activeSettingsPanel === "material" && (
                  <div className="sp-tool-section">
                    {selectedItem.type === "sticker" && <><label><Bi en="Sticker Shape" zh="貼紙形狀" /></label><select value={selectedItem.shape || "rounded"} onChange={(e) => applyStickerShape(e.target.value)}><option value="circle">Circle</option><option value="rounded">Rounded</option><option value="pill">Label</option><option value="heart">Heart</option><option value="star">Star</option></select><ColorOpacityField label="Sticker Color｜貼紙顏色" color={selectedItem.color} alpha={selectedItem.colorOpacity ?? 1} fallback={theme.sticker} onColorChange={(value) => updateSelected({ color: value })} onAlphaChange={(value) => updateSelected({ colorOpacity: value })} /></>}
                    {selectedItem.type === "tape" && <><label><Bi en="Washi Pattern" zh="紙膠帶花紋" /></label><select value={selectedItem.pattern} onChange={(e) => updateSelected({ pattern: e.target.value })}><option value="solid">Solid</option><option value="dot">Dots</option><option value="grid">Grid</option><option value="stripe">Stripe</option><option value="checker">Checker</option><option value="diagonal">Diagonal</option><option value="wave">Wave</option><option value="flower">Flower</option><option value="heart">Heart</option><option value="star">Star</option></select><ColorOpacityField label="Tape Color｜紙膠帶顏色" color={selectedItem.color} alpha={selectedItem.colorOpacity ?? 1} fallback={theme.tape} onColorChange={(value) => updateSelected({ color: value })} onAlphaChange={(value) => updateSelected({ colorOpacity: value })} /></>}
                    {selectedItem.type === "note" && <><label><Bi en="Paper Style" zh="紙張樣式" /></label><select value={selectedItem.variant} onChange={(e) => updateSelected({ variant: e.target.value })}><option value="blank">Blank</option><option value="lined">Lines</option><option value="dots">Dots</option><option value="grid">Grid</option><option value="todo">To-do</option></select><label><Bi en="Note Shape" zh="便利貼形狀" /></label><select value={selectedItem.noteShape || "rounded"} onChange={(e) => updateSelected({ noteShape: e.target.value })}><option value="rounded">Rounded</option><option value="square">Square</option><option value="pill">Pill</option><option value="ticket">Ticket</option><option value="tag">Tag</option><option value="bubble">Bubble</option></select><ColorOpacityField label="Note Color｜便利貼顏色" color={selectedItem.color} alpha={selectedItem.colorOpacity ?? 1} fallback={theme.note} onColorChange={(value) => updateSelected({ color: value })} onAlphaChange={(value) => updateSelected({ colorOpacity: value })} /></>}
                    {(selectedItem.type === "polaroid" || selectedItem.type === "image") && <><label className="sp-file-btn"><Bi en="Upload / Replace" zh="上傳替換" /><input type="file" accept="image/*" onChange={handleSelectedImageUpload} /></label><ColorOpacityField label="Frame Color｜相框顏色" color={selectedItem.frameColor} alpha={selectedItem.frameOpacity ?? 1} fallback="#fffdf8" onColorChange={(value) => updateSelected({ frameColor: value })} onAlphaChange={(value) => updateSelected({ frameOpacity: value })} /><label className="sp-check-row"><input type="checkbox" checked={selectedItem.frameColor === "transparent"} onChange={(e) => updateSelected({ frameColor: e.target.checked ? "transparent" : "#fffdf8" })} /> <Bi en="Transparent Frame" zh="透明框" /></label></>}
                    {selectedItem.type === "text" || selectedItem.type === "box" ? <><label className="sp-check-row"><input type="checkbox" checked={selectedItem.bgColor === "transparent"} onChange={(e) => updateSelected({ bgColor: e.target.checked ? "transparent" : theme.soft })} /> <Bi en="Transparent Background" zh="透明背景" /></label>{selectedItem.bgColor !== "transparent" && <ColorOpacityField label="Background Color｜背景顏色" color={selectedItem.bgColor || selectedItem.color} alpha={selectedItem.bgOpacity ?? selectedItem.colorOpacity ?? 1} fallback={theme.soft} onColorChange={(value) => selectedItem.type === "text" ? updateSelected({ bgColor: value }) : updateSelected({ color: value })} onAlphaChange={(value) => selectedItem.type === "text" ? updateSelected({ bgOpacity: value }) : updateSelected({ colorOpacity: value })} />}</> : null}
                  </div>
                )}

                {activeSettingsPanel === "appearance" && (
                  <div className="sp-tool-section">
                    {selectedItem.type !== "drawing" && <><div className="sp-two-col"><div><label>X</label><input type="number" value={Math.round(selectedItem.x)} onChange={(e) => updateSelected({ x: Number(e.target.value) })} /></div><div><label>Y</label><input type="number" value={Math.round(selectedItem.y)} onChange={(e) => updateSelected({ y: Number(e.target.value) })} /></div></div><div className="sp-two-col"><div><label>Width</label><input type="number" value={selectedItem.width} onChange={(e) => updateSelected({ width: Number(e.target.value) })} /></div><div><label>Height</label><input type="number" value={selectedItem.height} onChange={(e) => updateSelected({ height: Number(e.target.value) })} /></div></div><label>Rotation Angle：{selectedItem.rotation || 0}°</label><input type="range" min="-180" max="180" value={selectedItem.rotation || 0} onChange={(e) => updateSelected({ rotation: Number(e.target.value) })} /></>}
                    <label>Opacity：{Math.round((selectedItem.opacity ?? 1) * 100)}%</label><input type="range" min="0" max="100" value={Math.round((selectedItem.opacity ?? 1) * 100)} onChange={(e) => updateSelected({ opacity: Number(e.target.value) / 100 })} />
                    <div className="sp-border-panel"><label className="sp-check-row"><input type="checkbox" checked={itemHasBorder(selectedItem)} onChange={(e) => updateSelected({ borderEnabled: e.target.checked })} /> <Bi en="Show Border" zh="顯示邊框" /></label><div className="sp-two-col"><ColorOpacityField label="Border Color｜邊框顏色" color={selectedItem.borderColor} alpha={selectedItem.borderOpacity ?? 1} fallback={theme.border} onColorChange={(value) => updateSelected({ borderColor: value, borderEnabled: true })} onAlphaChange={(value) => updateSelected({ borderOpacity: value, borderEnabled: true })} /><div><label><Bi en="Border Width" zh="邊框粗細" /></label><input type="number" min="0" max="12" value={selectedItem.borderWidth ?? 1} onChange={(e) => updateSelected({ borderWidth: Number(e.target.value), borderEnabled: Number(e.target.value) > 0 })} /></div></div><label>Rounded Corner：{selectedItem.borderRadius ?? 12}px</label><input type="range" min="0" max="100" value={selectedItem.borderRadius ?? 12} onChange={(e) => updateSelected({ borderRadius: Number(e.target.value) })} /></div>
                    {(selectedItem.type === "polaroid" || selectedItem.type === "image") && <><label><Bi en="Image Fit / Crop" zh="圖片裁切" /></label><select value={selectedItem.fit || "cover"} onChange={(e) => updateSelected({ fit: e.target.value })}><option value="cover">Crop Fill</option><option value="contain">Show Full</option></select><label className="sp-check-row"><input type="checkbox" checked={!!selectedItem.cropMode} onChange={(e) => updateSelected({ cropMode: e.target.checked, fit: e.target.checked ? "cover" : selectedItem.fit })} /> <Bi en="Drag Crop Mode" zh="拖曳裁切" /></label><label>Crop Zoom：{selectedItem.cropZoom ?? 100}%</label><input type="range" min="100" max="260" value={selectedItem.cropZoom ?? 100} onChange={(e) => updateSelected({ cropZoom: Number(e.target.value), fit: "cover" })} /><div className="sp-two-col"><div><label>Crop X：{selectedItem.cropX ?? 50}%</label><input type="range" min="0" max="100" value={selectedItem.cropX ?? 50} onChange={(e) => updateSelected({ cropX: Number(e.target.value), fit: "cover" })} /></div><div><label>Crop Y：{selectedItem.cropY ?? 50}%</label><input type="range" min="0" max="100" value={selectedItem.cropY ?? 50} onChange={(e) => updateSelected({ cropY: Number(e.target.value), fit: "cover" })} /></div></div><button type="button" className="sp-wide-btn" onClick={applyCropToSelected}><Bi en="Apply Crop" zh="套用裁切" /></button><button type="button" className="sp-wide-btn" onClick={removeBackgroundForSelected}><Bi en="Remove BG" zh="白底去背" /></button><label className="sp-check-row"><input type="checkbox" checked={!!selectedItem.imageRounded} onChange={(e) => updateSelected({ imageRounded: e.target.checked })} /> <Bi en="Round Image Corners" zh="圖片圓角" /></label>{selectedItem.imageRounded && <><label>Image Corner Radius：{selectedItem.imageRadius ?? 12}px</label><input type="range" min="0" max="90" value={selectedItem.imageRadius ?? 12} onChange={(e) => updateSelected({ imageRadius: Number(e.target.value) })} /></>}</>}
                    <div className="sp-action-row"><button onClick={duplicateSelected}><Bi en="Duplicate" zh="複製" /></button><button onClick={bringForward}><Bi en="Front" zh="上層" /></button><button onClick={sendBackward}><Bi en="Back" zh="下層" /></button></div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="sp-panel-fixed sp-panel-bottom sp-setting-bottom-actions">
            <button className="sp-wide-btn" disabled={!selectedItem} onClick={resetSelectedDefaults}><Bi en="Reset" zh="重設" /></button>
            <button className="sp-danger-btn" disabled={!selectedItem} onClick={deleteSelected}><Bi en="Delete Selected" zh="刪除所選" /></button>
          </div>
        </aside>
      </div>

      {worksOpen && (
        <div className="sp-work-modal-backdrop" role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) closeWorksPicker(); }}>
          <div className="sp-work-modal">
            <div className="sp-work-modal-head">
              <div>
                <h3>Import from My Storage</h3>
                <p>從 My Storage 選擇想放進 Techo的素材</p>
              </div>
              <button type="button" className="sp-modal-close" onClick={closeWorksPicker}>×</button>
            </div>

            <div className="sp-work-filter-row">
              {[
                ["all", "All", "全部"],
                ["postcard", "Postcard", "Postcard"],
                ["photobooth", "Booth", "Booth"],
                ["scrapbook", "Techo", "Techo"]
              ].map(([key, en, zh]) => (
                <button key={key} type="button" className={worksFilter === key ? "active" : ""} onClick={() => setWorksFilter(key)}>
                  <Bi en={en} zh={zh} />
                </button>
              ))}
            </div>

            {filteredSavedWorks.length === 0 ? (
              <div className="sp-work-empty">
                <strong>No saved works found.</strong>
                <span>目前沒有可匯入的作品，請先到 Postcard / Booth / Techo 儲存作品到 My Storage。</span>
              </div>
            ) : (
              <div className="sp-work-picker-grid">
                {filteredSavedWorks.map((work) => (
                  <article className="sp-work-card" key={`${work.sourceType || work.type}-${work.id}`}>
                    <img src={work.image} alt={work.title || "saved work"} />
                    <div className="sp-work-card-info">
                      <strong>{workTypeLabel(work.sourceType || work.type)}</strong>
                      <span>{work.title || "Untitled Work"}</span>
                      <small>{work.createdAt || work.subtitle || "Saved work"}</small>
                    </div>
                    <div className="sp-work-card-actions">
                      <button type="button" onClick={() => { addImageCard(work.image, work.title || "Imported Work"); closeWorksPicker(); }}>
                        <Bi en="Use Image" zh="作為圖片" />
                      </button>
                      <button type="button" onClick={() => { addPolaroid(work.image); closeWorksPicker(); }}>
                        <Bi en="Use Polaroid" zh="作為拍立得" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
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


/* Life Tracker scrapbook layout refinements */
.sp-page { max-width: 1500px !important; width: 100%; padding: 0 16px 24px; box-sizing: border-box; overflow-x: hidden; }
.sp-layout { grid-template-columns: 250px minmax(0, 1fr) 250px !important; gap: 34px !important; align-items: start; overflow-x: hidden; }
.sp-panel { max-height: calc(100vh - 110px); overflow: hidden; display: flex; flex-direction: column; position: sticky; top: 12px; }
.sp-panel-scroll { overflow-y: auto; overflow-x: hidden; padding-right: 4px; flex: 1 1 auto; }
.sp-panel-fixed { flex: 0 0 auto; }
.sp-panel-top { padding-bottom: 10px; border-bottom: 1px solid rgba(130, 92, 60, .12); margin-bottom: 10px; }
.sp-panel-bottom { padding-top: 10px; border-top: 1px solid rgba(130, 92, 60, .12); margin-top: 10px; }
.sp-tab-buttons { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 10px 0; }
.sp-tab-buttons button { border: 0; border-radius: 999px; padding: 8px 5px; background: #f4e6d8; color: #6b442b; font-weight: 800; cursor: pointer; box-shadow: inset 0 0 0 1px rgba(120,80,50,.08); }
.sp-tab-buttons button.active { background: linear-gradient(135deg, #7d4e32, #bf8052); color: white; box-shadow: 0 8px 18px rgba(94, 57, 35, .18); }
.sp-tool-section { display: grid; gap: 10px; }
.sp-canvas-wrap { min-width: 0; overflow-x: hidden; align-items: center; }
.sp-canvas-toolbar { width: min(100%, 1000px); }
.sp-canvas { max-width: 100%; flex: 0 0 auto; }
.sp-color-field input[type="color"] { width: 100%; height: 36px; border: 0; padding: 0; background: transparent; cursor: pointer; }
.sp-color-head { align-items: center; }
.sp-color-swatch { width: 42px !important; height: 24px !important; border-radius: 8px !important; border: 2px solid rgba(255,255,255,.8); box-shadow: 0 3px 10px rgba(0,0,0,.16); }
.sp-history-btn, .sp-wide-btn, .sp-file-btn, .sp-tool-grid button, .sp-template-actions button, .sp-action-row button, .sp-danger-btn { transition: transform .15s ease, box-shadow .15s ease, filter .15s ease; }
.sp-history-btn:hover, .sp-wide-btn:hover, .sp-file-btn:hover, .sp-tool-grid button:hover, .sp-template-actions button:hover, .sp-action-row button:hover { transform: translateY(-1px); filter: brightness(1.03); }
@media (max-width: 1120px) { .sp-layout { grid-template-columns: 1fr !important; } .sp-panel { position: relative; max-height: none; } .sp-panel-scroll { overflow: visible; } }


/* Life Tracker final UI requested refinements */
.sp-page { max-width: 1480px !important; }
.sp-layout { grid-template-columns: 250px minmax(0, 900px) 250px !important; gap: 34px !important; justify-content: center; }
.sp-panel { max-height: calc(100vh - 96px) !important; overflow: hidden !important; }
.sp-panel-scroll { overflow-y: auto !important; overflow-x: hidden !important; }
.sp-canvas-wrap { display: flex; justify-content: center; min-width: 0; overflow: visible !important; }
.sp-canvas-toolbar { display: none !important; }
.sp-history-btn { border-radius: 999px !important; padding: 10px 14px !important; background: linear-gradient(135deg, #8a5633, #c4865c) !important; color: #fff !important; }
.sp-redo-btn { background: linear-gradient(135deg, #5263c9, #8e70d4) !important; }
.sp-tab-buttons button { min-height: 42px; line-height: 1.15; }
.sp-brush-preview { display: grid; gap: 8px; padding: 10px; border-radius: 16px; background: rgba(255,255,255,.62); border: 1px solid rgba(130,92,60,.14); }
.sp-brush-preview span { font-size: 12px; font-weight: 800; color: #6b442b; }
.sp-brush-preview i { display: block; height: 24px; border-radius: 999px; background: var(--brush-color); opacity: .95; }
.sp-brush-preview-pen i { height: var(--brush-size); }
.sp-brush-preview-marker i { height: calc(var(--brush-size) * 1.6); opacity: .7; }
.sp-brush-preview-pencil i { height: var(--brush-size); background: repeating-linear-gradient(90deg, var(--brush-color) 0 7px, transparent 7px 10px); }
.sp-brush-preview-highlighter i { height: calc(var(--brush-size) * 2.1); opacity: .45; }
.sp-brush-preview-dashed i { height: var(--brush-size); background: repeating-linear-gradient(90deg, var(--brush-color) 0 18px, transparent 18px 28px); }
.sp-brush-preview-neon i { height: var(--brush-size); box-shadow: 0 0 12px var(--brush-color), 0 0 20px var(--brush-color); }
.sp-template { inset: clamp(18px, 5%, 48px) !important; }
.sp-template-title span { font-size: clamp(22px, 5vw, 42px); }
.sp-template-title strong { font-size: clamp(14px, 2.5vw, 24px); }
.sp-calendar-grid { height: calc(100% - 120px); grid-template-rows: repeat(6, minmax(0, 1fr)); }
.sp-calendar-grid div { height: auto !important; min-height: 0; }
.sp-weekly-grid { grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)) !important; height: calc(100% - 86px); }
.sp-weekly-grid > div { min-height: 0 !important; height: auto !important; }
.sp-week-bottom { display: none !important; }
.sp-daily-grid { height: calc(100% - 92px) !important; min-height: 0; }
.sp-daily-grid section { min-height: 0; overflow: hidden; }
@media (max-width: 1180px) { .sp-canvas { transform: none !important; margin-bottom: 0 !important; } }
@media (max-width: 1120px) { .sp-panel { max-height: none !important; overflow: visible !important; } .sp-panel-scroll { overflow: visible !important; } }


/* Final compact UI fixes */
.sp-heading-compact { display: none !important; }
.sp-bi { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; line-height: 1.05; white-space: nowrap; }
.sp-bi span { display: block; white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.sp-panel label .sp-bi { align-items: flex-start; }
.sp-help br, .sp-empty-setting br { display: block; }
.sp-layout { grid-template-columns: 270px minmax(0, 860px) 270px !important; gap: 26px !important; justify-content: center; align-items: start; }
.sp-panel { width: 270px; box-sizing: border-box; padding: 16px !important; max-height: calc(100vh - 24px) !important; overflow: hidden !important; }
.sp-panel-scroll { overflow-y: auto !important; overflow-x: hidden !important; padding: 2px 6px 2px 2px; min-height: 0; }
.sp-tool-section, .sp-setting-fields { min-width: 0; overflow: visible; }
.sp-panel *, .sp-canvas, .sp-item, .sp-item * { box-sizing: border-box; }
.sp-panel input, .sp-panel textarea, .sp-panel select { min-width: 0; max-width: 100%; box-sizing: border-box; }
.sp-tab-buttons { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
.sp-tab-buttons button { min-width: 0; min-height: 48px; padding: 7px 3px !important; overflow: hidden; }
.sp-tool-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.sp-tool-grid button, .sp-template-actions button, .sp-action-row button, .sp-step-menu-panel button, .sp-wide-btn, .sp-danger-btn, .sp-file-btn, .sp-export-btn { min-height: 48px; display: inline-flex !important; align-items: center; justify-content: center; }
.sp-step-menu-panel { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.sp-step-menu-panel button { padding: 7px 2px !important; }
.sp-history-btn { border-radius: 999px !important; }
.sp-export-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; margin-bottom: 8px; }
.sp-export-grid .sp-wide-btn { margin-top: 0; padding-inline: 4px; }
.sp-tool-bottom-actions .sp-danger-btn, .sp-setting-bottom-actions .sp-danger-btn, .sp-setting-bottom-actions .sp-wide-btn { margin-top: 8px; }
.sp-canvas-wrap { overflow: visible !important; min-width: 0; display: flex; justify-content: center; align-items: flex-start; padding: 0 0 22px; }
.sp-canvas { max-width: none !important; flex: 0 0 auto; box-sizing: border-box; }
.sp-template { inset: clamp(16px, 4%, 40px) !important; overflow: hidden; }
.sp-template-title { margin-bottom: clamp(8px, 1.8%, 18px); padding: clamp(8px, 1.4%, 14px) clamp(10px, 2%, 18px); border-radius: clamp(10px, 2%, 20px); }
.sp-template-title span { font-size: clamp(18px, 4vw, 34px) !important; line-height: 1; }
.sp-template-title strong { font-size: clamp(12px, 2vw, 19px) !important; }
.sp-week-head { gap: clamp(3px, 1%, 7px); margin-bottom: clamp(3px, 1%, 8px); }
.sp-week-head b { padding: clamp(4px, 1.2%, 8px) 0; font-size: clamp(9px, 1.8vw, 13px); }
.sp-calendar-grid { gap: clamp(3px, 1%, 7px) !important; height: calc(100% - 104px) !important; grid-template-rows: repeat(6, minmax(0, 1fr)); }
.sp-calendar-grid div { min-height: 0 !important; padding: clamp(4px, 1%, 8px) !important; overflow: hidden; }
.sp-weekly-grid { grid-template-columns: repeat(7, minmax(0, 1fr)) !important; gap: clamp(4px, 1%, 8px) !important; height: calc(100% - 86px) !important; }
.sp-weekly-grid > div { min-height: 0 !important; padding: clamp(5px, 1.2%, 10px) !important; overflow: hidden; }
.sp-weekly-grid h4 { font-size: clamp(10px, 1.8vw, 14px) !important; margin-bottom: 4px; }
.sp-weekly-grid small { font-size: clamp(9px, 1.5vw, 12px); }
.sp-daily-grid { height: calc(100% - 86px) !important; gap: clamp(7px, 1.5%, 14px) !important; }
.sp-daily-grid section { overflow: hidden; padding: clamp(8px, 1.6%, 14px) !important; }
.sp-daily-grid h4 { font-size: clamp(11px, 2vw, 16px); }
.sp-color-head { display: block !important; }
.sp-color-swatch { display: none !important; }
.sp-color-field input[type="color"] { height: 46px !important; border-radius: 14px !important; border: 1px solid rgba(138,86,51,.18) !important; background: rgba(255,255,255,.72) !important; padding: 3px !important; }
.sp-color-field input[type="color"]::-webkit-color-swatch { border-radius: 11px !important; }
.sp-color-field input[type="color"]::-moz-color-swatch { border-radius: 11px !important; }
.sp-action-row { grid-template-columns: repeat(3, minmax(0, 1fr)); }
@media (max-width: 1220px) { .sp-layout { grid-template-columns: 1fr !important; } .sp-panel { position: relative; width: min(100%, 860px); max-height: none !important; } .sp-panel-scroll { overflow: visible !important; } }


/* Final requested layout/action fixes */
.sp-layout { grid-template-columns: 260px minmax(0, 720px) 260px !important; gap: 22px !important; align-items: start; justify-content: center; max-width: 1280px; margin: 0 auto; }
.sp-page { max-width: 1320px !important; padding-inline: 10px !important; overflow-x: hidden !important; }
.sp-panel { width: 260px !important; max-height: calc(100vh - 24px) !important; overflow: hidden !important; padding: 16px !important; border-radius: 24px !important; }
.sp-panel-scroll { overflow-y: auto !important; overflow-x: hidden !important; padding: 4px 8px 4px 2px !important; }
.sp-canvas-wrap { width: 720px !important; max-width: 720px !important; overflow: visible !important; padding-inline: 0 !important; }
.sp-canvas { max-width: 720px !important; max-height: 760px !important; }
.sp-tool-grid button, .sp-template-actions button, .sp-action-row button, .sp-step-menu-panel button, .sp-wide-btn, .sp-danger-btn, .sp-file-btn { width: 100%; max-width: 100%; min-height: 56px !important; padding: 9px 8px !important; overflow: visible !important; border-radius: 18px !important; }
.sp-file-btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; background: linear-gradient(135deg, #fff8ef, #f2dfc9) !important; color: #684326 !important; border: 1px solid rgba(138, 86, 51, .16) !important; box-shadow: 0 8px 18px rgba(106, 67, 38, .10) !important; font-weight: 900 !important; cursor: pointer !important; }
.sp-file-btn:hover { transform: translateY(-1px); filter: brightness(1.02); }
.sp-bi { width: 100%; display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; gap: 2px !important; line-height: 1.05 !important; white-space: nowrap !important; }
.sp-bi span { display: block !important; white-space: nowrap !important; overflow: visible !important; text-overflow: clip !important; max-width: none !important; font-size: 11.5px !important; }
.sp-tab-buttons button .sp-bi span, .sp-history-btn .sp-bi span { font-size: 11px !important; }
.sp-template-actions { grid-template-columns: 1fr !important; }
.sp-template { inset: clamp(12px, 3.5%, 26px) !important; overflow: hidden !important; }
.sp-calendar-grid { height: calc(100% - 98px) !important; gap: clamp(2px, .7%, 5px) !important; }
.sp-calendar-grid div { padding: clamp(3px, .8%, 6px) !important; }
.sp-weekly-grid { height: calc(100% - 78px) !important; gap: clamp(3px, .8%, 6px) !important; }
.sp-weekly-grid > div { padding: clamp(4px, 1%, 7px) !important; }
.sp-daily-grid { height: calc(100% - 78px) !important; gap: clamp(5px, 1%, 10px) !important; }
.sp-daily-grid section { padding: clamp(6px, 1.2%, 10px) !important; }
.sp-color-head { margin-bottom: 4px !important; }
.sp-color-field input[type="color"] { height: 50px !important; }
@media (max-width: 1280px) { .sp-layout { grid-template-columns: 248px minmax(0, 660px) 248px !important; gap: 18px !important; } .sp-panel { width: 248px !important; } .sp-canvas-wrap { width: 660px !important; max-width: 660px !important; } .sp-canvas { max-width: 660px !important; } }
@media (max-width: 1120px) { .sp-layout { grid-template-columns: 1fr !important; } .sp-panel, .sp-canvas-wrap { width: min(100%, 720px) !important; max-width: 100% !important; } .sp-panel { position: relative !important; max-height: none !important; } .sp-panel-scroll { overflow: visible !important; } }


/* FINAL UI polish requested 2: safe panels, clean buttons, non-overflow canvas */
.sp-page { max-width: 1280px !important; padding-inline: 12px !important; overflow-x: hidden !important; }
.sp-layout { grid-template-columns: 270px minmax(0, 660px) 270px !important; gap: 18px !important; justify-content: center !important; align-items: start !important; max-width: 1240px !important; margin: 0 auto !important; overflow: visible !important; }
.sp-panel { width: 270px !important; max-height: calc(100vh - 26px) !important; padding: 17px !important; overflow: hidden !important; border-radius: 24px !important; }
.sp-panel-scroll { overflow-y: auto !important; overflow-x: hidden !important; padding: 6px 9px 6px 3px !important; }
.sp-canvas-wrap { width: 660px !important; max-width: 660px !important; min-width: 0 !important; overflow: visible !important; padding-inline: 0 !important; display: flex !important; justify-content: center !important; align-items: flex-start !important; }
.sp-canvas { max-width: 660px !important; max-height: 730px !important; }
.sp-tool-grid button, .sp-template-actions button, .sp-action-row button, .sp-step-menu-panel button, .sp-wide-btn, .sp-danger-btn, .sp-file-btn, .sp-history-btn { min-height: 58px !important; padding: 10px 10px !important; border-radius: 20px !important; overflow: visible !important; line-height: 1.1 !important; }
.sp-bi { width: 100% !important; display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; gap: 3px !important; line-height: 1.08 !important; white-space: nowrap !important; overflow: visible !important; }
.sp-bi span { display: block !important; white-space: nowrap !important; overflow: visible !important; text-overflow: clip !important; max-width: none !important; font-size: 12.4px !important; }
.sp-tab-buttons button .sp-bi span, .sp-history-btn .sp-bi span, .sp-step-menu-panel button .sp-bi span { font-size: 11.8px !important; }
.sp-file-btn, .sp-wide-btn, .sp-danger-btn, .sp-tool-grid button, .sp-template-actions button, .sp-action-row button { box-shadow: 0 8px 18px rgba(106, 67, 38, .10) !important; }
.sp-template { inset: clamp(10px, 3%, 24px) !important; overflow: hidden !important; }
.sp-template-title { margin-bottom: clamp(6px, 1.5%, 14px) !important; }
.sp-calendar-grid { height: calc(100% - 96px) !important; gap: clamp(2px, .7%, 5px) !important; }
.sp-calendar-grid div { min-height: 0 !important; overflow: hidden !important; padding: clamp(3px, .7%, 6px) !important; }
.sp-weekly-grid { grid-template-columns: repeat(7, minmax(0, 1fr)) !important; height: calc(100% - 78px) !important; gap: clamp(3px, .8%, 6px) !important; }
.sp-weekly-grid > div { min-height: 0 !important; height: auto !important; overflow: hidden !important; padding: clamp(4px, 1%, 7px) !important; }
.sp-weekly-grid h4 { font-size: clamp(9px, 1.7vw, 13px) !important; line-height: 1.05 !important; }
.sp-weekly-grid small { font-size: clamp(8px, 1.3vw, 11px) !important; }
.sp-daily-grid { height: calc(100% - 78px) !important; gap: clamp(5px, 1%, 9px) !important; }
.sp-daily-grid section { min-height: 0 !important; overflow: hidden !important; padding: clamp(6px, 1.1%, 9px) !important; }
.sp-daily-grid h4 { font-size: clamp(10px, 1.8vw, 14px) !important; }
.sp-color-head { display: block !important; }
.sp-color-swatch { display: none !important; }
.sp-color-field input[type="color"] { height: 52px !important; border-radius: 16px !important; border: 1px solid rgba(138,86,51,.18) !important; background: rgba(255,255,255,.76) !important; padding: 4px !important; }
.sp-color-field input[type="color"]::-webkit-color-swatch { border-radius: 12px !important; }
.sp-color-field input[type="color"]::-moz-color-swatch { border-radius: 12px !important; }
@media (max-width: 1220px) { .sp-layout { grid-template-columns: 1fr !important; max-width: 100% !important; } .sp-panel, .sp-canvas-wrap { width: min(100%, 760px) !important; max-width: 100% !important; } .sp-panel { position: relative !important; max-height: none !important; } .sp-panel-scroll { overflow: visible !important; } }


/* My Storage import picker: modal so the Tools column never widens */
.sp-work-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(44, 28, 18, 0.38);
  backdrop-filter: blur(6px);
}

.sp-work-modal {
  width: min(920px, calc(100vw - 36px));
  max-height: min(82vh, 760px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-radius: 28px;
  background: linear-gradient(180deg, #fffaf4, #f7eadc);
  border: 1px solid rgba(120, 80, 50, .18);
  box-shadow: 0 28px 80px rgba(42, 25, 14, .28);
}

.sp-work-modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 20px 22px 14px;
  border-bottom: 1px solid rgba(120, 80, 50, .12);
}

.sp-work-modal-head h3 {
  margin: 0;
  font-size: 22px;
  color: #5d3720;
}

.sp-work-modal-head p {
  margin: 6px 0 0;
  color: #8b674c;
}

.sp-modal-close {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 0;
  background: #fff2e6;
  color: #6a3c22;
  font-size: 28px;
  line-height: 1;
  font-weight: 800;
  cursor: pointer;
}

.sp-work-filter-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  padding: 14px 22px;
}

.sp-work-filter-row button,
.sp-work-card-actions button {
  min-height: 52px;
  border: 0;
  border-radius: 18px;
  padding: 8px 10px;
  background: #fff5ea;
  color: #6c442a;
  font-weight: 900;
  box-shadow: inset 0 0 0 1px rgba(120, 80, 50, .12), 0 8px 18px rgba(87, 56, 34, .08);
  cursor: pointer;
}

.sp-work-filter-row button.active {
  background: linear-gradient(135deg, #7d4e32, #bf8052);
  color: white;
}

.sp-work-picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
  padding: 4px 22px 22px;
  overflow-y: auto;
}

.sp-work-card {
  min-width: 0;
  overflow: hidden;
  border-radius: 22px;
  background: rgba(255, 255, 255, .82);
  border: 1px solid rgba(120, 80, 50, .14);
  box-shadow: 0 12px 30px rgba(87, 56, 34, .10);
}

.sp-work-card img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  display: block;
  background: #ead8c6;
}

.sp-work-card-info {
  display: grid;
  gap: 4px;
  padding: 10px 12px 8px;
}

.sp-work-card-info strong,
.sp-work-card-info span,
.sp-work-card-info small {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sp-work-card-info strong { color: #5d3720; font-size: 13px; }
.sp-work-card-info span { color: #7b5740; font-size: 13px; font-weight: 800; }
.sp-work-card-info small { color: #a28268; font-size: 11px; }

.sp-work-card-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  padding: 0 12px 12px;
}

.sp-work-empty {
  margin: 4px 22px 22px;
  padding: 24px;
  border-radius: 22px;
  background: rgba(255,255,255,.72);
  border: 1px dashed rgba(120,80,50,.24);
  color: #7b5740;
  display: grid;
  gap: 8px;
}

@media (max-width: 680px) {
  .sp-work-filter-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .sp-work-modal-backdrop { padding: 12px; }
}


/* Integrity fix: click/drag selection and uploaded-template reset */
.sp-item { touch-action: none !important; user-select: none !important; cursor: grab !important; }
.sp-item.sp-selected { cursor: move !important; }
.sp-canvas { overflow: hidden !important; }
.sp-uploaded-template { pointer-events: none !important; }
.sp-template { pointer-events: none !important; }
.sp-template-actions button, .sp-file-btn, .sp-wide-btn { box-sizing: border-box !important; }

/* Integrity fixes: export safety, sticker shapes, and easier selection */
.sp-export-mode .sp-selected { outline: none !important; }
.sp-export-mode .sp-resize-handle { display: none !important; }
.sp-sticker-heart, .sp-sticker-star { border-radius: 0 !important; }
.sp-sticker-circle { border-radius: 50% !important; }
.sp-sticker-pill { border-radius: 999px !important; }

/* Final export / selection / note fixes */
.sp-item { pointer-events: auto !important; }
.sp-sticker-heart, .sp-sticker-star { font-size: clamp(48px, 70%, 160px) !important; }
.sp-note strong:empty, .sp-note pre:empty { display: none !important; }

/* Exact DOM export final fixes */
.sp-export-mode .sp-selected,
.sp-export-mode .sp-item,
.sp-export-mode .sp-crop-active {
  outline: none !important;
}
.sp-export-mode .sp-resize-handle {
  display: none !important;
}
.sp-export-mode * {
  caret-color: transparent !important;
}
`;
