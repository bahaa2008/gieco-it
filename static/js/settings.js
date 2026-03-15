(function initITSystemSettings(global) {
  const storageKey = 'it-system-settings-v1';
  const defaults = {
    companyName: 'Default Company',
    logo: '',
    title: 'IT System',
    subtitle: 'واجهة حديثة مبنية باستخدام Bootstrap مع خادم Node.js + Express.',
  };

  function getSettings() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        return { ...defaults };
      }
      const parsed = JSON.parse(raw);
      return {
        companyName: String(parsed.companyName || defaults.companyName),
        logo: String(parsed.logo || defaults.logo),
        title: String(parsed.title || defaults.title),
        subtitle: String(parsed.subtitle || defaults.subtitle),
      };
    } catch (_) {
      return { ...defaults };
    }
  }

  function saveSettings(nextSettings) {
    const sanitized = {
      companyName: String(nextSettings.companyName || defaults.companyName).trim() || defaults.companyName,
      logo: String(nextSettings.logo || '').trim(),
      title: String(nextSettings.title || defaults.title).trim() || defaults.title,
      subtitle: String(nextSettings.subtitle || defaults.subtitle).trim() || defaults.subtitle,
    };

    localStorage.setItem(storageKey, JSON.stringify(sanitized));
    return sanitized;
  }

  function applyPageTitle(pageShortName) {
    const settings = getSettings();
    const companyName = settings.companyName || defaults.companyName;
    const section = String(pageShortName || '').trim();
    document.title = section
      ? `IT System - ${companyName} - ${section}`
      : `IT System - ${companyName}`;
  }



  // Ignore noisy browser-extension messaging rejections that are not caused by app code.
  global.addEventListener('unhandledrejection', (event) => {
    const message = String(event?.reason?.message || event?.reason || '');
    if (message.includes('Could not establish connection. Receiving end does not exist.')) {
      event.preventDefault();
    }
  });

  global.ITSystemSettings = {
    defaults,
    getSettings,
    saveSettings,
    applyPageTitle,
  };
})(window);
