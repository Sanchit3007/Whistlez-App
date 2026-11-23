const cloudinary = require('cloudinary').v2;

const hasCredential = (value) => typeof value === 'string' && value.trim() !== '' &&
  !/^your_cloudinary_(cloud_name|api_key|api_secret)$/i.test(value.trim());

const credentials = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
};
cloudinary.config(Object.fromEntries(
  Object.entries(credentials).filter(([, value]) => hasCredential(value)).map(([key, value]) => [key, value.trim()])
));

const isCloudinaryConfigured = () => {
  const { cloud_name, api_key, api_secret } = cloudinary.config();
  return [cloud_name, api_key, api_secret].every(hasCredential);
};

const localMedia = {
  ringtones: { type: 'audio', limit: 5 },
  ads: { type: 'image', limit: 2 },
  trending: { type: 'image', limit: 2 },
  logos: { type: 'image', limit: 2 },
  backgrounds: { type: 'image', limit: 2 }
};

class MediaUploadError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const sendMediaUploadError = (res, error) => {
  if (!(error instanceof MediaUploadError)) return false;
  res.status(error.status).json({ success: false, message: error.message });
  return true;
};

const storeLocalMedia = (dataUrl, { type, limit }) => {
  const data = /^data:([a-z]+)\/[a-z0-9.+-]+;base64,([a-z0-9+/]+={0,2})$/i.exec(dataUrl);
  if (!data || data[1].toLowerCase() !== type || data[2].length % 4 !== 0) {
    throw new MediaUploadError(400, `Choose a valid ${type} file and try again.`);
  }
  if (Buffer.byteLength(data[2], 'base64') > limit * 1024 * 1024) {
    throw new MediaUploadError(413, `Choose a file up to ${limit} MB.`);
  }
  // Development records can use the data URL formats already supported by the media fields.
  return dataUrl;
};

/**
 * Uploads a base64 media file (image, pdf, etc.) to Cloudinary.
 * @param {string} base64Data The base64 file data string (e.g. data:image/png;base64,... or raw base64)
 * @param {string} folder The subfolder name inside Cloudinary.
 * @param {string} [resourceType='auto'] The resource type ('image', 'video', 'raw', 'auto').
 * @returns {Promise<string>} The secure URL of the uploaded asset.
 */
const uploadToCloudinary = async (base64Data, folder, resourceType = 'auto') => {
  if (!base64Data) return '';
  if (typeof base64Data !== 'string') {
    throw new MediaUploadError(400, 'Choose a valid media file and try again.');
  }
  if (/^https?:\/\//.test(base64Data)) return base64Data;

  if (!isCloudinaryConfigured()) {
    if ((process.env.NODE_ENV || 'development') === 'development' && localMedia[folder]) {
      return storeLocalMedia(base64Data, localMedia[folder]);
    }
    throw new MediaUploadError(503, 'Media storage is not configured. Set the Cloudinary credentials on the server and try again.');
  }

  try {
    const result = await cloudinary.uploader.upload(base64Data, {
      folder: `whistleapp/${folder}`,
      resource_type: resourceType
    });
    
    if (result.secure_url) return result.secure_url;
  } catch (error) {
    const status = Number(error.http_code);
    console.warn(`Cloudinary upload failed for ${folder} (status ${status || 'unknown'})`);
    if (status === 401 || status === 403) {
      throw new MediaUploadError(503, 'Media storage rejected the server credentials. Check the Cloudinary settings.');
    }
    if (status === 413) throw new MediaUploadError(413, 'The media file is too large. Choose a smaller file.');
    if ([400, 415, 422].includes(status)) {
      throw new MediaUploadError(400, 'Media storage could not read this file. Choose another file and try again.');
    }
  }
  throw new MediaUploadError(502, 'Media storage is unavailable. Try again in a moment.');
};

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
  sendMediaUploadError,
  uploadToCloudinary
};
