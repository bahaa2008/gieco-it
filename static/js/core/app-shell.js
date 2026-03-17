(function initAppShell(global) {
  function apply() {
    if (!global.ITSystemSettings) {
      return;
    }

    const settings = global.ITSystemSettings.getSettings();
    const titleEl = document.getElementById('brandTitle');
    const subtitleEl = document.getElementById('brandSubtitle');
    const companyEl = document.getElementById('brandCompanyName');
    const logoEl = document.getElementById('brandLogo');

    if (titleEl) {
      titleEl.textContent = settings.title;
    }

    if (subtitleEl) {
      subtitleEl.textContent = settings.subtitle;
    }

    if (companyEl) {
      companyEl.textContent = settings.companyName;
    }

    if (logoEl && settings.logo) {
      logoEl.src = settings.logo;
      logoEl.hidden = false;
    }
  }

  global.ITSystemShell = {
    apply,
  };
}(window));
