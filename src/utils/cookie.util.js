function parseCookieHeader(cookieHeader) {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, item) => {
      const separatorIndex = item.indexOf('=');
      if (separatorIndex === -1) {
        return acc;
      }

      const key = decodeURIComponent(item.slice(0, separatorIndex).trim());
      const value = decodeURIComponent(item.slice(separatorIndex + 1).trim());
      acc[key] = value;
      return acc;
    }, {});
}

module.exports = {
  parseCookieHeader
};
