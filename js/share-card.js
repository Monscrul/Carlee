/** Capture the win card as a PNG and share or download it. */

const HTML_TO_IMAGE_URL = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/+esm';

let htmlToImagePromise = null;

function loadHtmlToImage() {
  if (!htmlToImagePromise) {
    htmlToImagePromise = import(HTML_TO_IMAGE_URL);
  }
  return htmlToImagePromise;
}

function waitForImages(root) {
  const images = [...root.querySelectorAll('img')].filter((img) => !img.hidden && img.src);
  return Promise.all(
    images.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        }),
    ),
  );
}

async function blobFromDataUrl(dataUrl) {
  const response = await fetch(dataUrl);
  return response.blob();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Shares a PNG of the game-over card.
 * Hides controls marked `.share-exclude` for a clean capture.
 */
export async function shareGameOverCard({ root, filename = 'carlee-result.png', title = 'Carlee' }) {
  if (!root) throw new Error('Nothing to share');

  const excluded = [...root.querySelectorAll('.share-exclude')];
  const previous = excluded.map((el) => el.style.visibility);

  excluded.forEach((el) => {
    el.style.visibility = 'hidden';
  });

  try {
    await waitForImages(root);
    const { toPng } = await loadHtmlToImage();
    const dataUrl = await toPng(root, {
      cacheBust: true,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      backgroundColor: '#1a2332',
    });
    const blob = await blobFromDataUrl(dataUrl);
    const file = new File([blob], filename, { type: 'image/png' });

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title, text: title });
      return { method: 'share' };
    }

    downloadBlob(blob, filename);
    return { method: 'download' };
  } finally {
    excluded.forEach((el, index) => {
      el.style.visibility = previous[index] || '';
    });
  }
}
