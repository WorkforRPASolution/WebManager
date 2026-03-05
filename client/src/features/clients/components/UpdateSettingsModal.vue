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
                <div class="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {{ profile.name || '(unnamed)' }}
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
            <div class="px-3 py-2 border-t border-gray-200 dark:border-dark-border flex gap-2">
              <button @click="addProfile"
                class="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-green-500 hover:bg-green-600 text-white rounded transition-colors">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Add
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
                  <input v-model="selectedProfile.name" @input="changed = true"
                    class="w-full px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-bg border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500"
                    :class="{ 'border-red-500': selectedProfile._nameError }"
                    placeholder="Windows v2.0" />
                  <p v-if="selectedProfile._nameError" class="mt-0.5 text-xs text-red-500">{{ selectedProfile._nameError }}</p>
                </div>
                <div>
                  <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">OS Version</label>
                  <select v-model="selectedProfile.osVer" @change="changed = true"
                    class="w-full px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-bg border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500">
                    <option value="">All OS</option>
                    <option v-for="ov in osVersionOptions" :key="ov" :value="ov">{{ ov }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">Version</label>
                  <input v-model="selectedProfile.version" @input="changed = true"
                    class="w-full px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-bg border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500"
                    placeholder="2.0.0" />
                </div>
              </div>

              <!-- Tasks Section -->
              <div>
                <div class="flex items-center justify-between mb-3">
                  <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Deploy Tasks</h4>
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
                <div class="space-y-3">
                  <div v-for="(task, index) in selectedProfile.tasks" :key="task._key"
                    class="border border-gray-200 dark:border-dark-border rounded-lg p-3 space-y-2">
                    <!-- Row 1: Type + Name + StopOnFail + Delete -->
                    <div class="flex items-start gap-3">
                      <div class="w-24 flex-shrink-0">
                        <label class="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-0.5">Type</label>
                        <select v-model="task.type" @change="onTaskTypeChange(task)"
                          class="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-dark-bg border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500">
                          <option value="copy">Copy</option>
                          <option value="exec">Exec</option>
                        </select>
                      </div>
                      <div class="flex-1">
                        <label class="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-0.5">Name</label>
                        <input v-model="task.name" @input="changed = true"
                          class="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-dark-bg border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500"
                          :class="{ 'border-red-500': task._nameError }"
                          :placeholder="task.type === 'exec' ? 'Stop Agent' : 'Agent Binary'" />
                        <p v-if="task._nameError" class="mt-0.5 text-xs text-red-500">{{ task._nameError }}</p>
                      </div>
                      <div class="flex items-end gap-1 pt-3.5">
                        <label class="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap cursor-pointer mr-1">
                          <input type="checkbox" v-model="task.stopOnFail" @change="changed = true"
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
                        <div>
                          <label class="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-0.5">Source Path</label>
                          <div class="flex gap-1">
                            <input v-model="task.sourcePath" @input="changed = true"
                              class="flex-1 px-2 py-1 text-sm border rounded bg-white dark:bg-dark-bg border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500 font-mono"
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
                              <div v-if="browseFiles.length === 0" class="px-3 py-4 text-center text-sm text-gray-400">Empty</div>
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
                          <input v-model="task.targetPath" @input="changed = true"
                            class="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-dark-bg border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500 font-mono"
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
                          <input v-model="task.commandLine" @input="changed = true"
                            class="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-dark-bg border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500 font-mono"
                            :class="{ 'border-red-500': task._commandLineError }"
                            placeholder="net stop resourceagent" />
                          <p v-if="task._commandLineError" class="mt-0.5 text-xs text-red-500">{{ task._commandLineError }}</p>
                        </div>
                        <div>
                          <label class="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-0.5">Timeout (sec)</label>
                          <input v-model.number="task.timeout" @input="changed = true" type="number" min="1"
                            class="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-dark-bg border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500"
                            placeholder="30" />
                        </div>
                      </div>
                      <div>
                        <label class="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-0.5">Args (space-separated)</label>
                        <input v-model="task._argsText" @input="onArgsInput(task)"
                          class="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-dark-bg border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500 font-mono"
                          placeholder="/y /force (optional)" />
                      </div>
                    </template>

                    <!-- Description (common) -->
                    <div>
                      <label class="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-0.5">Description</label>
                      <input v-model="task.description" @input="changed = true"
                        class="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-dark-bg border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500"
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
                    <input v-model="selectedProfile.source.localPath" @input="changed = true"
                      class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500 font-mono"
                      placeholder="/opt/releases/ars-agent/latest" />
                  </div>

                  <!-- FTP Source -->
                  <template v-if="selectedProfile.source.type === 'ftp'">
                    <div class="grid grid-cols-2 gap-4">
                      <div class="flex items-center gap-4">
                        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Host</label>
                        <input v-model="selectedProfile.source.ftpHost" @input="changed = true"
                          class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500 font-mono"
                          placeholder="ftp.example.com" />
                      </div>
                      <div class="flex items-center gap-4">
                        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Port</label>
                        <input v-model.number="selectedProfile.source.ftpPort" @input="changed = true" type="number"
                          class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500"
                          placeholder="21" />
                      </div>
                      <div class="flex items-center gap-4">
                        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">User</label>
                        <input v-model="selectedProfile.source.ftpUser" @input="changed = true"
                          class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500"
                          placeholder="ftpuser" />
                      </div>
                      <div class="flex items-center gap-4">
                        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Password</label>
                        <input v-model="selectedProfile.source.ftpPass" @input="changed = true" type="password"
                          class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500"
                          placeholder="********" />
                      </div>
                    </div>
                    <div class="flex items-center gap-4">
                      <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Base Path</label>
                      <input v-model="selectedProfile.source.ftpBasePath" @input="changed = true"
                        class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500 font-mono"
                        placeholder="/releases" />
                    </div>
                  </template>

                  <!-- MinIO Source -->
                  <template v-if="selectedProfile.source.type === 'minio'">
                    <div class="grid grid-cols-2 gap-4">
                      <div class="flex items-center gap-4">
                        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Endpoint</label>
                        <input v-model="selectedProfile.source.minioEndpoint" @input="changed = true"
                          class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500 font-mono"
                          placeholder="localhost" />
                      </div>
                      <div class="flex items-center gap-4">
                        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Port</label>
                        <input v-model.number="selectedProfile.source.minioPort" @input="changed = true" type="number"
                          class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500"
                          placeholder="9000" />
                      </div>
                      <div class="flex items-center gap-4">
                        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Bucket</label>
                        <input v-model="selectedProfile.source.minioBucket" @input="changed = true"
                          class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500 font-mono"
                          placeholder="update-source" />
                      </div>
                      <div class="flex items-center gap-4">
                        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20 flex items-center gap-1">
                          <input type="checkbox" v-model="selectedProfile.source.minioUseSSL" @change="changed = true"
                            class="rounded border-gray-300 dark:border-dark-border text-green-500 focus:ring-green-500" />
                          SSL
                        </label>
                      </div>
                      <div class="flex items-center gap-4">
                        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Access Key</label>
                        <input v-model="selectedProfile.source.minioAccessKey" @input="changed = true"
                          class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500"
                          placeholder="minioadmin" />
                      </div>
                      <div class="flex items-center gap-4">
                        <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Secret Key</label>
                        <input v-model="selectedProfile.source.minioSecretKey" @input="changed = true" type="password"
                          class="flex-1 px-3 py-1.5 text-sm border rounded bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-green-500"
                          placeholder="********" />
                      </div>
                    </div>
                    <div class="flex items-center gap-4">
                      <label class="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">Base Path</label>
                      <input v-model="selectedProfile.source.minioBasePath" @input="changed = true"
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

            <!-- Error message -->
            <p v-if="saveError" class="text-sm text-red-500">{{ saveError }}</p>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-dark-border">
          <div class="text-sm text-gray-500 dark:text-gray-400">
            <span v-if="changed" class="text-amber-500">Unsaved changes</span>
          </div>
          <div class="flex gap-3">
            <button @click="handleClose"
              class="px-4 py-2 text-sm bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors">
              Cancel
            </button>
            <button @click="handleSave" :disabled="!changed || saving"
              class="flex items-center gap-2 px-4 py-2 text-sm bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <svg v-if="saving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Save
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

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { updateSettingsApi } from '../api'
import { osVersionApi } from '../../equipment-info/api'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  agentGroup: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue', 'saved'])

// Modal sizing
const modalRef = ref(null)
const isMaximized = ref(false)
const modalPos = reactive({ x: null, y: null })
const customWidth = ref(null)
const customHeight = ref(null)
const DEFAULT_WIDTH = 1024
const DEFAULT_HEIGHT = 650

const modalStyle = computed(() => {
  if (isMaximized.value) return { left: '2.5vw', top: '2.5vh', width: '95vw', height: '95vh' }
  const w = customWidth.value || DEFAULT_WIDTH
  const h = customHeight.value || DEFAULT_HEIGHT
  return {
    left: modalPos.x !== null ? `${modalPos.x}px` : `calc(50vw - ${w / 2}px)`,
    top: modalPos.y !== null ? `${modalPos.y}px` : `calc(50vh - ${h / 2}px)`,
    width: `${w}px`, height: `${h}px`, maxWidth: '95vw', maxHeight: '95vh'
  }
})
const toggleMaximize = () => { isMaximized.value = !isMaximized.value }

let isDragging = false, dragStartX = 0, dragStartY = 0, dragStartPosX = 0, dragStartPosY = 0
const startDrag = (e) => {
  if (isMaximized.value) return
  isDragging = true; dragStartX = e.clientX; dragStartY = e.clientY
  const rect = modalRef.value.getBoundingClientRect(); dragStartPosX = rect.left; dragStartPosY = rect.top; e.preventDefault()
}
const doDrag = (e) => { if (!isDragging) return; modalPos.x = Math.max(0, Math.min(window.innerWidth - 100, dragStartPosX + (e.clientX - dragStartX))); modalPos.y = Math.max(0, Math.min(window.innerHeight - 50, dragStartPosY + (e.clientY - dragStartY))) }
const stopDrag = () => { isDragging = false }

let isResizing = false, resizeStartX = 0, resizeStartY = 0, resizeStartW = 0, resizeStartH = 0
const startResize = (e) => {
  isResizing = true; resizeStartX = e.clientX; resizeStartY = e.clientY
  const rect = modalRef.value.getBoundingClientRect(); resizeStartW = rect.width; resizeStartH = rect.height
  modalPos.x = rect.left; modalPos.y = rect.top; e.preventDefault()
}
const doResize = (e) => { if (!isResizing) return; customWidth.value = Math.max(500, Math.min(window.innerWidth * 0.95, resizeStartW + (e.clientX - resizeStartX))); customHeight.value = Math.max(400, Math.min(window.innerHeight * 0.95, resizeStartH + (e.clientY - resizeStartY))) }
const stopResize = () => { isResizing = false }

const onMouseMove = (e) => { doDrag(e); doResize(e) }
const onMouseUp = () => { stopDrag(); stopResize() }
onMounted(() => { document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp) })
onUnmounted(() => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp) })

const loading = ref(false)
const saving = ref(false)
const changed = ref(false)
const saveError = ref(null)
const profiles = ref([])
const selectedIndex = ref(0)
const osVersionOptions = ref([])
let keyCounter = 0

const selectedProfile = computed(() => profiles.value[selectedIndex.value] || null)

watch(() => props.modelValue, async (v) => {
  if (v && props.agentGroup) await loadData()
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
  changed.value = false
  saveError.value = null
  try {
    const [settingsRes, osRes] = await Promise.all([
      updateSettingsApi.getSettings(props.agentGroup),
      osVersionApi.getDistinct()
    ])
    const doc = settingsRes.data
    osVersionOptions.value = osRes.data?.data || []

    profiles.value = (doc.profiles || []).map(p => ({
      _key: `k_${keyCounter++}`,
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
        _argsText: (task.args || []).join(' '),
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
    profileId: null,
    name: '',
    osVer: '',
    version: '',
    _nameError: null,
    tasks: [],
    source: makeDefaultSource()
  })
  selectedIndex.value = profiles.value.length - 1
  changed.value = true
}

function deleteProfile() {
  if (selectedIndex.value < 0 || profiles.value.length === 0) return
  profiles.value.splice(selectedIndex.value, 1)
  selectedIndex.value = Math.min(selectedIndex.value, profiles.value.length - 1)
  changed.value = true
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
  changed.value = true
}

function onTaskTypeChange(task) {
  changed.value = true
}

function onArgsInput(task) {
  changed.value = true
}

function onSourceTypeChange() {
  if (!selectedProfile.value) return
  const type = selectedProfile.value.source.type
  // Apply defaults for the new type (preserves type, fills missing fields)
  selectedProfile.value.source = { type, ...SOURCE_DEFAULTS[type] }
  testResult.value = null
  changed.value = true
}

function removeTask(index) {
  if (!selectedProfile.value) return
  selectedProfile.value.tasks.splice(index, 1)
  changed.value = true
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
  changed.value = true
}

function validate() {
  let valid = true
  for (const profile of profiles.value) {
    profile._nameError = null
    if (!profile.name || !profile.name.trim()) {
      profile._nameError = 'Required'
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
  }
  return valid
}

async function handleSave() {
  if (!validate()) return
  saving.value = true
  saveError.value = null
  try {
    const payload = profiles.value.map(p => ({
      profileId: p.profileId,
      name: p.name.trim(),
      osVer: (p.osVer || '').trim(),
      version: (p.version || '').trim(),
      tasks: p.tasks.map(task => {
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
          if (argsStr) base.args = argsStr.split(/\s+/)
          base.timeout = (task.timeout || 30) * 1000 // sec → ms
        } else {
          base.sourcePath = (task.sourcePath || '').trim()
          base.targetPath = (task.targetPath || '').trim()
        }
        return base
      }),
      source: { ...p.source }
    }))
    await updateSettingsApi.saveSettings(props.agentGroup, payload)
    changed.value = false
    emit('saved')
  } catch (error) {
    saveError.value = error.response?.data?.message || error.message || 'Failed to save'
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
  try {
    const res = await updateSettingsApi.listSourceFiles(selectedProfile.value.source, relativePath)
    browseFiles.value = res.data || []
  } catch {
    browseFiles.value = []
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
      changed.value = true
    }
    browsingTaskIndex.value = -1
  }
}

function selectCurrentFolder(taskIndex) {
  const task = selectedProfile.value.tasks[taskIndex]
  if (task) {
    task.sourcePath = browsePath.value
    if (!task.targetPath) task.targetPath = browsePath.value
    changed.value = true
  }
  browsingTaskIndex.value = -1
}

function handleClose() {
  modalPos.x = null; modalPos.y = null; customWidth.value = null; customHeight.value = null; isMaximized.value = false
  emit('update:modelValue', false)
}
</script>
