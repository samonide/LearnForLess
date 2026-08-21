# Found Bugs & Improvements

## Dead End (SOLVED)

### ~~2. PDF Viewer Scrolling Issues~~
The PDF viewer scrolling broken, pages load one-by-one. Internal PDF size mismatched.
(SOLVED)

### ~~3. VideoJS Player Integration Issues~~
Clicking a video lesson from sidebar loads empty black player with no controls. Only refresh fixes it. Video controls cropped, width doesn't match player.
(SOLVED)

---

## Easy

### ~~1. Token Name Field Should Be Optional~~
`/admin/tokens/new` requires a token name, which gets assigned as the redeeming user's account name. If someone names a token "Sigma" and another user claims it, that user's account name changes to "Sigma". The name field should be an optional admin note, not mandatory, and must never overwrite the claimant's account name.
(SOLVED — name now optional reference note; RPC and updateToken no longer overwrite display_name)

### ~~10. Remove Underlines From Sidebar Links~~
Course sidebar module/lesson links have underlines. Remove them for cleaner look.
(SOLVED)

### ~~8. Successful Redemption Confirmation Card~~
When a token is redeemed successfully, show a popup/card with a congratulations message (e.g. "Congratulations, you got access to the course!") instead of a plain/nonexistent response.
(SOLVED)

---

## Medium

### ~~5. Admin Sidebar Not Sticky~~
In admin panel, the left sidebar scrolls with page content. When editing a course with many modules/lessons, the sidebar scrolls off-screen, leaving empty space. Sidebar should be sticky to its container.
(SOLVED)

### ~~9. Mark As Complete → Auto-Advance to Next Lesson~~
Clicking "Mark as Complete" on a lesson should automatically navigate to the next lesson in the course.
(SOLVED)

### ~~6. Redesign Add Lesson UI~~
The "Add Lesson" popup is too small for a feature this important. Should be a larger dialog or a dedicated page with all essential options (title, description, content type, video URL, PDF upload, etc.).
(SOLVED — replaced with full-page Lesson Editor covering title, description, content type, video URL, PDF upload)

---

## Hard

### 4. Admin Panel Needs More Features (PARTIALLY SOLVED)
Admin panel needs user management features and other mandatory admin tools.
(PARTIALLY SOLVED — Admin Accounts page at `/admin/admins` now covers promote/demote with last-admin protection. Remaining: e.g. user deletion. Scope still needs definition.)

### 7. Multi-Supabase DB Support
Admin should be able to add multiple Supabase DB connections with custom credentials, category labels (code/pdf), and named identifiers (e.g. "codebase1", "pdfdb1"). Upload flow should let admins choose which DB to upload to, with per-connection credential storage and schema setup.
