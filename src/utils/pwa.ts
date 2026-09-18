// PWA Service Worker registration and install prompt handler
let deferredPrompt: any = null;

export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.log('PWA ServiceWorker registration notice:', err);
      });
    });

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      window.dispatchEvent(new Event('pwa-can-install'));
    });
  }
}

export function promptPwaInstall(): Promise<boolean> {
  if (!deferredPrompt) {
    return Promise.resolve(false);
  }
  deferredPrompt.prompt();
  return deferredPrompt.userChoice.then((choiceResult: { outcome: string }) => {
    deferredPrompt = null;
    return choiceResult.outcome === 'accepted';
  });
}

export function canInstallPwa(): boolean {
  return Boolean(deferredPrompt);
}
