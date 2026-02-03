import { ref } from 'vue'
import { imagesApi } from '@/shared/api'

export function useImageUpload() {
  const isUploading = ref(false)
  const uploadProgress = ref(0)
  const uploadError = ref(null)

  const uploadImage = async (file, prefix) => {
    isUploading.value = true
    uploadProgress.value = 0
    uploadError.value = null

    try {
      const response = await imagesApi.upload(file, prefix)
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
