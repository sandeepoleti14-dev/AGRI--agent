const mysql = require('mysql2/promise');
require('dotenv').config();

// Create MySQL connection pool using environment variables
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'secure_student_notes',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Auto-initialize required SQL tables for users and personal notes
async function initDb() {
  try {
    const connection = await pool.getConnection();

    // Users table for credentials and authentication
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Notes table associated with each user
    await connection.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    connection.release();
    console.log('✅ Connected to MySQL database and verified tables schema.');
  } catch (error) {
    console.warn(`⚠️ MySQL Database notice (${error.code || error.message}): Ensure MySQL server is running and database '${process.env.DB_NAME || 'secure_student_notes'}' exists.`);
  }
}

initDb();

module.exports = pool;
