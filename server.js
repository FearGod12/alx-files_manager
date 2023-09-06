const express = require('express');
// eslint-disable-next-line import/no-extraneous-dependencies
const bodyParser = require('body-parser');
const router = require('./routes/index');

const PORT = process.env.PORT || 5000;

const app = express();
app.use(express.json());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(router);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
