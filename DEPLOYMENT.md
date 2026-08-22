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
3. 按文件名顺序执行 `supabase/migrations` 中尚未执行过的 SQL。学校功能新增的文件是：

   - `20260817131237_add_schools_and_student_weekly_plans.sql`
   - `20260819033235_add_special_situation_controls.sql`
   - `20260819162101_persist_special_situations.sql`
   - `20260822101438_staff_access_and_permissions.sql`

   这些 SQL 新增学校、学生每周安排与特殊情况控制字段。最后一份迁移会把同一学生重复的旧特殊情况合并为最新一条；不会删除学生资料。特殊情况之后会持续保留，直到老师手动删除。
4. 在 Supabase Authentication 设置关闭公开注册（Allow new users to sign up）。网站虽已删除注册入口，但这项设置才会从服务端真正禁止自行注册。
5. 执行最新的 `supabase/migrations/20260822101438_staff_access_and_permissions.sql` 后，可在网站「后台信息 → 权限控制」加入 Gmail、显示名字、多个角色和学校范围。
6. 权限控制加入 Gmail 只负责授权。若界面显示「等待建立账号」，管理员仍需在 Supabase Dashboard → Authentication → Users 建立相同 Gmail 的登录账号。
7. Vercel 环境变量使用：

   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`

   为兼容旧部署，程序仍会读取 `SUPABASE_ANON_KEY`，但不要设置 service-role/secret key。
8. 将这个目录部署至 Vercel，再重新打开网站；本版本已提升 PWA 缓存编号，旧脚本会自动淘汰。

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
