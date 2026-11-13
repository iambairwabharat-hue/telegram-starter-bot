
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY")
}

const supabase = createClient(supabaseUrl, supabaseKey)

const BUCKET = "captured-images"

function safeFileName(name = "image.jpg") {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_")
}

export async function uploadCapturedImage({
  buffer,
  fileName = "image.jpg",
  chatId,
  contentType = "image/jpeg",
}) {
  const timestamp = Date.now()
  const safeName = safeFileName(fileName)
  const filePath = `${chatId}/${timestamp}-${safeName}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, buffer, {
      contentType,
      upsert: false,
    })

  if (uploadError) throw uploadError

  const { data, error: dbError } = await supabase
    .from("image_archive")
    .insert({
      file_path: filePath,
      file_name: safeName,
      chat_id: String(chatId),
    })
    .select()
    .single()

  if (dbError) {
    await supabase.storage.from(BUCKET).remove([filePath])
    throw dbError
  }

  return data
}

export async function getLatestImage(chatId) {
  const { data, error } = await supabase
    .from("image_archive")
    .select("*")
    .eq("chat_id", String(chatId))
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error

  return data
}

export async function getImageHistory(chatId, limit = 10) {
  const { data, error } = await supabase
    .from("image_archive")
    .select("*")
    .eq("chat_id", String(chatId))
    .order("captured_at", { ascending: false })
    .limit(limit)

  if (error) throw error

  return data ?? []
}

export async function getSignedImageUrl(filePath) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 60)

  if (error) throw error

  return data.signedUrl
}
