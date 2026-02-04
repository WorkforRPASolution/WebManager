import { ref } from 'vue'
import { imagesApi } from '@/shared/api'

export function useImageUpload() {
  const isUploading = ref(false)
  // uploadProgress: 현재는 0 또는 100만 설정 (실제 진행률 미구현)
  // TODO: axios onUploadProgress 콜백으로 실제 진행률 구현 가능
  const uploadProgress = ref(0)
  const uploadError = ref(null)

  /**
   * Upload image with optional context for filtering
   * @param {File} file - Image file to upload
   * @param {string} prefix - Image prefix for URL
   * @param {Object} context - Filter context { process, model, code, subcode }
   */
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
    uploadImage,
    fetchImages,
    deleteImage
  }
}
