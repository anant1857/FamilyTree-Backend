import express from "express"
import cloudinary from "../config/cloudinary.js"
import { verifyToken } from "../middleware/auth.js"

const router = express.Router()

// Upload image to Cloudinary
router.post("/image", verifyToken, async (req, res) => {
  try {
    const { image } = req.body

    if (!image) {
      return res.status(400).json({ message: "No image data provided" })
    }

    // Upload image to Cloudinary
    const uploadResponse = await cloudinary.uploader.upload(image, {
      folder: "family-tree",
      resource_type: "image",
    })

    res.json({
      url: uploadResponse.secure_url,
      public_id: uploadResponse.public_id,
    })
  } catch (error) {
    console.error("Upload error:", error)
    res.status(500).json({ message: "Error uploading image", error: error.message })
  }
})

// Get all uploaded images from Cloudinary
router.get("/images", verifyToken, async (req, res) => {
  try {
    const result = await cloudinary.api.resources({
      type: "upload",
      prefix: "family-tree",
      max_results: 100,
    })

    const images = result.resources.map((resource) => ({
      url: resource.secure_url,
      public_id: resource.public_id,
      created_at: resource.created_at,
    }))

    res.json(images)
  } catch (error) {
    console.error("Fetch images error:", error)
    res.status(500).json({ message: "Error fetching images", error: error.message })
  }
})

// Delete image from Cloudinary
router.delete("/image/:publicId", verifyToken, async (req, res) => {
  try {
    const publicId = req.params.publicId.replace(/~/g, "/")

    await cloudinary.uploader.destroy(publicId)

    res.json({ message: "Image deleted successfully" })
  } catch (error) {
    console.error("Delete error:", error)
    res.status(500).json({ message: "Error deleting image", error: error.message })
  }
})

export default router
