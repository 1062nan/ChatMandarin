# ChatMandarin 东京 EC2 自动回退实施方案

更新日期：2026-07-19

状态：方案设计完成；本轮仅进行了只读检查，东京服务器未安装软件、未上传文件、未修改配置、未重启服务。

## 1. 目标

当前主链路：

```text
Vercel ChatMandarin -> Cloudflare Voice Worker（东京放置提示）-> 火山引擎
```

目标链路：

```text
                         +-> Cloudflare Voice Worker -> 火山引擎
Vercel ChatMandarin -----|
                         +-> 东京 EC2 Voice Gateway -> 火山引擎
                              （主链路失败时自动回退）
```

回退目标：

- Cloudflare Voice Worker 连接失败、超时或返回非 2xx 时，应用自动请求东京 EC2。
- 东京 EC2 使用与 Cloudflare Worker 相同的 `/v1/asr`、`/v1/tts` 和 HMAC 签名协议。
- 用户音频只在内存中处理，不落盘，不记录正文和音频内容。
- 回退切换不依赖人工修改 DNS。
- 不影响现有 copyright-agent、warehouse、数据库和代理服务。

## 2. 已验证的连接方式

来源：`D:\Wordspace\AI\copyright-agent\.claude\skills\deploy\SKILL.md` 和 `scripts/deploy_quick_jp.sh`。

```text
SSH 用户：ubuntu
公网 IP：54.238.5.129
密钥：C:\Users\wangy\.ssh\ja-wms-aws-restricted.pem
copyright-agent 目录：/home/ubuntu/rz
```

Windows 本机需要使用 Git for Windows 自带的 SSH；当前 PowerShell 没有系统 `ssh`。

只读连接示例：

```powershell
& 'D:\Program Files\Git\bin\bash.exe' -lc `
  "ssh -i /c/Users/wangy/.ssh/ja-wms-aws-restricted.pem ubuntu@54.238.5.129 'hostname; uptime'"
```

正式操作时不要使用项目根目录下权限较宽的 `ja-wms-aws.pem`。

## 3. 2026-07-19 服务器只读审计结果

### 系统资源

| 项目 | 结果 | 评估 |
| --- | --- | --- |
| 系统 | Ubuntu 24.04.2 LTS | 可运行 Node 20/22 和 Docker |
| 内核 | AWS 6.14 | 正常 |
| CPU | 4 vCPU，Intel Xeon E5-2686 v4 | 语音网关余量足够 |
| 内存 | 15.6 GiB，总可用约 7.8 GiB | 余量足够 |
| Swap | 0 | 建议监控，但不是上线阻塞项 |
| 系统盘 | 193 GiB，已用 160 GiB，83% | 上线前建议先把使用率降到 75% 以下 |
| 运行时间 | 179 天 | 稳定，但应确认系统补丁窗口 |
| Docker | 28.0.4 / Compose 2.34.0 | 满足要求 |

Docker 有约 38.12 GiB 未使用镜像可回收。不能直接执行 `docker system prune`；必须先列出镜像用途并确认 copyright-agent 的回滚镜像。

### 已有业务

| Compose/服务 | 状态 |
| --- | --- |
| `rz` | 4 个容器运行中，copyright-agent |
| `wms` | 3 个容器运行中 |
| `registry` | 私有 Registry 运行中 |
| `wms-nginx-1` | 占用宿主机 80/443，restart=always |

`wms-nginx-1` 的配置目录为宿主机 `/opt/nginx/conf.d`，在容器内只读挂载到 `/etc/nginx/conf.d`。现有配置主要反代 warehouse，不能直接覆盖。

### 日本到上游网络

对 `https://openspeech.bytedance.com/` 连续 5 次只读 HTTPS 探测：

| 指标 | 结果 |
| --- | --- |
| TCP connect | 首次约 75 ms，复用后约 3–4 ms |
| TLS | 约 29–103 ms |
| total | 约 189–257 ms |

访问当前 Cloudflare Voice Worker `/health`：约 72 ms，HTTP 200。

这说明东京 EC2 到火山引擎的网络具备备用价值。真实 ASR/TTS 延迟仍需部署后用相同 120 秒脚本验证。

## 4. 高优先级安全问题

从当前外网测试，以下端口都能建立 TCP 连接：

```text
22, 80, 443, 3000, 5000, 5432, 6380, 8000,
9909, 13000, 13306, 16739, 17890
```

其中包括 PostgreSQL、Redis、MySQL、Docker Registry 和后端端口。新增 ChatMandarin 服务前，应先审查 AWS Security Group 和宿主机防火墙：

- 22：仅允许固定管理 IP 或 VPN。
- 80/443：允许公网。
- 5432、6380、13306、16739：只允许 VPC/容器网络或指定管理网段。
- 5000、8000、3000、9909 等业务端口：由 Nginx 统一代理后关闭公网入口，或限制到必要来源。
- 不能在未确认现有业务调用来源前直接删除规则。

本轮没有修改任何安全组、防火墙或监听端口。

## 5. 架构选型

### 方案 A：现有 EC2 + 独立网关容器 + 现有 Nginx（推荐）

```text
voice-jp.chatmandarin.cc:443
        -> wms-nginx-1
        -> 127.0.0.1:18787
        -> chatmandarin_voice_gateway container
        -> openspeech.bytedance.com
```

优点：

- 不增加 EC2 和负载均衡器固定费用。
- 复用现有 80/443 和公网 IP。
- DNS-only 时不依赖 Cloudflare 代理链路，具有真正的独立回退价值。
- 应用现有代码已经支持第二 URL 顺序回退。

缺点：

- 需要谨慎修改现有 `/opt/nginx/conf.d`。
- Nginx 与 warehouse 共用，变更前必须备份、`nginx -t`，只 reload 不 restart。
- 需要为 Nginx 增加证书目录只读挂载；当前只挂载了 conf.d 和 html。

成本：接近 0 增量成本。

### 方案 B：AWS ALB + ACM + EC2 网关

优点：

- 与现有 Nginx、warehouse 完全解耦。
- ACM 自动管理 TLS。
- Target Group 原生健康检查和故障摘除。

缺点：

- 有持续的 ALB/LCU 成本。
- 需要调整 EC2 Security Group，只允许 ALB 访问网关端口。

适合：对隔离性和可用性要求高于成本时。

### 方案 C：Cloudflare Load Balancer

优点：

- 原生健康检查、池优先级和自动故障转移。
- Vercel 只需要调用一个域名。

缺点：

- 付费功能。
- 流量仍经过 Cloudflare；不能覆盖 Cloudflare 账号、网络或配置层面的整体故障。

适合：只解决单个 Worker/火山链路故障，不要求脱离 Cloudflare。

### 不推荐：Cloudflare Tunnel 作为备用入口

Tunnel 很安全，但备用路径仍依赖 Cloudflare 网络，不符合“Cloudflare 主路径失败时保持独立”的目标。

## 6. 推荐实现细节

### 6.1 新建独立 Node 网关

本地新增：

```text
services/tokyo-voice-gateway/
  src/server.ts
  src/auth.ts
  src/volcengine-asr.ts
  src/volcengine-tts.ts
  Dockerfile
  docker-compose.yml
```

接口必须与现有 Worker 完全一致：

```text
GET  /health
POST /v1/asr  Content-Type: audio/wav;rate=16000
POST /v1/tts  Content-Type: application/json
```

认证请求头：

```text
x-voice-timestamp
x-voice-nonce
x-voice-signature
```

签名内容：

```text
timestamp.nonce.METHOD.path.sha256(body)
```

必须实现：

- HMAC-SHA256，并使用恒定时间校验。
- 时间戳允许误差最多 60 秒。
- nonce 在内存 TTL 缓存中保存 90 秒，拒绝重放。
- 请求体最大 5 MiB。
- TTS 文本最大 1000 字符。
- ASR 上游超时 30 秒。
- 日志只记录 route、status、duration、request ID，不记录正文、音频、签名或 Key。
- Node 进程收到 SIGTERM 后停止接收新请求并优雅退出。

### 6.2 容器约束

- 容器名：`chatmandarin_voice_gateway`。
- 非 root 用户运行。
- `restart: unless-stopped`。
- `read_only: true`。
- `/tmp` 使用 tmpfs。
- `cap_drop: [ALL]`。
- 宿主机只绑定 `127.0.0.1:18787`，不能绑定 `0.0.0.0`。
- 添加 Docker healthcheck：`GET /health`。
- 独立目录 `/home/ubuntu/chatmandarin-voice`，不放进 `/home/ubuntu/rz` 或 `/home/ubuntu/wms`。

### 6.3 域名与 TLS

推荐域名：

```text
voice-jp.chatmandarin.cc
```

要保证备用路径独立，应使用 Cloudflare DNS-only 记录指向 `54.238.5.129`。若启用橙云代理，Cloudflare 整体异常时备用路径也可能受影响。

低成本证书方案：Let's Encrypt。Nginx 新增单独 server block，不修改 warehouse 的 location：

```nginx
server {
    listen 443 ssl http2;
    server_name voice-jp.chatmandarin.cc;

    client_max_body_size 5m;
    proxy_request_buffering off;

    location = /health {
        proxy_pass http://host.docker.internal:18787;
    }

    location /v1/ {
        proxy_pass http://host.docker.internal:18787;
        proxy_connect_timeout 3s;
        proxy_read_timeout 35s;
        proxy_send_timeout 35s;
    }
}
```

实际配置还需要证书路径、转发头和限速规则。变更流程必须是：备份配置 -> 写入新文件 -> `nginx -t` -> reload -> HTTPS 检查；不能直接重启现有 Nginx。

## 7. 密钥和零停机轮换

当前 Cloudflare/Vercel 的 `VOICE_GATEWAY_SECRET` 不可读取明文。首次启用 EC2 时应进行一次轮换。

推荐把协议升级为双密钥窗口：

```text
VOICE_GATEWAY_SECRET_CURRENT
VOICE_GATEWAY_SECRET_PREVIOUS
```

步骤：

1. 生成 `S_NEW`，只保存在部署进程内存。
2. EC2 网关先接受 `S_NEW` 和旧密钥。
3. Cloudflare Worker 同时接受 `S_NEW` 和旧密钥。
4. Vercel 应用改用 `S_NEW` 签名并重新部署。
5. 120 秒验证通过后，从两个网关删除旧密钥。

所有写入使用 Wrangler Secret、Vercel sensitive env 和服务器只读权限文件。不得把密钥放进命令行参数、Git、Dockerfile、Compose 文件或日志。

## 8. 应用侧自动回退

现有 `lib/ai/voice-gateway-client.ts` 已实现顺序回退：

```text
VOLCENGINE_ROUTE=cloudflare
CLOUDFLARE_VOICE_GATEWAY_URL=https://chatmandarin-voice.wangyn-80.workers.dev
TOKYO_VOICE_GATEWAY_URL=https://voice-jp.chatmandarin.cc
```

Cloudflare 请求抛异常、超时或返回非 2xx 时，会尝试 Tokyo URL。

上线 EC2 前建议再补充：

- 分开记录 `gateway=cloudflare|tokyo`、耗时和失败原因，不记录 payload。
- 响应增加内部 `x-voice-route` 诊断头，但不返回敏感信息。
- Cloudflare 连接阶段超时控制在 3 秒；ASR/TTS 总超时仍允许 35 秒。
- 不建议默认并发发送两份音频，会增加费用和隐私暴露面。
- 不建议在 Vercel Function 内做长期内存熔断器；实例不是持久进程。

## 9. 分阶段上线步骤

### 阶段 0：先处理服务器风险

1. 备份并核对 AWS Security Group。
2. 确认所有当前公网端口的调用方。
3. 关闭或限制数据库、Redis、Registry 等非必要公网入口。
4. 盘点 Docker 回滚镜像后安全释放磁盘，目标系统盘低于 75%。

### 阶段 1：本地开发和验证

1. 实现 Node 网关和共享协议测试。
2. 本地运行 TTS、ASR loopback、过期签名、错误签名、重复 nonce、大请求测试。
3. 容器以只读文件系统启动。
4. 执行至少 120 秒测试，不进行小时级压测。

### 阶段 2：EC2 隔离部署

1. 上传到新目录 `/home/ubuntu/chatmandarin-voice`。
2. 只启动绑定 `127.0.0.1:18787` 的容器。
3. 从服务器本机请求 `/health`、TTS、ASR。
4. 确认 copyright-agent、warehouse 容器状态未变化。

### 阶段 3：Nginx 和 TLS

1. 创建 `voice-jp.chatmandarin.cc` DNS-only 记录。
2. 申请证书。
3. 备份 `/opt/nginx/conf.d`。
4. 新增独立配置文件。
5. `nginx -t` 成功后 reload。
6. 从海外网络验证 HTTPS 和 HMAC。

### 阶段 4：Preview 故障演练

1. Vercel Preview 配置 Tokyo URL。
2. 先直接设置 `VOLCENGINE_ROUTE=tokyo`，验证完整语音流程。
3. 再恢复 `cloudflare`，把 Preview 的 Cloudflare URL 临时设置为不可达测试地址。
4. 确认请求自动落到 Tokyo，ASR/TTS 都成功。
5. 恢复正常 Cloudflare URL。

### 阶段 5：生产切换

1. Production 添加 `TOKYO_VOICE_GATEWAY_URL`。
2. 部署生产版本。
3. 运行 120–300 秒检查。
4. 观察 Vercel、Cloudflare 和 EC2 日志至少一个发布窗口。

## 10. 验收指标

| 项目 | 标准 |
| --- | --- |
| Cloudflare 正常 | 全部走 Cloudflare，Tokyo 无业务请求 |
| Cloudflare 5xx | 自动转 Tokyo，用户请求成功 |
| Cloudflare DNS/连接失败 | 3 秒左右开始回退 |
| Tokyo 网关健康 | `/health` 200 |
| Tokyo TTS | 120 秒内成功率 100% |
| Tokyo ASR loopback | 非空识别结果 |
| 安全 | 错误签名、过期签名、重复 nonce 全部拒绝 |
| 隔离 | copyright-agent、warehouse 状态不变化 |
| 日志 | 无 Key、音频、正文和完整签名 |

## 11. 监控与告警

- 外部探测：Cloudflare Worker `/health` 和 `voice-jp` `/health` 各自独立监控。
- EC2：CPU、可用内存、磁盘使用率、容器重启次数。
- 磁盘：80% warning，85% critical。
- 网关：每分钟请求数、成功率、p50/p95、Cloudflare/东京路由占比。
- 上游：区分 DNS、TCP、TLS、HTTP、WebSocket 和火山业务错误。
- 当 Tokyo 路由比例连续 5 分钟大于 5% 时告警。

## 12. 回滚

### 应用侧

删除或清空 `TOKYO_VOICE_GATEWAY_URL`，重新部署 Vercel；主链路恢复为 Cloudflare-only。

### Nginx

移除新增的 `chatmandarin-voice.conf`，恢复备份，`nginx -t` 后 reload。不要动 warehouse 原配置。

### EC2 容器

停止并移除独立 `chatmandarin_voice_gateway` 容器即可；不删除共享 Nginx、copyright-agent 或 wms 网络。

### 密钥

若怀疑泄露，生成新密钥并完成双密钥轮换；验证后删除旧密钥。

## 13. 推荐结论

推荐先采用方案 A，理由是：

- 当前 EC2 的 CPU、内存和日本到火山引擎网络满足备用需求。
- 增量成本最低。
- 应用已有顺序回退代码，改动集中在新增兼容网关和环境变量。
- 使用 DNS-only 域名后，备用入口可脱离 Cloudflare 代理。

但以下两项必须在实际部署前处理：

1. 审查并收紧当前公网开放的数据库、Redis、Registry 和业务端口。
2. 降低 83% 的系统盘使用率，并保留经确认的回滚镜像。

如果不希望对现有 Nginx 做任何配置变更，则直接选择方案 B（AWS ALB + ACM），用固定成本换取隔离性。
