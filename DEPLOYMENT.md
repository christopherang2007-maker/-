# 托育网站接入 WhatsApp 发送电脑

这个版本保留原有 WhatsApp Link 手动方式，并增加 Supabase 任务队列方式。网站不会连接老师电脑的局域网 IP，也不会在网页中保存 Supabase secret/service-role key。

## 上线前顺序

1. 先备份 Supabase 数据库和当前 Vercel 部署。
2. 在 Supabase SQL Editor 确认真正获准使用系统的账号：

   ```sql
   select id, email, role, approved from public.profiles order by email;

   update public.profiles
   set approved = true
   where email in ('管理员邮箱@example.com', '老师邮箱@example.com');
   ```

   不要把所有新注册账号一起批准。
3. 执行 `supabase/migrations/20260816165113_website_whatsapp_task_controls.sql`。
4. 在 Supabase Authentication 设置关闭公开注册（Allow new users to sign up），老师账号由管理员预先建立和批准。
5. Vercel 环境变量使用：

   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`

   为兼容旧部署，程序仍会读取 `SUPABASE_ANON_KEY`，但不要设置 service-role/secret key。
6. 将这个目录部署至 Vercel，再清除浏览器旧缓存或重新打开网站。

## 操作流程

1. 管理员从电脑发送工具复制准确的群组 ID（数字加 `@g.us`）。
2. 在网站后台修改学生，填写“WhatsApp 家庭群 ID”并保存。
3. 在“WhatsApp 讯息发送方式”选择：

   - 手动：打开 WhatsApp Link，老师自行粘贴、发送，再回网站确认。
   - 自动：按钮建立 `pending` 任务，电脑工具领取并发送。
   - 混合：正常走自动流程；失败后按钮可切换至手动补发。

4. 老师点名后，每个孩子仍须点击一次发送按钮。任务等待或处理中不能重复点击；成功后按钮显示“已发送”。

## 测试建议

先不要使用正式老师号码。完成网站部署和群组绑定后，用测试号码与测试群执行一条任务，依次检查 `pending`、`processing`、`sent` 状态。确认无误后才登录托育中心专用号码。

这个电脑工具使用非官方 WhatsApp Web 自动化；即使低频使用，也不能保证不会被 WhatsApp 限制或封号。手动 Link 模式应保留为故障与风控备用方式。
