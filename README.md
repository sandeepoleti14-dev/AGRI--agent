# Secure Student Notes - Database

## Overview

This folder contains the database files for the Secure Student Notes project.

The database uses PostgreSQL through Supabase.

## Database Tables

### 1. users

Stores information about registered students.

| Column | Type | Description |
|---|---|---|
| id | INTEGER | Unique user ID |
| name | VARCHAR(100) | Student name |
| email | VARCHAR(255) | Student email |
| password_hash | TEXT | Hashed password |
| created_at | TIMESTAMP | Account creation time |

### 2. notes

Stores notes created by students.

| Column | Type | Description |
|---|---|---|
| id | INTEGER | Unique note ID |
| user_id | INTEGER | ID of the note owner |
| title | VARCHAR(255) | Note title |
| content | TEXT | Note content |
| created_at | TIMESTAMP | Note creation time |
| updated_at | TIMESTAMP | Last update time |

## Relationship

Each user can have multiple notes.

```text
users
  |
  | 1
  |
  |------< notes
             |
             | many
