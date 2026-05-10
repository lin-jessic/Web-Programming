import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function downloadImage(dataUrl, filename) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) {
      resolve(null);
      return;
    }

    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawRoundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawCoverImage(ctx, img, x, y, w, h) {
  if (!img) return;

  const imageRatio = img.width / img.height;
  const frameRatio = w / h;

  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;

  if (imageRatio > frameRatio) {
    sw = img.height * frameRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / frameRatio;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function applyFilterOverlay(ctx, filter, x, y, w, h) {
  switch (filter) {
    case "warm":
      // 暖調：橘黃色疊加
      ctx.fillStyle = "rgba(255, 140, 30, 0.18)";
      ctx.fillRect(x, y, w, h);
      // 再加一層粉紅提亮
      ctx.fillStyle = "rgba(255, 80, 60, 0.07)";
      ctx.fillRect(x, y, w, h);
      break;

    case "cool":
      // 冷調：青藍色疊加
      ctx.fillStyle = "rgba(40, 120, 220, 0.16)";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "rgba(100, 200, 255, 0.08)";
      ctx.fillRect(x, y, w, h);
      break;

    case "dramatic":
      // 戲劇感：加深暗角 + 高對比
      const vignette = ctx.createRadialGradient(
        x + w / 2, y + h / 2, w * 0.28,
        x + w / 2, y + h / 2, w * 0.75
      );
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,0,0,0.52)");
      ctx.fillStyle = vignette;
      ctx.fillRect(x, y, w, h);
      // 輕微紅棕色調
      ctx.fillStyle = "rgba(80, 20, 10, 0.1)";
      ctx.fillRect(x, y, w, h);
      break;

    case "ccd":
      // CCD 感：輕微偏青、低飽和、加橫向掃描線
      ctx.fillStyle = "rgba(30, 180, 160, 0.1)";
      ctx.fillRect(x, y, w, h);
      // 掃描線
      ctx.strokeStyle = "rgba(0, 0, 0, 0.06)";
      ctx.lineWidth = 1;
      for (let sy = y; sy < y + h; sy += 3) {
        ctx.beginPath();
        ctx.moveTo(x, sy);
        ctx.lineTo(x + w, sy);
        ctx.stroke();
      }
      // 輕微雜訊感（用隨機點模擬）
      for (let n = 0; n < 120; n++) {
        const nx = x + Math.random() * w;
        const ny = y + Math.random() * h;
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.12})`;
        ctx.fillRect(nx, ny, 1.5, 1.5);
      }
      break;

    case "polaroid":
      // 拍立得：偏黃、輕微褪色、暗角
      ctx.fillStyle = "rgba(255, 220, 100, 0.12)";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      ctx.fillRect(x, y, w, h);
      // 柔和暗角
      const pVignette = ctx.createRadialGradient(
        x + w / 2, y + h / 2, w * 0.35,
        x + w / 2, y + h / 2, w * 0.72
      );
      pVignette.addColorStop(0, "rgba(0,0,0,0)");
      pVignette.addColorStop(1, "rgba(80,50,10,0.28)");
      ctx.fillStyle = pVignette;
      ctx.fillRect(x, y, w, h);
      break;

    case "dreamcore":
      // 夢核：粉紫色調 + 輕微光暈
      ctx.fillStyle = "rgba(180, 100, 255, 0.13)";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "rgba(255, 150, 200, 0.1)";
      ctx.fillRect(x, y, w, h);
      // 中心光暈
      const dreamGlow = ctx.createRadialGradient(
        x + w / 2, y + h / 2, 0,
        x + w / 2, y + h / 2, w * 0.6
      );
      dreamGlow.addColorStop(0, "rgba(255,255,255,0.18)");
      dreamGlow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = dreamGlow;
      ctx.fillRect(x, y, w, h);
      break;

    case "glitch":
      // 故障效果：RGB 色差條紋
      // 紅色偏移條
      for (let g = 0; g < 4; g++) {
        const gy = y + Math.random() * h;
        const gh = 2 + Math.random() * 8;
        ctx.fillStyle = `rgba(255, 0, 60, ${0.15 + Math.random() * 0.2})`;
        ctx.fillRect(x + Math.random() * 8 - 4, gy, w, gh);
        ctx.fillStyle = `rgba(0, 200, 255, ${0.1 + Math.random() * 0.15})`;
        ctx.fillRect(x - Math.random() * 8 + 4, gy + gh, w, gh * 0.8);
      }
      // 白色雜訊條
      const noiseY = y + Math.random() * h * 0.7;
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fillRect(x, noiseY, w, 3 + Math.random() * 5);
      break;

    case "mono":
      // 黑白底片感：去飽和 + 暗角
      ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
      ctx.fillRect(x, y, w, h);
      // 注意：canvas 2D 無法直接去飽和，用灰色疊加模擬
      ctx.fillStyle = "rgba(128, 128, 128, 0.22)";
      ctx.globalCompositeOperation = "saturation";
      ctx.fillRect(x, y, w, h);
      ctx.globalCompositeOperation = "source-over";
      // 底片顆粒暗角
      const monoVig = ctx.createRadialGradient(
        x + w / 2, y + h / 2, w * 0.3,
        x + w / 2, y + h / 2, w * 0.78
      );
      monoVig.addColorStop(0, "rgba(0,0,0,0)");
      monoVig.addColorStop(1, "rgba(0,0,0,0.45)");
      ctx.fillStyle = monoVig;
      ctx.fillRect(x, y, w, h);
      break;

    default:
      break;
  }
}

async function createStripDataUrl({
  layoutCount,
  photoTitle,
  photoSubtitle,
  photoDate,
  photoTheme,
  photoFilter,
  frameColor,
  photos
}) {
  const width = 760;
  const height = layoutCount === 3 ? 1380 : 1660;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");

  const themes = {
    classic: {
      bg: "#fffaf4",
      frame: "#f0e5d8",
      text: "#3a2920",
      accent: "#8b5734"
    },
    mono: {
      bg: "#f7f7f7",
      frame: "#e5e5e5",
      text: "#222222",
      accent: "#111111"
    },
    pinkbooth: {
      bg: "#fff0f6",
      frame: "#ffd9e8",
      text: "#6c3556",
      accent: "#bf6389"
    },
    skybooth: {
      bg: "#eef8ff",
      frame: "#d7edff",
      text: "#2f5573",
      accent: "#5c9fc5"
    }
  };

  const theme = themes[photoTheme] || themes.classic;

  ctx.fillStyle = theme.bg;
  drawRoundRect(ctx, 0, 0, width, height, 42);
  ctx.fill();

  ctx.fillStyle = theme.text;
  ctx.textAlign = "center";
  ctx.font = "bold 42px Trebuchet MS, Arial";
  ctx.fillText(photoTitle || "PHOTO BOOTH", width / 2, 82);

  ctx.font = "24px Trebuchet MS, Arial";
  ctx.globalAlpha = 0.78;
  ctx.fillText(photoSubtitle || "Best Memory", width / 2, 122);

  ctx.font = "22px Trebuchet MS, Arial";
  ctx.fillText(photoDate || "2026.05.06", width / 2, 158);
  ctx.globalAlpha = 1;

  const paddingX = 58;
  const top = 195;
  const gap = 34;
  const frameW = width - paddingX * 2;
  const frameH = layoutCount === 3 ? 310 : 275;

  const imgs = await Promise.all(
    Array.from({ length: layoutCount }).map((_, index) => loadImage(photos[index]))
  );

  for (let i = 0; i < layoutCount; i += 1) {
    const x = paddingX;
    const y = top + i * (frameH + gap);

    ctx.fillStyle = frameColor || theme.frame;
    drawRoundRect(ctx, x, y, frameW, frameH, 28);
    ctx.fill();

    ctx.save();
    drawRoundRect(ctx, x + 14, y + 14, frameW - 28, frameH - 28, 22);
    ctx.clip();

    if (imgs[i]) {
      drawCoverImage(ctx, imgs[i], x + 14, y + 14, frameW - 28, frameH - 28);
    } else {
      const gradient = ctx.createLinearGradient(x, y, x + frameW, y + frameH);
      gradient.addColorStop(0, "#ffffff");
      gradient.addColorStop(1, "#e7ddd3");
      ctx.fillStyle = gradient;
      ctx.fillRect(x + 14, y + 14, frameW - 28, frameH - 28);

      ctx.fillStyle = theme.text;
      ctx.globalAlpha = 0.62;
      ctx.font = "bold 34px Trebuchet MS, Arial";
      ctx.fillText("Upload", width / 2, y + frameH / 2 - 6);
      ctx.font = "22px Trebuchet MS, Arial";
      ctx.fillText(`Photo ${i + 1}`, width / 2, y + frameH / 2 + 32);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
    ctx.restore();

    // 濾鏡疊加
    if (photoFilter && photoFilter !== "none" && imgs[i]) {
      ctx.save();
      drawRoundRect(ctx, x + 14, y + 14, frameW - 28, frameH - 28, 22);
      ctx.clip();
      applyFilterOverlay(ctx, photoFilter, x + 14, y + 14, frameW - 28, frameH - 28);
      ctx.restore();
    }

    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 6;
    drawRoundRect(ctx, x + 14, y + 14, frameW - 28, frameH - 28, 22);
    ctx.stroke();
  }

  ctx.fillStyle = theme.accent;
  ctx.font = "bold 22px Trebuchet MS, Arial";
  ctx.textAlign = "left";
  ctx.fillText("STAMP STUDIO", 58, height - 52);

  ctx.textAlign = "right";
  ctx.fillText(`${layoutCount}-CUT FILM`, width - 58, height - 52);

  return canvas.toDataURL("image/png");
}

function useTextureFromDataUrl(dataUrl) {
  const [texture, setTexture] = useState(null);

  useEffect(() => {
    if (!dataUrl) {
      setTexture(null);
      return undefined;
    }

    let disposed = false;
    const loader = new THREE.TextureLoader();

    loader.load(dataUrl, (tex) => {
      if (disposed) {
        tex.dispose();
        return;
      }

      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      tex.needsUpdate = true;
      setTexture(tex);
    });

    return () => {
      disposed = true;
      setTexture((old) => {
        if (old) old.dispose();
        return null;
      });
    };
  }, [dataUrl]);

  return texture;
}

function BoothDeskProps() {
  return (
    <group>
      <mesh position={[-3.0, 0.04, 1.35]} rotation={[-Math.PI / 2, 0, 0.15]} receiveShadow>
        <planeGeometry args={[1.0, 0.62]} />
        <meshBasicMaterial color="#fff7ef" side={THREE.DoubleSide} />
      </mesh>

      <mesh position={[-3.0, 0.052, 1.35]} rotation={[-Math.PI / 2, 0, 0.15]}>
        <planeGeometry args={[0.76, 0.42]} />
        <meshBasicMaterial color="#dfeceb" side={THREE.DoubleSide} />
      </mesh>

      <mesh position={[3.05, 0.045, 1.35]} rotation={[-Math.PI / 2, 0, -0.18]}>
        <planeGeometry args={[1.0, 0.62]} />
        <meshBasicMaterial color="#fff7ef" side={THREE.DoubleSide} />
      </mesh>

      <mesh position={[3.05, 0.057, 1.35]} rotation={[-Math.PI / 2, 0, -0.18]}>
        <planeGeometry args={[0.76, 0.42]} />
        <meshBasicMaterial color="#f1d8c8" side={THREE.DoubleSide} />
      </mesh>

      <mesh position={[3.25, 0.05, -1.8]} rotation={[-Math.PI / 2, 0, 0.08]}>
        <planeGeometry args={[1.0, 0.22]} />
        <meshBasicMaterial color="#e8c790" side={THREE.DoubleSide} />
      </mesh>

      <Text
        position={[2.93, 0.065, -1.79]}
        rotation={[-Math.PI / 2, 0, 0.08]}
        fontSize={0.07}
        color="#7b5638"
        anchorX="left"
        anchorY="middle"
      >
        film tape
      </Text>
    </group>
  );
}

function PhotoStripPlane({ stripDataUrl, progress, visible }) {
  const texture = useTextureFromDataUrl(stripDataUrl);

  if (!visible || !texture) return null;

  /*
    Important:
    The strip lies flat ON TOP of the desk, not under it.
    It slides forward on the Z axis from the booth slot.
  */
  const startZ = -0.3;
  const endZ = 1.55;
  const z = THREE.MathUtils.lerp(startZ, endZ, progress);

  return (
    <group position={[0, 0.085, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh receiveShadow>
        <planeGeometry args={[1.28, 3.05]} />
        <meshBasicMaterial
          map={texture}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function PhotoBoothMachine({ printing }) {
  const machineShake = printing ? Math.sin(Date.now() * 0.04) * 0.018 : 0;

  return (
    <group position={[0, 0.92 + machineShake, -0.5]} rotation={[0.03, 0, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[3.85, 1.55, 0.5]} />
        <meshStandardMaterial color="#272222" roughness={0.68} />
      </mesh>

      <mesh position={[0, 0.56, 0.03]} castShadow>
        <boxGeometry args={[4.05, 0.22, 0.64]} />
        <meshStandardMaterial color="#191717" roughness={0.72} />
      </mesh>

      <mesh position={[0, -0.55, 0.05]} castShadow>
        <boxGeometry args={[4.0, 0.22, 0.62]} />
        <meshStandardMaterial color="#171515" roughness={0.72} />
      </mesh>

      <mesh position={[-1.38, 0.1, 0.34]} castShadow>
        <cylinderGeometry args={[0.42, 0.42, 0.18, 48]} />
        <meshStandardMaterial color="#050505" roughness={0.44} metalness={0.12} />
      </mesh>

      <mesh position={[-1.38, 0.1, 0.45]} castShadow>
        <cylinderGeometry args={[0.28, 0.28, 0.08, 48]} />
        <meshStandardMaterial color="#000000" roughness={0.22} metalness={0.45} />
      </mesh>

      <mesh position={[-1.53, -0.07, 0.5]}>
        <sphereGeometry args={[0.07, 24, 24]} />
        <meshBasicMaterial color="#d7d7d7" />
      </mesh>

      <mesh position={[1.38, 0.1, 0.34]} castShadow>
        <cylinderGeometry args={[0.42, 0.42, 0.18, 48]} />
        <meshStandardMaterial color="#050505" roughness={0.44} metalness={0.12} />
      </mesh>

      <mesh position={[1.38, 0.1, 0.45]} castShadow>
        <cylinderGeometry args={[0.28, 0.28, 0.08, 48]} />
        <meshStandardMaterial color="#000000" roughness={0.22} metalness={0.45} />
      </mesh>

      <mesh position={[1.53, -0.07, 0.5]}>
        <sphereGeometry args={[0.07, 24, 24]} />
        <meshBasicMaterial color="#d7d7d7" />
      </mesh>

      <mesh position={[0, -0.32, 0.36]}>
        <boxGeometry args={[1.55, 0.13, 0.07]} />
        <meshBasicMaterial color="#050505" />
      </mesh>

      <mesh position={[0, 0.12, 0.365]}>
        <boxGeometry args={[1.9, 0.1, 0.055]} />
        <meshBasicMaterial color="#0b0a0a" />
      </mesh>

      <mesh position={[0, 0.52, 0.36]}>
        <sphereGeometry args={[0.1, 32, 32]} />
        <meshBasicMaterial color={printing ? "#ff9582" : "#ff725f"} />
      </mesh>

      <pointLight
        position={[0, 0.56, 0.55]}
        intensity={printing ? 1.6 : 0.7}
        color="#ff8a76"
        distance={2.6}
      />

      <Text
        position={[0, 0.17, 0.39]}
        fontSize={0.13}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
      >
        MINI PHOTO BOOTH
      </Text>

      <mesh position={[0, -1.08, 0.04]} castShadow>
        <boxGeometry args={[1.15, 0.85, 0.38]} />
        <meshStandardMaterial color="#080808" roughness={0.7} />
      </mesh>
    </group>
  );
}

function ThreePhotoBoothScene({
  stripDataUrl,
  printProgress,
  printing,
  showPrintedStrip
}) {
  return (
    <>
      <color attach="background" args={["#f4e3d1"]} />
      <ambientLight intensity={0.9} />
      <hemisphereLight skyColor="#fff4df" groundColor="#6d4328" intensity={0.7} />

      <directionalLight
        position={[3.5, 5, 4.5]}
        intensity={1.8}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      <directionalLight position={[-3, 2.6, -2]} intensity={0.45} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[8.5, 6]} />
        <meshStandardMaterial color="#cda77c" roughness={0.82} />
      </mesh>

      <BoothDeskProps />

      <PhotoBoothMachine printing={printing} />

      <PhotoStripPlane
        stripDataUrl={stripDataUrl}
        progress={printProgress}
        visible={showPrintedStrip}
      />

      <ContactShadows
        position={[0, 0.01, 0]}
        opacity={0.35}
        scale={8}
        blur={2.6}
        far={4}
      />

      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={4}
        maxDistance={7.5}
        maxPolarAngle={Math.PI / 2.04}
        minPolarAngle={Math.PI / 5}
      />
    </>
  );
}

function ThreePhotoBoothStudio({ onSaveArtwork }) {
  const [layoutCount, setLayoutCount] = useState(4);
  const [photoTitle, setPhotoTitle] = useState("PHOTO BOOTH");
  const [photoSubtitle, setPhotoSubtitle] = useState("Best Memory");
  const [photoDate, setPhotoDate] = useState("2026.05.06");
  const [photoTheme, setPhotoTheme] = useState("classic");
  const [photos, setPhotos] = useState([null, null, null, null]);

  const [stripDataUrl, setStripDataUrl] = useState(null);
  const [printedResult, setPrintedResult] = useState(null);
  const [printing, setPrinting] = useState(false);
  const [printProgress, setPrintProgress] = useState(0);
  const [showPrintedStrip, setShowPrintedStrip] = useState(false);

  const [photoFilter, setPhotoFilter] = useState("none");
  const [frameColor, setFrameColor] = useState("#f0e5d8");

  const printTimerRef = useRef(null);

  const photoThemes = {
    classic: "Classic",
    mono: "Mono",
    pinkbooth: "Pink Booth",
    skybooth: "Sky Booth"
  };

  const currentConfig = useMemo(() => {
    return {
      layoutCount,
      photoTitle,
      photoSubtitle,
      photoDate,
      photoTheme,
      photoFilter,
      frameColor,
      photos
    };
  }, [layoutCount, photoTitle, photoSubtitle, photoDate, photoTheme, photoFilter, frameColor, photos]);

  useEffect(() => {
    let cancelled = false;

    createStripDataUrl(currentConfig).then((url) => {
      if (!cancelled) {
        setStripDataUrl(url);
        setPrintedResult(url);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentConfig]);

  useEffect(() => {
    return () => {
      if (printTimerRef.current) {
        clearInterval(printTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setPhotos((prev) =>
      Array.from({ length: layoutCount }, (_, index) => prev[index] || null)
    );
    setShowPrintedStrip(false);
    setPrintProgress(0);
  }, [layoutCount]);

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
      setShowPrintedStrip(false);
      setPrintProgress(0);
    };

    reader.readAsDataURL(file);
  };

  const removePhoto = (index) => {
    setPhotos((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
    setShowPrintedStrip(false);
    setPrintProgress(0);
  };

  const printStrip = () => {
    if (printTimerRef.current) {
      clearInterval(printTimerRef.current);
    }

    setShowPrintedStrip(true);
    setPrinting(true);
    setPrintProgress(0);

    let progress = 0;

    printTimerRef.current = setInterval(() => {
      progress += 0.025;

      if (progress >= 1) {
        progress = 1;
        clearInterval(printTimerRef.current);
        printTimerRef.current = null;
        setPrinting(false);
      }

      setPrintProgress(progress);
    }, 35);
  };

  const downloadStrip = () => {
    if (!printedResult) return;
    downloadImage(printedResult, `photo-strip-${layoutCount}cut.png`);
  };

  const saveToStorage = () => {
    if (!printedResult) return;

    const item = {
      id: makeId(),
      type: "photobooth",
      title: photoTitle || "Untitled Photo Strip",
      subtitle: `${layoutCount}-Cut · ${photoSubtitle}`,
      createdAt: new Date().toLocaleString(),
      image: printedResult,
      data: {
        layoutCount,
        photoTitle,
        photoSubtitle,
        photoDate,
        photoTheme
      }
    };

    onSaveArtwork("photobooth", item);
    alert("3D 拍貼作品已存到 My Storage！");
  };

  const clearBooth = () => {
    setLayoutCount(4);
    setPhotoTitle("PHOTO BOOTH");
    setPhotoSubtitle("Best Memory");
    setPhotoDate("2026.05.06");
    setPhotoTheme("classic");
    setPhotos([null, null, null, null]);
    setShowPrintedStrip(false);
    setPrinting(false);
    setPrintProgress(0);
    setPhotoFilter("none");
    setFrameColor("#f0e5d8");
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

        {/* 濾鏡選擇 */}
        <div className="tool-group">
          <label>Photo Filter</label>
          <div className="theme-buttons">
            {[
              { key: "none",     label: "無濾鏡" },
              { key: "warm",     label: "🌅 暖調" },
              { key: "cool",     label: "🧊 冷調" },
              { key: "dramatic", label: "🎭 戲劇" },
              { key: "ccd",      label: "📷 CCD" },
              { key: "polaroid", label: "🏷️ 拍立得" },
              { key: "dreamcore",label: "🌙 夢核" },
              { key: "glitch",   label: "⚡ 故障" },
              { key: "mono",     label: "🎞️ 黑白" },
            ].map(({ key, label }) => (
              <button
                key={key}
                className={photoFilter === key ? "active" : ""}
                onClick={() => setPhotoFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 框邊顏色 */}
        <div className="tool-group">
          <label>Frame Color</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {[
              "#f0e5d8", "#ffffff", "#1a1a1a", "#ffd6e0",
              "#d6eaff", "#d6ffd6", "#fff3cd", "#e8d5ff"
            ].map((color) => (
              <div
                key={color}
                onClick={() => setFrameColor(color)}
                style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: color, cursor: "pointer",
                  border: frameColor === color
                    ? "3px solid #3b2a20"
                    : "2px solid rgba(0,0,0,0.15)",
                  boxShadow: frameColor === color
                    ? "0 0 0 2px rgba(255,255,255,0.8)"
                    : "none",
                  transition: "0.15s"
                }}
              />
            ))}
            <div style={{ position: "relative", width: 30, height: 30, flexShrink: 0 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: frameColor, border: "2px dashed #c4a98a",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, cursor: "pointer"
              }}>🎨</div>
              <input
                type="color"
                value={frameColor}
                onChange={(e) => setFrameColor(e.target.value)}
                style={{
                  position: "absolute", inset: 0, opacity: 0,
                  cursor: "pointer", width: "100%", height: "100%"
                }}
              />
            </div>
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
          <button onClick={printStrip}>Print Animation</button>
          <button onClick={saveToStorage}>Save to My Storage</button>
          <button onClick={downloadStrip}>Download PNG</button>
          <button className="clear-btn" onClick={clearBooth}>
            Clear
          </button>
        </div>
      </section>

      <section className="preview-area three-booth-preview">
        <div className="three-booth-title">
          <div>
            <h3>3D Instant Photo Booth</h3>
            <p>
              Upload your photos, choose 3-cut or 4-cut, then print the strip
              from a 3D booth machine.
            </p>
          </div>
        </div>

        <div className="three-booth-canvas">
          <Canvas
            shadows
            camera={{ position: [0, 3.6, 5.25], fov: 44 }}
            gl={{ preserveDrawingBuffer: true, antialias: true }}
          >
            <ThreePhotoBoothScene
              stripDataUrl={stripDataUrl}
              printProgress={printProgress}
              printing={printing}
              showPrintedStrip={showPrintedStrip}
            />
          </Canvas>
        </div>

        <div className="three-booth-quick-actions">
          <button onClick={printStrip} disabled={printing}>
            {printing ? "Printing..." : "Print Animation"}
          </button>
          <button onClick={saveToStorage}>Save to My Storage</button>
          <button onClick={downloadStrip}>Download PNG</button>
        </div>

        <div className="result-panel booth-result-panel">
          <h3>Printed Result Preview</h3>

          {printedResult ? (
            <div className="printed-result-box">
              <img src={printedResult} alt="printed result" />
              <p>這是輸出的 3-cut / 4-cut 拍貼結果，可下載或存到 My Storage。</p>
            </div>
          ) : (
            <div className="empty-result">尚未產生輸出結果。</div>
          )}
        </div>
      </section>
    </div>
  );
}

export default ThreePhotoBoothStudio;
