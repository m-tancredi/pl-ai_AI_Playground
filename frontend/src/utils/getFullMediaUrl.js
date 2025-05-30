// Utility per costruire URL assoluti per i media, compatibile con dev/prod e proxy React
export function getFullMediaUrl(url) {
  if (!url) return '';
  // Se già assoluto, restituisci così com'è (ma aggiungi :8080 se localhost senza porta)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname === 'localhost' && !urlObj.port) {
        return `http://localhost:8080${urlObj.pathname}${urlObj.search}${urlObj.hash}`;
      }
      return url;
    } catch (e) {
      return url;
    }
  }
  // Se parte con /, usa window.location.origin (compatibile con proxy React o nginx)
  if (url.startsWith('/')) {
    return `${window.location.origin}${url}`;
  }
  // Altrimenti, fallback
  return `${window.location.origin}/${url.replace(/^\//, '')}`;
} 