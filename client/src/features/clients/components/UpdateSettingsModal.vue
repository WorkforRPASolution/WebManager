<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50"
    >
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50" @click="handleClose"></div>

      <!-- Modal -->
      <div
        ref="modalRef"
        class="fixed bg-white dark:bg-dark-card rounded-lg shadow-xl flex flex-col overflow-hidden"
        :style="modalStyle"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg shrink-0 select-none" :class="{ 'cursor-move': !isMaximized }" @mousedown="startDrag" @dblclick="toggleMaximize">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Update Settings</h3>
          </div>
          <div class="flex items-center gap-2">
            <button @click="toggleMaximize" @mousedown.stop
              class="p-1.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              :title="isMaximized ? 'Restore' : 'Maximize'">
              <svg v-if="!isMaximized" class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="1" /></svg>
              <svg v-else class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="1" width="11" height="11" rx="1" /><rect x="1" y="4" width="11" height="11" rx="1" /></svg>
            </button>
            <div class="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>
            <button @click="handleClose" @mousedown.stop
              class="p-1.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 transition" title="Close">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="flex-1 flex items-center justify-center py-12">
          <div class="flex items-center gap-3 text-gray-600 dark:text-gray-400">
            <svg class="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Loading...</span>
          </div>
        </div>

        <!-- Two-Panel Content -->
        <div v-else class="flex-1 flex overflow-hidden">
          <!-- Left Panel: Profile List -->
          <div class="w-56 flex-shrink-0 border-r border-gray-200 dark:border-dark-border flex flex-col">
            <div class="px-3 py-2 border-b border-gray-200 dark:border-dark-border">
              <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Profiles</h4>
            </div>
            <div class="flex-1 overflow-auto">
              <button
                v-for="(profile, index) in profiles"
                :key="profile._key"
                @click="selectedIndex = index"
                class="w-full text-left px-3 py-2.5 border-b border-gray-100 dark:border-dark-border/50 transition-colors"
                :class="selectedIndex === index
                  ? 'bg-green-50 dark:bg-green-900/20 border-l-2 border-l-green-500'
                  : 'hover:bg-gray-50 dark:hover:bg-dark-bg border-l-2 border-l-transparent'"
              >
                <div class="flex items-center gap-1.5">
                  <span class="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {{ profile.name || '(unnamed)' }}
                  </span>
                  <span v-if="profile._dirty" class="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" title="Unsaved changes"></span>
                  <span v-if="!profile.profileId" class="inline-block px-1.5 py-0 text-[10px] font-semibold rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex-shrink-0" title="New profile — not yet saved">NEW</span>
                </div>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <span v-if="profile.osVer"
                    class="inline-block px-1.5 py-0 text-[10px] font-medium rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 truncate max-w-[7rem]">
                    {{ profile.osVer }}
                  </span>
                  <span v-else
                    class="inline-block px-1.5 py-0 text-[10px] font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                    All OS
                  </span>
                  <span v-if="profile.version" class="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                    v{{ profile.version }}
                  </span>
                </div>
              </button>
              <div v-if="profiles.length === 0" class="px-3 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                No profiles
              </div>
            </div>
            <!-- Left Panel Footer -->
            <div class="px-3 py-2 border-t border-gray-200 dark:border-dark-border flex gap-1.5">
              <button @click="addProfile"
                class="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-green-500 hover:bg-green-600 text-white rounded transition-colors">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Add
              </button>
              <button @click="copyProfile" :disabled="profiles.length === 0"
                class="flex items-center justify-center px-2 py-1.5 text-xs border border-gray-300 dark:border-dark-border rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                title="Copy profile">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              <button @click="pasteProfile" :disabled="!hasClipboardProfile"
                class="flex items-center justify-center px-2 py-1.5 text-xs border border-gray-300 dark:border-dark-border rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                title="Paste profile">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </button>
              <button @click="deleteProfile" :disabled="profiles.length === 0"
                class="flex items-center justify-center px-2 py-1.5 text-xs bg-red-500 hover:bg-red-600 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Right Panel: Profile Detail -->
          <div class="flex-1 overflow-auto p-4 space-y-5">
            <template v-if="selectedProfile">
              <!-- Profile Fields -->
              <div class="grid grid-cols-3 gap-4">
                <div>
                  <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">Name</label>
                  <input v-model="selectedProfile.name" @input="markSelectedDirty()"
                    class="w-full px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-bg text-gray-900 dark:text-white border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500"
                    :class="{ 'border-red-500': selectedProfile._nameError }"
                    placeholder="Windows v2.0" />
                  <p v-if="selectedProfile._nameError" class="mt-0.5 text-xs text-red-500">{{ selectedProfile._nameError }}</p>
                </div>
                <div>
                  <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">OS Version</label>
                  <select v-model="selectedProfile.osVer" @change="markSelectedDirty()"
                    class="w-full px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-bg text-gray-900 dark:text-white border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500">
                    <option value="">All OS</option>
                    <option v-for="ov in osVersionOptions" :key="ov" :value="ov">{{ ov }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">Version</label>
                  <input v-model="selectedProfile.version" @input="markSelectedDirty()"
                    class="w-full px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-bg text-gray-900 dark:text-white border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500"
                    placeholder="2.0.0" />
                </div>
              </div>

              <!-- Tasks Section -->
              <div>
                <div class="flex items-center justify-between mb-3">
                  <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Deploy Tasks</h4>
                  <div class="flex items-center gap-2">
                    <button
                      @click="pasteTask" :disabled="!hasClipboardTask"
                      class="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Paste task"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Paste
                    </button>
                    <button
                      @click="addTask"
                      class="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                      </svg>
                      Add
                    </button>
                  </div>
                </div>
                <div class="space-y-3">
                  <div v-for="(task, index) in selectedProfile.tasks" :key="task._key"
                    class="border border-gray-200 dark:border-dark-border rounded-lg p-3 space-y-2">
                    <!-- Row 1: Type + Name + StopOnFail + Delete -->
                    <div class="flex items-start gap-3">
                      <div class="w-24 flex-shrink-0">
                        <label class="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-0.5">Type</label>
                        <select v-model="task.type" @change="onTaskTypeChange(task)"
                          class="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-dark-bg text-gray-900 dark:text-white border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500">
                          <option value="copy">Copy</option>
                          <option value="exec">Exec</option>
                        </select>
                      </div>
                      <div class="flex-1">
                        <label class="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-0.5">Name</label>
                        <input v-model="task.name" @input="markSelectedDirty()"
                          class="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-dark-bg text-gray-900 dark:text-white border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500"
                          :class="{ 'border-red-500': task._nameError }"
                          :placeholder="task.type === 'exec' ? 'Stop Agent' : 'Agent Binary'" />
                        <p v-if="task._nameError" class="mt-0.5 text-xs text-red-500">{{ task._nameError }}</p>
                      </div>
                      <div class="flex items-end gap-1 pt-3.5">
                        <label class="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap cursor-pointer mr-1">
                          <input type="checkbox" v-model="task.stopOnFail" @change="markSelectedDirty()"
                            class="rounded border-gray-300 dark:border-dark-border text-orange-500 focus:ring-orange-500" />
                          Stop on Fail
                        </label>
                        <button @click="moveTask(index, 'top')" :disabled="index === 0"
                          class="p-1 rounded transition-colors" :class="index === 0 ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'" title="Move to top">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19" /><polyline points="5 9 12 2 19 9" /><line x1="5" y1="21" x2="19" y2="21" /></svg>
                        </button>
                        <button @click="moveTask(index, 'up')" :disabled="index === 0"
                          class="p-1 rounded transition-colors" :class="index === 0 ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'" title="Move up">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><polyline points="18 15 12 9 6 15" /></svg>
                        </button>
                        <button @click="moveTask(index, 'down')" :disabled="index === selectedProfile.tasks.length - 1"
                          class="p-1 rounded transition-colors" :class="index === selectedProfile.tasks.length - 1 ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'" title="Move down">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><polyline points="6 9 12 15 18 9" /></svg>
                        </button>
                        <button @click="moveTask(index, 'bottom')" :disabled="index === selectedProfile.tasks.length - 1"
                          class="p-1 rounded transition-colors" :class="index === selectedProfile.tasks.length - 1 ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'" title="Move to bottom">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19" /><polyline points="5 15 12 22 19 15" /><line x1="5" y1="3" x2="19" y2="3" /></svg>
                        </button>
                        <button @click="copyTask(index)"
                          class="p-1 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors" title="Copy task">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                        <button @click="removeTask(index)"
                          class="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors" title="Delete">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <!-- Row 2: Type-specific fields -->
                    <template v-if="task.type === 'copy'">
                      <div class="grid grid-cols-2 gap-3">
                        <div class="relative">
                          <label class="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-0.5">Source Path</label>
                          <div class="flex gap-1">
                            <input v-model="task.sourcePath" @input="markSelectedDirty()"
                              class="flex-1 px-2 py-1 text-sm border rounded bg-white dark:bg-dark-bg text-gray-900 dark:text-white border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500 font-mono"
                              :class="{ 'border-red-500': task._sourcePathError }"
                              placeholder="release/bin/agent.jar" />
                            <button @click="browseSource(index)" type="button"
                              class="px-1.5 py-1 text-xs border rounded bg-gray-100 dark:bg-dark-bg border-gray-300 dark:border-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                              title="Browse source files">
                              <svg class="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                            </button>
                          </div>
                          <p v-if="task._sourcePathError" class="mt-0.5 text-xs text-red-500">{{ task._sourcePathError }}</p>
                          <!-- Source Browser Popover -->
                          <div v-if="browsingTaskIndex === index" class="absolute z-10 mt-1 w-80 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-xl">
                            <div class="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-dark-border">
                              <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 truncate">{{ browsePath || '/' }}</span>
                              <div class="flex gap-1">
                                <button v-if="browsePath" @click="browseUp" class="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-dark-bg rounded hover:bg-gray-200 dark:hover:bg-gray-600">Up</button>
                                <button @click="browsingTaskIndex = -1" class="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-dark-bg rounded hover:bg-gray-200 dark:hover:bg-gray-600">Close</button>
                              </div>
                            </div>
                            <div v-if="browseLoading" class="px-3 py-4 text-center text-sm text-gray-400">Loading...</div>
                            <div v-else class="max-h-48 overflow-auto">
                              <button v-for="item in browseFiles" :key="item.name"
                                @click="selectBrowseItem(item, index)"
                                class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-dark-bg flex items-center gap-2">
                                <svg v-if="item.isDirectory" class="w-4 h-4 text-yellow-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                                <svg v-else class="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span class="truncate font-mono">{{ item.name }}</span>
                              </button>
                              <div v-if="browseError" class="px-3 py-4 text-center text-sm text-red-500">{{ browseError }}</div>
                              <div v-else-if="browseFiles.length === 0" class="px-3 py-4 text-center text-sm text-gray-400">Empty</div>
                            </div>
                            <div v-if="browsePath && !browseLoading" class="px-3 py-2 border-t border-gray-200 dark:border-dark-border">
                              <button @click="selectCurrentFolder(index)"
                                class="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium bg-green-500 hover:bg-green-600 text-white rounded transition-colors">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Select this folder
                              </button>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label class="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-0.5">Target Path</label>
                          <input v-model="task.targetPath" @input="markSelectedDirty()"
                            class="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-dark-bg text-gray-900 dark:text-white border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500 font-mono"
                            :class="{ 'border-red-500': task._targetPathError }"
                            placeholder="bin/agent.jar" />
                          <p v-if="task._targetPathError" class="mt-0.5 text-xs text-red-500">{{ task._targetPathError }}</p>
                        </div>
                      </div>
                    </template>

                    <template v-else-if="task.type === 'exec'">
                      <div class="grid grid-cols-3 gap-3">
                        <div class="col-span-2">
                          <label class="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-0.5">Command</label>
                          <input v-model="task.commandLine" @input="markSelectedDirty()"
                            class="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-dark-bg text-gray-900 dark:text-white border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500 font-mono"
                            :class="{ 'border-red-500': task._commandLineError }"
                            placeholder="net stop resourceagent" />
                          <p v-if="task._commandLineError" class="mt-0.5 text-xs text-red-500">{{ task._commandLineError }}</p>
                        </div>
                        <div>
                          <label class="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-0.5">Timeout (sec)</label>
                          <input v-model.number="task.timeout" @input="markSelectedDirty()" type="number" min="1"
                            class="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-dark-bg text-gray-900 dark:text-white border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500"
                            placeholder="30" />
                        </div>
                      </div>
                      <div>
                        <label class="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-0.5">Args (use "..." for tokens with spaces)</label>
                        <input v-model="task._argsText" @input="onArgsInput(task)"
                          class="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-dark-bg text-gray-900 dark:text-white border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500 font-mono"
                          placeholder='/c start "" /MIN "C:\Path With Spaces\app.exe" /min:30' />
                      </div>
                    </template>

                    <!-- Description (common) -->
                    <div>
                      <label class="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-0.5">Description</label>
                      <input v-model="task.description" @input="markSelectedDirty()"
                        class="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-dark-bg text-gray-900 dark:text-white border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500"
                        placeholder="Optional" />
                    </div>
                  </div>
                  <div v-if="selectedProfile.tasks.length === 0" class="px-4 py-6 text-center text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-dark-border rounded-lg">
                    No tasks. Click "Add" to create one.
                  </div>
                </div>
              </div>

              <!-- Source Section -->
              <div>
                <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">Update Source</h4>
                <div class="bg-gray-50 dark:bg-dark-bg rounded-lg p-4 space-y-4">
                  <div class="flex items-center gap-4">
                    <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Type</label>
                    <select v-model="selectedProfile.source.type" @change="onSourceTypeChange"
                      class="px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500">
                      <option value="local">Local Path</option>
                      <option value="ftp">External FTP</option>
                      <option value="minio">MinIO (S3)</option>
                    </select>
                  </div>

                  <!-- Local Source -->
                  <div v-if="selectedProfile.source.type === 'local'" class="flex items-center gap-4">
                    <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Path</label>
                    <input v-model="selectedProfile.source.localPath" @input="markSelectedDirty()"
                      class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500 font-mono"
                      placeholder="/opt/releases/ars-agent/latest" />
                  </div>

                  <!-- FTP Source -->
                  <template v-if="selectedProfile.source.type === 'ftp'">
                    <div class="grid grid-cols-2 gap-4">
                      <div class="flex items-center gap-4">
                        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Host</label>
                        <input v-model="selectedProfile.source.ftpHost" @input="markSelectedDirty()"
                          class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500 font-mono"
                          placeholder="ftp.example.com" />
                      </div>
                      <div class="flex items-center gap-4">
                        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Port</label>
                        <input v-model.number="selectedProfile.source.ftpPort" @input="markSelectedDirty()" type="number"
                          class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500"
                          placeholder="21" />
                      </div>
                      <div class="flex items-center gap-4">
                        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">User</label>
                        <input v-model="selectedProfile.source.ftpUser" @input="markSelectedDirty()"
                          class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500"
                          placeholder="ftpuser" />
                      </div>
                      <div class="flex items-center gap-4">
                        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Password</label>
                        <input v-model="selectedProfile.source.ftpPass" @input="markSelectedDirty()" type="password"
                          class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500"
                          placeholder="********" />
                      </div>
                    </div>
                    <div class="flex items-center gap-4">
                      <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Base Path</label>
                      <input v-model="selectedProfile.source.ftpBasePath" @input="markSelectedDirty()"
                        class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500 font-mono"
                        placeholder="/releases" />
                    </div>
                  </template>

                  <!-- MinIO Source -->
                  <template v-if="selectedProfile.source.type === 'minio'">
                    <div class="grid grid-cols-2 gap-4">
                      <div class="flex items-center gap-4">
                        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Endpoint</label>
                        <input v-model="selectedProfile.source.minioEndpoint" @input="markSelectedDirty()"
                          class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500 font-mono"
                          placeholder="localhost" />
                      </div>
                      <div class="flex items-center gap-4">
                        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Port</label>
                        <input v-model.number="selectedProfile.source.minioPort" @input="markSelectedDirty()" type="number"
                          class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500"
                          placeholder="9000" />
                      </div>
                      <div class="flex items-center gap-4">
                        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Bucket</label>
                        <input v-model="selectedProfile.source.minioBucket" @input="markSelectedDirty()"
                          class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500 font-mono"
                          placeholder="update-source" />
                      </div>
                      <div class="flex items-center gap-4">
                        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20 flex items-center gap-1">
                          <input type="checkbox" v-model="selectedProfile.source.minioUseSSL" @change="markSelectedDirty()"
                            class="rounded border-gray-300 dark:border-dark-border text-green-500 focus:ring-green-500" />
                          SSL
                        </label>
                      </div>
                      <div class="flex items-center gap-4">
                        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Access Key</label>
                        <input v-model="selectedProfile.source.minioAccessKey" @input="markSelectedDirty()"
                          class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500"
                          placeholder="minioadmin" />
                      </div>
                      <div class="flex items-center gap-4">
                        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Secret Key</label>
                        <input v-model="selectedProfile.source.minioSecretKey" @input="markSelectedDirty()" type="password"
                          class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500"
                          placeholder="********" />
                      </div>
                    </div>
                    <div class="flex items-center gap-4">
                      <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Base Path</label>
                      <input v-model="selectedProfile.source.minioBasePath" @input="markSelectedDirty()"
                        class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500 font-mono"
                        placeholder="(optional prefix)" />
                    </div>
                  </template>

                  <!-- Test Connection (FTP / MinIO only) -->
                  <div v-if="selectedProfile.source.type !== 'local'" class="flex items-center gap-4 pt-2 border-t border-gray-200 dark:border-dark-border/50">
                    <div class="w-20"></div>
                    <button @click="handleTestConnection" :disabled="testingConnection"
                      class="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg transition-colors"
                      :class="testingConnection
                        ? 'bg-gray-100 dark:bg-dark-bg border-gray-300 dark:border-dark-border text-gray-400 cursor-wait'
                        : 'bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg text-gray-700 dark:text-gray-300'">
                      <svg v-if="testingConnection" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Test Connection
                    </button>
                    <span v-if="testResult" class="text-sm"
                      :class="testResult.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                      {{ testResult.message }}
                    </span>
                  </div>
                </div>
              </div>
            </template>

            <!-- No profile selected -->
            <div v-else class="flex-1 flex items-center justify-center py-12">
              <div class="text-center text-gray-400 dark:text-gray-500">
                <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p class="text-sm">Add a profile to get started</p>
              </div>
            </div>

            <!-- Per-profile save error -->
            <p v-if="selectedProfile && selectedProfile._saveError" class="text-sm text-red-500">
              {{ selectedProfile._saveError }}
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-dark-border">
          <div class="text-sm text-gray-500 dark:text-gray-400">
            <span v-if="hasUnsavedChanges" class="text-amber-500">
              Unsaved changes in {{ profiles.filter(p => p._dirty).length }} profile(s)
            </span>
          </div>
          <div class="flex gap-3">
            <button
              v-if="selectedProfile"
              @click="saveProfile"
              :disabled="!selectedProfile._dirty || saving"
              class="flex items-center gap-2 px-4 py-2 text-sm bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              :title="selectedProfile.profileId ? 'Update this profile' : 'Create this profile'">
              <svg v-if="saving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              {{ selectedProfile.profileId ? 'Save Profile' : 'Create Profile' }}
            </button>
            <button @click="handleClose"
              class="px-4 py-2 text-sm bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors">
              Close
            </button>
          </div>
        </div>

        <!-- Resize Handle -->
        <div class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize" @mousedown="startResize">
          <svg class="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22 22H20V20H22V22ZM22 18H18V22H22V18ZM18 22H14V18H18V22ZM22 14H14V22H22V14Z" />
          </svg>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<!-- Module-level clipboard (survives component unmount/remount) -->
<script>
let _clipboardProfile = null
let _clipboardTask = null
</script>

<script setup>
import { ref, computed, watch } from 'vue'
import { updateSettingsApi } from '../api'
import { osVersionApi } from '../../equipment-info/api'
import { useResizableModal } from '@/shared/composables/useResizableModal'
import { useToast } from '@/shared/composables/useToast'
import { createProfileSnapshot, createTaskSnapshot, createProfileFromSnapshot, createTaskFromSnapshot, hasProfileDuplicate } from '../composables/updateProfileUtils'
import { parseArgs, stringifyArgs } from '@/shared/utils/shellArgs'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  agentGroup: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue', 'saved'])

// Modal sizing
const modalRef = ref(null)
const { isMaximized, modalStyle, startDrag, startResize, toggleMaximize, center: centerModal } = useResizableModal(modalRef, { defaultWidth: 1024, defaultHeight: 650 })

const { showSuccess, showError } = useToast()
const hasClipboardProfile = ref(!!_clipboardProfile)
const hasClipboardTask = ref(!!_clipboardTask)

const loading = ref(false)
const saving = ref(false)
const profiles = ref([])
const selectedIndex = ref(0)
const osVersionOptions = ref([])
let keyCounter = 0

const selectedProfile = computed(() => profiles.value[selectedIndex.value] || null)
const hasUnsavedChanges = computed(() => profiles.value.some(p => p._dirty))

function markDirty(profile) {
  if (profile) profile._dirty = true
}
function markSelectedDirty() {
  if (selectedProfile.value) selectedProfile.value._dirty = true
}

watch(() => props.modelValue, async (v) => {
  if (v) {
    centerModal()
    if (props.agentGroup) await loadData()
  }
})

// Client-side defaults per source type (DB only stores active type fields)
const SOURCE_DEFAULTS = {
  local: { localPath: '' },
  ftp: { ftpHost: '', ftpPort: 21, ftpUser: '', ftpPass: '', ftpBasePath: '' },
  minio: { minioEndpoint: '', minioPort: 9000, minioBucket: '', minioAccessKey: '', minioSecretKey: '', minioUseSSL: false, minioBasePath: '' }
}

function makeDefaultSource() {
  return { type: 'local', ...SOURCE_DEFAULTS.local }
}

function mapSource(s) {
  const type = s.type || 'local'
  return { type, ...SOURCE_DEFAULTS[type], ...s }
}

async function loadData() {
  loading.value = true
  try {
    const [settingsRes, osRes] = await Promise.all([
      updateSettingsApi.getSettings(props.agentGroup),
      osVersionApi.getDistinct()
    ])
    const doc = settingsRes.data
    osVersionOptions.value = osRes.data?.data || []

    profiles.value = (doc.profiles || []).map(p => ({
      _key: `k_${keyCounter++}`,
      _dirty: false,
      _saveError: null,
      profileId: p.profileId,
      name: p.name || '',
      osVer: p.osVer || '',
      version: p.version || '',
      _nameError: null,
      tasks: (p.tasks || []).map(task => ({
        _key: `k_${keyCounter++}`,
        taskId: task.taskId,
        type: task.type || 'copy',
        name: task.name,
        sourcePath: task.sourcePath || '',
        targetPath: task.targetPath || '',
        description: task.description || '',
        stopOnFail: !!task.stopOnFail,
        commandLine: task.commandLine || '',
        _argsText: stringifyArgs(task.args || []),
        timeout: Math.round((task.timeout || 30000) / 1000),
        _nameError: null,
        _sourcePathError: null,
        _targetPathError: null,
        _commandLineError: null
      })),
      source: mapSource(p.source || {})
    }))

    selectedIndex.value = profiles.value.length > 0 ? 0 : -1
  } catch (error) {
    console.error('Failed to load update settings:', error)
    profiles.value = []
    selectedIndex.value = -1
  } finally {
    loading.value = false
  }
}

function addProfile() {
  profiles.value.push({
    _key: `k_${keyCounter++}`,
    _dirty: true,  // new profile starts dirty (needs Save to persist)
    _saveError: null,
    profileId: null,
    name: '',
    osVer: '',
    version: '',
    _nameError: null,
    tasks: [],
    source: makeDefaultSource()
  })
  selectedIndex.value = profiles.value.length - 1
}

async function deleteProfile() {
  if (selectedIndex.value < 0 || profiles.value.length === 0) return
  const profile = profiles.value[selectedIndex.value]
  if (!profile) return

  // Unsaved (new) profile → just remove from local list.
  if (!profile.profileId) {
    profiles.value.splice(selectedIndex.value, 1)
    selectedIndex.value = Math.min(selectedIndex.value, profiles.value.length - 1)
    return
  }

  // Persisted profile → confirm + DELETE API call.
  if (!window.confirm(`Delete profile "${profile.name}"? This cannot be undone.`)) return

  try {
    await updateSettingsApi.deleteProfile(props.agentGroup, profile.profileId)
    profiles.value.splice(selectedIndex.value, 1)
    selectedIndex.value = Math.min(selectedIndex.value, profiles.value.length - 1)
    showSuccess(`Profile "${profile.name}" deleted`)
    emit('saved')
  } catch (err) {
    profile._saveError = err.response?.data?.message || err.message || 'Delete failed'
    showError(`Delete failed: ${profile._saveError}`)
  }
}

function copyProfile() {
  if (!selectedProfile.value) return
  _clipboardProfile = createProfileSnapshot(selectedProfile.value)
  hasClipboardProfile.value = true
  showSuccess(`Profile '${selectedProfile.value.name}' copied`)
}

function pasteProfile() {
  if (!_clipboardProfile) return
  const existingNames = profiles.value.map(p => p.name)
  const getNextKey = () => `k_${keyCounter++}`
  profiles.value.push(createProfileFromSnapshot(_clipboardProfile, existingNames, getNextKey))
  selectedIndex.value = profiles.value.length - 1
}

function copyTask(index) {
  if (!selectedProfile.value) return
  const src = selectedProfile.value.tasks[index]
  if (!src) return
  _clipboardTask = createTaskSnapshot(src)
  hasClipboardTask.value = true
  showSuccess(`Task '${src.name}' copied`)
}

function pasteTask() {
  if (!selectedProfile.value || !_clipboardTask) return
  const existingNames = selectedProfile.value.tasks.map(t => t.name)
  const getNextKey = () => `k_${keyCounter++}`
  selectedProfile.value.tasks.push(createTaskFromSnapshot(_clipboardTask, existingNames, getNextKey))
  markSelectedDirty()
}

function addTask() {
  if (!selectedProfile.value) return
  selectedProfile.value.tasks.push({
    _key: `k_${keyCounter++}`,
    taskId: null,
    type: 'copy',
    name: '',
    sourcePath: '',
    targetPath: '',
    description: '',
    stopOnFail: false,
    commandLine: '',
    _argsText: '',
    timeout: 30,
    _nameError: null,
    _sourcePathError: null,
    _targetPathError: null,
    _commandLineError: null
  })
  markSelectedDirty()
}

function onTaskTypeChange(task) {
  markSelectedDirty()
}

function onArgsInput(task) {
  markSelectedDirty()
}

function onSourceTypeChange() {
  if (!selectedProfile.value) return
  const type = selectedProfile.value.source.type
  // Apply defaults for the new type (preserves type, fills missing fields)
  selectedProfile.value.source = { type, ...SOURCE_DEFAULTS[type] }
  testResult.value = null
  markSelectedDirty()
}

function removeTask(index) {
  if (!selectedProfile.value) return
  selectedProfile.value.tasks.splice(index, 1)
  markSelectedDirty()
}

function moveTask(index, direction) {
  if (!selectedProfile.value) return
  const tasks = selectedProfile.value.tasks
  let newIndex
  switch (direction) {
    case 'top': newIndex = 0; break
    case 'up': newIndex = index - 1; break
    case 'down': newIndex = index + 1; break
    case 'bottom': newIndex = tasks.length - 1; break
    default: return
  }
  if (newIndex < 0 || newIndex >= tasks.length || newIndex === index) return
  const [task] = tasks.splice(index, 1)
  tasks.splice(newIndex, 0, task)
  markSelectedDirty()
}

/**
 * Validate a single profile. Sets inline errors. Returns true if valid.
 * Also enforces DB-level unique (agentGroup, name, osVer, version) locally:
 * same (name, osVer, version) must not exist in another local profile.
 */
function validateProfile(profile) {
  if (!profile) return false
  let valid = true
  profile._nameError = null
  if (!profile.name || !profile.name.trim()) {
    profile._nameError = 'Required'
    valid = false
  } else if (hasProfileDuplicate(profile, profiles.value)) {
    profile._nameError = 'Duplicates another profile (same name, OS, version)'
    valid = false
  }
  for (const task of profile.tasks) {
    task._nameError = null
    task._sourcePathError = null
    task._targetPathError = null
    task._commandLineError = null
    if (!task.name || !task.name.trim()) {
      task._nameError = 'Required'
      valid = false
    }
    if (task.type === 'copy') {
      if (!task.sourcePath || !task.sourcePath.trim()) {
        task._sourcePathError = 'Required'
        valid = false
      }
      if (!task.targetPath || !task.targetPath.trim()) {
        task._targetPathError = 'Required'
        valid = false
      }
    } else if (task.type === 'exec') {
      if (!task.commandLine || !task.commandLine.trim()) {
        task._commandLineError = 'Required'
        valid = false
      }
    }
  }
  return valid
}

function buildProfilePayload(profile) {
  return {
    profileId: profile.profileId,
    name: profile.name.trim(),
    osVer: (profile.osVer || '').trim(),
    version: (profile.version || '').trim(),
    tasks: profile.tasks.map(task => {
      const base = {
        taskId: task.taskId,
        type: task.type || 'copy',
        name: task.name.trim(),
        description: (task.description || '').trim(),
        stopOnFail: !!task.stopOnFail
      }
      if (task.type === 'exec') {
        base.commandLine = (task.commandLine || '').trim()
        const argsStr = (task._argsText || '').trim()
        const parsed = argsStr ? parseArgs(argsStr) : []
        if (parsed.length > 0) base.args = parsed
        base.timeout = (task.timeout || 30) * 1000
      } else {
        base.sourcePath = (task.sourcePath || '').trim()
        base.targetPath = (task.targetPath || '').trim()
      }
      return base
    }),
    source: { ...profile.source }
  }
}

/**
 * Save the currently selected profile.
 * New profile (profileId=null) → POST. Existing → PUT.
 */
async function saveProfile() {
  const profile = selectedProfile.value
  if (!profile) return
  if (!validateProfile(profile)) return

  saving.value = true
  profile._saveError = null
  try {
    const payload = buildProfilePayload(profile)
    let saved
    if (!profile.profileId) {
      const res = await updateSettingsApi.createProfile(props.agentGroup, payload)
      saved = res.data
    } else {
      const res = await updateSettingsApi.updateProfile(props.agentGroup, profile.profileId, payload)
      saved = res.data
    }
    // Update local state with server-authoritative fields (profileId, taskIds).
    profile.profileId = saved.profileId
    profile._dirty = false
    if (saved.tasks) {
      saved.tasks.forEach((serverTask, i) => {
        if (profile.tasks[i]) profile.tasks[i].taskId = serverTask.taskId
      })
    }
    showSuccess(`Profile "${profile.name}" saved`)
    emit('saved')
  } catch (error) {
    const serverMsg = error.response?.data?.error || error.response?.data?.message
    profile._saveError = serverMsg || error.message || 'Failed to save'
    // Highlight the name field on 409 duplicate — that's the user-actionable field.
    if (error.response?.status === 409) {
      profile._nameError = 'Duplicates existing profile on server'
    }
    showError(profile._saveError)
  } finally {
    saving.value = false
  }
}

// --- Test Connection ---
const testingConnection = ref(false)
const testResult = ref(null)

async function handleTestConnection() {
  if (!selectedProfile.value) return
  testingConnection.value = true
  testResult.value = null
  try {
    const res = await updateSettingsApi.testSourceConnection(selectedProfile.value.source)
    testResult.value = res.data
  } catch (err) {
    testResult.value = { ok: false, message: err.message || 'Request failed' }
  } finally {
    testingConnection.value = false
  }
}

// --- Source Browser ---
const browsingTaskIndex = ref(-1)
const browsePath = ref('')
const browseFiles = ref([])
const browseLoading = ref(false)
const browseError = ref('')

async function browseSource(taskIndex) {
  if (!selectedProfile.value) return
  if (browsingTaskIndex.value === taskIndex) {
    browsingTaskIndex.value = -1
    return
  }
  browsingTaskIndex.value = taskIndex
  browsePath.value = ''
  await loadBrowseFiles('')
}

async function loadBrowseFiles(relativePath) {
  browseLoading.value = true
  browseError.value = ''
  try {
    const res = await updateSettingsApi.listSourceFiles(selectedProfile.value.source, relativePath)
    browseFiles.value = res.data || []
  } catch (err) {
    browseFiles.value = []
    browseError.value = err.response?.data?.error || err.message || 'Failed to load files'
  } finally {
    browseLoading.value = false
  }
}

function browseUp() {
  const parts = browsePath.value.replace(/\/$/, '').split('/')
  parts.pop()
  browsePath.value = parts.length ? parts.join('/') + '/' : ''
  loadBrowseFiles(browsePath.value)
}

function selectBrowseItem(item, taskIndex) {
  if (item.isDirectory) {
    const newPath = browsePath.value + item.name + '/'
    browsePath.value = newPath
    loadBrowseFiles(newPath)
  } else {
    const fullPath = browsePath.value + item.name
    const task = selectedProfile.value.tasks[taskIndex]
    if (task) {
      task.sourcePath = fullPath
      if (!task.targetPath) task.targetPath = fullPath
      markSelectedDirty()
    }
    browsingTaskIndex.value = -1
  }
}

function selectCurrentFolder(taskIndex) {
  const task = selectedProfile.value.tasks[taskIndex]
  if (task) {
    task.sourcePath = browsePath.value
    if (!task.targetPath) task.targetPath = browsePath.value
    markSelectedDirty()
  }
  browsingTaskIndex.value = -1
}

function handleClose() {
  if (hasUnsavedChanges.value) {
    const dirtyCount = profiles.value.filter(p => p._dirty).length
    if (!window.confirm(`${dirtyCount} profile(s) have unsaved changes. Close anyway?`)) return
  }
  centerModal()
  emit('update:modelValue', false)
}
</script>
