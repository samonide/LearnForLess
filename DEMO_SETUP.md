# 🚀 LearnForLess Demo Setup Guide

## Quick Start (5 minutes)

### Step 1: Create `.env.local` File

Copy this template into `.env.local` in the project root:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY_HERE

# App Configuration
NEXT_PUBLIC_APP_NAME=LearnForLess
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Get your Supabase keys:**
1. Go to [supabase.com](https://supabase.com) and create a free project
2. In Project Settings → API, copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon (public)` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role (secret)` key → `SUPABASE_SERVICE_ROLE_KEY`

### Step 2: Initialize Database

1. In Supabase dashboard, go to **SQL Editor**
2. Copy the entire SQL migration from `supabase/migrations/001_schema.sql`
3. Paste and run it in the SQL Editor
4. (Optional) Run `supabase/seed.sql` to add demo data

### Step 3: Create Admin Account

**Via Supabase Auth UI:**
1. Go to **Authentication → Users** in your Supabase dashboard
2. Click **"Invite"** and enter admin email
3. Copy the invitation link and sign up
4. Go to **SQL Editor** and run:

```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'your-admin-email@example.com';
```

### Step 4: Generate Demo Access Token

1. `npm run dev` → navigate to http://localhost:3000/admin/login
2. Login with your admin credentials
3. Go to **Access Tokens** → **Generate Token**
4. Name: "Demo Token"
5. Assign courses (if you ran seed.sql, the "Sigma 7.0" course should exist)
6. Copy the generated token (shown once in modal)

### Step 5: Test Student Portal

1. Open http://localhost:3000/access in a new tab
2. Paste the demo token and click "Continue"
3. You should see the dashboard with your assigned courses!

---

## 🎯 Frontend Feature Checklist

### ✅ Public Pages (Complete)
- [x] Access token entry page (`/access`)
- [x] Login navigation page (`/login`)
- [x] Admin login page (`/admin/login`)

### ✅ Student Portal (Complete)
- [x] Dashboard with course cards (`/dashboard`)
- [x] Course overview page (`/course/[courseId]`)
- [x] **CourseViewer** with sidebar navigation
- [x] **LessonContent** renderer (text, PDF, video, image, file, link)
- [x] Progress tracking & completion
- [x] Responsive mobile layout with drawer

### ✅ Admin Panel (Complete)
- [x] Dashboard with stats (`/admin/dashboard`)
- [x] Courses list page (`/admin/courses`)
- [x] Create course page (`/admin/courses/new`)
- [x] **CourseBuilder** drag-drop editor
- [x] **EditCourseForm** for metadata
- [x] Tokens management page (`/admin/tokens`)
- [x] **NewTokenForm** with one-time modal
- [x] Users directory page (`/admin/users`)
- [x] **UsersList** with grant/revoke UI
- [x] Settings page (`/admin/settings`)

### ✅ Components (Complete)
- [x] Course sidebar with lesson navigation
- [x] Lesson content dynamic renderer
- [x] Drag-and-drop module/lesson builder
- [x] PDF viewer
- [x] Progress bars and badges
- [x] Admin forms with validation

---

## 🔥 Performance Optimizations Already Implemented

1. **Server-Side Rendering (SSR)** - All pages pre-rendered server-side
2. **Selective Revalidation** - Only cache-invalidate changed routes
3. **Image Optimization** - Next.js automatic image optimization
4. **Code Splitting** - Per-route chunking
5. **Lazy Loading** - Components load on-demand
6. **Form Submission Transitions** - useTransition for instant feedback
7. **PDF Lazy Loading** - Only fetch PDF when viewing
8. **Signed URLs** - Short-lived auth tokens for file downloads
9. **Minimal Re-renders** - React hooks optimized with deps arrays

### To Further Improve:
- Add dynamic import for heavy components:
  ```tsx
  const CourseViewer = dynamic(() => import('@/components/course-viewer'))
  ```
- Enable ISR (Incremental Static Regeneration) for course pages
- Implement edge caching for course assets

---

## 🧪 Testing the Demo Features

### Test 1: Token Redemption
```
1. Go to /access
2. Enter the demo token
3. Should redirect to /dashboard with assigned courses
```

### Test 2: Lesson Viewing
```
1. Click "Continue Course" on a course card
2. View lesson content (should be fast, no full-page reloads)
3. Click "Mark Lesson Complete"
4. Check progress updated in sidebar
5. Navigate between lessons using sidebar
```

### Test 3: Admin Course Creation
```
1. Go to /admin/dashboard (login if needed)
2. Click "Create Course" → fill form → "Create & Continue to Builder"
3. Add a module → Add a lesson
4. Edit lesson content (text/PDF/video)
5. Go back to courses → should see new course in list
```

### Test 4: Token Generation
```
1. Go to /admin/tokens → "Generate Token"
2. Fill form, assign courses
3. Copy the one-time token from modal
4. Test redemption with new token
```

### Test 5: User Management
```
1. Have a student account with courses
2. Go to /admin/users
3. Click "Grant" → assign another course
4. Student should see new course on next login
```

---

## 🚨 Common Issues & Solutions

### Issue: "NEXT_PUBLIC_SUPABASE_URL is not set"
**Solution:** Make sure `.env.local` exists in project root (not in `src/`)

### Issue: RLS Policy Errors (403 Forbidden)
**Solution:** The SQL migration includes all RLS policies. If missing:
1. Check that `001_schema.sql` was fully executed
2. Verify `profiles` table has your user with `role = 'admin'`
3. Check `student_access` table has a record for your `user_id`

### Issue: "Token hash mismatch"
**Solution:** Token is only valid within 1 hour of generation. Generate a new one.

### Issue: "User not found in profiles table"
**Solution:** Supabase Auth and profiles table are separate:
1. Check auth.users table has your user (Supabase dashboard → Auth)
2. Create profile record: `INSERT INTO profiles (id, email, role) VALUES (user_id, email, 'student')`

---

## 📖 Architecture Notes

### Frontend Stack
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4
- **Components:** shadcn/ui (Radix UI)
- **Forms:** React Hook Form + Zod
- **Rich Text:** Tiptap
- **PDF Viewer:** react-pdf
- **Drag-Drop:** @dnd-kit
- **Icons:** lucide-react
- **Notifications:** sonner

### Key Patterns Used
- Server Components for data fetching
- Server Actions for mutations
- useTransition for optimistic updates
- Protected routes via middleware
- RLS (Row Level Security) at database layer
- Type-safe API with generated `database.ts` types

### File Structure
```
src/
  app/                  # Next.js App Router
    (public)/           # Public routes (no auth required)
    (student)/          # Student portal (auth required)
    (admin)/            # Admin panel (admin role required)
  components/           # Reusable UI components
  actions/              # Server actions (mutations)
  lib/                  # Utilities & clients
    supabase/           # Supabase client setup
  types/                # TypeScript type definitions
  middleware.ts         # Auth middleware
```

---

## 🎓 Next Steps After Demo

1. **Production Deployment:**
   - Deploy to Vercel
   - Use production Supabase project
   - Configure custom domain
   - Set up email service for admin invites

2. **Feature Additions:**
   - Real-time progress updates (Supabase Realtime)
   - Email notifications for course updates
   - Discussion forum per course
   - Quiz/assessment system
   - Certificate generation
   - Automated course expiry

3. **Operations:**
   - Backup Supabase data regularly
   - Monitor audit logs (`audit_logs` table)
   - Set up analytics (Vercel Analytics)
   - Enable Supabase backups

---

## 📞 Support

For issues, check:
1. Console errors (`npm run dev` output)
2. Network tab in DevTools (XHR/fetch requests)
3. Supabase logs (SQL Editor → Running Queries)
4. `.env.local` variables are set correctly

---

**Happy Learning! 🎉**
