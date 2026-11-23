require('dotenv').config({ path: '.env' });
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function run() {
  const dummyPdfBase64 = "JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDMgMCBSL0ZpbHRlci9GbGF0ZURlY29kZT4+CnN0cmVhbQp4nDPQM1Qo5ypUMFAwALJMLU31jBQsTAz1DMyB3FzNolS9zLx0vfzclMz0vNQUv5TUVL2kxJLEHIW0/CKF4tQcveT8vHQ9/9QgXwXf/BwlXwXb4IwiheL05PxUBVMFIwUDBQhfnJqTk1pcklmSnKqXmVuQX5yRmphckJqThyrXVA9kCQA6/S2lCmVuZHN0cmVhbQplbmRvYmoKCjMgMCBvYmoKMTQ3CmVuZG9iagoKMSAwIG9iago8PC9UeXBlL1BhZ2UvTWVkaWFCb3hbMCAwIDU5NSA4NDJdL1Jlc291cmNlczw8L0ZvbnQ8PC9GMCA0IDAgUj4+Pj4vQ29udGVudHMgMiAwIFIvUGFyZW50IDUgMCBSPj4KZW5kb2JqCgo0IDAgb2JqCjw8L1R5cGUvRm9udC9TdWJ0eXBlL1R5cGUxL0Jhc2VGb250L1RpbWVzLVJvbWFuPj4KZW5kb2JqCgo1IDAgb2JqCjw8L1R5cGUvUGFnZXMvQ291bnQgMS9LaWRzWzEgMCBSXT4+CmVuZG9iagoKNiAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgNSAwIFI+PgplbmRvYmoKCjcgMCBvYmoKPDwvUHJvZHVjZXIoZ2hvc3RzY3JpcHQpL0NyZWF0aW9uRGF0ZShEOjIwMjExMDI4MTIwMDAwWik+PgplbmRvYmoKCnhyZWYKMCA4CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDIxMyAwMDAwMCBuIAowMDAwMDAwMDE1IDAwMDAwIG4gCjAwMDAwMDAxOTQgMDAwMDAgbiAKMDAwMDAwMDMwMSAwMDAwMCBuIAowMDAwMDAwMzg5IDAwMDAwIG4gCjAwMDAwMDA0NDYgMDAwMDAgbiAKMDAwMDAwMDQ5NSAwMDAwMCBuIAp0cmFpbGVyCjw8L1NpemUgOC9Sb290IDYgMCBSL0luZm8gNyAwIFI+PgpzdGFydHhyZWYKNjAyCiUlRU9GCg==";
  const dataUri = "data:application/pdf;base64," + dummyPdfBase64;
  
  // Try 1: image
  try {
    const res = await cloudinary.uploader.upload(dataUri, { folder: 'test', resource_type: 'image' });
    console.log("Image resource_type:", res.secure_url);
  } catch (e) {
    console.log("Image error:", e.message);
  }

  // Try 2: raw using write file
  try {
    fs.writeFileSync('temp.pdf', Buffer.from(dummyPdfBase64, 'base64'));
    const res = await cloudinary.uploader.upload('temp.pdf', { folder: 'test', resource_type: 'raw' });
    console.log("Raw with file:", res.secure_url);
  } catch (e) {
    console.log("Raw with file error:", e.message);
  }
}

run();
