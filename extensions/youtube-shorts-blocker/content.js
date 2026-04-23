(() => {
  const SHORTS_PATH_RE = /^\/shorts\/(.+?)(?:[/?#]|$)/;
  const SHORTS_LINK_RE = /\/shorts\//;

  const BLOCKED_SELECTORS = [
    'ytd-reel-shelf-renderer',
    'ytd-rich-section-renderer',
    'ytd-rich-item-renderer',
    'ytd-grid-video-renderer',
    'ytd-video-renderer',
    'ytm-rich-grid-media',
    'ytm-rich-grid-slim-media',
    'ytd-guide-entry-renderer',
    'tp-yt-paper-tab'
  ];

  const isShortsPath = (path) => SHORTS_PATH_RE.test(path);

  const toWatchUrl = (shortsPath) => {
    const match = shortsPath.match(SHORTS_PATH_RE);
    if (!match) return null;

    const videoId = match[1];
    const url = new URL('/watch', window.location.origin);
    url.searchParams.set('v', videoId);
    return url.toString();
  };

  const redirectIfNeeded = () => {
    if (!isShortsPath(window.location.pathname)) return;

    const watchUrl = toWatchUrl(window.location.pathname + window.location.search + window.location.hash);
    if (!watchUrl) return;

    window.location.replace(watchUrl);
  };

  const removeIfShortsContainer = (element) => {
    if (!(element instanceof Element)) return;

    const hasShortsHref =
      SHORTS_LINK_RE.test(element.getAttribute('href') || '') ||
      !!element.querySelector('a[href^="/shorts"], a[href*="/shorts/"]');

    const shortsText = (element.textContent || '').trim().toLowerCase() === 'shorts';

    if (hasShortsHref || shortsText) {
      const removableParent = element.closest(
        'ytd-rich-section-renderer, ytd-reel-shelf-renderer, ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer, ytd-guide-entry-renderer, tp-yt-paper-tab, ytm-rich-grid-media, ytm-rich-grid-slim-media'
      );

      (removableParent || element).remove();
    }
  };

  const scrubDocument = (root = document) => {
    for (const selector of BLOCKED_SELECTORS) {
      root.querySelectorAll(selector).forEach(removeIfShortsContainer);
    }

    root.querySelectorAll('a[href^="/shorts"], a[href*="/shorts/"]').forEach((anchor) => {
      const removableParent = anchor.closest(
        'ytd-rich-section-renderer, ytd-reel-shelf-renderer, ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer, ytd-guide-entry-renderer, tp-yt-paper-tab, ytm-rich-grid-media, ytm-rich-grid-slim-media'
      );

      if (removableParent) {
        removableParent.remove();
      } else {
        anchor.remove();
      }
    });
  };

  let lastHref = window.location.href;
  const onNavigationChange = () => {
    if (window.location.href === lastHref) return;
    lastHref = window.location.href;
    redirectIfNeeded();
    scrubDocument();
  };

  const observer = new MutationObserver((mutations) => {
    onNavigationChange();

    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        removeIfShortsContainer(node);
        scrubDocument(node);
      });
    }
  });

  document.documentElement.setAttribute('data-shorts-blocker', 'on');
  redirectIfNeeded();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scrubDocument(), { once: true });
  } else {
    scrubDocument();
  }

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  window.addEventListener('yt-navigate-finish', () => {
    redirectIfNeeded();
    scrubDocument();
  });
})();
