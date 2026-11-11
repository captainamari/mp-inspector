# MP Inspector 示例

在仓库根目录运行 `npm ci` 和 `npm run demo:sync`，然后用微信开发者工具导入本目录。填写自己的 AppID 或使用工具支持的测试模式，不要提交真实 AppID 或 project.private.config.json。

示例默认启用本地采集并显示面板，不启用远程上报。首页提供日志、请求、错误、存储和生命周期按钮；详情页用于验证跨页面记录。

Network 按钮访问 https://httpbin.org 的演示接口，发送的都是示例数据。需要网络可达；真机测试需要相应合法域名配置，或替换为自己的接口。开发者工具中若临时开启“不校验合法域名…”选项，仅用于本地调试，不代表真机与发布环境具备相同条件。
HTTP 404/500 是已收到服务器响应，应继续进入平台 success 回调；断网、超时等才是传输失败。

错误按钮会故意产生运行时错误和未处理 Promise 拒绝。Storage 使用 inspector_demo_ 前缀；SDK 的 clearStorage() API 会清空该小程序所有本地存储，只在这个独立示例项目中测试。

验收压缩包时，在仓库根目录运行：

```sh
npm run build
npm run demo:sync -- full
# 或 npm run demo:sync -- lite
```

CI 提供的 demo ZIP 已包含同步后的 Full SDK，可直接导入。完整检查项目见 ../docs/testing.md。
