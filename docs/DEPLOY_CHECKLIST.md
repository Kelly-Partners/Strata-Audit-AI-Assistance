# 当前 App 距离 Deploy 还差什么

## 〇、Deploy 前还需做什么（速览）

| 序号 | 事项 | 说明 |
|------|------|------|
| 1 | Firebase Console 创建 Firestore | 已用 **(default)** 数据库；Console 中需已创建 Firestore，区域建议 australia-southeast1。 |
| 2 | Authentication 启用 Google 登录 | 详见 [docs/FIREBASE_AUTH_SETUP.md](FIREBASE_AUTH_SETUP.md)：Build → Authentication → 开始使用 → Sign-in method → 启用 **Google**，并确认授权域名。 |
| 3 | 本地填写 `.env` | 6 个 `VITE_FIREBASE_*` 从 Firebase 项目设置复制；部署前 `npm run build` 会用到。 |
| 4 | 首次部署 Functions 并授权 Secret | 本地执行 `npx firebase deploy --only functions`，按提示允许访问 **GEMINI_API_KEY**。 |
| 5 | Secret Manager 中创建 GEMINI_API_KEY | GCP Console → Secret Manager → 创建密钥，名称为 `GEMINI_API_KEY`，值为 Gemini API Key。 |
| 6 | 执行部署命令 | `npm run build` 后执行 `npx firebase deploy --only hosting,functions,firestore,storage`。 |
| 7 | （可选）CI 部署 | GitHub 配置 **FIREBASE_TOKEN** 及 6 个 **VITE_FIREBASE_*** Secrets，push 到 main 自动部署。 |

以上都做完即可完成首次部署。

---

## 一、已就绪项

| 项 | 状态 |
|----|------|
| 本地构建 | ✅ `npm run build` 通过，生成 `dist/` |
| firebase.json | ✅ hosting → `dist`，functions / firestore / storage 已配置 |
| .firebaserc | ✅ default 项目 `strata-audit-ai-reviewer` |
| Firestore 规则与索引 | ✅ `firestore.rules`、`firestore.indexes.json` 存在 |
| Storage 规则与 CORS | ✅ `storage.rules`、`storage.cors.json` 存在，CORS 已用 gsutil 设置 |
| Functions 代码与 Secret | ✅ `GEMINI_API_KEY` 已在 Secret Manager，`index.js` 已绑定 |
| 本地 .env | ✅ 6 个 `VITE_FIREBASE_*` 已填写（你本地已配置） |
| 前端 Auth + Cloud Function | ✅ 仅通过 Firebase 登录后执行审计（callExecuteFullReview）；侧栏提供 Google 登录 / 登出 |
| Cloud Function 区域 | ✅ `executeFullReview` 已配置 `region: "australia-southeast1"`，与前端默认 URL 一致 |
| CI 构建时 Firebase 配置 | ✅ workflow 中 Build 步骤已传入 6 个 `VITE_FIREBASE_*`（需在 GitHub Secrets 中配置） |

---

## 二、部署前必须确认（差什么）

### 1. Firestore 数据库是否已创建

- `firebase.json` 中已配置为 **默认数据库**：`"database": "(default)"`。
- 请确认 Firebase Console 中已创建 Firestore（默认库即可），区域建议 **australia-southeast1**。  
  若你使用第二数据库，可将 `firebase.json` 中 `"database"` 改为该数据库 ID（如 `"stratatax"`），并同步修改 `src/services/firebase.ts` 中的 `getFirestore(app, "数据库ID")`。

### 2. 首次部署 Functions 时的 Secret 授权

- 首次运行 `firebase deploy --only functions` 时，CLI 可能提示：允许 Firebase 访问 Secret `GEMINI_API_KEY`。
- **操作**：在本地执行一次 `firebase deploy --only functions`，按提示完成授权；之后 CI 或再次部署即可正常。

### 3. 本地部署前先构建

- Hosting 部署的是 **dist/**，需先构建再部署。
- **操作**：部署前在项目根目录执行：
  ```bash
  npm run build
  npx firebase deploy --only hosting,functions,firestore,storage
  ```
  或分步：`--only hosting`、`--only functions` 等。

---

## 三、若用 GitHub Actions 自动部署（CI/CD）

| 项 | 状态 | 说明 |
|----|------|------|
| FIREBASE_TOKEN | ⚠️ 需在 GitHub 配置 | 运行 `npx firebase login:ci`，将输出的 Token 存为仓库 Secret **FIREBASE_TOKEN**。 |
| 构建时的 Firebase 配置 | ⚠️ 必须 | App 仅支持登录后 Cloud Function。CI 部署 **Hosting** 时必须在 **Build** 步骤传入 6 个 `VITE_FIREBASE_*`（例如通过 GitHub Secrets），否则前端无法初始化 Firebase/Auth，登录不可用。 |

---

## 四、建议的首次部署顺序

1. **确认 Firestore**：Console 中已有数据库（当前为 default，与 `firebase.json` 一致）。
2. **本地构建**：`npm run build`。
3. **先部署 Functions（含 Secret 授权）**：  
   `npx firebase deploy --only functions`，按提示完成 GEMINI_API_KEY 授权。
4. **再全量部署**：  
   `npx firebase deploy --only hosting,firestore,storage`  
   或一次性：`npx firebase deploy --only hosting,functions,firestore,storage`。

完成以上后，当前 app 即可部署；若使用 CI，再按「三」配置 FIREBASE_TOKEN（及按需配置 VITE_FIREBASE_*）。
