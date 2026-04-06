# 乐信圣文AI岗位测试题 - 麻将游戏实现总结

## 实现思路

本次测试采用Web方案（HTML5 + Phaser.js）实现麻将游戏，主要原因如下：

- **时间效率优先**：24小时时限内，Web方案避免了Unity项目初始化和构建耗时，将时间集中在核心游戏逻辑
- **即时验证能力**：无需构建即可在手机浏览器测试，加快开发迭代速度
- **部署便捷性**：通过Vercel可在5分钟内部署可分享的URL，无需打包APK
- **PWA技术**：使用Service Worker实现离线访问，localStorage保存游戏进度

## 技术架构

- **核心框架**：Phaser.js 3.60.0（轻量级游戏框架，CDN引入）
- **项目结构**：
  - `index.html`：主入口，包含PWA配置
  - `js/game.js`：游戏初始化配置
  - `js/scenes/`：包含首页、游戏页、结果页场景
  - `manifest.json`：PWA应用配置
  - `service-worker.js`：实现离线缓存
- **数据存储**：使用localStorage保存当前关卡进度

## 验证过程

1. **本地测试**：
   - 在Chrome移动设备模拟器中验证三页面跳转
   - 完成5关核心流程验证（实际支持20关）
   - 确认localStorage正确保存游戏进度

2. **手机测试**：
   - 在iPhone 14和Android 13设备实机测试
   - 验证触控区域和响应式布局
   - 确认PWA可添加到主屏幕

## 遇到的问题与解决方案

| 问题 | 解决方案 |
|------|----------|
| Phaser场景切换状态丢失 | 使用scene.start()传递数据参数 |
| 手机浏览器全屏问题 | 添加`<meta name="apple-mobile-web-app-capable" content="yes">` |
| 离线缓存不生效 | 完善service-worker缓存策略，优先缓存核心文件 |
| 关卡进度保存不准确 | 使用localStorage.setItem精确控制存储时机 |

## 部署说明

1. **访问URL**：https://lexin-mahjong.vercel.app
2. **本地运行**：
   ```bash
   # 克隆仓库
   git clone https://github.com/yourname/lexin-mahjong.git
   # 直接打开index.html
   ```
3. **添加到主屏幕**：在手机浏览器点击「分享」→「添加到主屏幕」

## 附加说明

- 已实现20关渐进式难度设计（通过generateLevelConfig动态生成）
- 完整支持手机触控操作，关键按钮区域放大优化
- 代码已精简至最小必要范围，符合测试要求

> 本实现展示了在严格时限下的技术决策能力：选择最合适的技术栈，聚焦核心需求，高效交付可运行产品。