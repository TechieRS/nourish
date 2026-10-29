"""Use the pinned CA bundle when available, including on macOS Python installs."""

import ssl
from urllib.request import urlopen


def open_url(request, *, timeout):
    try:
        import certifi
    except ImportError:
        context = ssl.create_default_context()
    else:
        context = ssl.create_default_context(cafile=certifi.where())
    return urlopen(request, timeout=timeout, context=context)
