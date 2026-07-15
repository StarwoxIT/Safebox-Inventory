const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { getCompanyProfile, updateCompanyProfile } = require('../services/companyService');
const { logAction } = require('../services/auditService');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  res.json(getCompanyProfile());
});

router.put('/', authenticate, authorize('admin', 'super_admin'), (req, res) => {
  const {
    name,
    regNumber,
    addressLines,
    email,
    phone,
    whoWeAre,
    mission,
    vision,
    productsIntro,
    productsNote,
    productsList,
    productPhotoDataUri,
  } = req.body;

  const updated = updateCompanyProfile({
    name,
    regNumber,
    addressLines,
    email,
    phone,
    whoWeAre,
    mission,
    vision,
    productsIntro,
    productsNote,
    productsList,
    productPhotoDataUri,
  });

  logAction({ user: req.user, action: 'company_profile.update', entityType: 'company_profile', entityId: '1' });
  res.json(updated);
});

module.exports = router;
