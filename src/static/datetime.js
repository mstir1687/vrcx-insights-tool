const ISO_DATE_TIME_PREFIX = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/;

export function formatDisplayDateTime(value) {
  if (value == null || value === '') {
    return '';
  }

  const text = String(value);
  const isoMatch = text.match(ISO_DATE_TIME_PREFIX);
  if (isoMatch) {
    return `${isoMatch[1]} ${isoMatch[2]}`;
  }

  return text;
}
