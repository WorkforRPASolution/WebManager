<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Enterprise Web Dashboard</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,typography"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet"/>
<script>
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            colors: {
              primary: "#3B82F6",
              "background-light": "#F9FAFB",
              "background-dark": "#111827",
              "sidebar-light": "#EFF6FF",
              "sidebar-dark": "#1F2937",
            },
            fontFamily: {
              display: ["Inter", "sans-serif"],
            },
            borderRadius: {
              DEFAULT: "0.5rem",
            },
          },
        },
      };
    </script>
<style>
        body { font-family: 'Inter', sans-serif; }
        .mega-menu { display: none; }
        .nav-item:hover .mega-menu { display: block; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
    </style>
<style>
    body {
      min-height: max(884px, 100dvh);
    }
  </style>
  </head>
<body class="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen flex flex-col">
<header class="bg-primary h-14 flex items-center px-4 shrink-0 shadow-md z-50">
<div class="flex items-center gap-3">
<div class="w-8 h-8 bg-white/20 rounded flex items-center justify-center">
<span class="material-icons text-white">grid_view</span>
</div>
<span class="text-white font-bold text-lg tracking-tight">ServiceName</span>
</div>
<nav class="ml-12 flex h-full">
<div class="nav-item group relative flex items-center h-full px-4 cursor-pointer">
<span class="text-white/90 hover:text-white font-medium transition-colors">MainMenu1</span>
<div class="mega-menu absolute top-14 left-0 w-[600px] bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 p-6 grid grid-cols-2 gap-8 rounded-b-lg">
<div>
<h3 class="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Sub1Menu1</h3>
<ul class="space-y-2">
<li><a class="text-primary hover:underline font-medium" href="#">Sub2Menu1</a></li>
<li><a class="text-primary hover:underline font-medium" href="#">Sub2Menu2</a></li>
</ul>
</div>
<div class="border-l border-gray-100 dark:border-gray-700 pl-8">
<h3 class="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Sub1Menu2</h3>
<ul class="space-y-2">
<li><a class="text-primary hover:underline font-medium" href="#">Sub2Menu3</a></li>
<li><a class="text-primary hover:underline font-medium" href="#">Sub2Menu4</a></li>
</ul>
</div>
</div>
</div>
<div class="nav-item flex items-center h-full px-4 cursor-pointer">
<span class="text-white/90 hover:text-white font-medium transition-colors">MainMenu2</span>
</div>
</nav>
<div class="ml-auto flex items-center gap-4 text-white/80">
<button class="hover:text-white"><span class="material-icons">search</span></button>
<button class="hover:text-white"><span class="material-icons">notifications</span></button>
<div class="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
<span class="material-icons text-sm">person</span>
</div>
</div>
</header>
<div class="flex flex-1 overflow-hidden">
<aside class="w-64 bg-sidebar-light dark:bg-sidebar-dark border-r border-gray-200 dark:border-gray-700 flex flex-col shrink-0">
<div class="p-2 border-b border-gray-200 dark:border-gray-700 flex justify-end">
<button class="p-1 hover:bg-white dark:hover:bg-gray-700 rounded text-gray-500">
<span class="material-icons text-sm">chevron_left</span>
</button>
</div>
<div class="p-4 custom-scrollbar overflow-y-auto">
<div class="mb-6">
<div class="flex items-center text-primary mb-2">
<span class="material-icons text-lg mr-2">folder_open</span>
<span class="font-semibold text-sm">Sub1Menu1</span>
</div>
<ul class="ml-7 space-y-1">
<li class="px-3 py-2 bg-white dark:bg-gray-700 rounded shadow-sm border-l-2 border-primary">
<a class="text-sm font-medium text-primary" href="#">Sub2Menu1</a>
</li>
<li class="px-3 py-2 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded">
<a class="text-sm text-gray-600 dark:text-gray-400" href="#">Sub2Menu2</a>
</li>
</ul>
</div>
</div>
</aside>
<main class="flex-1 flex flex-col min-w-0 bg-white dark:bg-gray-900">
<div class="px-8 pt-8 pb-4">
<h1 class="text-2xl font-bold text-gray-800 dark:text-white mb-4">Sub2Menu1</h1>
<div class="h-[1px] bg-gray-200 dark:bg-gray-700 w-full"></div>
</div>
<div class="flex-1 px-8 py-4 overflow-y-auto">
<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
<div class="p-6 border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-800/50">
<div class="flex items-center justify-between mb-4">
<h3 class="font-semibold">Performance Overview</h3>
<span class="material-icons text-gray-400">more_horiz</span>
</div>
<div class="h-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
</div>
<div class="p-6 border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-800/50">
<div class="flex items-center justify-between mb-4">
<h3 class="font-semibold">Recent Activities</h3>
<span class="material-icons text-gray-400">history</span>
</div>
<div class="space-y-3">
<div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
<div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
<div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
</div>
</div>
</div>
</div>
<footer class="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 h-10 flex items-end px-4">
<div class="flex gap-1 h-full">
<button class="bg-white dark:bg-gray-900 px-6 h-8 rounded-t-lg border-x border-t border-gray-200 dark:border-gray-700 text-xs font-semibold text-primary flex items-center gap-2">
<span>Sub2Menu1</span>
<span class="material-icons text-[10px] hover:text-red-500">close</span>
</button>
<button class="bg-gray-100 dark:bg-gray-800/50 px-6 h-8 rounded-t-lg border-x border-t border-transparent text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
<span>Sub2Menu2</span>
<span class="material-icons text-[10px] hover:text-red-500">close</span>
</button>
<button class="px-2 h-8 text-gray-400 hover:text-primary transition-colors">
<span class="material-icons text-sm">add</span>
</button>
</div>
</footer>
</main>
</div>

</body></html>