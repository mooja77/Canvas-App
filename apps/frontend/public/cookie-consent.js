/**
 * Cookie Consent Manager for JMS Dev Lab
 * Integrates with Google Tag Manager Consent Mode v2
 * GDPR/ePrivacy compliant for EU (Ireland)
 */
(function() {
  'use strict';

  // Default consent state — deny all until user accepts
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }

  // Set default consent BEFORE GTM loads any tags
  gtag('consent', 'default', {
    'analytics_storage': 'denied',
    'ad_storage': 'denied',
    'ad_user_data': 'denied',
    'ad_personalization': 'denied',
    'functionality_storage': 'granted',
    'security_storage': 'granted',
    'wait_for_update': 500
  });

  // Check if consent was already given
  var consent = localStorage.getItem('jms_cookie_consent');
  if (consent === 'accepted') {
    gtag('consent', 'update', {
      'analytics_storage': 'granted',
      'ad_storage': 'granted',
      'ad_user_data': 'granted',
      'ad_personalization': 'granted'
    });
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
  banner.innerHTML =
    '<div class="cc-inner">' +
      '<p>We use cookies for analytics and to improve your experience. ' +
      '<a href="/privacy.html">Privacy Policy</a></p>' +
      '<div class="cc-buttons">' +
        '<button id="cc-reject" class="cc-btn cc-btn-reject" type="button" aria-label="Reject non-essential cookies">Reject</button>' +
        '<button id="cc-accept" class="cc-btn cc-btn-accept" type="button" aria-label="Accept all cookies">Accept</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(banner);

  document.getElementById('cc-accept').addEventListener('click', function() {
    localStorage.setItem('jms_cookie_consent', 'accepted');
    gtag('consent', 'update', {
      'analytics_storage': 'granted',
      'ad_storage': 'granted',
      'ad_user_data': 'granted',
      'ad_personalization': 'granted'
    });
    banner.remove();
  });

  document.getElementById('cc-reject').addEventListener('click', function() {
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
