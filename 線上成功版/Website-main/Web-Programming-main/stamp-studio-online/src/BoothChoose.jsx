import React from "react";


function BoothChoose({ onSelectMode }) {
  return (
    <div style={{
      textAlign: "center",
      padding: "50px 30px",
      background: "rgba(255, 250, 244, 0.82)",
      border: "1px solid rgba(120, 80, 50, 0.15)",
      borderRadius: "28px",
      boxShadow: "0 18px 45px rgba(87, 56, 34, 0.13)",
      margin: "40px auto",
      maxWidth: "800px"
    }}>
      <h2 style={{ fontSize: "32px", color: "#6a3d24", marginBottom: "12px", letterSpacing: "1px", fontWeight: "bold" }}>
        ✨ Booth Choose✨
      </h2>
      <p style={{ color: "#8a674d", fontSize: "16px", marginBottom: "40px" }}>
        請選擇您想要獲取照片並放入機台展示的方式：
      </p>
     
      <div style={{ display: "flex", gap: "30px", justifyContent: "center", flexWrap: "wrap" }}>
       
        {/* 選項一：UploadBooth */}
        <div
          onClick={() => onSelectMode("upload")}
          style={{
            background: "#fffaf4",
            border: "2px solid #cfa984",
            borderRadius: "20px",
            padding: "40px 24px",
            width: "280px",
            cursor: "pointer",
            transition: "all 0.3s ease",
            boxShadow: "0 8px 20px rgba(70, 40, 20, 0.05)"
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = "translateY(-5px)";
            e.currentTarget.style.borderColor = "#6D4328";
            e.currentTarget.style.boxShadow = "0 12px 28px rgba(109,67,40,0.15)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.borderColor = "#cfa984";
            e.currentTarget.style.boxShadow = "0 8px 20px rgba(70, 40, 20, 0.05)";
          }}
        >
          <span style={{ fontSize: "50px", display: "block", marginBottom: "15px" }}>📁</span>
          <h3 style={{ margin: "10px 0", color: "#6a3d24", fontSize: "22px", fontWeight: "bold" }}>UploadBooth</h3>
          <p style={{ fontSize: "14px", color: "#8a674d", lineHeight: "1.5", margin: 0 }}>
            上傳本地相簿照片<br />進行 3D 質感Booth印製動畫
          </p>
        </div>
       
        {/* 選項二：CameraBooth */}
        <div
          onClick={() => onSelectMode("camera")}
          style={{
            background: "#fffaf4",
            border: "2px solid #cfa984",
            borderRadius: "20px",
            padding: "40px 24px",
            width: "280px",
            cursor: "pointer",
            transition: "all 0.3s ease",
            boxShadow: "0 8px 20px rgba(70, 40, 20, 0.05)"
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = "translateY(-5px)";
            e.currentTarget.style.borderColor = "#6D4328";
            e.currentTarget.style.boxShadow = "0 12px 28px rgba(109,67,40,0.15)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.borderColor = "#cfa984";
            e.currentTarget.style.boxShadow = "0 8px 20px rgba(70, 40, 20, 0.05)";
          }}
        >
          <span style={{ fontSize: "50px", display: "block", marginBottom: "15px" }}>📷</span>
          <h3 style={{ margin: "10px 0", color: "#6a3d24", fontSize: "22px", fontWeight: "bold" }}>CameraBooth</h3>
          <p style={{ fontSize: "14px", color: "#8a674d", lineHeight: "1.5", margin: 0 }}>
            開啟相機<br />拍攝與濾鏡調色
          </p>
        </div>
       
      </div>
    </div>
  );
}


export default BoothChoose;

