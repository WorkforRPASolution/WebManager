import { ref, reactive } from 'vue'
import { imagesApi } from '@/shared/api'

// 모듈 레벨 싱글톤 캐시 (모든 컴포넌트에서 공유)
const DEFAULT_CONFIG = { maxFileSizeMB: 5, maxFileSize: 5 * 1024 * 1024, allowedExtensions: ['JPG', 'PNG', 'GIF', 'WebP'] }
const imageConfig = reactive({ ...DEFAULT_CONFIG })
let configLoaded = false
let configPromise = null

async function loadImageConfig() {
  if (configLoaded) return
  if (configPromise) return configPromise
  configPromise = imagesApi.getConfig()
    .then(res => {
      Object.assign(imageConfig, res.data)
      configLoaded = true
    })
    .catch(() => { /* 실패 시 기본값 유지 */ })
    .finally(() => { configPromise = null })
  return configPromise
}

// 모듈 레벨 export (composable 없이 직접 사용 가능)
export { imageConfig, loadImageConfig }

export function useImageUpload() {
  const isUploading = ref(false)
  const uploadProgress = ref(0)
  const uploadError = ref(null)

  // config 로드 (이미 로드됐으면 즉시 반환)
  loadImageConfig()

  const uploadImage = async (file, prefix, context = {}) => {
    isUploading.value = true
    uploadProgress.value = 0
    uploadError.value = null

    try {
      const response = await imagesApi.upload(file, prefix, context)
      uploadProgress.value = 100
      return response.data.image
    } catch (error) {
      uploadError.value = error.response?.data?.message || '업로드에 실패했습니다.'
      throw error
    } finally {
      isUploading.value = false
    }
  }

  const fetchImages = async (prefix) => {
    try {
      const response = await imagesApi.list(prefix)
      return response.data.images || []
    } catch (error) {
      console.error('Failed to fetch images:', error)
      return []
    }
  }

  const deleteImage = async (prefix, name) => {
    try {
      await imagesApi.delete(prefix, name)
      return true
    } catch (error) {
      console.error('Failed to delete image:', error)
      return false
    }
  }

  return {
    isUploading,
    uploadProgress,
    uploadError,
    imageConfig,
    uploadImage,
    fetchImages,
    deleteImage
  }
}
