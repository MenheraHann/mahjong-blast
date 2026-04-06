# 乐信圣文麻将游戏 - Claude Memory

## 项目信息
- **项目名称**：乐信圣文麻将游戏（Vita Mahjong风格）
- **技术栈**：HTML5 + Phaser.js 3.60 + localStorage
- **部署**：Vercel
- **测试题来源**：`乐信圣文｜AI 方向岗位测试题 .pdf`

## 工作纪律

### CHANGELOG 同步规则（强制）
- **每次用户提出新需求或功能调整后，必须立即同步更新 `CHANGELOG.md`**
- 记录内容包括：**用户原始需求文字**、修改的文件、实现方式、问题与解决方案
- 用户原话用引用格式 `> ` 记录，确保需求原文不丢失
- 不要等用户提醒，主动同步

### 文件结构
```
index.html                  # 主入口
manifest.json               # PWA配置
service-worker.js           # 离线缓存
vercel.json                 # Vercel部署配置
js/game.js                  # 游戏初始化配置
js/scenes/home.js           # 首页场景
js/scenes/game.js           # 游戏主场景
js/scenes/results.js        # 结果页场景
CHANGELOG.md                # 开发迭代记录（必须同步）
README.md                   # 项目说明
```

## 当前功能状态
- ✅ 三页面跳转（首页→游戏→结果）
- ✅ 20关支持，难度渐进
- ✅ 顶部信息栏（返回按钮、关卡、分数、匹配数、菜单）
- ✅ 返回按钮二次确认弹窗
- ✅ 菜单弹窗（重新开始 / 返回主菜单）
- ✅ localStorage保存关卡进度
- ✅ 配对成功+200分，匹配数动态递减

## 待办
- [ ] 优化麻将牌面UI
- [ ] 部署到Vercel