# 步骤 8 - Firebase / Google Cloud Console 操作清单

请在 **Firebase Console** 与 **Google Cloud Console** 中按下列顺序逐条完成。  
本项目当前 Firebase 项目 ID：**`strata-audit-ai-reviewer`**。

---

## 一、Firebase Console

### 1. 创建项目（若未创建）

- [ ] 打开 [Firebase Console](https://console.firebase.google.com/)
- [ ] 若无项目，点击「添加项目」→ 输入项目名称 → 按向导完成
- [ ] 若已有项目 `strata-audit-ai-reviewer`，确认当前使用的正是该项目

### 2. 注册 Web 应用并填入 .env

- [ ] 在项目概览页点击「</>」或「添加应用」→ 选择 **Web**
- [ ] 注册应用（可填写昵称），记下生成的 **Firebase 配置对象**
- [ ] 将以下 6 个值填入本项目根目录的 **`.env`** 或 **`.env.local`**（等号后直接填值，勿加引号）：

  | 变量名 | 说明 |
  |--------|------|
  | `VITE_FIREBASE_API_KEY` | apiKey |
  | `VITE_FIREBASE_AUTH_DOMAIN` | authDomain（如 xxx.firebaseapp.com） |
  | `VITE_FIREBASE_PROJECT_ID` | projectId（应为 strata-audit-ai-reviewer） |
  | `VITE_FIREBASE_STORAGE_BUCKET` | storageBucket（如 xxx.firebasestorage.app） |
  | `VITE_FIREBASE_MESSAGING_SENDER_ID` | messagingSenderId（数字） |
  | `VITE_FIREBASE_APP_ID` | appId（如 1:xxx:web:xxx） |

- [ ] 保存 `.env` 后不要提交到 Git

### 3. Authentication：启用登录方式

- [ ] 左侧菜单 **Build → Authentication** → 若未启用则点击「开始使用」
- [ ] 在「登录方式」标签页中启用：
  - [ ] **电子邮件/密码**（如需邮箱登录）
  - [ ] **Google**（如需 Google 登录）
- [ ] 按需在「设置」中配置授权域名（本地开发可包含 `localhost`）

### 4. Firestore：创建数据库

- [ ] 左侧菜单 **Build → Firestore Database** → 若未创建则点击「创建数据库」
- [ ] **区域**选择：**australia-southeast1**（与 `firebase.json` 一致）
- [ ] 当前项目使用 **默认数据库**（`firebase.json` 中 `database: "(default)"`）；若需第二数据库，可在 Console 创建时命名并在 `firebase.json` 中改为该 ID
- [ ] 创建完成后，在本项目根目录执行：

  ```bash
  npx firebase deploy --only firestore
  ```

  用于部署 `firestore.rules` 与 `firestore.indexes.json`。

### 5. Storage：启用并部署规则与 CORS

- [ ] 左侧菜单 **Build → Storage** → 若未启用则点击「开始使用」
- [ ] **区域**选择：**australia-southeast1**
- [ ] 在本项目根目录执行，部署 Storage 规则：

  ```bash
  npx firebase deploy --only storage
  ```

- [ ] 然后设置 CORS（将 bucket 改为你的实际桶名；本项目的默认桶为 `strata-audit-ai-reviewer.firebasestorage.app`）：

  ```bash
  gsutil cors set storage.cors.json gs://strata-audit-ai-reviewer.firebasestorage.app
  ```

  若桶名不同，可在 [Cloud Console → Storage](https://console.cloud.google.com/storage/browser?project=strata-audit-ai-reviewer) 中查看桶名后替换。

---

## 二、Google Cloud Console

### 6. 启用 Secret Manager API

- [ ] 打开 [Google Cloud Console](https://console.cloud.google.com/)
- [ ] 顶部项目选择器确认项目为 **strata-audit-ai-reviewer**
- [ ] 搜索「Secret Manager」或进入 **API 和服务 → 库**
- [ ] 找到 **Secret Manager API** → 点击「启用」

### 7. 创建密钥 GEMINI_API_KEY

- [ ] 进入 **Security → Secret Manager**（或直接 [Secret Manager](https://console.cloud.google.com/security/secret-manager?project=strata-audit-ai-reviewer)）
- [ ] 点击「创建密钥」
  - **名称**：`GEMINI_API_KEY`（必须与此一致，与 `functions/index.js` 中 `defineSecret("GEMINI_API_KEY")` 对应）
  - **密钥值**：粘贴你的 **Gemini API Key**（可从 [Google AI Studio](https://aistudio.google.com/apikey) 获取）
- [ ] 创建完成后，若需更新密钥值：在 Secret Manager 中点击该密钥 →「新版本」→ 填入新值

**或使用 Firebase CLI（推荐，与部署流程一致）：**

```bash
firebase functions:secrets:set GEMINI_API_KEY
```

按提示输入 Gemini API Key 并回车。

### 8. 部署 Cloud Functions

- [ ] 在本项目根目录执行：

  ```bash
  npx firebase deploy --only functions
  ```

- [ ] 区域已在 `functions/index.js` 中通过 Firebase 默认配置使用 **australia-southeast1**（与项目/Function 部署区域一致）
- [ ] **首次部署**若提示授权 Secret 访问（如「Allow Firebase to access the secret GEMINI_API_KEY」），按提示完成授权
- [ ] 部署成功后，记下输出的 `executeFullReview` 的 URL（用于前端 `VITE_FUNCTION_URL` 或验证）

---

## 三、完成后自检

- [ ] `.env` 中 6 个 `VITE_FIREBASE_*` 已填写且与 Firebase 项目设置一致
- [ ] Authentication 至少启用一种登录方式
- [ ] Firestore 已创建（区域 australia-southeast1；当前为默认库），且已执行 `npx firebase deploy --only firestore`
- [ ] Storage 已启用（区域 australia-southeast1），已执行 `npx firebase deploy --only storage` 和 `gsutil cors set ...`
- [ ] Secret Manager API 已启用，密钥 `GEMINI_API_KEY` 已创建并填入 Gemini API Key
- [ ] 已执行 `npx firebase deploy --only functions`，且首次部署时已完成 Secret 访问授权

---

**说明**：文中 `strata-audit-ai-reviewer`、`australia-southeast1` 及 Firestore 默认库均与当前项目 `firebase.json` 与 `.firebaserc` 一致；若你改用其他项目 ID 或第二数据库名，请将清单中对应处改为实际值。
