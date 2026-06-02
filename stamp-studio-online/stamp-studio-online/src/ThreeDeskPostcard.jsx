import { useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, ContactShadows } from "@react-three/drei";
import * as THREE from "three";


function useImageTexture(dataUrl) {
  const [texture, setTexture] = useState(null);

  useEffect(() => {
    if (!dataUrl) {
      setTexture(null);
      return;
    }
    const loader = new THREE.TextureLoader();
    loader.load(dataUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      setTexture(tex);
    });
  }, [dataUrl]);

  return texture;
}


function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function downloadImage(dataUrl, filename) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

function DeskSurface({ draggingStampTool, onDragMove, onDragEnd }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[9, 6]} />
        <meshStandardMaterial color="#b9875e" roughness={0.78} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.035, 0]}>
        <planeGeometry args={[9, 6]} />
        <meshStandardMaterial
          color="#d2a77e"
          transparent
          opacity={0.22}
          roughness={0.9}
        />
      </mesh>

      {draggingStampTool && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.19, 0]}
          onPointerMove={(event) => {
            event.stopPropagation();
            onDragMove(event.point);
          }}
          onPointerUp={(event) => {
            event.stopPropagation();
            onDragEnd(event.point);
          }}
        >
          <planeGeometry args={[9, 6]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}
    </group>
  );
}

function DeskDecorations() {
  return (
    <group>
      <mesh position={[-3.05, 0.025, -1.75]} rotation={[0, 0, -0.15]} castShadow>
        <boxGeometry args={[1.15, 0.035, 0.72]} />
        <meshStandardMaterial color="#fff7ec" roughness={0.72} />
      </mesh>

      <mesh position={[-3.05, 0.055, -1.75]} rotation={[-Math.PI / 2, 0, -0.15]}>
        <planeGeometry args={[0.92, 0.5]} />
        <meshStandardMaterial color="#e6b9a1" roughness={0.7} />
      </mesh>

      <Text
        position={[-3.42, 0.085, -1.55]}
        rotation={[-Math.PI / 2, 0, -0.15]}
        fontSize={0.08}
        color="#7b5638"
        anchorX="left"
        anchorY="middle"
      >
        mini photo
      </Text>

      <mesh position={[3.15, 0.035, 1.45]} rotation={[0, 0.1, 0.18]} castShadow>
        <boxGeometry args={[1.0, 0.045, 0.22]} />
        <meshStandardMaterial color="#eabf88" roughness={0.65} />
      </mesh>

      <Text
        position={[2.74, 0.085, 1.44]}
        rotation={[-Math.PI / 2, 0, 0.18]}
        fontSize={0.075}
        color="#7b5638"
        anchorX="left"
        anchorY="middle"
      >
        washi tape
      </Text>

      <mesh position={[2.75, 0.06, -1.65]} castShadow>
        <torusGeometry args={[0.23, 0.045, 16, 48]} />
        <meshStandardMaterial color="#f5d7b8" roughness={0.62} />
      </mesh>

      <mesh position={[2.75, 0.061, -1.65]}>
        <torusGeometry args={[0.12, 0.025, 16, 48]} />
        <meshStandardMaterial color="#fff8ef" roughness={0.7} />
      </mesh>
    </group>
  );
}

function StampMark3D({ stamp }) {
  const color = stamp.color || "#b32924";
  const texture = useImageTexture(stamp.customImage);
  const showBorder = stamp.border !== false;

  return (
    <group
      position={[stamp.x, 0.156, stamp.z]}   // ← 原本 0.155，稍微拉高一點點
      rotation={[-Math.PI / 2, 0, stamp.rotation]}
      scale={stamp.scale}
    >
      {showBorder && (
        <>
          <mesh position={[0, 0, 0]}>
            <torusGeometry args={[0.22, 0.014, 16, 80]} />
            <meshStandardMaterial color={color} roughness={0.48} />
          </mesh>
          <mesh position={[0, 0, 0.001]}>   {/* ← 加一點點 Z 偏移 */}
            <torusGeometry args={[0.155, 0.007, 16, 80]} />
            <meshStandardMaterial color={color} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0, 0.002]}>   {/* ← 再加一點點 */}
            <circleGeometry args={[0.205, 60]} />
            <meshStandardMaterial color={color} transparent opacity={0.06} roughness={0.9} />
          </mesh>
        </>
      )}

      {texture ? (
        <mesh position={[0, 0, 0.003]}>     {/* ← 圖片在最上面 */}
          <planeGeometry args={[0.28, 0.28]} />
          <meshBasicMaterial map={texture} transparent side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ) : (
        <Text
          position={[0, 0, 0.003]}           /* ← 文字也往上 */
          fontSize={0.07}
          color={color}
          anchorX="center"
          anchorY="middle"
          maxWidth={0.33}
          textAlign="center"
        >
          {stamp.text}
        </Text>
      )}
    </group>
  );
}

function PreviewStamp3D({ hoverPoint, stampText, stampScale, stampColor, stampCustomImage, stampBorder }) {
  const texture = useImageTexture(stampCustomImage);
  const color = stampColor || "#b32924";

  if (!hoverPoint) return null;

  return (
    <group
      position={[hoverPoint.x, 0.165, hoverPoint.z]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={stampScale}
    >
      {stampBorder !== false && (
        <>
          <mesh>
            <torusGeometry args={[0.22, 0.012, 16, 80]} />
            <meshStandardMaterial color={color} transparent opacity={0.38} roughness={0.6} />
          </mesh>
          <mesh>
            <torusGeometry args={[0.155, 0.006, 16, 80]} />
            <meshStandardMaterial color={color} transparent opacity={0.32} />
          </mesh>
          <mesh>
            <circleGeometry args={[0.205, 60]} />
            <meshStandardMaterial color={color} transparent opacity={0.05} roughness={0.9} />
          </mesh>
        </>
      )}

      {texture ? (
        <mesh position={[0, 0, 0.012]}>
          <planeGeometry args={[0.28, 0.28]} />
          <meshBasicMaterial map={texture} transparent opacity={0.65} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ) : (
        <Text
          position={[0, 0, 0.012]}
          fontSize={0.07}
          color={color}
          fillOpacity={0.5}
          anchorX="center"
          anchorY="middle"
          maxWidth={0.33}
          textAlign="center"
        >
          {stampText}
        </Text>
      )}
    </group>
  );
}
function DragPreview({ position, stampText, stampColor, stampBorder, stampCustomImage, stampScale }) {
  const texture = useImageTexture(stampCustomImage);
  const color = stampColor || "#b32924";

  return (
    <group
      position={[position.x, 0.22, position.z]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={stampScale || 1}
    >
      {/* 光暈 */}
      <mesh>
        <circleGeometry args={[0.38, 64]} />
        <meshBasicMaterial color="#1a0e06" transparent opacity={0.13} depthWrite={false} />
      </mesh>

      {stampBorder !== false && (
        <>
          <mesh position={[0, 0, 0.001]}>
            <torusGeometry args={[0.22, 0.013, 16, 80]} />
            <meshBasicMaterial color={color} transparent opacity={0.55} depthWrite={false} />
          </mesh>
          <mesh position={[0, 0, 0.002]}>
            <torusGeometry args={[0.155, 0.007, 16, 80]} />
            <meshBasicMaterial color={color} transparent opacity={0.4} depthWrite={false} />
          </mesh>
        </>
      )}

      {texture ? (
        <mesh position={[0, 0, 0.003]}>
          <planeGeometry args={[0.28, 0.28]} />
          <meshBasicMaterial map={texture} transparent opacity={0.65} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ) : (
        <Text
          position={[0, 0, 0.003]}
          fontSize={0.07}
          color={color}
          fillOpacity={0.6}
          anchorX="center"
          anchorY="middle"
          maxWidth={0.33}
          textAlign="center"
        >
          {stampText}
        </Text>
      )}
    </group>
  );
}

function DeskStampTool({
  stampText,
  stampReady,
  pressing,
  position,
  dragging,
  onPointerDown
}) {
  return (
    <group
      position={[position.x, 0.12, position.z]}
      rotation={[0, -0.25, 0]}
      onPointerDown={(event) => {
        event.stopPropagation();
        onPointerDown();
      }}
    >
      <mesh position={[0, 0.39, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.16, 0.62, 32]} />
        <meshStandardMaterial color="#6b3d24" roughness={0.62} />
      </mesh>

      <mesh position={[0, pressing ? 0.12 : 0.18, 0]} castShadow>
        <cylinderGeometry args={[0.45, 0.45, 0.22, 48]} />
        <meshStandardMaterial
          color={stampReady || dragging ? "#b85d45" : "#9c4737"}
          roughness={0.56}
          metalness={0.03}
        />
      </mesh>

      <mesh position={[0, pressing ? -0.015 : 0.04, 0]} castShadow>
        <cylinderGeometry args={[0.51, 0.45, 0.08, 48]} />
        <meshStandardMaterial color="#7a3428" roughness={0.6} />
      </mesh>

      <Text
        position={[0, pressing ? 0.19 : 0.25, -0.46]}
        rotation={[-1.25, 0, 0]}
        fontSize={0.1}
        color="#fff7ec"
        anchorX="center"
        anchorY="middle"
        maxWidth={0.65}
      >
        {stampText}
      </Text>

      {(stampReady || dragging) && (
        <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.59, 64]} />
          <meshStandardMaterial
            color="#ffd6c7"
            transparent
            opacity={0.42}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {dragging && (
        <Text
          position={[0, 0.78, 0]}
          rotation={[-0.85, 0, 0]}
          fontSize={0.09}
          color="#7b321f"
          anchorX="center"
          anchorY="middle"
        >
          Drag me to postcard
        </Text>
      )}
    </group>
  );
}

function PostcardBoard({
  currentSide,
  frontReceiver,
  frontMessage,
  backMessage,
  backAddress,
  theme,
  stampText,
  stampScale,
  stampReady,
  stamps,
  hoverPoint,
  setHoverPoint,
  onPlaceStamp,
  stampColor,
  stampCustomImage,
  stampBorder,
}) {
  const themeColors = {
    vintage: {
      paper: "#f3d5a4",
      edge: "#a8754d",
      text: "#5b3924"
    },
    pink: {
      paper: "#ffdce8",
      edge: "#c78398",
      text: "#6c3556"
    },
    sky: {
      paper: "#d7f1ff",
      edge: "#79aecd",
      text: "#2f5573"
    },
    night: {
      paper: "#34396c",
      edge: "#1f244f",
      text: "#fff2d6"
    },
    cream: {
      paper: "#fff2cc",
      edge: "#b98b5d",
      text: "#5b3924"
    }
  };

  const colors = themeColors[theme] || themeColors.vintage;
  const sideStamps = stamps.filter((stamp) => stamp.side === currentSide);

  const handleMove = (event) => {
    event.stopPropagation();
    setHoverPoint({
      x: event.point.x,
      z: event.point.z
    });
  };

  const handleClick = (event) => {
    event.stopPropagation();

    if (!stampReady) {
      alert("可以直接拖曳桌上的 3D 印章到明信片上，或先點一下 3D 印章再點卡片。");
      return;
    }

    onPlaceStamp({
      x: event.point.x,
      z: event.point.z,
      side: currentSide
    });
  };

  return (
    <group position={[0, 0.08, 0]}>
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.6, 0.08, 3.0]} />
        <meshStandardMaterial color={colors.edge} roughness={0.68} />
      </mesh>

      <mesh
        position={[0, 0.052, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={handleMove}
        onPointerOut={() => setHoverPoint(null)}
        onClick={handleClick}
      >
        <planeGeometry args={[4.5, 2.9]} />
        <meshStandardMaterial color={colors.paper} roughness={0.86} />
      </mesh>

      <mesh position={[0, 0.062, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.5, 2.9]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.12}
          roughness={0.95}
        />
      </mesh>

      <Text
        position={[-2.05, 0.13, -1.25]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.11}
        color={colors.text}
        anchorX="left"
        anchorY="middle"
      >
        {currentSide === "front" ? "FRONT SIDE" : "BACK SIDE"}
      </Text>

      {currentSide === "front" ? (
        <>
          <Text
            position={[-1.75, 0.115, -0.95]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.18}
            color={colors.text}
            anchorX="left"
            anchorY="middle"
            maxWidth={2.3}
          >
            POST CARD
          </Text>

          <Text
            position={[-1.72, 0.115, -0.45]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.13}
            color={colors.text}
            anchorX="left"
            anchorY="middle"
            maxWidth={2.5}
          >
            {frontReceiver}
          </Text>

          <Text
            position={[-1.72, 0.115, 0.05]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.18}
            color={colors.text}
            anchorX="left"
            anchorY="top"
            maxWidth={2.55}
          >
            {frontMessage}
          </Text>

          <group position={[1.45, 0.12, 0.72]} rotation={[-Math.PI / 2, 0, 0]}>
            {[0, 1, 2].map((line) => (
              <mesh key={line} position={[0, line * 0.16, 0]}>
                <boxGeometry args={[1.05, 0.015, 0.01]} />
                <meshStandardMaterial color={colors.text} transparent opacity={0.48} />
              </mesh>
            ))}
          </group>

          <Text
            position={[1.48, 0.115, -0.92]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.1}
            color={colors.text}
            anchorX="center"
            anchorY="middle"
          >
            STAMP AREA
          </Text>
        </>
      ) : (
        <>
          <Text
            position={[-1.9, 0.115, -0.92]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.18}
            color={colors.text}
            anchorX="left"
            anchorY="middle"
          >
            MESSAGE
          </Text>

          <Text
            position={[-1.9, 0.115, -0.52]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.13}
            color={colors.text}
            anchorX="left"
            anchorY="top"
            maxWidth={1.8}
          >
            {backMessage}
          </Text>

          <mesh position={[0.05, 0.125, 0]} rotation={[0, 0, 0]}>
            <boxGeometry args={[0.02, 0.02, 2.25]} />
            <meshStandardMaterial color={colors.text} transparent opacity={0.4} />
          </mesh>

          <Text
            position={[0.55, 0.115, -0.5]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.13}
            color={colors.text}
            anchorX="left"
            anchorY="top"
            maxWidth={1.5}
          >
            {backAddress}
          </Text>

          <group position={[1.42, 0.12, -0.8]} rotation={[-Math.PI / 2, 0, 0]}>
            <mesh>
              <boxGeometry args={[0.82, 0.56, 0.01]} />
              <meshStandardMaterial color={colors.text} transparent opacity={0.12} />
            </mesh>
            <Text
              position={[0, 0, 0.02]}
              fontSize={0.09}
              color={colors.text}
              anchorX="center"
              anchorY="middle"
            >
              STAMP
            </Text>
          </group>
        </>
      )}

      {sideStamps.map((stamp) => (
        <StampMark3D key={stamp.id} stamp={stamp} />
      ))}

      {stampReady && (
        <PreviewStamp3D
          hoverPoint={hoverPoint}
          stampText={stampText}
          stampScale={stampScale}
          stampColor={stampColor}
          stampCustomImage={stampCustomImage}
          stampBorder={stampBorder}
        />
      )}
    </group>
  );
}
function AnimatedPostcardBoard({
  currentSide,
  frontReceiver,
  frontMessage,
  backMessage,
  backAddress,
  theme,
  stampText,
  stampScale,
  stampReady,
  stamps,
  hoverPoint,
  setHoverPoint,
  onPlaceStamp,
  stampColor,
  stampCustomImage,
  stampBorder,
}) {
  const boardRef = useRef(null);
  const [visibleSide, setVisibleSide] = useState(currentSide);
  const [flipProgress, setFlipProgress] = useState(1);
  const targetSideRef = useRef(currentSide);
  const lastSideRef = useRef(currentSide);

  useFrame((_, delta) => {
    if (!boardRef.current) return;

    if (lastSideRef.current !== currentSide) {
      targetSideRef.current = currentSide;
      lastSideRef.current = currentSide;
      setFlipProgress(0);
    }

    setFlipProgress((prev) => {
      const next = Math.min(prev + delta * 1.8, 1);

      if (prev < 0.5 && next >= 0.5) {
        setVisibleSide(targetSideRef.current);
      }

      const lift = Math.sin(next * Math.PI);

      // 這裡做的是「掀開再放下」的翻頁感，不會讓整張卡片轉到桌子外面。
      boardRef.current.rotation.x = -lift * 1.15;
      boardRef.current.rotation.z = lift * 0.08;
      boardRef.current.position.y = lift * 0.65;
      boardRef.current.position.z = -lift * 0.18;

      if (next >= 1) {
        boardRef.current.rotation.x = 0;
        boardRef.current.rotation.z = 0;
        boardRef.current.position.y = 0;
        boardRef.current.position.z = 0;
      }

      return next;
    });
  });

  return (
    <group ref={boardRef}>
      <PostcardBoard
        currentSide={visibleSide}
        frontReceiver={frontReceiver}
        frontMessage={frontMessage}
        backMessage={backMessage}
        backAddress={backAddress}
        theme={theme}
        stampText={stampText}
        stampScale={stampScale}
        stampReady={stampReady}
        stamps={stamps}
        hoverPoint={hoverPoint}
        setHoverPoint={setHoverPoint}
        onPlaceStamp={onPlaceStamp}
        stampColor={stampColor}
        stampCustomImage={stampCustomImage}
        stampBorder={stampBorder}
      />
    </group>
  );
}
function ThreeDeskScene({
  currentSide,
  frontReceiver,
  frontMessage,
  backMessage,
  backAddress,
  theme,
  stampText,
  stampScale,
  stampReady,
  stampPressing,
  draggingStampTool,
  stampToolPosition,
  stamps,
  hoverPoint,
  setHoverPoint,
  onPlaceStamp,
  onStampToolPointerDown,
  onDragStampMove,
  onDragStampEnd,
    stampColor,
  stampBorder,
  stampCustomImage,
}) {
  return (
    <>
      <color attach="background" args={["#f4e3d1"]} />

      <ambientLight intensity={0.9} />
      <hemisphereLight skyColor="#fff4df" groundColor="#6d4328" intensity={0.75} />

      <directionalLight
        position={[3.5, 5, 3.5]}
        intensity={1.8}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      <directionalLight position={[-3, 2.5, -2]} intensity={0.45} />

      <DeskSurface
        draggingStampTool={draggingStampTool}
        onDragMove={onDragStampMove}
        onDragEnd={onDragStampEnd}
      />

      <DeskDecorations />

      <AnimatedPostcardBoard
        currentSide={currentSide}
        frontReceiver={frontReceiver}
        frontMessage={frontMessage}
        backMessage={backMessage}
        backAddress={backAddress}
        theme={theme}
        stampText={stampText}
        stampScale={stampScale}
        stampReady={stampReady}
        stamps={stamps}
        hoverPoint={hoverPoint}
        setHoverPoint={setHoverPoint}
        onPlaceStamp={onPlaceStamp}
        stampColor={stampColor}
        stampCustomImage={stampCustomImage}
        stampBorder={stampBorder}
        />

      <DeskStampTool
        stampText={stampText}
        stampReady={stampReady}
        pressing={stampPressing}
        dragging={draggingStampTool}
        position={stampToolPosition}
        onPointerDown={onStampToolPointerDown}
      />
      {/* 拖曳預覽：只有拖曳中才顯示 */}
      {draggingStampTool && (
        <DragPreview
          position={stampToolPosition}
          stampText={stampText}
          stampColor={stampColor}
          stampBorder={stampBorder}
          stampCustomImage={stampCustomImage}
          stampScale={stampScale}
        />
      )}

      <ContactShadows
        position={[0, -0.025, 0]}
        opacity={0.35}
        scale={8}
        blur={2.7}
        far={4}
      />

      <OrbitControls
        enabled={!draggingStampTool}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={4}
        maxDistance={7.4}
        maxPolarAngle={Math.PI / 2.05}
        minPolarAngle={Math.PI / 5}
      />
    </>
  );
}

function ThreeDeskPostcard({ onSaveArtwork }) {
  const glRef = useRef(null);

  const [frontReceiver, setFrontReceiver] = useState("To my dear friend");
  const [frontMessage, setFrontMessage] = useState("Wish you were here!");
  const [backMessage, setBackMessage] = useState(
    "Greetings from Stamp Studio! Hope you are having a wonderful day."
  );
  const [backAddress, setBackAddress] = useState(
    "Name:\nAddress:\nCity:\nCountry:"
  );

  const [stampBorder, setStampBorder] = useState(true); // true = 有邊框
  const [currentSide, setCurrentSide] = useState("front");
  const [theme, setTheme] = useState("vintage");
  const [stampText, setStampText] = useState("LOVE");
  const [stampScale, setStampScale] = useState(1);
  const [stampReady, setStampReady] = useState(true);
  const [stampPressing, setStampPressing] = useState(false);
  const [draggingStampTool, setDraggingStampTool] = useState(false);
  const [stampToolPosition, setStampToolPosition] = useState({
    x: 2.85,
    z: -0.25
  });
  const [stamps, setStamps] = useState([]);
  const [hoverPoint, setHoverPoint] = useState(null);
  const [showOutputPreview, setShowOutputPreview] = useState(false);
  const [exportPreview, setExportPreview] = useState(null);
  const [showStampSettings, setShowStampSettings] = useState(false);
  const [stampColor, setStampColor] = useState("#b32924");
  const [stampCustomImage, setStampCustomImage] = useState(null);      // 處理後的圖（給蓋章用）
  const [stampOriginalImage, setStampOriginalImage] = useState(null);   // 原始圖（給重新上色用）
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawColor, setDrawColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(8);
  const [drawMode, setDrawMode] = useState("pen");
  const drawCanvasRef = useRef(null);
  const lastPointRef = useRef(null);

  const themes = {
    vintage: "Vintage",
    pink: "Pink",
    sky: "Sky",
    night: "Night",
    cream: "Cream"
  };

  useEffect(() => {
    if (!stampOriginalImage) return;
    applyColorToImage(stampOriginalImage, stampColor).then((colored) => {
      setStampCustomImage(colored);
    });
  }, [stampColor, stampOriginalImage]);

  const stampOptions = ["LOVE", "TRAVEL", "AIR MAIL", "CGU", "2026", "MEMORY"];

  const cardBounds = {
    minX: -2.25,
    maxX: 2.25,
    minZ: -1.45,
    maxZ: 1.45
  };

  const isPointOnCard = (point) => {
    return (
      point.x >= cardBounds.minX &&
      point.x <= cardBounds.maxX &&
      point.z >= cardBounds.minZ &&
      point.z <= cardBounds.maxZ
    );
  };

  const getThemeColors = () => {
    const themeColors = {
      vintage: { paper: "#f3d5a4", edge: "#a8754d", text: "#5b3924" },
      pink: { paper: "#ffdce8", edge: "#c78398", text: "#6c3556" },
      sky: { paper: "#d7f1ff", edge: "#79aecd", text: "#2f5573" },
      night: { paper: "#34396c", edge: "#1f244f", text: "#fff2d6" },
      cream: { paper: "#fff2cc", edge: "#b98b5d", text: "#5b3924" }
    };

    return themeColors[theme] || themeColors.vintage;
  };

  const drawWrappedText = (ctx, text, x, y, maxWidth, lineHeight) => {
    const words = String(text || "").replace(/\n/g, " \n ").split(" ");
    let line = "";
    let currentY = y;

    words.forEach((word) => {
      if (word === "\n") {
        ctx.fillText(line, x, currentY);
        line = "";
        currentY += lineHeight;
        return;
      }

      const testLine = line ? `${line} ${word}` : word;
      const width = ctx.measureText(testLine).width;

      if (width > maxWidth && line) {
        ctx.fillText(line, x, currentY);
        line = word;
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    });

    if (line) {
      ctx.fillText(line, x, currentY);
    }
  };

  const drawStampOnCanvas = (ctx, x, y, text, rotation, scale, color, customImage, border = true) => {
    const c = (color && color.startsWith("#") && color.length === 7) ? color : "#b32924";
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation || 0);
    ctx.scale(scale || 1, scale || 1);

    if (border) {
      ctx.strokeStyle = c + "eb";
      ctx.fillStyle = c + "14";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(0, 0, 62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.setLineDash([9, 7]);
      ctx.beginPath();
      ctx.arc(0, 0, 43, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (customImage) {
      const img = new Image();
      img.src = customImage;
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, border ? 43 : 55, 0, Math.PI * 2); // 無邊框時圖片可以更大
      ctx.clip();
      ctx.drawImage(img, border ? -43 : -55, border ? -43 : -55, border ? 86 : 110, border ? 86 : 110);
      ctx.restore();
    } else {
      ctx.fillStyle = c;
      ctx.font = "bold 18px Trebuchet MS, Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text || "STAMP", 0, 0);
    }

    ctx.restore();
  };

  const renderPostcardSideImage = (side) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 650;
    const ctx = canvas.getContext("2d");
    const colors = getThemeColors();

    ctx.fillStyle = "#f7eadc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.shadowColor = "rgba(70, 40, 20, 0.22)";
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 18;
    ctx.fillStyle = colors.edge;
    ctx.fillRect(82, 92, 836, 486);
    ctx.shadowColor = "transparent";
    ctx.fillStyle = colors.paper;
    ctx.fillRect(100, 100, 800, 460);
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,0.13)";
    for (let x = 100; x < 900; x += 16) {
      for (let y = 100; y < 560; y += 16) {
        ctx.fillRect(x, y, 2, 2);
      }
    }

    ctx.fillStyle = colors.text;
    ctx.strokeStyle = colors.text;
    ctx.lineWidth = 2;

    if (side === "front") {
      ctx.font = "bold 34px Georgia, serif";
      ctx.fillText("POST CARD", 155, 185);

      ctx.font = "bold 22px Trebuchet MS, Arial";
      ctx.fillText(frontReceiver, 155, 255);

      ctx.font = "30px Georgia, serif";
      drawWrappedText(ctx, frontMessage, 155, 330, 390, 42);

      ctx.font = "bold 17px Trebuchet MS, Arial";
      ctx.textAlign = "center";
      ctx.fillText("STAMP AREA", 710, 182);
      ctx.textAlign = "left";

      [0, 1, 2].forEach((i) => {
        ctx.beginPath();
        ctx.moveTo(640, 405 + i * 28);
        ctx.lineTo(825, 405 + i * 28);
        ctx.stroke();
      });
    } else {
      ctx.font = "bold 31px Georgia, serif";
      ctx.fillText("MESSAGE", 150, 180);

      ctx.font = "22px Trebuchet MS, Arial";
      drawWrappedText(ctx, backMessage, 150, 245, 330, 32);

      ctx.beginPath();
      ctx.moveTo(505, 150);
      ctx.lineTo(505, 520);
      ctx.stroke();

      ctx.font = "22px Trebuchet MS, Arial";
      drawWrappedText(ctx, backAddress, 565, 245, 270, 30);

      ctx.setLineDash([12, 8]);
      ctx.strokeRect(675, 160, 135, 95);
      ctx.setLineDash([]);
      ctx.font = "bold 15px Trebuchet MS, Arial";
      ctx.textAlign = "center";
      ctx.fillText("STAMP", 742, 213);
      ctx.textAlign = "left";
    }

    const sideStamps = stamps.filter((stamp) => stamp.side === side);
    sideStamps.forEach((stamp) => {
      const x = 100 + ((stamp.x - cardBounds.minX) / (cardBounds.maxX - cardBounds.minX)) * 800;
      const y = 100 + ((stamp.z - cardBounds.minZ) / (cardBounds.maxZ - cardBounds.minZ)) * 460;
      drawStampOnCanvas(ctx, x, y, stamp.text, stamp.rotation, stamp.scale, stamp.color, stamp.customImage, stamp.border !== false);
      //                                                                                                       ↑ 加這個
    });

    ctx.fillStyle = "#7b5638";
    ctx.font = "bold 18px Trebuchet MS, Arial";
    ctx.fillText(side === "front" ? "FRONT SIDE" : "BACK SIDE", 100, 610);

    return canvas.toDataURL("image/png");
  };

  const createFrontBackExport = () => {
    const front = renderPostcardSideImage("front");
    const back = renderPostcardSideImage("back");

    const sheet = document.createElement("canvas");
    sheet.width = 2000;
    sheet.height = 880;
    const ctx = sheet.getContext("2d");

    const frontImage = new Image();
    const backImage = new Image();

    return new Promise((resolve) => {
      let loaded = 0;
      const finish = () => {
        loaded += 1;
        if (loaded < 2) return;

        ctx.fillStyle = "#f7eadc";
        ctx.fillRect(0, 0, sheet.width, sheet.height);
        ctx.fillStyle = "#6a3d24";
        ctx.font = "bold 44px Trebuchet MS, Arial";
        ctx.fillText("Stamp Studio · 3D Postcard Export", 80, 75);
        ctx.font = "22px Trebuchet MS, Arial";
        ctx.fillStyle = "#8a674d";
        ctx.fillText("This output includes both the front and back sides of the postcard.", 80, 112);

        ctx.drawImage(frontImage, 70, 155, 900, 585);
        ctx.drawImage(backImage, 1030, 155, 900, 585);

        ctx.fillStyle = "#6a3d24";
        ctx.font = "bold 28px Trebuchet MS, Arial";
        ctx.fillText("Front", 70, 790);
        ctx.fillText("Back", 1030, 790);

        resolve({
          front,
          back,
          sheet: sheet.toDataURL("image/png")
        });
      };

      frontImage.onload = finish;
      backImage.onload = finish;
      frontImage.src = front;
      backImage.src = back;
    });
  };

  const openOutputPreview = async () => {
    const preview = await createFrontBackExport();
    setExportPreview(preview);
    setShowOutputPreview(true);
  };

  const handleStampToolPointerDown = () => {
    setDraggingStampTool(true);
    setStampReady(true);
    setStampPressing(true);

    setTimeout(() => {
      setStampPressing(false);
    }, 180);
  };

  const handleDragStampMove = (point) => {
    setStampToolPosition({
      x: THREE.MathUtils.clamp(point.x, -3.8, 3.8),
      z: THREE.MathUtils.clamp(point.z, -2.35, 2.35)
    });
  };

  const handleDragStampEnd = (point) => {
    setDraggingStampTool(false);

    const finalPoint = {
      x: THREE.MathUtils.clamp(point.x, -3.8, 3.8),
      z: THREE.MathUtils.clamp(point.z, -2.35, 2.35)
    };

    setStampToolPosition(finalPoint);

    if (isPointOnCard(finalPoint)) {
      placeStamp({
        x: finalPoint.x,
        z: finalPoint.z,
        side: currentSide
      });
    }
  };

  const applyColorToImage = (originalDataUrl, color) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const size = Math.min(img.width, img.height);
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");

        // 裁成圓形
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.clip();

        // 置中繪製原圖
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);

        // 取得像素
        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;

        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);

        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] === 0) continue;

          // 第一步：轉灰階
          const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

          // 第二步：拉高對比（讓灰階往黑白兩端推）
          // contrast 值越高對比越強，128 是中點
          const contrast = 2.2;
          const adjusted = Math.min(255, Math.max(0, (gray - 128) * contrast + 128));

          // 第三步：白色背景 → 透明，其他依灰度決定透明度
          if (adjusted > 220) {
            // 非常亮 → 完全透明（白色背景消除）
            data[i + 3] = 0;
          } else {
            // 實色疊印混合：用灰度當 alpha 蒙版
            // 越暗（adjusted 越小）→ 越不透明，顏色越飽滿
            const alpha = 1 - adjusted / 255;

            // 實色疊印：直接用選色填滿，不做漸層過渡
            // 越暗的地方完全是選色，越亮的地方透明度降低
            data[i]     = r;
            data[i + 1] = g;
            data[i + 2] = b;
            data[i + 3] = Math.round(alpha * 255);
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = originalDataUrl;
    });
  };
  
  const initDrawCanvas = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const loadImageToDrawCanvas = (dataUrl) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // 置中繪製，保持比例
      const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
      const x = (canvas.width - img.width * scale) / 2;
      const y = (canvas.height - img.height * scale) / 2;
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
    };
    img.src = dataUrl;
  };

  const getCanvasPoint = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const handleDrawStart = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    const point = getCanvasPoint(e, drawCanvasRef.current);
    lastPointRef.current = point;
  };

  const handleDrawMove = (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = drawCanvasRef.current;
    const ctx = canvas.getContext("2d");
    const point = getCanvasPoint(e, canvas);
    const last = lastPointRef.current;

    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(point.x, point.y);
    ctx.strokeStyle = drawMode === "eraser" ? "#ffffff" : drawColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    lastPointRef.current = point;
  };

  const handleDrawEnd = (e) => {
    e.preventDefault();
    setIsDrawing(false);
    lastPointRef.current = null;
  };

  const applyDrawingAsStamp = async () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    setStampOriginalImage(dataUrl);
    const colored = await applyColorToImage(dataUrl, stampColor);
    setStampCustomImage(colored);
  };

  const clearDrawCanvas = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleStampImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const originalDataUrl = reader.result;
      setStampOriginalImage(originalDataUrl);
      const colored = await applyColorToImage(originalDataUrl, stampColor);
      setStampCustomImage(colored);
      setTimeout(() => loadImageToDrawCanvas(originalDataUrl), 100);
    };
    reader.readAsDataURL(file);
  };


  const placeStamp = ({ x, z, side }) => {
    setStampPressing(true);

    const newStamp = {
      id: makeId(),
      side,
      x,
      z,
      text: stampText,
      scale: stampScale,
      color: stampColor,   // ← 加上這行
      customImage: stampCustomImage || null,  // ← 加這行
      rotation: THREE.MathUtils.degToRad(Math.random() * 22 - 11),
      border: stampBorder,  // ← 加這行
    };

    setStamps((prev) => [...prev, newStamp]);

    setTimeout(() => {
      setStampPressing(false);
    }, 220);
  };
const undoLastStamp = () => {
  setStamps((prev) => {
    if (prev.length === 0) {
      alert("目前沒有可以撤銷的印章。");
      return prev;
    }

    return prev.slice(0, -1);
  });
};
  const clearSideStamps = () => {
    setStamps((prev) => prev.filter((stamp) => stamp.side !== currentSide));
  };

  const clearAllStamps = () => {
    setStamps([]);
  };

  const resetStampTool = () => {
    setStampToolPosition({
      x: 2.85,
      z: -0.25
    });
    setDraggingStampTool(false);
  };

  const getCanvasImage = () => {
    if (!glRef.current) return null;
    return glRef.current.domElement.toDataURL("image/png");
  };

  const download3DDesk = async () => {
    const preview = exportPreview || (await createFrontBackExport());
    setExportPreview(preview);
    downloadImage(preview.sheet, "postcard-front-and-back.png");
  };

  const saveToStorage = async () => {
    const preview = exportPreview || (await createFrontBackExport());
    setExportPreview(preview);

    const current3DImage = getCanvasImage();

    const item = {
      id: makeId(),
      type: "postcard",
      title: "3D Craft Desk Postcard",
      subtitle: `Front + Back · ${stamps.length} stamps`,
      createdAt: new Date().toLocaleString(),
      image: preview.sheet,
      data: {
        frontReceiver,
        frontMessage,
        backMessage,
        backAddress,
        currentSide,
        theme,
        stampText,
        stampScale,
        stamps,
        frontImage: preview.front,
        backImage: preview.back,
        sceneImage: current3DImage
      }
    };

    const ok = await onSaveArtwork("postcard", item);

    if (ok !== false) {
      alert("明信片正反面已一起存到 My Storage！");
    }
  };

  return (
    <div className="studio-layout">
      <section className="control-panel">
        <h2>3D Craft Desk Mode</h2>

        <div className="tool-group">
          <label>Working Side</label>
          <div className="layout-buttons">
            <button
              className={currentSide === "front" ? "active" : ""}
              onClick={() => setCurrentSide("front")}
            >
              Front
            </button>
            <button
              className={currentSide === "back" ? "active" : ""}
              onClick={() => setCurrentSide("back")}
            >
              Back
            </button>
          </div>
        </div>

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

        <div className="tool-group">
          <label>Postcard Theme</label>
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
          <label>3D Stamp Text</label>
          <div className="stamp-buttons">
            {stampOptions.map((item) => (
              <button
                key={item}
                className={stampText === item ? "active" : ""}
                onClick={() => setStampText(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="tool-group">
          <button
            onClick={() => setShowStampSettings(true)}
            style={{
              border: "none",
              borderRadius: 999,
              padding: "11px 16px",
              background: "#8b5734",
              color: "white",
              fontWeight: "bold",
              cursor: "pointer",
              width: "100%",
              fontSize: 15
            }}
          >
            🖋 Stamp Settings（自定義印章）
          </button>
        </div>

        

        <div className="tool-group">
          <label>Stamp Size</label>
          <input
            type="range"
            min="0.7"
            max="1.45"
            step="0.05"
            value={stampScale}
            onChange={(e) => setStampScale(Number(e.target.value))}
          />
        </div>

        <div className="tool-group">
          <label>Stamp Status</label>
          <div className="side-badge">
            {draggingStampTool
              ? "Dragging 3D Stamp"
              : stampReady
                ? "Stamp Ready"
                : "Click 3D Stamp First"}
          </div>
        </div>

        <div className="storage-warning">
          操作方式：按住桌上的 3D 印章拖曳到明信片上，放開滑鼠就會蓋章。
          Front / Back 可切換目前正在編輯的正反面。
        </div>

        <div className="action-buttons">
        <button onClick={openOutputPreview}>360° Output Preview</button>
        <button onClick={saveToStorage}>Save Front + Back to My Storage</button>
        <button onClick={download3DDesk}>Download Front + Back PNG</button>
        <button onClick={undoLastStamp}>Undo Last Stamp</button>
        <button onClick={resetStampTool}>Reset Stamp Position</button>
        <button onClick={clearSideStamps}>Clear This Side Stamps</button>
        <button className="clear-btn" onClick={clearAllStamps}>
            Clear All Stamps
        </button>
        </div>
      </section>

      <section className="preview-area three-desk-preview">
        <div className="three-desk-title">
          <div>
            <h3>3D Creative Worktable</h3>
            <p>
              Drag the 3D stamp onto the postcard, then release it to place a
              stamp.
            </p>
          </div>
        </div>

        <div className="three-desk-canvas">
          <Canvas
            shadows
            camera={{ position: [3.4, 4.9, 4.2], fov: 43 }}
            gl={{ preserveDrawingBuffer: true, antialias: true, logarithmicDepthBuffer: true  }}
            onCreated={({ gl }) => {
              glRef.current = gl;
            }}
          >
            <ThreeDeskScene
              currentSide={currentSide}
              frontReceiver={frontReceiver}
              frontMessage={frontMessage}
              backMessage={backMessage}
              backAddress={backAddress}
              theme={theme}
              stampText={stampText}
              stampScale={stampScale}
              stampReady={stampReady}
              stampPressing={stampPressing}
              draggingStampTool={draggingStampTool}
              stampToolPosition={stampToolPosition}
              stamps={stamps}
              hoverPoint={hoverPoint}
              setHoverPoint={setHoverPoint}
              onPlaceStamp={placeStamp}
              onStampToolPointerDown={handleStampToolPointerDown}
              onDragStampMove={handleDragStampMove}
              onDragStampEnd={handleDragStampEnd}
              stampColor={stampColor}
              stampBorder={stampBorder}
              stampCustomImage={stampCustomImage}
            />
          </Canvas>
        </div>

        <div className="three-desk-quick-actions">
          <button onClick={openOutputPreview}>360° Preview</button>
          <button onClick={() => setShowStampSettings(true)}>🖋 Stamp Settings</button>  {/* ← 加這行 */}
          <button onClick={undoLastStamp}>Undo Last Stamp</button>
          <button onClick={resetStampTool}>Reset Stamp Position</button>
          <button onClick={clearSideStamps}>Clear This Side</button>
        </div>

        <p className="hint-text">
          Tip: Drag the 3D stamp itself. While dragging, camera rotation is
          paused, so the stamp is easier to move.
        </p>
      </section>

      {showOutputPreview && exportPreview && (
        <div className="output-preview-overlay">
          <div className="output-preview-modal">
            <div className="output-preview-header">
              <div>
                <h3>360° Output Preview</h3>
                <p>確認正反面後，再下載或存到 My Storage。</p>
              </div>
              <button
                className="output-close-btn"
                onClick={() => setShowOutputPreview(false)}
              >
                ×
              </button>
            </div>

            <div className="output-preview-stage">
              <div className="output-spin-card">
                <div className="output-card-face output-card-front">
                  <img src={exportPreview.front} alt="front preview" />
                </div>
                <div className="output-card-face output-card-back">
                  <img src={exportPreview.back} alt="back preview" />
                </div>
              </div>
            </div>

            <div className="output-front-back-row">
              <div>
                <h4>Front</h4>
                <img src={exportPreview.front} alt="front side" />
              </div>
              <div>
                <h4>Back</h4>
                <img src={exportPreview.back} alt="back side" />
              </div>
            </div>

            <div className="output-preview-actions">
              <button onClick={saveToStorage}>Save Front + Back to My Storage</button>
              <button onClick={download3DDesk}>Download Front + Back PNG</button>
              <button onClick={() => setShowOutputPreview(false)}>Back to Editing</button>
            </div>
          </div>
        </div>
      )}
      
      {showStampSettings && (
        <div className="output-preview-overlay" onClick={() => setShowStampSettings(false)}>
          <div
            className="output-preview-modal"
            style={{ maxWidth: 480 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="output-preview-header">
              <div>
                <h3>🖋 Stamp Settings</h3>
                <p>自定義印章文字、顏色與圖案</p>
              </div>
              <button className="output-close-btn" onClick={() => setShowStampSettings(false)}>×</button>
            </div>

            {/* 文字選擇 */}
            <div className="tool-group">
              <label>預設印章文字</label>
              <div className="stamp-buttons">
                {stampOptions.map((item) => (
                  <button
                    key={item}
                    className={stampText === item ? "active" : ""}
                    onClick={() => setStampText(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {/* 自定義文字輸入 */}
            <div className="tool-group">
              <label>自定義文字</label>
              <input
                type="text"
                placeholder="例如：MIYA / DAILY LIFE"
                maxLength={12}
                value={stampOptions.includes(stampText) ? "" : stampText}
                onChange={(e) => setStampText(e.target.value || "LOVE")}
              />
            </div>

            {/* 顏色選擇 */}
            <div className="tool-group">
              <label>印章顏色</label>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                {["#b32924","#2a6eb3","#2ab36e","#8b2ab3","#b3862a","#222222"].map((color) => (
                  <div
                    key={color}
                    onClick={() => setStampColor(color)}
                    style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: color, cursor: "pointer",
                      border: stampColor === color ? "3px solid #333" : "3px solid transparent",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.18)"
                    }}
                  />
                ))}
                <input
                  className="color-input"
                  type="color"
                  value={stampColor}
                  onChange={(e) => setStampColor(e.target.value)}
                  style={{ width: 40, height: 36 }}
                />
              </div>
            </div>

            {/* 邊框切換 */}
            <div className="tool-group">
              <label>印章樣式</label>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setStampBorder(true)}
                  style={{
                    border: "none", borderRadius: 999, padding: "10px 16px",
                    background: stampBorder ? "#8b5734" : "#efe0d1",
                    color: stampBorder ? "white" : "#5b3924",
                    fontWeight: "bold", cursor: "pointer"
                  }}
                >
                  ◎ 有邊框
                </button>
                <button
                  onClick={() => setStampBorder(false)}
                  style={{
                    border: "none", borderRadius: 999, padding: "10px 16px",
                    background: !stampBorder ? "#8b5734" : "#efe0d1",
                    color: !stampBorder ? "white" : "#5b3924",
                    fontWeight: "bold", cursor: "pointer"
                  }}
                >
                  ✦ 無邊框
                </button>
              </div>
            </div>

            {/* 圖片上傳 */}
            <div className="tool-group">
              <label>上傳印章圖案（會自動去背）</label>
              <label className="upload-btn">
                Upload Image
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleStampImageUpload} />
              </label>
              {stampCustomImage && (
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
                  <img src={stampCustomImage} alt="stamp preview"
                    style={{ width: 64, height: 64, objectFit: "contain", background: "#f4e5d6", borderRadius: 10 }} />
                  <button className="remove-photo-btn" 
                  onClick={() => {
                    setShowStampSettings(true);
                    setTimeout(() => {
                      initDrawCanvas();
                      if (stampOriginalImage) loadImageToDrawCanvas(stampOriginalImage);
                    }, 50);
                  }}>Remove</button>
                </div>
              )}
            </div>

            {/* 繪製章面 */}
            <div className="tool-group">
              <label>繪製章面</label>

              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  onClick={() => setDrawMode("pen")}
                  style={{
                    border: "none", borderRadius: 999, padding: "8px 14px",
                    background: drawMode === "pen" ? "#8b5734" : "#efe0d1",
                    color: drawMode === "pen" ? "white" : "#5b3924",
                    fontWeight: "bold", cursor: "pointer"
                  }}
                >
                  ✏️ 畫筆
                </button>
                <button
                  onClick={() => setDrawMode("eraser")}
                  style={{
                    border: "none", borderRadius: 999, padding: "8px 14px",
                    background: drawMode === "eraser" ? "#8b5734" : "#efe0d1",
                    color: drawMode === "eraser" ? "white" : "#5b3924",
                    fontWeight: "bold", cursor: "pointer"
                  }}
                >
                  🧹 橡皮擦
                </button>

                <input
                  type="color"
                  value={drawColor}
                  onChange={(e) => setDrawColor(e.target.value)}
                  style={{ width: 36, height: 36, borderRadius: "50%", border: "none", cursor: "pointer", padding: 2 }}
                  title="畫筆顏色"
                />

                <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                  <span style={{ fontSize: 12, color: "#7b5638", whiteSpace: "nowrap" }}>筆刷</span>
                  <input
                    type="range" min={2} max={40} value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: 12, color: "#7b5638", width: 24 }}>{brushSize}</span>
                </div>
              </div>

              <div style={{ position: "relative", width: "100%", aspectRatio: "1", borderRadius: "50%", overflow: "hidden", border: `3px solid ${stampColor}`, boxShadow: "0 4px 18px rgba(0,0,0,0.12)", background: "#fff" }}>
                <canvas
                  ref={drawCanvasRef}
                  width={400}
                  height={400}
                  style={{ width: "100%", height: "100%", display: "block", cursor: drawMode === "eraser" ? "cell" : "crosshair", touchAction: "none" }}
                  onMouseDown={handleDrawStart}
                  onMouseMove={handleDrawMove}
                  onMouseUp={handleDrawEnd}
                  onMouseLeave={handleDrawEnd}
                  onTouchStart={handleDrawStart}
                  onTouchMove={handleDrawMove}
                  onTouchEnd={handleDrawEnd}
                />
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button
                  onClick={applyDrawingAsStamp}
                  style={{
                    flex: 1, border: "none", borderRadius: 999, padding: "10px 14px",
                    background: "#8b5734", color: "white", fontWeight: "bold", cursor: "pointer"
                  }}
                >
                  套用為印章
                </button>
                <button
                  onClick={() => {
                    setShowStampSettings(true);
                    setTimeout(() => {
                      initDrawCanvas();
                      if (stampOriginalImage) loadImageToDrawCanvas(stampOriginalImage);
                    }, 50);
                  }}
                  style={{
                    border: "none", borderRadius: 999, padding: "10px 14px",
                    background: "#efe0d1", color: "#5b3924", fontWeight: "bold", cursor: "pointer"
                  }}
                >
                  重置
                </button>
                <button
                  onClick={clearDrawCanvas}
                  style={{
                    border: "none", borderRadius: 999, padding: "10px 14px",
                    background: "#b86b5b", color: "white", fontWeight: "bold", cursor: "pointer"
                  }}
                >
                  清除
                </button>
              </div>

              <p style={{ marginTop: 8, fontSize: 13, color: "#96755c", lineHeight: 1.5 }}>
                上傳圖片後會自動載入畫布，可以繼續在上面繪製。按「套用為印章」後才會更新印章。
              </p>
            </div>

            <div className="action-buttons">
              <button onClick={() => setShowStampSettings(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ThreeDeskPostcard;