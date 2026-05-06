import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, OrbitControls, Text } from "@react-three/drei";
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

function drawImageCover(ctx, img, x, y, w, h) {
  const ratio = Math.max(w / img.width, h / img.height);
  const nw = img.width * ratio;
  const nh = img.height * ratio;
  const dx = x + (w - nw) / 2;
  const dy = y + (h - nh) / 2;
  ctx.drawImage(img, dx, dy, nw, nh);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

const stripThemes = {
  classic: {
    bg1: "#ffffff",
    bg2: "#f2ede7",
    text: "#352820",
    frame: "#f8f4ef",
    accent: "#8b5734"
  },
  mono: {
    bg1: "#ffffff",
    bg2: "#dfdfdf",
    text: "#202020",
    frame: "#f5f5f5",
    accent: "#333333"
  },
  pinkbooth: {
    bg1: "#fff1f7",
    bg2: "#ffdce9",
    text: "#71395b",
    frame: "#fff8fb",
    accent: "#b95c82"
  },
  skybooth: {
    bg1: "#eef8ff",
    bg2: "#d8efff",
    text: "#2f5573",
    frame: "#f7fcff",
    accent: "#4f90b8"
  }
};

async function createPhotoStripDataURL({
  layoutCount,
  photoTitle,
  photoSubtitle,
  photoDate,
  photoTheme,
  photos
}) {
  const theme = stripThemes[photoTheme] || stripThemes.classic;
  const width = 900;
  const frameHeight = layoutCount === 3 ? 520 : 410;
  const height = 220 + layoutCount * (frameHeight + 36) + 110;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, theme.bg1);
  gradient.addColorStop(1, theme.bg2);

  ctx.fillStyle = gradient;
  roundRect(ctx, 0, 0, width, height, 42);
  ctx.fill();

  ctx.fillStyle = theme.text;
  ctx.textAlign = "center";
  ctx.font = "bold 56px Trebuchet MS, Arial";
  ctx.fillText(photoTitle || "PHOTO BOOTH", width / 2, 92);

  ctx.font = "30px Trebuchet MS, Arial";
  ctx.globalAlpha = 0.72;
  ctx.fillText(photoSubtitle || "Best Memory", width / 2, 140);
  ctx.globalAlpha = 1;

  ctx.font = "24px Trebuchet MS, Arial";
  ctx.globalAlpha = 0.7;
  ctx.fillText(photoDate || "2026.05.06", width / 2, 184);
  ctx.globalAlpha = 1;

  const loadedImages = await Promise.all(photos.map((src) => loadImage(src)));

  let y = 220;
  for (let i = 0; i < layoutCount; i += 1) {
    const x = 70;
    const w = width - 140;
    const h = frameHeight;

    ctx.fillStyle = theme.frame;
    roundRect(ctx, x, y, w, h, 34);
    ctx.fill();

    ctx.save();
    roundRect(ctx, x + 18, y + 18, w - 36, h - 36, 28);
    ctx.clip();

    if (loadedImages[i]) {
      drawImageCover(ctx, loadedImages[i], x + 18, y + 18, w - 36, h - 36);
    } else {
      const placeholder = ctx.createLinearGradient(x, y, x + w, y + h);
      placeholder.addColorStop(0, "#eeeeee");
      placeholder.addColorStop(1, "#d8d2cc");
      ctx.fillStyle = placeholder;
      ctx.fillRect(x + 18, y + 18, w - 36, h - 36);

      ctx.fillStyle = theme.text;
      ctx.globalAlpha = 0.58;
      ctx.textAlign = "center";
      ctx.font = "bold 38px Trebuchet MS, Arial";
      ctx.fillText("Upload", width / 2, y + h / 2 - 8);
      ctx.font = "24px Trebuchet MS, Arial";
      ctx.fillText(`Photo ${i + 1}`, width / 2, y + h / 2 + 34);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
    y += h + 36;
  }

  ctx.fillStyle = theme.text;
  ctx.globalAlpha = 0.78;
  ctx.textAlign = "left";
  ctx.font = "bold 24px Trebuchet MS, Arial";
  ctx.fillText("STAMP STUDIO", 70, height - 52);
  ctx.textAlign = "right";
  ctx.fillText(`${layoutCount}-CUT FILM`, width - 70, height - 52);
  ctx.globalAlpha = 1;

  return canvas.toDataURL("image/png");
}

function usePhotoStripTexture(config) {
  const [texture, setTexture] = useState(null);

  useEffect(() => {
    let active = true;

    async function buildTexture() {
      const dataUrl = await createPhotoStripDataURL(config);
      if (!active) return;

      const img = await loadImage(dataUrl);
      if (!active || !img) return;

      const tex = new THREE.Texture(img);
      tex.needsUpdate = true;
      tex.colorSpace = THREE.SRGBColorSpace;
      setTexture(tex);
    }

    buildTexture();

    return () => {
      active = false;
    };
  }, [
    config.layoutCount,
    config.photoTitle,
    config.photoSubtitle,
    config.photoDate,
    config.photoTheme,
    JSON.stringify(config.photos)
  ]);

  return texture;
}

function BoothDesk() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[8.5, 5.4]} />
        <meshStandardMaterial color="#c99f75" roughness={0.78} />
      </mesh>

      <mesh position={[-2.85, 0.02, 1.55]} rotation={[0, 0.15, -0.18]} castShadow>
        <boxGeometry args={[1.05, 0.03, 0.72]} />
        <meshStandardMaterial color="#fff7ef" roughness={0.72} />
      </mesh>

      <mesh position={[2.95, 0.04, 1.42]} rotation={[0, 0.1, 0.18]} castShadow>
        <boxGeometry args={[0.95, 0.04, 0.22]} />
        <meshStandardMaterial color="#f0c68f" roughness={0.62} />
      </mesh>

      <Text
        position={[2.58, 0.09, 1.43]}
        rotation={[-Math.PI / 2, 0, 0.18]}
        fontSize={0.075}
        color="#7b5638"
        anchorX="left"
        anchorY="middle"
      >
        film tape
      </Text>
    </group>
  );
}

function CameraLens({ position = [0, 0, 0] }) {
  return (
    <group position={position} rotation={[Math.PI / 2, 0, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.42, 0.46, 0.18, 48]} />
        <meshStandardMaterial color="#191818" roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.3, 0.34, 0.08, 48]} />
        <meshStandardMaterial color="#050505" roughness={0.25} metalness={0.25} />
      </mesh>
      <mesh position={[-0.08, 0.15, 0.09]}>
        <sphereGeometry args={[0.06, 24, 24]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.62} />
      </mesh>
    </group>
  );
}

function BoothMachine({ printing }) {
  const bodyRef = useRef(null);
  const lightRef = useRef(null);

  useFrame((state) => {
    if (bodyRef.current) {
      bodyRef.current.position.y = printing
        ? 1.48 + Math.sin(state.clock.elapsedTime * 26) * 0.012
        : 1.48;
    }

    if (lightRef.current) {
      lightRef.current.material.emissiveIntensity = printing
        ? 1.8 + Math.sin(state.clock.elapsedTime * 18) * 1.2
        : 0.55;
    }
  });

  return (
    <group ref={bodyRef} position={[0, 1.48, -0.15]}>
      <mesh castShadow>
        <boxGeometry args={[3.6, 1.85, 0.62]} />
        <meshStandardMaterial color="#2f2b2b" roughness={0.58} />
      </mesh>

      <mesh position={[0, 0.14, 0.33]} castShadow>
        <boxGeometry args={[3.25, 1.3, 0.1]} />
        <meshStandardMaterial color="#393333" roughness={0.6} />
      </mesh>

      <mesh ref={lightRef} position={[0, 0.64, 0.42]}>
        <sphereGeometry args={[0.095, 32, 32]} />
        <meshStandardMaterial
          color="#ff7667"
          emissive="#ff4d3f"
          emissiveIntensity={0.65}
          roughness={0.35}
        />
      </mesh>

      <Text
        position={[0, 0.28, 0.44]}
        fontSize={0.15}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
      >
        MINI PHOTO BOOTH
      </Text>

      <mesh position={[0, -0.18, 0.45]} castShadow>
        <boxGeometry args={[1.55, 0.16, 0.08]} />
        <meshStandardMaterial color="#080808" roughness={0.5} />
      </mesh>

      <CameraLens position={[1.25, 0.2, 0.43]} />
      <CameraLens position={[-1.25, 0.2, 0.43]} />

      <mesh position={[0, -0.82, 0.26]} castShadow>
        <boxGeometry args={[3.05, 0.16, 0.36]} />
        <meshStandardMaterial color="#1d1a1a" roughness={0.52} />
      </mesh>
    </group>
  );
}

function PhotoStrip3D({ config, progress, printing }) {
  const texture = usePhotoStripTexture(config);
  const stripRef = useRef(null);

  const width = 1.45;
  const height = config.layoutCount === 3 ? 2.95 : 3.35;
  const y = 0.68 - progress * 1.72;

  useFrame((state) => {
    if (stripRef.current) {
      stripRef.current.rotation.z = printing
        ? Math.sin(state.clock.elapsedTime * 18) * 0.015
        : 0;
    }
  });

  return (
    <mesh ref={stripRef} position={[0, y, 0.32]} castShadow>
      <planeGeometry args={[width, height]} />
      {texture ? (
        <meshStandardMaterial map={texture} roughness={0.7} side={THREE.DoubleSide} />
      ) : (
        <meshStandardMaterial color="#ffffff" roughness={0.7} side={THREE.DoubleSide} />
      )}
    </mesh>
  );
}

function PrintedSamples() {
  return (
    <group>
      <mesh position={[2.6, 0.035, -1.35]} rotation={[-Math.PI / 2, 0, -0.22]} castShadow>
        <planeGeometry args={[0.9, 1.25]} />
        <meshStandardMaterial color="#fff8f2" roughness={0.7} />
      </mesh>
      <mesh position={[2.6, 0.038, -1.35]} rotation={[-Math.PI / 2, 0, -0.22]}>
        <planeGeometry args={[0.68, 0.88]} />
        <meshStandardMaterial color="#f2c9b8" roughness={0.8} />
      </mesh>

      <mesh position={[-2.55, 0.035, -1.25]} rotation={[-Math.PI / 2, 0, 0.2]} castShadow>
        <planeGeometry args={[0.8, 1.1]} />
        <meshStandardMaterial color="#fff8f2" roughness={0.72} />
      </mesh>
      <mesh position={[-2.55, 0.038, -1.25]} rotation={[-Math.PI / 2, 0, 0.2]}>
        <planeGeometry args={[0.58, 0.75]} />
        <meshStandardMaterial color="#c7d9d2" roughness={0.8} />
      </mesh>
    </group>
  );
}

function ThreeBoothScene({ config, progress, printing }) {
  return (
    <>
      <color attach="background" args={["#f5e4d2"]} />
      <ambientLight intensity={0.9} />
      <hemisphereLight skyColor="#fff7e9" groundColor="#6b4328" intensity={0.78} />
      <directionalLight
        position={[3.4, 5.2, 4.1]}
        intensity={1.9}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-3, 2.5, -2]} intensity={0.42} />

      <BoothDesk />
      <PrintedSamples />
      <BoothMachine printing={printing} />
      <PhotoStrip3D config={config} progress={progress} printing={printing} />

      <ContactShadows
        position={[0, -0.03, 0]}
        opacity={0.38}
        scale={8}
        blur={2.8}
        far={4}
      />

      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={4.2}
        maxDistance={7.8}
        minPolarAngle={Math.PI / 5}
        maxPolarAngle={Math.PI / 2.08}
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
  const [printing, setPrinting] = useState(false);
  const [printProgress, setPrintProgress] = useState(1);
  const [printedResult, setPrintedResult] = useState(null);

  const photoThemes = {
    classic: "Classic",
    mono: "Mono",
    pinkbooth: "Pink Booth",
    skybooth: "Sky Booth"
  };

  useEffect(() => {
    setPhotos((prev) =>
      Array.from({ length: layoutCount }, (_, index) => prev[index] || null)
    );
    setPrintedResult(null);
  }, [layoutCount]);

  const config = useMemo(
    () => ({
      layoutCount,
      photoTitle,
      photoSubtitle,
      photoDate,
      photoTheme,
      photos
    }),
    [layoutCount, photoTitle, photoSubtitle, photoDate, photoTheme, photos]
  );

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

  const createResultImage = async () => {
    return createPhotoStripDataURL(config);
  };

  const printPhotoStrip = () => {
    setPrinting(true);
    setPrintedResult(null);
    setPrintProgress(0);

    const start = performance.now();
    const duration = 2300;

    const tick = async (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setPrintProgress(eased);

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        setPrinting(false);
        const image = await createResultImage();
        setPrintedResult(image);
      }
    };

    requestAnimationFrame(tick);
  };

  const downloadStrip = async () => {
    const image = printedResult || (await createResultImage());
    setPrintedResult(image);
    downloadImage(image, `3d-photo-booth-${layoutCount}cut.png`);
  };

  const saveToStorage = async () => {
    const image = printedResult || (await createResultImage());
    setPrintedResult(image);

    const item = {
      id: makeId(),
      type: "photobooth",
      title: photoTitle || "3D Photo Booth Strip",
      subtitle: `${layoutCount}-Cut · ${photoSubtitle}`,
      createdAt: new Date().toLocaleString(),
      image,
      data: {
        layoutCount,
        photoTitle,
        photoSubtitle,
        photoDate,
        photoTheme
      }
    };

    const ok = await onSaveArtwork("photobooth", item);

    if (ok !== false) {
      alert("3D 拍貼作品已存到 My Storage！");
    }
  };

  const clearBooth = () => {
    setLayoutCount(4);
    setPhotoTitle("PHOTO BOOTH");
    setPhotoSubtitle("Best Memory");
    setPhotoDate("2026.05.06");
    setPhotoTheme("classic");
    setPhotos([null, null, null, null]);
    setPrinting(false);
    setPrintProgress(1);
    setPrintedResult(null);
  };

  return (
    <div className="studio-layout">
      <section className="control-panel">
        <h2>3D Photo Booth Studio</h2>

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

        <div className="storage-warning">
          操作方式：上傳照片後按 Print Photo Strip，3D 拍貼機會把照片條印出來。
        </div>

        <div className="action-buttons">
          <button onClick={printPhotoStrip}>Print Photo Strip</button>
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
            camera={{ position: [3.6, 3.1, 5.4], fov: 43 }}
            gl={{ preserveDrawingBuffer: true, antialias: true }}
          >
            <ThreeBoothScene
              config={config}
              progress={printProgress}
              printing={printing}
            />
          </Canvas>
        </div>

        <div className="three-booth-quick-actions">
          <button onClick={printPhotoStrip} disabled={printing}>
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
              <p>這是 3D 拍貼機輸出的照片條，可下載或存到 My Storage。</p>
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

export default ThreePhotoBoothStudio;
