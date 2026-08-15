/** Inject Vercel Web Analytics and Speed Insights once per page load. */

function ensureQueue(name, queueName) {
  if (typeof window[name] !== 'function') {
    window[name] = function (...args) {
      (window[queueName] = window[queueName] || []).push(args);
    };
  }
}

function appendDeferredScript(src) {
  if (document.querySelector(`script[src="${src}"]`)) return;

  const script = document.createElement('script');
  script.defer = true;
  script.src = src;
  document.head.appendChild(script);
}

ensureQueue('va', 'vaq');
ensureQueue('si', 'siq');
appendDeferredScript('/_vercel/insights/script.js');
appendDeferredScript('/_vercel/speed-insights/script.js');
