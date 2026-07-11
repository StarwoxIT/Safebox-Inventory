const fs = require('fs');
const path = require('path');
const db = require('../db');
const brand = require('../config/company');

const defaultProductPhotoPath = path.join(__dirname, '..', 'templates', 'assets', 'product-photo.jpeg');
const defaultProductPhotoDataUri = fs.existsSync(defaultProductPhotoPath)
  ? `data:image/jpeg;base64,${fs.readFileSync(defaultProductPhotoPath).toString('base64')}`
  : null;

const DEFAULT_PROFILE = {
  name: 'SAFEBOX ENERGY',
  reg_number: 'BN3253116',
  address_lines: ['Edo State Head Office,', 'Edo Innovation Hub', '59, I.C.E. Road, Benin City.'],
  email: 'solutionsafebox@gmail.com',
  phone: '08135651507',
  who_we_are:
    'We are a team of energy experts who provide reliable, affordable and convenient solar energy solutions to cater to the power needs of homes, businesses and other organizations.',
  mission: 'To provide clean and efficient power alongside the convenience that follows.',
  vision: 'To create clean energy products and systems which will be the answer to power needs.',
  products_intro:
    'SAFEBOX Energy manufactures solar generators which are designed with different capacities to suit the specific needs of our different customers. SAFEBOX designs solar generators to meet the needs of each customer by auditing for the potential client’s power load and determining the most suitable generator for the customer’s needs, while taking their financial capacity into careful consideration.',
  products_note:
    'Our services include energy provision and consultancy for homes and businesses. As a company based on renewable energy, our company limits the use of non-renewable energy which is not environmentally-friendly.',
  products_list: [
    'System Installation',
    'Energy Consultancy',
    'System monitoring and maintenance',
    'Inverter manufacturing',
    'System Design and construction',
  ],
  product_photo_data_uri: defaultProductPhotoDataUri,
};

function ensureSeeded() {
  const existing = db.prepare('SELECT id FROM company_profile WHERE id = 1').get();
  if (existing) return;

  db.prepare(
    `INSERT INTO company_profile
      (id, name, reg_number, address_lines, email, phone, who_we_are, mission, vision, products_intro, products_note, products_list, product_photo_data_uri)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    DEFAULT_PROFILE.name,
    DEFAULT_PROFILE.reg_number,
    JSON.stringify(DEFAULT_PROFILE.address_lines),
    DEFAULT_PROFILE.email,
    DEFAULT_PROFILE.phone,
    DEFAULT_PROFILE.who_we_are,
    DEFAULT_PROFILE.mission,
    DEFAULT_PROFILE.vision,
    DEFAULT_PROFILE.products_intro,
    DEFAULT_PROFILE.products_note,
    JSON.stringify(DEFAULT_PROFILE.products_list),
    DEFAULT_PROFILE.product_photo_data_uri
  );
}

function rowToProfile(row) {
  return {
    name: row.name,
    regNumber: row.reg_number,
    addressLines: JSON.parse(row.address_lines || '[]'),
    email: row.email,
    phone: row.phone,
    whoWeAre: row.who_we_are,
    mission: row.mission,
    vision: row.vision,
    productsIntro: row.products_intro,
    productsNote: row.products_note,
    productsList: JSON.parse(row.products_list || '[]'),
    productPhotoDataUri: row.product_photo_data_uri,
    updatedAt: row.updated_at,
    logoDataUri: brand.logoDataUri,
    fullLogoDataUri: brand.fullLogoDataUri,
    brandColor: brand.brandColor,
    brandColorLight: brand.brandColorLight,
  };
}

function getCompanyProfile() {
  ensureSeeded();
  const row = db.prepare('SELECT * FROM company_profile WHERE id = 1').get();
  return rowToProfile(row);
}

function updateCompanyProfile(patch) {
  ensureSeeded();
  const existing = db.prepare('SELECT * FROM company_profile WHERE id = 1').get();

  const merged = {
    name: patch.name ?? existing.name,
    reg_number: patch.regNumber ?? existing.reg_number,
    address_lines: patch.addressLines ? JSON.stringify(patch.addressLines) : existing.address_lines,
    email: patch.email ?? existing.email,
    phone: patch.phone ?? existing.phone,
    who_we_are: patch.whoWeAre ?? existing.who_we_are,
    mission: patch.mission ?? existing.mission,
    vision: patch.vision ?? existing.vision,
    products_intro: patch.productsIntro ?? existing.products_intro,
    products_note: patch.productsNote ?? existing.products_note,
    products_list: patch.productsList ? JSON.stringify(patch.productsList) : existing.products_list,
    product_photo_data_uri:
      patch.productPhotoDataUri !== undefined ? patch.productPhotoDataUri : existing.product_photo_data_uri,
  };

  db.prepare(
    `UPDATE company_profile SET
      name = ?, reg_number = ?, address_lines = ?, email = ?, phone = ?,
      who_we_are = ?, mission = ?, vision = ?, products_intro = ?, products_note = ?,
      products_list = ?, product_photo_data_uri = ?, updated_at = datetime('now')
     WHERE id = 1`
  ).run(
    merged.name,
    merged.reg_number,
    merged.address_lines,
    merged.email,
    merged.phone,
    merged.who_we_are,
    merged.mission,
    merged.vision,
    merged.products_intro,
    merged.products_note,
    merged.products_list,
    merged.product_photo_data_uri
  );

  return getCompanyProfile();
}

module.exports = { getCompanyProfile, updateCompanyProfile };
