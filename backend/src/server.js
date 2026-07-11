require('dotenv').config();
require('./db/seed');
const app = require('./app');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Safebox Quotation API listening on port ${PORT}`);
});
