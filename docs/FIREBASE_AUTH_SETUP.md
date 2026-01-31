# 开启 Firebase Authentication 功能

在 Firebase Console 中启用 Authentication 并配置登录方式后，本应用会要求用户登录后才能使用。

## 一、在 Firebase Console 中启用 Authentication

1. 打开 [Firebase Console](https://console.firebase.google.com/) → 选择项目 **strata-audit-ai-reviewer**。
2. 左侧菜单进入 **Build → Authentication**。
3. 若未启用，点击 **「开始使用」** 启用 Authentication。

## 二、启用登录方式（本应用支持 Email/Password + Google）

1. 在 Authentication 页面，打开 **「Sign-in method」** 标签。
2. **Email/Password**：点击 **Email/Password** → 将 **Enable** 打开 → 保存（用于邮箱注册与登录）。
3. **Google**：点击 **Google** → 将 **Enable** 打开 → 设置 **Project support email** → 保存。
4. 登录页提供「Sign In / Create Account」与「Sign in with Google」，需至少启用其一。

## 三、授权域名（重要）

1. 仍在 Authentication → **Sign-in method** 页面。
2. 在 **Authorized domains** 中确认包含：
   - `localhost`（本地开发）
   - `strata-audit-ai-reviewer.web.app`
   - `strata-audit-ai-reviewer.firebaseapp.com`
3. 若使用自定义域名，需在此添加该域名。

完成以上步骤后，应用内的「使用 Google 登录」即可正常弹出并完成登录。
