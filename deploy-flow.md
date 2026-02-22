# 本地 → 服务器 标准部署流程

**后端目录：** `/www/miaoji/server`  
**端口：** 3100  
**pm2 进程：** miaoji-server  
**域名：** https://moji.yanxiangtaoci.cn

---

## 第一部分：服务器核验（SSH 后执行）

把以下整段复制到服务器终端执行，然后把输出复制回来：

```bash
cd /www/miaoji/server
git remote -v
git branch --show-current
git log -1 --oneline
```

---

## 第二部分：本地 git remote 绑定与 push

**待填：** 将第一部分中 `git remote -v` 显示的 `origin` URL 填入下面 `<REMOTE_URL>`，将 `git branch --show-current` 显示的分支名填入 `<BRANCH>`。

```bash
cd C:\Users\57375\Desktop\miaoji-local\miaoji-server
git remote add origin <REMOTE_URL>
git push -u origin <BRANCH>
```

若已有 `origin`，可改为：

```bash
cd C:\Users\57375\Desktop\miaoji-local\miaoji-server
git remote set-url origin <REMOTE_URL>
git push -u origin <BRANCH>
```

---

## 第三部分：服务器部署命令

SSH 登录服务器后执行：

```bash
cd /www/miaoji/server
git pull
npm ci
npm run build
pm2 reload miaoji-server
```

---

## 第四部分：接口验收

```bash
curl -i -X POST "https://moji.yanxiangtaoci.cn/orders/test/after-sale/decision"
```

**预期：** 返回 `401` 或 `400`，不能是 `404`。
