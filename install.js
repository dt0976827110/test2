let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('installBtn').style.display = 'inline-block';
});

document.getElementById('installBtn').addEventListener('click', async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('User response to install prompt:', outcome);
    deferredPrompt = null;
    document.getElementById('installBtn').style.display = 'none';
  }
});

const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

if (isIOS && !isInStandaloneMode) {
  document.getElementById('iosTip').style.display = 'block';
}
