/**
 * Cookie Consent Manager for JMS Dev Lab
 * Integrates with Google Tag Manager Consent Mode v2
 * GDPR/ePrivacy compliant for EU (Ireland)
 */
(function () {
  'use strict';

  var CONSENT_KEY = 'jms_cookie_consent';

  // Default consent state — deny all until user accepts
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    dataLayer.push(arguments);
  }

  // Do not load GTM itself before consent. Consent Mode's denied state keeps
  // well-configured Google tags cookieless, but it cannot stop an unrelated or
  // misconfigured tag in the GTM container from attempting to run. Deferring
  // the container is the enforceable privacy boundary.
  function loadGoogleTagManager() {
    if (document.getElementById('google-tag-manager')) return;

    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    var script = document.createElement('script');
    script.id = 'google-tag-manager';
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-NPTXDRDH';
    document.head.appendChild(script);
  }

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
      // A blocked localStorage write must not prevent the current page from
      // applying the user's choice. The banner will reappear next visit.
    }
  }

  function grantAnalyticsConsent() {
    gtag('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
    });
    loadGoogleTagManager();
  }

  function denyAnalyticsConsent() {
    gtag('consent', 'update', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
  }

  function clearOptionalAnalyticsCookies() {
    var optionalPrefixes = ['_ga', '_gid', '_gat', '_gcl_', '_fbp', '_fbc'];
    document.cookie.split(';').forEach(function (rawCookie) {
      var name = rawCookie.split('=')[0].trim();
      if (
        !optionalPrefixes.some(function (prefix) {
          return name.indexOf(prefix) === 0;
        })
      )
        return;
      var expired = name + '=; Max-Age=0; path=/; SameSite=Lax';
      document.cookie = expired;
      // Production analytics cookies may have been written for the parent
      // domain. Expire both host-only and parent-domain variants.
      document.cookie = expired + '; domain=qualcanvas.com';
      document.cookie = expired + '; domain=.qualcanvas.com';
    });
  }

  // Set default consent BEFORE GTM loads any tags
  gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500,
  });

  // Check if consent was already given
  var consent = readConsent();
  if (consent === 'accepted') {
    grantAnalyticsConsent();
  }

  // Create and show banner after DOM is ready
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
    // In the canvas workspace the full-width bar covered the status bar (which
    // holds the coding stats). Use a compact floating card there instead;
    // marketing pages keep the standard full-width banner.
    if (window.location.pathname.indexOf('/canvas') === 0) {
      banner.className = 'cc-compact';
      document.body.classList.add('cookie-consent-compact');
    } else {
      document.body.classList.add('cookie-consent-visible');
    }
    var preferenceSummary =
      currentConsent === 'accepted'
        ? 'Optional analytics and conversion measurement are currently on. '
        : currentConsent === 'rejected'
          ? 'Optional analytics and conversion measurement are currently off. '
          : 'We use optional analytics and conversion measurement only with your permission. ';
    banner.innerHTML =
      '<div class="cc-inner">' +
      '<p>' +
      preferenceSummary +
      '<a href="/cookies">Cookie Policy</a></p>' +
      '<div class="cc-buttons">' +
      '<button id="cc-reject" class="cc-btn cc-btn-reject" type="button" aria-label="Reject non-essential cookies">Reject</button>' +
      '<button id="cc-accept" class="cc-btn cc-btn-accept" type="button" aria-label="Accept all cookies">Accept</button>' +
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
      grantAnalyticsConsent();
      dismissBanner();
    });

    document.getElementById('cc-reject').addEventListener('click', function () {
      var wasAccepted = readConsent() === 'accepted';
      writeConsent('rejected');
      denyAnalyticsConsent();
      clearOptionalAnalyticsCookies();
      dismissBanner();
      // Once GTM has executed, removing its script element cannot unload the
      // running container. Reload only for a withdrawal from an accepted
      // state; a first-time rejection remains instantaneous.
      if (wasAccepted) window.location.reload();
    });
  }

  window.addEventListener('qualcanvas:open-cookie-preferences', showBanner);

  // Existing choices remain quiet on normal page loads. The footer can still
  // call showBanner through the event above so either choice can be changed.
  if (consent !== 'accepted' && consent !== 'rejected') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showBanner);
    } else {
      showBanner();
    }
  }
})();
