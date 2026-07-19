/**
 * Cookie Consent Manager for JMS Dev Lab
 * Integrates with Google Tag Manager Consent Mode v2
 * GDPR/ePrivacy compliant for EU (Ireland)
 */
(function () {
  'use strict';

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
  var consent = localStorage.getItem('jms_cookie_consent');
  if (consent === 'accepted') {
    gtag('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
    });
    loadGoogleTagManager();
    return; // Don't show banner
  }
  if (consent === 'rejected') {
    return; // Don't show banner, consent stays denied
  }

  // Create and show banner after DOM is ready
  function showBanner() {
    var banner = document.createElement('div');
    banner.id = 'cookie-consent-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookie consent');
    // In the canvas workspace the full-width bar covered the status bar (which
    // holds the coding stats). Use a compact floating card there instead;
    // marketing pages keep the standard full-width banner.
    if (window.location.pathname.indexOf('/canvas') === 0) {
      banner.className = 'cc-compact';
    }
    banner.innerHTML =
      '<div class="cc-inner">' +
      '<p>We use cookies for analytics and to improve your experience. ' +
      '<a href="/privacy">Privacy Policy</a></p>' +
      '<div class="cc-buttons">' +
      '<button id="cc-reject" class="cc-btn cc-btn-reject" type="button" aria-label="Reject non-essential cookies">Reject</button>' +
      '<button id="cc-accept" class="cc-btn cc-btn-accept" type="button" aria-label="Accept all cookies">Accept</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(banner);

    document.getElementById('cc-accept').addEventListener('click', function () {
      localStorage.setItem('jms_cookie_consent', 'accepted');
      gtag('consent', 'update', {
        analytics_storage: 'granted',
        ad_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'granted',
      });
      loadGoogleTagManager();
      banner.remove();
    });

    document.getElementById('cc-reject').addEventListener('click', function () {
      localStorage.setItem('jms_cookie_consent', 'rejected');
      banner.remove();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showBanner);
  } else {
    showBanner();
  }
})();
