const { Pool } = require('pg');

const dbPool = new Pool({
  // database: 'personal_web_b29',
  // port: 5432,
  // user: 'postgres',
  // password: 'root',
  connectionString: 'postgres://occhzuepicagfk:d29237073756dc9e0fd4444edfb7eae578712c24962efb467f5d6f539adf0c55@ec2-18-210-118-224.compute-1.amazonaws.com:5432/d7b34dusgrqdvc',
  ssl: {
     rejectUnauthorized: false,
  },
});

module.exports = dbPool;

