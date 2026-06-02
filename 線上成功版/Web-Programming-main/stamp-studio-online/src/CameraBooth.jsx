import React, { useState, useRef, useEffect } from 'react';
// 將網頁 HTML 轉成圖片的第三方套件(下載Booth)：
import html2canvas from 'html2canvas';


// ================= 濾鏡 Canvas 處理函式 =================
// 修正點：將 CSS filter 屬性完美對應到 Canvas 的 ctx.filter，確保導出圖片帶有濾鏡
const getCanvasFilter = (filter) => {
  switch (filter) {
    case "warm": return "sepia(0.3) saturate(1.2) hue-rotate(-10deg)";
    case "cool": return "contrast(1.1) hue-rotate(180deg) saturate(0.9)";
    case "dramatic": return "contrast(1.3) brightness(0.9)";
    case "ccd": return "contrast(1.15) saturate(0.85) sepia(0.05)";
    case "polaroid": return "sepia(0.35) brightness(1.05) contrast(0.95)";
    case "dreamcore": return "hue-rotate(50deg) saturate(1.2) brightness(1.05)";
    case "glitch": return "contrast(1.4) hue-rotate(-15deg)";
    case "mono": return "grayscale(1) contrast(1.25)";
    default: return "none";
  }
};


function applyExtraFilterOverlay(ctx, filter, x, y, w, h) {
  // 這裡存放除了顏色濾鏡外，額外的「特殊視覺效果」（如掃描線、暗角、故障條）
  switch (filter) {
    case "dramatic": // 戲劇感（加深暗角）
      const vignette = ctx.createRadialGradient(
        x + w / 2, y + h / 2, w * 0.28,
        x + w / 2, y + h / 2, w * 0.75
      );
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,0,0,0.52)");
      ctx.fillStyle = vignette;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "rgba(80, 20, 10, 0.1)";
      ctx.fillRect(x, y, w, h);
      break;


    case "ccd": // 復古 CCD 數位相機噪點與掃描線
      ctx.fillStyle = "rgba(30, 180, 160, 0.05)";
      ctx.fillRect(x, y, w, h);
      // 繪製橫向電視掃描線
      ctx.strokeStyle = "rgba(0, 0, 0, 0.05)";
      ctx.lineWidth = 1;
      for (let sy = y; sy < y + h; sy += 4) {
        ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x + w, sy); ctx.stroke();
      }
      // 隨機打上白色噪點
      for (let n = 0; n < 120; n++) {
        const nx = x + Math.random() * w;
        const ny = y + Math.random() * h;
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.12})`;
        ctx.fillRect(nx, ny, 1.5, 1.5);
      }
      break;


    case "polaroid": // 加上專屬棕色復古暗角
      const pVignette = ctx.createRadialGradient(x + w / 2, y + h / 2, w * 0.35, x + w / 2, y + h / 2, w * 0.72);
      pVignette.addColorStop(0, "rgba(0,0,0,0)");
      pVignette.addColorStop(1, "rgba(80,50,10,0.25)");
      ctx.fillStyle = pVignette; ctx.fillRect(x, y, w, h);
      break;


    case "dreamcore": // 繪製中心發光的白色強光暈
      const dreamGlow = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, w * 0.6);
      dreamGlow.addColorStop(0, "rgba(255,255,255,0.15)");
      dreamGlow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = dreamGlow; ctx.fillRect(x, y, w, h);
      break;


    case "glitch": // 賽博朋克電子故障條
      for (let g = 0; g < 4; g++) {
        const gy = y + Math.random() * h;
        const gh = 2 + Math.random() * 8;
        ctx.fillStyle = `rgba(255, 0, 60, ${0.12 + Math.random() * 0.15})`;
        ctx.fillRect(x + Math.random() * 8 - 4, gy, w, gh);
        ctx.fillStyle = `rgba(0, 200, 255, ${0.08 + Math.random() * 0.12})`;
        ctx.fillRect(x - Math.random() * 8 + 4, gy + gh, w, gh * 0.8);
      }
      const noiseY = y + Math.random() * h * 0.7;
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(x, noiseY, w, 3 + Math.random() * 5);
      break;


    case "mono": // 高對比黑白暗角
      const monoVig = ctx.createRadialGradient(x + w / 2, y + h / 2, w * 0.3, x + w / 2, y + h / 2, w * 0.78);
      monoVig.addColorStop(0, "rgba(0,0,0,0)");
      monoVig.addColorStop(1, "rgba(0,0,0,0.4)");
      ctx.fillStyle = monoVig; ctx.fillRect(x, y, w, h);
      break;


    default: break;
  }
}


// 根據選擇的濾鏡名稱，對應即時 <video> 觀景窗的 CSS filter 預覽
const getVideoFilterStyle = (filter) => {
  return getCanvasFilter(filter);
};




// ================= CameraBooth 主要元件 =================
const CameraBooth = ({ onSaveArtwork }) => {
  const [photos, setPhotos] = useState([]); // 存放拍好的照片網址
  const [stripType, setStripType] = useState(4); // 3=三格, 4=四格
  const [title, setTitle] = useState("MY MEMORIES");
  const [subtitle, setSubtitle] = useState("PHOTO BOOTH");
  const [themeColor, setThemeColor] = useState("#ffffff"); // 照片條底色
  const [selectedFilter, setSelectedFilter] = useState("none"); // 存放當前選取的濾鏡狀態


  // Ref 確定哪一塊被下載
  const stripRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);


  // 當使用者一進到相機頁面，自動要求權限並啟動視訊鏡頭
  useEffect(() => {
    let isMounted = true;


    async function initCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 800, height: 600, facingMode: 'user' }
        });


        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }


        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
        }
      } catch (err) {
        console.error("相機啟動失敗:", err);
        alert("無法取得相機權限，請確認瀏覽器隱私權設定。");
      }
    }
    initCamera();


    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, []);


  // 按下拍照的邏輯 (已修復濾鏡無印上去的 Bug)
  const takePhoto = () => {
    if (photos.length >= stripType) {
      alert(`您選擇的是人生${stripType}格，照片已經拍滿囉！`);
      return;
    }


    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
     
      const ctx = canvas.getContext('2d');
     
      // 💡 【核心修復 1】：先清除畫布，確保乾淨
      ctx.clearRect(0, 0, canvas.width, canvas.height);


      // 💡 【核心修復 2】：將選定的濾鏡直接賦予給 Canvas 2D 內容，與觀景窗完全同步
      ctx.filter = getCanvasFilter(selectedFilter);
     
      // 1. 實作左右鏡像
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
     
      // 2. 繪製視訊畫面（此時會直接帶有 ctx.filter 的濾鏡效果）
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
     
      // 3. 還原鏡像矩陣與濾鏡設定，以便繪製額外的特效（如噪點、暗角）
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.filter = "none"; // 關閉基底濾鏡，避免疊加特效也被重複二度濾鏡


      // 4. 套用特殊疊加效果（暗角、掃描線等）
      applyExtraFilterOverlay(ctx, selectedFilter, 0, 0, canvas.width, canvas.height);
     
      // 💡 【核心修復 3】：導出帶有完整濾鏡渲染的圖片
      const imgUrl = canvas.toDataURL('image/png');
      setPhotos(prev => [...prev, imgUrl]);
    }
  };


  const makeLocalId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const createFullStripDataUrl = async () => {
    if (photos.length < stripType) {
      alert(`請先拍滿 ${stripType} 張照片喔！`);
      return null;
    }

    if (!stripRef.current) return null;

    const canvas = await html2canvas(stripRef.current, {
      useCORS: true,
      scale: 2,
      backgroundColor: null
    });

    return canvas.toDataURL('image/png');
  };

  // 下載處理函式
  const handleDownloadStrip = async () => {
    try {
      const fullImageDataUrl = await createFullStripDataUrl();
      if (!fullImageDataUrl) return;
      downloadImage(fullImageDataUrl, `${title || "camera-photo-booth"}-人生${stripType}格.png`);
    } catch (error) {
      console.error("生成相片條失敗:", error);
      alert("下載失敗，請稍後再試。");
    }
  };

  // 新增：相機Booth也可以存到 My Storage
  const handleSaveToStorage = async () => {
    if (!onSaveArtwork) {
      alert("目前還沒有接到 My Storage 儲存功能，請確認 App.jsx 有傳入 onSaveArtwork。");
      return;
    }

    try {
      const fullImageDataUrl = await createFullStripDataUrl();
      if (!fullImageDataUrl) return;

      const ok = await onSaveArtwork("photobooth", {
        id: makeLocalId(),
        type: "photobooth",
        title: title || "Camera Booth",
        subtitle: subtitle || `Camera ${stripType}-Cut Booth`,
        createdAt: new Date().toLocaleString(),
        image: fullImageDataUrl
      });

      if (ok) alert("相機Booth已存到 My Storage！");
    } catch (error) {
      console.error("相機Booth儲存失敗:", error);
      alert("儲存失敗，請稍後再試。");
    }
  };


  function downloadImage(dataUrl, filename) {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    link.click();
  }    


  // 判斷底色是深色還是淺色，動態決定文字要用黑或白，避免字體隱形
  const isDarkBg = ['#1a1a1a'].includes(themeColor.toLowerCase());
  const textColor = isDarkBg ? '#ffffff' : '#333333';
  const subTextColor = isDarkBg ? '#cccccc' : '#666666';
  const dateTextColor = isDarkBg ? '#999999' : '#999999';


  return (
    <div className="camera-booth-layout" style={{ display: 'flex', gap: '40px', justifyContent: 'center', alignItems: 'flex-start', padding: '20px', flexWrap: 'wrap' }}>
     
      {/* ================= 左側：控制面板與即時鏡頭 ================= */}
      <div style={{ flex: '1', minWidth: '320px', maxWidth: '640px' }}>
       
        {/* 1. 即時視訊觀景窗 */}
        <div style={{ background: '#000', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{
              width: '100%',
              display: 'block',
              transform: 'scaleX(-1)',
              filter: getVideoFilterStyle(selectedFilter)
            }}
          />
        </div>


        {/* 2. 拍照與清空按鈕區 */}
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '20px', marginBottom: '25px' }}>
          <button onClick={takePhoto} style={snapBtnStyle}>
             截取相片 ({photos.length} / {stripType})
          </button>
          {photos.length > 0 && (
            <button onClick={() => { setPhotos([]); }} style={{ padding: '14px 32px', background: '#444', color: '#fff', border: 'none', borderRadius: '30px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
              重拍清空
            </button>
          )}
        </div>


        {/* 3. 編輯Booth框自訂面板 */}
        <div style={{ background: '#f8f9fa', padding: '30px', borderRadius: '20px', border: '1px solid #eef0f2', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
          <h3 style={{ marginTop: 0, fontSize: '22px', color: '#6D4328', marginBottom: '25px', borderBottom: '2px solid #eceff1', paddingBottom: '10px' }}>
            Booth樣式自訂面板
          </h3>
         
          {/* 欄位 1：版型選擇 */}
          <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontWeight: 'bold', fontSize: '16px', color: '#6D4328' }}>選擇照片格數 (Layout)</label>
            <select
              value={stripType}
              onChange={(e) => { setStripType(Number(e.target.value)); setPhotos([]); }}
              style={{ width: '100%', padding: '12px 16px', fontSize: '16px', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff', cursor: 'pointer' }}
            >
              <option value={3}>3-Cut</option>
              <option value={4}>4-Cut</option>
            </select>
          </div>


          {/* 欄位 2：主標題 */}
          <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontWeight: 'bold', fontSize: '16px', color: '#6D4328' }}>Booth主標題 (Stripe Title)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="請輸入主標題"
              style={{ width: '100%', padding: '12px 16px', fontSize: '16px', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>


          {/* 欄位 3：副標題 */}
          <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontWeight: 'bold', fontSize: '16px', color: '#6D4328' }}>Booth副標題 (Subtitle)</label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="請輸入副標題..."
              style={{ width: '100%', padding: '12px 16px', fontSize: '16px', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>


          {/* 欄位 4：相機濾鏡特效選擇 */}
          <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontWeight: 'bold', fontSize: '16px', color: '#6D4328' }}>相機濾鏡特效 (Photo Filter)</label>
            <select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', fontSize: '16px', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff', cursor: 'pointer' }}
            >
              <option value="none">原圖 (No Filter)</option>
              <option value="warm">暖調 (Warm)</option>
              <option value="cool">冷調 (Cool)</option>
              <option value="dramatic">戲劇感暗角 (Dramatic)</option>
              <option value="ccd">復古 CCD 相機 (CCD)</option>
              <option value="polaroid">黃調拍立得 (Polaroid)</option>
              <option value="dreamcore">虛幻夢核 (Dreamcore)</option>
              <option value="glitch">賽博故障風 (Glitch)</option>
              <option value="mono">復古黑白 (Mono)</option>
            </select>
          </div>


          {/* 欄位 5：底色選擇 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <label style={{ fontWeight: 'bold', fontSize: '16px', color: '#6D4328' }}>相紙底色 (Theme Color)</label>
           
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                { name: '經典白', value: '#ffffff' },
                { name: '復古黑', value: '#1a1a1a' },
                { name: '燕麥奶', value: '#f4ebd0' },
                { name: '櫻花粉', value: '#ffdeeb' },
                { name: '晴空藍', value: '#d4ecfc' },
                { name: '酪梨綠', value: '#e2ecc8' }
              ].map((color) => (
                <button
                  key={color.value}
                  onClick={() => setThemeColor(color.value)}
                  title={color.name}
                  type="button"
                  style={{
                    width: '36px',
                    height: '36px',
                    backgroundColor: color.value,
                    border: themeColor.toLowerCase() === color.value.toLowerCase() ? '3px solid #6D4328' : '1px solid #cbd5e1',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    boxShadow: themeColor.toLowerCase() === color.value.toLowerCase() ? '0 0 8px rgba(109,67,40,0.4)' : 'none',
                    transition: 'all 0.2s ease',
                    transform: themeColor.toLowerCase() === color.value.toLowerCase() ? 'scale(1.1)' : 'scale(1)',
                  }}
                />
              ))}


              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: '#64748b', fontFamily: 'monospace' }}>
                  {themeColor.toUpperCase()}
                </span>
                <div style={{ position: 'relative', width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', border: '1px solid #cbd5e1', cursor: 'pointer' }}>
                  <input
                    type="color"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    style={{
                      position: 'absolute',
                      top: '-6px',
                      left: '-6px',
                      width: '48px',
                      height: '48px',
                      padding: 0,
                      border: 'none',
                      cursor: 'pointer',
                      background: 'none'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>


        </div>
      </div>


      {/* ================= 右側：人生四格相片條即時預覽 ================= */}
      <div style={{ width: '440px', minWidth: '300px' }}>
        <div
          ref={stripRef}
          className="photo-strip-preview"
          style={{
            width: '100%',
            background: themeColor,
            border: '1px solid #ccc',
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
            padding: '24px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxSizing: 'border-box'
          }}
        >
          {Array.from({ length: stripType }).map((_, index) => (
            <div key={index} style={{
              width: '100%',
              height: '300px',
              background: '#e9ecef',
              border: '1px solid #dee2e6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}
          >
            {photos[index] ? (
              <img src={photos[index]} alt={`shot-${index}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ color: '#adb5bd', fontSize: '16px' }}>第 {index + 1} 格照片</span>
            )}
          </div>
          ))}


          {/* 相片條底部文字資訊 */}
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <div style={{ fontWeight: 'bold', fontSize: '22px', letterSpacing: '2px', color: textColor }}>{title}</div>
            <div style={{ fontSize: '15px', marginTop: '6px', color: subTextColor }}>{subtitle}</div>
            <div style={{ fontSize: '12px', marginTop: '10px', color: dateTextColor }}>{new Date().toLocaleDateString()}</div>
          </div>
        </div>


        {/* 下載 / 儲存按鈕 */}
        <button
          onClick={handleDownloadStrip}
          style={{
            marginTop: '25px',
            width: '100%',
            padding: '16px',
            background: '#6D4328',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '18px',
            boxShadow: '0 4px 10px rgba(109,67,40,0.3)'
          }}
        >
           下載完整Booth
        </button>

        <button
          onClick={handleSaveToStorage}
          style={{
            marginTop: '12px',
            width: '100%',
            padding: '16px',
            background: '#9A6B47',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '18px',
            boxShadow: '0 4px 10px rgba(109,67,40,0.22)'
          }}
        >
           存到 My Storage
        </button>
      </div>


    </div>
  );
};


const snapBtnStyle = {
  padding: '14px 40px', fontSize: '16px', fontWeight: 'bold',
  background: '#e74c3c', color: 'white', border: 'none', borderRadius: '30px',
  cursor: 'pointer', boxShadow: '0 4px 12px rgba(231,76,60,0.4)'
};


export default CameraBooth;
