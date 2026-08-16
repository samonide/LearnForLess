# ⚡ Quick Start Guide

## Get Running in 5 Minutes

### Step 1: Clone & Install Dependencies
```bash
npm install
# (already done if dependencies are installed)
```

### Step 2: Set Up Environment Variables
Copy `.env.local.example` → `.env.local` and add your Supabase credentials:

```bash
cp .env.local.example .env.local
# Edit .env.local with:
# - NEXT_PUBLIC_SUPABASE_URL (from Supabase dashboard)
# - NEXT_PUBLIC_SUPABASE_ANON_KEY (from Supabase dashboard)
# - SUPABASE_SERVICE_ROLE_KEY (from Supabase dashboard)
```

### Step 3: Start Dev Server
```bash
npm run dev
```
Then open **http://localhost:3000** 🎉

---

## 📖 What to Try First

### As a Student
1. Go to http://localhost:3000/access
2. Enter the demo token (you'll create this in admin panel)
3. See dashboard with courses
4. Click "Continue Course" → view lesson content
5. Click "Mark Lesson Complete" → progress updates

### As an Admin
1. Go to http://localhost:3000/admin/login
2. Login with your admin email
3. Go to **Courses** → **Create Course**
4. Go to **Course Builder** → add modules & lessons
5. Go to **Tokens** → **Generate Token**
6. Share token with student
7. Go to **Users** → manage student access

---

## 🚀 Production Deployment

### Deploy to Vercel (Recommended)
```bash
# 1. Push to GitHub
git push origin main

# 2. Connect to Vercel
# - Go to https://vercel.com/new
# - Select your GitHub repo
# - Add environment variables (from .env.local)
# - Deploy!

# 3. Update NEXT_PUBLIC_APP_URL in .env.local to your Vercel domain
```

### Deploy Elsewhere (Docker/Self-Hosted)
```bash
# 1. Build
npm run build

# 2. Start production server
npm start

# 3. Ensure environment variables are set in your hosting provider
```

---

## 📚 File Structure

```
LearnForLess/
├── src/
│   ├── app/                    # Next.js routes (organized by role)
│   │   ├── (public)/           # No auth required
│   │   ├── (student)/          # Student portal (auth required)
│   │   └── (admin)/            # Admin panel (admin role required)
│   ├── components/             # Reusable UI components
│   ├── actions/                # Server actions (mutations)
│   ├── lib/                    # Utilities & clients
│   ├── types/                  # TypeScript definitions
│   └── middleware.ts           # Auth middleware
├── supabase/
│   ├── migrations/             # SQL schema (run this first!)
│   └── seed.sql                # Optional demo data
├── DEMO_SETUP.md               # Complete setup guide
├── FRONTEND_STATUS.md          # What's been built
├── .env.local.example          # Environment template
└── package.json
```

---

## 🔧 Common Commands

```bash
# Development
npm run dev                     # Start dev server (localhost:3000)

# Production
npm run build                   # Build for production
npm start                       # Start production server

# Code Quality
npm run lint                    # ESLint check

# Database
# (No local DB needed, Supabase is remote)
# Run migrations in Supabase dashboard SQL editor
```

---

## 🐛 Troubleshooting

### "NEXT_PUBLIC_SUPABASE_URL is not set"
→ Check `.env.local` exists in project root (not in `src/`)

### "RLS Policy [xxx]: violating row level security policy"
→ Run SQL migration from `supabase/migrations/001_schema.sql` in Supabase dashboard

### "Unauthorized" on course access
→ Make sure you have a `user_courses` record linking your user to the course

### "Token hash mismatch"
→ Tokens only work for 1 hour. Generate a new one from admin panel.

### "PDF won't load"
→ Check that lesson has `storage_path` or `content` set. Admin can edit lesson to add content.

---

## 📋 Features At a Glance

| Feature | Status | Location |
|---------|--------|----------|
| Token Redemption | ✅ | `/access` |
| Student Dashboard | ✅ | `/dashboard` |
| Lesson Viewer | ✅ | `/course/[id]/lesson/[id]` |
| Course Builder | ✅ | `/admin/courses/[id]/builder` |
| Token Management | ✅ | `/admin/tokens` |
| User Management | ✅ | `/admin/users` |
| Progress Tracking | ✅ | Real-time across app |
| PDF/Video Support | ✅ | LessonContent component |
| Mobile Responsive | ✅ | All pages |
| Dark Mode | ✅ | Via shadcn/ui |

---

## 🎓 Learning Path

1. **Setup** → Read [DEMO_SETUP.md](./DEMO_SETUP.md)
2. **Explore** → Play with the UI, create courses, generate tokens
3. **Code** → Check [FRONTEND_STATUS.md](./FRONTEND_STATUS.md) for architecture
4. **Deploy** → Follow deployment section above
5. **Customize** → Modify components in `src/components/`, styles in `tailwind.config.ts`

---

## 💡 Pro Tips

1. **Fast Development:** Use `npm run dev` with file watcher. Changes auto-reload.
2. **Type Safety:** Enable TypeScript strict mode in `tsconfig.json`
3. **Debugging:** Add `debugger;` in code → `npm run dev` → Open DevTools
4. **Forms:** Use React Hook Form with Zod validation (see `*-form.tsx` files)
5. **Styling:** Use Tailwind utility classes + shadcn/ui components

---

## 📞 Support

- **Frontend Issues** → Check [FRONTEND_STATUS.md](./FRONTEND_STATUS.md)
- **Setup Help** → See [DEMO_SETUP.md](./DEMO_SETUP.md)
- **Database Issues** → Run SQL migration from `supabase/migrations/001_schema.sql`
- **Deployment** → Vercel docs or your hosting provider's docs

---

**Ready to launch? Run `npm run dev` and start teaching! 🚀**
