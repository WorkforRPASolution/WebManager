<!DOCTYPE html>
<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Enterprise Dashboard - Mega Menu View</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,typography"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" rel="stylesheet"/>
<script>
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            colors: {
              primary: "#2563eb",
              "background-light": "#f3f4f6",
              "background-dark": "#0f172a",
            },
            fontFamily: {
              display: ["Inter", "sans-serif"],
            },
            borderRadius: {
              DEFAULT: "12px",
            },
          },
        },
      };
      function toggleMenu() {
        const menu = document.getElementById('mega-menu');
        menu.classList.toggle('hidden');
      }
      function toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('-translate-x-full');
      }
    </script>
<style>
        body {
            font-family: 'Inter', sans-serif;
            -webkit-tap-highlight-color: transparent;
        }
        .ios-blur {
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
        }
    </style>
<style>
    body {
      min-height: max(884px, 100dvh);
    }
  </style>
  </head>
<body class="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 overflow-hidden h-screen flex flex-col">
<header class="bg-primary h-16 flex items-center justify-between px-4 shrink-0 shadow-lg z-50">
<div class="flex items-center gap-3">
<button class="text-white p-1 hover:bg-white/10 rounded-md transition-colors" onclick="toggleSidebar()">
<span class="material-symbols-outlined">menu_open</span>
</button>
<div class="w-8 h-8 bg-white rounded flex items-center justify-center shadow-sm">
<div class="w-5 h-5 bg-primary rounded-sm"></div>
</div>
<h1 class="text-white font-semibold text-lg tracking-tight">ServiceName</h1>
</div>
<div class="flex items-center gap-4">
<button class="text-white/90 hover:text-white flex items-center gap-1 font-medium text-sm px-2 py-1 rounded-md transition-all active:scale-95" onclick="toggleMenu()">
                Browse
                <span class="material-symbols-outlined text-sm">expand_more</span>
</button>
<span class="material-symbols-outlined text-white">account_circle</span>
</div>
</header>
<div class="flex flex-1 relative overflow-hidden">
<aside class="absolute inset-y-0 left-0 w-64 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-40 transform transition-transform duration-300 ease-in-out shadow-xl" id="sidebar">
<div class="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
<span class="text-xs font-bold uppercase tracking-wider text-slate-400">Navigation</span>
<button class="text-slate-400" onclick="toggleSidebar()">
<span class="material-symbols-outlined text-sm">chevron_left</span>
</button>
</div>
<nav class="p-4 space-y-1">
<div class="mb-4">
<p class="text-sm font-semibold text-primary mb-2 px-2">Sub1Menu1</p>
<a class="flex items-center gap-3 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 bg-slate-200/50 dark:bg-slate-800/50 rounded-lg font-medium border-l-2 border-primary" href="#">
                        Sub2Menu1
                    </a>
<a class="flex items-center gap-3 px-3 py-2 text-sm text-slate-500 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors mt-1" href="#">
                        Sub2Menu2
                    </a>
</div>
</nav>
</aside>
<main class="flex-1 flex flex-col bg-white dark:bg-slate-950 overflow-hidden">
<div class="px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
<h2 class="text-2xl font-bold text-slate-800 dark:text-white">Sub2Menu1</h2>
<p class="text-sm text-slate-400 mt-1">Dashboard overview and system metrics</p>
</div>
<div class="flex-1 overflow-y-auto p-6 space-y-6 pb-24">
<div class="grid grid-cols-1 gap-4">
<div class="p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
<div class="flex items-center justify-between mb-4">
<span class="text-xs font-bold uppercase text-slate-400">System Status</span>
<span class="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-[10px] font-bold rounded-full">ACTIVE</span>
</div>
<div class="h-32 w-full bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse flex items-center justify-center">
<span class="material-symbols-outlined text-slate-400">analytics</span>
</div>
</div>
<div class="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
<h3 class="font-semibold mb-3">Recent Activity</h3>
<div class="space-y-4">
<div class="flex items-center gap-3">
<div class="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
<span class="material-symbols-outlined text-sm text-blue-600">settings</span>
</div>
<div class="flex-1">
<p class="text-sm font-medium">Configuration updated</p>
<p class="text-xs text-slate-400">2 minutes ago</p>
</div>
</div>
<div class="flex items-center gap-3">
<div class="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
<span class="material-symbols-outlined text-sm text-amber-600">warning</span>
</div>
<div class="flex-1">
<p class="text-sm font-medium">Memory threshold reached</p>
<p class="text-xs text-slate-400">1 hour ago</p>
</div>
</div>
</div>
</div>
</div>
</div>
<nav class="absolute bottom-0 inset-x-0 h-16 bg-white/80 dark:bg-slate-900/80 ios-blur border-t border-slate-200 dark:border-slate-800 px-2 flex items-center justify-around z-30">
<button class="flex flex-col items-center justify-center w-full h-full gap-0.5 text-primary">
<span class="material-symbols-outlined filled">view_quilt</span>
<span class="text-[10px] font-bold">Sub2Menu1</span>
</button>
<button class="flex flex-col items-center justify-center w-full h-full gap-0.5 text-slate-400">
<span class="material-symbols-outlined">layers</span>
<span class="text-[10px] font-medium">Sub2Menu2</span>
</button>
<button class="flex flex-col items-center justify-center w-full h-full gap-0.5 text-slate-400">
<span class="material-symbols-outlined">add_circle</span>
<span class="text-[10px] font-medium">New Tab</span>
</button>
</nav>
</main>
</div>
<div class="hidden absolute inset-x-0 top-16 bottom-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity duration-300" id="mega-menu">
<div class="bg-white dark:bg-slate-900 w-full max-h-[80vh] overflow-y-auto shadow-2xl rounded-b-3xl border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top duration-300">
<div class="p-6 grid grid-cols-2 gap-8">
<div>
<h3 class="text-primary font-bold text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
<span class="w-2 h-2 rounded-full bg-primary"></span>
                        MainMenu1
                    </h3>
<div class="space-y-6">
<div>
<h4 class="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">Sub1Menu1</h4>
<ul class="space-y-2">
<li><a class="text-sm text-slate-500 hover:text-primary dark:text-slate-400 transition-colors" href="#" onclick="toggleMenu()">Sub2Menu1</a></li>
<li><a class="text-sm text-slate-500 hover:text-primary dark:text-slate-400 transition-colors" href="#" onclick="toggleMenu()">Sub2Menu2</a></li>
</ul>
</div>
<div class="pt-2">
<h4 class="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">Sub1Menu2</h4>
<ul class="space-y-2">
<li><a class="text-sm text-slate-500 hover:text-primary dark:text-slate-400 transition-colors" href="#" onclick="toggleMenu()">Sub2Menu3</a></li>
<li><a class="text-sm text-slate-500 hover:text-primary dark:text-slate-400 transition-colors" href="#" onclick="toggleMenu()">Sub2Menu4</a></li>
</ul>
</div>
</div>
</div>
<div>
<h3 class="text-slate-400 font-bold text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
<span class="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                        MainMenu2
                    </h3>
<div class="space-y-6">
<div>
<h4 class="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">Admin Tools</h4>
<ul class="space-y-2">
<li><a class="text-sm text-slate-500 hover:text-primary dark:text-slate-400 transition-colors" href="#" onclick="toggleMenu()">User Groups</a></li>
<li><a class="text-sm text-slate-500 hover:text-primary dark:text-slate-400 transition-colors" href="#" onclick="toggleMenu()">Permissions</a></li>
</ul>
</div>
<div>
<h4 class="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">Analytics</h4>
<ul class="space-y-2">
<li><a class="text-sm text-slate-500 hover:text-primary dark:text-slate-400 transition-colors" href="#" onclick="toggleMenu()">Reports</a></li>
</ul>
</div>
</div>
</div>
</div>
<div class="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-center">
<button class="text-sm font-medium text-slate-500 flex items-center gap-1" onclick="toggleMenu()">
                    Close Menu
                    <span class="material-symbols-outlined text-sm">close</span>
</button>
</div>
</div>
</div>
<button class="fixed bottom-20 right-4 w-12 h-12 rounded-full bg-primary text-white shadow-xl flex items-center justify-center z-50 active:scale-90 transition-transform" onclick="document.documentElement.classList.toggle('dark')">
<span class="material-symbols-outlined">dark_mode</span>
</button>

</body></html>