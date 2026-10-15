// Adaptador de almacenamiento en la nube: Cloudinary (CDN de imágenes con HTTPS).
import { v2 as cloudinary } from 'cloudinary';

// CLOUDINARY_URL = cloudinary://<api_key>:<api_secret>@<cloud_name>
function parseCloudinaryUrl(url) {
  const { username, password, hostname } = new URL(url);
  return { api_key: username, api_secret: decodeURIComponent(password), cloud_name: hostname, secure: true };
}

export function createCloudinaryStorage({ url }) {
  cloudinary.config(parseCloudinaryUrl(url));

  return {
    name: 'cloudinary',

    upload(buffer, { folder }) {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `c2c/${folder}`,
            resource_type: 'image',
            // Normaliza al subir: máximo 1600 px por lado.
            transformation: [{ width: 1600, height: 1600, crop: 'limit' }],
          },
          (err, result) => (err ? reject(err) : resolve({ url: result.secure_url, key: result.public_id })),
        );
        stream.end(buffer);
      });
    },

    async remove(key) {
      await cloudinary.uploader.destroy(key, { resource_type: 'image' });
    },
  };
}
