-- ============================================================
-- LearnForLess – Seed Data (Development Only)
-- Run AFTER 001_schema.sql
-- Creates sample courses, modules, and lessons
-- ============================================================

-- NOTE: You must manually create an admin user via Supabase Auth
-- then run this to insert their profile:
--
-- INSERT INTO public.profiles (id, email, display_name, role)
-- VALUES ('<your-auth-user-uuid>', 'admin@example.com', 'Administrator', 'admin');

-- ============================================================
-- SAMPLE COURSE: Sigma 7.0
-- ============================================================

DO $$
DECLARE
  v_course_id   UUID := 'a1b2c3d4-0000-0000-0000-000000000001';
  v_mod1_id     UUID := 'b1000000-0000-0000-0000-000000000001';
  v_mod2_id     UUID := 'b1000000-0000-0000-0000-000000000002';
  v_mod3_id     UUID := 'b1000000-0000-0000-0000-000000000003';
  v_mod4_id     UUID := 'b1000000-0000-0000-0000-000000000004';
  v_mod5_id     UUID := 'b1000000-0000-0000-0000-000000000005';
BEGIN

-- Course
INSERT INTO public.courses (id, title, slug, description, status, sort_order)
VALUES (
  v_course_id,
  'Sigma 7.0',
  'sigma-7',
  'A complete programming course covering fundamentals through advanced data structures and algorithms.',
  'published',
  1
) ON CONFLICT (id) DO NOTHING;

-- Module 1: Welcome
INSERT INTO public.modules (id, course_id, title, description, sort_order)
VALUES (v_mod1_id, v_course_id, 'Welcome', 'Introduction and onboarding', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lessons (module_id, title, description, content_type, content, sort_order)
VALUES
  (v_mod1_id, 'Welcome to Sigma 7.0', 'Course overview and introduction', 'text',
   '<h2>Welcome to Sigma 7.0!</h2><p>This course will take you from programming fundamentals to advanced data structures and algorithms.</p>', 1),
  (v_mod1_id, 'Important – Join Telegram', 'Community and support channel', 'link',
   'https://t.me/sigma70', 2),
  (v_mod1_id, 'Course Introduction', 'What you will learn in this course', 'text',
   '<h2>Course Introduction</h2><p>By the end of this course you will be proficient in programming fundamentals, data structures, and algorithms.</p>', 3)
ON CONFLICT DO NOTHING;

-- Module 2: Prerequisites
INSERT INTO public.modules (id, course_id, title, description, sort_order)
VALUES (v_mod2_id, v_course_id, 'Prerequisites', 'Setup and prerequisites', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lessons (module_id, title, description, content_type, content, sort_order)
VALUES
  (v_mod2_id, 'Installation Resources', 'Tools and setup guide', 'text',
   '<h2>Installation Guide</h2><p>Install Java JDK 21+, IntelliJ IDEA Community Edition, and Git.</p>', 1)
ON CONFLICT DO NOTHING;

-- Module 3: Programming Basics
INSERT INTO public.modules (id, course_id, title, description, sort_order)
VALUES (v_mod3_id, v_course_id, 'Programming Basics', 'Core programming concepts', 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lessons (module_id, title, description, content_type, content, sort_order)
VALUES
  (v_mod3_id, 'Variables & Data Types', 'Understanding variables and primitive types', 'text',
   '<h2>Variables & Data Types</h2><p>Variables are containers for storing data values...</p>', 1),
  (v_mod3_id, 'Operators', 'Arithmetic, logical, and bitwise operators', 'text',
   '<h2>Operators</h2><p>Operators perform operations on variables and values...</p>', 2),
  (v_mod3_id, 'Conditional Statements', 'If, else, switch statements', 'text',
   '<h2>Conditional Statements</h2><p>Conditional statements are used to perform different actions based on conditions...</p>', 3),
  (v_mod3_id, 'Loops', 'For, while, do-while loops', 'text',
   '<h2>Loops</h2><p>Loops execute a block of code repeatedly...</p>', 4),
  (v_mod3_id, 'Patterns', 'Pattern problems using loops', 'text',
   '<h2>Patterns</h2><p>Pattern problems are excellent for building loop intuition...</p>', 5),
  (v_mod3_id, 'Functions & Methods', 'Defining and calling functions', 'text',
   '<h2>Functions & Methods</h2><p>Functions allow you to reuse code and organize logic into named blocks...</p>', 6)
ON CONFLICT DO NOTHING;

-- Module 4: Data Structures
INSERT INTO public.modules (id, course_id, title, description, sort_order)
VALUES (v_mod4_id, v_course_id, 'Data Structures', 'Arrays, lists, stacks, queues, trees, graphs', 4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lessons (module_id, title, description, content_type, content, sort_order)
VALUES
  (v_mod4_id, 'Arrays', 'One-dimensional and multi-dimensional arrays', 'text',
   '<h2>Arrays</h2><p>An array is a collection of elements stored at contiguous memory locations...</p>', 1),
  (v_mod4_id, 'Linked Lists', 'Singly and doubly linked lists', 'text',
   '<h2>Linked Lists</h2><p>A linked list is a linear data structure where elements are stored in nodes...</p>', 2),
  (v_mod4_id, 'Stacks & Queues', 'LIFO and FIFO data structures', 'text',
   '<h2>Stacks & Queues</h2><p>Stacks and queues are abstract data types that follow specific ordering rules...</p>', 3)
ON CONFLICT DO NOTHING;

-- Module 5: Algorithms
INSERT INTO public.modules (id, course_id, title, description, sort_order)
VALUES (v_mod5_id, v_course_id, 'Algorithms', 'Sorting, searching, and complexity analysis', 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lessons (module_id, title, description, content_type, content, sort_order)
VALUES
  (v_mod5_id, 'Big O Notation', 'Time and space complexity analysis', 'text',
   '<h2>Big O Notation</h2><p>Big O notation describes the upper bound of an algorithm''s complexity...</p>', 1),
  (v_mod5_id, 'Sorting Algorithms', 'Bubble, selection, insertion, merge, quick sort', 'text',
   '<h2>Sorting Algorithms</h2><p>Sorting algorithms arrange elements in a specific order...</p>', 2),
  (v_mod5_id, 'Binary Search', 'Efficient searching in sorted arrays', 'text',
   '<h2>Binary Search</h2><p>Binary search finds the position of a target value within a sorted array...</p>', 3)
ON CONFLICT DO NOTHING;

END $$;

-- ============================================================
-- SAMPLE COURSE: Web Development
-- ============================================================

DO $$
DECLARE
  v_course_id UUID := 'a1b2c3d4-0000-0000-0000-000000000002';
  v_mod1_id   UUID := 'b2000000-0000-0000-0000-000000000001';
  v_mod2_id   UUID := 'b2000000-0000-0000-0000-000000000002';
BEGIN

INSERT INTO public.courses (id, title, slug, description, status, sort_order)
VALUES (
  v_course_id,
  'Web Development',
  'web-development',
  'Modern web development with HTML, CSS, JavaScript, React, and Next.js.',
  'published',
  2
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.modules (id, course_id, title, sort_order)
VALUES
  (v_mod1_id, v_course_id, 'HTML & CSS Fundamentals', 1),
  (v_mod2_id, v_course_id, 'JavaScript Essentials', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lessons (module_id, title, content_type, content, sort_order)
VALUES
  (v_mod1_id, 'HTML Document Structure', 'text', '<h2>HTML Basics</h2><p>HTML (HyperText Markup Language) is the standard markup language for web pages...</p>', 1),
  (v_mod1_id, 'CSS Selectors & Box Model', 'text', '<h2>CSS Fundamentals</h2><p>CSS (Cascading Style Sheets) controls the visual appearance of HTML elements...</p>', 2),
  (v_mod2_id, 'JavaScript Variables & Functions', 'text', '<h2>JavaScript</h2><p>JavaScript is a lightweight, interpreted programming language with first-class functions...</p>', 1),
  (v_mod2_id, 'DOM Manipulation', 'text', '<h2>DOM</h2><p>The Document Object Model (DOM) represents the page as a tree of nodes...</p>', 2)
ON CONFLICT DO NOTHING;

END $$;

-- ============================================================
-- SAMPLE COURSE: DSA (Draft - not visible to students yet)
-- ============================================================

INSERT INTO public.courses (id, title, slug, description, status, sort_order)
VALUES (
  'a1b2c3d4-0000-0000-0000-000000000003',
  'DSA – Data Structures & Algorithms',
  'dsa',
  'Deep dive into data structures and algorithm design patterns.',
  'draft',
  3
) ON CONFLICT (id) DO NOTHING;
