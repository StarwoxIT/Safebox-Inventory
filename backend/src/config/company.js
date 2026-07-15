const fs = require('fs');
const path = require('path');

const iconPath = path.join(__dirname, '..', 'templates', 'assets', 'safebox-icon.png');
const fullLogoPath = path.join(__dirname, '..', 'templates', 'assets', 'safebox-logo-full.png');

const iconDataUri = `data:image/png;base64,${fs.readFileSync(iconPath).toString('base64')}`;
const fullLogoDataUri = `data:image/png;base64,${fs.readFileSync(fullLogoPath).toString('base64')}`;

module.exports = {
  // Fixed brand identity - not user-editable via the settings UI.
  logoDataUri: iconDataUri,
  fullLogoDataUri,
  brandColor: process.env.COMPANY_BRAND_COLOR || '#B7DC38',
  brandColorLight: process.env.COMPANY_BRAND_COLOR_LIGHT || '#EEF7D9',
  brandBlack: '#000000',
};
