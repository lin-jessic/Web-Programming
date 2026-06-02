Stamp Studio 操作步驟說明
一、專題目前可以做什麼

這個網頁是 Stamp Studio 創作社群平台，目前功能包含：

1. 註冊 / 登入
2. 製作 3D 明信片
3. 製作人生三格 / 四格拍貼照
4. 儲存作品到 My Storage
5. 下載作品到本機
6. 分享作品到 Community Wall
7. 在照片牆作品按讚
8. 在照片牆作品下留言
9. 使用 Live Comment Board 留言

目前版本是 localStorage 前端展示版，資料會存在每個人自己的瀏覽器裡。

二、第一次使用前要安裝的東西

請先確認電腦有安裝：

1. VS Code
2. Node.js
3. npm
4. Chrome 或 Edge 瀏覽器

可以在 VS Code Terminal 輸入：

node -v
npm -v

如果都有顯示版本號，代表安裝成功。

三、打開專案資料夾

把整個專案資料夾放到桌面，例如：

Desktop/stamp-studio

接著用 VS Code 打開：

File → Open Folder → Desktop → stamp-studio → Select Folder

或是在 Terminal 輸入：

cd "%USERPROFILE%\Desktop\stamp-studio"
code .
四、安裝套件

第一次拿到專案時，在 VS Code Terminal 輸入：

npm install

如果還沒安裝 html2canvas，也輸入：

npm install html2canvas
五、啟動網頁

在 Terminal 輸入：

npm run dev

看到類似下面的畫面就成功：

Local: http://localhost:5173/

接著用瀏覽器打開：

http://localhost:5173/
六、登入 / 註冊操作

第一次使用請選擇：

Register

輸入：

Gmail：example@gmail.com
Nickname：自己的暱稱
Profile Bio：個人簡介
Avatar：選一個頭像

按：

Create Account

之後再使用時，可以切到：

Login

輸入同一個 Gmail，再按：

Login with Gmail

注意：這是前端模擬登入，不是真正 Google OAuth 登入。

七、Postcard Studio：製作 3D 明信片

進入：

Postcard Studio

可以操作：

Front Receiver：正面收件人
Front Message：正面文字
Back Message：背面訊息
Back Address：背面地址
Font Size：字體大小
Color：字體顏色
Font Style：字體樣式
Theme：明信片背景
Stamp Text：印章文字

右邊明信片可以用滑鼠拖曳旋轉。

上方按鈕：

Front：切回正面
Back：切到背面
Reset View：重設角度

點右上角的 3D 印章，可以蓋在目前面向你的那一面。

完成後可以按：

Save to My Storage

作品會存到自己的儲存區。

也可以按：

Download to Local

直接下載成圖片。

八、Photo Booth Studio：製作三格 / 四格照

進入：

Photo Booth Studio

可以選：

3-Cut：人生三格
4-Cut：人生四格

可以修改：

Strip Title：照片條標題
Subtitle：副標題
Date Text：日期文字
Theme：拍貼樣式

接著在：

Upload Photos

依序上傳自己的照片。

完成後可以按：

Print Photo Strip

會看到印出動畫。

也可以按：

Print Preview

顯示輸出結果預覽。

若要儲存作品，按：

Save to My Storage

若要下載圖片，按：

Download to Local
九、My Storage：查看自己的作品

進入：

My Storage

這裡會顯示自己的個人資料：

頭像
暱稱
個人簡介
Gmail

下面會顯示自己儲存的作品。

可以切換：

All
Postcards
Photo Booth

每一類最多儲存：

Postcards：30 個
Photo Booths：30 個

每個作品下面有三個按鈕：

Download：下載作品
Share to Wall：分享到照片牆
Delete：刪除作品
十、Community Wall：照片牆與社群互動

進入：

Community Wall

這裡像小紅書 / Pinterest 照片牆。

可以從：

Choose a work from My Storage

選擇自己已儲存的作品。

也可以直接：

Upload Image

上傳其他圖片。

輸入 caption 後按：

Post to Wall

作品就會出現在照片牆上。

照片牆作品可以：

按 Like
在作品下方留言
查看其他作品留言
十一、Live Comment Board：公開留言區

在 Community Wall 頁面下方有：

Live Comment Board

可以輸入留言，再按：

Send Message

留言區最多保留最新：

50 則留言
十二、資料儲存限制說明

目前這個版本使用：

localStorage

所以資料是存在每個人自己的瀏覽器裡。

意思是：

同學 A 的帳號存在 A 的電腦
同學 B 的帳號存在 B 的電腦
A 分享的作品不會真的同步到 B 的電腦
B 留言也不會同步到 A 的電腦

這版適合 Demo 和單機操作。

如果要變成真正多人共同使用，需要再接：

Firebase
Supabase
MongoDB
Node.js 後端
十三、常見問題
1. 網頁打不開怎麼辦？

確認 Terminal 有跑：

npm run dev

然後打開：

http://localhost:5173/
2. localhost 是什麼？
localhost

代表自己的電腦。

所以：

http://localhost:5173/

只能在自己電腦上開。

3. 其他同學可以用嗎？

可以，但每個同學都要在自己電腦上打開專案並執行：

npm install
npm run dev

如果要讓大家用同一個網址，就要部署到 GitHub Pages、Vercel 或 Netlify。

4. 儲存的作品不見了？

如果清除瀏覽器資料、換瀏覽器、換電腦，localStorage 資料就可能不見。

5. 想重新開始怎麼辦？

可以在網頁內按：

Clear
Clear Wall
Clear Comments
Delete

或直接清除瀏覽器 localStorage。

十四、關閉專案

要停止網站時，回到 VS Code Terminal，按：

Ctrl + C

如果出現：

Terminate batch job (Y/N)?

輸入：

Y

再按 Enter。