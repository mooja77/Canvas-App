/**
 * Cookie preference banner for the signed-in app shell (/app-shell.html).
 *
 * This file is deliberately NOT a copy of /cookie-consent.js with branches
 * switched off: it contains no Google Tag Manager, Google Ads, Meta, Plausible
 * or Consent Mode code at all, and it never touches window.dataLayer. The app
 * shell therefore cannot load an advertising or marketing tag, and it sends no
 * ad-consent signal, whatever the stored choice is.
 *
 * What the choice still controls inside the app (same storage key as the public
 * site so one choice covers both): optional error reporting (Sentry, started by
 * src/utils/sentryConsent.ts from the events dispatched here) and first-party
 * product events sent to our own API (src/utils/analytics.ts).
 */
(function () {
  'use strict';

  var CONSENT_KEY = 'jms_cookie_consent';

  function readConsent() {
    try {
      return localStorage.getItem(CONSENT_KEY);
    } catch (_error) {
      return null;
    }
  }

  function writeConsent(value) {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch (_error) {
      // A blocked write must not stop the current page applying the choice.
    }
  }

  function showBanner() {
    var existingBanner = document.getElementById('cookie-consent-banner');
    if (existingBanner) {
      var existingButton = existingBanner.querySelector('button');
      if (existingButton) existingButton.focus();
      return;
    }

    var currentConsent = readConsent();
    var banner = document.createElement('div');
    banner.id = 'cookie-consent-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookie consent');
    // Compact floating card so the canvas status bar is never covered.
    banner.className = 'cc-compact';
    document.body.classList.add('cookie-consent-compact');
    var preferenceSummary =
      currentConsent === 'accepted'
        ? 'Optional error reporting is currently on. '
        : currentConsent === 'rejected'
          ? 'Optional error reporting is currently off. '
          : 'Optional error reporting loads only if you accept. No advertising cookies are used in the app. ';
    banner.innerHTML =
      '<div class="cc-inner">' +
      '<p>' +
      preferenceSummary +
      '<a href="/cookies" aria-label="Cookie Policy">Cookies</a></p>' +
      '<div class="cc-buttons">' +
      '<button id="cc-reject" class="cc-btn cc-btn-reject" type="button" aria-label="Reject non-essential cookies">Reject</button>' +
      '<button id="cc-accept" class="cc-btn cc-btn-accept" type="button" aria-label="Accept optional error reporting">Accept</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(banner);

    var resizeObserver;
    function updateBannerHeight() {
      document.documentElement.style.setProperty(
        '--cookie-consent-height',
        banner.getBoundingClientRect().height + 'px',
      );
    }
    updateBannerHeight();
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(updateBannerHeight);
      resizeObserver.observe(banner);
    }

    function dismissBanner() {
      if (resizeObserver) resizeObserver.disconnect();
      document.body.classList.remove('cookie-consent-visible', 'cookie-consent-compact');
      document.documentElement.style.removeProperty('--cookie-consent-height');
      banner.remove();
    }

    document.getElementById('cc-accept').addEventListener('click', function () {
      writeConsent('accepted');
      window.dispatchEvent(new Event('qualcanvas:consent-accepted'));
      dismissBanner();
    });

    document.getElementById('cc-reject').addEventListener('click', function () {
      writeConsent('rejected');
      window.dispatchEvent(new Event('qualcanvas:consent-rejected'));
      // Keep the banner up if the withdrawal could not be stored.
      if (readConsent() === 'accepted') return;
      dismissBanner();
    });
  }

  window.addEventListener('qualcanvas:open-cookie-preferences', showBanner);

  var consent = readConsent();
  if (consent !== 'accepted' && consent !== 'rejected') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showBanner);
    } else {
      showBanner();
    }
  }
})();
