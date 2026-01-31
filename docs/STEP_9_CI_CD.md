# 步骤 9 - CI/CD（可选）

若需 **GitHub Actions 自动部署** Firebase（Hosting、Functions、Firestore、Storage），按下列步骤配置一次即可。

---

## 1. 获取 Firebase CI Token

在本地已登录 Firebase（`firebase login`）的前提下，在**项目根目录**执行：

```bash
npx firebase login:ci
```

- 浏览器会打开，用你的 Google 账号完成授权。
- 终端会输出一长串 **Token**（仅显示一次），请复制保存。

---

## 2. 将 Token 存入 GitHub 仓库 Secret

1. 打开你的 GitHub 仓库 → **Settings** → **Secrets and variables** → **Actions**。
2. 点击 **New repository secret**。
3. **Name** 填：`FIREBASE_TOKEN`（必须与此一致，与工作流中 `secrets.FIREBASE_TOKEN` 对应）。
4. **Secret** 粘贴上一步得到的 Token。
5. 保存。

---

## 3. 工作流行为

- **触发**：推送到 `main` 分支时自动运行；也可在 **Actions** 页手动运行 **Firebase Deploy**。
- **步骤**：安装依赖 → 构建前端（`npm run build`）→ 安装 Firebase CLI 与 Functions 依赖 → 执行：
  ```bash
  npx firebase deploy --only hosting,functions,firestore,storage --non-interactive --token "${{ secrets.FIREBASE_TOKEN }}"
  ```
- **部署范围**：Hosting（`dist`）、Functions、Firestore 规则与索引、Storage 规则。  
  **不包含**：Storage CORS（需按步骤 8 在本地用 `gsutil cors set` 设置一次）。

---

## 4. 若部署失败

- **Token 无效**：重新执行 `npx firebase login:ci`，用新 Token 更新仓库 Secret `FIREBASE_TOKEN`。
- **Functions 需要 Secret**：首次部署若提示授权 Secret（如 `GEMINI_API_KEY`），需在本地执行一次 `firebase deploy --only functions` 并按提示完成授权；之后 CI 即可正常部署。
- **Lint 失败**：工作流会先执行 `functions` 的 predeploy（lint），若报错请本地运行 `cd functions && npm run lint` 并修复。

---

**说明**：步骤 9 为可选；不配置 GitHub Actions 时，可继续在本地执行 `npx firebase deploy` 进行部署。
