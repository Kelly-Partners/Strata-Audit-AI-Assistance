<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1i1M_T8YmxLQMQireq7uUWrkd_yUC_9Nv

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Gemini API Key with Secret Manager (Cloud Functions)

若通过 Cloud Function `executeFullReview` 调用 Gemini，建议将 API Key 存入 **Secret Manager**，不在前端或请求体中传递。

### 1. 创建 Secret（首次或更新）

在项目根目录执行（需已登录 `firebase login` 并选中对应项目）：

```bash
firebase functions:secrets:set GEMINI_API_KEY
```

按提示输入你的 Gemini API Key（可从 [Google AI Studio](https://aistudio.google.com/apikey) 获取），回车确认。

### 2. 部署 Function

创建或更新 Secret 后，需重新部署使用该 Secret 的 Function 才会生效：

```bash
cd functions
npm run deploy
# 或：firebase deploy --only functions
```

### 3. 行为说明

- **Cloud Function**：优先使用 Secret Manager 中的 `GEMINI_API_KEY`；若未配置，则使用请求体中的 `apiKey`（便于本地或覆盖）。
- **前端**：调用 `callExecuteFullReview` 时 `apiKey` 可选；若后端已配置 Secret，可不传 `apiKey`。

### 4. 本地模拟器

使用 Functions 模拟器时，可用 `.secret.local` 覆盖 Secret 值（见 [Firebase 文档](https://firebase.google.com/docs/functions/config-env#secret-manager)），或继续在请求体中传 `apiKey`。

## CI/CD（可选）- 步骤 9

若需 **GitHub Actions 自动部署** Firebase（Hosting、Functions、Firestore、Storage）：

1. **获取 Token**：在项目根目录执行 `npx firebase login:ci`，复制输出的 Token。
2. **存入 GitHub Secret**：仓库 **Settings → Secrets and variables → Actions** → 新建 Secret，名称为 **`FIREBASE_TOKEN`**，值为上一步的 Token。
3. 推送代码到 `main` 分支或手动触发 **Firebase Deploy** 工作流即可自动部署。

详细说明见 [docs/STEP_9_CI_CD.md](docs/STEP_9_CI_CD.md)。
