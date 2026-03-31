/**
 * Mapping of requirement codes (from SIS courseAttributeValues) to display titles.
 * Used by catalog requirement tags and can be shared with advanced-search.
 */
const REQUIREMENT_LABELS = {
  // Arts & Sciences Requirements
  'ASUD-CSW': 'Cultures & Societies of the World',
  'ASUD-HP': 'Historical Perspectives',
  'ASUD-LS': 'Living Systems',
  'ASUD-AIP': 'Artistic, Interpretive, & Philosophical Inquiry',
  'ASUD-CMP': 'Chemical, Mathematical, and Physical Universe',
  'ASUD-SES': 'Social & Economic Systems',
  'ASUD-SS': 'Science & Society',
  // World Languages
  'ASUW-WL': 'World Languages',
  // Quantification
  'ASUQ-QCD': 'Quantification, Computation & Data Analysis',
  // Writing Requirements
  'ASUR-R21C1': 'First Writing',
  'ASUR-R21C2': 'Second Writing',
};

/**
 * Parse a comma-separated requirement string and return an array of display titles.
 * Unknown codes are shown as-is. Deduplicates.
 * @param {string} courseAttributeValues - e.g. "ASUD-CSW,ASUD-HP"
 * @returns {string[]} Display titles for each requirement
 */
function getRequirementTitles(courseAttributeValues) {
  if (!courseAttributeValues || typeof courseAttributeValues !== 'string') {
    return [];
  }
  const codes = courseAttributeValues
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const seen = new Set();
  const titles = [];
  for (const code of codes) {
    // Hide generic CORE/NCLC tags from catalog badges.
    if (
      code === 'CORE' ||
      code === 'NCLC' ||
      code.startsWith('CORE-') ||
      code.startsWith('NCLC-')
    ) {
      continue;
    }
    if (seen.has(code)) continue;
    seen.add(code);
    const label = REQUIREMENT_LABELS[code];
    titles.push(label != null ? label : code);
  }
  return titles;
}

module.exports = {
  REQUIREMENT_LABELS,
  getRequirementTitles
};
