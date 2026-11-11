# 验证与发布

## 自动化

```sh
npm ci
npm run package
```

执行 Full/Lite 构建、源码与产物行为测试、路径与版本检查、demo 同步，并生成两份 tar.gz 安装包与 SHA256 校验值。
Node 测试使用独立 VM 和模拟 wx/App/Page/Component；不会连接真实业务接口，也不代表微信宿主已经验收。

覆盖范围：初始化幂等、show/hide、销毁与重建、请求参数不被改写、任务对象与回调上下文、过期请求隔离、容量配置、循环日志、错误回调、组件订阅、Storage、远程队列过滤/失败重试/旧回调隔离，以及 Lite 无远程副作用。

CI 在 Node.js 22/24 执行，成功后上传安装包和已同步 SDK 的 demo ZIP。下载成功运行的 mp-inspector-packages artifact，解压后可取得两份 tgz、SHA256SUMS 和示例 ZIP。

## 微信开发者工具与真机

本仓库不将模拟测试结果记为真机通过。发布前分别用 Full 和 Lite 执行下表，并记录工具版本、基础库、微信版本、系统和设备：

| 场景 | 预期 |
| --- | --- |
| 导入 demo，展开入口，拖动按钮 | 按钮与面板可用，滚动和遮罩无异常 |
| 输出各级日志、复杂对象，筛选和复制 | 内容完整、展开正常，长列表仍可操作 |
| GET/POST、HTTP 404/500、断网或超时 | 状态、报文与耗时可查看，业务 success/fail/complete 正常 |
| 触发运行时错误与 Promise 拒绝 | Console 有错误，业务错误处理器继续运行 |
| 写入、查看、复制、删除 demo 存储 | 列表与实际存储一致 |
| 首页与详情页往返 | 记录跨页面保留，未重复安装拦截器 |
| hide/show、destroy 后重新 init/show | 隐藏期间继续采集，销毁后停止，重新启用可用 |
| Full 接入自己控制的接收接口 | 过滤、批量、失败重试正常，无上报自循环 |
| Lite 传入远程配置 | supported=false，无远程请求 |

测试外网请求需要可访问的接口与相应合法域名配置。demo 默认使用 httpbin 的演示接口，公共服务不可用时可改为自己的兼容接口；HTTP 404/500 与传输失败需要分别测试。

## 发布步骤

1. 更新 package.json 和 src/core/version.js，更新 CHANGELOG；若文档中写了版本示例，同步修改。
2. 运行 npm run package，检查 SDK 字节数与安装包内容。
3. 完成上表开发者工具和 iOS/Android 实测，在发布说明记录验证范围。
4. 在 GitHub 创建与该提交对应的版本标签和 Release，上传 CI 生成的 tgz、示例 ZIP 和校验文件。
5. 用下载的安装包走一遍 README 接入步骤，再通知使用团队升级。

本仓库不自动发布 npm，也不在普通 push 时创建 Release。
