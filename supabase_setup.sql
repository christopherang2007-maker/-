-- 安心托育：在 Supabase Dashboard 的 SQL Editor 整段执行一次
create type public.user_role as enum ('admin', 'teacher');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role public.user_role not null default 'teacher',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create table public.students (
  id text primary key,
  name text not null,
  grade text not null,
  meal text not null,
  diet text default '',
  schedule text not null,
  teacher text default '',
  group_link text default '',
  updated_at timestamptz not null default now()
);

create table public.attendance (
  attendance_date date not null,
  student_id text not null references public.students(id) on delete cascade,
  school_a boolean not null default false,
  school_b boolean not null default false,
  care_a boolean not null default false,
  care_b boolean not null default false,
  notified boolean not null default false,
  primary key (attendance_date, student_id)
);

create table public.special_records (
  id uuid primary key default gen_random_uuid(),
  record_date date not null default current_date,
  student_id text not null references public.students(id) on delete cascade,
  type text not null,
  note text not null,
  created_at timestamptz not null default now()
);

create table public.emergency_reminders (
  id uuid primary key default gen_random_uuid(),
  reminder_date date not null default current_date,
  student_id text not null references public.students(id) on delete cascade,
  reminder_time time not null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.attendance enable row level security;
alter table public.special_records enable row level security;
alter table public.emergency_reminders enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create policy "authenticated can view profiles" on public.profiles for select to authenticated using (true);
create policy "admins manage profiles" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "authenticated can view students" on public.students for select to authenticated using (true);
create policy "admins manage students" on public.students for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "authenticated can view attendance" on public.attendance for select to authenticated using (true);
create policy "teachers record attendance" on public.attendance for insert to authenticated with check (true);
create policy "teachers update attendance" on public.attendance for update to authenticated using (true) with check (true);
create policy "authenticated can view special records" on public.special_records for select to authenticated using (true);
create policy "teachers manage special records" on public.special_records for all to authenticated using (true) with check (true);
create policy "authenticated can view reminders" on public.emergency_reminders for select to authenticated using (true);
create policy "teachers manage reminders" on public.emergency_reminders for all to authenticated using (true) with check (true);

-- 创建管理员账号后，将下方的邮箱改成管理员的登录邮箱，再执行此句：
-- update public.profiles set role = 'admin' where email = 'your-email@example.com';

-- 功能升级：学生头像、每日 notes、吃饭签到与留校讯息
alter table public.students add column if not exists photo_url text default '';
alter table public.students add column if not exists notes text default '';
alter table public.students add column if not exists tuition_info text default '';
alter table public.attendance add column if not exists meal_taken boolean not null default false;

create table if not exists public.stay_messages (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(id) on delete cascade,
  weekday text not null,
  bring_meal boolean not null default false,
  reason text not null,
  created_at timestamptz not null default now()
);
alter table public.stay_messages enable row level security;
create policy "authenticated can view stay messages" on public.stay_messages for select to authenticated using (true);
create policy "teachers manage stay messages" on public.stay_messages for all to authenticated using (true) with check (true);

-- 在 Dashboard 的 Storage 中建立名为 student-avatars 的 public bucket，或执行：
insert into storage.buckets (id, name, public) values ('student-avatars', 'student-avatars', true) on conflict (id) do update set public = true;
create policy "authenticated upload avatars" on storage.objects for insert to authenticated with check (bucket_id = 'student-avatars');
create policy "public view avatars" on storage.objects for select using (bucket_id = 'student-avatars');
create policy "authenticated update avatars" on storage.objects for update to authenticated using (bucket_id = 'student-avatars');

-- 学生日常记录（需登录后才可读取/修改）
create table if not exists public.daily_student_records (
  id text primary key,
  student_id text not null references public.students(id) on delete cascade,
  student_name text not null,
  record_date date not null default current_date,
  note text not null,
  created_at timestamptz not null default now()
);
alter table public.daily_student_records enable row level security;
create policy "authenticated can view daily records" on public.daily_student_records for select to authenticated using (true);
create policy "authenticated manage daily records" on public.daily_student_records for all to authenticated using (true) with check (true);
